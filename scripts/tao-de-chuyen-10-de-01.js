#!/usr/bin/env node
/* Đề tuyển sinh lớp 10 chuyên tiếng Nhật – Đề số 01 (150 câu + 作文, 150 phút, thang 10).
 *   node scripts/tao-de-chuyen-10-de-01.js            → ghi output/de-chuyen-10-so-01.csv và .xlsx
 *   node scripts/tao-de-chuyen-10-de-01.js --import --base https://<web>.onrender.com --email <admin> --password <mật khẩu>
 *        → nhập ngân hàng câu hỏi + tạo đề + đăng (thêm --draft để giữ nháp, kiểm tra trước khi đăng)
 */
const { run } = require('./lib/builder');
const d = require('./data/chuyen-10-de-01');
run({ file: 'de-chuyen-10-so-01', ...d });
