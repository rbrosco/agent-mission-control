// Hermes Mission Control v2.0 — frontend logic (vanilla JS, no build step)

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const AGENT_META = {
  orchestrator: { code: 'OR', name: 'Orchestrator', role: 'COORDINATOR', color: '#E8622C', bg: 'bg-agent-orchestrator' },
  scout:        { code: 'SC', name: 'Scout',        role: 'RESEARCH',    color: '#1FA6A0', bg: 'bg-agent-scout' },
  scribe:       { code: 'SB', name: 'Scribe',       role: 'WRITING',     color: '#D9A62E', bg: 'bg-agent-scribe' },
  reach:        { code: 'RE', name: 'Reach',        role: 'MARKETING',   color: '#D6407E', bg: 'bg-agent-reach' },
  dev:          { code: 'DV', name: 'Dev',          role: 'ENGINEERING', color: '#3FA85C', bg: 'bg-agent-dev' },
};
const REAL_PROFILES = ['dev', 'scout', 'scribe', 'reach']; // profiles with real state.db data
const CHAT_PROFILES = ['orchestrator', 'dev', 'scout', 'scribe', 'reach'];

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}
function fmtEpoch(sec) {
  if (!sec) return '—';
  const d = new Date(sec * 1000);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function timeAgo(sec) {
  if (!sec) return '—';
  const diff = (Date.now() / 1000) - sec;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}
function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
async function fetchJSON(url, opts) {
  const resp = await fetch(url, opts);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.error || `HTTP ${resp.status}`);
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}
function agentBadge(agentKey, size = 'w-9 h-9 text-xs') {
  const m = AGENT_META[agentKey] || { code: '??', color: '#999' };
  return el('span', {
    class: `${size} rounded-full flex items-center justify-center font-bold text-white shrink-0`,
    style: `background:${m.color}`,
  }, m.code);
}
function priorityBadge(priority) {
  const p = Number(priority) || 0;
  let label, cls;
  if (p >= 2) { label = 'P1'; cls = 'bg-red-100 text-red-700'; }
  else if (p === 1) { label = 'P2'; cls = 'bg-amber-100 text-amber-700'; }
  else { label = 'P3'; cls = 'bg-black/5 text-black/50'; }
  return el('span', { class: `${cls} text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full` }, label);
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const TAB_LOADERS = {}; // tabName -> async function, called once lazily
const TAB_LOADED = new Set();

function activateTab(tabName) {
  $all('.tab-panel').forEach((p) => p.classList.remove('active'));
  const panel = $(`#tab-${tabName}`);
  if (panel) panel.classList.add('active');

  $all('#main-nav button').forEach((b) => {
    const active = b.dataset.tab === tabName;
    b.classList.toggle('bg-ink', active);
    b.classList.toggle('text-cream', active);
    b.classList.toggle('text-black/40', !active);
    b.classList.toggle('hover:bg-black/5', !active);
  });

  location.hash = tabName;

  if (!TAB_LOADED.has(tabName) && TAB_LOADERS[tabName]) {
    TAB_LOADED.add(tabName);
    TAB_LOADERS[tabName]();
  }
}

function initNav() {
  $all('#main-nav button').forEach((b) => {
    b.addEventListener('click', () => activateTab(b.dataset.tab));
  });
  const initial = (location.hash || '#overview').replace('#', '');
  activateTab(TAB_LOADERS[initial] !== undefined || $(`#tab-${initial}`) ? initial : 'overview');
}

function tickClock() {
  const now = new Date();
  const utc = now.toUTCString().split(' ')[4];
  const clockEl = $('#utc-clock');
  if (clockEl) clockEl.textContent = utc + ' UTC';
}
setInterval(tickClock, 1000);
tickClock();

// ---------------------------------------------------------------------------
// Hero card component (shared across tabs)
// ---------------------------------------------------------------------------

function heroCard({ title, titleItalic, subtitle, extra }) {
  const card = el('div', { class: 'hero-glow rounded-3xl p-8 md:p-10 text-cream relative overflow-hidden mb-6' });
  const row = el('div', { class: 'flex flex-col md:flex-row md:items-start md:justify-between gap-6 relative z-10' });
  const left = el('div', { class: 'max-w-2xl' });
  left.appendChild(el('h1', {
    class: 'font-serif text-3xl md:text-5xl font-medium leading-tight',
    html: `${escapeHtml(title)} <em class="italic text-accent">${escapeHtml(titleItalic)}</em>`,
  }));
  if (subtitle) left.appendChild(el('p', { class: 'mt-4 text-sm md:text-base text-cream/60 leading-relaxed' }, subtitle));
  row.appendChild(left);
  if (extra) row.appendChild(extra);
  card.appendChild(row);
  return card;
}

function statPill(label, value) {
  return el('div', { class: 'bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center min-w-[92px]' }, [
    el('div', { class: 'text-xl font-semibold' }, String(value)),
    el('div', { class: 'text-[10px] uppercase tracking-wider text-cream/50 mt-1' }, label),
  ]);
}

function contentCard(children, extraClass = '') {
  return el('div', { class: `bg-card rounded-2xl p-6 shadow-sm border border-black/5 ${extraClass}` }, children);
}

// ---------------------------------------------------------------------------
// OVERVIEW TAB
// ---------------------------------------------------------------------------

TAB_LOADERS.overview = async function renderOverview() {
  const mount = $('#overview-mount');
  mount.innerHTML = '<div class="loading-shimmer h-64 rounded-3xl"></div>';

  let summary, sessions, messages;
  try {
    [summary, sessions, messages] = await Promise.all([
      fetchJSON('/api/summary'),
      fetchJSON('/api/sessions?limit=100'),
      fetchJSON('/api/messages?limit=8'),
    ]);
  } catch (e) {
    mount.innerHTML = `<div class="text-red-600 text-sm">Erro ao carregar overview: ${escapeHtml(e.message)}</div>`;
    return;
  }

  mount.innerHTML = '';

  // Hero + recent activity side by side
  const heroWrap = el('div', { class: 'grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6' });
  const hero = heroCard({
    title: 'One orchestrator.',
    titleItalic: 'Four specialists.',
    subtitle: 'Hermes is coordinating Scout, Scribe, Reach, Dev — routing every task by complexity.',
  });
  hero.classList.add('lg:col-span-2', 'mb-0');
  hero.querySelector('div').classList.remove('md:items-start');
  // Network graph SVG inside hero
  hero.appendChild(buildNetworkGraph());
  heroWrap.appendChild(hero);

  // Recent activity card
  const activityItems = messages.slice(0, 8).map((m) => {
    const meta = AGENT_META[m.profile] || {};
    return el('div', { class: 'flex items-start gap-3 py-2.5 border-b border-black/5 last:border-0' }, [
      agentBadge(m.profile, 'w-7 h-7 text-[10px]'),
      el('div', { class: 'min-w-0 flex-1' }, [
        el('div', { class: 'text-xs font-semibold' }, `${meta.name || m.profile} · ${m.role}`),
        el('div', { class: 'text-xs text-black/50 truncate' }, (m.content || '').slice(0, 90)),
      ]),
      el('div', { class: 'text-[10px] text-black/35 shrink-0' }, timeAgo(m.timestamp)),
    ]);
  });
  const activityCard = contentCard([
    el('div', { class: 'text-xs font-semibold uppercase tracking-wider text-black/40 mb-3' }, 'Recent activity'),
    ...(activityItems.length ? activityItems : [el('div', { class: 'text-sm text-black/40 py-6 text-center' }, 'Sem mensagens recentes.')]),
  ]);
  heroWrap.appendChild(activityCard);
  mount.appendChild(heroWrap);

  // Metrics row
  const activeMissions = (summary.task_by_status?.todo || 0) + (summary.task_by_status?.in_progress || 0);
  const perProfile = summary.per_profile || {};
  const totalSessions = Object.values(perProfile).reduce((a, p) => a + (p.session_count || 0), 0) || 1;

  const metricsGrid = el('div', { class: 'grid grid-cols-1 md:grid-cols-4 gap-6' });

  metricsGrid.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-black/40' }, 'Active Missions'),
    el('div', { class: 'text-4xl font-serif font-medium mt-2' }, String(activeMissions)),
    el('div', { class: 'text-xs text-black/40 mt-2' }, 'To do + In progress · kanban.db'),
  ]));

  // load distribution ring (simple conic-gradient based)
  const ringSegments = REAL_PROFILES.map((p, i) => {
    const count = perProfile[p]?.session_count || 0;
    return { p, count, pct: (count / totalSessions) * 100 };
  });
  let acc = 0;
  const gradientParts = ringSegments.map((s) => {
    const start = acc; acc += s.pct;
    return `${AGENT_META[s.p].color} ${start}% ${acc}%`;
  }).join(', ');
  const ring = el('div', {
    class: 'w-28 h-28 rounded-full mx-auto mt-3',
    style: `background: conic-gradient(${gradientParts || '#ddd 0% 100%'})`,
  });
  const ringInner = el('div', { class: 'relative flex items-center justify-center' }, [
    ring,
    el('div', { class: 'absolute w-16 h-16 rounded-full bg-card flex items-center justify-center text-xs font-semibold' }, String(totalSessions)),
  ]);
  metricsGrid.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-black/40' }, 'Load distribution'),
    ringInner,
    el('div', { class: 'text-[10px] text-black/40 text-center mt-1' }, 'sessions por agente'),
  ]));

  // tasks resolved per agent (session counts as proxy, real data)
  const resolvedRows = REAL_PROFILES.map((p) => {
    const count = perProfile[p]?.session_count || 0;
    return el('div', { class: 'flex items-center justify-between text-xs py-1.5' }, [
      el('span', { class: 'flex items-center gap-2' }, [agentBadge(p, 'w-5 h-5 text-[9px]'), AGENT_META[p].name]),
      el('span', { class: 'font-semibold' }, String(count)),
    ]);
  });
  metricsGrid.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-black/40 mb-2' }, 'Sessions by agent'),
    ...resolvedRows,
  ]));

  // fleet throughput bars
  const maxCount = Math.max(1, ...REAL_PROFILES.map((p) => perProfile[p]?.session_count || 0));
  const fleetBars = REAL_PROFILES.map((p) => {
    const count = perProfile[p]?.session_count || 0;
    const pct = Math.round((count / maxCount) * 100);
    return el('div', { class: 'mb-2.5' }, [
      el('div', { class: 'flex justify-between text-[10px] uppercase tracking-wider text-black/40 mb-1' }, [
        el('span', {}, AGENT_META[p].name), el('span', {}, String(count)),
      ]),
      el('div', { class: 'h-1.5 bg-black/5 rounded-full overflow-hidden' }, [
        el('div', { class: 'h-full rounded-full', style: `width:${pct}%;background:${AGENT_META[p].color}` }),
      ]),
    ]);
  });
  metricsGrid.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-black/40 mb-3' }, 'Fleet throughput'),
    ...fleetBars,
  ]));

  mount.appendChild(metricsGrid);
};

