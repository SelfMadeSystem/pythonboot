import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import "./xterm.css";

interface XTerminalProps {
  split: number;
  xtermRef: React.RefObject<Terminal | null>;
}

export function XTerminal({ split, xtermRef }: XTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (terminalRef.current && !xtermRef.current) {
      const xterm = new Terminal({
        cols: 80,
        rows: 24,
        theme: {
          background: "#1e1e1e",
          foreground: "#ffffff",
        },
      });
      const fitAddon = new FitAddon();
      fitRef.current = fitAddon;
      xterm.loadAddon(fitAddon);
      xterm.open(terminalRef.current);
      fitAddon.fit();
      xtermRef.current = xterm;
    }
  }, []);

  useEffect(() => {
    const fit = fitRef.current;
    if (!fit) return;
    fit.fit();
  }, [split]);

  return <div className="w-full h-full pt-0.5" ref={terminalRef} />;
}
