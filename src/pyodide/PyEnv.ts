import astUtilsSrc from './astUtils.py' with { type: 'text' };
import asyncInputsSrc from './asyncInputs.py' with { type: 'text' };
import infoSrc from './info.py' with { type: 'text' };
import syncInputsSrc from './syncInputs.py' with { type: 'text' };
import traceSrc from './trace.py' with { type: 'text' };
import warnJSPISrc from './warnJSPI.py' with { type: 'text' };
import { waitForEditorInstance } from '@/monaco/MonacoStore';
import { normalizeNewlines } from '@/utils';
import { type PyodideAPI, loadPyodide } from 'pyodide';
import type { PyProxy } from 'pyodide/ffi';
import type { RefObject } from 'react';
import type { Terminal } from 'xterm';

export const HOME = '/home/pyboot';
export const NOTRACE_FILENAME = '<no-trace>';

let pyodide: PyodideAPI | null = null;
const pyodideCbs: ((pyodide: PyodideAPI) => void)[] = [];
let normalTrace:
  | ((filename: string, interruptBuffer: { 0: number }) => PyProxy)
  | null = null;
let debugTrace:
  | ((
      cb: Function,
      filename: string,
      interruptBuffer: { 0: number },
    ) => PyProxy)
  | null = null;

export function getPyodide(): PyodideAPI | null {
  return pyodide;
}

export async function waitForPyodide(): Promise<PyodideAPI> {
  if (pyodide) {
    return pyodide;
  }

  return new Promise<PyodideAPI>(resolve => {
    pyodideCbs.push(resolve);
  });
}

async function runPySrcOrFetch(
  src: string,
  options?: {
    globals?: PyProxy;
    locals?: PyProxy;
    filename?: string;
  },
): Promise<unknown> {
  const pyodide = getPyodide();
  if (!pyodide) {
    throw new Error('Pyodide is not loaded.');
  }
  options = {
    globals: pyodide.toPy({
      ...pyodide.globals.toJs(),
    }),
    filename: NOTRACE_FILENAME,
    ...options,
  };
  if (src.startsWith('/')) {
    const res = await fetch(src);
    const code = await res.text();
    return await pyodide.runPythonAsync(code, options);
  }
  return await pyodide.runPythonAsync(src, options);
}

export async function createPyodide(
  xtermRef: RefObject<Terminal | null>,
): Promise<PyodideAPI> {
  if (!pyodide) {
    // if in MAIN, wait for monaco to load first
    if (window.MAIN) {
      await waitForEditorInstance();
    }

    pyodide = await loadPyodide({
      indexURL: `${window.CDN_URL ?? window.location.origin}/pyodide/`,
      env: {
        HOME,
      },
      packages: ['micropip'],
    });

    await setupPyodide(pyodide, xtermRef);

    pyodideCbs.forEach(cb => cb(pyodide!));
    pyodideCbs.length = 0;
  }
  return pyodide;
}

