'use strict';

const crypto = require('crypto');
const { isDatabaseEnabled, query } = require('../database/db');

// In-memory fallback store
const mem = new Map(); // conversationId -> { id, ownerKey, title, createdAt, updatedAt, messages: [] }

function uid() {
  return crypto.randomUUID();
}

async function createConversation(ownerKey, title = 'New chat') {
  const id = uid();
  const now = new Date().toISOString();
  if (isDatabaseEnabled()) {
    await query(
      'INSERT INTO conversations (id, owner_key, title, created_at, updated_at) VALUES ($1,$2,$3,$4,$4)',
      [id, ownerKey, title, now]
    );
  } else {
    mem.set(id, { id, ownerKey, title, createdAt: now, updatedAt: now, messages: [] });
  }
  return { id, ownerKey, title, createdAt: now, updatedAt: now };
}

async function listConversations(ownerKey) {
  if (isDatabaseEnabled()) {
    const { rows } = await query(
      'SELECT id, owner_key AS "ownerKey", title, created_at AS "createdAt", updated_at AS "updatedAt" ' +
        'FROM conversations WHERE owner_key = $1 ORDER BY updated_at DESC',
      [ownerKey]
    );
    return rows;
  }
  return [...mem.values()]
    .filter((c) => c.ownerKey === ownerKey)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

async function getConversation(ownerKey, id) {
  if (isDatabaseEnabled()) {
    const { rows } = await query(
      'SELECT id, owner_key AS "ownerKey", title, created_at AS "createdAt", updated_at AS "updatedAt" ' +
        'FROM conversations WHERE id = $1 AND owner_key = $2',
      [id, ownerKey]
    );
    if (!rows[0]) return null;
    const msg = await query(
      'SELECT id, role, content, metadata, created_at AS "createdAt" FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [id]
    );
    return { ...rows[0], messages: msg.rows };
  }
  const c = mem.get(id);
  if (!c || c.ownerKey !== ownerKey) return null;
  return c;
}

async function renameConversation(ownerKey, id, title) {
  const now = new Date().toISOString();
  if (isDatabaseEnabled()) {
    await query('UPDATE conversations SET title = $1, updated_at = $2 WHERE id = $3 AND owner_key = $4', [
      title,
      now,
      id,
      ownerKey,
    ]);
  } else {
    const c = mem.get(id);
    if (c && c.ownerKey === ownerKey) {
      c.title = title;
      c.updatedAt = now;
    }
  }
}

async function deleteConversation(ownerKey, id) {
  if (isDatabaseEnabled()) {
    await query('DELETE FROM conversations WHERE id = $1 AND owner_key = $2', [id, ownerKey]);
  } else {
    const c = mem.get(id);
    if (c && c.ownerKey === ownerKey) mem.delete(id);
  }
}

async function appendMessage(conversationId, role, content, metadata = {}) {
  const id = uid();
  const now = new Date().toISOString();
  if (isDatabaseEnabled()) {
    await query(
      'INSERT INTO messages (id, conversation_id, role, content, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, conversationId, role, content, JSON.stringify(metadata), now]
    );
    await query('UPDATE conversations SET updated_at = $1 WHERE id = $2', [now, conversationId]);
  } else {
    const c = mem.get(conversationId);
    if (c) {
      c.messages.push({ id, role, content, metadata, createdAt: now });
      c.updatedAt = now;
    }
  }
  return { id, role, content, metadata, createdAt: now };
}

async function getHistory(conversationId, limit = 24) {
  if (isDatabaseEnabled()) {
    const { rows } = await query(
      'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2',
      [conversationId, limit]
    );
    return rows.reverse();
  }
  const c = mem.get(conversationId);
  if (!c) return [];
  return c.messages.slice(-limit).map(({ role, content }) => ({ role, content }));
}

module.exports = {
  createConversation,
  listConversations,
  getConversation,
  renameConversation,
  deleteConversation,
  appendMessage,
  getHistory,
};