function buildNetworkGraph() {
  const wrap = el('div', { class: 'mt-8 relative z-10' });
  const w = 420, h = 160;
  const cx = 70, cy = h / 2;
  const nodes = [
    { key: 'scout', label: 'SC', color: AGENT_META.scout.color, x: 200, y: 30 },
    { key: 'scribe', label: 'SB', color: AGENT_META.scribe.color, x: 340, y: 60 },
    { key: 'reach', label: 'RE', color: AGENT_META.reach.color, x: 340, y: 130 },
    { key: 'dev', label: 'DV', color: AGENT_META.dev.color, x: 200, y: 150 },
  ];
  let svg = `<svg viewBox="0 0 ${w} ${h}" class="w-full max-w-xl h-40">`;
  for (const n of nodes) {
    svg += `<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="rgba(232,98,44,0.35)" stroke-width="1.5"/>`;
  }
  svg += `<circle cx="${cx}" cy="${cy}" r="22" fill="#E8622C" class="pulse-dot" style="transform-origin:${cx}px ${cy}px"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="22" fill="none" stroke="#E8622C" stroke-width="1" opacity="0.4"/>`;
  svg += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="white" font-size="13" font-weight="700" font-family="Inter">h</text>`;
  for (const n of nodes) {
    svg += `<circle cx="${n.x}" cy="${n.y}" r="16" fill="${n.color}"/>`;
    svg += `<text x="${n.x}" y="${n.y + 4}" text-anchor="middle" fill="white" font-size="10" font-weight="700" font-family="Inter">${n.label}</text>`;
  }
  svg += `</svg>`;
  wrap.innerHTML = svg;
  return wrap;
}

// ---------------------------------------------------------------------------
// AGENTS TAB
// ---------------------------------------------------------------------------

TAB_LOADERS.agents = async function renderAgents() {
  const mount = $('#agents-mount');
  mount.innerHTML = '<div class="loading-shimmer h-40 rounded-3xl"></div>';

  let sessions;
  try {
    sessions = await fetchJSON('/api/sessions?limit=500');
  } catch (e) {
    mount.innerHTML = `<div class="text-red-600 text-sm">Erro: ${escapeHtml(e.message)}</div>`;
    return;
  }

  mount.innerHTML = '';
  mount.appendChild(heroCard({
    title: 'Five agents.',
    titleItalic: 'one console.',
    subtitle: 'Inspect each specialist, route them to the right model, and watch the heartbeat of the entire fleet in one place.',
  }));

  const byProfile = {};
  for (const s of sessions) {
    (byProfile[s.profile] ||= []).push(s);
  }

  const agentKeys = ['orchestrator', ...REAL_PROFILES];
  const maxSessions = Math.max(1, ...REAL_PROFILES.map((p) => (byProfile[p] || []).length));

  const grid = el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-6' });
  for (const key of agentKeys) {
    const meta = AGENT_META[key];
    const isOrch = key === 'orchestrator';
    const list = byProfile[key] || [];
    const count = list.length;
    const latestModel = isOrch ? 'router (multi-model)' : (list[0]?.model || '—');
    const lastActive = list[0]?.last_activity_at;
    const isActive = lastActive && (Date.now() / 1000 - lastActive) < 7200;
    const loadPct = isOrch ? 100 : Math.round((count / maxSessions) * 100);

    grid.appendChild(contentCard([
      el('div', { class: 'flex items-center justify-between mb-3' }, [
        agentBadge(key, 'w-11 h-11 text-sm'),
        el('span', {
          class: `text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-black/5 text-black/40'}`,
        }, isActive ? 'ACTIVE' : 'IDLE'),
      ]),
      el('div', { class: 'font-serif text-lg font-medium' }, meta.name),
      el('div', { class: 'text-[10px] uppercase tracking-wider text-black/40 mb-3' }, meta.role),
      el('div', { class: 'h-1.5 bg-black/5 rounded-full overflow-hidden mb-1' }, [
        el('div', { class: 'h-full rounded-full', style: `width:${loadPct}%;background:${meta.color}` }),
      ]),
      el('div', { class: 'text-[10px] text-black/40 mb-3' }, 'load'),
      el('div', { class: 'flex justify-between text-xs mb-1' }, [
        el('span', { class: 'text-black/40' }, 'Sessions'), el('span', { class: 'font-semibold' }, isOrch ? String(sessions.length) : String(count)),
      ]),
      el('div', { class: 'flex justify-between text-xs mb-1' }, [
        el('span', { class: 'text-black/40' }, 'Success rate'), el('span', { class: 'font-semibold' }, count ? '100%' : '—'),
      ]),
      el('div', { class: 'text-[10px] text-black/40 mt-3 truncate' }, `Model: ${escapeHtml(latestModel)}`),
    ]));
  }
  mount.appendChild(grid);

  const bottomGrid = el('div', { class: 'grid grid-cols-1 lg:grid-cols-3 gap-6' });
  const throughputRows = REAL_PROFILES.map((p) => {
    const count = (byProfile[p] || []).length;
    return el('div', { class: 'flex items-center justify-between text-sm py-2 border-b border-black/5 last:border-0' }, [
      el('span', { class: 'flex items-center gap-2' }, [agentBadge(p, 'w-6 h-6 text-[10px]'), AGENT_META[p].name]),
      el('span', { class: 'text-black/50' }, `${count} sessions`),
    ]);
  });
  bottomGrid.appendChild(contentCard([
    el('div', { class: 'text-xs font-semibold uppercase tracking-wider text-black/40 mb-3' }, 'Task summary'),
    ...throughputRows,
  ], 'lg:col-span-2'));

  const routingRows = REAL_PROFILES.map((p) => {
    const list = byProfile[p] || [];
    const model = list[0]?.model || '—';
    return el('div', { class: 'flex items-center justify-between text-xs py-2 border-b border-black/5 last:border-0' }, [
      el('span', { class: 'flex items-center gap-2' }, [agentBadge(p, 'w-5 h-5 text-[9px]'), AGENT_META[p].name]),
      el('span', { class: 'text-black/50 font-mono truncate max-w-[140px]' }, model),
    ]);
  });
  bottomGrid.appendChild(contentCard([
    el('div', { class: 'text-xs font-semibold uppercase tracking-wider text-black/40 mb-3' }, 'Model routing'),
    ...routingRows,
  ]));
  mount.appendChild(bottomGrid);
};

