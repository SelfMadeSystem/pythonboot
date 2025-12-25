import { normalizeNewlines } from "@/utils";
import { loadPyodide, type PyodideAPI } from "pyodide";
import type { PyProxy } from "pyodide/ffi";
import type { RefObject } from "react";
import type { Terminal } from "xterm";
import astUtilsSrc from "./astUtils.py" with { type: "text" };

let pyodide: PyodideAPI | null = null;

export async function createPyodide(
  xtermRef: RefObject<Terminal | null>
): Promise<PyodideAPI> {
  if (!pyodide) {
    pyodide = await loadPyodide({
      indexURL: `${window.location.origin}/pyodide/`,
    });

    await setupPyodide(pyodide, xtermRef);
  }
  return pyodide;
}

export function getPyodide(): PyodideAPI | null {
  return pyodide;
}

async function setupPyodide(
  py: PyodideAPI,
  xtermRef: RefObject<Terminal | null>
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
      const input = prompt("Input required:") || "";
      const inputBytes = new TextEncoder().encode(input + "\n");
      buf.set(inputBytes.slice(0, buf.length));
      return Math.min(inputBytes.length, buf.length);
    },
  });

  py.registerJsModule("xterm", {
    getXTerm: () => {
      return xtermRef.current;
    },
    writeToXTerm: (text: string) => {
      if (xtermRef.current) {
        xtermRef.current.write(normalizeNewlines(text));
      }
    },
    readFromXTerm: async () => {
      const xterm = xtermRef.current;
      if (!xterm) return "";

      xterm.options.cursorBlink = true;
      xterm.focus();

      return new Promise<string | Error>((resolve, reject) => {
        let input = "";
        // 0 is at the end of the line, 1 is before the last character, etc.
        let cursor = 0;
        const onData = (data: string) => {
          switch (data) {
            case "\r":
            case "\n":
              xterm.write("\r\n");
              offData.dispose();
              xterm.options.cursorBlink = false;
              resolve(input);
              break;
            case "\u007F":
              // Handle backspace
              if (input.length > 0 && cursor > 0) {
                // Remove character before the cursor
                const beforeCursor = input.slice(0, input.length - cursor - 1);
                const afterCursor = input.slice(input.length - cursor);
                input = beforeCursor + afterCursor;
                xterm.write("\b \b");
                xterm.write("\x1b[s"); // Save cursor position
                xterm.write("\x1b[K"); // Clear to end of line
                xterm.write(afterCursor);
                xterm.write("\x1b[u"); // Restore cursor position
              }
              break;
            case "\x1b[3~":
              // Handle Delete key
              if (input.length > 0 && cursor < input.length) {
                // Remove character at the cursor
                const beforeCursor = input.slice(0, input.length - cursor);
                const afterCursor = input.slice(input.length - cursor + 1);
                input = beforeCursor + afterCursor;
                // Redraw the line from the cursor position
                xterm.write("\x1b[s"); // Save cursor position
                xterm.write("\x1b[K"); // Clear to end of line
                xterm.write(afterCursor);
                xterm.write("\x1b[u"); // Restore cursor position
                cursor--;
              }
              break;
            case "\u0003":
              // Handle Ctrl+C
              offData.dispose();
              xterm.write("^C\r\n");
              xterm.options.cursorBlink = false;
              resolve(new Error("KeyboardInterrupt"));
              break;
            case "\u0004":
              // Handle Ctrl+D
              offData.dispose();
              xterm.write("\r\n");
              xterm.options.cursorBlink = false;
              resolve(new Error("EOFError"));
              break;
            case "\x1b[D":
              // Left arrow
              if (cursor < input.length) {
                xterm.write("\x1b[D");
                cursor++;
              }
              break;
            case "\x1b[C":
              // Right arrow
              if (cursor > 0) {
                xterm.write("\x1b[C");
                cursor--;
              }
              break;
            case "\x1b[A":
            case "\x1b[B":
              // Up and Down arrows - ignore
              break;
            default:
              // Ignore other control characters
              if (data < " " || data === "\x7F") {
                return;
              }
              // Regular character input
              input =
                input.slice(0, input.length - cursor) +
                data +
                input.slice(input.length - cursor);
              // Redraw the line from the cursor position
              xterm.write("\x1b[s"); // Save cursor position
              xterm.write(input.slice(input.length - cursor - data.length));
              xterm.write("\x1b[u"); // Restore cursor position
              xterm.write(`\x1b[C`); // Move cursor to correct position
              break;
          }
        };
        const offData = xterm.onData(onData);
      });
    },
  });

  py.runPython(`
import js
import xterm
import asyncio
import pyodide
import sys

class XTermInput:
    def __call__(self, prompt=""):
        if prompt:
            print(prompt, end="", flush=True)
        coro = xterm.readFromXTerm()
        result = asyncio.get_event_loop().run_until_complete(coro)
        if isinstance(result, str):
            return result
        if "KeyboardInterrupt" in result.message:
            raise KeyboardInterrupt() from None
        elif "EOFError" in result.message:
            raise EOFError() from None
        raise result from None
    def __repr__(self):
        return "<built-in function input>"
    def __str__(self):
        return "<built-in function input>"

def xterm_clear():
    xterm_instance = xterm.getXTerm()
    if xterm_instance:
        xterm_instance.clear()

def wait_for_js_promise(promise):
    return asyncio.get_event_loop().run_until_complete(promise)

__builtins__.input = XTermInput()
__builtins__.clear = xterm_clear
js.wait_for_js_promise = wait_for_js_promise
`);

  if (astUtilsSrc.startsWith("/")) {
    const src = await fetch(astUtilsSrc).then((res) => res.text());
    setupHintingFunc = py.runPython(src);
  } else {
    setupHintingFunc = py.runPython(astUtilsSrc);
  }
}

