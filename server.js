#!/usr/bin/env node
/**
 * 囍事清单 · 备婚工作台
 * 零依赖 Node.js 服务：账号登录 + 数据隔离 + 静态页面 + JSON 存储 + SSE 实时同步
 * 启动：node server.js （默认 http://localhost:3000，无需 npm install）
 * 管理员账号：阿龙 / 123456（首次启动自动创建，可在应用内修改密码）
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const ADMIN_USER = '阿龙';
const ADMIN_PASS = '123456';
const PHASES = ['订婚', '结婚', '通用'];
const STATUSES = ['pending', 'purchased'];
const DATA_KEYS = ['checklist', 'tasks', 'timeline', 'sides', 'memo'];
const MAX_ITEMS = 3000;

/* ---------------- 工具 ---------------- */

function uid() { return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString('hex'); }
function cleanStr(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function validUrl(u) { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; } }

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

function cleanPrice(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(Math.min(n, 99999999) * 100) / 100;
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

function hashPass(pw, salt) { return crypto.scryptSync(String(pw), salt, 64).toString('hex'); }
function makeUser(pw, role) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: hashPass(pw, salt), role, createdAt: Date.now(), settings: defaultSettings(), data: defaultUserData() };
}

/* ---------------- 默认数据 ---------------- */

function defaultSettings() {
  return { title: '囍事清单', subtitle: '订婚 · 结婚好物，家人一起挑', weddingDate: '', venue: '', budget: null, spent: null };
}

function defaultUserData() {
  const ck = (cat, texts) => texts.map(t => ({ id: uid(), cat, text: t, done: false, createdAt: Date.now() }));
  const outfit = texts => texts.map(t => ({ id: uid(), text: t, done: false }));
  return {
    checklist: [
      ...ck('婚礼现场用品', ['签到台布置用品', '桌卡/座位牌', '鲜花装饰']),
      ...ck('仪式道具', ['戒指托/戒指盒', '誓言卡', '交杯酒杯']),
      ...ck('喜糖喜帖', ['喜糖盒', '喜帖/电子请柬', '喜糖']),
      ...ck('宾客伴手礼', ['伴手礼袋/盒', '伴手礼内容物'])
    ],
    tasks: [],
    timeline: ['提亲', '订婚', '领证', '拍婚纱照', '定酒店婚庆', '发请柬', '婚礼彩排', '婚礼当天'].map(t => ({ id: uid(), title: t, date: '', note: '', done: false })),
    sides: {
      male: {
        outfit: outfit(['西装套装（定制/租赁）', '衬衫×2', '领结/领带', '皮鞋', '腰带', '袖扣', '袜子']),
        guests: [],
        fields: { '主婚车': '', '跟车数量': '', '司机安排': '', '行车路线': '', '集合时间': '', '彩礼金额': '', '伴郎伴手礼': '' }
      },
      female: {
        outfit: outfit(['出门纱', '主婚纱', '敬酒服', '婚鞋', '头饰/头纱', '晨袍', '回门服']),
        guests: [],
        fields: { '嫁妆金额': '', '伴娘伴手礼': '', '接亲游戏道具': '', '婚房布置': '', '其他安排': '' }
      }
    },
    memo: {
      contacts: ['婚庆公司', '酒店', '摄影师'].map(n => ({ id: uid(), name: n, phone: '', note: '' })),
      diet: '', inspiration: '', family: ''
    }
  };
}

