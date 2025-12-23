import type * as m from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import { createEditorInstance } from "./MonacoStore";

export function MonacoEditor({
  model,
  setModel,
}: {
  model: m.editor.ITextModel | null;
  setModel: (model: m.editor.ITextModel) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<m.editor.IStandaloneCodeEditor | null>(
    null
  );

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

  return <div className="w-full h-full" ref={containerRef} />;
}
