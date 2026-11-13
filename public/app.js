'use strict';
/* ============================================================
   囍事清单 · 备婚工作台 前端逻辑（零依赖）
   模块：好物清单 / 备婚清单 / 今日计划 / 备婚流程 / 双方准备 / 备忘录 / 设置
   ============================================================ */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cuid = () => 'c-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 忽略 */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* 忽略 */ } }
};

let myName = LS.get('xishi_name', '');

/* ---------- 常量 ---------- */
const PLATFORMS = {
  '淘宝': { color: '#FF5000', mark: '淘' },
  '天猫': { color: '#FF0036', mark: '猫' },
  '京东': { color: '#E1251B', mark: '东' },
  '拼多多': { color: '#E02E24', mark: '拼' },
  '抖音': { color: '#170B1A', mark: '抖' },
  '其他': { color: '#8A7A66', mark: '链' }
};
const PHASES = ['订婚', '结婚', '通用'];
const CATEGORIES = ['三金五金', '婚戒对戒', '婚纱礼服', '西装衬衫', '喜糖伴手礼', '婚房布置', '床品家纺', '家电家具', '请柬纸品', '婚车装饰', '美妆个护', '红包改口', '其他'];

const ICONS = {
  heart: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5S3.5 15.4 3.5 9.3a4.6 4.6 0 0 1 8.5-2.5A4.6 4.6 0 0 1 20.5 9.3c0 6.1-8.5 11.2-8.5 11.2Z"/></svg>',
  ext: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m13.5 6.5 3 3"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>'
};

