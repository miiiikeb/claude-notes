# Requirements — Notes

_2026-05-15: Security fix — markdown output is now sanitized via DOMPurify before rendering to prevent stored XSS. No functional requirement changes._

_2026-05-16: Bug fix — task status select was rendering full-width on the Tasks page (and in note detail task rows) due to the platform's unscoped `select { width: 100% }` rule not being overridden. Fixed by adding `width: auto` to `.task-status-select` and the add-task form select. No functional requirement changes._

_Living document. Update before each deployment to reflect functional changes._
_The deploy script warns if this file hasn't changed since the last deploy tag._

_2026-05-14: Bug fix — notes list blank on Android due to non-standard SQLite date format being parsed incorrectly. No functional requirement changes._
_2026-05-14: Bug fix — stale cached JS on Android Edge caused notes to silently fail. Added content-hash cache busting to all project JS/CSS. No functional requirement changes._

---

## Platform baseline (inherited from std-platform)

Authentication, sessions, admin user management, and GitHub Issues integration are provided by std-platform. See `std-platform/RequirementSet.md`.

---

## Data model

### Notes
- A note has a **type** (`meeting`, `daily`, `general`), a **note_date** (the date the note is about), a **title**, a **body**, and a **format** (`md` or `html`).
- New notes default to `html` format (rich text editor). Existing notes retain their `md` format until explicitly switched.
- Multiple notes of any type may share the same `note_date` — no uniqueness enforced.
- Notes are full-text indexed (FTS5 on title + body) for search.

### Tasks
- A task has a **title**, **status**, and an optional **due_date**.
- Kanban statuses: `backlog → todo → in_progress → blocked → done | cancelled`.
- A task may be linked to any number of notes (many-to-many via `note_tasks`).
- Deleting a note removes its task links but not the tasks themselves.
- Deleting a task removes it from all notes.

### Tags
- Tags are free-form strings, stored lowercase (case-insensitive).
- A note may have any number of tags; tags are created on first use.
- Tags can be added and removed from the note detail view and the note editor (edit mode only).
- Tag input accepts text and confirms on Enter; an autocomplete list shows existing tags.
- The notes list shows tag chips above the list; clicking a chip filters by that tag.
- Tag and type filters can be combined.

---

## Note editor

- The note editor supports two modes: **Rich Text** (default) and **Markdown**.
- **Rich Text mode** uses the Quill editor with a formatting toolbar (headings, bold, italic, underline, strikethrough, blockquote, code block, ordered/unordered lists, links, clear formatting).
- **Markdown mode** uses a plain-text textarea. An optional split preview pane can be toggled on/off; preview is off by default and not available in rich text mode.
- A **mode toggle button** in the editor toolbar switches between modes:
  - Rich Text → Markdown: requires confirmation (formatting may be lost); body is converted using Turndown.
  - Markdown → Rich Text: converts body using marked.js; no confirmation needed.
- The note's `format` field (`md` or `html`) is saved with the body on each save. Opening a note reopens it in the mode matching its stored format.
- Ctrl/Cmd+S saves from either mode.

---

## Search

- A search bar at the top of the Notes list page allows searching across all note titles and bodies.
- Search is debounced (300ms) and fires as-you-type once at least 2 characters are entered.
- Results show each matching note's type badge, note_date, title, and a highlighted snippet of matching body text (matching terms shown in bold amber).
- Results are ordered by FTS5 relevance rank.
- Clicking a result navigates to the note detail view.
- Clearing the search input restores the normal notes list with filter tabs.
- Filter tabs are hidden while a search is active.

---

## Tasks

### Task CRUD
- A task has a **title**, **status**, and an optional **due_date**.
- Kanban statuses: `backlog → todo → in_progress → blocked → done | cancelled`.
- Tasks can be created standalone (not linked to any note) from the Tasks page.
- Tasks can be created and linked inline from a note detail view.
- Deleting a task removes it from all notes; deleting a note removes its task links but not the tasks themselves.

### Note detail — task linking
- The note detail view shows tasks linked to that note.
- "+ Add task" reveals an inline form with title, status (default: backlog), and optional due date; pressing Enter on the title or due date field (or clicking Add) creates and links the task.
- Status and due date fields can be skipped with Tab; only the title is required.
- The status of each linked task can be changed via a dropdown directly in the note detail.
- A × button unlinks a task from the note (the task is not deleted).

### Note editor — task creation
- The note editor shows a Tasks section for existing notes (not shown when creating a new note).
- Linked tasks appear as chips showing the status badge and title; clicking × unlinks the task.
- "+ Add task" reveals the same expanded inline form (title, status, due date) as the detail view.
- New tasks created from the editor are immediately linked to the note.

### Tasks page (standalone)
- A dedicated Tasks page lists all tasks across the app.
- Filter tabs: **All** / **Active** (backlog+todo+in_progress+blocked) / **Done** / **Cancelled**.
- Each task row shows: status dropdown, title, due_date (if set), linked note count badge.
- Clicking + on a task row expands it to show which notes it is linked to (with links to those notes).
- Task status can be updated via the inline dropdown.
- "+ New Task" button reveals an inline create form: title, status selector, optional due date.

---

## Note detail view

- Displays the note title, type badge, and note_date in a header.
- Renders the note body as markdown.
- Edit button navigates to the note editor for the current note.
- Shows a linked tasks section (populated in #5) and a tags section (populated in #8).
- Tags can be added by typing into an inline input (Enter to confirm) and removed with a × button.
- Clicking a note in the list navigates to the detail view.

---

## Note editor

- A note has a type (meeting/daily/general), note_date, title, and a markdown body.
- The editor shows a textarea on the left and a live-rendered markdown preview on the right (split view). The preview can be toggled.
- note_date defaults to today.
- Saving a new note POSTs to the API and updates the URL to the edit URL (`#noteEditor/{id}`).
- Editing an existing note PATCHes the API.
- Ctrl/Cmd+S saves the note.
- The delete button (edit mode only) prompts for confirmation before deleting and returns to the notes list.
- Markdown rendering is client-side via marked.js.

---

## Notes list

- The home page displays all notes ordered by most recently updated first.
- Each note shows its type badge (meeting/daily/general), note_date, title, and a relative updated time.
- Notes can be filtered by type: All, Meeting, Daily, General.
- A "New Note" button navigates to the note editor.

---

## Resolved Issues

_None yet._
