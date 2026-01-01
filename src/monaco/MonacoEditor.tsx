import type * as m from 'monaco-editor';
import { createEditorInstance, getMonacoInstance } from './MonacoStore';
import { MonacoTabs } from './MonacoTabs';
import './monaco.css';
import { formatPython, setupHinting } from '@/pyodide/PyEnv';
import { SYM_NIL } from '@/utils';
import type { PyProxy } from 'pyodide/ffi';
import { useEffect, useRef, useState } from 'react';

export type HighlightRange = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type ErrorType = {
  message: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export function MonacoEditor({
  highlights,
  errors,
  frame,
  loadedValue,
  model,
  setModel,
}: {
  highlights: Record<string, HighlightRange>;
  errors: Record<string, ErrorType>;
  frame: PyProxy | null;
  loadedValue: unknown;
  model: m.editor.ITextModel | null;
  setModel: (model: m.editor.ITextModel) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const monacoDivRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<m.editor.IStandaloneCodeEditor | null>(
    null,
  );
  const pauseDecorationsRef =
    useRef<m.editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    if (!monacoDivRef.current || editor) return;

    createEditorInstance(monacoDivRef.current, () => {
      return {
        rulers: [80],
        // automaticLayout: true,
        theme: 'vs-dark',
      };
    }).then(([ed, monaco]) => {
      setEditor(ed);
      ed.setModel(null);
      const ro = new window.ResizeObserver(() => {
        requestAnimationFrame(() => {
          const tabsDiv = containerRef.current!.querySelector('.monaco-tabs')!;
          ed.layout({
            width: containerRef.current!.clientWidth,
            height: containerRef.current!.clientHeight - tabsDiv.clientHeight,
          });
        });
      });
      ro.observe(containerRef.current!);

      monaco.languages.registerDocumentFormattingEditProvider('python', {
        provideDocumentFormattingEdits: async (model, options, token) => {
          const formatted = await formatPython(model.getValue());
          return [
            {
              range: model.getFullModelRange(),
              text: formatted,
            },
          ];
        },
      });
    });
  }, [editor]);

  // Determine current highlight and error for the active model
  const currentHighlight = model
    ? (highlights[model.uri.toString()] ?? null)
    : null;
  const currentError = model ? (errors[model.uri.toString()] ?? null) : null;

  useEffect(() => {
    const monaco = getMonacoInstance();
    if (!editor || !model || !monaco) return;

    if (pauseDecorationsRef.current) {
      pauseDecorationsRef.current.clear();
    }

    if (currentHighlight === null) return;

    pauseDecorationsRef.current = editor.createDecorationsCollection([
      {
        range: new monaco.Range(
          currentHighlight.startLine,
          currentHighlight.startColumn,
          currentHighlight.endLine,
          currentHighlight.endColumn,
        ),
        options: {
          isWholeLine: !true,
          className: 'current-execution-line',
        },
      },
    ]);
  }, [currentHighlight, editor, model]);

  const hoverProviderDisposable = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    const monaco = getMonacoInstance();
    if (!editor || !model || !monaco) return;

    // Clean up previous hover provider
    hoverProviderDisposable.current?.dispose();

    if (
      currentHighlight === null ||
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
            position.lineNumber >= currentHighlight.startLine &&
            position.lineNumber <= currentHighlight.endLine &&
            (position.lineNumber > currentHighlight.startLine ||
              position.column >= currentHighlight.startColumn) &&
            (position.lineNumber < currentHighlight.endLine ||
              position.column <= currentHighlight.endColumn);

          if (inRange) {
            return {
              range: new monaco.Range(
                currentHighlight.startLine,
                currentHighlight.startColumn,
                currentHighlight.endLine,
                currentHighlight.endColumn,
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
      },
    );

    return () => {
      hoverProviderDisposable.current?.dispose();
    };
  }, [currentHighlight, loadedValue, editor, model]);

  const valueHintDecorationsRef =
    useRef<m.editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    const monaco = getMonacoInstance();
    if (!editor || !model || !monaco) return;

    // Clear previous value hint decorations
    valueHintDecorationsRef.current?.clear();

    if (currentHighlight === null || frame === null) {
      return;
    }

    const hints: m.editor.IModelDeltaDecoration[] = [];

    const getHintsForFrame = setupHinting(model.getValue());

    if (!getHintsForFrame) {
      return;
    }

    const varHints = getHintsForFrame(frame);

    for (const [line, col, varname, valueStr] of varHints) {
      hints.push({
        range: new monaco.Range(line, col, line, col + varname.length),
        options: {
          after: {
            content: `: ${valueStr}`,
            inlineClassName: 'value-hint-decoration',
          },
          hoverMessage: {
            value: `**${varname}**: \`${valueStr}\``,
          },
        },
      });
    }

    valueHintDecorationsRef.current = editor.createDecorationsCollection(hints);
  }, [currentHighlight, frame, editor, model]);

  useEffect(() => {
    const monaco = getMonacoInstance();
    if (!model || !monaco) return;
    if (!currentError) {
      monaco.editor.setModelMarkers(model, 'owner', []);
      return;
    }
    monaco.editor.setModelMarkers(model, 'owner', [
      {
        severity: monaco.MarkerSeverity.Error,
        message: currentError.message,
        startLineNumber: currentError.startLine,
        startColumn: currentError.startColumn,
        endLineNumber: currentError.endLine,
        endColumn: currentError.endColumn,
      },
    ]);
  }, [currentError, model]);

  return (
    <div className="flex h-full w-full flex-col" ref={containerRef}>
      <MonacoTabs
        model={model}
        setModel={model => {
          setModel(model);
          if (editor) {
            editor.setModel(model);
          }
        }}
        editor={editor}
      />
      <div className="h-full w-full" ref={monacoDivRef} />
    </div>
  );
}
