import type * as m from "monaco-editor";
import mLoader from "@monaco-editor/loader";

mLoader.config({
  paths: {
    vs: `${window.location.origin}/monaco/vs`,
  },
});

let monacoInstance: typeof m | null = null;
let editorInstance: m.editor.IStandaloneCodeEditor | null = null;

export async function createMonacoInstance(): Promise<typeof m> {
  if (!monacoInstance) {
    monacoInstance = await mLoader.init();
  }
  return monacoInstance!;
}

export function getMonacoInstance(): typeof m | null {
  return monacoInstance;
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
  }
  return editorInstance;
}

export function getEditorInstance(): m.editor.IStandaloneCodeEditor | null {
  return editorInstance;
}