// ---------------------------------------------------------------------------
// CHAT TAB (real, functional)
// ---------------------------------------------------------------------------

const chatState = { selected: null, sending: false };

TAB_LOADERS.chat = async function renderChat() {
  const mount = $('#chat-mount');
  mount.innerHTML = '';

  mount.appendChild(el('div', { class: 'mb-6' }, [
    el('h1', { class: 'font-serif text-3xl md:text-4xl font-medium' }, [
      'Talk to the fleet.',
    ]),
    el('p', { class: 'text-sm text-black/50 mt-2' }, 'Real messages, real replies — sending a message runs an actual model call through the agent CLI.'),
  ]));

  const layout = el('div', { class: 'grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6' });

  // Sidebar
  const sidebar = el('div', { class: 'bg-card rounded-2xl border border-black/5 overflow-hidden' });
  const sidebarList = el('div', { class: 'divide-y divide-black/5' });
  for (const key of CHAT_PROFILES) {
    const meta = AGENT_META[key];
    const item = el('button', {
      class: 'w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-black/[0.03] transition-colors',
      'data-agent': key,
    }, [
      agentBadge(key, 'w-8 h-8 text-[10px]'),
      el('div', { class: 'min-w-0' }, [
        el('div', { class: 'text-sm font-semibold' }, meta.name),
        el('div', { class: 'text-[10px] uppercase tracking-wider text-black/40' }, meta.role),
      ]),
    ]);
    item.addEventListener('click', () => selectChatAgent(key));
    sidebarList.appendChild(item);
  }
  sidebar.appendChild(el('div', { class: 'px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-black/40 border-b border-black/5' }, 'Agents'));
  sidebar.appendChild(sidebarList);
  layout.appendChild(sidebar);

  // Chat area
  const chatArea = el('div', { class: 'bg-card rounded-2xl border border-black/5 flex flex-col h-[600px]', id: 'chat-area' });
  chatArea.appendChild(el('div', { class: 'flex-1 flex items-center justify-center text-black/30 text-sm' }, 'Selecione um agente à esquerda para começar.'));
  layout.appendChild(chatArea);

  mount.appendChild(layout);

  // Deep-link support: ?agent=<key> preselects an agent (also used for
  // headless screenshot QA of the selected state without needing a real click).
  const urlAgent = new URLSearchParams(location.search).get('agent');
  if (urlAgent && CHAT_PROFILES.includes(urlAgent)) chatState.selected = urlAgent;

  if (chatState.selected) selectChatAgent(chatState.selected);
};