async function setupPyodide(
  py: PyodideAPI,
  xtermRef: RefObject<Terminal | null>,
) {
  py.setStdout({
    write: (data: Uint8Array) => {
      // Normalize newlines for terminal
      const text = normalizeNewlines(new TextDecoder().decode(data));
      if (xtermRef.current) {
        xtermRef.current.write(text);
      }
      return data.length;
    },
  });
  py.setStderr({
    write: (data: Uint8Array) => {
      const text = normalizeNewlines(new TextDecoder().decode(data));
      if (xtermRef.current) {
        xtermRef.current.write(`\x1b[31m${text}\x1b[0m`); // Red color for errors
      }
      return data.length;
    },
  });
  py.setStdin({
    read: (buf: Uint8Array) => {
      const input = prompt('Input required:') || '';
      const inputBytes = new TextEncoder().encode(input + '\n');
      buf.set(inputBytes.slice(0, buf.length));
      return Math.min(inputBytes.length, buf.length);
    },
  });

  let rejectPrevRead: (() => void) | null = null;

  py.registerJsModule('xterm', {
    getXTerm: () => {
      return xtermRef.current;
    },
    writeToXTerm: (text: string) => {
      if (xtermRef.current) {
        xtermRef.current.write(normalizeNewlines(text));
      }
    },
    readFromXTerm: async () => {
      if (rejectPrevRead) {
        rejectPrevRead();
      }

      const xterm = xtermRef.current;
      if (!xterm) return '';
      xterm.options.cursorBlink = true;
      xterm.focus();

      return new Promise<string | Error>(resolve => {
        rejectPrevRead = () => {
          rejectPrevRead = null;
          xterm.options.cursorBlink = false;
          offData.dispose();
          resolve(new Error('Input interrupted'));
        };

        let input = '';
        // 0 is at the end of the line, 1 is before the last character, etc.
        let cursor = 0;

        const onData = (data: string) => {
          switch (data) {
            case '\r':
            case '\n':
              xterm.write('\r\n');
              offData.dispose();
              xterm.options.cursorBlink = false;
              resolve(input);
              break;
            case '\u007F':
              // Handle backspace
              if (input.length > 0 && cursor < input.length) {
                // Remove character before the cursor
                const beforeCursor = input.slice(0, input.length - cursor - 1);
                const afterCursor = input.slice(input.length - cursor);
                input = beforeCursor + afterCursor;
                xterm.write('\b \b');
                xterm.write('\x1b[s'); // Save cursor position
                xterm.write('\x1b[K'); // Clear to end of line
                xterm.write(afterCursor);
                xterm.write('\x1b[u'); // Restore cursor position
              }
              break;
            case '\x1b[3~':
              // Handle Delete key
              if (input.length > 0 && cursor > 0) {
                // Remove character at the cursor
                const beforeCursor = input.slice(0, input.length - cursor);
                const afterCursor = input.slice(input.length - cursor + 1);
                input = beforeCursor + afterCursor;
                // Redraw the line from the cursor position
                xterm.write('\x1b[s'); // Save cursor position
                xterm.write('\x1b[K'); // Clear to end of line
                xterm.write(afterCursor);
                xterm.write('\x1b[u'); // Restore cursor position
                cursor--;
              }
              break;
            case '\u0003':
              // Handle Ctrl+C
              offData.dispose();
              xterm.write('^C\r\n');
              xterm.options.cursorBlink = false;
              resolve(new Error('KeyboardInterrupt'));
              break;
            case '\u0004':
              // Handle Ctrl+D
              offData.dispose();
              xterm.write('\r\n');
              xterm.options.cursorBlink = false;
              resolve(new Error('EOFError'));
              break;
            case '\x1b[D':
              // Left arrow
              if (cursor < input.length) {
                xterm.write('\x1b[D');
                cursor++;
              }
              break;
            case '\x1b[C':
              // Right arrow
              if (cursor > 0) {
                xterm.write('\x1b[C');
                cursor--;
              }
              break;
            case '\x1b[A':
            case '\x1b[B':
              // Up and Down arrows - ignore
              break;
            case '\x1b[H':
            case '\x1b[1~':
              // Home key - move cursor to start of line
              while (cursor < input.length) {
                xterm.write('\x1b[D');
                cursor++;
              }
              break;
            case '\x1b[F':
            case '\x1b[4~':
              // End key - move cursor to end of line
              while (cursor > 0) {
                xterm.write('\x1b[C');
                cursor--;
              }
              break;
            default:
              // Ignore other control characters
              if (data < ' ' || data === '\x7F') {
                return;
              }
              // Regular character input
              input =
                input.slice(0, input.length - cursor) +
                data +
                input.slice(input.length - cursor);
              // Redraw the line from the cursor position
              xterm.write('\x1b[s'); // Save cursor position
              xterm.write(input.slice(input.length - cursor - data.length));
              xterm.write('\x1b[u'); // Restore cursor position
              xterm.write(`\x1b[C`); // Move cursor to correct position
              break;
          }
        };
        const offData = xterm.onData(onData);
      });
    },
  });

  if ('Suspending' in WebAssembly) {
    // Supports async inputs
    await runPySrcOrFetch(asyncInputsSrc);
  } else {
    // Warn user that async inputs and debugging won't work
    await runPySrcOrFetch(warnJSPISrc);
  }

  await runPySrcOrFetch(syncInputsSrc);

  await runPySrcOrFetch(infoSrc);

  setupHintingFunc = (await runPySrcOrFetch(astUtilsSrc)) as (
    source: string,
  ) => HintingFunc;

  [normalTrace, debugTrace] = (await runPySrcOrFetch(traceSrc)) as any; // can't be arsed to type this properly
}

