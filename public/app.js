/* CodePilot AI — frontend
   Vanilla JS. No frameworks.
*/
'use strict';

/* =========================================================
   State
   ========================================================= */
const state = {
  conversationId: null,
  conversations: [],
  messages: [],           // { role, content, meta }
  attachments: [],        // { name, mime, base64, size }
  streaming: false,
  abortController: null,
  capabilities: { ai: false, vision: false, search: false, model: null },
  settings: {
    theme: localStorage.getItem('cp_theme') || 'dark',
    stream: localStorage.getItem('cp_stream') || 'on',
  },
};

/* =========================================================
   Elements
   ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const el = {
  html: document.documentElement,
  sidebar: $('#sidebar'),
  openSidebarBtn: $('#openSidebarBtn'),
  closeSidebarBtn: $('#closeSidebarBtn'),
  sidebarOverlay: $('#sidebarOverlay'),
  newChatBtn: $('#newChatBtn'),
  searchInput: $('#searchInput'),
  conversationList: $('#conversationList'),
  convEmpty: $('#convEmpty'),
  chatTitle: $('#chatTitle'),
  statusBadge: $('#statusBadge'),
  clearChatBtn: $('#clearChatBtn'),
  chat: $('#chat'),
  welcome: $('#welcome'),
  examples: $('#examples'),
  composer: $('#composer'),
  messageInput: $('#messageInput'),
  sendBtn: $('#sendBtn'),
  stopBtn: $('#stopBtn'),
  attachBtn: $('#attachBtn'),
  fileInput: $('#fileInput'),
  attachments: $('#attachments'),
  researchToggle: $('#researchToggle'),
  composerStatus: $('#composerStatus'),
  settingsBtn: $('#settingsBtn'),
  themeBtn: $('#themeBtn'),
  settingsModal: $('#settingsModal'),
  settingTheme: $('#settingTheme'),
  settingStream: $('#settingStream'),
  capList: $('#capList'),
};

/* =========================================================
   Theme
   ========================================================= */
function applyTheme(theme) {
  state.settings.theme = theme;
  el.html.setAttribute('data-theme', theme);
  localStorage.setItem('cp_theme', theme);
  if (el.settingTheme) el.settingTheme.value = theme;
}
applyTheme(state.settings.theme);

el.themeBtn.addEventListener('click', () => {
  applyTheme(state.settings.theme === 'dark' ? 'light' : 'dark');
});

/* =========================================================
   Sidebar (mobile)
   ========================================================= */
function openSidebar() {
  el.sidebar.classList.add('is-open');
  el.sidebarOverlay.hidden = false;
}
function closeSidebar() {
  el.sidebar.classList.remove('is-open');
  el.sidebarOverlay.hidden = true;
}
el.openSidebarBtn?.addEventListener('click', openSidebar);
el.closeSidebarBtn?.addEventListener('click', closeSidebar);
el.sidebarOverlay?.addEventListener('click', closeSidebar);

/* =========================================================
   API helpers
   ========================================================= */
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const message = (body && body.error) || (typeof body === 'string' ? body : 'Request failed');
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return body;
}

