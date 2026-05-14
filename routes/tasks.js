'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');

const VALID_STATUSES = new Set(['backlog','todo','in_progress','blocked','done','cancelled']);

// GET /api/tasks?status=active|done|cancelled|backlog|todo|in_progress|blocked
router.get('/', (req, res) => {
  const { status } = req.query;
  let rows;
  if (status === 'active') {
    rows = db.prepare(`
      SELECT t.*, COUNT(nt.note_id) AS note_count
      FROM tasks t LEFT JOIN note_tasks nt ON nt.task_id = t.id
      WHERE t.status IN ('backlog','todo','in_progress','blocked')
      GROUP BY t.id ORDER BY t.updated_at DESC
    `).all();
  } else if (VALID_STATUSES.has(status)) {
    rows = db.prepare(`
      SELECT t.*, COUNT(nt.note_id) AS note_count
      FROM tasks t LEFT JOIN note_tasks nt ON nt.task_id = t.id
      WHERE t.status = ?
      GROUP BY t.id ORDER BY t.updated_at DESC
    `).all(status);
  } else {
    rows = db.prepare(`
      SELECT t.*, COUNT(nt.note_id) AS note_count
      FROM tasks t LEFT JOIN note_tasks nt ON nt.task_id = t.id
      GROUP BY t.id ORDER BY t.updated_at DESC
    `).all();
  }
  res.json(rows);
});

// POST /api/tasks
router.post('/', express.json(), (req, res) => {
  const { title, status = 'backlog', due_date = null } = req.body;
  if (!title?.trim())              return res.status(400).json({ error: 'title required' });
  if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid status' });

  const result = db.prepare(
    `INSERT INTO tasks (title, status, due_date) VALUES (?, ?, ?)`
  ).run(title.trim(), status, due_date || null);

  res.status(201).json(db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(result.lastInsertRowid));
});

// GET /api/tasks/:id/notes — list notes linked to this task
router.get('/:id/notes', (req, res) => {
  const task = db.prepare(`SELECT id FROM tasks WHERE id = ?`).get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const notes = db.prepare(`
    SELECT n.id, n.type, n.note_date, n.title FROM notes n
    JOIN note_tasks nt ON nt.note_id = n.id
    WHERE nt.task_id = ?
    ORDER BY n.note_date DESC
  `).all(req.params.id);

  res.json(notes);
});

// PATCH /api/tasks/:id
router.patch('/:id', express.json(), (req, res) => {
  const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const title    = req.body.title    != null ? String(req.body.title)  : task.title;
  const status   = req.body.status   ?? task.status;
  const due_date = 'due_date' in req.body ? req.body.due_date : task.due_date;

  if (!title.trim())               return res.status(400).json({ error: 'title required' });
  if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid status' });

  db.prepare(
    `UPDATE tasks SET title=?, status=?, due_date=?, updated_at=datetime('now') WHERE id=?`
  ).run(title.trim(), status, due_date || null, req.params.id);

  res.json(db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id));
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare(`DELETE FROM tasks WHERE id = ?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
