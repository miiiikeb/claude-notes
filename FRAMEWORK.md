# Framework Reference — Notes

**App name:** Notes
**Internal name:** notes
**URL:** https://notes.onemorepeppy.com
**Repo:** https://github.com/miiiikeb/claude-notes
**Last updated:** _(update this line when framework sections change)_

---

> This document is the authoritative technical reference for **this project's** framework additions.
> For platform-level architecture (auth, admin, session, design system), see `std-platform/FRAMEWORK.md`.

---

## Architecture

### Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (Alpine Docker) |
| Server | Express 4 via `std-platform/server.js` → `createApp()` |
| Database | SQLite via better-sqlite3 — WAL mode, foreign keys ON |
| Frontend | Vanilla JS SPA — no build step, one `.js` file per page |
| Auth | Email OTP via Nodemailer → Migadu SMTP (std-platform) |
| Sessions | SQLite store (connect-sqlite3), 90-day cookies (std-platform) |
| Container | Docker Compose — single service, named volume |
| Proxy | Nginx (VPS) → Cloudflare (DNS + TLS) |

### File structure

```
server.js              Thin wrapper — createApp() + project routes
db.js                  Thin wrapper — imports std-platform db + project tables
routes/
  (project routes here)
public/
  index.html           SPA shell — nav, page sections, confirm modal, toast
  home.js              Home page starter (replace with project content)
  (project page scripts)
std-platform/          Git submodule — platform runtime (read-only)
deploy-lib/            Git submodule — deploy/rollback scripts (read-only)
scripts/
  deploy.sh            Sources deploy.config.sh + deploy-lib/deploy.sh
  rollback.sh          Sources deploy.config.sh + deploy-lib/rollback.sh
  deploy.config.sh     Project-specific deploy configuration
deploy/
  nginx.conf           Nginx reverse proxy config
  terraform/           Cloudflare DNS + origin cert provisioning
data/                  Runtime — SQLite DB + sessions + backups (not committed)
FRAMEWORK.md           This file
RequirementSet.md      Living requirements doc
```

---

## Database

**File:** `data/app.db` (Docker volume: `notes_app-data`)
**Sessions:** `data/sessions.db`

### Schema

_Platform tables (users, otp_tokens) are created by std-platform/db.js._

| Table | Columns | Purpose |
|---|---|---|
| _(add project tables here)_ | | |

### Conventions
- Add tables in `db.js` using `CREATE TABLE IF NOT EXISTS`
- Schema changes via `ALTER TABLE` (no migration system — intentional)
- Use `db.prepare(...).run/get/all()` — never raw string queries with user input

---

## API

### Platform endpoints (from std-platform — see std-platform/FRAMEWORK.md)
Auth, admin/users, admin/todo are all handled by std-platform.

### Project endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| _(add project endpoints here)_ | | | |

---

## Deployment

### Infrastructure

| Resource | Value |
|---|---|
| VPS IP | 45.76.126.189 |
| App directory | `/opt/notes/` |
| DB volume | `/var/lib/docker/volumes/notes_app-data/_data/app.db` |
| Container | `notes-app-1` |
| Live URL | https://notes.onemorepeppy.com |
| Host port | 3005 |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `APP_NAME` | Yes | Display name in OTP emails |
| `ADMIN_EMAIL` | No | Seeded as admin (default: miiiikeb@gmail.com) |
| `ALLOWED_EMAILS` | Yes | Comma-separated login emails |
| `SESSION_SECRET` | Prod | Session signing key |
| `SMTP_HOST` | Prod | SMTP hostname (unset = console dev mode) |
| `SMTP_PORT` | Prod | SMTP port (default: 465) |
| `SMTP_USER` | Prod | SMTP sender address |
| `SMTP_PASSWORD` | Prod | SMTP password |
| `GITHUB_TOKEN` | Optional | GitHub PAT for Issues integration |
| `GH_REPO` | Optional | GitHub repo `owner/repo` for Issues |
| `COMPOSE_PROJECT_NAME` | VPS | Must equal `notes` |
