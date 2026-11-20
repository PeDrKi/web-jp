#!/usr/bin/env node
/* Bộ đề JLPT N5 đủ cấu trúc 4 phần (58 câu, 75 phút).
 *   node scripts/tao-de-n5-day-du.js            → ghi output/de-N5-day-du.csv và .xlsx
 *   node scripts/tao-de-n5-day-du.js --import   → nhập + tạo đề + duyệt + đăng (xem tùy chọn trong tao-de-mau.js)
 */
const { run } = require('./lib/builder');
const d = require('./data/n5-day-du');
run({ file: 'de-N5-day-du', rows: d.rows, level: d.level, title: d.title, minutes: d.minutes, description: d.description });
