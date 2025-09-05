# SECURITY.md

Short summary of EasyFlow security posture (development / early-stage)

## Transport & network

- All browser ↔ frontend and frontend ↔ backend traffic must use TLS (HTTPS) in production.
- Internal service-to-service communication should use private networks and TLS where possible.

## Authentication & secrets

- User authentication is handled by Supabase Auth (or configured auth provider).
- Automation service endpoints authenticate using a shared API key (AUTOMATION_API_KEY).
- Encryption keys and secrets are provided via environment variables:
  - CREDENTIAL_ENCRYPTION_KEY used by the automation service to decrypt submitted credentials.
  - Do not commit these values to source control.

## Data encryption

- In-transit: TLS is required and assumed for production deployments.
- At-rest: we rely on hosting / Supabase storage encryption by default.
- Client-side / true end-to-end encryption (E2EE) is not currently implemented across all features. The repo includes support for decrypting credentials in the automation worker (AES-GCM with a KDF) but a formal E2EE design (client-side encryption with key management) is on the roadmap.

## Minimal retention & privacy

- The system is designed to minimize persisted customer data where possible — see DATA_RETENTION.md for details.
- Any sensitive secrets or credentials used by automations should be encrypted client-side prior to submission where feasible.

## Logging & telemetry

- Development logging exists to aid debugging (server logs, Flask app logger). Do not send secrets to public logs.
- Production deployments should configure structured logging, redaction of secrets, and log retention policies.

## Hardening / practices

- Keep dependencies up to date and run SCA (software composition analysis).
- Use strong randomly-generated keys for AUTOMATION_API_KEY (>=32 characters).
- Rotate keys regularly and use short retention windows for sensitive material.

## Roadmap / outstanding items

- Formal E2EE implementation (client-side encryption + KMS/Key derivation).
- Audit logging and tamper-evident logs.
- SOC/ISO readiness (controls, policy documentation) for enterprise customers.

Contact: kyjahntsmith@gmail.com
