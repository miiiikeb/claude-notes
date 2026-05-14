'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');

const VALID_TYPES = new Set(['meeting', 'daily', 'general']);

// GET /api/notes?type=meeting|daily|general&tag=name
router.get('/', (req, res) => {
  const { type, tag } = req.query;
  const byType = type && VALID_TYPES.has(type);

  let rows;
  if (tag && byType) {
    rows = db.prepare(`
      SELECT DISTINCT n.id, n.type, n.note_date, n.title, n.updated_at
      FROM notes n JOIN note_tags nt ON nt.note_id = n.id JOIN tags t ON t.id = nt.tag_id
      WHERE n.type = ? AND LOWER(t.name) = LOWER(?) ORDER BY n.updated_at DESC
    `).all(type, tag);
  } else if (tag) {
    rows = db.prepare(`
      SELECT DISTINCT n.id, n.type, n.note_date, n.title, n.updated_at
      FROM notes n JOIN note_tags nt ON nt.note_id = n.id JOIN tags t ON t.id = nt.tag_id
      WHERE LOWER(t.name) = LOWER(?) ORDER BY n.updated_at DESC
    `).all(tag);
  } else if (byType) {
    rows = db.prepare(`SELECT id, type, note_date, title, updated_at FROM notes
                       WHERE type = ? ORDER BY updated_at DESC`).all(type);
  } else {
    rows = db.prepare(`SELECT id, type, note_date, title, updated_at FROM notes
                       ORDER BY updated_at DESC`).all();
  }
  res.json(rows);
});

// POST /api/notes
router.post('/', express.json(), (req, res) => {
  const { type, note_date, title, body = '' } = req.body;
  if (!VALID_TYPES.has(type))  return res.status(400).json({ error: 'Invalid type' });
  if (!note_date)              return res.status(400).json({ error: 'note_date required' });
  if (!title?.trim())          return res.status(400).json({ error: 'title required' });

  const result = db.prepare(
    `INSERT INTO notes (type, note_date, title, body) VALUES (?, ?, ?, ?)`
  ).run(type, note_date, title.trim(), body);

  const note = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(note);
});

// GET /api/notes/search?q=
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  // Tokenize, strip FTS5 special chars, prefix-match the last term
  const terms = q.split(/\s+/).filter(Boolean).map((t, i, arr) => {
    const safe = t.replace(/['"*()^:{}!]/g, '').trim();
    return safe ? (i === arr.length - 1 ? safe + '*' : safe) : null;
  }).filter(Boolean);

  if (!terms.length) return res.json([]);

  try {
    const rows = db.prepare(`
      SELECT n.id, n.type, n.note_date, n.title,
        snippet(notes_fts, 1, '<<<', '>>>', '…', 12) AS snippet
      FROM notes_fts
      JOIN notes n ON n.id = notes_fts.rowid
      WHERE notes_fts MATCH ?
      ORDER BY notes_fts.rank
      LIMIT 50
    `).all(terms.join(' '));
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// GET /api/notes/:id
router.get('/:id', (req, res) => {
  const note = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Not found' });
  res.json(note);
});

// PATCH /api/notes/:id
router.patch('/:id', express.json(), (req, res) => {
  const note = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Not found' });

  const type      = req.body.type      ?? note.type;
  const note_date = req.body.note_date ?? note.note_date;
  const title     = req.body.title     ?? note.title;
  const body      = req.body.body      ?? note.body;

  if (!VALID_TYPES.has(type))  return res.status(400).json({ error: 'Invalid type' });
  if (!note_date)              return res.status(400).json({ error: 'note_date required' });
  if (!String(title).trim())   return res.status(400).json({ error: 'title required' });

  db.prepare(
    `UPDATE notes SET type=?, note_date=?, title=?, body=?, updated_at=datetime('now') WHERE id=?`
  ).run(type, note_date, String(title).trim(), body, req.params.id);

  res.json(db.prepare(`SELECT * FROM notes WHERE id = ?`).get(req.params.id));
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare(`DELETE FROM notes WHERE id = ?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

const VALID_STATUSES = new Set(['backlog','todo','in_progress','blocked','done','cancelled']);

// GET /api/notes/:id/tasks
router.get('/:id/tasks', (req, res) => {
  const note = db.prepare(`SELECT id FROM notes WHERE id = ?`).get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Not found' });
  const tasks = db.prepare(`
    SELECT t.* FROM tasks t
    JOIN note_tasks nt ON nt.task_id = t.id
    WHERE nt.note_id = ?
    ORDER BY t.updated_at DESC
  `).all(req.params.id);
  res.json(tasks);
});

// POST /api/notes/:id/tasks — link existing task (task_id) or create+link new task (title)
router.post('/:id/tasks', express.json(), (req, res) => {
  const note = db.prepare(`SELECT id FROM notes WHERE id = ?`).get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Not found' });

  let taskId = req.body.task_id;
  if (taskId) {
    if (!db.prepare(`SELECT id FROM tasks WHERE id = ?`).get(taskId))
      return res.status(404).json({ error: 'Task not found' });
  } else {
    const { title, status = 'backlog', due_date = null } = req.body;
    if (!title?.trim())              return res.status(400).json({ error: 'task_id or title required' });
    if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid status' });
    const r = db.prepare(`INSERT INTO tasks (title, status, due_date) VALUES (?, ?, ?)`)
      .run(title.trim(), status, due_date || null);
    taskId = r.lastInsertRowid;
  }

  db.prepare(`INSERT OR IGNORE INTO note_tasks (note_id, task_id) VALUES (?, ?)`)
    .run(req.params.id, taskId);

  res.status(201).json(db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId));
});

// DELETE /api/notes/:id/tasks/:taskId — unlink only (task is not deleted)
router.delete('/:id/tasks/:taskId', (req, res) => {
  db.prepare(`DELETE FROM note_tasks WHERE note_id = ? AND task_id = ?`)
    .run(req.params.id, req.params.taskId);
  res.status(204).end();
});

// GET /api/notes/:id/tags
router.get('/:id/tags', (req, res) => {
  const note = db.prepare(`SELECT id FROM notes WHERE id = ?`).get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Not found' });
  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN note_tags nt ON nt.tag_id = t.id
    WHERE nt.note_id = ? ORDER BY t.name
  `).all(req.params.id);
  res.json(tags);
});

// POST /api/notes/:id/tags — add tag by name; creates tag on first use (stored lowercase)
router.post('/:id/tags', express.json(), (req, res) => {
  const note = db.prepare(`SELECT id FROM notes WHERE id = ?`).get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Not found' });

  const name = req.body.name?.trim().toLowerCase();
  if (!name) return res.status(400).json({ error: 'name required' });

  let tag = db.prepare(`SELECT * FROM tags WHERE name = ?`).get(name);
  if (!tag) {
    const r = db.prepare(`INSERT INTO tags (name) VALUES (?)`).run(name);
    tag = db.prepare(`SELECT * FROM tags WHERE id = ?`).get(r.lastInsertRowid);
  }

  db.prepare(`INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)`)
    .run(req.params.id, tag.id);

  res.status(201).json(tag);
});

// DELETE /api/notes/:id/tags/:tagId — unlink tag from note
router.delete('/:id/tags/:tagId', (req, res) => {
  db.prepare(`DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?`)
    .run(req.params.id, req.params.tagId);
  res.status(204).end();
});

module.exports = router;