/* =========================================================
   Safe Markdown renderer
   Supports: headings, bold, italic, inline code, fenced code,
   lists, blockquote, links, hr, paragraphs, simple tables.
   Escapes all HTML by default; only produces our own tags.
   ========================================================= */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeLink(url) {
  try {
    const u = new URL(url, location.origin);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function renderInline(text) {
  let out = escapeHtml(text);
  // inline code
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic (skip ** already replaced)
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  // links [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const safe = safeLink(url);
    if (!safe) return `${label} (${escapeHtml(url)})`;
    return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return out;
}

let codeBlockId = 0;

function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let inList = null; // 'ul' | 'ol'

  const closeList = () => {
    if (inList) { out.push(`</${inList}>`); inList = null; }
  };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      closeList();
      const lang = (fence[1] || 'text').toLowerCase();
      i++;
      const buf = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // skip closing fence
      const id = `cb${++codeBlockId}`;
      out.push(
        `<div class="code-block" data-code-id="${id}">` +
          `<div class="code-block__header">` +
            `<span class="code-block__lang">${escapeHtml(lang)}</span>` +
            `<button type="button" class="btn" data-copy="${id}" style="padding:2px 10px;font-size:12px">Copy</button>` +
          `</div>` +
          `<pre><code data-lang="${escapeHtml(lang)}">${escapeHtml(buf.join('\n'))}</code></pre>` +
        `</div>`
      );
      continue;
    }

    // headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      i++; continue;
    }

    // hr
    if (/^\s*---+\s*$/.test(line)) { closeList(); out.push('<hr/>'); i++; continue; }

    // blockquote
    if (/^>\s?/.test(line)) {
      closeList();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${renderInline(buf.join(' '))}</blockquote>`);
      continue;
    }

    // tables (| a | b |)
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      closeList();
      const header = line.split('|').slice(1, -1).map((s) => s.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map((s) => s.trim()));
        i++;
      }
      out.push('<table><thead><tr>' + header.map((c) => `<th>${renderInline(c)}</th>`).join('') + '</tr></thead><tbody>');
      for (const r of rows) {
        out.push('<tr>' + r.map((c) => `<td>${renderInline(c)}</td>`).join('') + '</tr>');
      }
      out.push('</tbody></table>');
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${renderInline(line.replace(/^\s*[-*+]\s+/, ''))}</li>`);
      i++; continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${renderInline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      i++; continue;
    }

    // blank line
    if (/^\s*$/.test(line)) { closeList(); i++; continue; }

    // paragraph
    closeList();
    const buf = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^```/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^>/.test(lines[i]) && !/^\s*\|/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${renderInline(buf.join(' '))}</p>`);
  }
  closeList();
  return out.join('');
}

/* Copy buttons (event delegation) */
el.chat.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  const id = btn.getAttribute('data-copy');
  const block = el.chat.querySelector(`[data-code-id="${id}"] code`);
  if (!block) return;
  try {
    await navigator.clipboard.writeText(block.textContent);
    const prev = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = prev; }, 1200);
  } catch {
    btn.textContent = 'Copy failed';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
  }
});

/* =========================================================
   Messages rendering
   ========================================================= */
function avatarFor(role) {
  return role === 'user' ? 'You' : 'AI';
}

function appendMessageEl({ role, content, streaming = false, meta = {} }) {
  const wrap = document.createElement('article');
  wrap.className = `msg msg--${role === 'user' ? 'user' : 'assistant'}`;
  wrap.dataset.role = role;

  const avatar = document.createElement('div');
  avatar.className = 'msg__avatar';
  avatar.textContent = avatarFor(role);

  const body = document.createElement('div');
  body.className = 'msg__body';

  const metaEl = document.createElement('div');
  metaEl.className = 'msg__meta';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  metaEl.textContent = time;
  if (meta.mode === 'research') {
    const tag = document.createElement('span');
    tag.className = 'badge';
    tag.textContent = 'Research';
    metaEl.appendChild(tag);
  }

  const contentEl = document.createElement('div');
  contentEl.className = 'msg__content';

  if (streaming) {
    contentEl.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
    contentEl.dataset.streaming = 'true';
  } else {
    contentEl.innerHTML = renderMarkdown(content || '');
  }

  body.appendChild(metaEl);
  body.appendChild(contentEl);

  const actions = document.createElement('div');
  actions.className = 'msg__actions';
  if (role !== 'user') {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'icon-btn';
    copyBtn.title = 'Copy response';
    copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>';
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(contentEl.innerText);
      copyBtn.title = 'Copied!';
      setTimeout(() => { copyBtn.title = 'Copy response'; }, 1200);
    });
    actions.appendChild(copyBtn);
  }
  body.appendChild(actions);

  wrap.appendChild(avatar);
  wrap.appendChild(body);
  el.chat.appendChild(wrap);
  el.chat.scrollTop = el.chat.scrollHeight;

  return { wrap, contentEl };
}

