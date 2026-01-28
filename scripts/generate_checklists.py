#!/usr/bin/env python3
"""
Generate Checklists Script
Creates PDF/TXT checklists from analyzed pain points for lead magnets.
"""

import argparse
import json
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description='Generate checklists from pain points data')
    parser.add_argument('--input', type=str, required=True, help='Input JSON file with pain points')
    parser.add_argument('--output', type=str, required=True, help='Output directory for checklists')
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load input data
    try:
        with open(input_path, 'r') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        data = []

    print(f"Loaded {len(data)} pain points from {args.input}")

    # Generate a basic checklist
    checklist_path = output_dir / 'automation_checklist.txt'
    with open(checklist_path, 'w') as f:
        f.write("# Automation Pain Points Checklist\n\n")
        f.write("## Common Issues to Address\n\n")
        if data:
            for i, item in enumerate(data[:10], 1):
                f.write(f"- [ ] {item.get('title', 'Item ' + str(i))}\n")
        else:
            f.write("- [ ] Manual data entry tasks\n")
            f.write("- [ ] Repetitive file processing\n")
            f.write("- [ ] Email management overhead\n")
            f.write("- [ ] Report generation delays\n")
            f.write("- [ ] Cross-system data sync\n")

    print(f"✅ Checklist generated: {checklist_path}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