async function selectChatAgent(key) {
  chatState.selected = key;
  $all('#main-nav')[0]; // noop, keep linter calm
  $all('[data-agent]').forEach((b) => {
    b.classList.toggle('bg-black/5', b.dataset.agent === key);
  });

  const meta = AGENT_META[key];
  const chatArea = $('#chat-area');
  chatArea.innerHTML = '';

  const header = el('div', { class: 'flex items-center gap-3 px-5 py-4 border-b border-black/5' }, [
    agentBadge(key, 'w-9 h-9 text-xs'),
    el('div', {}, [
      el('div', { class: 'text-sm font-semibold' }, meta.name),
      el('div', { class: 'text-[10px] uppercase tracking-wider text-black/40' }, meta.role),
    ]),
    el('span', { class: 'ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700' }, 'Ready'),
  ]);
  chatArea.appendChild(header);

  const msgList = el('div', { class: 'flex-1 overflow-y-auto chat-scroll px-5 py-4 space-y-3', id: 'chat-msg-list' });
  chatArea.appendChild(msgList);

  const inputBar = el('div', { class: 'border-t border-black/5 p-4' });
  const textarea = el('textarea', {
    class: 'w-full resize-none rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40',
    rows: '2',
    placeholder: 'Message the agent... (Enter to send, Shift+Enter for newline)',
  });
  const sendRow = el('div', { class: 'flex items-center justify-between mt-2' }, [
    el('span', { class: 'text-[10px] text-black/35' }, key === 'orchestrator'
      ? 'Orchestrator chat is not wired to a CLI profile yet — read-only history shown.'
      : '⚡ Sending runs a REAL model call (costs API credits, can take up to 2 min).'),
    el('button', {
      class: 'bg-accent hover:bg-accent-light text-white text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full disabled:opacity-40',
      id: 'chat-send-btn',
    }, 'Send'),
  ]);
  inputBar.appendChild(textarea);
  inputBar.appendChild(sendRow);
  chatArea.appendChild(inputBar);

  const sendBtn = $('#chat-send-btn');
  if (key === 'orchestrator') {
    sendBtn.disabled = true;
    textarea.disabled = true;
    textarea.placeholder = 'Orchestrator has no direct CLI alias in this dashboard yet.';
  } else {
    sendBtn.addEventListener('click', () => sendChatMessage(key, textarea));
    textarea.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        sendChatMessage(key, textarea);
      }
    });
  }

  // Load real history
  msgList.innerHTML = '<div class="loading-shimmer h-16 rounded-xl"></div>';
  try {
    const profileParam = key === 'orchestrator' ? null : key;
    const url = profileParam ? `/api/messages?profile=${profileParam}&limit=30` : `/api/messages?limit=30`;
    const messages = await fetchJSON(url);
    renderChatHistory(msgList, messages.reverse());
  } catch (e) {
    msgList.innerHTML = `<div class="text-red-600 text-xs">Erro ao carregar histórico: ${escapeHtml(e.message)}</div>`;
  }
}

function renderChatHistory(container, messages) {
  container.innerHTML = '';
  if (!messages.length) {
    container.appendChild(el('div', { class: 'text-center text-black/30 text-sm py-10' }, 'Sem mensagens ainda para este agente.'));
    return;
  }
  for (const m of messages) {
    container.appendChild(chatBubble(m.role, m.content, m.timestamp));
  }
  container.scrollTop = container.scrollHeight;
}

function chatBubble(role, content, timestamp) {
  const isUser = role === 'user';
  const bubble = el('div', { class: `max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'msg-bubble-user' : 'msg-bubble-agent'}` }, content || '');
  const wrap = el('div', { class: `flex flex-col ${isUser ? 'items-end' : 'items-start'}` }, [
    bubble,
    el('div', { class: 'text-[9px] text-black/30 mt-1 px-1' }, timestamp ? timeAgo(timestamp) : ''),
  ]);
  return wrap;
}

