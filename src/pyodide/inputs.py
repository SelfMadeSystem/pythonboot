import js
import xterm
import asyncio

class XTermInput:
    def __call__(self, prompt=""):
        if prompt:
            print(prompt, end="", flush=True)
        coro = xterm.readFromXTerm()
        result = asyncio.get_event_loop().run_until_complete(coro)
        if isinstance(result, str):
            return result
        if "KeyboardInterrupt" in result.message:
            raise KeyboardInterrupt() from None
        elif "EOFError" in result.message:
            raise EOFError() from None
        raise result from None
    def __repr__(self):
        return "<built-in function input>"
    def __str__(self):
        return "<built-in function input>"

def xterm_clear():
    xterm_instance = xterm.getXTerm()
    if xterm_instance:
        xterm_instance.clear()

def wait_for_js_promise(promise):
    return asyncio.get_event_loop().run_until_complete(promise)

__builtins__.input = XTermInput()
__builtins__.clear = xterm_clear
__builtins__.copyright = f"""Copyright (c) 2025 Shoghi Simon
All Rights Reserved.

{copyright}"""
__builtins__.credits = f"""    Thanks to Pyodide for making this possible.
    Thanks to UdeM's DIRO for their online Python learning environment
    which inspired me to make this project.
{credits}"""
__builtins__.license = f"""pythonBoot is licensed under the MIT License.

See https://opensource.org/licenses/MIT for more information.

Python is a trademark of the Python Software Foundation.

{license}"""
js.wait_for_js_promise = wait_for_js_promise
