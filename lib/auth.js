const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db } = require('./db');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
let SECRET = process.env.APP_SECRET;
if (!SECRET) {
  const f = path.join(dataDir, '.secret');
  fs.mkdirSync(dataDir, { recursive: true });
  if (process.env.NODE_ENV === 'production') console.warn('CẢNH BÁO: chưa đặt APP_SECRET, mỗi lần khởi động lại mọi người sẽ bị đăng xuất.');
  if (fs.existsSync(f)) SECRET = fs.readFileSync(f, 'utf8');
  else { SECRET = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(f, SECRET, { mode: 0o600 }); }
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return `s1$${salt.toString('hex')}$${h.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [v, salt, hash] = stored.split('$');
  if (v !== 's1') return false;
  const h = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
}
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
function makeToken(uid, days = 30) {
  const body = `${uid}.${Date.now() + days * 864e5}`;
  return `${body}.${sign(body)}`;
}
function readToken(tok) {
  if (!tok) return null;
  const p = tok.split('.');
  if (p.length !== 3) return null;
  const body = `${p[0]}.${p[1]}`;
  const a = Buffer.from(sign(body)), b = Buffer.from(p[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(p[1]) < Date.now()) return null;
  return Number(p[0]);
}
function parseCookies(h = '') {
  const o = {};
  h.split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return o;
}
async function authMiddleware(req, _res, next) {
  const uid = readToken(parseCookies(req.headers.cookie).sid);
  req.user = null;
  if (uid) {
    const u = (await db.prepare('SELECT * FROM users WHERE id=?').get(uid));
    if (u && !u.locked) req.user = u;
  }
  next();
}
const requireUser = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Bạn cần đăng nhập.' });
const requireRole = (...roles) => (req, res, next) =>
  !req.user ? res.status(401).json({ error: 'Bạn cần đăng nhập.' })
  : roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
function setCookie(res, token) {
  res.setHeader('Set-Cookie', `sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}`);
}
function clearCookie(res) { res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); }

// giới hạn thử đăng nhập đơn giản
const tries = new Map();
function loginLimiter(key) {
  const now = Date.now();
  const arr = (tries.get(key) || []).filter((t) => now - t < 10 * 60e3);
  tries.set(key, arr);
  return { blocked: arr.length >= 8, hit: () => arr.push(now), reset: () => tries.delete(key) };
}
module.exports = { hashPassword, verifyPassword, makeToken, authMiddleware, requireUser, requireRole, setCookie, clearCookie, loginLimiter };
