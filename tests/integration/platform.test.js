'use strict';

process.env.DB_PATH = ':memory:';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const app = require('../../server');

describe('Platform — smoke tests', () => {
  it('serves the SPA shell for unauthenticated root requests', async () => {
    const res = await supertest(app).get('/');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
  });

  it('/api/auth/me returns 401 when not logged in', async () => {
    const res = await supertest(app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  it('login page is accessible', async () => {
    const res = await supertest(app).get('/login');
    assert.equal(res.status, 200);
  });
});