type HintingFunc = (
  frame: PyProxy,
) => [line: number, col: number, varname: string, valueStr: string][];

let setupHintingFunc: ((source: string) => HintingFunc) | null = null;

export function setupHinting(source: string): HintingFunc | null {
  if (!setupHintingFunc) {
    throw new Error('AST utils not loaded yet.');
  }
  const func = setupHintingFunc!(source);
  return (frame: PyProxy) => {
    //@ts-expect-error I don't feel like properly typing this
    return func(frame).toJs();
  };
}

let formatPythonFunc: ((code: string) => Promise<string>) | null = null;

export async function formatPython(code: string): Promise<string> {
  if (formatPythonFunc) {
    return formatPythonFunc(code);
  }
  const py = getPyodide();
  if (!py) {
    throw new Error('Pyodide is not loaded.');
  }
  // if black is not loaded yet, load it
  if (!py.globals.has('black')) {
    await py.pyimport('micropip').install('black');
  }
  const func = await py.runPythonAsync(
    `
import black
def format_code(src: str) -> str:
    return black.format_str(src, mode=black.FileMode())
format_code
`,
    {
      filename: NOTRACE_FILENAME,
      globals: py.toPy({
        ...py.globals.toJs(),
      }),
    },
  );
  formatPythonFunc = func;
  return func(code);
}

async function setupNormalTracing(
  py: PyodideAPI,
  filename: string,
  interruptBuffer: { '0': number },
) {
  py.pyimport('sys').settrace(normalTrace!(filename, interruptBuffer));
}

export async function runPythonCode(
  code: string,
  filename: string,
  interruptBuffer: { '0': number },
): Promise<void> {
  const py = getPyodide();
  if (!py) {
    throw new Error('Pyodide is not loaded.');
  }
  await setupNormalTracing(py, filename, interruptBuffer);
  await py.runPythonAsync(code, {
    globals: py.toPy({
      ...py.globals.toJs(),
    }),
    filename: HOME + filename,
  });
}

export async function runGlobalPythonCode(
  code: string,
  filename: string,
): Promise<void> {
  const py = getPyodide();
  if (!py) {
    throw new Error('Pyodide is not loaded.');
  }
  const ogGlobals = py.globals.toJs();
  const globals = py.globals;
  await py.runPythonAsync(code, {
    globals,
    filename: HOME + filename,
  });
  // Assign any new globals back to py.globals and globalThis
  const newGlobals = globals.toJs();
  for (const key of Object.keys(newGlobals)) {
    if (key in ogGlobals) continue;
    if (key in globalThis) continue;
    py.globals.set(key, globals.get(key));
    // @ts-expect-error
    globalThis[key] = newGlobals[key];
  }
}

type DebugCallback = (
  frame: PyProxy,
  event: string,
  arg: any,
) => Promise<void | true>;

async function setupDebugging(
  py: PyodideAPI,
  filename: string,
  cb: DebugCallback,
  interruptBuffer: { '0': number },
) {
  py.pyimport('sys').settrace(debugTrace!(cb, filename, interruptBuffer));
}

async function clearDebugging(py: PyodideAPI) {
  py.pyimport('sys').settrace(undefined);
}

export async function debugPythonCode(
  code: string,
  filename: string,
  pauseCallback: DebugCallback,
  interruptBuffer: { '0': number },
): Promise<void> {
  const py = getPyodide();
  if (!py) {
    throw new Error('Pyodide is not loaded.');
  }

  try {
    await setupDebugging(py, HOME + filename, pauseCallback, interruptBuffer);
    await py.runPythonAsync(code + '\na = 1', {
      globals: py.toPy({
        ...py.globals.toJs(),
      }),
      filename: HOME + filename,
    });
  } finally {
    await clearDebugging(py);
  }
}
