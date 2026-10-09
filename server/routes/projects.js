'use strict';

const express = require('express');
const archiver = require('archiver');
const projectService = require('../services/projectService');
const { getOwnerKey } = require('../services/ownerService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    const list = await projectService.listProjects(ownerKey);
    res.json({ projects: list });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    const { name, description } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }
    const project = await projectService.createProject(ownerKey, name.trim().slice(0, 120), String(description || '').slice(0, 500));
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    const project = await projectService.getProject(ownerKey, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/files', async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    const { path: filePath, content } = req.body || {};
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'File path is required.' });
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'File content must be a string.' });
    }
    if (content.length > 500000) {
      return res.status(413).json({ error: 'File too large (max 500 KB).' });
    }
    const file = await projectService.upsertFile(ownerKey, req.params.id, filePath, content);
    res.json({ file });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/files', async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path query parameter is required.' });
    await projectService.deleteFile(ownerKey, req.params.id, filePath);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/download', async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    const project = await projectService.getProject(ownerKey, req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(project.name)}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => next(err));
    archive.pipe(res);

    for (const f of project.files) {
      archive.append(f.content, { name: f.path });
    }
    if (!project.files.length) {
      archive.append(`# ${project.name}\n\n(No files yet.)\n`, { name: 'README.md' });
    }
    archive.finalize();
  } catch (err) {
    next(err);
  }
});

function sanitizeFilename(name) {
  return String(name).replace(/[^a-z0-9_\-]+/gi, '_').slice(0, 60) || 'project';
}

module.exports = router;
