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
  const code  = 'nte001';
  db.prepare('DELETE FROM otp_tokens WHERE email = ?').run(email);
  db.prepare('INSERT INTO otp_tokens (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, Date.now() + 600_000);
  await agent.post('/api/auth/verify-otp').send({ email, code });
  return agent;
}

describe('Notes API', () => {
  let agent;
  before(async () => { agent = await getAgent(); });

  it('returns empty list initially', async () => {
    const res = await agent.get('/api/notes');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('creates a meeting note', async () => {
    const res = await agent.post('/api/notes').send({ type: 'meeting', note_date: '2026-05-14', title: 'Kickoff' });
    assert.equal(res.status, 201);
    assert.equal(res.body.type, 'meeting');
    assert.equal(res.body.title, 'Kickoff');
  });

  it('creates a daily note', async () => {
    const res = await agent.post('/api/notes').send({ type: 'daily', note_date: '2026-05-14', title: 'Daily standup' });
    assert.equal(res.status, 201);
  });

  it('lists notes ordered by updated_at desc', async () => {
    const res = await agent.get('/api/notes');
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 2);
    assert.ok(res.body[0].updated_at >= res.body[1].updated_at);
  });

  it('filters by type', async () => {
    const res = await agent.get('/api/notes?type=meeting');
    assert.equal(res.status, 200);
    assert.ok(res.body.every(n => n.type === 'meeting'));
  });

  it('rejects invalid type on create', async () => {
    const res = await agent.post('/api/notes').send({ type: 'invalid', note_date: '2026-05-14', title: 'Bad' });
    assert.equal(res.status, 400);
  });

  it('rejects missing title', async () => {
    const res = await agent.post('/api/notes').send({ type: 'general', note_date: '2026-05-14', title: '' });
    assert.equal(res.status, 400);
  });

  it('fetches a single note', async () => {
    const created = await agent.post('/api/notes').send({ type: 'general', note_date: '2026-05-14', title: 'Solo', body: 'hello' });
    const res = await agent.get(`/api/notes/${created.body.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.body, 'hello');
  });

  it('updates a note', async () => {
    const created = await agent.post('/api/notes').send({ type: 'general', note_date: '2026-05-14', title: 'Old title' });
    const res = await agent.patch(`/api/notes/${created.body.id}`).send({ title: 'New title' });
    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'New title');
  });

  it('deletes a note', async () => {
    const created = await agent.post('/api/notes').send({ type: 'general', note_date: '2026-05-14', title: 'Temp' });
    const del = await agent.delete(`/api/notes/${created.body.id}`);
    assert.equal(del.status, 204);
    const get = await agent.get(`/api/notes/${created.body.id}`);
    assert.equal(get.status, 404);
  });

  it('returns 404 for unknown note', async () => {
    const res = await agent.get('/api/notes/99999');
    assert.equal(res.status, 404);
  });
});
