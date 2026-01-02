import type * as m from 'monaco-editor';
import {
  getMonacoInstance,
  waitForEditorInstance,
  waitForMonacoInstance,
} from './MonacoStore';
import { runGlobalPythonCode, waitForPyodide } from '@/pyodide/PyEnv';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function MonacoTabs({
  model,
  setModel,
  editor,
  onFloatDown,
  floating,
  setFloating,
}: {
  model: m.editor.ITextModel | null;
  setModel: (model: m.editor.ITextModel) => void;
  editor: m.editor.IStandaloneCodeEditor | null;
  onFloatDown?: (e: React.MouseEvent) => void;
  floating?: boolean;
  setFloating?: (floating: boolean) => void;
}) {
  const [tabs, setTabs] = useState<
    { label: string; model: m.editor.ITextModel }[]
  >([]);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    tabIdx: number;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const loadedModelsRef = useRef<boolean>(false);

  const addTab = useCallback(() => {
    const monaco = getMonacoInstance();
    if (!monaco) return;

    const filename = prompt('Enter file name', `file${tabs.length + 1}.py`);
    if (!filename) return;
    if (filename.includes('/') || filename.includes('..')) {
      alert('Invalid file name.');
      return;
    }

    const newModel = monaco.editor.createModel(
      '',
      'python',
      monaco.Uri.file(filename),
    );

    setTabs(prevTabs => [...prevTabs, { label: filename, model: newModel }]);
    setModel(newModel);
  }, [tabs.length, setModel]);

  // Load from localstorage on mount
  useEffect(() => {
    if (window.CDN) {
      // Find any script with type="text/python" and load as tabs
      const scripts = document.querySelectorAll(
        'script[type="text/python"]',
      ) as NodeListOf<HTMLScriptElement>;
      if (scripts.length === 0) {
        loadedModelsRef.current = true;
        return;
      }

      const loadScripts = async () => {
        const monaco = await waitForMonacoInstance();
        const editor = await waitForEditorInstance();

        const loadedTabs: { label: string; model: m.editor.ITextModel }[] = [];

        for (let i = 0; i < scripts.length; i++) {
          const script = scripts[i]!;
          const src = script.getAttribute('src');
          const label = src
            ? src.split('/').pop() || `script-${i + 1}.py`
            : `script-${i + 1}.py`;
          const value =
            script.textContent ||
            (src &&
              (await fetch(src)
                .then(res => res.text())
                .catch(e => {
                  console.error('Failed to load script:', src, e);
                  return '';
                }))) ||
            '';
          const model = monaco.editor.createModel(
            value,
            'python',
            monaco.Uri.file(label),
          );
          loadedTabs.push({ label, model });
        }

        setTabs(loadedTabs);
        setModel(loadedTabs[0]!.model);
        // Parent hasn't fully loaded yet, so must set model on editor directly
        editor.setModel(loadedTabs[0]!.model);
        loadedModelsRef.current = true;

        await waitForPyodide();

        // Run all the scripts in order to set up any globals
        for (const tab of loadedTabs) {
          await runGlobalPythonCode(tab.model.getValue(), tab.label);
        }
      };
      loadScripts();
      return;
    }
    const loadTabs = async () => {
      const monaco = await waitForMonacoInstance();
      const editor = await waitForEditorInstance();

      const saved = localStorage.getItem('monacoTabs');
      if (!saved) {
        return;
      }

      const parsed: { label: string; value: string }[] = JSON.parse(saved);
      if (parsed.length === 0) {
        return;
      }

      const loadedTabs: { label: string; model: m.editor.ITextModel }[] = [];
      for (const tab of parsed) {
        const model = monaco.editor.createModel(
          tab.value,
          'python',
          monaco.Uri.file(tab.label),
        );
        loadedTabs.push({ label: tab.label, model });
      }
      setTabs(loadedTabs);
      setModel(loadedTabs[0]!.model);
      // Parent hasn't fully loaded yet, so must set model on editor directly
      editor.setModel(loadedTabs[0]!.model);
      loadedModelsRef.current = true;
    };
    loadTabs();
  }, []);

  // Save to localstorage on tabs change
  useEffect(() => {
    if (window.CDN) return; // Don't save when running from CDN
    const saveModels = () => {
      const toSave = tabs.map(tab => ({
        label: tab.label,
        value: tab.model.getValue(),
      }));
      localStorage.setItem('monacoTabs', JSON.stringify(toSave));
    };

    const unsubs = tabs.map(tab =>
      tab.model.onDidChangeContent(() => {
        saveModels();
      }),
    );

    if (loadedModelsRef.current) {
      saveModels();
    }

    return () => {
      for (const unsub of unsubs) {
        unsub.dispose();
      }
    };
  }, [tabs]);

  // Context menu handlers
  const handleContextMenu = (event: React.MouseEvent, idx: number) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      tabIdx: idx,
    });
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClick);
    } else {
      document.removeEventListener('mousedown', handleClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [contextMenu]);

  // Menu actions
  const handleRename = () => {
    if (contextMenu) {
      const idx = contextMenu.tabIdx;
      const tab = tabs[idx];
      if (!tab) return setContextMenu(null);
      const newName = prompt('Rename file', tab.label);
      if (newName === tab.label) {
        return setContextMenu(null);
      }
      if (!newName || newName.includes('/') || newName.includes('..')) {
        alert('Invalid file name.');
        return setContextMenu(null);
      }
      setTabs(prev =>
        prev.map((tab, i) =>
          i === idx
            ? {
                ...tab,
                label: newName,
                model: (() => {
                  // Create a new model with the new URI, dispose old model
                  const monaco = getMonacoInstance();
                  if (!monaco) return tab.model;
                  const newModel = monaco.editor.createModel(
                    tab.model.getValue(),
                    'python',
                    monaco.Uri.file(newName),
                  );
                  setModel(newModel);
                  tab.model.dispose();
                  return newModel;
                })(),
              }
            : tab,
        ),
      );

      setContextMenu(null);
    }
  };

  const handleDuplicate = () => {
    if (contextMenu) {
      const idx = contextMenu.tabIdx;
      const monaco = getMonacoInstance();
      if (!monaco) return;
      const origTab = tabs[idx];
      if (!origTab) return setContextMenu(null);
      const baseName = origTab.label.replace(/(\.py)?$/, '');
      let newName = baseName + '_copy.py';
      let count = 1;
      while (tabs.some(t => t.label === newName)) {
        newName = `${baseName}_copy${count}.py`;
        count++;
      }
      const newModel = monaco.editor.createModel(
        origTab.model.getValue(),
        'python',
        monaco.Uri.file(newName),
      );
      setTabs(prev => [
        ...prev.slice(0, idx + 1),
        { label: newName, model: newModel },
        ...prev.slice(idx + 1),
      ]);
      setModel(newModel);
      setContextMenu(null);
    }
  };

  const handleDelete = () => {
    if (contextMenu) {
      const idx = contextMenu.tabIdx;
      setTabs(prev => {
        const tabToDelete = prev[idx];
        const newTabs = prev.filter((_, i) => i !== idx);
        // If the deleted tab was active, switch to another tab
        if (tabToDelete && model === tabToDelete.model && newTabs.length > 0) {
          const nextTab = newTabs[Math.max(0, idx - 1)];
          if (nextTab) setModel(nextTab.model);
        }
        return newTabs;
      });
      setContextMenu(null);
    }
  };

  return (
    <div className="monaco-tabs relative isolate flex w-full items-center border-b border-gray-300 text-white">
      {onFloatDown && (
        <div
          className="absolute inset-0 cursor-move"
          onMouseDown={onFloatDown}
        ></div>
      )}
      {setFloating && (
        <button
          className="z-10 cursor-pointer p-2 text-sm hover:bg-[#fff1]"
          onClick={() => setFloating(!floating)}
        >
          {floating ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 fill-white"
              viewBox="0 0 24 24"
            >
              <path d="M5,5H10V7H7V10H5V5M14,5H19V10H17V7H14V5M17,14H19V19H14V17H17V14M10,17V19H5V14H7V17H10Z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 fill-white"
              viewBox="0 0 24 24"
            >
              <path d="M18 18V20H4A2 2 0 0 1 2 18V8H4V18M22 6V14A2 2 0 0 1 20 16H8A2 2 0 0 1 6 14V6A2 2 0 0 1 8 4H20A2 2 0 0 1 22 6M20 6H8V14H20Z" />
            </svg>
          )}
        </button>
      )}
      {tabs.map((tab, index) => (
        <button
          key={index}
          className={`z-10 cursor-pointer px-4 py-2 ${
            model === tab.model ? 'bg-gray-800' : 'hover:bg-[#fff1]'
          }`}
          onClick={() => setModel(tab.model)}
          onContextMenu={e => handleContextMenu(e, index)}
        >
          {tab.label}
        </button>
      ))}
      <button className="group z-10 cursor-pointer px-2" onClick={addTab}>
        <div className="rounded-full p-2 group-hover:bg-[#fff1]">
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M14 2H6C4.89 2 4 2.89 4 4V20C4 21.11 4.89 22 6 22H13.81C13.28 21.09 13 20.05 13 19C13 15.69 15.69 13 19 13C19.34 13 19.67 13.03 20 13.08V8L14 2M13 9V3.5L18.5 9H13M23 20H20V23H18V20H15V18H18V15H20V18H23V20Z"></path>
          </svg>
        </div>
      </button>
      {contextMenu &&
        createPortal(
          <div
            ref={contextMenuRef}
            className="absolute z-1000 min-w-30 rounded border border-gray-700 bg-gray-900 text-sm text-white shadow-lg"
            style={{
              top: contextMenu.mouseY,
              left: contextMenu.mouseX,
            }}
          >
            <button
              className="block w-full cursor-pointer px-4 py-2 text-left hover:bg-gray-700"
              onClick={handleRename}
            >
              Rename
            </button>
            <button
              className="block w-full cursor-pointer px-4 py-2 text-left hover:bg-gray-700"
              onClick={handleDuplicate}
            >
              Duplicate
            </button>
            <button
              className="block w-full cursor-pointer px-4 py-2 text-left text-red-400 hover:bg-gray-700"
              onClick={handleDelete}
            >
              Delete
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
