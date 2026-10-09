'use strict';

const crypto = require('crypto');
const path = require('path');
const { isDatabaseEnabled, query } = require('../database/db');

const mem = new Map(); // projectId -> { id, ownerKey, name, description, files: Map(path -> content) }

function uid() {
  return crypto.randomUUID();
}

function safePath(p) {
  const norm = path.posix.normalize(String(p).replace(/\\/g, '/'));
  if (norm.startsWith('..') || norm.startsWith('/') || norm.includes('\0')) {
    const err = new Error('Invalid file path');
    err.status = 400;
    throw err;
  }
  return norm;
}

async function createProject(ownerKey, name, description = '') {
  const id = uid();
  const now = new Date().toISOString();
  if (isDatabaseEnabled()) {
    await query(
      'INSERT INTO projects (id, owner_key, name, description, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$5)',
      [id, ownerKey, name, description, now]
    );
  } else {
    mem.set(id, { id, ownerKey, name, description, createdAt: now, updatedAt: now, files: new Map() });
  }
  return { id, ownerKey, name, description, createdAt: now, updatedAt: now };
}

async function listProjects(ownerKey) {
  if (isDatabaseEnabled()) {
    const { rows } = await query(
      'SELECT id, name, description, created_at AS "createdAt", updated_at AS "updatedAt" ' +
        'FROM projects WHERE owner_key = $1 ORDER BY updated_at DESC',
      [ownerKey]
    );
    return rows;
  }
  return [...mem.values()].filter((p) => p.ownerKey === ownerKey);
}

async function getProject(ownerKey, id) {
  if (isDatabaseEnabled()) {
    const { rows } = await query(
      'SELECT id, name, description, created_at AS "createdAt", updated_at AS "updatedAt" FROM projects WHERE id = $1 AND owner_key = $2',
      [id, ownerKey]
    );
    if (!rows[0]) return null;
    const files = await query(
      'SELECT path, content FROM project_files WHERE project_id = $1 ORDER BY path ASC',
      [id]
    );
    return { ...rows[0], files: files.rows };
  }
  const p = mem.get(id);
  if (!p || p.ownerKey !== ownerKey) return null;
  return { ...p, files: [...p.files.entries()].map(([path, content]) => ({ path, content })) };
}

async function upsertFile(ownerKey, projectId, filePath, content) {
  const safe = safePath(filePath);
  const now = new Date().toISOString();
  if (isDatabaseEnabled()) {
    const owner = await query('SELECT 1 FROM projects WHERE id = $1 AND owner_key = $2', [projectId, ownerKey]);
    if (!owner.rows.length) {
      const err = new Error('Project not found');
      err.status = 404;
      throw err;
    }
    await query(
      `INSERT INTO project_files (id, project_id, path, content, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$5)
       ON CONFLICT (project_id, path) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at`,
      [uid(), projectId, safe, content, now]
    );
  } else {
    const p = mem.get(projectId);
    if (!p || p.ownerKey !== ownerKey) {
      const err = new Error('Project not found');
      err.status = 404;
      throw err;
    }
    p.files.set(safe, content);
    p.updatedAt = now;
  }
  return { path: safe, content };
}

async function deleteFile(ownerKey, projectId, filePath) {
  const safe = safePath(filePath);
  if (isDatabaseEnabled()) {
    await query(
      'DELETE FROM project_files USING projects WHERE project_files.project_id = projects.id AND projects.id = $1 AND projects.owner_key = $2 AND project_files.path = $3',
      [projectId, ownerKey, safe]
    );
  } else {
    const p = mem.get(projectId);
    if (p && p.ownerKey === ownerKey) {
      p.files.delete(safe);
      p.updatedAt = new Date().toISOString();
    }
  }
}

module.exports = { createProject, listProjects, getProject, upsertFile, deleteFile };
