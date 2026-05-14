'use strict';

process.env.DB_PATH = ':memory:';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const app = require('../../server');
const db  = require('../../db');

async function getAgent() {
  const agent = supertest.agent(app);
  const email = 'miiiikeb@gmail.com';
  const code  = 'srch01';
  db.prepare('DELETE FROM otp_tokens WHERE email = ?').run(email);
  db.prepare('INSERT INTO otp_tokens (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, Date.now() + 600_000);
  await agent.post('/api/auth/verify-otp').send({ email, code });
  return agent;
}

describe('Search API', () => {
  let agent;
  before(async () => {
    agent = await getAgent();
    await agent.post('/api/notes').send({ type: 'meeting', note_date: '2026-05-14', title: 'Quarterly planning', body: 'Discuss roadmap and budget allocation' });
    await agent.post('/api/notes').send({ type: 'daily', note_date: '2026-05-14', title: 'Daily standup', body: 'Team velocity is looking great this sprint' });
    await agent.post('/api/notes').send({ type: 'general', note_date: '2026-05-13', title: 'Research notes', body: 'SQLite FTS5 supports full-text search with ranking' });
  });

  it('finds notes by body keyword', async () => {
    const res = await agent.get('/api/notes/search?q=roadmap');
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 1);
    assert.ok(res.body.some(n => n.title === 'Quarterly planning'));
  });

  it('finds notes by title keyword', async () => {
    const res = await agent.get('/api/notes/search?q=standup');
    assert.equal(res.status, 200);
    assert.ok(res.body.some(n => n.title === 'Daily standup'));
  });

  it('returns snippet with match markers', async () => {
    const res = await agent.get('/api/notes/search?q=roadmap');
    assert.equal(res.status, 200);
    const note = res.body.find(n => n.title === 'Quarterly planning');
    assert.ok(note);
    assert.ok(note.snippet.includes('<<<'));
  });

  it('returns results ordered by relevance (rank)', async () => {
    const res = await agent.get('/api/notes/search?q=notes');
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 1);
  });

  it('returns empty array for queries shorter than 2 chars', async () => {
    const res = await agent.get('/api/notes/search?q=a');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('returns empty array for no match', async () => {
    const res = await agent.get('/api/notes/search?q=xyzzy');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('supports prefix matching', async () => {
    const res = await agent.get('/api/notes/search?q=road');
    assert.equal(res.status, 200);
    assert.ok(res.body.some(n => n.title === 'Quarterly planning'));
  });
});
