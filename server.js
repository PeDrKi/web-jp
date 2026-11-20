const express = require('express');
const path = require('path');
const A = require('./lib/auth');
const learner = require('./routes/learner');
const admin = require('./routes/admin');
const extra = require('./routes/extra');
const account = require('./routes/account');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
// JSON cho API học viên; các route nhập file/upload của admin tự xử lý body thô
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/admin/import/questions') || req.path === '/admin/media') return next();
  return express.json({ limit: '1mb' })(req, res, (err) => err ? res.status(400).json({ error: 'Dữ liệu gửi lên không hợp lệ.' }) : next());
});
app.use('/api', A.authMiddleware);
app.use('/api', account);
app.use('/api/admin', admin);
app.use('/api', extra);
app.use('/api', learner);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Không tìm thấy.' }));
app.use('/uploads', express.static(admin.upDir, { maxAge: '7d', setHeaders: (r) => r.setHeader('Content-Disposition', 'inline') }));
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
if (require.main === module) {
  const { ready, file } = require('./lib/db');
  ready.then(autoSeed).then(() => app.listen(PORT, () => console.log(`Web luyện đề tiếng Nhật chạy tại http://localhost:${PORT} · CSDL: ${file}`)))
    .catch(() => process.exit(1));
}
module.exports = app;
