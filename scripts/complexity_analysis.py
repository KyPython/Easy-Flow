#!/usr/bin/env python3
"""
Sovereign Complexity Analysis Script
- Detects deeply nested loops (time complexity proxies)
- Detects large allocations inside loops (space complexity proxies)

Usage: python scripts/complexity_analysis.py <target_dir>
"""
import ast
import os
import sys

MAX_LOOP_DEPTH = 2  # Flag if nesting > 2 (i.e., 3+ levels)
LARGE_ALLOC_THRESHOLD = 1000  # Flag if list/dict/set/array alloc > 1000 elements

class ComplexityAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.issues = []
        self.current_loop_depth = 0

    def visit_For(self, node):
        self.current_loop_depth += 1
        if self.current_loop_depth > MAX_LOOP_DEPTH:
            self.issues.append((node.lineno, f"Deeply nested loop (depth {self.current_loop_depth})"))
        self.generic_visit(node)
        self.current_loop_depth -= 1

    def visit_While(self, node):
        self.visit_For(node)  # Treat while like for

    def visit_ListComp(self, node):
        self.current_loop_depth += 1
        if self.current_loop_depth > MAX_LOOP_DEPTH:
            self.issues.append((node.lineno, f"Deeply nested list comprehension (depth {self.current_loop_depth})"))
        self.generic_visit(node)
        self.current_loop_depth -= 1

    def visit_Assign(self, node):
        # Detect large allocations inside loops
        if self.current_loop_depth > 0:
            if isinstance(node.value, (ast.List, ast.Set, ast.Dict)):
                size = len(node.value.elts) if hasattr(node.value, 'elts') else len(node.value.keys)
                if size > LARGE_ALLOC_THRESHOLD:
                    self.issues.append((node.lineno, f"Large allocation ({size} elements) inside loop"))
        self.generic_visit(node)

def analyze_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            tree = ast.parse(f.read(), filename=filepath)
        except Exception as e:
            return [(1, f"Parse error: {e}")]
    analyzer = ComplexityAnalyzer()
    analyzer.visit(tree)
    return analyzer.issues

def scan_directory(target_dir):
    issues = []
    for root, _, files in os.walk(target_dir):
        for file in files:
            if file.endswith('.py'):
                path = os.path.join(root, file)
                file_issues = analyze_file(path)
                for lineno, msg in file_issues:
                    issues.append(f"{path}:{lineno}: {msg}")
    return issues

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/complexity_analysis.py <target_dir>")
        sys.exit(1)
    target_dir = sys.argv[1]
    issues = scan_directory(target_dir)
    if issues:
        print("Complexity issues detected:")
        for issue in issues:
            print(issue)
        sys.exit(2)
    else:
        print("No complexity issues detected.")

if __name__ == "__main__":
    main()