function hideWelcome() {
  if (el.welcome) el.welcome.style.display = 'none';
}

function showWelcome() {
  if (el.welcome) el.welcome.style.display = '';
}

function clearChatView() {
  el.chat.innerHTML = '';
  el.chat.appendChild(el.welcome);
  showWelcome();
}

/* =========================================================
   Composer
   ========================================================= */
function autoResize() {
  const ta = el.messageInput;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 220) + 'px';
}
el.messageInput.addEventListener('input', () => {
  autoResize();
  updateSendState();
});
el.messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!el.sendBtn.disabled) el.composer.requestSubmit();
  }
});

function updateSendState() {
  const hasText = el.messageInput.value.trim().length > 0;
  const hasAttachments = state.attachments.length > 0;
  el.sendBtn.disabled = !(hasText || hasAttachments) || state.streaming;
}

/* attachments */
el.attachBtn.addEventListener('click', () => el.fileInput.click());
el.fileInput.addEventListener('change', async () => {
  const files = Array.from(el.fileInput.files || []);
  el.fileInput.value = '';
  if (!files.length) return;

  const form = new FormData();
  for (const f of files.slice(0, 4)) form.append('images', f);

  setStatus('Uploading image(s)…');
  try {
    const res = await fetch('/api/uploads', { method: 'POST', body: form, credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    for (const img of data.images) state.attachments.push(img);
    renderAttachments();
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    updateSendState();
  }
});

function renderAttachments() {
  el.attachments.innerHTML = '';
  if (!state.attachments.length) {
    el.attachments.hidden = true;
    return;
  }
  el.attachments.hidden = false;
  state.attachments.forEach((img, idx) => {
    const div = document.createElement('div');
    div.className = 'attach';
    const i = document.createElement('img');
    i.src = `data:${img.mime};base64,${img.base64}`;
    i.alt = img.name || 'attachment';
    const btn = document.createElement('button');
    btn.className = 'attach__remove';
    btn.type = 'button';
    btn.textContent = '×';
    btn.title = 'Remove';
    btn.addEventListener('click', () => {
      state.attachments.splice(idx, 1);
      renderAttachments();
      updateSendState();
    });
    div.appendChild(i);
    div.appendChild(btn);
    el.attachments.appendChild(div);
  });
}

function setStatus(text, isError = false) {
  el.composerStatus.textContent = text || '';
  el.composerStatus.style.color = isError ? 'var(--danger)' : '';
}

/* =========================================================
   Chat submission
   ========================================================= */
el.composer.addEventListener('submit', async (e) => {
  e.preventDefault();
  await sendMessage();
});

el.stopBtn.addEventListener('click', () => {
  if (state.abortController) state.abortController.abort();
});

async function sendMessage() {
  if (state.streaming) return;

  const text = el.messageInput.value.trim();
  const images = state.attachments.slice();

  if (!text && !images.length) return;

  hideWelcome();
  appendMessageEl({ role: 'user', content: text || '(image)', meta: { images: images.length } });
  state.messages.push({ role: 'user', content: text, images: images.length });

  el.messageInput.value = '';
  autoResize();
  state.attachments = [];
  renderAttachments();
  updateSendState();

  setStatus('Thinking…');
  const assistantEl = appendMessageEl({ role: 'assistant', content: '', streaming: true });

  state.streaming = true;
  el.stopBtn.hidden = false;
  updateSendState();

  try {
    if (el.researchToggle.checked && text) {
      await runResearch(text, assistantEl);
    } else {
      await runChat(text, images, assistantEl);
    }
  } catch (err) {
    assistantEl.contentEl.innerHTML = `<p style="color:var(--danger)"><strong>Error:</strong> ${escapeHtml(err.message)}</p>`;
  } finally {
    state.streaming = false;
    el.stopBtn.hidden = true;
    setStatus('');
    updateSendState();
    await loadConversations();
  }
}

async function runChat(text, images, assistantEl) {
  const wantStream = state.settings.stream === 'on';
  const payload = {
    conversationId: state.conversationId,
    message: text,
    images: images.length ? images.map(({ mime, base64 }) => ({ mime, base64 })) : undefined,
  };

  if (!state.capabilities.ai) {
    assistantEl.contentEl.innerHTML =
      '<p><strong>AI provider is not configured on the server.</strong></p>' +
      '<p>Set <code>AI_API_KEY</code>, <code>AI_BASE_URL</code>, and <code>AI_MODEL</code> in your <code>.env</code> file, then restart the server.</p>';
    return;
  }

  if (!wantStream || images.length) {
    const data = await api('/api/chat', { method: 'POST', body: JSON.stringify(payload) });
    state.conversationId = data.conversationId || state.conversationId;
    assistantEl.contentEl.innerHTML = renderMarkdown(data.content || '');
    assistantEl.contentEl.dataset.streaming = '';
    state.messages.push({ role: 'assistant', content: data.content });
    return;
  }

  // Streaming
  const controller = new AbortController();
  state.abortController = controller;

  const res = await fetch('/api/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('json') ? await res.json() : { error: await res.text() };
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';
  assistantEl.contentEl.innerHTML = '';

  const applyFull = () => {
    assistantEl.contentEl.innerHTML = renderMarkdown(full);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      let event = 'message';
      let dataLine = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;

      let parsed;
      try { parsed = JSON.parse(dataLine); } catch { continue; }

      if (event === 'meta') {
        if (parsed.conversationId) state.conversationId = parsed.conversationId;
      } else if (event === 'delta') {
        full += parsed.text || '';
        applyFull();
        el.chat.scrollTop = el.chat.scrollHeight;
      } else if (event === 'error') {
        throw new Error(parsed.error || 'Streaming error');
      } else if (event === 'done') {
        if (parsed.conversationId) state.conversationId = parsed.conversationId;
      }
    }
  }

  assistantEl.contentEl.dataset.streaming = '';
  state.messages.push({ role: 'assistant', content: full });
  state.abortController = null;
}

async function runResearch(query, assistantEl) {
  if (!state.capabilities.search) {
    assistantEl.contentEl.innerHTML =
      '<p><strong>Research mode is not available.</strong></p>' +
      '<p>Set <code>SEARCH_API_KEY</code> and <code>SEARCH_API_URL</code> on the server to enable web research.</p>';
    return;
  }

  const data = await api('/api/research', {
    method: 'POST',
    body: JSON.stringify({ query, conversationId: state.conversationId }),
  });
  state.conversationId = data.conversationId || state.conversationId;

  let html = renderMarkdown(data.content || '');
  if (Array.isArray(data.sources) && data.sources.length) {
    const items = data.sources
      .map((s, i) => {
        const safe = safeLink(s.url);
        const title = escapeHtml(s.title || s.url);
        return safe
          ? `<li><a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${title}</a></li>`
          : `<li>${title}</li>`;
      })
      .join('');
    html += `<div class="sources"><strong>Sources</strong><ol>${items}</ol></div>`;
  }
  assistantEl.contentEl.innerHTML = html;
  assistantEl.contentEl.dataset.streaming = '';
  state.messages.push({ role: 'assistant', content: data.content, meta: { mode: 'research' } });
}

/* =========================================================
   Conversations
   ========================================================= */
async function loadConversations() {
  try {
    const data = await api('/api/conversations');
    state.conversations = data.conversations || [];
    renderConversationList();
  } catch {
    // guest mode or error — ignore silently
  }
}

function renderConversationList() {
  const filter = (el.searchInput.value || '').trim().toLowerCase();
  const items = state.conversations.filter((c) => !filter || c.title.toLowerCase().includes(filter));

  el.conversationList.innerHTML = '';
  el.convEmpty.hidden = items.length > 0;

  for (const c of items) {
    const li = document.createElement('li');
    li.className = 'conv-item' + (c.id === state.conversationId ? ' is-active' : '');
    li.dataset.id = c.id;

    const title = document.createElement('span');
    title.className = 'conv-item__title';
    title.textContent = c.title || 'Untitled';

    const actions = document.createElement('span');
    actions.className = 'conv-item__actions';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'icon-btn';
    renameBtn.title = 'Rename';
    renameBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
    renameBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newTitle = prompt('Rename conversation', c.title || '');
      if (!newTitle) return;
      await api(`/api/conversations/${c.id}`, { method: 'PATCH', body: JSON.stringify({ title: newTitle }) });
      await loadConversations();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Delete';
    delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this conversation?')) return;
      await api(`/api/conversations/${c.id}`, { method: 'DELETE' });
      if (c.id === state.conversationId) {
        state.conversationId = null;
        state.messages = [];
        clearChatView();
        el.chatTitle.textContent = 'New chat';
      }
      await loadConversations();
    });

    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);

    li.appendChild(title);
    li.appendChild(actions);

    li.addEventListener('click', () => openConversation(c.id));
    el.conversationList.appendChild(li);
  }
}

