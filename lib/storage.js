// Lưu file audio/ảnh tải lên.
// - Có SUPABASE_URL + SUPABASE_SERVICE_KEY: đẩy lên Supabase Storage (bucket công khai, mặc định "media").
//   Bắt buộc khi deploy lên nền tảng free (Render...) vì ổ đĩa ở đó bị xóa mỗi lần khởi động lại.
// - Không có: lưu vào thư mục uploads/ trên máy (chạy thử local).
const fs = require('fs');
const path = require('path');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'media';
const upDir = path.join(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
const remote = !!(SB_URL && SB_KEY);
if (!remote) fs.mkdirSync(upDir, { recursive: true });

// Khóa kiểu mới (sb_secret_...) chỉ gửi qua header apikey; khóa service_role (JWT) gửi cả Authorization
const headers = (extra = {}) => ({ apikey: SB_KEY, ...(SB_KEY.startsWith('sb_') ? {} : { Authorization: `Bearer ${SB_KEY}` }), ...extra });
let bucketReady = null;
function ensureBucket() {   // tạo bucket công khai nếu chưa có (bỏ qua lỗi "đã tồn tại")
  bucketReady ||= fetch(`${SB_URL}/storage/v1/bucket`, { method: 'POST', headers: headers({ 'content-type': 'application/json' }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }) }).then(async (r) => {
    if (!r.ok) { const t = await r.text(); if (!/exist|duplicate/i.test(t)) { bucketReady = null; throw new Error('Không tạo được bucket Supabase: ' + t.slice(0, 200)); } }
  });
  return bucketReady;
}
// Trả về URL công khai của file
async function save(name, buf, mime) {
  if (!remote) { fs.writeFileSync(path.join(upDir, name), buf); return '/uploads/' + name; }
  await ensureBucket();
  const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(name)}`, {
    method: 'POST', headers: headers({ 'content-type': mime, 'x-upsert': 'true', 'cache-control': '604800' }), body: buf });
  if (!r.ok) throw new Error('Tải file lên Supabase thất bại: ' + (await r.text()).slice(0, 200));
  return `${SB_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(name)}`;
}
module.exports = { save, upDir, remote };
