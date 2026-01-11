#!/usr/bin/env python3
"""
Sanitize codebase: Remove AI-generated special characters and make text human-written
"""

import os
import re
import sys
from pathlib import Path

# Character replacements (AI-generated special unicode -> human-readable ASCII)
CHAR_REPLACEMENTS = {
 # Em dashes and en dashes -> regular hyphens
 '\u2014': '--', # Em dash
 '\u2013': '-', # En dash
 
 # Smart quotes -> straight quotes
 '\u201c': '"', # Left double quote
 '\u201d': '"', # Right double quote
 '\u2018': "'", # Left single quote
 '\u2019': "'", # Right single quote
 
 # Special characters -> ASCII equivalents
 '\u2022': '*', # Bullet point
 '\u2026': '...', # Ellipsis
 '\u2192': '->', # Arrow
 '\u00a0': ' ', # Non-breaking space -> regular space
}

# AI-generated phrase replacements (make more human)
PHRASE_REPLACEMENTS = {
 r'\bIn summary\b': 'To summarize',
 r'\bOverall,\s+': '',
 r'\bIt is worth noting\b': 'Note that',
 r'\bIt should be noted\b': 'Note that',
 r'\bIt is important to note\b': 'Note that',
}

# File extensions to check
TEXT_EXTENSIONS = {'.md', '.txt', '.js', '.jsx', '.ts', '.tsx', '.py'}

# Files to skip (binary, generated, dependencies, etc.)
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
 '.cursor',
 'firebase-messaging-sw.js', # Generated file
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
 """Replace AI-generated characters and patterns with human-written equivalents"""
 sanitized = content
 
 # Replace special unicode characters
 for ai_char, human_char in CHAR_REPLACEMENTS.items():
 sanitized = sanitized.replace(ai_char, human_char)
 
 # Replace AI-generated phrases
 for pattern, replacement in PHRASE_REPLACEMENTS.items():
 sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)
 
 # Fix excessive markdown formatting (multiple === or ---)
 sanitized = re.sub(r'^={3,}$', '---', sanitized, flags=re.MULTILINE)
 
 # Fix excessive bold markers (more than 2 asterisks)
 sanitized = re.sub(r'\*\*\*\*+', '**', sanitized)
 
 # Normalize whitespace (remove excessive blank lines, but keep reasonable spacing)
 sanitized = re.sub(r'\n{4,}', '\n\n\n', sanitized)
 
 # Fix multiple spaces (keep single spaces)
 sanitized = re.sub(r' {2,}', ' ', sanitized)
 
 # Fix tabs at start of lines (make consistent)
 # Keep tabs in code blocks, but normalize elsewhere
 
 return sanitized

def sanitize_file(filepath):
 """Sanitize a single file"""
 try:
 with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
 original = f.read()
 
 sanitized = sanitize_text(original)
 
 if original != sanitized:
 with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
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
 
 print("Sanitizing codebase for AI-generated characters and patterns...\n")
 
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
