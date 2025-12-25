import type * as m from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import { createEditorInstance, getMonacoInstance } from "./MonacoStore";
import "./monaco.css";
import { SYM_NIL } from "@/utils";
import { setupHinting } from "@/pyodide/PyEnv";
import type { PyProxy } from "pyodide/ffi";

export type HighlightRange =
  | {
      startLine: number;
      endLine: number;
    }
  | {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    }
  | null;

export function MonacoEditor({
  highlight,
  frame,
  loadedValue,
  model,
  setModel,
}: {
  highlight: HighlightRange;
  frame: PyProxy | null;
  loadedValue: unknown;
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

  const hoverProviderDisposable = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    const monaco = getMonacoInstance();
    if (!editor || !model || !monaco) return;

    // Clean up previous hover provider
    hoverProviderDisposable.current?.dispose();

    if (
      highlight === null ||
      loadedValue === SYM_NIL ||
      loadedValue === null ||
      loadedValue === undefined
    ) {
      return;
    }

    // Register hover provider for the highlighted range
    hoverProviderDisposable.current = monaco.languages.registerHoverProvider(
      model.getLanguageId(),
      {
        provideHover: function (model, position) {
          // Check if position is within the highlight range
          const inRange =
            position.lineNumber >= highlight.startLine &&
            position.lineNumber <= highlight.endLine &&
            (!("startColumn" in highlight) ||
              ((position.lineNumber > highlight.startLine ||
                position.column >= highlight.startColumn) &&
                (position.lineNumber < highlight.endLine ||
                  position.column <= highlight.endColumn)));

          if (inRange) {
            return {
              range: new monaco.Range(
                highlight.startLine,
                "startColumn" in highlight ? highlight.startColumn : 1,
                highlight.endLine,
                "endColumn" in highlight ? highlight.endColumn : 1
              ),
              contents: [
                {
                  value: `**Value:** \`${String(loadedValue)}\``,
                },
              ],
            };
          }
          return null;
        },
      }
    );

    return () => {
      hoverProviderDisposable.current?.dispose();
    };
  }, [highlight, loadedValue, editor, model]);

  const valueHintDecorationsRef =
    useRef<m.editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    const monaco = getMonacoInstance();
    if (!editor || !model || !monaco) return;

    // Clear previous value hint decorations
    valueHintDecorationsRef.current?.clear();

    if (highlight === null || frame === null) {
      return;
    }

    const hints: m.editor.IModelDeltaDecoration[] = [];

    const getHintsForFrame = setupHinting(model.getValue());

    if (!getHintsForFrame) {
      return;
    }

    const varHints = getHintsForFrame(frame);

    console.log("Variable hints:", varHints);

    for (const [line, col, varname, valueStr] of varHints) {
      hints.push({
        range: new monaco.Range(line, col, line, col + varname.length),
        options: {
          after: {
            content: `: ${valueStr}`,
            inlineClassName: "value-hint-decoration",
          },
          hoverMessage: {
            value: `**${varname}**: \`${valueStr}\``,
          },
        },
      });
    }

    valueHintDecorationsRef.current = editor.createDecorationsCollection(hints);
  }, [highlight, frame, editor, model]);

  return <div className="w-full h-full" ref={containerRef} />;
}