async function openConversation(id) {
  const data = await api(`/api/conversations/${id}`);
  const conv = data.conversation;
  if (!conv) return;
  state.conversationId = conv.id;
  state.messages = conv.messages || [];
  el.chatTitle.textContent = conv.title || 'Chat';
  el.chat.innerHTML = '';
  for (const m of state.messages) {
    appendMessageEl({ role: m.role, content: m.content, meta: m.metadata || {} });
  }
  renderConversationList();
  closeSidebar();
}

el.newChatBtn.addEventListener('click', () => {
  state.conversationId = null;
  state.messages = [];
  state.attachments = [];
  renderAttachments();
  clearChatView();
  el.chatTitle.textContent = 'New chat';
  renderConversationList();
  closeSidebar();
  el.messageInput.focus();
});

el.clearChatBtn.addEventListener('click', () => {
  if (!confirm('Clear the current chat view? (Server-side conversation is not deleted.)')) return;
  state.conversationId = null;
  state.messages = [];
  clearChatView();
  el.chatTitle.textContent = 'New chat';
});

el.searchInput.addEventListener('input', renderConversationList);

/* examples */
el.examples.addEventListener('click', (e) => {
  const btn = e.target.closest('.example');
  if (!btn) return;
  const prompt = btn.dataset.prompt || '';
  el.messageInput.value = prompt;
  autoResize();
  updateSendState();
  el.messageInput.focus();
  el.composer.requestSubmit();
});

