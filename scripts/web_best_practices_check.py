#!/usr/bin/env python3
"""
Web Design Best Practices Checker
- Checks for 12 best practices in frontend code (HTML/JSX/TSX)
- Focus: rpa-system/rpa-dashboard/src

Usage: python scripts/web_best_practices_check.py <target_dir>
"""
import os
import re
import sys

SEMANTIC_TAGS = [
    'header', 'nav', 'main', 'footer', 'section', 'article', 'aside', 'figure', 'figcaption', 'mark', 'time', 'summary', 'details'
]

BEST_PRACTICES = [
    'semantic_tags',
    'responsive_design',
    'accessibility',
    'performance',
    'version_control',
    'documentation',
]

# Simple regexes for demonstration (expand as needed)
SEMANTIC_TAG_REGEX = re.compile(r'<(' + '|'.join(SEMANTIC_TAGS) + ')[\s>]')
MEDIA_QUERY_REGEX = re.compile(r'@media[\s]*\(')
ALT_TEXT_REGEX = re.compile(r'<img[^>]+alt=')
ARIA_REGEX = re.compile(r'aria-')
LAZY_LOAD_REGEX = re.compile(r'loading=["\"]lazy["\"]')


def check_semantic_tags(content):
    return bool(SEMANTIC_TAG_REGEX.search(content))

def check_responsive_design(content):
    return bool(MEDIA_QUERY_REGEX.search(content))

def check_accessibility(content):
    return bool(ALT_TEXT_REGEX.search(content)) or bool(ARIA_REGEX.search(content))

def check_performance(content):
    return bool(LAZY_LOAD_REGEX.search(content))

def scan_files(target_dir):
    results = {k: False for k in BEST_PRACTICES}
    for root, _, files in os.walk(target_dir):
        for file in files:
            if file.endswith(('.js', '.jsx', '.ts', '.tsx', '.html')):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if check_semantic_tags(content):
                        results['semantic_tags'] = True
                    if check_responsive_design(content):
                        results['responsive_design'] = True
                    if check_accessibility(content):
                        results['accessibility'] = True
                    if check_performance(content):
                        results['performance'] = True
    # Version control and documentation are assumed present if .git and README exist
    results['version_control'] = os.path.isdir('.git')
    results['documentation'] = os.path.isfile('README.md') or os.path.isfile('docs/README.md')
    return results

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/web_best_practices_check.py <target_dir>")
        sys.exit(1)
    target_dir = sys.argv[1]
    results = scan_files(target_dir)
    failed = [k for k, v in results.items() if not v]
    if failed:
        print("Web design best practices missing:")
        for k in failed:
            print(f"- {k}")
        sys.exit(2)
    else:
        print("All web design best practices detected.")

if __name__ == "__main__":
    main()
