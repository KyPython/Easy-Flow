#!/usr/bin/env python3
import json, csv, sys

infile = 'radon_all.json'
outfile = 'radon_report.csv'
try:
    with open(infile, 'r') as f:
        data = json.load(f)
except Exception as e:
    print('Could not read radon JSON:', e)
    sys.exit(1)

rows = []
for fname, blocks in data.items():
    if not isinstance(blocks, list):
        # skip files where radon reported an error instead of blocks
        continue
    for b in blocks:
        rows.append({
            'file': fname,
            'name': b.get('name') if isinstance(b, dict) else str(b),
            'startline': b.get('lineno') if isinstance(b, dict) else None,
            'type': b.get('type') if isinstance(b, dict) else None,
            'complexity': b.get('complexity') if isinstance(b, dict) else 0
        })

rows_sorted = sorted(rows, key=lambda r: (-r['complexity'], r['file'], r['startline']))

with open(outfile, 'w', newline='') as csvfile:
    writer = csv.DictWriter(csvfile, fieldnames=['complexity','file','startline','type','name'])
    writer.writeheader()
    for r in rows_sorted:
        writer.writerow({'complexity': r['complexity'], 'file': r['file'], 'startline': r['startline'], 'type': r['type'], 'name': r['name']})

print(f'Wrote {len(rows_sorted)} entries to {outfile}')
