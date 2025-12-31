import type * as m from 'monaco-editor';
import './index.css';
import { type HighlightRange, MonacoEditor } from './monaco/MonacoEditor';
import { syncMonacoToPyodide } from './monaco/MonacoStore';
import { createPyodide, debugPythonCode, NOTRACE_FILENAME, runPythonCode } from './pyodide/PyEnv';
import {
  frameHighlightRange,
  syntaxErrorHighlightRange,
} from './pyodide/utils';
import { SYM_NIL, normalizeNewlines } from './utils';
import { Views } from './views/Views';
import type { PyodideAPI } from 'pyodide';
import type { PyProxy } from 'pyodide/ffi';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Terminal } from 'xterm';

export function App() {
  const [model, setModel] = useState<m.editor.ITextModel | null>(null);
  const [editorError, setEditorError] = useState<{
    message: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  } | null>(null);
  const [split, setSplit] = useState(0.5);
  const [pyodide, setPyodide] = useState<PyodideAPI | null>(null);
  const [debugCb, setDebugCb] = useState<((stopDebug?: true) => void) | null>(
    null,
  );
  const highlightRef = useRef<HighlightRange>(null);
  const [highlight, setHighlight] = useState<HighlightRange | null>(null);
  const [frame, setFrame] = useState<PyProxy | null>(null);
  const [loadedValue, setLoadedValue] = useState<unknown>(SYM_NIL);
  const [running, setRunning] = useState(false);
  const interruptBuffer = useRef<[number]>([0]);
  const xtermRef = useRef<Terminal>(null);

  useEffect(() => {
    createPyodide(xtermRef).then(py => {
      setPyodide(py);
    });
  }, []);

  const runCode = useCallback(
    async (model: m.editor.ITextModel, debug: boolean) => {
      if (!pyodide) {
        console.warn('Pyodide is not loaded yet.');
        return;
      }

      const xterm = xtermRef.current;
      if (!xterm) {
        console.warn('XTerm is not available.');
        return;
      }

      syncMonacoToPyodide();

      setRunning(true);
      setEditorError(null); // Clear error before running

      const code = model.getValue();
      const filename = model.uri.path || 'script.py';

      const lines = code.split('\n').length;

      const promise = debug
        ? debugPythonCode(
            code,
            filename,
            (frame, event) => {
              const line = frame.f_lineno;
              if (line > lines || line < 1) {
                return Promise.resolve();
              }
              if (event !== 'opcode') {
                return Promise.resolve();
              }

              const lasti = frame.f_lasti;
              const arg = frame.f_code.co_code[lasti + 1];

              let loadedValue: unknown = SYM_NIL;

              const opcode = code[lasti];
              const opnameArr = pyodide.pyimport('dis').opname;
              const opname =
                typeof opcode === 'number' && Array.isArray(opnameArr)
                  ? opnameArr[opcode]
                  : undefined;

              switch (opname) {
                // opcodes we don't need to handle
                case 'NOP':
                case 'POP_TOP':
                case 'RETURN_VALUE':
                case 'PUSH_NULL':
                  return Promise.resolve();
                case 'LOAD_CONST':
                  loadedValue = frame.f_code.co_consts[arg];
                  break;
                case 'LOAD_NAME':
                  const name = frame.f_code.co_names[arg];
                  if (name in frame.f_locals) {
                    loadedValue = frame.f_locals[name];
                  } else if (name in frame.f_globals) {
                    loadedValue = frame.f_globals[name];
                  } else if (name in frame.f_builtins) {
                    loadedValue = frame.f_builtins[name];
                  }
                  break;
              }

              const newHighlight: HighlightRange = frameHighlightRange(frame);

              // if the new highlight is the same as the current one, just continue
              if (
                highlightRef.current &&
                newHighlight &&
                newHighlight.startLine === highlightRef.current.startLine &&
                newHighlight.endLine === highlightRef.current.endLine &&
                ('startColumn' in highlightRef.current
                  ? 'startColumn' in newHighlight &&
                    newHighlight.startColumn ===
                      highlightRef.current.startColumn &&
                    newHighlight.endColumn === highlightRef.current.endColumn
                  : true)
              ) {
                return Promise.resolve();
              }

              setFrame(frame.copy());
              setLoadedValue(() => loadedValue);
              setHighlight((highlightRef.current = newHighlight));
              // return Promise.resolve();
              return new Promise<void | true>(resolve => {
                setDebugCb(() => (stopDebug: undefined | true = undefined) => {
                  resolve(stopDebug);
                });
              });
            },
            interruptBuffer.current,
          )
        : runPythonCode(code, filename, interruptBuffer.current);
      try {
        await promise.catch(error => {
          const xterm = xtermRef.current;
          if (!xterm) {
            console.warn('XTerm is not available.');
            return;
          }

          const [msg, traceback, err] = pyodide
            .runPython(
              `
import sys, traceback

exc = sys.last_exc
tb = exc.__traceback__

for _ in range(2):
    if tb and tb.tb_next:
        tb = tb.tb_next

# Remove any no-trace frames
prev = None
curr = tb
while curr:
    if curr.tb_frame.f_code.co_filename == '${NOTRACE_FILENAME}':
        if prev is None:
            tb = curr.tb_next
        else:
            prev.tb_next = curr.tb_next
    else:
        prev = curr
    curr = curr.tb_next

msg = traceback.format_exception(type(exc), exc, tb)

while tb.tb_next:
    tb = tb.tb_next

(msg, tb, exc)
`,
              {
                filename: NOTRACE_FILENAME,
                globals: pyodide.toPy({
                  ...pyodide.globals.toJs(),
                }),
              },
            )
            .toJs();

          const highlight = (syntaxErrorHighlightRange(err) ??
            frameHighlightRange(traceback.tb_frame))!;

          setEditorError({
            message: msg.join('') as string,
            ...highlight,
            startColumn: 'startColumn' in highlight ? highlight.startColumn : 1,
            endColumn: 'endColumn' in highlight ? highlight.endColumn : 999999,
          });
          xterm.write(`\x1b[31m${normalizeNewlines(msg.join(''))}\x1b[0m`);

          traceback.destroy();
          err.destroy();
        });
      } finally {
        setRunning(false);
        setDebugCb(null);
        setHighlight((highlightRef.current = null));
        setFrame(null);
        setLoadedValue(SYM_NIL);
      }
    },
    [pyodide],
  );

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={{
        background: 'rgb(30, 30, 30)',
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          height: `${split * 100}vh`,
        }}
      >
        <MonacoEditor
          highlight={highlight}
          frame={frame}
          loadedValue={loadedValue}
          model={model}
          setModel={setModel}
          error={editorError}
        />

        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <button
            className="cursor-pointer rounded bg-green-600 px-3 py-1 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (debugCb) {
                debugCb(true);
                setDebugCb(null);
                setHighlight((highlightRef.current = null));
                setFrame(null);
                setLoadedValue(SYM_NIL);
                return;
              }
              if (running) {
                // Signal interrupt
                interruptBuffer.current[0] = 1;
                return;
              }
              if (!model) return;
              runCode(model, false);
            }}
          >
            {running && !debugCb ? 'Stop' : 'Run'}
          </button>
          <button
            className="cursor-pointer rounded bg-green-600 px-3 py-1 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (debugCb) {
                debugCb();
                return;
              }
              if (!model) return;
              runCode(model, true);
            }}
            disabled={running && !debugCb}
          >
            {debugCb ? 'Continue' : 'Debug'}
          </button>
        </div>
      </div>
      <div className="relative z-10 h-0 w-full">
        <div className="absolute inset-0 h-0.5 -translate-y-1/2 bg-white/50" />
        <div
          className="absolute inset-0 h-2 -translate-y-1/2 cursor-row-resize bg-transparent transition hover:bg-gray-300/50"
          onMouseDown={e => {
            const startY = e.clientY;
            const startSplit = split;
            const onMouseMove = (e: MouseEvent) => {
              const deltaY = e.clientY - startY;
              const newSplit = startSplit + deltaY / window.innerHeight;
              setSplit(Math.min(Math.max(newSplit, 0.1), 0.9));
            };
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}
        />
      </div>
      <div
        className="overflow-hidden"
        style={{
          height: `${(1 - split) * 100}vh`,
        }}
      >
        <Views split={split} outTermRef={xtermRef} />
      </div>
    </div>
  );
}

export default App;