async function sendChatMessage(profile, textarea) {
  const message = textarea.value.trim();
  if (!message || chatState.sending) return;

  const msgList = $('#chat-msg-list');
  const sendBtn = $('#chat-send-btn');
  chatState.sending = true;
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending…';
  textarea.disabled = true;

  msgList.appendChild(chatBubble('user', message, Date.now() / 1000));
  msgList.scrollTop = msgList.scrollHeight;
  textarea.value = '';

  const loadingBubble = el('div', { class: 'flex items-start' }, [
    el('div', { class: 'msg-bubble-agent rounded-2xl px-4 py-2.5 text-sm loading-shimmer' }, '⏳ Waiting for real model response (up to 2 min)…'),
  ]);
  msgList.appendChild(loadingBubble);
  msgList.scrollTop = msgList.scrollHeight;

  try {
    const result = await fetchJSON('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, message }),
    });
    loadingBubble.remove();
    msgList.appendChild(chatBubble('assistant', result.response, Date.now() / 1000));
  } catch (e) {
    loadingBubble.remove();
    msgList.appendChild(el('div', { class: 'text-red-600 text-xs px-1' }, `Erro: ${escapeHtml(e.message)}`));
  } finally {
    chatState.sending = false;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
    textarea.disabled = false;
    textarea.focus();
    msgList.scrollTop = msgList.scrollHeight;
  }
}

// ---------------------------------------------------------------------------
// TASKS TAB (kanban)
// ---------------------------------------------------------------------------

TAB_LOADERS.tasks = async function renderTasks() {
  const mount = $('#tasks-mount');
  mount.innerHTML = '<div class="loading-shimmer h-64 rounded-3xl"></div>';

  let tasks;
  try {
    tasks = await fetchJSON('/api/kanban?limit=500');
  } catch (e) {
    mount.innerHTML = `<div class="text-red-600 text-sm">Erro: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const cols = { todo: [], in_progress: [], done: [] };
  for (const t of tasks) {
    const status = (t.status || '').toLowerCase();
    if (status === 'done' || status === 'completed') cols.done.push(t);
    else if (status === 'todo' || status === 'triage') cols.todo.push(t);
    else cols.in_progress.push(t); // in_progress, blocked, everything else
  }

  mount.innerHTML = '';
  const extra = el('div', { class: 'flex items-center gap-4' }, [
    statPill('To do', cols.todo.length),
    statPill('In progress', cols.in_progress.length),
    statPill('Done', cols.done.length),
    el('button', { class: 'bg-accent hover:bg-accent-light text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-full whitespace-nowrap', title: 'Visual only — kanban.db is not writable from this dashboard yet' }, '+ New mission'),
  ]);
  mount.appendChild(heroCard({
    title: 'Every mission,',
    titleItalic: 'in motion.',
    subtitle: 'Drag a card between columns to move it through your workflow — visual reordering only for now; the board itself stays read-only.',
    extra,
  }));

  const board = el('div', { class: 'grid grid-cols-1 md:grid-cols-3 gap-5' });
  const colDefs = [
    { key: 'todo', label: 'To do' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'done', label: 'Done' },
  ];
  for (const def of colDefs) {
    const list = cols[def.key];
    const colBody = el('div', { class: 'space-y-3' });
    if (!list.length) {
      colBody.appendChild(el('div', { class: 'text-xs text-black/30 text-center py-8' }, 'Sem tarefas.'));
    }
    for (const t of list) {
      colBody.appendChild(taskCard(t));
    }
    board.appendChild(el('div', { class: 'bg-card/60 rounded-2xl p-4' }, [
      el('div', { class: 'flex items-center justify-between mb-3 px-1' }, [
        el('span', { class: 'text-xs font-bold uppercase tracking-wider text-black/50' }, def.label),
        el('span', { class: 'text-[10px] text-black/30' }, String(list.length)),
      ]),
      colBody,
    ]));
  }
  mount.appendChild(board);
};

function taskCard(t) {
  const shortId = (t.id || '').toString().slice(0, 8);
  return el('div', { class: 'bg-white rounded-xl p-4 border border-black/5 shadow-sm' }, [
    el('div', { class: 'flex items-center justify-between mb-2' }, [
      el('span', { class: 'text-[10px] font-mono text-black/30' }, shortId),
      priorityBadge(t.priority),
    ]),
    el('div', { class: 'text-sm font-medium leading-snug mb-2' }, t.title || '(sem título)'),
    el('div', { class: 'flex items-center justify-between text-[10px] text-black/40' }, [
      el('span', {}, t.assignee || t.board || '—'),
      el('span', {}, t.status || ''),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// OFFICE TAB (3D scene via three.js CDN)
// ---------------------------------------------------------------------------

TAB_LOADERS.office = async function renderOffice() {
  const mount = $('#office-mount');
  mount.innerHTML = '<div class="loading-shimmer h-64 rounded-3xl"></div>';

  let sessions, summary;
  try {
    [sessions, summary] = await Promise.all([
      fetchJSON('/api/sessions?limit=500'),
      fetchJSON('/api/summary'),
    ]);
  } catch (e) {
    mount.innerHTML = `<div class="text-red-600 text-sm">Erro: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const now = Date.now() / 1000;
  const lastActivityByProfile = {};
  for (const s of sessions) {
    const cur = lastActivityByProfile[s.profile] || 0;
    if ((s.last_activity_at || 0) > cur) lastActivityByProfile[s.profile] = s.last_activity_at;
  }
  const lightsOn = REAL_PROFILES.filter((p) => lastActivityByProfile[p] && (now - lastActivityByProfile[p]) < 7200).length;
  const totalTasks = summary.task_count ?? 0;

  mount.innerHTML = '';
  mount.appendChild(heroCard({
    title: 'A city built by',
    titleItalic: 'agents.',
    subtitle: 'Every specialist owns a tower. The orchestrator runs HQ at the center. Lit windows mean live work. Drag to orbit, scroll to zoom, click a building to open its dossier.',
    extra: el('div', { class: 'flex items-center gap-4' }, [
      statPill('Buildings', 5),
      statPill('Lights on', lightsOn),
      statPill('Tasks', totalTasks),
    ]),
  }));

  const sceneCard = contentCard([], 'p-0 overflow-hidden relative');
  const canvasWrap = el('div', { class: 'relative w-full', style: 'height: 520px;' });
  const loadingOverlay = el('div', {
    id: 'office-loading',
    class: 'absolute inset-0 flex flex-col items-center justify-center bg-ink text-cream/70 text-xs font-semibold uppercase tracking-[0.3em] gap-3',
  }, [
    el('div', { class: 'w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin' }),
    'Booting the empire...',
  ]);
  const canvas = el('canvas', { id: 'office-canvas', class: 'w-full h-full block' });
  const tooltip = el('div', {
    id: 'office-tooltip',
    class: 'absolute hidden bg-ink text-cream rounded-xl px-4 py-3 text-xs shadow-xl max-w-[220px] pointer-events-none z-10',
  });
  canvasWrap.appendChild(canvas);
  canvasWrap.appendChild(loadingOverlay);
  canvasWrap.appendChild(tooltip);
  sceneCard.appendChild(canvasWrap);
  mount.appendChild(sceneCard);

  const labels = el('div', { class: 'grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-center' });
  const districts = [
    { key: 'orchestrator', label: 'HQ' },
    { key: 'scout', label: 'Research' },
    { key: 'scribe', label: 'Writing' },
    { key: 'reach', label: 'Marketing' },
    { key: 'dev', label: 'Engineering' },
  ];
  for (const d of districts) {
    labels.appendChild(el('div', { class: 'text-[10px] uppercase tracking-wider text-black/40' }, [
      el('span', { class: 'inline-block w-2 h-2 rounded-full mr-1', style: `background:${AGENT_META[d.key].color}` }),
      `${d.label} (${AGENT_META[d.key].name})`,
    ]));
  }
  mount.appendChild(labels);

  bootOfficeScene(canvas, loadingOverlay, tooltip, lastActivityByProfile, sessions, summary);
};

async function bootOfficeScene(canvas, loadingOverlay, tooltip, lastActivityByProfile, sessions, summary) {
  let THREE, OrbitControls;
  try {
    const [threeMod, controlsMod] = await Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
    ]);
    THREE = threeMod;
    OrbitControls = controlsMod.OrbitControls;
  } catch (e) {
    loadingOverlay.innerHTML = '';
    loadingOverlay.appendChild(el('div', { class: 'text-center px-6' }, [
      el('div', { class: 'text-sm font-semibold mb-1 normal-case tracking-normal' }, '3D scene unavailable'),
      el('div', { class: 'text-[10px] text-cream/50 normal-case tracking-normal' }, 'three.js failed to load from CDN (offline?). The rest of the dashboard still works.'),
    ]));
    return;
  }

  const now = Date.now() / 1000;
  const wrap = canvas.parentElement;
  const width = wrap.clientWidth, height = wrap.clientHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16120f);
  scene.fog = new THREE.Fog(0x16120f, 15, 60);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
  camera.position.set(14, 12, 18);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.minDistance = 6;
  controls.maxDistance = 40;
  controls.target.set(0, 2, 0);

  scene.add(new THREE.AmbientLight(0x404040, 1.2));
  const sun = new THREE.DirectionalLight(0xffddbb, 0.6);
  sun.position.set(10, 20, 10);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x201a15, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const buildings = [];
  const buildingDefs = [
    { key: 'orchestrator', color: AGENT_META.orchestrator.color, x: 0, z: 0, w: 3, h: 9, d: 3 },
    { key: 'scout', color: AGENT_META.scout.color, x: -7, z: -5, w: 2, h: 5, d: 2 },
    { key: 'scribe', color: AGENT_META.scribe.color, x: 7, z: -5, w: 2, h: 6, d: 2 },
    { key: 'reach', color: AGENT_META.reach.color, x: -7, z: 5, w: 2, h: 4.5, d: 2 },
    { key: 'dev', color: AGENT_META.dev.color, x: 7, z: 5, w: 2, h: 5.5, d: 2 },
  ];

  for (const def of buildingDefs) {
    const isActive = def.key === 'orchestrator'
      ? true
      : lastActivityByProfile[def.key] && (now - lastActivityByProfile[def.key]) < 7200;

    const geo = new THREE.BoxGeometry(def.w, def.h, def.d);
    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: new THREE.Color(def.color),
      emissiveIntensity: isActive ? 0.55 : 0.12,
      roughness: 0.5,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(def.x, def.h / 2, def.z);
    mesh.userData = { key: def.key, isActive };
    scene.add(mesh);
    buildings.push(mesh);

    // simple "window" strip using an emissive plane facade
    const winMat = new THREE.MeshBasicMaterial({
      color: isActive ? 0xfff2c0 : 0x332f28,
      transparent: true,
      opacity: isActive ? 0.85 : 0.35,
    });
    const winGeo = new THREE.PlaneGeometry(def.w * 0.8, def.h * 0.8);
    const winMesh = new THREE.Mesh(winGeo, winMat);
    winMesh.position.set(def.x, def.h / 2, def.z + def.d / 2 + 0.01);
    scene.add(winMesh);
  }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onClick(ev) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(buildings);
    if (hits.length) {
      const key = hits[0].object.userData.key;
      showOfficeTooltip(key, ev.clientX - rect.left, ev.clientY - rect.top, lastActivityByProfile, sessions, summary);
    } else {
      tooltip.classList.add('hidden');
    }
  }
  canvas.addEventListener('click', onClick);

  loadingOverlay.remove();

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    if (!wrap.isConnected) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