type HintingFunc = (
  frame: PyProxy
) => [line: number, col: number, varname: string, valueStr: string][];

let setupHintingFunc: ((source: string) => HintingFunc) | null = null;

export function setupHinting(source: string): HintingFunc | null {
  if (!setupHintingFunc) {
    throw new Error("AST utils not loaded yet.");
  }
  const func = setupHintingFunc!(source);
  return (frame: PyProxy) => {
    //@ts-expect-error I don't feel like properly typing this
    return func(frame).toJs();
  };
}

export async function runPythonCode(
  code: string,
  filename: string
): Promise<void> {
  const py = getPyodide();
  if (!py) {
    throw new Error("Pyodide is not loaded.");
  }
  await py.runPythonAsync(code, {
    globals: py.toPy({}),
    filename,
  });
}

type DebugCallback = (frame: PyProxy, event: string, arg: any) => Promise<void>;

async function setupDebugging(
  py: PyodideAPI,
  filename: string,
  cb: DebugCallback
) {
  await py.runPythonAsync(
    `
import inspect
import js
import sys

jscb = js__cb

def trace_cb(frame, event, arg):
    global jscb, trace_cb
    frame.f_trace_opcodes = True
    # if event != "line":
    #     return trace_cb
    line_no = frame.f_lineno
    filename = frame.f_code.co_filename
    # Only pause for the target script
    if filename != "${filename}":
        return trace_cb
    js.wait_for_js_promise(jscb(frame, event, arg))
    return trace_cb

sys.settrace(trace_cb)
`,
    {
      locals: py.toPy({ js__cb: cb }),
    }
  );
}

async function clearDebugging(py: PyodideAPI) {
  py.pyimport("sys").settrace(undefined);
}

export async function debugPythonCode(
  code: string,
  filename: string,
  pauseCallback: DebugCallback
): Promise<void> {
  const py = getPyodide();
  if (!py) {
    throw new Error("Pyodide is not loaded.");
  }

  try {
    await setupDebugging(py, filename, pauseCallback);
    await py.runPythonAsync(code + "\na = 1", {
      globals: py.toPy({}),
      filename,
    });
  } finally {
    await clearDebugging(py);
  }
}
