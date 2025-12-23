// PyodideConfig is deprecated and tells me to import it from "pyodide/ffi",
// but there is no PyodideConfig in "pyodide/ffi", so ignoring that for now.
import { loadPyodide, type PyodideAPI, type PyodideConfig } from "pyodide";

let pyodide: PyodideAPI | null = null;

export async function createPyodide(config: PyodideConfig): Promise<PyodideAPI> {
  if (!pyodide) {
    pyodide = await loadPyodide({
      ...config,
      indexURL: `${window.location.origin}/pyodide/`,
    });
  }
  return pyodide;
}

export function getPyodide(): PyodideAPI | null {
  return pyodide;
}
