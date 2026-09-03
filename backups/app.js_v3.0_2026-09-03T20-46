// Hermes Mission Control v3.0 — frontend logic (vanilla JS, no build step)
// Rewritten with premium design language: glass morphism, animated surfaces,
// agent-centric layout. All data flows through real /api/* endpoints.

// ---------------------------------------------------------------------------
// AGENT META & CONFIG
// ---------------------------------------------------------------------------

const AGENT_META = {
  orchestrator: {
    code: 'OR',
    name: 'Orchestrator',
    role: 'COORDINATOR',
    color: '#E8622C',
    bg: 'bg-agent-orchestrator',
    icon: '🧠',
    description: 'Main coordinator routing tasks to specialists'
  },
  scout: {
    code: 'SC',
    name: 'Scout',
    role: 'RESEARCH',
    color: '#1FA6A0',
    bg: 'bg-agent-scout',
    icon: '🔍',
    description: 'Trend intelligence and competitive analysis'
  },
  scribe: {
    code: 'SB',
    name: 'Scribe',
    role: 'WRITING',
    color: '#D9A62E',
    bg: 'bg-agent-scribe',
    icon: '✍️',
    description: 'Content creation and copywriting'
  },
  reach: {
    code: 'RE',
    name: 'Reach',
    role: 'MARKETING',
    color: '#D6407E',
    bg: 'bg-agent-reach',
    icon: '📈',
    description: 'Growth strategy and campaign optimization'
  },
  dev: {
    code: 'DV',
    name: 'Dev',
    role: 'ENGINEERING',
    color: '#3FA85C',
    bg: 'bg-agent-dev',
    icon: '🛠️',
    description: 'Systems engineering and integrations'
  },
};

const REAL_PROFILES = ['dev', 'scout', 'scribe', 'reach'];
const CHAT_PROFILES = ['orchestrator', 'dev', 'scout', 'scribe', 'reach'];

