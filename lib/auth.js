const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db } = require('./db');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
let SECRET = process.env.APP_SECRET;
if (!SECRET && process.env.VERCEL) throw new Error('Thiếu biến APP_SECRET: vào Vercel → Settings → Environment Variables, thêm một chuỗi ngẫu nhiên dài rồi Redeploy.');
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
// Phiên đăng nhập: uid.phiên_bản.hạn.chữ_ký. Tăng users.token_ver (đổi mật khẩu, "đăng xuất mọi thiết bị")
// là mọi phiên cũ hết hiệu lực ngay.
function makeToken(u, days = 30) {
  const body = `${u.id}.${u.token_ver || 0}.${Date.now() + days * 864e5}`;
  return `${body}.${sign(body)}`;
}
function readToken(tok) {
  if (!tok) return null;
  const p = tok.split('.');
  if (p.length !== 4) return null;
  const body = p.slice(0, 3).join('.');
  const a = Buffer.from(sign(body)), b = Buffer.from(p[3]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(p[2]) < Date.now()) return null;
  return { uid: Number(p[0]), ver: Number(p[1]) };
}
function parseCookies(h = '') {
  const o = {};
  h.split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) { try { o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); } catch { /* cookie hỏng */ } } });
  return o;
}
async function authMiddleware(req, _res, next) {
  const t = readToken(parseCookies(req.headers.cookie).sid);
  req.user = null;
  if (t) {
    const u = (await db.prepare('SELECT * FROM users WHERE id=?').get(t.uid));
    if (u && !u.locked && (u.token_ver || 0) === t.ver) req.user = u;
  }
  next();
}
const requireUser = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Bạn cần đăng nhập.' });
const requireRole = (...roles) => (req, res, next) =>
  !req.user ? res.status(401).json({ error: 'Bạn cần đăng nhập.' })
  : roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
// Secure khi chạy sau HTTPS (Render, Vercel); để trống khi chạy http://localhost
const secure = () => (process.env.NODE_ENV === 'production' ? '; Secure' : '');
function setCookie(res, token, days = 30) {
  res.setHeader('Set-Cookie', `sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${days * 86400}${secure()}`);
}
function clearCookie(res) { res.setHeader('Set-Cookie', `sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure()}`); }

// Giới hạn số lần thử (đăng nhập sai, đăng ký, quên mật khẩu) theo khóa, trong một khoảng thời gian
const tries = new Map();
function limiter(key, max = 8, windowMs = 10 * 60e3) {
  const now = Date.now();
  const arr = (tries.get(key) || []).filter((t) => now - t < windowMs);
  tries.set(key, arr);
  if (tries.size > 20000) for (const [k, v] of tries) if (!v.length || now - v[v.length - 1] > 3600e3) tries.delete(k);
  return { blocked: arr.length >= max, hit: () => arr.push(now), reset: () => tries.delete(key) };
}
const loginLimiter = (key) => limiter('login|' + key);
// Quy tắc mật khẩu dùng chung; trả về câu báo lỗi hoặc null
function passwordProblem(pw, email = '') {
  pw = String(pw || '');
  if (pw.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
  if (pw.length > 128) return 'Mật khẩu tối đa 128 ký tự.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Mật khẩu cần có cả chữ và số.';
  if (email && pw.toLowerCase().includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4) return 'Mật khẩu không nên chứa tên email của bạn.';
  return null;
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
module.exports = { hashPassword, verifyPassword, makeToken, readToken, authMiddleware, requireUser, requireRole, setCookie, clearCookie, loginLimiter, limiter, passwordProblem, sha256 };
