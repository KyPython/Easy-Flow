Frontend environment variables and telemetry notes

Summary of key build-time envs required by the dashboard (rpa-system/rpa-dashboard):

- REACT_APP_SUPABASE_URL
- REACT_APP_SUPABASE_ANON_KEY
- REACT_APP_API_BASE
- REACT_APP_API_URL
- REACT_APP_PUBLIC_URL

Optional telemetry and advanced settings:

- REACT_APP_ENABLE_BROWSER_OTLP=false  # default; set to true to opt-in
- REACT_APP_OTEL_EXPORTER_URL=        # CORS-enabled OTLP HTTP endpoint (if using browser exporter)

If you enable browser OTLP in production, ensure the OTLP endpoint supports CORS and add its origin to the backend Content-Security-Policy (connect-src). Prefer server-side export via the backend for production.

Deployment notes:

- On Render/Vercel: set build-time envs in the service's Environment tab and trigger a new build.
- Local dev: copy `rpa-system/rpa-dashboard/.env.example` to `.env.local` and fill values.
