'use strict';

const { callChat } = require('./aiService');

function isConfigured() {
  return Boolean(process.env.AI_API_KEY && (process.env.AI_VISION_MODEL || process.env.AI_MODEL));
}

async function analyzeImages({ prompt, images, history }) {
  if (!isConfigured()) {
    const err = new Error('Vision model is not configured. Set AI_VISION_MODEL and AI_API_KEY.');
    err.status = 503;
    throw err;
  }
  const system =
    'You are CodePilot AI analyzing screenshots for a developer. ' +
    'Describe what is visible, identify the likely issue or UI pattern, propose fixes, and provide corrected code when appropriate. ' +
    'If the image lacks enough information, ask for the missing code, error message, or additional screenshot.';
  const { content } = await callChat({
    system,
    history: history || [],
    userText: prompt || 'Analyze this image.',
    images,
    model: process.env.AI_VISION_MODEL || process.env.AI_MODEL,
    stream: false,
  });
  return content;
}

module.exports = { isConfigured, analyzeImages };
