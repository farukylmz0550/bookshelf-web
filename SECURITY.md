# Security

## Reporting a Vulnerability

GitHub issues are **public** — do not post sensitive details (exploit steps,
secrets, user data) there. Three reporting paths, by sensitivity:

1. **Public bug reports (no security impact)** — ordinary GitHub issues.
2. **Security-sensitive vulnerability reports** — GitHub issue tracker with
   the `security` label, describing impact at a high level and omitting
   exploit details that would put self-hosted instances at risk (the reporter
   can share full reproduction steps privately on request).
3. **Highly sensitive reports** (an exploit that would endanger running
   deployments, or anything that should not be visible until fixed) — open an
   issue containing no sensitive details and the maintainer will provide a
   private channel.

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
| latest release (2.10.x) | ✅ |
| < 2.10 | ❌ upgrade |

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
