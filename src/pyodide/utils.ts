import type { HighlightRange } from '../monaco/MonacoEditor';
import type { PyProxy } from 'pyodide/ffi';

/**
 * Extracts a HighlightRange from a Python frame object.
 * Returns null if extraction is not possible.
 */
export function frameHighlightRange(frame: PyProxy): HighlightRange {
  if (!frame || !frame.f_code || typeof frame.f_lasti !== 'number') return null;
  const lasti = frame.f_lasti;
  const positions = [...frame.f_code.co_positions()];
  const instrIndex = Math.floor(lasti / 2);
  const [startLine, endLine, startCol, endCol] = positions[instrIndex] || [
    null,
    null,
    null,
    null,
  ];
  const line = frame.f_lineno || 1;
  return {
    startLine: startLine || line,
    endLine: endLine || line,
    startColumn: (startCol || 0) + 1,
    endColumn: (endCol || 0) + 1,
  };
}

/**
 * Extracts a HighlightRange from a Python SyntaxError exception.
 */
export function syntaxErrorHighlightRange(
  syntaxError: PyProxy,
): HighlightRange {
  if (
    !syntaxError ||
    !("lineno" in syntaxError) ||
    !("end_lineno" in syntaxError) ||
    !("offset" in syntaxError) ||
    !("end_offset" in syntaxError) ||
    typeof syntaxError.lineno !== 'number' ||
    typeof syntaxError.offset !== 'number' ||
    typeof syntaxError.end_lineno !== 'number' ||
    typeof syntaxError.end_offset !== 'number'
  ) {
    return null;
  }

  const line = syntaxError.lineno;
  const column = syntaxError.offset;
  const endLine = syntaxError.end_lineno;
  const endColumn = syntaxError.end_offset;

  return {
    startLine: line,
    startColumn: column,
    endLine: endLine,
    endColumn: endColumn,
  };
}
