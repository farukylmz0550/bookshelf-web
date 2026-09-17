# Security

## Reporting a Vulnerability

GitHub issues are **public** — do not post sensitive details (exploit steps,
secrets, user data) there. Two reporting paths, by sensitivity:

1. **Public / low-sensitivity reports** — ordinary GitHub issues (normal bug
   reports, and security reports whose details would not put running
   deployments at risk; describe impact at a high level and omit exploit
   steps).
2. **Highly sensitive reports** (an exploit that would endanger running
   deployments, secrets, or anything that should not be visible until fixed)
   — **contact the maintainer directly by email**:
   [farukylmz0550@gmail.com](mailto:farukylmz0550@gmail.com)

When reporting, please include:

- affected version
- description of the vulnerability
- steps to reproduce
- potential impact
- suggested mitigation, if known

## Supported Versions

Only the latest stable release receives security fixes. Older releases should
be upgraded instead of patched — the database migration system makes upgrades
idempotent (see [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) for backup guidance
before upgrading).

| Version | Security fixes |
| --- | --- |
| latest release (3.0.x) | ✅ |
| < 3.0 | ❌ upgrade |

## Scope

Security reports may include:

- authentication and authorization
- session management
- password and TOTP handling
- server actions
- file imports
- database access
- dependency vulnerabilities
- Docker/deployment configuration

## Out of Scope

- Self-hosting misconfigurations (weak `NEXTAUTH_SECRET`, missing HTTPS,
  publicly exposed admin URLs) — see [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)
  for hardening guidance.
- Behavior that only appears with `NODE_ENV=development` (throttles disabled).
- Bugs without a security impact — open a normal GitHub issue instead.

## Disclosure

Fixes are released with the next stable version. Please allow a reasonable
window between the report and a coordinated public disclosure; the reporter
will be credited in the release notes if they wish.
