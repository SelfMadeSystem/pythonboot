import { useCallback, useEffect, useRef, useState } from "react";
import "./index.css";
import { MonacoEditor, type HighlightRange } from "./monaco/MonacoEditor";
import { XTerminal } from "./xterm/XTerminal";
import type { PyodideAPI } from "pyodide";
import { createPyodide, debugPythonCode, runPythonCode } from "./pyodide/PyEnv";
import type * as m from "monaco-editor";
import type { Terminal } from "xterm";
import { normalizeNewlines, SYM_NIL } from "./utils";
import type { PyProxy } from "pyodide/ffi";

export function App() {
  const [model, setModel] = useState<m.editor.ITextModel | null>(null);
  const [split, setSplit] = useState(0.5);
  const [pyodide, setPyodide] = useState<PyodideAPI | null>(null);
  const [debugCb, setDebugCb] = useState<(() => void) | null>(null);
  const highlightRef = useRef<HighlightRange>(null);
  const [highlight, setHighlight] = useState<HighlightRange | null>(null);
  const [frame, setFrame] = useState<PyProxy | null>(null);
  const [loadedValue, setLoadedValue] = useState<unknown>(SYM_NIL);
  const xtermRef = useRef<Terminal>(null);

  useEffect(() => {
    createPyodide(xtermRef).then((py) => {
      setPyodide(py);
    });
  }, []);

  const runCode = useCallback(
    async (model: m.editor.ITextModel, debug: boolean) => {
      if (!pyodide) {
        console.warn("Pyodide is not loaded yet.");
        return;
      }

      const xterm = xtermRef.current;
      if (!xterm) {
        console.warn("XTerm is not available.");
        return;
      }
      const code = model.getValue();
      const filename = model.uri.path || "script.py";

      const lines = code.split("\n").length;

      const promise = debug
        ? debugPythonCode(code, filename, (frame, event) => {
            const line = frame.f_lineno;
            if (line > lines || line < 1) {
              return Promise.resolve();
            }
            const fname = frame.f_code.co_filename;
            const func = frame.f_code.co_name;
            if (event !== "opcode") {
              console.log(
                `[DEBUG TRACE] event: ${event}, line: ${line}, filename: ${fname}, func: ${func}`
              );
              return Promise.resolve();
            }

            const code = frame.f_code.co_code;
            const lasti = frame.f_lasti;
            const positions = [...frame.f_code.co_positions()];

            const instrIndex = Math.floor(lasti / 2);
            const arg = frame.f_code.co_code[lasti + 1];

            const [startLine, endLine, startCol, endCol] = positions[
              instrIndex
            ] || [null, null, null, null];

            let loadedValue: unknown = SYM_NIL;

            const opcode = code[lasti];
            const opname = pyodide.pyimport("dis").opname[opcode];

            switch (opname) {
              // opcodes we don't need to handle
              case "NOP":
              case "POP_TOP":
              case "RETURN_VALUE":
              case "PUSH_NULL":
                return Promise.resolve();
              case "LOAD_CONST":
                loadedValue = frame.f_code.co_consts[arg];
                break;
              case "LOAD_NAME":
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

            console.log(`[DEBUG TRACE] opcode: ${opname} (${opcode})`, {
              line,
              fname,
              func,
              instrIndex,
              startLine,
              startCol,
              endLine,
              endCol,
              arg,
              loadedValue,
            });

            const newHighlight: HighlightRange = {
              startLine: startLine || line,
              endLine: endLine || line,
              startColumn: (startCol || 0) + 1,
              endColumn: (endCol || 0) + 1,
            };

            // if the new highlight is the same as the current one, just continue
            if (
              highlightRef.current &&
              newHighlight.startLine === highlightRef.current.startLine &&
              newHighlight.endLine === highlightRef.current.endLine &&
              "startColumn" in highlightRef.current &&
              newHighlight.startColumn === highlightRef.current.startColumn &&
              newHighlight.endColumn === highlightRef.current.endColumn
            ) {
              return Promise.resolve();
            }

            setFrame(frame.copy());
            setLoadedValue(() => loadedValue);
            setHighlight((highlightRef.current = newHighlight));
            // return Promise.resolve();
            return new Promise<void>((resolve) => {
              setDebugCb(() => () => {
                resolve();
              });
            });
          })
        : runPythonCode(code, filename);
      try {
        await promise.catch((error) => {
          const xterm = xtermRef.current;
          if (!xterm) {
            console.warn("XTerm is not available.");
            return;
          }
          let output = "";
          if (error && typeof error.message === "string") {
            // Filter out Pyodide internals and JS wrapper
            output = error.message;
          } else {
            output = String(error);
          }
          xterm.write(`\x1b[31m${normalizeNewlines(output)}\x1b[0m`);
        });
      } finally {
        setDebugCb(null);
        setHighlight((highlightRef.current = null));
        setFrame(null);
        setLoadedValue(SYM_NIL);
      }
    },
    [pyodide]
  );

  return (
    <div
      className="flex flex-col relative min-h-screen"
      style={{
        background: "rgb(30, 30, 30)",
      }}
    >
      <div
        className="relative"
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
        />

        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <button
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded cursor-pointer"
            onClick={() => {
              if (!model) return;
              runCode(model, false);
            }}
          >
            Run
          </button>
          <button
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded cursor-pointer"
            onClick={() => {
              if (debugCb) {
                debugCb();
                return;
              }
              if (!model) return;
              runCode(model, true);
            }}
          >
            {debugCb ? "Continue" : "Debug"}
          </button>
        </div>
      </div>
      <div className="relative h-0 w-full z-10">
        <div className="absolute inset-0 h-0.5 -translate-y-1/2 bg-white/50" />
        <div
          className="absolute inset-0 h-2 -translate-y-1/2 bg-transparent cursor-row-resize hover:bg-gray-300/50 transition"
          onMouseDown={(e) => {
            const startY = e.clientY;
            const startSplit = split;
            const onMouseMove = (e: MouseEvent) => {
              const deltaY = e.clientY - startY;
              const newSplit = startSplit + deltaY / window.innerHeight;
              setSplit(Math.min(Math.max(newSplit, 0.1), 0.9));
            };
            const onMouseUp = () => {
              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);
            };
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
          }}
        />
      </div>
      <div
        className="overflow-hidden"
        style={{
          height: `${(1 - split) * 100}vh`,
        }}
      >
        <XTerminal split={split} xtermRef={xtermRef} />
      </div>
    </div>
  );
}

export default App;
