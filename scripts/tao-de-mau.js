#!/usr/bin/env node
/* Bộ đề mẫu N5 10 câu.  node scripts/tao-de-mau.js [--import] [--base URL --email … --password … --title … --minutes … --draft] */
const { run } = require('./lib/builder');
const d = require('./data/mau-10-cau');
run({ file: 'de-mau-N5', rows: d.rows, title: d.title, minutes: d.minutes, description: d.description });
