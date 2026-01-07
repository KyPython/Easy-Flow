# RAG Knowledge Base Validation

## Overview

The RAG Knowledge Base Validation ensures that the AI Agent's knowledge is always up-to-date with the actual codebase and app features. This prevents the AI from giving outdated or incorrect information to users.

## What It Validates

### 1. Workflow Steps
- **Extracts** actual workflow steps from `aiWorkflowAgent.js` (`WORKFLOW_STEPS` object)
- **Compares** against steps documented in RAG knowledge (`ragClient.js` `seedEasyFlowKnowledge()`)
- **Fails** if any step is missing from RAG knowledge

### 2. Task Types
- **Extracts** task types** from codebase (e.g., `invoice_download`, `web_scraping`, `form_submission`)
- **Compares** against task types documented in RAG knowledge
- **Fails** if any task type is missing from RAG knowledge

### 3. Integrations
- **Extracts** integrations from `addIntegrationKnowledge.js`
- **Verifies** integration knowledge is being added to RAG
- **Warns** if integrations are not properly documented

### 4. System Prompt Features
- **Extracts** features mentioned in AI Agent system prompts
- **Compares** against features documented in RAG knowledge
- **Warns** if features are not in RAG knowledge

## Running the Validation

### Local Development

```bash
# Run RAG validation only
npm run validate:rag

# Run all validations (includes RAG)
npm run validate:all
```

### CI/CD Pipeline

The validation runs automatically in:
- **QA Core Workflow** (`.github/workflows/qa-core.yml`) - Blocks on failures
- **Ship to Production** (`scripts/ship-to-production.sh`) - Blocks on failures
- **Pre-commit Hook** (`scripts/pre-commit.sh`) - Non-blocking warning

## What Happens When It Fails

### Critical Failures (Exit Code 1)
- Missing workflow steps in RAG knowledge
- Missing task types in RAG knowledge

**Action Required**: Update `ragClient.js` `seedEasyFlowKnowledge()` function

### Warnings (Exit Code 0)
- Extra steps in RAG (may be outdated)
- Extra task types in RAG (may be outdated)
- Features not in RAG knowledge

**Action Recommended**: Review and update RAG knowledge for accuracy

## How to Fix Validation Failures

### 1. Missing Workflow Step

If validation reports a missing step (e.g., `file_upload`):

1. Open `rpa-system/backend/services/ragClient.js`
2. Find the `seedEasyFlowKnowledge()` function
3. Add knowledge entry for the missing step:

```javascript
{
  text: `The File Upload step saves files to storage. Configure: Destination - storage location, Source Field - data field containing file, Filename - output filename. Files are stored in Supabase Storage.`,
  source: 'easyflow:help:file-upload-step',
  metadata: { category: 'workflow_steps', step: 'file_upload' },
},
```

### 2. Missing Task Type

If validation reports a missing task type (e.g., `data_processing`):

1. Open `rpa-system/backend/services/ragClient.js`
2. Find the task types section in `seedEasyFlowKnowledge()`
3. Add knowledge entry:

```javascript
{
  text: `Task Type - Data Processing: EasyFlow supports data processing tasks that transform and analyze data. Configure with: Input source, Processing rules, Output format.`,
  source: 'easyflow:help:task-config-data-processing',
  metadata: { category: 'task_configuration', task_type: 'data_processing' },
},
```

### 3. Update System Prompts

If validation reports features not in RAG:

1. Open `rpa-system/backend/services/aiWorkflowAgent.js`
2. Find the system prompt sections
3. Ensure features are documented in both:
   - System prompts (for immediate AI context)
   - RAG knowledge (for long-term knowledge base)

## Validation Script Details

The validation script (`scripts/validate-rag-knowledge.sh`):

1. **Extracts** actual features from codebase using Node.js
2. **Extracts** knowledge from RAG seed function
3. **Compares** them to find discrepancies
4. **Reports** missing or outdated knowledge
5. **Exits** with appropriate code (1 for errors, 0 for warnings)

## Integration with CI/CD

### GitHub Actions

The validation runs in `.github/workflows/qa-core.yml`:

```yaml
- name: Validate RAG Knowledge Base - CRITICAL
  run: |
    chmod +x scripts/validate-rag-knowledge.sh
    ./scripts/validate-rag-knowledge.sh || (echo " RAG knowledge validation failed..." && exit 1)
```

**Position**: After code validation, before tests
**Blocking**: Yes (fails the workflow if knowledge is outdated)

### Pre-commit Hook

The validation runs in `scripts/pre-commit.sh`:

```bash
# RAG knowledge validation (non-blocking warning)
if [ -f "scripts/validate-rag-knowledge.sh" ]; then
  ./scripts/validate-rag-knowledge.sh || echo " RAG knowledge may be outdated"
fi
```

**Position**: After other validations
**Blocking**: No (warning only)

## Best Practices

1. **Update RAG Knowledge First**: When adding new features, update RAG knowledge before committing
2. **Run Validation Locally**: Run `npm run validate:rag` before pushing
3. **Keep Knowledge Synchronized**: Ensure system prompts and RAG knowledge match
4. **Document Everything**: Include all features, steps, and task types in RAG knowledge
5. **Review Warnings**: Even if validation passes, review warnings for accuracy

## Example Validation Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 VALIDATING RAG KNOWLEDGE BASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Extracting features from codebase...
📚 Extracting knowledge from RAG seed function...

 Comparing codebase vs RAG knowledge...

 Workflow Steps:
   All workflow steps documented in RAG

 Task Types:
   All task types documented in RAG

 Integrations:
   Found 5 integrations: Slack, Gmail, Google Sheets, Google Meet, WhatsApp
  ℹ️ Integration knowledge is managed separately in addIntegrationKnowledge.js

 System Prompt Features:
   Found 6 features in system prompt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 VALIDATION PASSED: RAG knowledge is up-to-date
```

## Troubleshooting

### Validation Script Not Found

**Error**: `scripts/validate-rag-knowledge.sh: No such file or directory`

**Solution**: Ensure the script exists and is executable:
```bash
chmod +x scripts/validate-rag-knowledge.sh
```

### Node.js Not Available

**Error**: `Node.js is required but not found`

**Solution**: Install Node.js 20+ or ensure it's in PATH

### False Positives

If validation reports missing knowledge that actually exists:

1. Check the extraction logic in the validation script
2. Verify the knowledge source format matches expected patterns
3. Update the validation script if needed

## Related Documentation

- [RAG Integration Guide](./RAG_INTEGRATION.md)
- [AI Workflow Agent](./AI_WORKFLOW_AGENT.md)
- [Code Validation System](./CODE_VALIDATION_SYSTEM.md)

---

**Last Updated**: 2025-01-XX
**Status**:  Active in CI/CD