function seedItems(owner) {
  const now = Date.now();
  const tb = q => 'https://s.taobao.com/search?q=' + encodeURIComponent(q);
  const jd = q => 'https://search.jd.com/Search?enc=utf-8&keyword=' + encodeURIComponent(q);
  const pdd = q => 'https://mobile.yangkeduo.com/search_result.html?search_key=' + encodeURIComponent(q);
  const rows = [
    ['订婚', '三金五金', '足金999古法龙凤手镯', 8680, tb('足金999古法龙凤手镯'), '三金提前看款，古法工艺耐看，克重实在', '妈妈', ['seed-a', 'seed-b', 'seed-c'], 'pending', ''],
    ['订婚', '婚戒对戒', '18K金简约情侣对戒', 2399, jd('18K金情侣对戒'), '日常能戴的细圈款，支持免费刻字', '新郎', ['seed-a', 'seed-d'], 'pending', ''],
    ['订婚', '婚纱礼服', '新中式订婚旗袍裙', 699, pdd('新中式订婚旗袍裙'), '订婚宴敬酒穿，红色显白，有运费险', '表姐', ['seed-b', 'seed-c', 'seed-d', 'seed-e'], 'pending', ''],
    ['订婚', '红包改口', '刺绣锦缎改口红包（一对）', 39.9, tb('刺绣锦缎改口红包 万元'), '万元改口费要用大红包，锦缎面拍照好看', '妈妈', ['seed-c'], 'pending', ''],
    ['结婚', '婚纱礼服', '法式缎面主纱 拖尾款', 1580, tb('法式缎面主纱 拖尾'), '出门纱+主纱两穿，送头纱和裙撑', '新娘', ['seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e'], 'pending', ''],
    ['结婚', '婚房布置', '全屋囍字拉花布置套装', 128, pdd('全屋囍字拉花布置套装'), '含床头囍、窗花、拉花，一套搞定客厅卧室', '表姐', ['seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e', 'seed-f'], 'pending', ''],
    ['结婚', '喜糖伴手礼', '中式流苏喜糖盒 100个', 156, pdd('中式流苏喜糖盒'), '已下单，搭配费列罗刚好，备婚群都在推', '爸爸', ['seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e', 'seed-f', 'seed-g'], 'purchased', '爸爸'],
    ['结婚', '床品家纺', '龙凤呈祥长绒棉四件套', 899, jd('龙凤呈祥长绒棉四件套'), '正红色不偏色，1.8m床笠款', '妈妈', ['seed-b', 'seed-d', 'seed-f'], 'pending', ''],
    ['结婚', '请柬纸品', '新中式烫金请柬 定制', 50, tb('新中式烫金请柬 定制'), '50份起订，可印名字和婚期，提前一个月发', '新娘', ['seed-c', 'seed-e'], 'pending', ''],
    ['结婚', '婚车装饰', '婚车车头仿真玫瑰花盘', 88, pdd('婚车车头仿真玫瑰花盘'), '吸盘固定不伤车，花盘接亲后还能摆新房', '新郎', ['seed-a'], 'pending', ''],
    ['通用', '家电家具', '洗烘一体机 10KG', 3299, jd('洗烘一体机 10KG'), '婚房家电趁大促买，先量好摆放尺寸', '新郎', ['seed-d', 'seed-f'], 'pending', ''],
    ['通用', '美妆个护', '新娘跟妆急救安瓶', 168, tb('新娘跟妆急救安瓶'), '婚礼当天早起急救用，跟妆师推荐', '新娘', ['seed-b'], 'pending', '']
  ];
  return rows.map((r, i) => ({
    id: uid(), owner,
    phase: r[0], category: r[1], title: r[2], price: r[3], url: r[4],
    platform: detectPlatform(r[4]), note: r[5], addedBy: r[6],
    votes: r[7], status: r[8], purchasedBy: r[9],
    purchasedAt: r[8] === 'purchased' ? now - 3600e3 : null,
    createdAt: now - (rows.length - i) * 5 * 3600 * 1000,
    seed: true
  }));
}

/* ---------------- 存储与迁移 ---------------- */

