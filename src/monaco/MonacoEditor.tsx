import type * as m from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import { createEditorInstance, getMonacoInstance } from "./MonacoStore";
import "./monaco.css";

export type HighlightRange = {
  startLine: number;
  endLine: number;
} | {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
} | null;

export function MonacoEditor({
  highlight,
  model,
  setModel,
}: {
  highlight: HighlightRange;
  model: m.editor.ITextModel | null;
  setModel: (model: m.editor.ITextModel) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<m.editor.IStandaloneCodeEditor | null>(
    null
  );
  const pauseDecorationsRef =
    useRef<m.editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    if (!containerRef.current || editor) return;

    createEditorInstance(containerRef.current, (monaco) => {
      const model = monaco.editor.createModel(
        `\
name = input("Enter your name: ")
print(f"Hello, {name}!")`,
        "python",
        monaco.Uri.file("main.py")
      );

      setModel(model);

      return {
        model,
        rulers: [80],
        automaticLayout: true,
        theme: "vs-dark",
      };
    }).then((ed) => {
      setEditor(ed);
    });
  }, [containerRef, editor]);

  useEffect(() => {
    const monaco = getMonacoInstance();
    if (!editor || !model || !monaco) return;

    if (pauseDecorationsRef.current) {
      pauseDecorationsRef.current.clear();
    }

    if (highlight === null) return;

    pauseDecorationsRef.current = editor.createDecorationsCollection([
      {
        range: new monaco.Range(
          highlight.startLine,
          "startColumn" in highlight ? highlight.startColumn : 1,
          highlight.endLine,
          "endColumn" in highlight ? highlight.endColumn : 1
        ),
        options: {
          isWholeLine: !("startColumn" in highlight),
          className: "current-execution-line",
        },
      },
    ]);
  }, [highlight, editor, model]);

  return <div className="w-full h-full" ref={containerRef} />;
}
