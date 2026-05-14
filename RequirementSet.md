# Requirements — Notes

_Living document. Update before each deployment to reflect functional changes._
_The deploy script warns if this file hasn't changed since the last deploy tag._

_2026-05-14: Bug fix — notes list blank on Android due to non-standard SQLite date format being parsed incorrectly. No functional requirement changes._

---

## Platform baseline (inherited from std-platform)

Authentication, sessions, admin user management, and GitHub Issues integration are provided by std-platform. See `std-platform/RequirementSet.md`.

---

## Data model

### Notes
- A note has a **type** (`meeting`, `daily`, `general`), a **note_date** (the date the note is about), a **title**, and a **body** (markdown).
- Multiple notes of any type may share the same `note_date` — no uniqueness enforced.
- Notes are full-text indexed (FTS5 on title + body) for search.

### Tasks
- A task has a **title**, **status**, and an optional **due_date**.
- Kanban statuses: `backlog → todo → in_progress → blocked → done | cancelled`.
- A task may be linked to any number of notes (many-to-many via `note_tasks`).
- Deleting a note removes its task links but not the tasks themselves.
- Deleting a task removes it from all notes.

### Tags
- Tags are free-form, case-insensitive strings.
- A note may have any number of tags; tags are created on first use.

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
