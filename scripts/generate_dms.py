#!/usr/bin/env python3
"""Generate personalized cold DM lines from a CSV of targets.

Usage: python3 scripts/generate_dms.py docs/modeLogic/dm_recipients_sample.csv > dms_out.csv
"""
import csv
import sys

TEMPLATE = "Hey {first_name}, noticed you're using Zapier for lead routing — I built ModeLogic, a logic-driven alternative that cuts automation costs ~25% using batch scheduling. Interested in a free 20-minute setup call?"

def main(path):
    with open(path, newline='') as f:
        reader = csv.DictReader(f)
        writer = csv.writer(sys.stdout)
        writer.writerow(['email','dm'])
        for r in reader:
            first = r.get('first_name') or r.get('name') or ''
            dm = TEMPLATE.format(first_name=first)
            writer.writerow([r.get('email',''), dm])

if __name__=='__main__':
    if len(sys.argv)<2:
        print('Usage: generate_dms.py recipients.csv', file=sys.stderr)
        sys.exit(2)
    main(sys.argv[1])
