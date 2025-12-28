# Normal callback for sys.settrace for checking interrupts
def normal_trace(filename, interrupt_buffer):
    def trace(frame, event, arg):
        ffilename = frame.f_code.co_filename
        # Only pause for the target script
        if ffilename != filename:
            return trace
        if interrupt_buffer[0] != 0:
            interrupt_buffer[0] = 0
            raise KeyboardInterrupt()
        return trace
    return trace

# Debug callback for sys.settrace
def debug_trace(jscb, filename, interrupt_buffer):
    def trace(frame, event, arg):
        import js
        import sys
        frame.f_trace_opcodes = True
        ffilename = frame.f_code.co_filename
        # Only pause for the target script
        if ffilename != filename:
            return trace
        result = js.wait_for_js_promise(jscb(frame, event, arg))
        if result is True:
            frame.f_trace_opcodes = False
            normal_trace_fn = normal_trace(filename, interrupt_buffer)
            sys.settrace(normal_trace_fn)
            return normal_trace_fn
        return trace
    return trace

(normal_trace, debug_trace)
