'use strict';

const express = require('express');
const convService = require('../services/conversationService');
const { getOwnerKey } = require('../services/ownerService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    const list = await convService.listConversations(ownerKey);
    res.json({ conversations: list });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    const { title } = req.body || {};
    const conv = await convService.createConversation(ownerKey, String(title || 'New chat').slice(0, 80));
    res.status(201).json({ conversation: conv });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    const conv = await convService.getConversation(ownerKey, req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    res.json({ conversation: conv });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    const { title } = req.body || {};
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required.' });
    }
    await convService.renameConversation(ownerKey, req.params.id, title.slice(0, 120));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const ownerKey = getOwnerKey(req);
    await convService.deleteConversation(ownerKey, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
