import type * as m from 'monaco-editor';
import { createEditorInstance, getMonacoInstance } from './MonacoStore';
import { MonacoTabs } from './MonacoTabs';
import './monaco.css';
import { setupHinting } from '@/pyodide/PyEnv';
import { SYM_NIL } from '@/utils';
import type { PyProxy } from 'pyodide/ffi';
import { useEffect, useRef, useState } from 'react';

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
  error,
}: {
  highlight: HighlightRange;
  frame: PyProxy | null;
  loadedValue: unknown;
  model: m.editor.ITextModel | null;
  setModel: (model: m.editor.ITextModel) => void;
  error?: {
    message: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  } | null;
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
    }).then(ed => {
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
    });
  }, [editor]);

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
          'startColumn' in highlight ? highlight.startColumn : 1,
          highlight.endLine,
          'endColumn' in highlight ? highlight.endColumn : 1,
        ),
        options: {
          isWholeLine: !('startColumn' in highlight),
          className: 'current-execution-line',
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
            (!('startColumn' in highlight) ||
              ((position.lineNumber > highlight.startLine ||
                position.column >= highlight.startColumn) &&
                (position.lineNumber < highlight.endLine ||
                  position.column <= highlight.endColumn)));

          if (inRange) {
            return {
              range: new monaco.Range(
                highlight.startLine,
                'startColumn' in highlight ? highlight.startColumn : 1,
                highlight.endLine,
                'endColumn' in highlight ? highlight.endColumn : 1,
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
  }, [highlight, frame, editor, model]);

  useEffect(() => {
    const monaco = getMonacoInstance();
    if (!model || !monaco) return;
    if (!error) {
      monaco.editor.setModelMarkers(model, 'owner', []);
      return;
    }
    monaco.editor.setModelMarkers(model, 'owner', [
      {
        severity: monaco.MarkerSeverity.Error,
        message: error.message,
        startLineNumber: error.startLine,
        startColumn: error.startColumn,
        endLineNumber: error.endLine,
        endColumn: error.endColumn,
      },
    ]);
  }, [error, model]);

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