/* ---------- 工具 ---------- */
function detectPlatform(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes('tmall.com')) return '天猫';
    if (h.includes('taobao.com') || h.endsWith('tb.cn')) return '淘宝';
    if (h.includes('jd.com') || h === '3.cn' || h.endsWith('.3.cn')) return '京东';
    if (h.includes('pinduoduo') || h.includes('yangkeduo')) return '拼多多';
    if (h.includes('douyin') || h.includes('jinritemai')) return '抖音';
    return '其他';
  } catch { return '其他'; }
}
function trimUrlTail(u) { return u.replace(/[.,;:!?、。！？；：，）)\]】」』"'`]+$/g, ''); }
function extractUrl(text) {
  if (typeof text !== 'string') return '';
  const s = text.trim();
  const m = s.match(/https?:\/\/[^\s"'`<>【】「」『』（）()，。；！？、]+/i);
  if (m) return trimUrlTail(m[0]);
  const bare = s.match(/(?:[a-z0-9-]+\.)*(?:taobao|tmall|jd|tb|pinduoduo|yangkeduo|douyin|jinritemai)\.(?:com|cn)(?:\/[^\s"'`<>【】「」『』（）()，。；！？、]*)?/i);
  if (bare) return trimUrlTail('https://' + bare[0]);
  return '';
}
function extractShareTitle(text) {
  const m = String(text || '').match(/[「『""]([^「」『』""]{2,60})[」』""]/);
  return m ? m[1].trim() : '';
}
function fmtPrice(p) { return Number(p).toLocaleString('zh-CN', { maximumFractionDigits: 2 }); }
function relTime(t) {
  const d = Date.now() - t;
  if (d < 60e3) return '刚刚';
  if (d < 3600e3) return Math.floor(d / 60e3) + '分钟前';
  if (d < 86400e3) return Math.floor(d / 3600e3) + '小时前';
  if (d < 7 * 86400e3) return Math.floor(d / 86400e3) + '天前';
  return fmtDate(new Date(t).toISOString().slice(0, 10));
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(s) {
  if (!s) return '待定';
  const [y, m, d] = s.split('-').map(Number);
  if (!m || !d) return s;
  return (y !== new Date().getFullYear() ? y + '年' : '') + m + '月' + d + '日';
}

/* ---------- 状态 ---------- */
const state = {
  token: LS.get('xishi_token', ''),
  user: null,
  viewAs: '',
  accounts: null,
  settings: {},
  data: { checklist: [], tasks: [], timeline: [], sides: { male: { outfit: [], guests: [], fields: {} }, female: { outfit: [], guests: [], fields: {} } }, memo: { contacts: [], diet: '', inspiration: '', family: '' } },
  items: [],
  loading: true,
  error: null,
  module: 'items',
  itemView: 'todo',
  filters: { phase: 'all', q: '', category: 'all', platform: 'all', sort: 'new', mine: false, owner: 'all' },
  side: 'male',
  taskFilter: 'today',
  bulk: new Set(),
  drawerId: null,
  editingId: null,
  editingGuest: null,
  editingContact: null,
  editingTl: null
};

const isAdmin = () => state.user && state.user.role === 'admin';
const me = () => state.user ? state.user.username : '';
const asQuery = () => (isAdmin() && state.viewAs) ? ('as=' + encodeURIComponent(state.viewAs)) : '';
function withAs(path) { const q = asQuery(); return q ? path + (path.includes('?') ? '&' : '?') + q : path; }

/* ---------- API ---------- */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: Object.assign({ 'Content-Type': 'application/json' }, state.token ? { 'Authorization': 'Bearer ' + state.token } : {}),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
  if (res.status === 401 && !opts.noAuthRedirect) {
    forceLogin();
    throw new Error('登录已过期');
  }
  if (!res.ok) {
    let msg = '操作失败（' + res.status + '）';
    try { const j = await res.json(); if (j.error) msg = j.error; } catch { /* 忽略 */ }
    throw new Error(msg);
  }
  return res.json();
}

async function fetchState() {
  try {
    const d = await api('/api/state' + (asQuery() ? '?' + asQuery() : ''));
    state.user = d.user;
    state.viewAs = d.viewAs || '';
    state.accounts = d.accounts;
    state.settings = d.settings || {};
    state.data = d.data || state.data;
    state.items = Array.isArray(d.items) ? d.items : [];
    state.loading = false;
    state.error = null;
    for (const id of [...state.bulk]) if (!state.items.some(i => i.id === id)) state.bulk.delete(id);
    renderAll();
  } catch (e) {
    if (!state.user) return;
    state.loading = false;
    state.error = e.message;
    renderAll();
  }
}

/* 输入中延迟刷新，避免打断打字 */
let refreshTimer = null, pendingRefresh = false;
function isTyping() {
  const el = document.activeElement;
  return el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && $('#app') && !$('#app').hidden;
}
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (isTyping()) { pendingRefresh = true; return; }
    fetchState();
  }, 350);
}
document.addEventListener('focusout', () => {
  if (pendingRefresh) { pendingRefresh = false; setTimeout(fetchState, 120); }
});

/* ---------- SSE ---------- */
let es = null, sseFails = 0, pollTimer = null, reconnectTimer = null;
function connectSSE() {
  disconnectSSE();
  if (!window.EventSource || !state.token) return startPolling();
  try { es = new EventSource('/api/events?token=' + encodeURIComponent(state.token)); } catch { return startPolling(); }
  es.onmessage = () => { sseFails = 0; scheduleRefresh(); };
  es.onerror = () => {
    es.close(); es = null;
    sseFails++;
    if (sseFails >= 3) return startPolling();
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectSSE, Math.min(3000 * sseFails, 15000));
  };
}
function disconnectSSE() {
  if (es) { es.close(); es = null; }
  clearTimeout(reconnectTimer);
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  sseFails = 0;
}
function startPolling() { if (!pollTimer && state.token) pollTimer = setInterval(fetchState, 20000); }

/* ---------- 登录 / 注册 ---------- */
let loginMode = 'login';
function showLogin() {
  $('#app').hidden = true;
  $('#loginScreen').hidden = false;
  document.body.classList.remove('modal-open');
  disconnectSSE();
}
function enterApp() {
  $('#loginScreen').hidden = true;
  $('#app').hidden = false;
  fetchState();
  connectSSE();
}
function forceLogin() {
  state.token = ''; state.user = null;
  LS.del('xishi_token');
  showLogin();
  toast('登录已过期，请重新登录', 'error');
}
function setLoginMode(mode) {
  loginMode = mode;
  $('#luSubmit').textContent = mode === 'login' ? '登录' : '注册并登录';
  $('#luToggle').textContent = mode === 'login' ? '没有账号？注册一个' : '已有账号？直接登录';
  $('#luPass').placeholder = mode === 'login' ? '密码' : '设置密码（至少6位）';
}

/* ---------- 渲染总控 ---------- */
function renderAll() {
  if (!state.user) return;
  renderHeader();
  renderNav();
  renderModule(state.module);
}

function renderHeader() {
  $('#listTitle').textContent = state.settings.title || '囍事清单';
  $('#listSubtitle').textContent = state.settings.subtitle || '';
  document.title = (state.settings.title || '囍事清单') + ' · 备婚工作台';
  $('#userChip').innerHTML = esc(me()) + (isAdmin() ? '<i>管理员</i>' : '');
  const sel = $('#asSelect');
  if (isAdmin()) {
    sel.hidden = false;
    const opts = ['<option value="">全部账号</option>'].concat((state.accounts || []).map(a =>
      `<option value="${esc(a.username)}">${esc(a.username)}${a.username === me() ? '（我）' : ''}</option>`));
    sel.innerHTML = opts.join('');
    sel.value = state.viewAs;
  } else sel.hidden = true;
  const selM = $('#asSelectM');
  if (isAdmin()) {
    $('#moreAsRow').hidden = false;
    selM.innerHTML = sel.innerHTML;
    selM.value = state.viewAs;
  } else $('#moreAsRow').hidden = true;
  $('#moreUser').innerHTML = esc(me()) + (isAdmin() ? '<i>管理员</i>' : '');
  const fo = $('#fOwner');
  if (isAdmin() && !state.viewAs) {
    fo.hidden = false;
    fo.innerHTML = '<option value="all">全部账号</option>' + (state.accounts || []).map(a => `<option value="${esc(a.username)}">${esc(a.username)}</option>`).join('');
    fo.value = state.filters.owner;
    if (fo.value !== state.filters.owner) { state.filters.owner = 'all'; fo.value = 'all'; }
  } else { fo.hidden = true; state.filters.owner = 'all'; }
}

function renderNav() {
  $$('#mainnav button').forEach(b => b.classList.toggle('active', b.dataset.mod === state.module));
  $$('.module').forEach(m => { m.hidden = m.id !== 'mod-' + state.module; });
  $('#fabAdd').hidden = state.module !== 'items';
}

function switchModule(mod) {
  state.module = mod;
  renderNav();
  renderModule(mod);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderModule(mod) {
  if (mod === 'items') renderItemsModule();
  else if (mod === 'checklist') renderChecklist();
  else if (mod === 'tasks') renderTasks();
  else if (mod === 'timeline') renderTimeline();
  else if (mod === 'sides') renderSides();
  else if (mod === 'memo') renderMemo();
  else if (mod === 'settings') renderSettings();
}

/* ============================================================
   模块一：好物清单（待挑选 / 已购清单）
   ============================================================ */

function visibleItems() {
  const f = state.filters;
  const wantStatus = state.itemView === 'bought' ? 'purchased' : 'pending';
  const arr = state.items.filter(it => {
    if (it.status !== wantStatus) return false;
    if (f.phase !== 'all' && it.phase !== f.phase) return false;
    if (f.category !== 'all' && it.category !== f.category) return false;
    if (f.platform !== 'all' && it.platform !== f.platform) return false;
    if (f.owner !== 'all' && it.owner !== f.owner) return false;
    if (f.mine && !(it.votes || []).includes(me())) return false;
    if (f.q) {
      const hay = (it.title + ' ' + (it.note || '') + ' ' + it.category + ' ' + it.addedBy + ' ' + (it.owner || '')).toLowerCase();
      if (!hay.includes(f.q.toLowerCase())) return false;
    }
    return true;
  });
  const by = {
    new: (a, b) => (state.itemView === 'bought' ? (b.purchasedAt || 0) - (a.purchasedAt || 0) : b.createdAt - a.createdAt),
    hot: (a, b) => (b.votes.length - a.votes.length) || (b.createdAt - a.createdAt),
    priceAsc: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
    priceDesc: (a, b) => (b.price ?? -1) - (a.price ?? -1)
  };
  return arr.sort(by[f.sort] || by.new);
}

function renderItemsModule() {
  renderHero();
  renderViewSeg();
  renderTabs();
  renderCategoryOptions();
  renderGrid();
  renderBulkBar();
  if (state.drawerId) renderDrawer();
}

function renderHero() {
  const todo = state.items.filter(i => i.status !== 'purchased');
  const bought = state.items.filter(i => i.status === 'purchased');
  const sum = arr => Math.round(arr.reduce((s, i) => s + (i.price || 0), 0) * 100) / 100;
  if (state.itemView === 'todo') {
    $('#statA').textContent = todo.length; $('#statALabel').textContent = '件待挑选';
    $('#statB').textContent = todo.reduce((s, i) => s + (i.votes ? i.votes.length : 0), 0); $('#statBLabel').textContent = '个喜欢';
    $('#statC').textContent = '¥' + fmtPrice(sum(todo)); $('#statCLabel').textContent = '预算参考';
    $('#statD').textContent = bought.length; $('#statDLabel').textContent = '已下单';
  } else {
    $('#statA').textContent = bought.length; $('#statALabel').textContent = '件已购';
    $('#statB').textContent = '¥' + fmtPrice(sum(bought)); $('#statBLabel').textContent = '已购合计';
    const last = bought.reduce((m, i) => Math.max(m, i.purchasedAt || 0), 0);
    $('#statC').textContent = last ? relTime(last) : '—'; $('#statCLabel').textContent = '最近下单';
    $('#statD').textContent = todo.length; $('#statDLabel').textContent = '件待挑选';
  }
}

function renderViewSeg() {
  $('#todoCount').textContent = state.items.filter(i => i.status !== 'purchased').length;
  $('#boughtCount').textContent = state.items.filter(i => i.status === 'purchased').length;
  $$('#itemViewSeg button').forEach(b => b.classList.toggle('active', b.dataset.view === state.itemView));
}

function renderTabs() {
  const base = state.items.filter(i => (state.itemView === 'bought' ? i.status === 'purchased' : i.status !== 'purchased'));
  const counts = { all: base.length };
  for (const p of PHASES) counts[p] = base.filter(i => i.phase === p).length;
  const defs = [['all', '全部'], ...PHASES.map(p => [p, p])];
  $('#phaseTabs').innerHTML = defs.map(([v, label]) =>
    `<button data-phase="${v}" class="${state.filters.phase === v ? 'active' : ''}">${label}<b>${counts[v]}</b></button>`).join('');
}

function renderCategoryOptions() {
  const sel = $('#fCategory');
  const cur = state.filters.category;
  const cats = [...new Set([...CATEGORIES, ...state.items.map(i => i.category)])].filter(Boolean);
  sel.innerHTML = '<option value="all">全部分类</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value = cats.includes(cur) ? cur : 'all';
  if (sel.value === 'all') state.filters.category = 'all';
  $('#catList').innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
}

function cardHTML(it, i) {
  const p = PLATFORMS[it.platform] || PLATFORMS['其他'];
  const votes = it.votes || [];
  const voted = votes.includes(me());
  const checked = state.bulk.has(it.id);
  const showOwner = isAdmin() && !state.viewAs;
  return `<article class="card ${it.status === 'purchased' ? 'is-purchased' : ''} ${checked ? 'is-checked' : ''}" data-id="${esc(it.id)}" style="animation-delay:${Math.min(i, 10) * 45}ms" tabindex="0" aria-label="查看 ${esc(it.title)} 详情">
    <label class="pick" title="批量选择"><input type="checkbox" data-act="pick" ${checked ? 'checked' : ''}><span></span></label>
    ${it.status === 'purchased' ? '<span class="ribbon">已下单</span>' : ''}
    <div class="card-top">
      <span class="pbadge" style="--pc:${p.color}">${p.mark}</span>
      <span class="phase phase-${esc(it.phase)}">${esc(it.phase)}</span>
      <span class="cat">${esc(it.category)}</span>
      ${it.seed ? '<span class="seed-tag">示例</span>' : ''}
      ${showOwner ? `<span class="owner-badge">${esc(it.owner)}</span>` : ''}
    </div>
    <h3 class="card-title">${esc(it.title)}</h3>
    <div class="card-price">${it.price != null ? '<i>¥</i>' + fmtPrice(it.price) : '<span class="no-price">价格待填</span>'}</div>
    ${it.note ? `<p class="card-note">${esc(it.note)}</p>` : ''}
    <div class="card-foot">
      <button class="like ${voted ? 'voted' : ''}" data-act="like" aria-pressed="${voted}" title="喜欢就点一下">${ICONS.heart}<b>${votes.length}</b></button>
      <button class="card-del" data-act="del" title="一键删除（可撤销）" aria-label="删除 ${esc(it.title)}">${ICONS.trash}</button>
      <a class="go" style="--pc:${p.color}" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" data-act="go">去${esc(it.platform)}${ICONS.ext}</a>
      <span class="by">${esc(it.addedBy)} · ${relTime(it.createdAt)}${it.status === 'purchased' && it.purchasedBy ? ' · ' + esc(it.purchasedBy) + ' 已下单' : ''}</span>
    </div>
  </article>`;
}

function skeletonHTML() {
  return Array.from({ length: 6 }, () =>
    '<div class="sk-card"><div class="sk sk-line w40"></div><div class="sk sk-title"></div><div class="sk sk-line w60"></div><div class="sk sk-line w80"></div></div>').join('');
}

function renderGrid() {
  $('#loadError').hidden = !state.error;
  if (state.loading) { $('#grid').innerHTML = skeletonHTML(); return; }
  if (state.error) { $('#grid').innerHTML = ''; return; }
  const arr = visibleItems();
  const grid = $('#grid');
  if (!arr.length) {
    if (state.itemView === 'bought') {
      grid.innerHTML = `<div class="empty"><span class="empty-seal">囍</span><h3>已购清单还是空的</h3><p>在「待挑选」里下单后点「标记已下单」，<br>商品就会移到这里，避免家人重复购买。</p><button class="btn btn-ghost" data-act="goto-todo">回到待挑选</button></div>`;
    } else if (!state.items.some(i => i.status !== 'purchased')) {
      grid.innerHTML = `<div class="empty"><span class="empty-seal">囍</span><h3>清单还是空的</h3><p>把在网上看中的好物链接粘贴进来，<br>家人就能一起挑、一起点囍投票了。</p><button class="btn btn-primary" data-act="add-first">添加第一件好物</button></div>`;
    } else {
      grid.innerHTML = `<div class="empty"><span class="empty-seal">囍</span><h3>没有匹配的好物</h3><p>换个筛选条件试试，或直接添加新的好物。</p><button class="btn btn-ghost" data-act="clear-filters">清除筛选条件</button></div>`;
    }
    return;
  }
  grid.innerHTML = arr.map(cardHTML).join('');
}

function renderBulkBar() {
  $('#bulkBar').hidden = state.bulk.size === 0;
  $('#bulkCount').textContent = state.bulk.size;
  $('#bulkBuy').textContent = state.itemView === 'bought' ? '移回待挑选' : '标记已下单';
}

/* ---------- 详情抽屉 ---------- */
function openDrawer(id) {
  state.drawerId = id;
  renderDrawer();
  $('#drawerWrap').hidden = false;
  document.body.classList.add('modal-open');
}
function closeDrawer() {
  state.drawerId = null;
  $('#drawerWrap').hidden = true;
  if (!$$('.modal-wrap:not([hidden])').length) document.body.classList.remove('modal-open');
}
function renderDrawer() {
  const it = state.items.find(i => i.id === state.drawerId);
  if (!it) { closeDrawer(); return; }
  const p = PLATFORMS[it.platform] || PLATFORMS['其他'];
  const votes = it.votes || [];
  const voted = votes.includes(me());
  $('#drawerBody').innerHTML = `
    <button class="icon-btn d-close" data-act="close" aria-label="关闭详情">${ICONS.close}</button>
    <div class="d-head">
      <span class="pbadge" style="--pc:${p.color}">${p.mark}</span>
      <span class="phase phase-${esc(it.phase)}">${esc(it.phase)}</span>
      <span class="cat">${esc(it.category)}</span>
      ${it.seed ? '<span class="seed-tag">示例</span>' : ''}
      ${it.status === 'purchased' ? '<span class="phase" style="background:var(--success-soft);color:var(--success)">已下单</span>' : ''}
      ${isAdmin() ? `<span class="owner-badge">账号：${esc(it.owner)}</span>` : ''}
    </div>
    <h3 class="d-title">${esc(it.title)}</h3>
    <div class="d-price">${it.price != null ? '<i>¥</i>' + fmtPrice(it.price) : '<span class="no-price">价格待填</span>'}</div>
    ${it.note ? `<div class="d-note">${esc(it.note)}</div>` : ''}
    <div class="d-meta">
      <div class="row"><span>推荐人</span><b>${esc(it.addedBy)}</b></div>
      <div class="row"><span>添加时间</span><b>${relTime(it.createdAt)}</b></div>
      <div class="row"><span>喜欢人数</span><b>${votes.length} 人${voted ? '（含你）' : ''}</b></div>
      ${it.status === 'purchased' ? `<div class="row"><span>下单人</span><b>${esc(it.purchasedBy || '未署名')}</b></div>
      <div class="row"><span>下单时间</span><b>${it.purchasedAt ? relTime(it.purchasedAt) : '—'}</b></div>` : ''}
    </div>
    <div class="d-link">
      <code>${esc(it.url)}</code>
      <button class="icon-btn" data-act="copy-url" title="复制链接">${ICONS.copy}</button>
    </div>
    <a class="btn-go-large" style="--pc:${p.color}" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">去${esc(it.platform)}看看，直接下单 ${ICONS.ext}</a>
    <div class="d-actions">
      <button class="like ${voted ? 'voted' : ''}" data-act="like">${ICONS.heart}<b>${voted ? '已喜欢' : '喜欢'}</b></button>
      <button class="btn btn-ghost" data-act="edit">${ICONS.edit} 编辑</button>
      <button class="btn ${it.status === 'purchased' ? 'btn-ghost' : 'btn-primary'}" data-act="buy">${ICONS.check} ${it.status === 'purchased' ? '移回待挑选' : '标记已下单'}</button>
      <button class="btn btn-danger-ghost" data-act="del">${ICONS.trash} 删除</button>
    </div>
    <p class="d-tip">微信内若无法跳转购物 App，请点右上角「···」选择「在浏览器打开」。下单后记得标记，商品会移入「已购清单」，避免重复购买。</p>`;
}

/* ---------- 投票 / 删除 / 购买 ---------- */
async function toggleLike(id) {
  const it = state.items.find(x => x.id === id);
  if (!it) return;
  it.votes = it.votes || [];
  const had = it.votes.includes(me());
  if (had) it.votes = it.votes.filter(v => v !== me()); else it.votes.push(me());
  renderGrid(); renderHero();
  if (state.drawerId === id) renderDrawer();
  const btn = $('#grid').querySelector(`.card[data-id="${id}"] .like`);
  if (btn) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
  try {
    await api(`/api/items/${encodeURIComponent(id)}/vote`, { method: 'POST', body: {} });
  } catch (e) {
    const cur = state.items.find(x => x.id === id);
    if (cur) { if (had) cur.votes.push(me()); else cur.votes = cur.votes.filter(v => v !== me()); }
    renderGrid(); renderHero();
    if (state.drawerId === id) renderDrawer();
    toast('投票失败：' + e.message, 'error');
  }
}

async function restoreItems(items) {
  for (const it of [...items].reverse()) await api(withAs('/api/items'), { method: 'POST', body: it });
}

async function deleteItems(ids) {
  const removed = state.items.filter(i => ids.includes(i.id));
  if (!removed.length) return;
  state.items = state.items.filter(i => !ids.includes(i.id));
  ids.forEach(id => state.bulk.delete(id));
  if (ids.includes(state.drawerId)) closeDrawer();
  renderItemsModule();
  try {
    await Promise.all(ids.map(id => api(`/api/items/${encodeURIComponent(id)}`, { method: 'DELETE' })));
  } catch (e) { toast('删除失败：' + e.message, 'error'); fetchState(); return; }
  toast(`已删除 ${removed.length} 件好物`, 'info', {
    label: '撤销',
    fn: async () => {
      try { await restoreItems(removed); toast('已恢复', 'success'); }
      catch (e) { toast('恢复失败：' + e.message, 'error'); fetchState(); }
    }
  });
}

async function markPurchased(ids) {
  const targets = state.items.filter(i => ids.includes(i.id) && i.status !== 'purchased');
  if (!targets.length) return;
  let buyer = myName;
  if (!buyer) {
    buyer = await askName('标记已下单', '填写下单人署名（如：爸爸）');
    if (buyer == null) return;
    myName = buyer; LS.set('xishi_name', buyer);
  }
  const now = Date.now();
  targets.forEach(it => { it.status = 'purchased'; it.purchasedBy = buyer; it.purchasedAt = now; });
  renderItemsModule();
  try {
    await Promise.all(targets.map(it => api(`/api/items/${encodeURIComponent(it.id)}`, { method: 'PATCH', body: { status: 'purchased', purchasedBy: buyer } })));
    toast(`已移入「已购清单」${targets.length} 件，不会重复买啦`, 'success');
  } catch (e) { toast('标记失败：' + e.message, 'error'); fetchState(); }
}

async function unpurchase(ids) {
  const targets = state.items.filter(i => ids.includes(i.id) && i.status === 'purchased');
  if (!targets.length) return;
  targets.forEach(it => { it.status = 'pending'; it.purchasedBy = ''; it.purchasedAt = null; });
  renderItemsModule();
  try {
    await Promise.all(targets.map(it => api(`/api/items/${encodeURIComponent(it.id)}`, { method: 'PATCH', body: { status: 'pending', purchasedBy: '' } })));
    toast(`已移回「待挑选」${targets.length} 件`, 'info');
  } catch (e) { toast('操作失败：' + e.message, 'error'); fetchState(); }
}

async function clearAllItems() {
  const scopeAll = isAdmin() && !state.viewAs;
  const scope = scopeAll ? state.items : state.items.filter(i => i.owner === (state.viewAs || me()));
  if (!scope.length) { toast('清单已经是空的', 'info'); return; }
  const warn = scopeAll ? `确定一键清空【全部账号】共 ${scope.length} 件好物？` : `确定一键清空全部 ${scope.length} 件好物？`;
  if (!confirm(warn + ' 清空后 7 秒内可撤销。')) return;
  const removed = scope.slice();
  const ids = new Set(removed.map(i => i.id));
  state.items = state.items.filter(i => !ids.has(i.id));
  state.bulk.clear();
  if (state.drawerId && ids.has(state.drawerId)) closeDrawer();
  renderItemsModule();
  try {
    await api(withAs('/api/items'), { method: 'DELETE' });
    toast(`已清空 ${removed.length} 件好物`, 'info', {
      label: '撤销',
      fn: async () => {
        try { await restoreItems(removed); toast('已全部恢复', 'success'); }
        catch (e) { toast('恢复失败：' + e.message, 'error'); fetchState(); }
      }
    });
  } catch (e) { toast('清空失败：' + e.message, 'error'); fetchState(); }
}

async function clearSeedItems() {
  if (!confirm('确定清空当前账号的所有「示例」数据？手动添加的好物不受影响。')) return;
  try {
    const r = await api(withAs('/api/seed'), { method: 'DELETE' });
    toast(`已清空 ${r.removed} 件示例数据`, 'success');
    fetchState();
  } catch (e) { toast(e.message, 'error'); }
}

/* ============================================================
   模块二：备婚清单（分类勾选）
   ============================================================ */

async function saveData(key) {
  try {
    await api(withAs('/api/data'), { method: 'PUT', body: { key, value: state.data[key] } });
  } catch (e) { toast('保存失败：' + e.message, 'error'); fetchState(); }
}

function renderChecklist() {
  const list = state.data.checklist || [];
  const done = list.filter(i => i.done).length;
  $('#ckProgress').textContent = `${done} / ${list.length} 已确认`;
  const cats = [];
  for (const it of list) if (!cats.includes(it.cat)) cats.push(it.cat);
  if (!cats.length) {
    $('#ckList').innerHTML = '<div class="empty"><span class="empty-seal">囍</span><h3>还没有分类</h3><p>在上方输入分类名称（如：婚房布置），开始逐项确认。</p></div>';
    return;
  }
  $('#ckList').innerHTML = cats.map(cat => {
    const items = list.filter(i => i.cat === cat);
    const d = items.filter(i => i.done).length;
    return `<div class="ck-cat" data-cat="${esc(cat)}">
      <div class="ck-cat-head">
        <h3>${esc(cat)}</h3><span class="ck-count">${d}/${items.length}</span>
        <button class="icon-btn" data-ck="rename-cat" title="重命名分类">${ICONS.edit}</button>
        <button class="icon-btn" data-ck="del-cat" title="删除分类">${ICONS.trash}</button>
      </div>
      <div class="ck-items">
        ${items.map(it => `<div class="ck-item ${it.done ? 'done' : ''}" data-id="${it.id}">
          <input type="checkbox" data-ck="toggle" ${it.done ? 'checked' : ''} aria-label="确认 ${esc(it.text)}">
          <span class="txt" data-ck="edit" title="点击修改文字">${esc(it.text)}</span>
          <button class="mini-del" data-ck="del" title="删除">${ICONS.trash}</button>
        </div>`).join('')}
      </div>
      <div class="ck-add">
        <input maxlength="60" placeholder="添加事项，回车确认…" data-ckinput>
        <button class="btn btn-ghost" data-ck="add">添加</button>
      </div>
    </div>`;
  }).join('');
}

function ckAddItem(cat, input) {
  const text = input.value.trim();
  if (!text) return;
  state.data.checklist.push({ id: cuid(), cat, text, done: false, createdAt: Date.now() });
  input.value = '';
  renderChecklist();
  saveData('checklist');
  const el = $('#ckList').querySelector(`.ck-cat[data-cat="${CSS.escape(cat)}"] [data-ckinput]`);
  if (el) el.focus();
}

/* ============================================================
   模块三：今日计划
   ============================================================ */

function renderTasks() {
  const now = new Date();
  const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  $('#taskTodayLabel').textContent = `今天 · ${now.getMonth() + 1}月${now.getDate()}日 周${week}`;
  if (!$('#taskDate').value) $('#taskDate').value = todayStr();
  const all = state.data.tasks || [];
  const today = todayStr();
  let arr = all.slice();
  if (state.taskFilter === 'today') arr = arr.filter(t => t.date === today);
  else if (state.taskFilter === 'undone') arr = arr.filter(t => !t.done);
  arr.sort((a, b) => (a.done - b.done) || (a.date || '9999').localeCompare(b.date || '9999') || a.createdAt - b.createdAt);
  const doneCount = arr.filter(t => t.done).length;
  $('#taskProgress').textContent = `${doneCount} / ${arr.length} 完成`;
  $$('#taskFilter button').forEach(b => b.classList.toggle('active', b.dataset.tf === state.taskFilter));
  if (!arr.length) {
    $('#taskList').innerHTML = '<div class="empty"><span class="empty-seal">囍</span><h3>暂无计划</h3><p>在上方添加今天要做的事，比如「给酒店打电话确认菜单」。</p></div>';
    return;
  }
  $('#taskList').innerHTML = arr.map(t => {
    let badge = '', cls = '';
    if (t.date === today) { badge = '今天'; cls = 'today'; }
    else if (t.date && t.date < today && !t.done) { badge = '已过期 ' + fmtDate(t.date); cls = 'overdue'; }
    else if (t.date) badge = fmtDate(t.date);
    else badge = '未定日期';
    return `<div class="task-row ${t.done ? 'done' : ''}" data-id="${t.id}">
      <input type="checkbox" data-task="toggle" ${t.done ? 'checked' : ''}>
      <span class="txt">${esc(t.text)}</span>
      <span class="date-badge ${cls}">${badge}</span>
      <button class="task-del" data-task="del" title="删除">${ICONS.trash}</button>
    </div>`;
  }).join('');
}

/* ============================================================
   模块四：备婚流程（时间线 + 倒计时）
   ============================================================ */

function renderTimeline() {
  const wd = state.settings.weddingDate;
  const banner = $('#cdBanner');
  if (wd) {
    const target = new Date(wd + 'T00:00:00');
    const t0 = new Date(todayStr() + 'T00:00:00');
    const days = Math.round((target - t0) / 86400e3);
    const venue = state.settings.venue ? esc(state.settings.venue) : '地点待定';
    if (days > 0) banner.innerHTML = `<b>${days}</b><span>天后就是婚礼啦<br>${fmtDate(wd)} · ${venue}</span>`;
    else if (days === 0) banner.innerHTML = `<b>囍</b><span>今天就是婚礼！<br>${fmtDate(wd)} · ${venue}</span>`;
    else banner.innerHTML = `<b>${-days}</b><span>天前婚礼已圆满礼成<br>${fmtDate(wd)} · ${venue}</span>`;
  } else {
    banner.innerHTML = `<b>囍</b><span>婚期还未设置<br>设置后这里会显示婚礼倒计时</span><button class="btn" data-go-settings>去设置婚期</button>`;
  }
  const arr = (state.data.timeline || []).slice().sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
  if (!arr.length) {
    $('#tlList').innerHTML = '<div class="empty"><span class="empty-seal">囍</span><h3>还没有流程节点</h3><p>点「新增节点」，把提亲、订婚、领证…一步步排进来。</p></div>';
    return;
  }
  $('#tlList').innerHTML = arr.map(t => `<div class="tl-item ${t.done ? 'done' : ''}" data-id="${t.id}">
    <div class="tl-date">${t.date ? fmtDate(t.date) : '待定'}${t.date && t.date < todayStr() && !t.done ? ' · 已过期' : ''}</div>
    <div class="tl-title">${esc(t.title)}</div>
    ${t.note ? `<div class="tl-note">${esc(t.note)}</div>` : ''}
    <div class="tl-actions">
      <button class="btn ${t.done ? 'btn-ghost' : 'btn-primary'}" data-tl="toggle">${ICONS.check} ${t.done ? '已完成' : '标记完成'}</button>
      <button class="btn btn-ghost" data-tl="edit">${ICONS.edit} 编辑</button>
      <button class="btn btn-danger-ghost" data-tl="del">${ICONS.trash} 删除</button>
    </div>
  </div>`).join('');
}

/* ============================================================
   模块五：双方准备
   ============================================================ */

function renderSides() {
  $$('#sideSeg button').forEach(b => b.classList.toggle('active', b.dataset.side === state.side));
  const side = state.data.sides[state.side];
  const outfitDone = side.outfit.filter(o => o.done).length;
  const guestTotal = side.guests.reduce((s, g) => s + (Number(g.count) || 1), 0);
  const isMale = state.side === 'male';
  $('#sideContent').innerHTML = `
    <div class="side-block">
      <h3>${isMale ? '新郎服饰' : '新娘服饰'}<span class="sub">${outfitDone}/${side.outfit.length} 已备齐</span></h3>
      <div class="ck-items">
        ${side.outfit.map(o => `<div class="ck-item ${o.done ? 'done' : ''}" data-id="${o.id}">
          <input type="checkbox" data-side="outfit-toggle" ${o.done ? 'checked' : ''}>
          <span class="txt">${esc(o.text)}</span>
          <button class="mini-del" data-side="outfit-del" title="删除">${ICONS.trash}</button>
        </div>`).join('')}
      </div>
      <div class="ck-add">
        <input maxlength="40" placeholder="添加服饰物品，回车确认…" data-side-input>
        <button class="btn btn-ghost" data-side="outfit-add">添加</button>
      </div>
    </div>
    <div class="side-block">
      <h3>${isMale ? '男方宾客名单' : '女方宾客名单'}<span class="sub">共 ${side.guests.length} 组 · 约 ${guestTotal} 人</span><button class="btn btn-ghost" data-side="guest-add" style="margin-left:auto">添加宾客</button></h3>
      ${side.guests.length ? `<div class="guest-grid">${side.guests.map(g => `<div class="guest-card" data-id="${g.id}">
        <div class="g-name">${esc(g.name)}</div>
        <div class="g-meta">${esc(g.relation || '亲友')} · ${Number(g.count) || 1} 人</div>
        ${g.phone ? `<a class="g-phone" href="tel:${esc(g.phone)}">${ICONS.phone} ${esc(g.phone)}</a>` : ''}
        ${g.note ? `<div class="g-meta">${esc(g.note)}</div>` : ''}
        <div class="g-actions">
          <button class="btn btn-ghost" data-side="guest-edit">编辑</button>
          <button class="btn btn-danger-ghost" data-side="guest-del">删除</button>
        </div>
      </div>`).join('')}</div>` : '<p class="g-meta">还没有宾客，点「添加宾客」开始登记，方便安排桌数。</p>'}
    </div>
    <div class="side-block">
      <h3>${isMale ? '车队 · 彩礼 · 其他安排' : '嫁妆 · 伴手礼 · 其他安排'}<span class="sub">填写后自动保存</span></h3>
      <div class="fields-grid">
        ${Object.entries(side.fields).map(([k, v]) => `<div class="field-box">
          <label>${esc(k)}</label>
          <input data-field="${esc(k)}" value="${esc(v)}" maxlength="100" placeholder="待填写">
        </div>`).join('')}
      </div>
    </div>`;
}

/* ============================================================
   模块六：备忘录
   ============================================================ */

let memoTimer = null;
function renderMemo() {
  const memo = state.data.memo;
  $('#ctList').innerHTML = (memo.contacts || []).length ? memo.contacts.map(c => `<div class="ct-card" data-id="${c.id}">
    <div class="c-name">${esc(c.name)}</div>
    ${c.phone ? `<a class="c-phone" href="tel:${esc(c.phone)}">${ICONS.phone} ${esc(c.phone)}</a>` : '<div class="c-note">电话：待填写</div>'}
    ${c.note ? `<div class="c-note">${esc(c.note)}</div>` : ''}
    <div class="c-actions">
      <button class="btn btn-ghost" data-ct="edit">编辑</button>
      <button class="btn btn-danger-ghost" data-ct="del">删除</button>
    </div>
  </div>`).join('') : '<p class="g-meta">还没有商家联系方式，点「添加商家」登记婚庆、酒店、摄影师等电话。</p>';
  for (const [id, key] of [['#memoDiet', 'diet'], ['#memoInsp', 'inspiration'], ['#memoFamily', 'family']]) {
    const el = $(id);
    if (document.activeElement !== el) el.value = memo[key] || '';
  }
}
function memoInput(key, value) {
  state.data.memo[key] = value;
  clearTimeout(memoTimer);
  memoTimer = setTimeout(async () => {
    await saveData('memo');
    const hint = $('#memoHint');
    hint.textContent = '已自动保存';
    hint.classList.add('show');
    setTimeout(() => hint.classList.remove('show'), 1800);
  }, 800);
}

/* ============================================================
   模块七：设置
   ============================================================ */

function renderSettings() {
  const s = state.settings;
  const setVal = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = v ?? ''; };
  setVal('#sTitle', s.title); setVal('#sSubtitle', s.subtitle);
  setVal('#sDate', s.weddingDate); setVal('#sVenue', s.venue);
  setVal('#sBudget', s.budget); setVal('#sSpent', s.spent);
  const boughtSum = Math.round(state.items.filter(i => i.status === 'purchased').reduce((x, i) => x + (i.price || 0), 0) * 100) / 100;
  $('#spentRef').textContent = `好物清单已购合计 ¥${fmtPrice(boughtSum)}（供参考，「已花费」可手动填写更大口径的数字）`;
  const spent = s.spent != null ? s.spent : boughtSum;
  const bar = $('#budgetBar');
  if (s.budget > 0) {
    bar.hidden = false;
    const pct = Math.min(100, Math.round(spent / s.budget * 100));
    bar.querySelector('i').style.width = pct + '%';
    $('#spentRef').textContent += ` · 已用 ${pct}%` + (spent > s.budget ? '（超支，注意控制）' : '');
  } else bar.hidden = true;
  $$('.theme-row .theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === document.documentElement.dataset.theme));
  $('#btnExport2').href = exportUrl();
  const box = $('#accountsBox');
  if (isAdmin()) {
    box.hidden = false;
    $('#accountsList').innerHTML = (state.accounts || []).map(a => `<div class="account-row">
      <span class="a-name">${esc(a.username)}</span>
      ${a.role === 'admin' ? '<span class="a-role">管理员</span>' : ''}
      <span class="a-stats">好物 ${a.itemCount} 件 · 已购 ${a.boughtCount} 件</span>
      <button class="btn btn-ghost" data-view-account="${esc(a.username)}">查看内容</button>
    </div>`).join('');
  } else box.hidden = true;
}

function exportUrl() {
  let u = '/api/export?token=' + encodeURIComponent(state.token);
  if (asQuery()) u += '&' + asQuery();
  return u;
}

/* ============================================================
   弹窗 / 轻提示 / 彩带 / 复制 / 主题
   ============================================================ */

function openModal(el) {
  el.hidden = false;
  document.body.classList.add('modal-open');
  const first = el.querySelector('input:not([readonly]):not([type=radio]):not([type=file]), textarea');
  if (first) setTimeout(() => first.focus(), 60);
}
function closeModal(el) {
  el.hidden = true;
  if (!$$('.modal-wrap:not([hidden])').length && $('#drawerWrap').hidden) document.body.classList.remove('modal-open');
}
function closeTopModal() {
  const open = $$('.modal-wrap:not([hidden])');
  if (open.length) {
    const w = open[open.length - 1];
    if (w.id === 'modalName') settleName(null); else closeModal(w);
    return true;
  }
  return false;
}

let extractedNote = false;
function openAddModal(editItem) {
  state.editingId = editItem ? editItem.id : null;
  extractedNote = false;
  $('#addModalTitle').textContent = editItem ? '编辑好物' : '添加好物';
  $('#addSubmit').textContent = editItem ? '保存修改' : '添加到清单';
  $('#fUrl').value = editItem ? editItem.url : '';
  $('#fTitle').value = editItem ? editItem.title : '';
  const phase = editItem ? editItem.phase : '通用';
  $$('input[name=fPhase]').forEach(r => { r.checked = r.value === phase; });
  $('#fCat').value = editItem ? editItem.category : '';
  $('#fPrice').value = editItem && editItem.price != null ? editItem.price : '';
  $('#fNote').value = editItem ? editItem.note || '' : '';
  $('#fBy').value = editItem ? editItem.addedBy : (myName || me());
  updateUrlHint();
  openModal($('#modalAdd'));
}

function updateUrlHint() {
  const raw = $('#fUrl').value.trim();
  const hint = $('#urlHint');
  const url = extractUrl(raw) || raw;
  if (!url) { hint.className = 'url-hint'; hint.innerHTML = '整段分享文本可直接粘贴，自动提取链接并识别平台'; return; }
  let valid = false;
  try { const u = new URL(url); valid = u.protocol === 'http:' || u.protocol === 'https:'; } catch { /* 无效 */ }
  if (!valid) { hint.className = 'url-hint'; hint.innerHTML = '未检测到链接：请粘贴商品链接，或整段分享文本（纯淘口令符号无法跳转）'; return; }
  const pf = detectPlatform(url);
  const p = PLATFORMS[pf] || PLATFORMS['其他'];
  const prefix = extractedNote ? '已从分享文本中自动提取链接 · ' : '';
  hint.className = 'url-hint ok';
  hint.innerHTML = `<span class="pbadge" style="--pc:${p.color}">${p.mark}</span>${prefix}已识别为「${esc(pf)}」，保存后点卡片即可跳转`;
}

function handleUrlPaste() {
  setTimeout(() => {
    const raw = $('#fUrl').value;
    const url = extractUrl(raw);
    if (url && url !== raw.trim()) {
      $('#fUrl').value = url;
      const t = extractShareTitle(raw);
      if (t && !$('#fTitle').value.trim()) $('#fTitle').value = t;
      extractedNote = true;
    }
    updateUrlHint();
  }, 0);
}

async function submitAddForm(e) {
  e.preventDefault();
  const rawUrl = $('#fUrl').value.trim();
  const url = extractUrl(rawUrl) || rawUrl;
  if (url !== rawUrl) $('#fUrl').value = url;
  let valid = false;
  try { const u = new URL(url); valid = u.protocol === 'http:' || u.protocol === 'https:'; } catch { /* 无效 */ }
  if (!valid) { toast('请粘贴商品链接或整段分享文本（会自动提取链接）', 'error'); $('#fUrl').focus(); return; }
  const by = $('#fBy').value.trim();
  if (by) { myName = by; LS.set('xishi_name', by); }
  const body = {
    url,
    title: $('#fTitle').value.trim() || extractShareTitle(rawUrl),
    phase: ($$('input[name=fPhase]').find(r => r.checked) || {}).value || '通用',
    category: $('#fCat').value.trim() || '其他',
    price: $('#fPrice').value === '' ? null : Number($('#fPrice').value),
    note: $('#fNote').value.trim(),
    addedBy: by || me()
  };
  const btn = $('#addSubmit');
  btn.disabled = true;
  try {
    if (state.editingId) {
      await api(`/api/items/${encodeURIComponent(state.editingId)}`, { method: 'PATCH', body });
      toast('已保存修改', 'success');
    } else {
      await api(withAs('/api/items'), { method: 'POST', body });
      toast('已添加到清单', 'success');
      confetti();
    }
    closeModal($('#modalAdd'));
    if (state.module !== 'items') switchModule('items');
    state.itemView = 'todo';
    fetchState();
  } catch (err) { toast(err.message, 'error'); }
  finally { btn.disabled = false; }
}

let nameResolve = null;
function askName(title, label, def) {
  return new Promise(resolve => {
    nameResolve = resolve;
    $('#nameTitle').textContent = title;
    $('#nameLabel').textContent = label;
    $('#nameInput').value = def !== undefined ? def : '';
    openModal($('#modalName'));
  });
}
function settleName(value) {
  closeModal($('#modalName'));
  if (nameResolve) { const r = nameResolve; nameResolve = null; r(value); }
}

function toast(msg, type = 'info', action) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : '');
  if (action) el.querySelector('button').addEventListener('click', () => { remove(); action.fn(); });
  box.appendChild(el);
  const timer = setTimeout(remove, action ? 7000 : 3800);
  function remove() {
    clearTimeout(timer);
    if (!el.parentNode) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }
}

function confetti() {
  const layer = $('#confetti');
  const chars = ['囍', '♥', '✦', '❀'];
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('span');
    s.textContent = chars[i % chars.length];
    s.style.left = (32 + Math.random() * 36) + '%';
    s.style.setProperty('--dx', (Math.random() * 180 - 90) + 'px');
    s.style.setProperty('--r', (Math.random() * 360 - 180) + 'deg');
    s.style.animationDelay = (Math.random() * .25) + 's';
    s.style.color = i % 2 ? 'var(--gold)' : 'var(--primary)';
    layer.appendChild(s);
    setTimeout(() => s.remove(), 1900);
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* 忽略 */ }
    ta.remove();
    return ok;
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  LS.set('xishi_theme', theme);
  $$('.theme-opt, .m-theme').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  const meta = $('meta[name=theme-color]');
  const colors = { xi: '#B3282D', tao: '#D4576B', dai: '#2F5D68' };
  if (meta) meta.content = colors[theme] || colors.xi;
}

