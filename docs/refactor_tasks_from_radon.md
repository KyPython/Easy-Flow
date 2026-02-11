**Refactor Tasks — D-level Cyclomatic Complexity (21-30)**

Priority list (descending complexity).  Suggested action and estimated effort.

- **Complexity 30**: `scripts/notion-integrations/time-tracking-to-notion-sync.py::sync_toggl_entries` (line 167)
  - Action: Extract helpers for property mapping, date parsing, and entry upsert; add unit tests for mapping logic.
  - Effort: 2-3h

- **Complexity 28**: `easyflow-metrics/operations_automation.py::sync_to_notion` (line 351)
  - Action: Split orchestration vs transformation; move network calls to helpers, add tests for transformation logic.
  - Effort: 3-4h

- **Complexity 28**: `rpa-system/automation/automation-service/generic_scraper.py::scrape_web_page` (line 92)
  - Action: Continue incremental extraction (parsing, selectors, post-processing) into module helpers (already partially refactored).
  - Effort: 2-4h

- **Complexity 27**: `easyflow-metrics/customer_feedback_extractor.py::analyze_source_attribution` (line 153)
  - Action: Extract smaller analysis functions, isolate I/O from pure logic; add unit tests for parsing/aggregation.
  - Effort: 2-3h

- **Complexity 27**: `rpa-system/automation/automation-service/production_automation_service.py::_run_task_core` (line 359)
  - Action: Already split from `process_automation_task`; consider further split of invoice, scraping, and web automation handlers into separate modules.
  - Effort: 1-2h

- **Complexity 27**: `scripts/notion-integrations/stripe-to-notion-sync.py::sync_stripe_charges` (line 137)
  - Action: Extract charge parsing, pricing normalization, and upsert helpers; add tests for currency/amount handling.
  - Effort: 2-3h

- **Complexity 24**: `scripts/notion-integrations/organize-notion-workspace.py::organize_command_center` (line 182)
  - Action: Break into find/move/create helpers; ensure idempotence and add tests for block operations.
  - Effort: 2-3h

- **Complexity 24**: `scripts/notion-integrations/populate-life-os.py::sync_github_issues` (line 65)
  - Action: Separate GitHub fetch, transform, and Notion upsert steps; add tests for mapping.
  - Effort: 2-3h

- **Complexity 22**: `scripts/notion-integrations/comprehensive-github-sync.py::sync_issues_to_features` (line 498)
  - Action: Extract filtering, mapping, and post-processing functions; add tests for edge-cases.
  - Effort: 2h

- **Complexity 21**: `rpa-system/automation/automation-service/production_automation_service.py::kafka_consumer_loop` (line 602)
  - Action: Consider extracting message handling and OTEL extraction into helpers (already mostly done); add unit tests for header parsing and submit logic.
  - Effort: 1-2h

- **Complexity 21**: `scripts/notion-integrations/comprehensive-github-sync.py::sync_pulls_to_tasks` (line 319)
  - Action: Split transformation and filtering logic into smaller functions; add tests.
  - Effort: 1-2h


Notes:
- Items are prioritized by complexity and likely business impact (Notion integrations and automation services are high value).
- For each task: aim to extract pure functions (logic) and keep side-effects (HTTP, file I/O) in thin wrappers to make unit testing straightforward.