function showOfficeTooltip(key, x, y, lastActivityByProfile, sessions, summary) {
  const tooltip = $('#office-tooltip');
  const meta = AGENT_META[key];
  const count = key === 'orchestrator' ? sessions.length : sessions.filter((s) => s.profile === key).length;
  const last = lastActivityByProfile[key];
  tooltip.innerHTML = '';
  tooltip.appendChild(el('div', { class: 'flex items-center gap-2 mb-1' }, [agentBadge(key, 'w-6 h-6 text-[9px]'), el('span', { class: 'font-semibold' }, meta.name)]));
  tooltip.appendChild(el('div', { class: 'text-cream/60' }, `${meta.role} · ${count} sessions`));
  tooltip.appendChild(el('div', { class: 'text-cream/40 mt-1' }, `Last active: ${last ? timeAgo(last) : 'n/a'}`));
  tooltip.style.left = `${Math.min(x + 10, 400)}px`;
  tooltip.style.top = `${Math.max(y - 10, 10)}px`;
  tooltip.classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// CONTENT TAB ("Library")
// ---------------------------------------------------------------------------

TAB_LOADERS.content = async function renderContent() {
  const mount = $('#content-mount');
  mount.innerHTML = '<div class="loading-shimmer h-64 rounded-3xl"></div>';

  let data;
  try {
    data = await fetchJSON('/api/content');
  } catch (e) {
    mount.innerHTML = `<div class="text-red-600 text-sm">Erro: ${escapeHtml(e.message)}</div>`;
    return;
  }

  mount.innerHTML = '';
  const docs = data.documents || [];
  const latest = docs[0] ? timeAgo(docs[0].timestamp) : '—';

  mount.appendChild(heroCard({
    title: 'Library.',
    titleItalic: '',
    subtitle: data.note,
    extra: el('div', { class: 'flex items-center gap-4' }, [
      statPill('Total docs', data.total ?? 0),
      statPill('Agents writing', (data.agents_writing || []).length),
      statPill('Latest', latest),
    ]),
  }));

  if (!docs.length) {
    mount.appendChild(contentCard([
      el('div', { class: 'text-center py-16' }, [
        el('div', { class: 'text-sm font-semibold mb-1' }, 'Nenhum documento encontrado ainda.'),
        el('div', { class: 'text-xs text-black/40' }, 'Quando algum agente gerar respostas longas (600+ caracteres), elas vão aparecer aqui.'),
      ]),
    ]));
    return;
  }

  const grid = el('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-5' });
  for (const d of docs) {
    grid.appendChild(contentCard([
      el('div', { class: 'flex items-center gap-2 mb-2' }, [
        agentBadge(d.profile, 'w-6 h-6 text-[9px]'),
        el('span', { class: 'text-[10px] uppercase tracking-wider text-black/40' }, `${AGENT_META[d.profile]?.name || d.profile} · ${timeAgo(d.timestamp)}`),
      ]),
      el('div', { class: 'text-sm font-medium mb-2 leading-snug' }, d.title),
      el('div', { class: 'text-xs text-black/50 leading-relaxed' }, d.excerpt),
      el('div', { class: 'text-[10px] text-black/30 mt-3' }, `${d.char_count} caracteres · session ${d.session_id}`),
    ]));
  }
  mount.appendChild(grid);
};

