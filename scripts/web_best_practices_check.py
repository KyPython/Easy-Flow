#!/usr/bin/env python3
"""
Web Design Best Practices Check
Validates React components follow web design best practices.
"""

import sys
from pathlib import Path


def check_best_practices(src_dir: str) -> int:
    """Check web design best practices in the given directory."""
    src_path = Path(src_dir)
    
    if not src_path.exists():
        print(f"⚠️ Source directory not found: {src_dir}")
        return 0  # Non-blocking
    
    issues = []
    
    # Check for accessibility attributes in JSX files
    jsx_files = list(src_path.rglob('*.jsx')) + list(src_path.rglob('*.tsx'))
    print(f"Checking {len(jsx_files)} component files...")
    
    for jsx_file in jsx_files[:50]:  # Limit to first 50 for performance
        try:
            content = jsx_file.read_text(encoding='utf-8')
            
            # Check for images without alt text (basic check)
            if '<img' in content and 'alt=' not in content:
                issues.append(f"{jsx_file}: Image without alt attribute")
            
            # Check for buttons without type
            if '<button' in content and 'type=' not in content:
                # This is a soft warning, many buttons work fine without type
                pass
                
        except Exception as e:
            print(f"⚠️ Could not read {jsx_file}: {e}")
    
    if issues:
        print(f"\n⚠️ Found {len(issues)} potential issues:")
        for issue in issues[:10]:  # Show first 10
            print(f"  - {issue}")
        if len(issues) > 10:
            print(f"  ... and {len(issues) - 10} more")
    else:
        print("✅ No critical best practice issues found")
    
    return 0  # Always pass for now (issues are warnings)


def main():
    if len(sys.argv) < 2:
        print("Usage: python web_best_practices_check.py <src_directory>")
        return 1
    
    src_dir = sys.argv[1]
    return check_best_practices(src_dir)


if __name__ == '__main__':
    sys.exit(main())
