#!/usr/bin/env python3
"""
Sanitize codebase: Remove AI-generated special characters and make text human-written
"""

import os
import re
import sys
from pathlib import Path

# Character replacements (AI-generated -> human-written)
CHAR_REPLACEMENTS = {
    # Em dashes and en dashes
    '--': '--',  # Em dash
    '-': '-',   # En dash
    
    # Special quotes
    ''''''': "'",   # Right single quote
    '"': '"',   # Left double quote
    '"': '"',   # Right double quote
    
    # Bullets and special characters
    '*': '*',   # Bullet
    '->': '->',  # Arrow
    '...': '...', # Ellipsis
    
    # Other common AI characters
    '-': '-',   # Another en dash variant
}

# File extensions to check
TEXT_EXTENSIONS = {'.md', '.txt', '.js', '.jsx', '.ts', '.tsx', '.py', '.json'}

# Files to skip (binary, generated, etc.)
SKIP_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'package-lock.json',
    'yarn.lock',
    '.pytest_cache',
    '__pycache__',
    '.next',
    'coverage',
    '.venv',
    'venv',
    'env',
    '.env',
]

def should_process_file(filepath):
    """Check if file should be processed"""
    filepath_str = str(filepath)
    
    # Skip if matches skip patterns
    for pattern in SKIP_PATTERNS:
        if pattern in filepath_str:
            return False
    
    # Only process text files
    return filepath.suffix in TEXT_EXTENSIONS

def sanitize_text(content):
    """Replace AI-generated characters with human-written equivalents"""
    sanitized = content
    
    # Replace special characters
    for ai_char, human_char in CHAR_REPLACEMENTS.items():
        sanitized = sanitized.replace(ai_char, human_char)
    
    # Fix excessive markdown formatting (multiple === or ---)
    sanitized = re.sub(r'^={3,}$', '---', sanitized, flags=re.MULTILINE)
    
    # Fix excessive bold markers
    sanitized = re.sub(r'\*\*\*\*+', '**', sanitized)
    
    # Normalize whitespace (remove excessive blank lines, but keep reasonable spacing)
    sanitized = re.sub(r'\n{4,}', '\n\n\n', sanitized)
    
    return sanitized

def sanitize_file(filepath):
    """Sanitize a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            original = f.read()
        
        sanitized = sanitize_text(original)
        
        if original != sanitized:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(sanitized)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}", file=sys.stderr)
        return False

def main():
    """Main sanitization function"""
    root = Path('.')
    processed = 0
    modified = 0
    
    for filepath in root.rglob('*'):
        if not filepath.is_file():
            continue
        
        if not should_process_file(filepath):
            continue
        
        processed += 1
        if sanitize_file(filepath):
            modified += 1
            print(f"Sanitized: {filepath}")
    
    print(f"\nProcessed {processed} files, modified {modified} files")

if __name__ == '__main__':
    main()

