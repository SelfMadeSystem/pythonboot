import xterm

def xterm_clear():
    xterm_instance = xterm.getXTerm()
    if xterm_instance:
        xterm_instance.clear()

__builtins__.clear = xterm_clear