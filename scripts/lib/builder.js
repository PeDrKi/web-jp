// Dùng chung cho các script tạo đề: ghi CSV/XLSX đúng mẫu nhập hàng loạt và (tùy chọn) nhập + tạo đề + đăng.
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const COLS = ['kind', 'level', 'section', 'qtype', 'stem', 'passage', 'option1', 'option2', 'option3', 'option4', 'answer', 'explanation', 'model_answer', 'accepted', 'points', 'grammar', 'kanji', 'situation', 'audio_script', 'difficulty', 'etype', 'max_len'];
const NAMES = { vocab: 'Văn tự - từ vựng', conversation: 'Hội thoại và biểu hiện', grammar: 'Ngữ pháp', reading: 'Đọc hiểu', listening: 'Nghe hiểu', writing: 'Viết / Tự luận' };
const SCORING = {
  N5: { groups: [{ key: 'language', name: 'Kiến thức ngôn ngữ + Đọc hiểu', sections: ['vocab', 'grammar', 'reading'], max: 120, min: 38 }, { key: 'listening', name: 'Nghe hiểu', sections: ['listening'], max: 60, min: 19 }], total_pass: 80 },
};
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const has = (k) => process.argv.includes('--' + k);
// answer: số thứ tự đáp án đúng (1-4). Hệ thống xáo thứ tự đáp án mỗi lần làm bài.
const makeRow = (level) => (section, qtype, stem, opts, ans, explanation, extra = {}) =>
  ({ level, section, qtype, stem, passage: '', option1: opts[0], option2: opts[1], option3: opts[2], option4: opts[3], answer: ans, explanation, grammar: '', kanji: '', situation: '', audio_script: '', ...extra });

function check(rows) {
  const errs = [];
  rows.forEach((r, i) => {
    if (r.kind === 'essay') { if (!r.model_answer && !r.accepted) errs.push(`Dòng ${i + 2}: câu tự luận thiếu đáp án mẫu`); return; }
    const o = [r.option1, r.option2, r.option3, r.option4].filter(Boolean);   // 2-4 phương án
    if (o.length < 2 || !(r.answer >= 1 && r.answer <= o.length)) errs.push(`Dòng ${i + 2}: đáp án ngoài 1-${o.length}`);
    if (new Set(o).size !== o.length) errs.push(`Dòng ${i + 2}: phương án trùng`);
    if (!r.explanation) errs.push(`Dòng ${i + 2}: thiếu giải thích`);
  });
  return errs;
}
// parts (tùy chọn): chia đề theo phần của bản in [{ key, name, from, to }] (chỉ số dòng); mặc định chia theo phần thi.
async function run({ file, rows, level = 'N5', title, minutes, description, scoring, parts, exam_type = 'JLPT', exam_kind, difficulty = 0 }) {
  const errs = check(rows); if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  rows = rows.map((r) => ({ kind: 'mcq', model_answer: '', accepted: '', points: '', difficulty, etype: '', max_len: '', ...r }));
  const csv = '﻿' + COLS.join(',') + '\n' + rows.map((r) => COLS.map((c) => q(r[c])).join(',')).join('\n') + '\n';
  const out = path.join(__dirname, '..', '..', 'output'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, file + '.csv'), csv);
  const ws = XLSX.utils.aoa_to_sheet([COLS, ...rows.map((r) => COLS.map((c) => r[c] ?? ''))]);
  ws['!cols'] = COLS.map((c) => ({ wch: ['stem', 'passage', 'explanation', 'model_answer'].includes(c) ? 50 : 16 }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Cau hoi'); XLSX.writeFile(wb, path.join(out, file + '.xlsx'));
  const by = {}; rows.forEach((r) => { by[r.section] = (by[r.section] || 0) + 1; });
  console.log(`Đã tạo ${rows.length} câu (${Object.entries(by).map(([k, v]) => `${NAMES[k]}: ${v}`).join(', ')}):\n  ${path.join(out, file + '.csv')}\n  ${path.join(out, file + '.xlsx')}`);
  if (!has('import')) { console.log('Nhập tay: Quản trị → Nhập hàng loạt → chọn file. Hoặc chạy lại với --import.'); return; }

  const BASE = arg('base', 'http://localhost:3000'), EMAIL = arg('email', 'admin@nihongo.local'), PASS = arg('password', 'Admin@12345');
  const TITLE = arg('title', title), MIN = Number(arg('minutes', minutes));
  let cookie = '';
  const call = async (method, url, body, headers = {}) => {
    const h = { ...headers, cookie }; let b = body;
    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) { b = JSON.stringify(body); h['content-type'] = 'application/json'; }
    const r = await fetch(BASE + '/api' + url, { method, headers: h, body: b });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.error || r.statusText); e.data = d; throw e; }
    return d;
  };
  try {
    await call('POST', '/auth/login', { email: EMAIL, password: PASS });
    const imp = await call('POST', '/admin/import/questions', csv, { 'content-type': 'text/csv' });
    console.log(`Đã nhập ${imp.imported} câu (nháp): ${imp.mcq} trắc nghiệm, ${imp.essay} tự luận.`);
    const byId = {}; imp.ids.forEach((id, i) => { (byId[rows[i].section] ||= []).push(id); });
    const sections = parts ? parts.map((p) => ({ key: p.key, name: p.name, question_ids: imp.ids.slice(p.from, p.to) }))
      : ['vocab', 'conversation', 'grammar', 'reading', 'listening', 'writing'].filter((k) => byId[k]).map((k) => ({ key: k, name: NAMES[k], question_ids: byId[k] }));
    const sc = scoring || { ...SCORING[level], note: 'Điểm quy đổi theo tỷ lệ câu đúng (mô phỏng); kỳ thi thật dùng thang tương đương hóa.' };
    const ex = await call('POST', '/admin/exams', { title: TITLE, exam_type, exam_kind: exam_kind || (rows.some((r) => r.kind === 'essay') ? 'chuyen' : 'jlpt'), difficulty, level, duration_min: MIN, description, sections, scoring: sc });
    console.log(`Đã tạo đề #${ex.id}: ${TITLE}`);
    if (has('draft')) { console.log('Giữ ở trạng thái nháp (--draft).'); return; }
    for (const id of imp.ids) { await call('POST', `/admin/questions/${id}/status`, { status: 'pending' }); await call('POST', `/admin/questions/${id}/status`, { status: 'published' }); }
    await call('POST', `/admin/exams/${ex.id}/status`, { status: 'pending' }); await call('POST', `/admin/exams/${ex.id}/status`, { status: 'published' });
    console.log(`Đã duyệt và đăng. Xem tại ${BASE}/#/de/${ex.id}`);
  } catch (e) { console.error('Lỗi:', e.message, e.data?.errors ? JSON.stringify(e.data.errors) : ''); process.exit(1); }
}
module.exports = { run, makeRow };