// ---------------------------------------------------------------------------
// SCHEDULE TAB (cron)
// ---------------------------------------------------------------------------

TAB_LOADERS.schedule = async function renderSchedule() {
  const mount = $('#schedule-mount');
  mount.innerHTML = '<div class="loading-shimmer h-64 rounded-3xl"></div>';

  let jobs, executions;
  try {
    [jobs, executions] = await Promise.all([
      fetchJSON('/api/cron/jobs'),
      fetchJSON('/api/cron/executions?limit=200'),
    ]);
  } catch (e) {
    mount.innerHTML = `<div class="text-red-600 text-sm">Erro: ${escapeHtml(e.message)}</div>`;
    return;
  }

  mount.innerHTML = '';
  const activeCount = executions.filter((e) => ['running', 'claimed'].includes((e.status || '').toLowerCase())).length;

  mount.appendChild(heroCard({
    title: 'Schedule.',
    titleItalic: '',
    subtitle: 'Every recurring job Hermes runs across the fleet, and its most recent execution.',
    extra: el('div', { class: 'flex items-center gap-4' }, [
      statPill('Hermes jobs', jobs.length),
      statPill('Active', activeCount),
      statPill('Next run', '—'),
    ]),
  }));

  if (!jobs.length) {
    mount.appendChild(contentCard([
      el('div', { class: 'text-center py-16' }, [
        el('div', { class: 'text-sm font-semibold mb-1' }, 'Nenhum cron job registrado ainda.'),
        el('div', { class: 'text-xs text-black/40' }, 'Fonte: cron/executions.db (global e por perfil).'),
      ]),
    ]));
    return;
  }

  const grid = el('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-5' });
  for (const j of jobs) {
    const status = (j.status || 'unknown').toLowerCase();
    const statusCls = status === 'completed' || status === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'failed' || status === 'error'
      ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700';
    grid.appendChild(contentCard([
      el('div', { class: 'flex items-center justify-between mb-2' }, [
        el('span', { class: 'text-sm font-semibold truncate' }, j.job_id),
        el('span', { class: `text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusCls}` }, status),
      ]),
      el('div', { class: 'text-[10px] uppercase tracking-wider text-black/40 mb-3' }, `Profile: ${j.profile}`),
      el('div', { class: 'text-xs text-black/50 mb-4' }, `Última execução: ${j.claimed_at ? fmtEpoch(typeof j.claimed_at === 'string' ? Date.parse(j.claimed_at) / 1000 : j.claimed_at) : '—'}`),
      el('div', { class: 'flex gap-2' }, [
        el('button', { class: 'text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-black/5 text-black/40', title: 'Visual only for now' }, 'Run'),
        el('button', { class: 'text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-black/5 text-black/40', title: 'Visual only for now' }, 'Pause'),
        el('button', { class: 'text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-black/5 text-black/40', title: 'Visual only for now' }, 'Delete'),
      ]),
    ]));
  }
  mount.appendChild(grid);
};

// ---------------------------------------------------------------------------
// DOCS TAB (static help content)
// ---------------------------------------------------------------------------

