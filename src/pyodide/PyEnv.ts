import { normalizeNewlines } from "@/utils";
import { loadPyodide, type PyodideAPI } from "pyodide";
import type { PyProxy } from "pyodide/ffi";
import type { RefObject } from "react";
import type { Terminal } from "xterm";

let pyodide: PyodideAPI | null = null;

export async function createPyodide(
  xtermRef: RefObject<Terminal | null>
): Promise<PyodideAPI> {
  if (!pyodide) {
    pyodide = await loadPyodide({
      indexURL: `${window.location.origin}/pyodide/`,
    });

    setupPyodide(pyodide, xtermRef);
  }
  return pyodide;
}

export function getPyodide(): PyodideAPI | null {
  return pyodide;
}

function setupPyodide(py: PyodideAPI, xtermRef: RefObject<Terminal | null>) {
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

      return new Promise<string>((resolve) => {
        let input = "";
        const onData = (data: string) => {
          if (data === "\r") {
            xterm.write("\r\n");
            offData.dispose();
            xterm.options.cursorBlink = false;
            resolve(input);
          } else if (data === "\u007F") {
            // Handle backspace
            if (input.length > 0) {
              input = input.slice(0, -1);
              xterm.write("\b \b");
            }
          } else {
            input += data;
            xterm.write(data);
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

def xterm_input(prompt=""):
    if prompt:
        print(prompt, end="", flush=True)
    coro = xterm.readFromXTerm() # Returns a coroutine (Promise converted)
    return asyncio.get_event_loop().run_until_complete(coro)

def xterm_clear():
    xterm_instance = xterm.getXTerm()
    if xterm_instance:
        xterm_instance.clear()

def wait_for_js_promise(promise):
    return asyncio.get_event_loop().run_until_complete(promise)

__builtins__.input = xterm_input
__builtins__.clear = xterm_clear
js.wait_for_js_promise = wait_for_js_promise
`);
}

export async function runPythonCode(
  code: string,
  filename: string
): Promise<void> {
  const py = getPyodide();
  if (!py) {
    throw new Error("Pyodide is not loaded.");
  }
  await py.runPythonAsync(code, { filename });
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
  py.pyimport("sys").settrace(null);
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
    await py.runPythonAsync(code + "\na = 1", { filename });
  } finally {
    await clearDebugging(py);
  }
}
