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

def wait_for_js_promise(promise):
    return asyncio.get_event_loop().run_until_complete(promise)

__builtins__.input = XTermInput()
js.wait_for_js_promise = wait_for_js_promise