const DOCS_SECTIONS = [
  { id: 'overview', label: 'Overview', html: `
    <p><strong>One orchestrator. Four specialists.</strong> — título fixo, sem dado dinâmico.</p>
    <p><strong>Recent activity</strong> — últimas mensagens reais de qualquer agente. Fonte: <code>/api/messages</code> (state.db de cada perfil).</p>
    <p><strong>Active Missions</strong> — quantas tarefas estão abertas agora (To do + In progress) no board. Fonte: <code>kanban.db</code> via <code>/api/summary</code>.</p>
    <p><strong>Load distribution</strong> — anel mostrando proporção de sessions por agente (dev/scout/scribe/reach). Fonte: contagem real de sessions por perfil.</p>
    <p><strong>Sessions by agent / Fleet throughput</strong> — contagem real de sessions (não "tarefas resolvidas" no sentido estrito — é um proxy real de atividade).</p>
  `},
  { id: 'agents', label: 'Agents', html: `
    <p>5 cards: Orchestrator (conceitual, não tem state.db próprio) + os 4 perfis reais (dev, scout, scribe, reach).</p>
    <p><strong>Status ACTIVE/IDLE</strong> — ACTIVE se a última sessão do perfil teve atividade nas últimas 2 horas.</p>
    <p><strong>Load</strong> — barra relativa ao perfil com mais sessions no momento.</p>
    <p><strong>Model</strong> — modelo (campo <code>model</code>) da sessão mais recente daquele perfil.</p>
    <p><strong>Model routing</strong> — mesmo dado, em formato de lista.</p>
  `},
  { id: 'chat', label: 'Chat', html: `
    <p>Chat é <strong>funcional de verdade</strong>. O histórico vem de <code>/api/messages?profile=X</code>.</p>
    <p>Enviar uma mensagem chama <code>POST /api/chat/send</code>, que executa <code>&lt;profile&gt; chat -q "..." --oneshot -Q</code> via subprocess real — isso custa dinheiro de API de verdade e pode levar até 2 minutos.</p>
    <p>Orchestrator não tem alias de CLI próprio nesta instalação, então o envio fica desabilitado para ele (só histórico, quando existir).</p>
  `},
  { id: 'tasks', label: 'Tasks', html: `
    <p><strong>Every mission, in motion</strong> — kanban real, fonte <code>/api/kanban</code> (kanban.db).</p>
    <p>Mapeamento de status: <code>todo</code>/<code>triage</code> → "To do"; <code>in_progress</code>/<code>blocked</code>/outros → "In progress"; <code>done</code>/<code>completed</code> → "Done".</p>
    <p>Prioridade numérica (0,1,2+) mapeada para badges P3/P2/P1.</p>
    <p><strong>"+ New mission"</strong> é só visual — este dashboard nunca escreve no kanban.db.</p>
  `},
  { id: 'office', label: 'Office', html: `
    <p>Cena 3D via three.js (CDN). 1 prédio central (HQ/Orchestrator) + 4 prédios menores (dev/scout/scribe/reach).</p>
    <p><strong>Janelas acesas</strong> — proporcional a atividade real: perfil com sessão nas últimas 2h fica com emissive mais forte.</p>
    <p><strong>Lights on</strong> (contador do hero) — quantos dos 4 perfis reais tiveram atividade nas últimas 2h.</p>
    <p>Clique num prédio para ver um tooltip com stats reais daquele agente.</p>
    <p>Se o CDN do three.js falhar, aparece uma mensagem de erro amigável e o resto do dashboard continua funcionando.</p>
  `},
  { id: 'content', label: 'Content', html: `
    <p><strong>Decisão de design:</strong> não existe tabela de "documentos" no banco atual. Para não inventar dados falsos, esta aba usa mensagens longas (role=assistant, 600+ caracteres) como proxy real de "conteúdo escrito" por agente.</p>
    <p>Isso é dado 100% real (rastreável até uma linha em <code>messages</code>), só não é literalmente um "documento" — é rotulado como tal na própria API (<code>source: derived_from_messages</code>).</p>
    <p>Se não houver nenhuma mensagem longa, a aba mostra estado vazio explícito, nunca dado fake.</p>
  `},
  { id: 'schedule', label: 'Schedule', html: `
    <p>Lista de cron jobs reais, fonte <code>/api/cron/jobs</code> e <code>/api/cron/executions</code> (executions.db, global e por perfil).</p>
    <p>Não existe tabela de definição de job separada — cada "job" é derivado da execução mais recente daquele <code>job_id</code>.</p>
    <p>Botões RUN/Pause/Delete são apenas visuais — disparo real de cron não foi implementado (fica para um próximo pedido, por segurança).</p>
  `},
  { id: 'data-safety', label: 'Data & Safety', html: `
    <p>Todas as conexões SQLite são abertas em modo <code>mode=ro</code> + <code>PRAGMA query_only=1</code> — nunca escrevem nos bancos do Hermes.</p>
    <p>A única rota com efeito colateral real é <code>POST /api/chat/send</code>, que dispara um subprocess real (custa API, pode demorar).</p>
    <p>Upload (<code>/api/upload</code>) tem whitelist de extensão e bloqueio de path traversal — rota herdada e não alterada nesta versão.</p>
  `},
  { id: 'controls', label: 'Controls', html: `
    <p>Busca, sino de notificação e relógio UTC no topo são majoritariamente visuais nesta versão (relógio é real, atualiza a cada segundo).</p>
    <p>Nenhum botão "visual only" executa ações reais — todos estão marcados com <code>title</code> explicando isso ao passar o mouse.</p>
  `},
];

TAB_LOADERS.docs = async function renderDocs() {
  const mount = $('#docs-mount');
  mount.innerHTML = '';

  mount.appendChild(heroCard({
    title: 'Know every',
    titleItalic: 'corner.',
    subtitle: 'A plain-language guide to every tab, panel, and number on your Hermes Mission Control dashboard — what it shows, where the data comes from, and how to use it. Nothing here is invented: every figure traces back to your real Hermes activity or your local files.',
  }));

  const pillNav = el('div', { class: 'flex flex-wrap gap-2 mb-6' });
  const sectionsWrap = el('div', { class: 'space-y-6' });

  for (const sec of DOCS_SECTIONS) {
    const pill = el('button', {
      class: 'docs-pill px-3.5 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-black/5 text-black/50 hover:bg-black/10',
      'data-target': `docs-sec-${sec.id}`,
    }, sec.label);
    pill.addEventListener('click', () => {
      $(`#docs-sec-${sec.id}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    pillNav.appendChild(pill);

    sectionsWrap.appendChild(contentCard([
      el('h3', { class: 'font-serif text-xl font-medium mb-3' }, sec.label),
      el('div', { class: 'prose-docs text-sm text-black/60 leading-relaxed space-y-2', html: sec.html }),
    ], ''), );
    sectionsWrap.lastChild.id = `docs-sec-${sec.id}`;
  }

  mount.appendChild(pillNav);
  mount.appendChild(sectionsWrap);
};

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initNav();
});
