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
  const code  = 'tsk001';
  db.prepare('DELETE FROM otp_tokens WHERE email = ?').run(email);
  db.prepare('INSERT INTO otp_tokens (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, Date.now() + 600_000);
  await agent.post('/api/auth/verify-otp').send({ email, code });
  return agent;
}

describe('Tasks API', () => {
  let agent;
  before(async () => { agent = await getAgent(); });

  it('returns empty task list initially', async () => {
    const res = await agent.get('/api/tasks');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('creates a task with default status', async () => {
    const res = await agent.post('/api/tasks').send({ title: 'Write tests' });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'Write tests');
    assert.equal(res.body.status, 'backlog');
  });

  it('rejects task with empty title', async () => {
    const res = await agent.post('/api/tasks').send({ title: '' });
    assert.equal(res.status, 400);
  });

  it('rejects task with invalid status', async () => {
    const res = await agent.post('/api/tasks').send({ title: 'Bad', status: 'in-flight' });
    assert.equal(res.status, 400);
  });

  it('patches task status', async () => {
    const create = await agent.post('/api/tasks').send({ title: 'Patch me' });
    const res = await agent.patch(`/api/tasks/${create.body.id}`).send({ status: 'done' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'done');
  });

  it('filters tasks by active status', async () => {
    const res = await agent.get('/api/tasks?status=active');
    assert.equal(res.status, 200);
    const active = new Set(['backlog','todo','in_progress','blocked']);
    res.body.forEach(t => assert.ok(active.has(t.status)));
  });

  it('deletes a task', async () => {
    const create = await agent.post('/api/tasks').send({ title: 'Delete me' });
    const del = await agent.delete(`/api/tasks/${create.body.id}`);
    assert.equal(del.status, 204);
    const list = await agent.get('/api/tasks');
    assert.ok(!list.body.find(t => t.id === create.body.id));
  });

  it('includes note_count in task list', async () => {
    const res = await agent.get('/api/tasks');
    assert.equal(res.status, 200);
    assert.ok(res.body.every(t => 'note_count' in t));
  });

  it('links an existing task to a note', async () => {
    const note = await agent.post('/api/notes').send({ type: 'meeting', note_date: '2026-05-14', title: 'Meeting' });
    const task = await agent.post('/api/tasks').send({ title: 'Action item' });
    const link = await agent.post(`/api/notes/${note.body.id}/tasks`).send({ task_id: task.body.id });
    assert.equal(link.status, 201);
    const tasks = await agent.get(`/api/notes/${note.body.id}/tasks`);
    assert.equal(tasks.status, 200);
    assert.ok(tasks.body.find(t => t.id === task.body.id));
  });

  it('creates and links task inline from note', async () => {
    const note = await agent.post('/api/notes').send({ type: 'daily', note_date: '2026-05-14', title: 'Daily' });
    const res = await agent.post(`/api/notes/${note.body.id}/tasks`).send({ title: 'Inline task' });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'Inline task');
    const tasks = await agent.get(`/api/notes/${note.body.id}/tasks`);
    assert.ok(tasks.body.find(t => t.title === 'Inline task'));
  });

  it('unlinks task from note without deleting it', async () => {
    const note = await agent.post('/api/notes').send({ type: 'general', note_date: '2026-05-14', title: 'General' });
    const task = await agent.post('/api/tasks').send({ title: 'To unlink' });
    await agent.post(`/api/notes/${note.body.id}/tasks`).send({ task_id: task.body.id });
    const del = await agent.delete(`/api/notes/${note.body.id}/tasks/${task.body.id}`);
    assert.equal(del.status, 204);
    const tasks = await agent.get(`/api/notes/${note.body.id}/tasks`);
    assert.ok(!tasks.body.find(t => t.id === task.body.id));
    const allTasks = await agent.get('/api/tasks');
    assert.ok(allTasks.body.find(t => t.id === task.body.id));
  });

  it('lists notes linked to a task', async () => {
    const note = await agent.post('/api/notes').send({ type: 'meeting', note_date: '2026-05-14', title: 'Linked Note' });
    const task = await agent.post('/api/tasks').send({ title: 'Task with notes' });
    await agent.post(`/api/notes/${note.body.id}/tasks`).send({ task_id: task.body.id });
    const notes = await agent.get(`/api/tasks/${task.body.id}/notes`);
    assert.equal(notes.status, 200);
    assert.ok(notes.body.find(n => n.id === note.body.id));
  });
});
