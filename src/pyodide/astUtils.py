import ast

def extract_var_positions(source):
    tree = ast.parse(source)
    var_positions = {}

    class VarVisitor(ast.NodeVisitor):
        def __init__(self):
            self.scope_stack = ["<module>"]

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
    def hint_function(frame):
        hints = []
        # FIXME: doesn't handle scopes properly. Needs to walk the frame stack.
        for (varname, scope), (line, col) in var_positions.items():
            if scope == ("<module>",):
                if varname in frame.f_globals:
                    value = frame.f_globals[varname]
                else:
                    continue
            else:
                if varname in frame.f_locals:
                    value = frame.f_locals[varname]
                else:
                    continue
            hints.append((line, col, varname, repr(value)))
        return hints
    return hint_function

def setup_hinting(source):
    var_positions = extract_var_positions(source)
    return make_hint_function(var_positions)

setup_hinting
