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
  const code  = 'tag001';
  db.prepare('DELETE FROM otp_tokens WHERE email = ?').run(email);
  db.prepare('INSERT INTO otp_tokens (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, Date.now() + 600_000);
  await agent.post('/api/auth/verify-otp').send({ email, code });
  return agent;
}

describe('Tags API', () => {
  let agent, noteId;
  before(async () => {
    agent = await getAgent();
    const note = await agent.post('/api/notes').send({ type: 'meeting', note_date: '2026-05-14', title: 'Tagged note' });
    noteId = note.body.id;
  });

  it('returns empty tag list initially', async () => {
    const res = await agent.get('/api/tags');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('adds a tag to a note (creates on first use)', async () => {
    const res = await agent.post(`/api/notes/${noteId}/tags`).send({ name: 'Project' });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'project');
  });

  it('stores tags lowercase', async () => {
    const res = await agent.get(`/api/notes/${noteId}/tags`);
    assert.equal(res.status, 200);
    assert.ok(res.body.every(t => t.name === t.name.toLowerCase()));
  });

  it('does not duplicate a tag added twice', async () => {
    await agent.post(`/api/notes/${noteId}/tags`).send({ name: 'project' });
    const res = await agent.get(`/api/notes/${noteId}/tags`);
    const projectTags = res.body.filter(t => t.name === 'project');
    assert.equal(projectTags.length, 1);
  });

  it('adds a second tag', async () => {
    const res = await agent.post(`/api/notes/${noteId}/tags`).send({ name: 'work' });
    assert.equal(res.status, 201);
  });

  it('lists all tags with note_count', async () => {
    const res = await agent.get('/api/tags');
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 2);
    assert.ok(res.body.every(t => 'note_count' in t));
  });

  it('removes a tag from a note', async () => {
    const tagsRes = await agent.get(`/api/notes/${noteId}/tags`);
    const tag = tagsRes.body.find(t => t.name === 'work');
    const del = await agent.delete(`/api/notes/${noteId}/tags/${tag.id}`);
    assert.equal(del.status, 204);
    const after = await agent.get(`/api/notes/${noteId}/tags`);
    assert.ok(!after.body.find(t => t.name === 'work'));
  });

  it('rejects adding a tag with empty name', async () => {
    const res = await agent.post(`/api/notes/${noteId}/tags`).send({ name: '' });
    assert.equal(res.status, 400);
  });

  it('filters notes by tag', async () => {
    const note2 = await agent.post('/api/notes').send({ type: 'daily', note_date: '2026-05-14', title: 'Untagged note' });
    const res = await agent.get('/api/notes?tag=project');
    assert.equal(res.status, 200);
    assert.ok(res.body.find(n => n.id === noteId));
    assert.ok(!res.body.find(n => n.id === note2.body.id));
  });

  it('filters notes by tag and type together', async () => {
    const res = await agent.get('/api/notes?tag=project&type=meeting');
    assert.equal(res.status, 200);
    assert.ok(res.body.find(n => n.id === noteId));
    const dailyRes = await agent.get('/api/notes?tag=project&type=daily');
    assert.equal(dailyRes.status, 200);
    assert.ok(!dailyRes.body.find(n => n.id === noteId));
  });
});
