/**
 * The Python test harness, as source text. Pyodide runs it once per worker;
 * the browser and Node entry points share it, so a puzzle passes in CI exactly
 * when it passes in the browser. Defines `run_puzzle(code, tests, max_output)`,
 * which returns the outcome as a JSON string.
 *
 * Puzzle tests are plain functions `def test_xxx():` that use `assert`. The
 * code and the tests run in one namespace, code first, so tests can call
 * anything the code defines. Bare asserts are rewritten so a failure explains
 * itself: `assert add(2, 3) == 5 (left: -1, right: 5)`.
 */
export const PYTHON_HARNESS = String.raw`
import ast
import contextlib
import json
import operator
import sys

_SYMBOLS = {
    ast.Eq: "==",
    ast.NotEq: "!=",
    ast.Lt: "<",
    ast.LtE: "<=",
    ast.Gt: ">",
    ast.GtE: ">=",
    ast.Is: "is",
    ast.IsNot: "is not",
    ast.In: "in",
    ast.NotIn: "not in",
}

_CHECKS = {
    "==": operator.eq,
    "!=": operator.ne,
    "<": operator.lt,
    "<=": operator.le,
    ">": operator.gt,
    ">=": operator.ge,
    "is": operator.is_,
    "is not": operator.is_not,
    "in": lambda left, right: left in right,
    "not in": lambda left, right: left not in right,
}


def _bhr_compare(symbol, left, right, source):
    if _CHECKS[symbol](left, right):
        return True
    raise AssertionError(
        "assert %s (left: %r, right: %r)" % (source, left, right)
    )


class _ExplainAsserts(ast.NodeTransformer):
    """Gives every assert without a message one that shows the values."""

    def visit_Assert(self, node):
        self.generic_visit(node)
        if node.msg is not None:
            return node
        source = ast.unparse(node.test)
        test = node.test
        if (
            isinstance(test, ast.Compare)
            and len(test.ops) == 1
            and type(test.ops[0]) in _SYMBOLS
        ):
            node.test = ast.Call(
                func=ast.Name(id="_bhr_compare", ctx=ast.Load()),
                args=[
                    ast.Constant(_SYMBOLS[type(test.ops[0])]),
                    test.left,
                    test.comparators[0],
                    ast.Constant(source),
                ],
                keywords=[],
            )
        else:
            node.msg = ast.Constant("assert " + source)
        return ast.fix_missing_locations(node)


class _CappedOutput:
    def __init__(self, limit):
        self.limit = limit
        self.parts = []
        self.size = 0
        self.truncated = False

    def write(self, text):
        if not self.truncated:
            self.parts.append(text)
            self.size += len(text)
            if self.size > self.limit:
                self.truncated = True
        return len(text)

    def flush(self):
        pass

    def isatty(self):
        return False

    def text(self):
        joined = "".join(self.parts)
        if self.truncated:
            return "%s\n… output truncated at %d characters" % (
                joined[: self.limit],
                self.limit,
            )
        return joined


def _describe(error):
    return "%s: %s" % (type(error).__name__, error) if str(error) else type(error).__name__


def _syntax_error(error, label):
    where = " (line %d)" % error.lineno if error.lineno else ""
    return "SyntaxError in %s: %s%s" % (label, error.msg, where)


def _compile(source, filename, explain):
    tree = ast.parse(source, filename)
    if explain:
        tree = _ExplainAsserts().visit(tree)
    return compile(tree, filename, "exec")


def _run_tests(namespace):
    results = []
    for name, value in list(namespace.items()):
        function = value if callable(value) else None
        code = getattr(function, "__code__", None)
        if not name.startswith("test_") or code is None:
            continue
        if code.co_filename != "<tests>":
            continue
        if code.co_flags & 0x80:
            results.append(
                {"name": name, "passed": False, "message": "async tests are not supported"}
            )
            continue
        try:
            function()
            results.append({"name": name, "passed": True})
        except AssertionError as error:
            message = str(error) or "assert failed"
            results.append({"name": name, "passed": False, "message": message})
        except BaseException as error:
            results.append({"name": name, "passed": False, "message": _describe(error)})
    return results


def run_puzzle(code, tests, max_output):
    output = _CappedOutput(max_output)

    def outcome(status, results=(), error=None):
        value = {"status": status, "tests": list(results), "output": output.text()}
        if error is not None:
            value["error"] = error
        return json.dumps(value)

    try:
        program = _compile(code, "<code>", False)
    except SyntaxError as error:
        return outcome("error", error=_syntax_error(error, "your code"))
    try:
        suite = _compile(tests, "<tests>", True)
    except SyntaxError as error:
        return outcome("error", error=_syntax_error(error, "the tests"))

    namespace = {"__name__": "__puzzle__", "_bhr_compare": _bhr_compare}
    real_stdout, real_stderr = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = output
    try:
        try:
            exec(program, namespace)
            exec(suite, namespace)
        except BaseException as error:
            return outcome("error", error=_describe(error))
        results = _run_tests(namespace)
    finally:
        sys.stdout, sys.stderr = real_stdout, real_stderr
    if not results:
        return outcome("error", error="No tests were found")
    status = "passed" if all(r["passed"] for r in results) else "failed"
    return outcome(status, results)
`;