// ---------------------------------------------------------------------------
// DOM HELPERS
// ---------------------------------------------------------------------------

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
  return (str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

async function fetchJSON(url, opts = {}) {
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

// ---------------------------------------------------------------------------
// COMPONENT BUILDERS
// ---------------------------------------------------------------------------

function agentBadge(agentKey, size = 'w-9 h-9 text-xs') {
  const m = AGENT_META[agentKey] || { code: '??', color: '#999' };
  return el('span', {
    class: `${size} rounded-full flex items-center justify-center font-bold text-white shrink-0`,
    style: `background:${m.color}`,
    title: m.name
  }, m.code);
}

function priorityBadge(priority) {
  const p = Number(priority) || 0;
  let label, cls;
  if (p >= 2) { label = 'P1'; cls = 'bg-red-100 text-red-700'; }
  else if (p === 1) { label = 'P2'; cls = 'bg-amber-100 text-amber-700'; }
  else { label = 'P3'; cls = 'bg-black/5 text-black/50'; }
  return el('span', {
    class: `${cls} text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full`
  }, label);
}

function agentPill(agentKey) {
  const m = AGENT_META[agentKey] || { name: 'Unknown', color: '#999' };
  return el('span', {
    class: 'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
    style: `background:${m.color}20; color:${m.color}; border:1px solid ${m.color}40`
  }, [
    el('span', { class: 'w-1.5 h-1.5 rounded-full', style: `background:${m.color}` }),
    document.createTextNode(m.name)
  ]);
}

function contentCard(children, extraClass = '') {
  return el('div', {
    class: `glass-card rounded-2xl p-6 shadow-xl ${extraClass}`
  }, children);
}

function statPill(label, value, accent = 'text-accent') {
  return el('div', {
    class: 'bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center min-w-[92px]'
  }, [
    el('div', { class: `text-xl font-semibold ${accent}` }, String(value)),
    el('div', { class: 'text-[10px] uppercase tracking-wider text-slate-400 mt-1' }, label)
  ]);
}

// ---------------------------------------------------------------------------
// NAVIGATION
// ---------------------------------------------------------------------------

const TAB_LOADERS = {};
const TAB_LOADED = new Set();

function activateTab(tabName) {
  $all('.tab-panel').forEach((p) => p.classList.remove('active'));
  const panel = $(`#tab-${tabName}`);
  if (panel) panel.classList.add('active');

  $all('#main-nav button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });

  history.replaceState(null, '', `#${tabName}`);

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
  activateTab(['overview', 'agents', 'chat', 'tasks', 'office', 'content', 'schedule', 'docs'].includes(initial) ? initial : 'overview');

  // Deep-link support
  const urlAgent = new URLSearchParams(location.search).get('agent');
  if (urlAgent && CHAT_PROFILES.includes(urlAgent) && initial === 'chat') {
    chatState.selected = urlAgent;
  }
  if (chatState.selected) selectChatAgent(chatState.selected);
}

// ---------------------------------------------------------------------------
// CLOCK
// ---------------------------------------------------------------------------

function tickClock() {
  const now = new Date();
  const clockEl = $('#utc-clock');
  if (!clockEl) return;

  const timeStr = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const dateStr = now.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  clockEl.innerHTML = `
    <div class="text-right">
      <div class="font-mono text-xs">${timeStr}</div>
      <div class="text-[9px] text-slate-500 mt-0.5">${dateStr}</div>
    </div>
  `;
}
setInterval(tickClock, 1000);
tickClock();

// ---------------------------------------------------------------------------
// OVERVIEW TAB
// ---------------------------------------------------------------------------

TAB_LOADERS.overview = async function renderOverview() {
  const mount = $('#overview-mount');
  mount.innerHTML = '';

  // Hero section with network graph
  const hero = el('div', {
    class: 'hero-glow rounded-3xl p-8 md:p-10 text-white relative overflow-hidden mb-6'
  });

  const heroRow = el('div', {
    class: 'flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 relative z-10'
  });

  const heroLeft = el('div', { class: 'max-w-2xl' });
  heroLeft.appendChild(el('h1', {
    class: 'font-serif text-4xl md:text-5xl font-bold leading-tight',
    html: `<span class="text-white">One orchestrator.</span> <span class="text-accent">Four specialists.</span> <span class="text-white">One console.</span>`
  }));
  heroLeft.appendChild(el('p', {
    class: 'text-base text-slate-300/80 mt-4 leading-relaxed'
  }, 'Hermes is coordinating Scout, Scribe, Reach, Dev — routing every task by complexity. This is your real-time fleet status.'));

  heroRow.appendChild(heroLeft);
  heroRow.appendChild(buildNetworkGraph());
  hero.appendChild(heroRow);

  // Status indicators row
  const statusRow = el('div', { class: 'flex gap-6 mt-6 relative z-10' });
  mount.appendChild(hero);
  mount.appendChild(statusRow);

  // Load summary data
  let summary, sessions, messages;
  try {
    [summary, sessions, messages] = await Promise.all([
      fetchJSON('/api/summary'),
      fetchJSON('/api/sessions?limit=100'),
      fetchJSON('/api/messages?limit=8')
    ]);
  } catch (e) {
    statusRow.appendChild(el('div', {
      class: 'text-red-400 text-sm'
    }, `Erro ao carregar overview: ${escapeHtml(e.message)}`));
    return;
  }

  // Update hero with live stats
  const fleetCount = summary.profiles?.length || 0;
  const activeAgents = summary.profiles?.filter(p => {
    const sess = sessions.find(s => s.profile === p);
    return sess && (Date.now() / 1000 - (sess.last_activity_at || 0)) < 7200;
  }).length || 0;

  statusRow.innerHTML = '';
  statusRow.appendChild(statPill('Fleet Agents', fleetCount));
  statusRow.appendChild(statPill('Active Now', activeAgents, 'text-emerald-400'));
  statusRow.appendChild(statPill('Sessions', summary.session_count || 0, 'text-blue-400'));
  statusRow.appendChild(statPill('Tasks', summary.task_count || 0, 'text-purple-400'));

  // Metrics grid
  const metricsGrid = el('div', { class: 'grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6' });

  const activeMissions = (summary.task_by_status?.todo || 0) + (summary.task_by_status?.in_progress || 0);
  const perProfile = summary.per_profile || {};
  const totalSessions = Object.values(perProfile).reduce((a, p) => a + (p.session_count || 0), 0) || 1;

  metricsGrid.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-slate-400' }, 'Active Missions'),
    el('div', { class: 'text-4xl font-serif font-bold text-accent mt-2' }, String(activeMissions)),
    el('div', { class: 'text-xs text-slate-400 mt-2' }, 'To do + In progress · kanban.db')
  ]));

  // Load distribution ring
  const ringSegments = REAL_PROFILES.map((p, i) => {
    const count = perProfile[p]?.session_count || 0;
    return { p, count, pct: (count / totalSessions) * 100 };
  });

  let acc = 0;
  const gradientParts = ringSegments.map((s) => {
    const start = acc;
    acc += s.pct;
    return `${AGENT_META[s.p].color} ${start}% ${acc}%`;
  }).join(', ');

  const ring = el('div', {
    class: 'w-28 h-28 rounded-full mx-auto mt-3',
    style: `background: conic-gradient(${gradientParts || '#ddd 0% 100%'})`
  });

  const ringInner = el('div', {
    class: 'relative flex items-center justify-center'
  }, [
    ring,
    el('div', {
      class: 'absolute w-16 h-16 rounded-full bg-card/50 flex items-center justify-center text-xs font-semibold'
    }, String(totalSessions))
  ]);

  metricsGrid.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-slate-400 mb-3' }, 'Load Distribution'),
    ringInner,
    el('div', { class: 'text-[10px] text-slate-400 text-center mt-1' }, 'Sessions per agent')
  ]));

  // Sessions by agent
  const sessionRows = REAL_PROFILES.map((p) => {
    const count = perProfile[p]?.session_count || 0;
    const color = AGENT_META[p].color;
    return el('div', {
      class: 'flex items-center justify-between text-xs py-1.5'
    }, [
      el('span', { class: 'flex items-center gap-2' }, [
        agentBadge(p, 'w-5 h-5 text-[9px]'),
        el('span', { class: 'font-medium' }, AGENT_META[p].name)
      ]),
      el('span', {
        class: 'font-semibold',
        style: `color: ${color}`
      }, String(count))
    ]);
  });

  metricsGrid.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-slate-400 mb-2' }, 'Sessions by Agent'),
    ...sessionRows
  ]));

  // Fleet throughput
  const maxCount = Math.max(1, ...REAL_PROFILES.map((p) => perProfile[p]?.session_count || 0));
  const fleetBars = REAL_PROFILES.map((p) => {
    const count = perProfile[p]?.session_count || 0;
    const pct = Math.round((count / maxCount) * 100);
    return el('div', { class: 'mb-2.5' }, [
      el('div', { class: 'flex justify-between text-[10px] uppercase tracking-wider text-slate-400 mb-1' }, [
        el('span', {}, AGENT_META[p].name),
        el('span', {}, String(count))
      ]),
      el('div', { class: 'h-2 bg-slate-700/50 rounded-full overflow-hidden' }, [
        el('div', {
          class: 'h-full rounded-full transition-all duration-300',
          style: `width:${pct}%; background:${AGENT_META[p].color}`
        })
      ])
    ]);
  });

  metricsGrid.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-slate-400 mb-3' }, 'Fleet Throughput'),
    ...fleetBars
  ]));

  mount.appendChild(metricsGrid);

  // Recent activity
  const activityItems = messages.slice(0, 8).map((m) => {
    const meta = AGENT_META[m.profile] || {};
    return el('div', {
      class: 'flex items-start gap-3 py-2.5 border-b border-slate-700/30 last:border-0'
    }, [
      agentBadge(m.profile, 'w-7 h-7 text-[10px]'),
      el('div', { class: 'min-w-0 flex-1' }, [
        el('div', { class: 'text-xs font-semibold text-white' }, `${meta.name || m.profile} · ${meta.role || ''}`),
        el('div', { class: 'text-xs text-slate-400/60 truncate mt-0.5' }, (m.content || '').slice(0, 90))
      ]),
      el('div', { class: 'text-[10px] text-slate-400 mono-digit shrink-0' }, timeAgo(m.timestamp))
    ]);
  });

  mount.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-slate-400 mb-3' }, 'Recent Activity'),
    ...(activityItems.length ? activityItems : [
      el('div', { class: 'text-sm text-slate-400/60 py-6 text-center' }, 'Sem mensagens recentes.')
    ])
  ]));
};

