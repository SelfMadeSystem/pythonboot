import { normalizeNewlines } from "@/utils";
import { loadPyodide, type PyodideAPI } from "pyodide";
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

function setupPyodide(
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

  // Override the built-in input function in Python
  py.runPython(`
import xterm
import asyncio

def xterm_input(prompt=""):
    if prompt:
        print(prompt, end="", flush=True)
    coro = xterm.readFromXTerm() # Returns a coroutine (Promise converted)
    return asyncio.get_event_loop().run_until_complete(coro)

__builtins__.input = xterm_input
`);
}
