/**
 * Normalizes newline characters in a given text.
 * Converts all occurrences of '\n' to '\r\n'.
 */
export function normalizeNewlines(text: string): string {
  return text.replace(/\n/g, '\r\n');
}

/**
 * To distinguish between 'null' as a value and 'no value loaded'.
 */
export const SYM_NIL = Symbol('nil');
