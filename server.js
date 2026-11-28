const express = require('express');
const path = require('path');
const A = require('./lib/auth');
const learner = require('./routes/learner');
const admin = require('./routes/admin');
const extra = require('./routes/extra');
const account = require('./routes/account');
const classes = require('./routes/classes');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
// Kiểm tra sống: dịch vụ ping (UptimeRobot, cron-job.org) gọi mỗi 10 phút để Render free không "ngủ".
// CSDL chỉ được chạm khi vừa khởi động và sau đó 6 ngày một lần (hoặc gọi ?db=1), đủ để Supabase free
// không bị tạm dừng vì 7 ngày không hoạt động mà không tạo truy vấn thừa.
const DB_PING_MS = Number(process.env.DB_PING_DAYS || 6) * 24 * 3600e3;
let lastDbPing = 0;
app.get('/api/health', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.query.db !== '1' && Date.now() - lastDbPing < DB_PING_MS) return res.json({ ok: true, db: 'skipped', next_db_ping: lastDbPing + DB_PING_MS, time: Date.now() });
  try { const { db } = require('./lib/db'); await db.prepare('SELECT 1 AS ok').get(); lastDbPing = Date.now(); res.json({ ok: true, db: true, next_db_ping: lastDbPing + DB_PING_MS, time: Date.now() }); }
  catch (e) { console.error('health:', e.message); res.status(503).json({ ok: false, db: false }); }
});
// JSON cho API học viên; các route nhập file/upload của admin tự xử lý body thô
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/admin/import/questions') || req.path.startsWith('/admin/import/document') || req.path === '/admin/media') return next();
  return express.json({ limit: '1mb' })(req, res, (err) => err ? res.status(400).json({ error: 'Dữ liệu gửi lên không hợp lệ.' }) : next());
});
app.use('/api', A.authMiddleware);
app.use('/api', account);
app.use('/api', classes);
app.use('/api/admin', admin);
app.use('/api', extra);
app.use('/api', learner);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Không tìm thấy.' }));
app.use('/uploads', express.static(admin.upDir, { maxAge: '7d', setHeaders: (r) => r.setHeader('Content-Disposition', 'inline') }));
app.use('/vendor/pdfjs', express.static(path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'build'), { maxAge: '30d' }));   // xem đề PDF trên điện thoại
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Lỗi máy chủ.' }); });

const PORT = process.env.PORT || 3000;
// Deploy lần đầu: SEED_ON_EMPTY=1 thì tự nạp dữ liệu mẫu khi CSDL còn trống.
// Trên máy chủ thật bắt buộc đặt SEED_PASSWORD để tài khoản mẫu không dùng mật khẩu mặc định công khai.
async function autoSeed() {
  if (process.env.SEED_ON_EMPTY !== '1' || !process.env.DATABASE_URL) return;
  const { db } = require('./lib/db');
  if ((await db.prepare('SELECT COUNT(*) n FROM users').get()).n > 0) return;
  if (process.env.NODE_ENV === 'production' && !process.env.SEED_PASSWORD) { console.warn('Bỏ qua nạp dữ liệu mẫu: hãy đặt SEED_PASSWORD.'); return; }
  console.log('CSDL trống, đang nạp dữ liệu mẫu...');
  await new Promise((ok, fail) => require('child_process').execFile(process.execPath, [require('path').join(__dirname, 'seed', 'seed.js')], { env: process.env }, (e, out, err) => { console.log(out); if (e) { console.error(err); fail(e); } else ok(); }));
}
// Khóa Brevo tự hết hạn nếu 90 ngày không dùng: gửi 1 thư ngắn tới MAIL_FROM lúc khởi động và mỗi 20 ngày.
// shortcut: mỗi lần khởi động lại (cập nhật web) cũng gửi 1 thư; lỗi nếu có chỉ ghi log. Muốn tắt: MAIL_KEEPALIVE=0.
function keepMailKey() {
  const Mail = require('./lib/mail');
  if (!Mail.enabled || process.env.MAIL_KEEPALIVE === '0') return;
  const ping = () => Mail.send(process.env.MAIL_FROM, 'Giữ khóa email hoạt động', '<p>Thư tự động mỗi 20 ngày để khóa Brevo không bị hết hạn vì lâu không dùng. Bạn không cần làm gì.</p>').catch((e) => console.error('mail keepalive:', e.message));
  ping(); setInterval(ping, 20 * 24 * 3600e3).unref();
}
if (require.main === module) {
  const { ready, file } = require('./lib/db');
  ready.then(autoSeed).then(() => app.listen(PORT, () => console.log(`Web luyện đề tiếng Nhật chạy tại http://localhost:${PORT} · CSDL: ${file}`)))
    .then(() => keepMailKey())
    .catch(() => process.exit(1));
}
module.exports = app;
