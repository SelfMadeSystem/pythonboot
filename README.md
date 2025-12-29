# pythonBoot

An in-browser Python interpreter and debugger powered by Pyodide, Monaco Editor and xterm.js.

## Features

- [x] Write and execute Python code directly in your browser.
- [x] Step through your code with a built-in debugger.
- [ ] REPL
  - You can call `code.interact()` to drop into a REPL, but it takes over the entire terminal and you can't run further code until you exit the REPL.
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
- [x] Canvas support (primarily for turtle graphics)
  - [x] Custom-built turtle graphics. Not complete yet
  - [ ] pixels canvas
- [ ] Custom websites with embedded Python code
- [x] Persistence
- [ ] Save and load code snippets
- [ ] Share code snippets via URL
- [ ] Theme support (light/dark mode, currently only dark mode is available)
- [ ] Documentation

## Known Problems and Limitations

- Mobile support probably won't be a thing due to Monaco Editor's limitations on mobile devices.
- Variable inline hints aren't accurate with different scopes (e.g. inside functions or loops).
- Any stdin input other than `input()` function will not work properly.
- Some libraries that require system-level access or have C extensions may not work properly in Pyodide.
- Takes ~5 seconds to load Pyodide and initialize the environment (on my relatively strong laptop). Unsure if this can be improved.
- Syntax errors has one too many stack frames shown that I'm too lazy to fix right now.

## Contact

If you have any questions, suggestions, or issues, feel free to reach out to me at

- Email: py [at] shoghisimon [dot] ca
- GitHub: [SelfMadeSystem](https://github.com/SelfMadeSystem) (you're probably already here)
- Website: [shoghisimon.ca](https://shoghisimon.ca)
- Discord: `selfmadesystem`

## License

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.

Note: The GPL only applies to the code in this repository. Code written by users using this tool is not subject to the GPL.
