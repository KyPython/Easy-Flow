# Kevin Mason - Financial Table Extraction

Task
- Extract the "Condensed Consolidated Statements of Operations" table from page 8 of test.pdf.

Method
- Used tabula-py (lattice mode) to read page 8 and pandas to clean, normalize, and structure columns: line_item, q2_2025, q1_2025, q2_2024, six_months_2025, six_months_2024, units.
- Applied cleaning rules: parentheses to negatives, removed commas/$/%, converted values to numeric floats.
- Validated key figures for Q2 2025 before saving.

Validation
- Total revenues Q2 2025: 51728
- Net income Q2 2025: 6244
- EPS (basic) Q2 2025: 0.48

Assumptions
- The target table appears on page 8 and includes line items named exactly as specified.
- Units are USD; any missing numeric cells are treated as None.
- Java is available for tabula-py.

Output
- CSV saved to /Users/ky/Easy-Flow/clients/kevin_mason/output/Income_Statement.csv with a final note line.

Next Steps
- Ensure the PDF exists at /Users/ky/Easy-Flow/clients/kevin_mason/Test Task/test.pdf.
- Run: python clients/kevin_mason/extract.py (logs are structured JSON for observability)
- Logs are also written to /Users/ky/Easy-Flow/clients/kevin_mason/output/extract_logs.jsonl (JSONL).
- Deliver the CSV, logs, and validation summary to Kevin along with the README.
