'use strict';

const dns = require('dns').promises;
const net = require('net');

function isPrivateIP(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe80')) return true;
    return false;
  }
  return true;
}

async function assertPublicUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    const err = new Error('Invalid URL');
    err.status = 400;
    throw err;
  }
  if (!/^https?:$/.test(u.protocol)) {
    const err = new Error('Only http/https URLs allowed');
    err.status = 400;
    throw err;
  }
  const host = u.hostname;
  if (net.isIP(host)) {
    if (isPrivateIP(host)) {
      const err = new Error('Blocked private address');
      err.status = 400;
      throw err;
    }
    return u;
  }
  const records = await dns.lookup(host, { all: true });
  for (const r of records) {
    if (isPrivateIP(r.address)) {
      const err = new Error('Blocked private address');
      err.status = 400;
      throw err;
    }
  }
  return u;
}

function isConfigured() {
  return Boolean(process.env.SEARCH_API_KEY && process.env.SEARCH_API_URL);
}

async function search(query, { maxResults = 5 } = {}) {
  if (!isConfigured()) {
    const err = new Error('Web search is not configured. Set SEARCH_API_KEY and SEARCH_API_URL.');
    err.status = 503;
    throw err;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(process.env.SEARCH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SEARCH_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const e = new Error(`Search provider responded with ${res.status}: ${text.slice(0, 300)}`);
      e.status = 502;
      throw e;
    }

    const data = await res.json();
    const results = Array.isArray(data.results)
      ? data.results.map((r) => ({
          title: r.title || '',
          url: r.url || '',
          snippet: r.content || r.snippet || '',
          score: r.score ?? null,
        }))
      : [];

    return { query, results, answer: data.answer || null };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPageText(url, { maxBytes = 200000 } = {}) {
  const u = await assertPublicUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(u.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': 'CodePilotAI/1.0 (+research)' },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const ctype = res.headers.get('content-type') || '';
    if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(ctype)) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let received = 0;
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > maxBytes) break;
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();

    // Strip scripts/styles/tags
    const cleaned = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned.slice(0, 15000);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { isConfigured, search, fetchPageText };
