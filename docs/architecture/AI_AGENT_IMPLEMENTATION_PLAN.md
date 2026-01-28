# AI Agent Implementation Plan
**Objective:** Complete "English-to-API" translation layer for autonomous agentic workflows

## Implementation Roadmap

### Phase 1: Critical Capabilities (Week 1)

#### 1.1 Natural Language Cron Parser
**File:** `rpa-system/backend/utils/cronParser.js`  
**Status:** ❌ Not implemented

**Requirements:**
- Parse "every 15 mins" → `*/15 * * * *`
- Parse "every hour" → `0 * * * *`
- Parse "daily at 9am" → `0 9 * * *`
- Parse "weekly on Monday at 8am" → `0 8 * * 1`
- Handle variations: "15 minutes", "15 min", "every 15min"

**Implementation:**
```javascript
function parseNaturalLanguageCron(naturalLanguage) {
  // Parse patterns like:
  // "every 15 mins" → */15 * * * *
  // "every hour" → 0 * * * *
  // "daily at 9am" → 0 9 * * *
  // etc.
}
```

---

#### 1.2 Enhanced Schedule Workflow Action
**File:** `rpa-system/backend/services/aiActionExecutor.js`  
**Status:** ⚠️ Partial - needs cron parsing integration

**Changes:**
- Extend `create_automated_workflow` to accept cron expressions
- Integrate cron parser for natural language schedules
- Update `trigger_type` enum to include `'cron'` option

---

#### 1.3 List Sheets Action (Ambiguity Resolution)
**File:** `rpa-system/backend/services/aiActionExecutor.js`  
**Status:** ❌ Not implemented

**Requirements:**
- Add `list_sheets` action to list user's Google Sheets
- Used by agent to resolve "which sheet?" ambiguities
- Returns: spreadsheetId, title, url for each sheet

---

#### 1.4 Error Handling Step Type
**File:** `rpa-system/backend/services/workflowExecutor.js`  
**Status:** ❌ Not implemented

**Requirements:**
- New step type: `error_handler`
- Condition: "if step X fails"
- Action: "then send email" or "then retry" or "then execute workflow Y"
- Enables "if step 2 fails, send email" pattern

---

### Phase 2: Translation Glue (Week 2)

#### 2.1 RAG Auto-Sync Script
**File:** `scripts/sync-rag-knowledge.js`  
**Status:** ❌ Not implemented

**Requirements:**
- Scan codebase for new API endpoints
- Extract function signatures and descriptions
- Auto-generate documentation
- Ingest into RAG service
- Run on CI/CD when code changes

---

#### 2.2 Parameter Mapping Middleware
**File:** `rpa-system/backend/middleware/parameterMapper.js`  
**Status:** ❌ Not implemented

**Requirements:**
- Translate "save it" → {"action": "sheets_write", "target": "resolved_sheet_id"}
- Translate "reddit link" → {"url": "https://reddit.com/..."}
- Context-aware resolution (from conversation history)

---

### Phase 3: Edge Cases & Reliability (Week 2-3)

#### 3.1 Ambiguity Detection & Resolution
**File:** `rpa-system/backend/services/ambiguityResolver.js`  
**Status:** ❌ Not implemented

**Requirements:**
- Detect ambiguous inputs ("save it", "which sheet")
- Generate clarification prompts
- Store user responses for context
- Retry action after clarification

---

#### 3.2 Enhanced Input Normalization
**File:** `rpa-system/backend/utils/inputNormalizer.js`  
**Status:** ⚠️ Partial - OpenAI handles some, needs structured validation

**Requirements:**
- URL detection: "reddit link" → URL
- Email detection: "my email" → user email
- Date parsing: "tomorrow" → ISO date
- Time parsing: "9am" → "09:00"

---

### Phase 4: UX & Testing (Week 3)

#### 4.1 End-to-End Test Suite
**File:** `rpa-system/backend/tests/integration/aiAgentE2E.test.js`  
**Status:** ❌ Not implemented

**Test Cases:**
1. "Build a tool that checks my site every hour and logs the status to Sheets"
2. "Scrape reddit.com every 15 mins and save to Google Sheets"
3. "Monitor amazon.com prices daily, if price < $50 send email"

---

#### 4.2 Enhanced Error Messages
**File:** `rpa-system/backend/services/aiWorkflowAgent.js`  
**Status:** ⚠️ Partial - needs improvement

**Requirements:**
- User-friendly error messages
- Actionable suggestions
- Context-aware help

---

## Implementation Order

1. **Natural Language Cron Parser** (Blocking for schedule automation)
2. **Enhanced Schedule Workflow** (Enables cron in create_automated_workflow)
3. **List Sheets Action** (Enables ambiguity resolution)
4. **Error Handling Step Type** (Enables "if fails" patterns)
5. **Parameter Mapping Middleware** (Quality of life)
6. **RAG Auto-Sync Script** (Maintenance)
7. **Ambiguity Resolver** (UX improvement)
8. **E2E Tests** (Verification)

---

## Success Criteria

✅ User can say "every 15 mins" and workflow schedules correctly  
✅ User can say "save it" and agent asks "which sheet?" if ambiguous  
✅ User can say "if step fails, send email" and workflow includes error handler  
✅ User can say "reddit link" and agent understands it's a URL  
✅ Agent documentation stays current via auto-sync  
✅ E2E test: "Build a tool that checks my site every hour and logs the status to Sheets" passes  

---

## Next Steps

See individual implementation files in this directory for detailed code.
