// Gửi email qua Brevo (gói miễn phí 300 email/ngày, gửi bằng HTTPS nên chạy được trên Render/Vercel free).
// Cần BREVO_API_KEY và MAIL_FROM (email người gửi đã xác minh trong Brevo). Không cấu hình thì không gửi.
const KEY = process.env.BREVO_API_KEY || '';
const FROM = process.env.MAIL_FROM || '';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'Luyện đề tiếng Nhật';
const enabled = !!(KEY && FROM);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function send(to, subject, html) {
  if (!enabled) return false;
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { email: FROM, name: FROM_NAME }, to: [{ email: to }], subject, htmlContent: html }) });
  if (!r.ok) throw new Error('Gửi email thất bại: ' + (await r.text()).slice(0, 200));
  return true;
}
function resetMail(name, link) {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222">
<p>Chào ${esc(name)},</p>
<p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản này. Bấm nút bên dưới để đặt mật khẩu mới. Link dùng được <b>1 giờ</b> và chỉ dùng một lần.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#c0392b;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Đặt lại mật khẩu</a></p>
<p style="font-size:13px;color:#666">Nếu nút không bấm được, sao chép link này vào trình duyệt:<br>${esc(link)}</p>
<p style="font-size:13px;color:#666">Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu của bạn không thay đổi.</p></div>`;
}
module.exports = { enabled, send, resetMail };
