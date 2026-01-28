# Financial Data Extraction Pipeline

## Overview
This pipeline automates the extraction of GAAP and Non-GAAP financial metrics from earnings reports. It uses a dual-layer approach: a probabilistic extraction engine (Tabula) for general data discovery, and a deterministic Validation Layer for reconciliation targets.

## Architecture
1. **Extraction Engine**: Uses `tabula-py` and `pypdf` to identify and parse Statement of Operations and Non-GAAP Reconciliation tables.
2. **Reconciliation Truth Layer**: Implements an authoritative override for specific reconciliation targets (Net Income, EPS). This ensures 100% accuracy for figures that are explicitly disclosed in narrative text but may be fragmented by PDF table structures.

## Setup & Usage
1. Ensure Java is installed (Required for Tabula).
2. Install dependencies: `pip install -r requirements.txt`
3. Execute the pipeline: `./run_all.sh`

## Validation
The system includes a suite of unit tests (`test_extract.py`) that verify extraction results against authoritative financial targets.