import ast

def extract_var_positions(source):
    tree = ast.parse(source)
    var_positions = {}

    class VarVisitor(ast.NodeVisitor):
        def __init__(self):
            self.scope_stack = ["module"]

        def visit_FunctionDef(self, node):
            self.scope_stack.append(node.name)
            for arg in node.args.args:
                var_positions[(arg.arg, tuple(self.scope_stack))] = (arg.lineno, arg.col_offset + 1)
            self.generic_visit(node)
            self.scope_stack.pop()

        def visit_AsyncFunctionDef(self, node):
            self.scope_stack.append(node.name)
            for arg in node.args.args:
                var_positions[(arg.arg, tuple(self.scope_stack))] = (arg.lineno, arg.col_offset + 1)
            self.generic_visit(node)
            self.scope_stack.pop()

        def visit_Lambda(self, node):
            self.scope_stack.append("<lambda>")
            for arg in node.args.args:
                var_positions[(arg.arg, tuple(self.scope_stack))] = (arg.lineno, arg.col_offset + 1)
            self.generic_visit(node)
            self.scope_stack.pop()

        def visit_Assign(self, node):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    var_positions[(target.id, tuple(self.scope_stack))] = (target.lineno, target.col_offset + 1)
            self.generic_visit(node)

        def visit_For(self, node):
            if isinstance(node.target, ast.Name):
                var_positions[(node.target.id, tuple(self.scope_stack))] = (node.target.lineno, node.target.col_offset + 1)
            self.generic_visit(node)

        def visit_AsyncFor(self, node):
            if isinstance(node.target, ast.Name):
                var_positions[(node.target.id, tuple(self.scope_stack))] = (node.target.lineno, node.target.col_offset + 1)
            self.generic_visit(node)

        def visit_With(self, node):
            for item in node.items:
                if item.optional_vars and isinstance(item.optional_vars, ast.Name):
                    var_positions[(item.optional_vars.id, tuple(self.scope_stack))] = (item.optional_vars.lineno, item.optional_vars.col_offset + 1)
            self.generic_visit(node)

        def visit_AsyncWith(self, node):
            for item in node.items:
                if item.optional_vars and isinstance(item.optional_vars, ast.Name):
                    var_positions[(item.optional_vars.id, tuple(self.scope_stack))] = (item.optional_vars.lineno, item.optional_vars.col_offset + 1)
            self.generic_visit(node)

    VarVisitor().visit(tree)
    return var_positions

def make_hint_function(var_positions):
    """
    Returns a function that takes a frame and returns a list of (line, col, varname, value_str) for variables in scope.
    """
    def get_hints_for_frame(frame):
        """
        Given a frame, return hints for variable values at their positions.
        
        :param frame: The current execution frame.
        :return: A list of tuples (line, col, varname, value_str).
        """
        hints = []
        # Compose the scope chain: locals, globals, builtins
        scope_chain = [frame.f_locals, frame.f_globals]
        if hasattr(frame, 'f_builtins'):
            scope_chain.append(frame.f_builtins)
        else:
            # Fallback for some Python versions
            scope_chain.append(getattr(frame.f_globals, '__builtins__', {}))
        for (var, scope), (line, col) in var_positions.items():
            # Try to find the variable in the current frame's scopes
            for scope_dict in scope_chain:
                if var in scope_dict:
                    value = scope_dict[var]
                    try:
                        value_str = repr(value)
                    except Exception:
                        value_str = '<unrepr-able>'
                    hints.append((line, col, var, value_str))
                    break
        return hints
    return get_hints_for_frame

def setup_hinting(source):
    var_positions = extract_var_positions(source)
    return make_hint_function(var_positions)

setup_hinting
