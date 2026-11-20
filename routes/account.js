// Tài khoản: đăng ký, đăng nhập (mật khẩu / Google), đăng xuất, quên & đặt lại mật khẩu, đổi mật khẩu.
const express = require('express');
const crypto = require('crypto');
const { db, j, tx } = require('../lib/db');
const A = require('../lib/auth');
const Mail = require('../lib/mail');
const router = express.Router();
const now = () => Date.now();
const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ error: 'Lỗi máy chủ.' }); } };
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '';
const DUMMY = A.hashPassword(crypto.randomBytes(8).toString('hex'));   // so sánh giả khi email không tồn tại, để thời gian phản hồi như nhau

const userOut = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, goal: j(u.goal, {}), settings: j(u.settings, {}), has_password: !!u.pass_hash, google: !!u.google_sub });
const normEmail = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e) && e.length <= 160;
const baseUrl = (req) => (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
async function signIn(res, u, remember = true) {
  await db.prepare('UPDATE users SET last_login=? WHERE id=?').run(now(), u.id);
  A.setCookie(res, A.makeToken(u, remember ? 30 : 1), remember ? 30 : 1);
}
// Tạo link đặt lại mật khẩu (lưu mã băm, không lưu mã gốc)
async function makeResetLink(req, userId, hours, by = null) {
  const tok = crypto.randomBytes(32).toString('base64url');
  await db.prepare('DELETE FROM password_resets WHERE user_id=? AND used_at IS NULL').run(userId);
  await db.prepare('INSERT INTO password_resets(token_hash,user_id,expires_at,created_by,created_at) VALUES(?,?,?,?,?)').run(A.sha256(tok), userId, now() + hours * 3600e3, by, now());
  return `${baseUrl(req)}/#/dat-lai-mat-khau?t=${tok}`;
}

router.get('/auth/config', (_req, res) => res.json({ google_client_id: GOOGLE_ID || null, email_reset: Mail.enabled }));

router.post('/auth/register', wrap(async (req, res) => {
  const { password, name, website } = req.body || {};
  if (website) return bad(res, 'Không đăng ký được.');   // ô bẫy chống bot (người dùng không thấy ô này)
  const lim = A.limiter('reg|' + req.ip, 50, 3600e3);
  if (lim.blocked) return bad(res, 'Bạn đã tạo quá nhiều tài khoản. Vui lòng thử lại sau.', 429);
  const em = normEmail(req.body?.email);
  if (!validEmail(em)) return bad(res, 'Email không hợp lệ.');
  const pp = A.passwordProblem(password, em); if (pp) return bad(res, pp);
  const nm = String(name || '').trim().slice(0, 60) || em.split('@')[0];
  if ((await db.prepare('SELECT 1 FROM users WHERE email=?').get(em))) return bad(res, 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng "Quên mật khẩu".', 409);
  const r = await db.prepare('INSERT INTO users(email,name,pass_hash,created_at) VALUES(?,?,?,?)').run(em, nm, A.hashPassword(String(password)), now());
  lim.hit();
  const u = await db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);
  await signIn(res, u);
  res.json(userOut(u));
}));

router.post('/auth/login', wrap(async (req, res) => {
  const em = normEmail(req.body?.email);
  const lim = A.loginLimiter(em + '|' + req.ip);
  if (lim.blocked) return bad(res, 'Thử sai quá nhiều lần. Vui lòng đợi 10 phút hoặc dùng "Quên mật khẩu".', 429);
  const u = await db.prepare('SELECT * FROM users WHERE email=?').get(em);
  const pw = String(req.body?.password || '').slice(0, 200);
  const okPw = A.verifyPassword(pw, u?.pass_hash || DUMMY);
  if (!u || !okPw) {
    lim.hit();
    if (u && !u.pass_hash && u.google_sub) return bad(res, 'Tài khoản này đăng nhập bằng Google. Bấm nút "Đăng nhập bằng Google".', 401);
    return bad(res, 'Email hoặc mật khẩu không đúng.', 401);
  }
  if (u.locked) return bad(res, 'Tài khoản đã bị khóa. Liên hệ quản trị viên.', 403);
  lim.reset();
  await signIn(res, u, req.body?.remember !== false);
  res.json(userOut(u));
}));

// Đăng nhập Google: trình duyệt nhận ID token từ Google, máy chủ hỏi lại Google để xác thực
router.post('/auth/google', wrap(async (req, res) => {
  if (!GOOGLE_ID) return bad(res, 'Chưa bật đăng nhập Google.', 404);
  const cred = String(req.body?.credential || '');
  if (!cred || cred.length > 4096) return bad(res, 'Thiếu thông tin đăng nhập Google.');
  let info;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred));
    info = r.ok ? await r.json() : null;
  } catch (e) { console.error(e.message); return bad(res, 'Không kết nối được Google, thử lại sau.', 502); }
  if (!info || info.aud !== GOOGLE_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(info.iss) || Number(info.exp) * 1000 < now()) return bad(res, 'Đăng nhập Google không hợp lệ.', 401);
  if (String(info.email_verified) !== 'true') return bad(res, 'Email Google chưa được xác minh.', 401);
  const em = normEmail(info.email);
  let u = await db.prepare('SELECT * FROM users WHERE google_sub=?').get(info.sub) || await db.prepare('SELECT * FROM users WHERE email=?').get(em);
  if (u && u.locked) return bad(res, 'Tài khoản đã bị khóa. Liên hệ quản trị viên.', 403);
  if (u && !u.google_sub) await db.prepare('UPDATE users SET google_sub=? WHERE id=?').run(info.sub, u.id);   // email trùng: liên kết vào tài khoản sẵn có
  if (!u) {
    const r = await db.prepare("INSERT INTO users(email,name,pass_hash,google_sub,created_at) VALUES(?,?,'',?,?)").run(em, String(info.name || em.split('@')[0]).slice(0, 60), info.sub, now());
    u = await db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);
    u.is_new = true;
  }
  await signIn(res, u);
  res.json({ ...userOut(u), is_new: !!u.is_new });
}));