/* ============================================================
   事件绑定
   ============================================================ */

function bindEvents() {
  /* 登录 */
  $('#luToggle').addEventListener('click', () => setLoginMode(loginMode === 'login' ? 'register' : 'login'));
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const username = $('#luUser').value.trim();
    const password = $('#luPass').value;
    const btn = $('#luSubmit');
    btn.disabled = true;
    try {
      const r = await api('/api/' + (loginMode === 'login' ? 'login' : 'register'), { method: 'POST', body: { username, password }, noAuthRedirect: true });
      state.token = r.token;
      LS.set('xishi_token', r.token);
      $('#luPass').value = '';
      enterApp();
      toast(loginMode === 'login' ? '欢迎回来' : '注册成功，已为你创建独立清单', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; }
  });
  $('#btnLogout').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch { /* 忽略 */ }
    state.token = ''; state.user = null;
    LS.del('xishi_token');
    showLogin();
    toast('已退出登录', 'info');
  });

  /* 移动端更多菜单 */
  $('#btnMore').addEventListener('click', e => { e.stopPropagation(); $('#morePop').hidden = !$('#morePop').hidden; });
  $('#btnShareM').addEventListener('click', () => { $('#morePop').hidden = true; $('#btnShare').click(); });
  $('#btnLogoutM').addEventListener('click', () => { $('#morePop').hidden = true; $('#btnLogout').click(); });
  $('#asSelectM').addEventListener('change', () => {
    state.viewAs = $('#asSelectM').value;
    state.filters.owner = 'all';
    state.loading = true;
    $('#morePop').hidden = true;
    fetchState();
  });

  /* 顶栏 */
  $('#btnAdd').addEventListener('click', () => openAddModal(null));
  $('#fabAdd').addEventListener('click', () => openAddModal(null));
  $('#btnShare').addEventListener('click', () => {
    $('#shareLink').value = location.origin + location.pathname;
    $('#btnExport').href = exportUrl();
    openModal($('#modalShare'));
  });
  $('#btnGoSettings').addEventListener('click', () => switchModule('settings'));
  $('#asSelect').addEventListener('change', () => {
    state.viewAs = $('#asSelect').value;
    state.filters.owner = 'all';
    state.loading = true;
    fetchState();
  });

  /* 主题 */
  $('#btnTheme').addEventListener('click', e => { e.stopPropagation(); $('#themePop').hidden = !$('#themePop').hidden; });
  $$('.theme-opt, .m-theme').forEach(b => b.addEventListener('click', () => { applyTheme(b.dataset.theme); $('#themePop').hidden = true; $('#morePop').hidden = true; if (state.module === 'settings') renderSettings(); }));
  document.addEventListener('click', e => {
    if (!e.target.closest('.theme-wrap')) $('#themePop').hidden = true;
    if (!e.target.closest('.more-wrap')) $('#morePop').hidden = true;
  });

  /* 模块导航 */
  $('#mainnav').addEventListener('click', e => {
    const b = e.target.closest('button[data-mod]');
    if (b) switchModule(b.dataset.mod);
  });

  /* 好物：视图切换 / 筛选 */
  $('#itemViewSeg').addEventListener('click', e => {
    const b = e.target.closest('button[data-view]');
    if (!b) return;
    state.itemView = b.dataset.view;
    state.bulk.clear();
    renderItemsModule();
  });
  $('#phaseTabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-phase]');
    if (!b) return;
    state.filters.phase = b.dataset.phase;
    renderTabs(); renderGrid();
  });
  let qTimer = null;
  $('#q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.filters.q = $('#q').value.trim(); renderGrid(); }, 180); });
  $('#fOwner').addEventListener('change', () => { state.filters.owner = $('#fOwner').value; renderGrid(); });
  $('#fCategory').addEventListener('change', () => { state.filters.category = $('#fCategory').value; renderGrid(); });
  $('#fPlatform').addEventListener('change', () => { state.filters.platform = $('#fPlatform').value; renderGrid(); });
  $('#fSort').addEventListener('change', () => { state.filters.sort = $('#fSort').value; renderGrid(); });
  $('#chipMine').addEventListener('click', () => {
    state.filters.mine = !state.filters.mine;
    $('#chipMine').classList.toggle('on', state.filters.mine);
    $('#chipMine').setAttribute('aria-pressed', String(state.filters.mine));
    renderGrid();
  });
  $('#retryBtn').addEventListener('click', () => { state.loading = true; state.error = null; renderGrid(); fetchState(); });

  /* 好物：卡片委托 */
  $('#grid').addEventListener('click', e => {
    const actEl = e.target.closest('[data-act]');
    const act = actEl && actEl.dataset.act;
    if (act === 'add-first') { openAddModal(null); return; }
    if (act === 'goto-todo') { state.itemView = 'todo'; renderItemsModule(); return; }
    if (act === 'clear-filters') {
      state.filters = { phase: 'all', q: '', category: 'all', platform: 'all', sort: state.filters.sort, mine: false, owner: 'all' };
      $('#q').value = ''; $('#fPlatform').value = 'all'; $('#fOwner').value = 'all';
      $('#chipMine').classList.remove('on');
      renderTabs(); renderCategoryOptions(); renderGrid();
      return;
    }
    const card = e.target.closest('.card');
    if (!card) return;
    const id = card.dataset.id;
    if (act === 'like') { e.preventDefault(); toggleLike(id); return; }
    if (act === 'del') { e.preventDefault(); deleteItems([id]); return; }
    if (act === 'pick' || act === 'go' || e.target.closest('.pick')) return;
    openDrawer(id);
  });
  $('#grid').addEventListener('change', e => {
    if (e.target.dataset.act !== 'pick') return;
    const card = e.target.closest('.card');
    if (!card) return;
    if (e.target.checked) state.bulk.add(card.dataset.id); else state.bulk.delete(card.dataset.id);
    card.classList.toggle('is-checked', e.target.checked);
    renderBulkBar();
  });
  $('#grid').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('card')) openDrawer(e.target.dataset.id);
  });

  /* 批量 */
  $('#bulkBuy').addEventListener('click', () => {
    if (state.itemView === 'bought') unpurchase([...state.bulk]); else markPurchased([...state.bulk]);
  });
  $('#bulkDel').addEventListener('click', () => deleteItems([...state.bulk]));
  $('#bulkCancel').addEventListener('click', () => { state.bulk.clear(); renderGrid(); renderBulkBar(); });

  /* 抽屉 */
  $('#drawerWrap').addEventListener('click', e => {
    if (e.target.hasAttribute('data-close-drawer')) { closeDrawer(); return; }
    const actEl = e.target.closest('[data-act]');
    if (!actEl) return;
    const id = state.drawerId;
    const act = actEl.dataset.act;
    if (act === 'close') closeDrawer();
    else if (act === 'like') toggleLike(id);
    else if (act === 'edit') { const it = state.items.find(i => i.id === id); if (it) { closeDrawer(); openAddModal(it); } }
    else if (act === 'buy') {
      const it = state.items.find(i => i.id === id);
      if (!it) return;
      if (it.status === 'purchased') unpurchase([id]); else markPurchased([id]);
    }
    else if (act === 'del') deleteItems([id]);
    else if (act === 'copy-url') {
      const it = state.items.find(i => i.id === id);
      if (it) copyText(it.url).then(ok => toast(ok ? '链接已复制' : '复制失败，请长按手动复制', ok ? 'success' : 'error'));
    }
  });

  /* 弹窗关闭 */
  $$('.modal-wrap').forEach(w => w.addEventListener('click', e => {
    if (e.target.hasAttribute('data-close-modal')) {
      if (w.id === 'modalName') settleName(null); else closeModal(w);
    }
  }));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (closeTopModal()) return;
    if (!$('#drawerWrap').hidden) { closeDrawer(); return; }
    $('#themePop').hidden = true;
    $('#morePop').hidden = true;
  });

  /* 添加好物表单 */
  $('#addForm').addEventListener('submit', submitAddForm);
  $('#fUrl').addEventListener('input', () => { extractedNote = false; updateUrlHint(); });
  $('#fUrl').addEventListener('paste', handleUrlPaste);

  /* 通用输入弹窗 */
  $('#nameForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#nameInput').value.trim();
    if (!v) { toast('请填写内容', 'error'); return; }
    settleName(v);
  });
  $('#nameCancel').addEventListener('click', () => settleName(null));

  /* 分享与备份 */
  $('#btnCopyLink').addEventListener('click', async () => {
    const ok = await copyText($('#shareLink').value);
    toast(ok ? '链接已复制，发给家人吧' : '复制失败，请长按手动复制', ok ? 'success' : 'error');
  });
  const doImport = () => $('#fileImport').click();
  $('#btnImport').addEventListener('click', doImport);
  $('#btnImport2').addEventListener('click', doImport);
  $('#fileImport').addEventListener('change', async () => {
    const file = $('#fileImport').files[0];
    $('#fileImport').value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.items)) throw new Error('文件中没有 items 数组');
      if (!confirm(`导入将覆盖当前账号的清单（备份内共 ${data.items.length} 件），确定继续？`)) return;
      const r = await api(withAs('/api/import'), { method: 'POST', body: { mode: 'replace', items: data.items, settings: data.settings, data: data.data } });
      toast(`导入成功，共 ${r.count} 件好物`, 'success');
      fetchState();
    } catch (err) { toast('导入失败：' + err.message, 'error'); }
  });
  $('#btnClearSeed').addEventListener('click', clearSeedItems);
  $('#btnClearSeed2').addEventListener('click', clearSeedItems);
  $('#btnClearAll').addEventListener('click', clearAllItems);
  $('#btnClearAll2').addEventListener('click', clearAllItems);

  /* 备婚清单 */
  $('#ckAddCat').addEventListener('click', () => {
    const v = $('#ckNewCat').value.trim();
    if (!v) { toast('请输入分类名称', 'error'); return; }
    if ((state.data.checklist || []).some(i => i.cat === v)) { toast('该分类已存在', 'error'); return; }
    state.data.checklist.push({ id: cuid(), cat: v, text: '待补充事项', done: false, createdAt: Date.now() });
    $('#ckNewCat').value = '';
    renderChecklist();
    saveData('checklist');
  });
  $('#ckNewCat').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#ckAddCat').click(); } });
  $('#ckList').addEventListener('click', async e => {
    const actEl = e.target.closest('[data-ck]');
    if (!actEl) return;
    const act = actEl.dataset.ck;
    const catEl = e.target.closest('.ck-cat');
    const cat = catEl ? catEl.dataset.cat : '';
    const itemEl = e.target.closest('.ck-item');
    const id = itemEl ? itemEl.dataset.id : '';
    const list = state.data.checklist;
    if (act === 'add') { ckAddItem(cat, catEl.querySelector('[data-ckinput]')); return; }
    if (act === 'del') {
      state.data.checklist = list.filter(i => i.id !== id);
      renderChecklist(); saveData('checklist'); return;
    }
    if (act === 'edit') {
      const it = list.find(i => i.id === id);
      if (!it) return;
      const v = await askName('修改事项', '事项内容', it.text);
      if (v == null) return;
      it.text = v;
      renderChecklist(); saveData('checklist'); return;
    }
    if (act === 'rename-cat') {
      const v = await askName('重命名分类', '分类名称', cat);
      if (v == null || v === cat) return;
      list.forEach(i => { if (i.cat === cat) i.cat = v; });
      renderChecklist(); saveData('checklist'); return;
    }
    if (act === 'del-cat') {
      if (!confirm(`删除分类「${cat}」及其全部事项？`)) return;
      state.data.checklist = list.filter(i => i.cat !== cat);
      renderChecklist(); saveData('checklist'); return;
    }
  });
  $('#ckList').addEventListener('change', e => {
    if (e.target.dataset.ck !== 'toggle') return;
    const id = e.target.closest('.ck-item').dataset.id;
    const it = state.data.checklist.find(i => i.id === id);
    if (it) { it.done = e.target.checked; renderChecklist(); saveData('checklist'); }
  });
  $('#ckList').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.hasAttribute('data-ckinput')) {
      e.preventDefault();
      ckAddItem(e.target.closest('.ck-cat').dataset.cat, e.target);
    }
  });

  /* 今日计划 */
  $('#taskAdd').addEventListener('click', () => {
    const text = $('#taskText').value.trim();
    if (!text) { toast('请输入计划内容', 'error'); return; }
    state.data.tasks.push({ id: cuid(), text, date: $('#taskDate').value || todayStr(), done: false, createdAt: Date.now() });
    $('#taskText').value = '';
    renderTasks(); saveData('tasks');
  });
  $('#taskText').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#taskAdd').click(); } });
  $('#taskFilter').addEventListener('click', e => {
    const b = e.target.closest('button[data-tf]');
    if (!b) return;
    state.taskFilter = b.dataset.tf;
    renderTasks();
  });
  $('#taskList').addEventListener('click', e => {
    const actEl = e.target.closest('[data-task]');
    if (!actEl) return;
    const id = e.target.closest('.task-row').dataset.id;
    if (actEl.dataset.task === 'del') {
      state.data.tasks = state.data.tasks.filter(t => t.id !== id);
      renderTasks(); saveData('tasks');
    }
  });
  $('#taskList').addEventListener('change', e => {
    if (e.target.dataset.task !== 'toggle') return;
    const id = e.target.closest('.task-row').dataset.id;
    const t = state.data.tasks.find(x => x.id === id);
    if (t) { t.done = e.target.checked; renderTasks(); saveData('tasks'); }
  });

  /* 备婚流程 */
  $('#cdBanner').addEventListener('click', e => { if (e.target.closest('[data-go-settings]')) switchModule('settings'); });
  $('#tlAddBtn').addEventListener('click', () => {
    state.editingTl = null;
    $('#tlModalTitle').textContent = '新增节点';
    $('#tlForm').reset();
    openModal($('#modalTimeline'));
  });
  $('#tlForm').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#tlTitle').value.trim();
    if (!title) return;
    const obj = { title, date: $('#tlDate').value || '', note: $('#tlNote').value.trim() };
    if (state.editingTl) {
      const t = state.data.timeline.find(x => x.id === state.editingTl);
      if (t) Object.assign(t, obj);
    } else {
      state.data.timeline.push(Object.assign({ id: cuid(), done: false }, obj));
    }
    closeModal($('#modalTimeline'));
    renderTimeline(); saveData('timeline');
    toast('已保存节点', 'success');
  });
  $('#tlList').addEventListener('click', e => {
    const actEl = e.target.closest('[data-tl]');
    if (!actEl) return;
    const id = e.target.closest('.tl-item').dataset.id;
    const t = state.data.timeline.find(x => x.id === id);
    if (!t) return;
    const act = actEl.dataset.tl;
    if (act === 'toggle') { t.done = !t.done; renderTimeline(); saveData('timeline'); }
    else if (act === 'del') {
      if (!confirm(`删除节点「${t.title}」？`)) return;
      state.data.timeline = state.data.timeline.filter(x => x.id !== id);
      renderTimeline(); saveData('timeline');
    } else if (act === 'edit') {
      state.editingTl = id;
      $('#tlModalTitle').textContent = '编辑节点';
      $('#tlTitle').value = t.title;
      $('#tlDate').value = t.date || '';
      $('#tlNote').value = t.note || '';
      openModal($('#modalTimeline'));
    }
  });

  /* 双方准备 */
  $('#sideSeg').addEventListener('click', e => {
    const b = e.target.closest('button[data-side]');
    if (!b) return;
    state.side = b.dataset.side;
    renderSides();
  });
  $('#sideContent').addEventListener('click', e => {
    const actEl = e.target.closest('[data-side]');
    if (!actEl) return;
    const act = actEl.dataset.side;
    const side = state.data.sides[state.side];
    if (act === 'outfit-add') {
      const input = $('#sideContent').querySelector('[data-side-input]');
      const v = input.value.trim();
      if (!v) return;
      side.outfit.push({ id: cuid(), text: v, done: false });
      input.value = '';
      renderSides(); saveData('sides');
      const el = $('#sideContent').querySelector('[data-side-input]');
      if (el) el.focus();
      return;
    }
    if (act === 'outfit-del') {
      const id = e.target.closest('.ck-item').dataset.id;
      side.outfit = side.outfit.filter(o => o.id !== id);
      renderSides(); saveData('sides'); return;
    }
    if (act === 'guest-add') {
      state.editingGuest = null;
      $('#guestModalTitle').textContent = '添加宾客';
      $('#guestForm').reset();
      $('#gCount').value = 1;
      openModal($('#modalGuest'));
      return;
    }
    const card = e.target.closest('.guest-card');
    if (!card) return;
    const id = card.dataset.id;
    if (act === 'guest-del') {
      side.guests = side.guests.filter(g => g.id !== id);
      renderSides(); saveData('sides'); return;
    }
    if (act === 'guest-edit') {
      const g = side.guests.find(x => x.id === id);
      if (!g) return;
      state.editingGuest = id;
      $('#guestModalTitle').textContent = '编辑宾客';
      $('#gName').value = g.name;
      $('#gCount').value = g.count || 1;
      $('#gRelation').value = g.relation || '';
      $('#gPhone').value = g.phone || '';
      $('#gNote').value = g.note || '';
      openModal($('#modalGuest'));
    }
  });
  $('#sideContent').addEventListener('change', e => {
    const side = state.data.sides[state.side];
    if (e.target.dataset.side === 'outfit-toggle') {
      const id = e.target.closest('.ck-item').dataset.id;
      const o = side.outfit.find(x => x.id === id);
      if (o) { o.done = e.target.checked; renderSides(); saveData('sides'); }
      return;
    }
    if (e.target.hasAttribute('data-field')) {
      side.fields[e.target.dataset.field] = e.target.value.trim();
      saveData('sides');
    }
  });
  $('#sideContent').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.hasAttribute('data-side-input')) {
      e.preventDefault();
      $('#sideContent').querySelector('[data-side="outfit-add"]').click();
    }
  });
  $('#guestForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#gName').value.trim();
    if (!name) return;
    const side = state.data.sides[state.side];
    const obj = {
      name,
      count: Math.max(1, Math.min(99, Number($('#gCount').value) || 1)),
      relation: $('#gRelation').value.trim(),
      phone: $('#gPhone').value.trim(),
      note: $('#gNote').value.trim()
    };
    if (state.editingGuest) {
      const g = side.guests.find(x => x.id === state.editingGuest);
      if (g) Object.assign(g, obj);
    } else {
      side.guests.push(Object.assign({ id: cuid() }, obj));
    }
    closeModal($('#modalGuest'));
    renderSides(); saveData('sides');
    toast('宾客已保存', 'success');
  });

  /* 备忘录 */
  $('#ctAddBtn').addEventListener('click', () => {
    state.editingContact = null;
    $('#contactModalTitle').textContent = '添加商家';
    $('#contactForm').reset();
    openModal($('#modalContact'));
  });
  $('#ctList').addEventListener('click', e => {
    const actEl = e.target.closest('[data-ct]');
    if (!actEl) return;
    const id = e.target.closest('.ct-card').dataset.id;
    const act = actEl.dataset.ct;
    if (act === 'del') {
      state.data.memo.contacts = state.data.memo.contacts.filter(c => c.id !== id);
      renderMemo(); saveData('memo'); return;
    }
    if (act === 'edit') {
      const c = state.data.memo.contacts.find(x => x.id === id);
      if (!c) return;
      state.editingContact = id;
      $('#contactModalTitle').textContent = '编辑商家';
      $('#cName').value = c.name;
      $('#cPhone').value = c.phone || '';
      $('#cNote').value = c.note || '';
      openModal($('#modalContact'));
    }
  });
  $('#contactForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#cName').value.trim();
    if (!name) return;
    const obj = { name, phone: $('#cPhone').value.trim(), note: $('#cNote').value.trim() };
    if (state.editingContact) {
      const c = state.data.memo.contacts.find(x => x.id === state.editingContact);
      if (c) Object.assign(c, obj);
    } else {
      state.data.memo.contacts.push(Object.assign({ id: cuid() }, obj));
    }
    closeModal($('#modalContact'));
    renderMemo(); saveData('memo');
    toast('商家已保存', 'success');
  });
  $('#memoDiet').addEventListener('input', e => memoInput('diet', e.target.value));
  $('#memoInsp').addEventListener('input', e => memoInput('inspiration', e.target.value));
  $('#memoFamily').addEventListener('input', e => memoInput('family', e.target.value));

  /* 设置 */
  $('#settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const s = await api(withAs('/api/settings'), {
        method: 'PUT',
        body: {
          title: $('#sTitle').value.trim(),
          subtitle: $('#sSubtitle').value.trim(),
          weddingDate: $('#sDate').value,
          venue: $('#sVenue').value.trim(),
          budget: $('#sBudget').value === '' ? null : Number($('#sBudget').value),
          spent: $('#sSpent').value === '' ? null : Number($('#sSpent').value)
        }
      });
      state.settings = s;
      renderHeader(); renderSettings();
      toast('设置已保存', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('/api/password', { method: 'PUT', body: { oldPassword: $('#pwOld').value, newPassword: $('#pwNew').value } });
      $('#pwOld').value = ''; $('#pwNew').value = '';
      toast('密码已修改，下次登录用新密码', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
  $('#accountsList').addEventListener('click', e => {
    const b = e.target.closest('[data-view-account]');
    if (!b) return;
    state.viewAs = b.dataset.viewAccount;
    state.loading = true;
    switchModule('items');
    fetchState();
  });

  /* 顶栏滚动阴影 */
  window.addEventListener('scroll', () => { $('#topbar').classList.toggle('scrolled', window.scrollY > 8); }, { passive: true });
}

/* ---------- 启动 ---------- */
applyTheme(LS.get('xishi_theme', 'xi'));
bindEvents();
setLoginMode('login');
if (state.token) enterApp(); else showLogin();