/* =========================================================
   Settings
   ========================================================= */
el.settingsBtn.addEventListener('click', async () => {
  el.settingTheme.value = state.settings.theme;
  el.settingStream.value = state.settings.stream;
  await loadCapabilities();
  el.settingsModal.showModal();
});

el.settingTheme.addEventListener('change', () => applyTheme(el.settingTheme.value));
el.settingStream.addEventListener('change', () => {
  state.settings.stream = el.settingStream.value;
  localStorage.setItem('cp_stream', state.settings.stream);
});

async function loadCapabilities() {
  try {
    const caps = await api('/api/settings/capabilities');
    state.capabilities = caps;
    el.capList.innerHTML = '';
    const rows = [
      ['AI chat', caps.ai],
      ['Vision (image analysis)', caps.vision],
      ['Web search (research mode)', caps.search],
    ];
    for (const [label, ok] of rows) {
      const li = document.createElement('li');
      li.innerHTML = `${label}: <strong>${ok ? 'Configured' : 'Not configured'}</strong>`;
      el.capList.appendChild(li);
    }
    if (caps.model) {
      const li = document.createElement('li');
      li.innerHTML = `Model: <code>${caps.model}</code>`;
      el.capList.appendChild(li);
    }

    // Update badge
    el.statusBadge.hidden = caps.ai;
    if (!caps.ai) el.statusBadge.textContent = 'AI not configured';
  } catch {
    el.capList.innerHTML = '<li class="muted">Could not load capabilities.</li>';
  }
}

/* =========================================================
   Boot
   ========================================================= */
async function boot() {
  autoResize();
  updateSendState();
  await loadCapabilities();
  await loadConversations();
  el.messageInput.focus();
}

boot();
