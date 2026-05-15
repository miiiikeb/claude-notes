'use strict';

const db = require('./std-platform/db');

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL CHECK(type IN ('meeting','daily','general')),
    note_date   TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'backlog'
                  CHECK(status IN ('backlog','todo','in_progress','blocked','done','cancelled')),
    due_date    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS note_tasks (
    note_id     INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, task_id)
  );

  CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE COLLATE NOCASE
  );

  CREATE TABLE IF NOT EXISTS note_tags (
    note_id  INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title, body,
    content=notes,
    content_rowid=id
  );

  CREATE TRIGGER IF NOT EXISTS notes_fts_insert AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
  END;

  CREATE TRIGGER IF NOT EXISTS notes_fts_update AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
    INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
  END;

  CREATE TRIGGER IF NOT EXISTS notes_fts_delete AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
  END;
`);

// Additive schema evolution — ignore if column already exists
try { db.exec(`ALTER TABLE notes ADD COLUMN format TEXT NOT NULL DEFAULT 'md'`); } catch {}

module.exports = db;
