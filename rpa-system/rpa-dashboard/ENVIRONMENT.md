Frontend environment and telemetry notes

This file documents the required build/runtime environment variables for the dashboard and guidance for browser telemetry.

Required (build/runtime)

- VITE_API_BASE
- VITE_API_URL
- VITE_PUBLIC_URL

Supabase (recommended)

- VITE_SUPABASE_URL - e.g. https://syxzilyuysdoirnezgii.supabase.co
- VITE_SUPABASE_ANON_KEY - public anon key used by the client

Optional / Widgets

- VITE_GA_MEASUREMENT_ID - Google Analytics
- VITE_UCHAT_WIDGET_ID - uChat widget id

Browser telemetry (important)

- By default, browser OTLP export is disabled in production.
- To enable browser telemetry at build-time (only if you have a CORS-enabled OTLP endpoint):
  - Set VITE_ENABLE_BROWSER_OTLP=true
  - Set VITE_OTEL_EXPORTER_URL to the OTLP HTTP trace endpoint (must support CORS)

Notes & recommendations

- It is strongly recommended to proxy browser traces through your backend or use server-side export (backend exporter), rather than sending OTLP from the browser directly to a cloud OTLP endpoint, because of CORS and credential concerns.
- When deploying to Render, Vercel, Netlify or other static hosts, set these variables in the provider's environment variables panel (build-time) and trigger a rebuild.
- For local development, copy this file to `.env.local` and fill in values as needed.

Verification checklist after deploy

- Dashboard loads without CSP console errors for HubSpot / ipapi / uchat.
 - `supabaseClient.js` no longer logs missing VITE_SUPABASE_URL/ANON_KEY.
- If browser telemetry is enabled, the OTLP exporter URL is present and allowed in CSP `connect-src`.
