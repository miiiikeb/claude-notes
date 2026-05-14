'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');

const VALID_TYPES = new Set(['meeting', 'daily', 'general']);

// GET /api/notes?type=meeting|daily|general
router.get('/', (req, res) => {
  const { type } = req.query;
  const rows = type && VALID_TYPES.has(type)
    ? db.prepare(`SELECT id, type, note_date, title, updated_at FROM notes
                  WHERE type = ? ORDER BY updated_at DESC`).all(type)
    : db.prepare(`SELECT id, type, note_date, title, updated_at FROM notes
                  ORDER BY updated_at DESC`).all();
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

module.exports = router;
