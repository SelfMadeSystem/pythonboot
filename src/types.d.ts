/**
 * @fileoverview Type declarations for importing .py files as strings.
 */
declare module "*.py" {
  const content: string;
  export default content;
}
