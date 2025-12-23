import { useCallback, useEffect, useRef, useState } from "react";
import "./index.css";
import { MonacoEditor } from "./monaco/MonacoEditor";
import { XTerminal } from "./xterm/XTerminal";
import type { PyodideAPI } from "pyodide";
import { createPyodide } from "./pyodide/PyEnv";
import type * as m from "monaco-editor";
import type { Terminal } from "xterm";
import { normalizeNewlines } from "./utils";

export function App() {
  const [model, setModel] = useState<m.editor.ITextModel | null>(null);
  const [split, setSplit] = useState(0.5);
  const [pyodide, setPyodide] = useState<PyodideAPI | null>(null);
  const xtermRef = useRef<Terminal>(null);

  useEffect(() => {
    createPyodide(xtermRef).then((py) => {
      setPyodide(py);
    });
  }, []);

  const runCode = useCallback(
    async (code: string) => {
      if (!pyodide) {
        console.warn("Pyodide is not loaded yet.");
        return;
      }
      try {
        await pyodide.runPythonAsync(code);
      } catch (error) {
        if (xtermRef.current) {
          xtermRef.current.write(
            `\x1b[31m${normalizeNewlines(String(error))}\x1b[0m`
          ); // Red color for errors
        }
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
        <MonacoEditor model={model} setModel={setModel} />

        <div className="absolute top-2 right-2 z-10">
          <button
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded cursor-pointer"
            onClick={() => {
              if (model) {
                const code = model.getValue();
                runCode(code);
              } else {
                console.warn("No model available to run code from.");
              }
            }}
          >
            Run
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