let db;
function loadDb() {
  let parsed = null;
  try { parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { /* 新库 */ }
  if (!parsed || typeof parsed !== 'object') parsed = {};
  if (!parsed.users || typeof parsed.users !== 'object') {
    // 旧版数据迁移：全部归入管理员阿龙
    const admin = makeUser(ADMIN_PASS, 'admin');
    if (parsed.settings) admin.settings = Object.assign(defaultSettings(), parsed.settings);
    const oldItems = Array.isArray(parsed.items) ? parsed.items : seedItems(ADMIN_USER);
    parsed = {
      users: { [ADMIN_USER]: admin },
      sessions: {},
      items: oldItems.map(it => Object.assign({ owner: ADMIN_USER, purchasedAt: it.status === 'purchased' ? (it.createdAt || Date.now()) : null }, it))
    };
  }
  if (!parsed.users[ADMIN_USER]) parsed.users[ADMIN_USER] = makeUser(ADMIN_PASS, 'admin');
  parsed.users[ADMIN_USER].role = 'admin';
  if (!parsed.sessions) parsed.sessions = {};
  if (!Array.isArray(parsed.items)) parsed.items = [];
  for (const u of Object.values(parsed.users)) {
    u.settings = Object.assign(defaultSettings(), u.settings || {});
    u.data = Object.assign(defaultUserData(), u.data || {});
  }
  for (const it of parsed.items) if (!it.owner || !parsed.users[it.owner]) it.owner = ADMIN_USER;
  return parsed;
}

let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 250); }
function flush() {
  clearTimeout(saveTimer); saveTimer = null;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_PATH);
  } catch (e) { console.error('[囍事清单] 数据保存失败：', e.message); }
}
db = loadDb();
flush();

/* ---------------- SSE ---------------- */

const sseClients = new Set();
function broadcast() { for (const res of sseClients) { try { res.write('data: changed\n\n'); } catch { /* 忽略 */ } } }
setInterval(() => { for (const res of sseClients) { try { res.write(': hb\n\n'); } catch { /* 忽略 */ } } }, 25000).unref();
function changed() { save(); broadcast(); }

/* ---------------- HTTP 基础 ---------------- */

function sendJSON(res, code, obj, extra) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, extra || {}));
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 1024 * 1024) { reject(new Error('请求体过大')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('JSON 格式错误')); } });
    req.on('error', reject);
  });
}

/* ---------------- 鉴权 ---------------- */

function createSession(username) {
  const token = uid() + uid().replace(/-/g, '');
  db.sessions[token] = { username, createdAt: Date.now() };
  changed();
  return token;
}
function auth(req, url) {
  let token = '';
  const h = req.headers['authorization'] || '';
  if (h.startsWith('Bearer ')) token = h.slice(7).trim();
  if (!token) token = url.searchParams.get('token') || '';
  const s = db.sessions[token];
  if (!s || !db.users[s.username]) return null;
  return { username: s.username, user: db.users[s.username], token };
}

/* 管理员可通过 ?as= 查看/操作指定账号；普通用户只能操作自己 */
function resolveTarget(a, url) {
  const as = cleanStr(url.searchParams.get('as') || '', 20);
  if (a.user.role === 'admin' && as && db.users[as]) return as;
  return a.username;
}

/* ---------------- 条目校验 ---------------- */

function normalizeItem(body, owner, forRestore) {
  const rawUrl = cleanStr(body.url, 2000);
  const url = extractUrl(rawUrl) || rawUrl;
  if (!validUrl(url)) return { error: '链接无效：请粘贴商品链接或整段分享文本（会自动提取其中的链接）' };
  const item = {
    id: (typeof body.id === 'string' && /^[a-zA-Z0-9_-]{4,80}$/.test(body.id)) ? body.id : uid(),
    owner,
    url, platform: detectPlatform(url),
    title: cleanStr(body.title, 80) || '待命名好物',
    phase: PHASES.includes(body.phase) ? body.phase : '通用',
    category: cleanStr(body.category, 20) || '其他',
    price: cleanPrice(body.price),
    note: cleanStr(body.note, 300),
    addedBy: cleanStr(body.addedBy, 20) || '匿名',
    votes: forRestore && Array.isArray(body.votes) ? [...new Set(body.votes.filter(x => typeof x === 'string' && x.length <= 80))].slice(0, 20000) : [],
    status: STATUSES.includes(body.status) ? body.status : 'pending',
    purchasedBy: cleanStr(body.purchasedBy, 20),
    purchasedAt: forRestore && Number.isFinite(Number(body.purchasedAt)) ? Number(body.purchasedAt) : null,
    createdAt: forRestore && Number.isFinite(Number(body.createdAt)) ? Number(body.createdAt) : Date.now(),
    seed: forRestore ? body.seed === true : false
  };
  if (item.status !== 'purchased') { item.purchasedBy = ''; item.purchasedAt = null; }
  else if (!item.purchasedAt) item.purchasedAt = Date.now();
  return { item };
}

