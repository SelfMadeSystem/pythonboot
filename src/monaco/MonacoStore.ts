import type * as m from "monaco-editor";
import mLoader from "@monaco-editor/loader";
import { getPyodide } from "@/pyodide/PyEnv";

mLoader.config({
  paths: {
    vs: `${window.location.origin}/monaco/vs`,
  },
});

let monacoInstance: typeof m | null = null;
let editorInstance: m.editor.IStandaloneCodeEditor | null = null;
let monacoCbs: Array<(monaco: typeof m) => void> = [];
let instanceCbs: Array<(editor: m.editor.IStandaloneCodeEditor) => void> = [];

export async function createMonacoInstance(): Promise<typeof m> {
  if (!monacoInstance) {
    monacoInstance = await mLoader.init();
    for (const cb of monacoCbs) {
      cb(monacoInstance!);
    }
  }
  return monacoInstance!;
}

export function getMonacoInstance(): typeof m | null {
  return monacoInstance;
}

export async function waitForMonacoInstance(): Promise<typeof m> {
  if (monacoInstance) {
    return monacoInstance;
  }

  return new Promise((resolve) => {
    monacoCbs.push(resolve);
  });
}

export async function waitForEditorInstance(): Promise<m.editor.IStandaloneCodeEditor> {
  if (editorInstance) {
    return editorInstance;
  }

  return new Promise((resolve) => {
    instanceCbs.push(resolve);
  });
}

export async function createEditorInstance(
  container: HTMLDivElement,
  options:
    | m.editor.IStandaloneEditorConstructionOptions
    | ((monaco: typeof m) => m.editor.IStandaloneEditorConstructionOptions)
): Promise<m.editor.IStandaloneCodeEditor> {
  if (!editorInstance) {
    const monaco = await createMonacoInstance();
    editorInstance = monaco.editor.create(
      container,
      typeof options === "function" ? options(monaco) : options
    );

    for (const cb of instanceCbs) {
      cb(editorInstance!);
    }
  }
  return editorInstance;
}

export function getEditorInstance(): m.editor.IStandaloneCodeEditor | null {
  return editorInstance;
}

export function syncMonacoToPyodide() {
  const monaco = getMonacoInstance();
  if (!monaco) return;

  const pyodide = getPyodide();
  if (!pyodide) return;

  const models = monaco.editor.getModels();

  for (const model of models) {
    const path = model.uri.fsPath;
    const content = model.getValue();

    if (pyodide.FS.analyzePath(path).exists) {
      pyodide.FS.unlink(path);
    }

    pyodide.FS.writeFile(path, content);
    pyodide.FS.chmod(path, 0o444); // .r--r--r--
  }
}