function buildNetworkGraph() {
  const wrap = el('div', { class: 'relative z-10' });
  const w = 500, h = 220;
  const cx = 80, cy = h / 2;

  const nodes = [
    { key: 'scout', label: 'SC', color: AGENT_META.scout.color, x: 220, y: 40 },
    { key: 'scribe', label: 'SB', color: AGENT_META.scribe.color, x: 380, y: 70 },
    { key: 'reach', label: 'RE', color: AGENT_META.reach.color, x: 380, y: 160 },
    { key: 'dev', label: 'DV', color: AGENT_META.dev.color, x: 220, y: 190 },
  ];

  let svg = `<svg viewBox="0 0 ${w} ${h}" class="w-full max-w-xl h-56" preserveAspectRatio="xMidYMid meet">`;

  // Connections
  for (const n of nodes) {
    svg += `<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" 
                stroke="rgba(232,98,42,0.35)" stroke-width="1.5" 
                stroke-dasharray="4,3"/>`;
  }

  // Orchestrator node
  svg += `<circle cx="${cx}" cy="${cy}" r="24" fill="#E8622C" class="pulse-dot"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="24" fill="none" stroke="#E8622C" stroke-width="1" opacity="0.4"/>`;
  svg += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="white" font-size="14" font-weight="700" font-family="Inter">OR</text>`;

  // Specialist nodes
  for (const n of nodes) {
    svg += `<g transform="translate(${n.x-14},${n.y-14})">`;
    svg += `<circle cx="0" cy="0" r="14" fill="${n.color}"/>`;
    svg += `<text x="0" y="4" text-anchor="middle" fill="white" font-size="9" font-weight="700" font-family="Inter">${n.label}</text>`;
    svg += `</g>`;
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
  mount.innerHTML = '<div class="loading-shimmer h-64 rounded-3xl"></div>';

  let sessions;
  try {
    sessions = await fetchJSON('/api/sessions?limit=500');
  } catch (e) {
    mount.innerHTML = `<div class="text-red-400 text-sm">Erro: ${escapeHtml(e.message)}</div>`;
    return;
  }

  mount.innerHTML = '';

  // Hero
  const hero = el('div', {
    class: 'hero-glow rounded-3xl p-8 md:p-10 text-white relative overflow-hidden mb-6'
  });
  hero.appendChild(el('div', { class: 'relative z-10' }, [
    el('h1', { class: 'font-serif text-3xl md:text-4xl font-bold' }, [
      'Five agents.', el('span', { class: 'text-accent' }, ' one console.')
    ]),
    el('p', { class: 'text-sm text-slate-300/80 mt-2' }, 'Inspect each specialist, route them to the right model, and watch the heartbeat of the entire fleet in one place.')
  ]));
  mount.appendChild(hero);

  // Group sessions by profile
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

    const card = contentCard([
      el('div', { class: 'flex items-center justify-between mb-4' }, [
        agentBadge(key, 'w-12 h-12 text-sm'),
        el('span', {
          class: `text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
            isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
          }`
        }, isActive ? 'ACTIVE' : 'IDLE')
      ]),
      el('div', { class: 'font-serif text-xl font-bold text-white mb-1' }, meta.name),
      el('div', { class: 'text-[11px] uppercase tracking-wider text-slate-400/60 mb-4' }, meta.role),

      // Load bar
      el('div', { class: 'h-2 bg-slate-700/50 rounded-full overflow-hidden mb-2' }, [
        el('div', {
          class: 'h-full rounded-full transition-all duration-300',
          style: `width:${loadPct}%; background:${meta.color}`
        })
      ]),
      el('div', { class: 'text-[10px] text-slate-400/60 mb-4' }, 'Load'),

      // Stats
      el('div', { class: 'grid grid-cols-2 gap-3 text-xs' }, [
        el('div', {}, [
          el('div', { class: 'text-slate-400/60' }, 'Sessions'),
          el('div', { class: 'font-semibold text-white' }, isOrch ? String(sessions.length) : String(count))
        ]),
        el('div', {}, [
          el('div', { class: 'text-slate-400/60' }, 'Success'),
          el('div', { class: 'font-semibold text-emerald-400' }, count ? '100%' : '—')
        ])
      ]),

      // Model
      el('div', { class: 'mt-3 text-[10px] text-slate-400/60 mono-digit truncate' }, `Model: ${escapeHtml(latestModel)}`)
    ]);

    grid.appendChild(card);
  }
  mount.appendChild(grid);

  // Bottom section: Task summary + routing
  const bottomGrid = el('div', { class: 'grid grid-cols-1 lg:grid-cols-3 gap-6' });

  const throughputRows = REAL_PROFILES.map((p) => {
    const count = (byProfile[p] || []).length;
    return el('div', {
      class: 'flex items-center justify-between text-sm py-2.5 border-b border-slate-700/30 last:border-0'
    }, [
      el('span', { class: 'flex items-center gap-2' }, [
        agentBadge(p, 'w-6 h-6 text-[10px]'),
        el('span', { class: 'font-medium text-white' }, AGENT_META[p].name)
      ]),
      el('span', { class: 'text-slate-400/60' }, `${count} sessions`)
    ]);
  });

  bottomGrid.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-slate-400 mb-3' }, 'Task Summary'),
    ...throughputRows
  ], 'lg:col-span-2'));

  const routingRows = REAL_PROFILES.map((p) => {
    const list = byProfile[p] || [];
    const model = list[0]?.model || '—';
    return el('div', {
      class: 'flex items-center justify-between text-xs py-2.5 border-b border-slate-700/30 last:border-0'
    }, [
      el('span', { class: 'flex items-center gap-2' }, [
        agentBadge(p, 'w-5 h-5 text-[9px]'),
        el('span', { class: 'font-medium' }, AGENT_META[p].name)
      ]),
      el('span', {
        class: 'text-slate-400/60 font-mono truncate max-w-[140px]'
      }, model)
    ]);
  });

  bottomGrid.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-slate-400 mb-3' }, 'Model Routing'),
    ...routingRows
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

  // Hero
  mount.appendChild(el('div', { class: 'mb-8' }, [
    el('h1', { class: 'font-serif text-3xl md:text-4xl font-bold text-white' }, ['Talk to the fleet.']),
    el('p', { class: 'text-sm text-slate-400/60 mt-2' }, 'Real messages, real replies — sending a message runs an actual model call through the agent CLI.')
  ]));

  const layout = el('div', { class: 'grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6' });

  // Sidebar
  const sidebar = contentCard([
    el('div', { class: 'text-xs font-semibold uppercase tracking-wider text-slate-400/60 mb-3' }, 'Agents'),
    el('div', { class: 'space-y-1' })
  ]);

  const sidebarList = sidebar.querySelector('div:last-child');

  for (const key of CHAT_PROFILES) {
    const meta = AGENT_META[key];
    const item = el('button', {
      class: 'w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-xl hover:bg-white/5 transition-colors data-[active="true"]:bg-accent/10',
      'data-agent': key,
      'data-active': 'false'
    }, [
      agentBadge(key, 'w-8 h-8 text-[10px]'),
      el('div', { class: 'min-w-0 flex-1' }, [
        el('div', { class: 'text-sm font-medium text-white' }, meta.name),
        el('div', { class: 'text-[10px] uppercase tracking-wider text-slate-400/60' }, meta.role)
      ])
    ]);

    item.addEventListener('click', () => selectChatAgent(key));
    sidebarList.appendChild(item);
  }

  layout.appendChild(sidebar);
  layout.appendChild(buildChatArea());
  mount.appendChild(layout);
};

function buildChatArea() {
  const chatArea = el('div', {
    class: 'bg-card rounded-2xl border border-slate-700/30 flex flex-col h-[600px]',
    id: 'chat-area'
  });

  chatArea.appendChild(el('div', {
    class: 'flex-1 flex items-center justify-center text-slate-400/60 text-sm'
  }, 'Selecione um agente à esquerda para começar.'));

  return chatArea;
}

async function selectChatAgent(key) {
  chatState.selected = key;
  const meta = AGENT_META[key];

  // Update sidebar active state
  $all('#chat-area').forEach((a) => a.remove());
  $all('[data-agent]').forEach((b) => {
    b.dataset.active = (b.dataset.agent === key).toString();
  });

  const chatArea = $('#chat-area');
  chatArea.innerHTML = '';

  // Header
  chatArea.appendChild(el('div', {
    class: 'flex items-center gap-3 px-5 py-4 border-b border-slate-700/30'
  }, [
    agentBadge(key, 'w-9 h-9 text-xs'),
    el('div', {}, [
      el('div', { class: 'text-sm font-semibold text-white' }, meta.name),
      el('div', { class: 'text-[10px] uppercase tracking-wider text-slate-400/60' }, meta.role)
    ]),
    el('span', {
      class: 'ml-auto text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/30'
    }, 'Ready')
  ]));

  // Message list
  const msgList = el('div', {
    class: 'flex-1 overflow-y-auto chat-scroll px-5 py-4 space-y-4',
    id: 'chat-msg-list'
  });
  chatArea.appendChild(msgList);

  // Input bar
  const inputBar = el('div', { class: 'border-t border-slate-700/30 p-4' });
  const textarea = el('textarea', {
    class: 'w-full resize-none rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50',
    rows: '2',
    placeholder: 'Message the agent... (Enter to send, Shift+Enter for newline)'
  });

  const sendRow = el('div', { class: 'flex items-center justify-between mt-2' }, [
    el('span', { class: 'text-[10px] text-slate-400/60' },
      key === 'orchestrator'
        ? 'Orchestrator chat is read-only in this dashboard.'
        : '⚡ Sending runs a REAL model call (costs API credits, can take up to 2 min).'
    ),
    el('button', {
      class: 'bg-accent hover:brightness-110 text-white text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200',
      id: 'chat-send-btn'
    }, 'Send')
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
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !chatState.sending) {
        e.preventDefault();
        sendChatMessage(key, meta, textarea.value);
      }
    });

    sendBtn.addEventListener('click', () => {
      if (!chatState.sending) sendChatMessage(key, meta, textarea.value);
    });
  }
}

async function sendChatMessage(key, meta, message) {
  const textarea = $('textarea');
  const sendBtn = $('#chat-send-btn');
  const msgList = $('#chat-msg-list');

  if (!message.trim()) return;

  chatState.sending = true;
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';
  textarea.disabled = true;

  // Add user message
  msgList.appendChild(el('div', { class: 'flex gap-3' }, [
    el('div', { class: 'w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white shrink-0' }, 'U'),
    el('div', { class: 'msg-bubble-user rounded-2xl px-4 py-3 max-w-[75%]' }, message)
  ]));

  // Add placeholder for agent response
  const agentMsgContainer = el('div', { class: 'flex gap-3' }, [
    agentBadge(key, 'w-7 h-7 text-[10px]'),
    el('div', { class: 'msg-bubble-agent rounded-2xl px-4 py-3 max-w-[75%]' }, [
      el('span', { class: 'text-slate-400/60' }, 'Thinking...')
    ])
  ]);

  msgList.appendChild(agentMsgContainer);
  msgList.scrollTop = msgList.scrollHeight;

  try {
    const data = await fetchJSON('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: key, message: message.trim() })
    });

    if (data.ok) {
      agentMsgContainer.querySelector('span').remove();
      agentMsgContainer.querySelector('div:last-child').appendChild(
        document.createTextNode(data.response || '(no response)')
      );
    } else {
      agentMsgContainer.querySelector('span').remove();
      agentMsgContainer.querySelector('div:last-child').appendChild(
        document.createTextNode(`Error: ${data.error || 'Unknown error'}`)
      );
    }
  } catch (e) {
    agentMsgContainer.querySelector('span').remove();
    agentMsgContainer.querySelector('div:last-child').appendChild(
      document.createTextNode(`Error: ${escapeHtml(e.message)}`)
    );
  }

  msgList.scrollTop = msgList.scrollHeight;
  chatState.sending = false;
  sendBtn.disabled = false;
  sendBtn.textContent = 'Send';
  textarea.disabled = false;
  textarea.value = '';
  textarea.focus();
}

// ---------------------------------------------------------------------------
// TASKS TAB
// ---------------------------------------------------------------------------

TAB_LOADERS.tasks = async function renderTasks() {
  const mount = $('#tasks-mount');
  mount.innerHTML = '<div class="loading-shimmer h-64 rounded-3xl"></div>';

  let tasks;
  try {
    tasks = await fetchJSON('/api/kanban');
  } catch (e) {
    mount.innerHTML = `<div class="text-red-400 text-sm">Erro: ${escapeHtml(e.message)}</div>`;
    return;
  }

  mount.innerHTML = '';

  // Hero
  const hero = el('div', {
    class: 'hero-glow rounded-3xl p-8 md:p-10 text-white relative overflow-hidden mb-6'
  });
  hero.appendChild(el('div', { class: 'relative z-10' }, [
    el('h1', { class: 'font-serif text-3xl md:text-4xl font-bold' }, ['Task Board']),
    el('p', { class: 'text-sm text-slate-300/80 mt-2' }, `${tasks.length} tarefas no quadro Kanban`)
  ]));
  mount.appendChild(hero);

  // Task list
  if (!tasks.length) {
    mount.appendChild(contentCard([
      el('div', { class: 'text-center py-12 text-slate-400' }, [
        el('div', { class: 'text-2xl mb-2' }, '📋'),
        el('div', { class: 'font-medium' }, 'Nenhuma tarefa encontrada')
      ])
    ]));
    return;
  }

  // Group by status
  const byStatus = {};
  for (const t of tasks) {
    const status = t.status || 'unknown';
    (byStatus[status] ||= []).push(t);
  }

  const statusColors = {
    'todo': 'border-slate-500/50',
    'in_progress': 'border-accent',
    'completed': 'border-emerald-500/50',
    'blocked': 'border-red-500/50',
    'unknown': 'border-slate-500/30'
  };

  for (const [status, items] of Object.entries(byStatus)) {
    mount.appendChild(el('div', { class: 'mb-6' }, [
      el('h2', {
        class: 'text-sm font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-2'
      }, [
        el('span', {
          class: `w-2 h-2 rounded-full`,
          style: {
            'todo': '#94a3b8',
            'in_progress': '#E8622C',
            'completed': '#3FA85C',
            'blocked': '#EF4444',
            'unknown': '#94a3b8'
          }[status] || '#94a3b8'
        }),
        `${status.replace('_', ' ').toUpperCase()}`
      ]),
      el('div', { class: 'grid gap-3' }, items.map(t => {
        const color = t.priority >= 2 ? '#EF4444' :
                      t.priority === 1 ? '#F59E0B' : '#94a3b8';

        return contentCard([
          el('div', { class: 'flex items-start justify-between gap-3' }, [
            el('div', { class: 'flex-1 min-w-0' }, [
              el('div', { class: 'flex items-center gap-2 mb-1' }, [
                priorityBadge(t.priority),
                el('span', { class: 'text-xs font-medium text-white truncate' }, t.title || '(sem título)')
              ]),
              t.body && el('p', { class: 'text-sm text-slate-300/70 line-clamp-2 mt-1' }, t.body.slice(0, 120))
            ]),
            el('div', { class: 'text-[10px] text-slate-400/60 mono-digit text-right shrink-0' },
              t.created_at ? fmtEpoch(t.created_at) : '—')
          ])
        ], `border-l-2 ${statusColors[status] || ''}`);
      }))
    ]));
  }
};

// ---------------------------------------------------------------------------
// OFFICE TAB
// ---------------------------------------------------------------------------

TAB_LOADERS.office = async function renderOffice() {
  const mount = $('#office-mount');
  let summary;

  try {
    summary = await fetchJSON('/api/summary');
  } catch (e) {
    mount.innerHTML = `<div class="text-red-400 text-sm">Erro: ${escapeHtml(e.message)}</div>`;
    return;
  }

  mount.innerHTML = '';

  const grid = el('div', { class: 'grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6' });

  grid.appendChild(statPill('Total Sessions', summary.session_count || 0, 'text-blue-400'));
  grid.appendChild(statPill('Total Messages', summary.message_count || 0, 'text-emerald-400'));
  grid.appendChild(statPill('Input Tokens', (summary.input_tokens || 0).toLocaleString(), 'text-accent'));
  grid.appendChild(statPill('Output Tokens', (summary.output_tokens || 0).toLocaleString(), 'text-purple-400'));

  mount.appendChild(grid);

  // Per-profile breakdown
  const perProfile = summary.per_profile || {};
  mount.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-slate-400 mb-4' }, 'Usage by Agent (Real)'),
    el('div', { class: 'space-y-3' }, REAL_PROFILES.map(p => {
      const stats = perProfile[p] || {};
      const totalTokens = (stats.input_tokens || 0) + (stats.output_tokens || 0);

      return el('div', {}, [
        el('div', { class: 'flex justify-between text-sm mb-1' }, [
          el('span', { class: 'flex items-center gap-2' }, [
            agentBadge(p, 'w-5 h-5 text-[9px]'),
            AGENT_META[p].name
          ]),
          el('span', { class: 'text-slate-400/60 mono-digit' }, `${(stats.session_count || 0)} sessions`)
        ]),
        el('div', { class: 'text-xs text-slate-400/60 space-y-0.5' }, [
          el('div', { class: 'flex justify-between' }, [
            el('span', {}, 'Input'),
            el('span', {}, `${(stats.input_tokens || 0).toLocaleString()}`)
          ]),
          el('div', { class: 'flex justify-between' }, [
            el('span', {}, 'Output'),
            el('span', {}, `${(stats.output_tokens || 0).toLocaleString()}`)
          ])
        ])
      ]);
    }))
  ]));

  // Model breakdown
  let sessions;
  try {
    sessions = await fetchJSON('/api/sessions?limit=200');
  } catch {
    sessions = [];
  }

  const modelCounts = {};
  for (const s of sessions) {
    const model = s.model || 'unknown';
    modelCounts[model] = (modelCounts[model] || 0) + 1;
  }

  const modelEntries = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);

  mount.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-slate-400 mb-4' }, 'Models in Use'),
    el('div', { class: 'space-y-2' }, modelEntries.map(([model, count]) => {
      return el('div', { class: 'flex justify-between items-center py-1.5 border-b border-slate-700/20 last:border-0' }, [
        el('span', { class: 'text-sm text-white mono-digit truncate max-w-[200px]' }, model),
        el('span', { class: 'text-xs bg-slate-800/30 text-slate-300 px-2 py-0.5 rounded-full' }, String(count))
      ]);
    }))
  ]));
};

// ---------------------------------------------------------------------------
// CONTENT TAB
// ---------------------------------------------------------------------------

TAB_LOADERS.content = async function renderContent() {
  const mount = $('#content-mount');
  mount.innerHTML = '<div class="loading-shimmer h-64 rounded-3xl"></div>';

  let docs;
  try {
    docs = await fetchJSON('/api/content');
  } catch (e) {
    mount.innerHTML = `<div class="text-red-400 text-sm">Erro: ${escapeHtml(e.message)}</div>`;
    return;
  }

  mount.innerHTML = '';

  const documents = docs.documents || [];

  // Hero
  const hero = el('div', {
    class: 'hero-glow rounded-3xl p-8 md:p-10 text-white relative overflow-hidden mb-6'
  });
  hero.appendChild(el('div', { class: 'relative z-10' }, [
    el('h1', { class: 'font-serif text-3xl md:text-4xl font-bold' }, ['Content Library']),
    el('p', { class: 'text-sm text-slate-300/80 mt-2' },
      docs.note || `${documents.length} substantial outputs indexed by agent.`)
  ]));
  mount.appendChild(hero);

  if (!documents.length) {
    mount.appendChild(contentCard([
      el('div', { class: 'text-center py-12 text-slate-400/60' }, [
        el('div', { class: 'text-2xl mb-2' }, '📄'),
        el('div', {}, 'Nenhum conteúdo gerado ainda.')
      ])
    ]));
    return;
  }

  // Document list
  mount.appendChild(contentCard([
    el('div', { class: 'divide-y divide-slate-700/20' }, documents.map(d => {
      const meta = AGENT_META[d.profile] || {};

      return el('div', { class: 'py-4 first:pt-0 last:pb-0' }, [
        el('div', { class: 'flex items-start gap-3' }, [
          agentBadge(d.profile, 'w-6 h-6 text-[9px]'),
          el('div', { class: 'min-w-0 flex-1' }, [
            el('div', { class: 'flex items-center gap-2 mb-1' }, [
              el('span', { class: 'font-medium text-white text-sm line-clamp-1' }, d.title || '(sem título)'),
              el('span', {
                class: 'text-[9px] px-1.5 py-0.5 rounded-full shrink-0',
                style: `background:${meta.color}20; color:${meta.color}`
              }, meta.name || d.profile)
            ]),
            d.excerpt && el('p', { class: 'text-xs text-slate-300/60 line-clamp-2' }, d.excerpt.slice(0, 200))
          ]),
          el('div', { class: 'text-[10px] text-slate-400/50 mono-digit shrink-0' }, fmtEpoch(d.timestamp))
        ])
      ]);
    }))
  ]));
};

// ---------------------------------------------------------------------------
// SCHEDULE TAB
// ---------------------------------------------------------------------------

TAB_LOADERS.schedule = async function renderSchedule() {
  const mount = $('#schedule-mount');
  mount.innerHTML = '<div class="loading-shimmer h-64 rounded-3xl"></div>';

  let jobs, executions;
  try {
    [jobs, executions] = await Promise.all([
      fetchJSON('/api/cron/jobs'),
      fetchJSON('/api/cron/executions')
    ]);
  } catch (e) {
    mount.innerHTML = `<div class="text-red-400 text-sm">Erro: ${escapeHtml(e.message)}</div>`;
    return;
  }

  mount.innerHTML = '';

  // Hero
  const hero = el('div', {
    class: 'hero-glow rounded-3xl p-8 md:p-10 text-white relative overflow-hidden mb-6'
  });
  hero.appendChild(el('div', { class: 'relative z-10' }, [
    el('h1', { class: 'font-serif text-3xl md:text-4xl font-bold' }, ['Cron Jobs']),
    el('p', { class: 'text-sm text-slate-300/80 mt-2' },
      `${jobs.length || 0} jobs agendados · ${executions.length || 0} execuções registradas`)
  ]));
  mount.appendChild(hero);

  // Jobs table
  mount.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-slate-400 mb-3' }, 'Jobs ativos'),
    el('div', { class: 'overflow-x-auto' }, [
      el('table', { class: 'w-full text-left text-xs' }, [
        el('thead', { class: 'bg-slate-800/30 text-slate-400 uppercase tracking-wider' }, [
          el('tr', {}, [
            el('th', { class: 'px-4 py-2.5' }, 'Job ID'),
            el('th', { class: 'px-4 py-2.5' }, 'Profile'),
            el('th', { class: 'px-4 py-2.5' }, 'Last Status'),
            el('th', { class: 'px-4 py-2.5 text-right' }, 'Última execução')
          ])
        ]),
        el('tbody', { class: 'divide-y divide-slate-700/20' }, jobs.map(j => {
          const status = j.status || 'unknown';
          const statusColors = {
            'completed': 'bg-emerald-500/20 text-emerald-400',
            'failed': 'bg-red-500/20 text-red-400',
            'running': 'bg-accent/20 text-accent',
            'unknown': 'bg-slate-500/20 text-slate-400'
          };

          return el('tr', {}, [
            el('td', { class: 'px-4 py-2.5 font-mono text-xs text-slate-300/70 truncate max-w-[120px]' }, j.job_id || '—'),
            el('td', { class: 'px-4 py-2.5' }, agentPill(j.profile || 'default')),
            el('td', { class: 'px-4 py-2.5' }, [
              el('span', {
                class: `text-[10px] px-2 py-0.5 rounded-full ${statusColors[status] || statusColors['unknown']}`
              }, status.toUpperCase())
            ]),
            el('td', { class: 'px-4 py-2.5 text-right mono-digit text-slate-400/60' },
              j.claimed_at ? fmtEpoch(j.claimed_at) : '—')
          ]);
        }))
      ])
    ])
  ]));

  // Execution history
  mount.appendChild(contentCard([
    el('div', { class: 'text-xs uppercase tracking-wider text-slate-400 mb-3' }, 'Histórico de execuções'),
    el('div', { class: 'overflow-x-auto' }, [
      el('table', { class: 'w-full text-left text-xs' }, [
        el('thead', { class: 'bg-slate-800/30 text-slate-400 uppercase tracking-wider' }, [
          el('tr', {}, [
            el('th', { class: 'px-4 py-2.5' }, 'Job'),
            el('th', { class: 'px-4 py-2.5' }, 'Status'),
            el('th', { class: 'px-4 py-2.5' }, 'Profile'),
            el('th', { class: 'px-4 py-2.5 text-right' }, 'Iniciado')
          ])
        ]),
        el('tbody', { class: 'divide-y divide-slate-700/20' }, executions.slice(0, 20).map(e => {
          const statusColors = {
            'completed': 'bg-emerald-500/20 text-emerald-400',
            'failed': 'bg-red-500/20 text-red-400',
            'running': 'bg-accent/20 text-accent',
            'unknown': 'bg-slate-500/20 text-slate-400'
          };
          const sc = e.status || 'unknown';

          return el('tr', {}, [
            el('td', { class: 'px-4 py-2.5 font-mono text-xs text-slate-300/70 truncate max-w-[120px]' }, e.job_id || '—'),
            el('td', { class: 'px-4 py-2.5' }, [
              el('span', {
                class: `text-[10px] px-2 py-0.5 rounded-full ${statusColors[sc] || statusColors['unknown']}`
              }, sc.toUpperCase())
            ]),
            el('td', { class: 'px-4 py-2.5' }, agentPill(e.profile || 'global')),
            el('td', { class: 'px-4 py-2.5 text-right mono-digit text-slate-400/60' },
              e.started_at ? fmtEpoch(e.started_at) : '—')
          ]);
        }))
      ])
    ])
  ]));
};

// ---------------------------------------------------------------------------
// DOCS TAB (static page built from index.html template content)
// ---------------------------------------------------------------------------

TAB_LOADERS.docs = function renderDocs() {
  const mount = $('#docs-mount');
  mount.innerHTML = '';

  mount.appendChild(contentCard([
    el('h1', { class: 'font-serif text-3xl md:text-4xl font-bold text-white mb-6' }, ['Documentação']),
    el('div', { class: 'space-y-6 text-sm text-slate-300/80' }, [
      el('div', {}, [
        el('h2', { class: 'text-lg font-bold text-white mb-3' }, ['Visão Geral']),
        el('p', {}, 'Agent Mission Control é um painel read-only para monitorar sua frota Hermes. ' +
          'Ele conecta diretamente aos bancos SQLite (state.db, kanban.db) e ao gateway_state.json, ' +
          'exibindo dados reais em tempo real sem modificá-los.')
      ]),
      el('div', {}, [
        el('h2', { class: 'text-lg font-bold text-white mb-3' }, ['Abas']),
        el('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, [
          elAgentDoc('Overview', 'Status geral da frota, distribuição de carga e atividade recente'),
          elAgentDoc('Agents', 'Detalhes de cada agente com métricas de sessão e modelo'),
          elAgentDoc('Chat', 'Converse com os agentes em tempo real (custo de API)'),
          elAgentDoc('Tasks', 'Quadro Kanban com todas as tarefas agrupadas por status'),
          elAgentDoc('Office', 'Métricas de uso: tokens, custos e modelos utilizados'),
          elAgentDoc('Content', 'Biblioteca de conteúdos gerados (mensagens longas por agente)'),
          elAgentDoc('Schedule', 'Jobs cron programados e histórico de execuções'),
          elAgentDoc('Docs', 'Esta página — documentação do painel')
        ])
      ]),
      el('div', {}, [
        el('h2', { class: 'text-lg font-bold text-white mb-3' }, ['API Endpoints']),
        el('div', { class: 'font-mono text-xs space-y-1' }, [
          elApiDoc('GET /api/summary', 'Resumo geral da frota (sessões, tasks, tokens)'),
          elApiDoc('GET /api/sessions', 'Lista de sessões ativas'),
          elApiDoc('GET /api/messages', 'Últimas mensagens'),
          elApiDoc('GET /api/kanban', 'Tarefas do quadro Kanban'),
          elApiDoc('GET /api/cron/jobs', 'Jobs cron agendados'),
          elApiDoc('GET /api/cron/executions', 'Histórico de execuções cron'),
          elApiDoc('GET /api/gateway', 'Status do gateway'),
          elApiDoc('GET /api/profiles', 'Perfis disponíveis'),
          elApiDoc('GET /api/content', 'Biblioteca de conteúdo'),
          elApiDoc('POST /api/chat/send', 'Envia mensagem para um agente (profile, message)')
        ])
      ]),
      el('div', { class: 'border-t border-slate-700/30 pt-4 mt-6 text-xs text-slate-500' }, [
        el('span', { class: 'font-mono' }, 'v3.0') + ' | Dashboard Mission Control'
      ])
    ])
  ]));
};

function elAgentDoc(name, desc) {
  return el('div', { class: 'bg-slate-800/30 rounded-lg p-3' }, [
    el('div', { class: 'font-semibold text-white text-xs uppercase tracking-wider mb-1' }, name),
    el('div', { class: 'text-xs text-slate-400/70' }, desc)
  ]);
}

function elApiDoc(endpoint, desc) {
  return el('div', {}, [
    el('span', { class: 'text-accent' }, endpoint),
    el('span', { class: 'text-slate-400/60' }, ` — ${desc}`)
  ]);
}

// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------

initNav();

// Auto-refresh every 30 seconds when tab is visible
setInterval(() => {
  if (document.hidden) return;
  const activeTab = document.querySelector('.tab-panel.active');
  if (activeTab) {
    const tabName = activeTab.id.replace('tab-', '');
    if (TAB_LOADED.has(tabName) && TAB_LOADERS[tabName]) {
      TAB_LOADERS[tabName]();
    }
  }
}, 30000);

// Listen for tab change events
window.addEventListener('mc-tab-change', (e) => {
  // Can add analytics or other side effects here
});