function canTouchItem(a, it) { return a.user.role === 'admin' || it.owner === a.username; }

/* ---------------- 路由 ---------------- */

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method;

  /* ---- 公开接口 ---- */
  if (method === 'POST' && pathname === '/api/register') {
    const b = await readBody(req);
    const username = cleanStr(b.username, 16);
    const password = typeof b.password === 'string' ? b.password : '';
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]{2,16}$/.test(username)) return sendJSON(res, 400, { error: '用户名需 2~16 位中文、字母、数字或下划线' });
    if (password.length < 6 || password.length > 64) return sendJSON(res, 400, { error: '密码需 6~64 位' });
    if (db.users[username]) return sendJSON(res, 409, { error: '该用户名已被注册' });
    db.users[username] = makeUser(password, 'user');
    const token = createSession(username);
    return sendJSON(res, 200, { token, user: { username, role: 'user' } });
  }

  if (method === 'POST' && pathname === '/api/login') {
    const b = await readBody(req);
    const username = cleanStr(b.username, 16);
    const u = db.users[username];
    if (!u || u.hash !== hashPass(String(b.password || ''), u.salt)) return sendJSON(res, 401, { error: '用户名或密码错误' });
    const token = createSession(username);
    return sendJSON(res, 200, { token, user: { username, role: u.role } });
  }

  /* ---- SSE（token 走查询参数） ---- */
  if (method === 'GET' && pathname === '/api/events') {
    const a = auth(req, url);
    if (!a) return sendJSON(res, 401, { error: '未登录' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    res.write('data: hello\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  /* ---- 以下均需登录 ---- */
  const a = auth(req, url);
  if (!a) return sendJSON(res, 401, { error: '未登录' });
  const isAdmin = a.user.role === 'admin';

  if (method === 'POST' && pathname === '/api/logout') {
    delete db.sessions[a.token];
    changed();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'PUT' && pathname === '/api/password') {
    const b = await readBody(req);
    if (a.user.hash !== hashPass(String(b.oldPassword || ''), a.user.salt)) return sendJSON(res, 400, { error: '原密码错误' });
    const np = String(b.newPassword || '');
    if (np.length < 6 || np.length > 64) return sendJSON(res, 400, { error: '新密码需 6~64 位' });
    a.user.salt = crypto.randomBytes(16).toString('hex');
    a.user.hash = hashPass(np, a.user.salt);
    changed();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/state') {
    const as = cleanStr(url.searchParams.get('as') || '', 20);
    const viewAs = (isAdmin && as && db.users[as]) ? as : (isAdmin ? '' : a.username);
    const target = viewAs || a.username;
    const items = viewAs ? db.items.filter(i => i.owner === viewAs) : (isAdmin ? db.items : db.items.filter(i => i.owner === a.username));
    const accounts = isAdmin ? Object.entries(db.users).map(([name, u]) => ({
      username: name, role: u.role,
      itemCount: db.items.filter(i => i.owner === name).length,
      boughtCount: db.items.filter(i => i.owner === name && i.status === 'purchased').length
    })) : null;
    return sendJSON(res, 200, {
      user: { username: a.username, role: a.user.role },
      viewAs, accounts,
      settings: db.users[target].settings,
      data: db.users[target].data,
      items
    });
  }

  if (method === 'PUT' && pathname === '/api/settings') {
    const target = resolveTarget(a, url);
    const b = await readBody(req);
    const s = db.users[target].settings;
    if (b.title !== undefined) s.title = cleanStr(b.title, 30) || s.title;
    if (b.subtitle !== undefined) s.subtitle = cleanStr(b.subtitle, 60);
    if (b.weddingDate !== undefined) s.weddingDate = cleanStr(b.weddingDate, 10);
    if (b.venue !== undefined) s.venue = cleanStr(b.venue, 60);
    if (b.budget !== undefined) s.budget = cleanPrice(b.budget);
    if (b.spent !== undefined) s.spent = cleanPrice(b.spent);
    changed();
    return sendJSON(res, 200, s);
  }

  if (method === 'PUT' && pathname === '/api/data') {
    const target = resolveTarget(a, url);
    const b = await readBody(req);
    if (!DATA_KEYS.includes(b.key)) return sendJSON(res, 400, { error: '未知数据模块' });
    if (JSON.stringify(b.value || null).length > 300000) return sendJSON(res, 400, { error: '数据过大' });
    db.users[target].data[b.key] = b.value;
    changed();
    return sendJSON(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/export') {
    const target = resolveTarget(a, url);
    const viewAs = cleanStr(url.searchParams.get('as') || '', 20);
    const items = (isAdmin && !viewAs) ? db.items : db.items.filter(i => i.owner === target);
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return sendJSON(res, 200, { settings: db.users[target].settings, data: db.users[target].data, items, viewAs: viewAs || target }, { 'Content-Disposition': `attachment; filename="xishi-backup-${stamp}.json"` });
  }

  if (method === 'POST' && pathname === '/api/import') {
    const target = resolveTarget(a, url);
    const b = await readBody(req);
    if (!Array.isArray(b.items)) return sendJSON(res, 400, { error: '备份文件格式不正确' });
    const cleaned = [];
    for (const raw of b.items.slice(0, MAX_ITEMS)) {
      const r = normalizeItem(raw, target, true);
      if (r.item) cleaned.push(r.item);
    }
    const scoped = db.items.filter(i => i.owner !== target);
    if (b.mode === 'replace') {
      db.items = scoped.concat(cleaned);
    } else {
      const map = new Map(db.items.map(i => [i.id, i]));
      for (const it of cleaned) map.set(it.id, it);
      db.items = [...map.values()].slice(0, MAX_ITEMS);
    }
    if (b.settings && typeof b.settings === 'object') db.users[target].settings = Object.assign(defaultSettings(), db.users[target].settings, {
      title: cleanStr(b.settings.title, 30) || db.users[target].settings.title,
      subtitle: cleanStr(b.settings.subtitle, 60),
      weddingDate: cleanStr(b.settings.weddingDate, 10),
      venue: cleanStr(b.settings.venue, 60),
      budget: cleanPrice(b.settings.budget), spent: cleanPrice(b.settings.spent)
    });
    if (b.data && typeof b.data === 'object') {
      for (const k of DATA_KEYS) if (b.data[k] !== undefined) db.users[target].data[k] = b.data[k];
    }
    changed();
    return sendJSON(res, 200, { ok: true, count: cleaned.length });
  }

  if (method === 'POST' && pathname === '/api/items') {
    if (db.items.length >= MAX_ITEMS) return sendJSON(res, 400, { error: '清单已满（上限3000件）' });
    const b = await readBody(req);
    const owner = resolveTarget(a, url);
    const isRestore = typeof b.id === 'string' && !db.items.some(i => i.id === b.id);
    const r = normalizeItem(b, owner, isRestore);
    if (r.error) return sendJSON(res, 400, { error: r.error });
    if (db.items.some(i => i.id === r.item.id)) return sendJSON(res, 409, { error: '该条目已存在' });
    db.items.unshift(r.item);
    changed();
    return sendJSON(res, 200, { item: r.item });
  }

  if (method === 'DELETE' && pathname === '/api/items') {
    const viewAs = cleanStr(url.searchParams.get('as') || '', 20);
    const scopeAll = isAdmin && !viewAs;
    const removed = scopeAll ? db.items : db.items.filter(i => i.owner === resolveTarget(a, url));
    const ids = new Set(removed.map(i => i.id));
    db.items = db.items.filter(i => !ids.has(i.id));
    changed();
    return sendJSON(res, 200, { removed: removed.length, items: removed });
  }

  if (method === 'DELETE' && pathname === '/api/seed') {
    const target = resolveTarget(a, url);
    const before = db.items.length;
    db.items = db.items.filter(i => !(i.seed && i.owner === target));
    changed();
    return sendJSON(res, 200, { removed: before - db.items.length });
  }

  let m = pathname.match(/^\/api\/items\/([a-zA-Z0-9_-]{4,80})\/vote$/);
  if (m && method === 'POST') {
    const it = db.items.find(i => i.id === m[1]);
    if (!it) return sendJSON(res, 404, { error: '条目不存在' });
    if (!canTouchItem(a, it)) return sendJSON(res, 403, { error: '无权操作其他账号的内容' });
    const idx = it.votes.indexOf(a.username);
    if (idx >= 0) it.votes.splice(idx, 1); else it.votes.push(a.username);
    changed();
    return sendJSON(res, 200, { count: it.votes.length, voted: idx < 0 });
  }

  m = pathname.match(/^\/api\/items\/([a-zA-Z0-9_-]{4,80})$/);
  if (m) {
    const it = db.items.find(i => i.id === m[1]);
    if (!it) return sendJSON(res, 404, { error: '条目不存在' });
    if (!canTouchItem(a, it)) return sendJSON(res, 403, { error: '无权操作其他账号的内容' });
    if (method === 'PATCH') {
      const b = await readBody(req);
      if (b.url !== undefined) {
        const u2 = extractUrl(cleanStr(b.url, 2000)) || cleanStr(b.url, 2000);
        if (!validUrl(u2)) return sendJSON(res, 400, { error: '链接无效' });
        it.url = u2; it.platform = detectPlatform(u2);
      }
      if (b.title !== undefined) it.title = cleanStr(b.title, 80) || it.title;
      if (b.phase !== undefined && PHASES.includes(b.phase)) it.phase = b.phase;
      if (b.category !== undefined) it.category = cleanStr(b.category, 20) || it.category;
      if (b.price !== undefined) it.price = cleanPrice(b.price);
      if (b.note !== undefined) it.note = cleanStr(b.note, 300);
      if (b.addedBy !== undefined) it.addedBy = cleanStr(b.addedBy, 20) || it.addedBy;
      if (b.status !== undefined && STATUSES.includes(b.status)) {
        it.status = b.status;
        if (it.status === 'purchased') { if (!it.purchasedAt) it.purchasedAt = Date.now(); }
        else { it.purchasedBy = ''; it.purchasedAt = null; }
      }
      if (b.purchasedBy !== undefined) it.purchasedBy = cleanStr(b.purchasedBy, 20);
      changed();
      return sendJSON(res, 200, { item: it });
    }
    if (method === 'DELETE') {
      db.items = db.items.filter(i => i.id !== m[1]);
      changed();
      return sendJSON(res, 200, { item: it });
    }
  }

  return sendJSON(res, 404, { error: '接口不存在' });
}

/* ---------------- 静态文件 ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  try { rel = decodeURIComponent(rel); } catch { /* 保持原样 */ }
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Not Found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*'
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------------- 服务器 ---------------- */

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); return res.end('Bad Request'); }
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res, url.pathname);
    else { res.writeHead(405); res.end('Method Not Allowed'); }
  } catch (e) {
    if (!res.headersSent) sendJSON(res, 400, { error: e.message || '请求处理失败' });
    else try { res.end(); } catch { /* 忽略 */ }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`囍事清单已启动：http://localhost:${PORT}`);
  console.log(`数据文件：${DB_PATH}`);
  console.log(`管理员账号：${ADMIN_USER} / ${ADMIN_PASS}（请尽快在应用内修改密码）`);
});

function shutdown() { flush(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1500).unref(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', flush);
