'use strict';

process.env.DB_PATH = ':memory:';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

let db;
before(() => { db = require('../../db'); });

describe('Schema — notes', () => {
  it('creates a note', () => {
    const row = db.prepare(
      `INSERT INTO notes (type, note_date, title, body) VALUES (?,?,?,?)`
    ).run('meeting', '2026-05-14', 'Kickoff', 'Some notes');
    assert.ok(row.lastInsertRowid > 0);
  });

  it('rejects an invalid note type', () => {
    assert.throws(() =>
      db.prepare(`INSERT INTO notes (type, note_date, title) VALUES (?,?,?)`)
        .run('invalid', '2026-05-14', 'Bad'),
      /CHECK constraint/
    );
  });
});

describe('Schema — tasks', () => {
  it('creates a task with default status', () => {
    const row = db.prepare(`INSERT INTO tasks (title) VALUES (?)`).run('Write tests');
    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(row.lastInsertRowid);
    assert.equal(task.status, 'backlog');
  });

  it('rejects an invalid task status', () => {
    assert.throws(() =>
      db.prepare(`INSERT INTO tasks (title, status) VALUES (?,?)`).run('Bad', 'wip'),
      /CHECK constraint/
    );
  });
});

describe('Schema — note_tasks', () => {
  it('links a task to a note and cascades on note delete', () => {
    const noteId = db.prepare(
      `INSERT INTO notes (type, note_date, title) VALUES ('daily','2026-05-14','Daily')`
    ).run().lastInsertRowid;
    const taskId = db.prepare(`INSERT INTO tasks (title) VALUES (?)`).run('Linked task').lastInsertRowid;

    db.prepare(`INSERT INTO note_tasks (note_id, task_id) VALUES (?,?)`).run(noteId, taskId);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM note_tasks WHERE note_id=?`).get(noteId).n, 1);

    db.prepare(`DELETE FROM notes WHERE id=?`).run(noteId);
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM note_tasks WHERE note_id=?`).get(noteId).n, 0);
  });
});

describe('Schema — tags', () => {
  it('stores tags case-insensitively', () => {
    db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`).run('ProjectAlpha');
    db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`).run('projectalpha');
    const count = db.prepare(`SELECT COUNT(*) AS n FROM tags WHERE name='ProjectAlpha' COLLATE NOCASE`).get().n;
    assert.equal(count, 1);
  });
});

describe('Schema — FTS5', () => {
  it('finds a note by body keyword', () => {
    db.prepare(
      `INSERT INTO notes (type, note_date, title, body) VALUES ('general','2026-05-14','FTS Test','blockchain synergy pivot')`
    ).run();
    const results = db.prepare(`SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?`).all('synergy');
    assert.ok(results.length > 0);
  });

  it('removes note from FTS index on delete', () => {
    const id = db.prepare(
      `INSERT INTO notes (type, note_date, title, body) VALUES ('general','2026-05-14','Temp','uniqueword99')`
    ).run().lastInsertRowid;
    db.prepare(`DELETE FROM notes WHERE id=?`).run(id);
    const results = db.prepare(`SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?`).all('uniqueword99');
    assert.equal(results.length, 0);
  });
});
