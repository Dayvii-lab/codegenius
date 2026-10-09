'use strict';

const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';

const app = require('../server/server');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(() => {
  server?.close();
});

test('GET /api/health returns ok', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'ok');
  assert.strictEqual(body.name, 'CodePilot AI');
});

test('POST /api/chat without message or images returns 400', async () => {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.strictEqual(res.status, 400);
});

test('POST /api/chat with message but no AI key returns 503', async () => {
  const original = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello' }),
  });
  assert.strictEqual(res.status, 503);

  if (original) process.env.AI_API_KEY = original;
});

test('POST /api/research without query returns 400', async () => {
  const res = await fetch(`${baseUrl}/api/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.strictEqual(res.status, 400);
});

test('POST /api/research without search config returns 503', async () => {
  const originalKey = process.env.SEARCH_API_KEY;
  const originalUrl = process.env.SEARCH_API_URL;
  delete process.env.SEARCH_API_KEY;
  delete process.env.SEARCH_API_URL;

  const res = await fetch(`${baseUrl}/api/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'latest node.js version' }),
  });
  assert.strictEqual(res.status, 503);

  if (originalKey) process.env.SEARCH_API_KEY = originalKey;
  if (originalUrl) process.env.SEARCH_API_URL = originalUrl;
});

test('POST /api/uploads with no files returns 400', async () => {
  const res = await fetch(`${baseUrl}/api/uploads`, { method: 'POST' });
  assert.strictEqual(res.status, 400);
});

test('POST /api/projects without name returns 400', async () => {
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.strictEqual(res.status, 400);
});

test('GET /api/projects returns list', async () => {
  const res = await fetch(`${baseUrl}/api/projects`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.projects));
});

test('GET unknown API route returns 404 JSON', async () => {
  const res = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.strictEqual(res.status, 404);
  const body = await res.json();
  assert.ok(body.error);
});
