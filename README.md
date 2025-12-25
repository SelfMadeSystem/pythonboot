# pythonBoot

An in-browser Python interpreter and debugger powered by Pyodide, Monaco Editor and xterm.js.

## Features

- [x] Write and execute Python code directly in your browser.
- [x] Step through your code with a built-in debugger.
- [x] Syntax highlighting
- [ ] Code autocompletion
- [x] Variable inspection
  - Right now, only has inline variable value hints.
- [ ] Breakpoints
- [x] Terminal input/output
  - stdout/stderr works, stdin partially works (only `input()` function)
- [x] File system access
  - Only what Pyodide has by default
- [ ] Package management (might work, just haven't tested it)
- [ ] Canvas support (primarily for turtle graphics)
- [ ] Custom websites with embedded Python code
- [ ] Persistence
- [ ] Save and load code snippets
- [ ] Share code snippets via URL
- [ ] Theme support (light/dark mode, currently only dark mode is available)
- [ ] Documentation

Mobile support probably won't be a thing due to Monaco Editor's limitations on mobile devices.
