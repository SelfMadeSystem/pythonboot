import { useEffect, useRef, useState } from "react";
import { TurtleHandler } from "./TurtleHandler";
import { waitForPyodide } from "@/pyodide/PyEnv";

export function TurtleCanvas() {
  const [gridCanvas, setGridCanvas] = useState<HTMLCanvasElement | null>(null);
  const [turtleCanvas, setTurtleCanvas] = useState<HTMLCanvasElement | null>(null);
  const [drawCanvas, setDrawCanvas] = useState<HTMLCanvasElement | null>(null);
  const turtleHandlerRef = useRef<TurtleHandler | null>(null);

  useEffect(() => {
    if (!gridCanvas || !turtleCanvas || !drawCanvas) return;

    // Set canvas sizes
    const resizeCanvases = () => {
      const width = turtleCanvas.clientWidth;
      const height = turtleCanvas.clientHeight;
      turtleHandlerRef.current?.onResize(width, height);
    };

    resizeCanvases();
    
    const observer = new ResizeObserver(() => {
      resizeCanvases();
    });
    observer.observe(turtleCanvas);

    if (!turtleHandlerRef.current) {
      turtleHandlerRef.current = new TurtleHandler(
        gridCanvas,
        drawCanvas,
        turtleCanvas,
      );

      waitForPyodide().then(pyodide => {
        pyodide.registerJsModule('turtle', turtleHandlerRef.current!);
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [turtleCanvas, drawCanvas]);
  
  return (
    <div className="relative w-full h-full bg-white">
      <canvas
        ref={setGridCanvas}
        className="absolute top-0 left-0 w-full h-full"
      />
      <canvas
        ref={setDrawCanvas}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      />
      <canvas
        ref={setTurtleCanvas}
        className="absolute top-0 left-0 w-full h-full"
      />
    </div>
  );
}
