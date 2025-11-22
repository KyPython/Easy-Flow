Title: fix(dashboard): defer social-proof initial fetch and add short TTL cache

Summary
-------
This branch defers the initial network fetch for social-proof metrics to idle time (uses `requestIdleCallback` with a timeout fallback) and adds a 30s in-memory TTL cache for `getSocialProofMetrics()` in the dashboard API utils. The goal is to reduce main-thread and network pressure during initial page load, reduce duplicate startup calls, and improve Time To Interactive.

Files changed
-------------
- `rpa-system/rpa-dashboard/src/hooks/useSocialProof.js`
  - Schedule initial fetch in idle time with a 2s idle timeout (fallback to 1s timeout)
  - Add a global guard `window.__SOCIAL_PROOF_LOADING__` and `window.__SOCIAL_PROOF_LAST_FETCH__` to suppress duplicate startup fetches
  - Preserve retry/backoff and manual refresh behavior

- `rpa-system/rpa-dashboard/src/utils/api.js`
  - Add module-level `_socialProofCache` with `SOCIAL_PROOF_TTL = 30s`
  - Return cached value when fresh to avoid repeated identical network calls

Testing & Validation
--------------------
Manual local validation steps (recommended):

1) Build with source maps and serve locally

```bash
export GENERATE_SOURCEMAP=true
npm run build --prefix rpa-system/rpa-dashboard
npx serve -s rpa-system/rpa-dashboard/build -l 3001 &
```

2) Run the quick smoke-check (headless Puppeteer) to verify the app renders

```bash
node simple-check.js
```

3) Capture a short trace and map to verify hotspots reduced for social-proof and related API work

```bash
node capture-trace.js http://localhost:3001
LATEST=$(ls -1dt diagnostics/*-freeze | head -1)
node tools/analyze-trace.js "$LATEST/trace.json"
MAP=$(ls -1 rpa-system/rpa-dashboard/build/static/js/main.*.js.map | head -1)
node tools/map-trace-to-sources.js "$LATEST/trace.json" "$MAP"
```

Expected result: fewer mapped hits pointing at `axios`/`api.js` social-proof functions and fewer duplicate network calls during initial load. React DOM passive/commit work will still show up until additional components are idle-mounted or code-split further.

Notes for reviewers
-------------------
- No changes to API contract; fallback remains the same for offline or failing backend responses.
- If CI or the dev server relies on immediate metric availability in certain pages (rare), consider keeping manual refresh or triggering fetch on user interactions.

Follow-ups (optional)
---------------------
- Further reduce initial React mount work by lazy-loading more header/dashboard widgets and deferring non-critical cards using `DeferredMount` where appropriate.
- Add a short server-side endpoint cache or ETag support for `GET /api/social-proof-metrics` to make backend responses even cheaper.

