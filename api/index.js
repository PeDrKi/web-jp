// Điểm vào cho Vercel: toàn bộ /api/* chạy trong một hàm serverless dùng chung ứng dụng Express.
// Giao diện (thư mục public/) do Vercel phục vụ trực tiếp qua CDN.
module.exports = require('../server.js');
