<!-- Pull Request Template - include AI provenance when applicable -->

## Summary
- Short description of the change and why.

## Changes
- Bullet list of major changes.

## Testing
- How to run tests and any manual verification steps.

## AI Provenance (if any)
- `AI-assisted: prompt="<one-line prompt>"`, reviewed-by=`<your-name>`, notes=`<one-line on verification>`

Example:
```
AI-assisted: prompt="generate put/get for LRU cache using OrderedDict", reviewed-by=kevin, notes="ran pytest and added edge-case tests; simplified generated code"
```

## Rollout / Backwards compatibility
- Migration steps or notes.

## Related
- Issue/PR references
## Description

<!-- Provide a clear and concise description of what this PR does -->

## Type of Change

<!-- Mark the relevant option with an "x" -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ]  New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ]  Style/formatting changes (no functional changes)
- [ ] ♻️ Code refactoring (no functional changes)
- [ ]  Performance improvement
- [ ]  Test addition or update
- [ ]  Build/CI changes
- [ ] 🧹 Chore (maintenance tasks)

## Related Issues

<!-- Link related issues using "Closes #123" or "Fixes #123" or "Relates to #123" -->

Closes #
Relates to #

## Changes Made

<!-- Describe the specific changes made in this PR -->

- 
- 
- 

## Testing

<!-- Describe how you tested your changes -->

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] All existing tests pass

**Test Steps:**
1. 
2. 
3. 

## Screenshots/Videos (if applicable)

<!-- Add screenshots or videos to help explain your changes -->

## Checklist

<!-- Mark completed items with an "x" -->

### Pre-Submission
- [ ] Branch name follows convention (`feature/`, `bugfix/`, `hotfix/`, `release/`)
- [ ] All commits follow Conventional Commits format
- [ ] Code is linted and formatted
- [ ] Tests pass locally (`npm run test:all`)
- [ ] Branch is rebased on latest `main` (or `develop`)
- [ ] PR readiness check passed (`./scripts/git-workflow-helper.sh status`)

### Code Quality
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated (if needed)
- [ ] No console.log statements left in code
- [ ] No commented-out code

### Security & Performance
- [ ] No security vulnerabilities introduced
- [ ] Performance considerations addressed (if applicable)
- [ ] Environment variables properly handled
- [ ] Sensitive data not committed

### Dependencies
- [ ] New dependencies are necessary and documented
- [ ] Dependencies are up to date
- [ ] No breaking changes in dependencies

## Rockefeller 7-Filter Checklist

<!-- Complete this checklist to ensure alignment with business principles -->
<!-- Score each filter 0-10, target total score: 45+ (Conditional Yes) or 60+ (Strong Yes) -->

- [ ] **1. Efficiency Test** (__/10): Does this reduce steps or save time?
  - Eliminates manual processes or reduces complexity
  - Optimizes performance or simplifies workflows
  
- [ ] **2. Control Test** (__/10): Does this reduce dependency on 3rd parties?
  - Builds in-house capabilities vs. relying on external services
  - Reduces vendor lock-in or increases platform ownership
  
- [ ] **3. Data Test** (__/10): Does this generate valuable intelligence?
  - Adds analytics, metrics, or user behavior tracking
  - Improves data collection for decision-making
  
- [ ] **4. Strategic Fit Test** (__/10): Does this support the 3-year vision?
  - Aligns with roadmap and long-term goals
  - Supports #1 current priority
  
- [ ] **5. Culture Test** (__/10): Does this align with core values?
  - Sovereignty, Radical Simplicity, Transparent Building
  - User-First approach, Long-term Impact thinking
  
- [ ] **6. Innovation Test** (__/10): Is this innovative or just copying?
  - Creates unique differentiation vs. competitors
  - Builds proprietary advantages
  
- [ ] **7. Focus Test** (__/10): Does this support the #1 priority?
  - Directly contributes to current top priority
  - Avoids distractions or scope creep

**Total Score:** __/70

**Decision Guide:**
- 60-70: Strong YES ✅ (Proceed immediately)
- 45-59: Conditional YES ⚠️ (Address key concerns)
- 30-44: Weak ❌ (Rethink approach)
- <30: NO 🚫 (Does not align with principles)

## Additional Notes

<!-- Add any additional context, notes, or information for reviewers -->

## Reviewers

<!-- Tag specific reviewers if needed -->

@

---

**PR Title Format:** `<type>(<scope>): <description>`

Examples:
- `feat(auth): add OAuth login`
- `fix(api): resolve timeout issue`
- `docs: update installation guide`