router.post('/auth/logout', (_req, res) => { A.clearCookie(res); res.json({ ok: true }); });
router.post('/auth/logout-all', A.requireUser, wrap(async (req, res) => {
  await db.prepare('UPDATE users SET token_ver=token_ver+1 WHERE id=?').run(req.user.id);
  A.clearCookie(res); res.json({ ok: true });
}));

// Quên mật khẩu: luôn trả lời giống nhau để không lộ email nào đã đăng ký
router.post('/auth/forgot', wrap(async (req, res) => {
  const em = normEmail(req.body?.email);
  if (!validEmail(em)) return bad(res, 'Email không hợp lệ.');
  if (!Mail.enabled) return res.json({ ok: true, email: false });
  const lim = A.limiter('forgot|' + req.ip, 5, 3600e3), lim2 = A.limiter('forgot|' + em, 3, 3600e3);
  if (lim.blocked || lim2.blocked) return bad(res, 'Bạn đã yêu cầu nhiều lần. Kiểm tra hộp thư (cả mục Spam) hoặc thử lại sau 1 giờ.', 429);
  lim.hit(); lim2.hit();
  const u = await db.prepare('SELECT * FROM users WHERE email=?').get(em);
  if (u && !u.locked) {
    try { await Mail.send(u.email, 'Đặt lại mật khẩu', Mail.resetMail(u.name, await makeResetLink(req, u.id, 1))); }
    catch (e) { console.error(e.message); return bad(res, 'Hệ thống chưa gửi được email. Vui lòng thử lại sau hoặc liên hệ quản trị viên.', 502); }
  }
  res.json({ ok: true, email: true });
}));
async function findReset(tok) {
  if (!tok || tok.length > 100) return null;
  const r = await db.prepare('SELECT * FROM password_resets WHERE token_hash=?').get(A.sha256(String(tok)));
  if (!r || r.used_at || r.expires_at < now()) return null;
  const u = await db.prepare('SELECT * FROM users WHERE id=?').get(r.user_id);
  return u && !u.locked ? { r, u } : null;
}
router.get('/auth/reset', wrap(async (req, res) => {
  const f = await findReset(String(req.query.t || ''));
  if (!f) return bad(res, 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.', 410);
  res.json({ email: f.u.email, name: f.u.name });
}));
router.post('/auth/reset', wrap(async (req, res) => {
  const lim = A.limiter('reset|' + req.ip, 20, 3600e3);
  if (lim.blocked) return bad(res, 'Thử quá nhiều lần, vui lòng đợi.', 429);
  lim.hit();
  const f = await findReset(String(req.body?.token || ''));
  if (!f) return bad(res, 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.', 410);
  const pp = A.passwordProblem(req.body?.password, f.u.email); if (pp) return bad(res, pp);
  await tx(async () => {
    await db.prepare('UPDATE users SET pass_hash=?, token_ver=token_ver+1 WHERE id=?').run(A.hashPassword(String(req.body.password)), f.u.id);
    await db.prepare('UPDATE password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL').run(now(), f.u.id);
  });
  const u = await db.prepare('SELECT * FROM users WHERE id=?').get(f.u.id);
  await signIn(res, u);   // đặt xong thì đăng nhập luôn; các thiết bị khác bị đăng xuất
  res.json(userOut(u));
}));

// Đổi mật khẩu khi đang đăng nhập (tài khoản Google chưa có mật khẩu thì không cần mật khẩu cũ)
router.post('/me/password', A.requireUser, wrap(async (req, res) => {
  const u = req.user;
  const lim = A.limiter('pw|' + u.id, 8, 600e3);
  if (lim.blocked) return bad(res, 'Thử sai quá nhiều lần. Vui lòng đợi 10 phút.', 429);
  if (u.pass_hash && !A.verifyPassword(String(req.body?.current || '').slice(0, 200), u.pass_hash)) { lim.hit(); return bad(res, 'Mật khẩu hiện tại không đúng.', 403); }
  const pp = A.passwordProblem(req.body?.password, u.email); if (pp) return bad(res, pp);
  await db.prepare('UPDATE users SET pass_hash=?, token_ver=token_ver+1 WHERE id=?').run(A.hashPassword(String(req.body.password)), u.id);
  const nu = await db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  A.setCookie(res, A.makeToken(nu));   // giữ thiết bị này, đăng xuất các thiết bị khác
  res.json(userOut(nu));
}));

module.exports = router;
module.exports.userOut = userOut;
module.exports.makeResetLink = makeResetLink;
