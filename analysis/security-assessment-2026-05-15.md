# Security Assessment — notes.onemorepeppy.com

**Date:** 2026-05-15  
**Scope:** notes.onemorepeppy.com — authentication, data access, XSS, infrastructure  
**Status:** Fixed issue found; remaining items documented with mitigations

---

## Summary

One exploitable vulnerability was found and fixed during this assessment. The remaining items are known limitations of the architecture with acceptable mitigations for the current use case.

---

## Fixed: Stored XSS via markdown rendering

**Severity:** High (for multi-user deployments)  
**Status:** Fixed — deployed 2026-05-15

`marked.js` passes raw HTML through unchanged. Note bodies containing payloads like `<img src=x onerror="...">` were rendered and executed when any user viewed the note. In a single-user deployment this is self-harm only, but the admin panel allows adding users, making this a real cross-user attack vector.

**Fix:** Wrapped all `marked.parse()` calls with `DOMPurify.sanitize()` in `noteDetail.js` and `noteEditor.js`. DOMPurify strips event handlers and dangerous attributes while preserving valid HTML. A formal rule was added to `std-platform/CLAUDE.md` requiring DOMPurify for any `innerHTML` assignment of user-supplied HTML content.

**Verified:** `<img src=x onerror=alert(1)>` in a note body — `onerror` attribute is now stripped before reaching the DOM.

---

## Authentication boundary — verified secure

All API endpoints return 401 without a valid session. Verified live against the deployed app:

| Endpoint | Unauthenticated response |
|---|---|
| `GET /api/notes` | 401 |
| `GET /api/notes/:id` | 401 |
| `GET /api/notes/search` | 401 |
| `GET /api/tasks` | 401 |
| `GET /api/tags` | 401 |
| `GET /api/auth/me` | 401 |

The auth guard (`requireAuth`) is applied as platform middleware before all project routes. Project code does not need to implement auth independently.

---

## Platform code audit — clean

`std-platform/public/admin.js` and `todo.js` were audited for raw `innerHTML` usage. All user-controlled fields (email addresses, todo titles, notes fields, GitHub URLs) are passed through `escHtml()` before interpolation. No vulnerabilities found.

---

## Known risks and mitigations

### Email account is the authentication root of trust
OTP codes are sent to the owner's email. Compromise of the email account grants app access. **Mitigation:** Google 2FA on the email account. The 10-minute OTP expiry limits the attack window.

### 90-day session duration
A stolen session cookie remains valid for 90 days with no forced re-auth. **Mitigation:** The cookie is `httpOnly` (not readable by JS), `secure` (HTTPS only in production), and `sameSite: lax`. Theft requires OS-level access or physical device compromise, not a web attack.

### No OTP rate limiting
The OTP request endpoint has no rate limiting. An attacker who knows the email address can trigger unlimited OTP sends. This is a nuisance (inbox spam) rather than a security breach — a 6-digit code expiring in 10 minutes gives ~1-in-a-million odds per attempt. **Mitigation:** none currently; acceptable for now.

### Data at rest is unencrypted
The SQLite database is stored in plaintext in a Docker named volume on the VPS. Root access to the VPS (via Vultr account compromise or SSH key theft) exposes all note content. **Mitigation:** SSH key auth only (no password), SSH key stored locally, Vultr account protected by 2FA.

### Cloudflare terminates TLS
Traffic is proxied through Cloudflare, which can read request and response bodies in plaintext. **Mitigation:** Acceptable for the current content sensitivity. For highly sensitive material, consider switching Cloudflare to DNS-only mode and managing certs directly (loses DDoS/CDN benefit).

### DB backup files are plaintext
The deploy script snapshots the database to `data/backups/` before each deploy. These files contain all note content unencrypted. They are not committed to git and not served statically, but they live on the VPS alongside the live database. **Mitigation:** none currently; same risk surface as the live database.

---

## What is not a concern

- **SQL injection** — all queries use `better-sqlite3` prepared statements with `?` placeholders throughout
- **CSRF** — session cookie is `sameSite: lax`; no state-changing GET endpoints
- **Path traversal** — Express static middleware is not vulnerable; `data/` is outside `public/`
- **Database file as static asset** — `data/app.db` has no path into the static file server; verified with HTTP requests
- **Express version fingerprinting** — `x-powered-by` header is disabled

---

## Recommended next steps

See GitHub issue #9 for a proposal to formalise periodic and on-deployment security checks.
