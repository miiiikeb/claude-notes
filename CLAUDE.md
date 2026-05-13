# Claude Code Instructions — Notes

@std-platform/CLAUDE.md

## Reading order for new sessions

1. **`std-platform/FRAMEWORK.md`** — platform architecture, API reference, CSS classes. Read for any session involving auth, admin, or frontend utilities.
2. **`std-platform/RequirementSet.md`** — platform-level functional requirements (auth, sessions, admin, Issues).
3. **`FRAMEWORK.md`** — this project's architecture, API routes, DB schema, deployment details.
4. **`RequirementSet.md`** — app-specific functional requirements. Read before starting feature work.
5. This file — operating instructions and rules.

---

## Architecture summary

_Platform architecture conventions (wrappers, assets, update command): see imported `std-platform/CLAUDE.md`._

- `routes/` — project-specific API routes only
- `public/index.html` — project SPA shell (project-owned)
- `public/*.js` — project page modules (IIFE-wrapped, see platform G1)

---

## Adding a new page (checklist)

1. `routes/{page}.js` — Express router
2. `{ path: '/api/{page}', router: require('./routes/{page}') }` in `server.js` routes array
3. `public/{page}.js` — IIFE-wrapped (see platform G1), exports `window.load{Page} = async function() {}`
4. `<section id="page-{name}" class="page" style="display:none">` in `public/index.html` — single-token camelCase ID (see platform G2)
5. `<a href="#{name}" class="nav-link" data-page="{name}">Label</a>` in the nav
6. `<script src="/{page}.js"></script>` in `index.html`
7. Update `FRAMEWORK.md` → File structure, API, DB schema

---

## Keeping FRAMEWORK.md up to date

Update FRAMEWORK.md whenever you make framework-level changes:

| Change | Update in FRAMEWORK.md |
|---|---|
| New page | Routing section; File structure |
| New API endpoint | API section |
| New DB table/column | Database → schema table |
| New env variable | Environment variables table |
| New global utility | Frontend → Global utilities |
| New npm dependency | Architecture → Stack |

---

## Deployment

**ALL deployments must use `./scripts/deploy.sh`.** Never run rsync, docker compose, or manual deploy steps directly.

Before deploying:
1. All changes committed.
2. `RequirementSet.md` updated appropriately:
   - **Feature or behaviour change:** update the relevant section with the new/changed behaviour.
   - **Pure bug fix (no functional change):** add a one-line italic note at the top of the file, e.g. `_YYYY-MM-DD: Bug fix — <one sentence>. No functional requirement changes._` Do not reword existing requirements.

The deploy script enforces (1) and warns on (2). Do not bypass the warning without a valid reason.

---

## VPS
- **IP:** 45.76.126.189
- **SSH:** `ssh -i ~/.ssh/id_ed25519 root@45.76.126.189`
- **App directory:** `/opt/notes/`
- **DB volume:** `/var/lib/docker/volumes/notes_app-data/_data/app.db`
- **Container:** `notes-app-1`
- **Domain:** `notes.onemorepeppy.com`

---

## GitHub Issues shorthand

If the user says **"issues"** with no other context: run `gh issue list --repo miiiikeb/claude-notes`, display open issues.

---

## Key rules

- Schema changes go in `db.js` using `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE`.
- `RequirementSet.md` must be committed before running `deploy.sh`.
