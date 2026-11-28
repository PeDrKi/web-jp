const express = require('express');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { db, j, tx } = require('../lib/db');
const A = require('../lib/auth');
const C = require('../lib/content');
const router = express.Router();
const now = () => Date.now();
const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ error: 'Lỗi máy chủ.' }); } };
const bad = (res, msg, code = 400, extra = {}) => res.status(code).json({ error: msg, ...extra });
const STAFF = ['admin', 'editor', 'reviewer', 'teacher'];
const AUTHORS = ['admin', 'editor', 'teacher'];   // được soạn câu hỏi / đề
router.use(A.requireRole(...STAFF));
const isAdmin = (u) => u.role === 'admin';
const canReview = (u) => u.role === 'admin' || u.role === 'reviewer';
const canEdit = (u) => AUTHORS.includes(u.role);
// Giảng viên: chỉ sửa / đăng / gỡ nội dung do chính mình tạo (tự chịu trách nhiệm đề của mình)
const owns = (u, ownerId) => u.role !== 'teacher' || ownerId === u.id;
const NOT_OWNER = 'Giảng viên chỉ sửa được câu hỏi / đề do chính mình tạo.';

// ---- Quy trình trạng thái (AD-04): nháp -> chờ duyệt -> đã đăng -> đã gỡ ----
const TRANSITIONS = {
  'draft>pending': 'edit', 'pending>draft': 'any', 'pending>published': 'review',
  'published>removed': 'review', 'removed>draft': 'edit', 'removed>pending': 'edit',
};
function checkTransition(user, from, to, ownerId) {
  const need = TRANSITIONS[`${from}>${to}`] || (user.role === 'teacher' && ['draft>published', 'removed>published'].includes(`${from}>${to}`) ? 'teacher' : null);
  if (!need) return 'Không thể chuyển trạng thái từ "' + from + '" sang "' + to + '".';
  if (user.role === 'teacher') return ownerId === user.id ? null : NOT_OWNER;   // giảng viên tự duyệt & đăng nội dung của mình
  if (need === 'edit' && !canEdit(user)) return 'Chỉ biên tập viên hoặc quản trị viên mới thực hiện được.';
  if (need === 'review' && !canReview(user)) return 'Chỉ người duyệt hoặc quản trị viên mới đăng/gỡ nội dung.';
  if (need === 'any' && !(canEdit(user) || canReview(user))) return 'Không có quyền.';
  return null;
}

// ---------------- Tổng quan ----------------
router.get('/overview', wrap(async (req, res) => {
  const c = async (sql) => (await db.prepare(sql).get()).n;
  res.json({
    questions: { draft: (await c("SELECT COUNT(*) n FROM questions WHERE status='draft'")), pending: (await c("SELECT COUNT(*) n FROM questions WHERE status='pending'")), published: (await c("SELECT COUNT(*) n FROM questions WHERE status='published'")) },
    exams: { pending: (await c("SELECT COUNT(*) n FROM exams WHERE status='pending'")), published: (await c("SELECT COUNT(*) n FROM exams WHERE status='published'")) },
    lessons: { pending: (await c("SELECT COUNT(*) n FROM lessons WHERE status='pending'")), published: (await c("SELECT COUNT(*) n FROM lessons WHERE status='published'")) },
    reports_open: (await c("SELECT COUNT(*) n FROM reports WHERE status!='closed'")),
    grading_pending: (await pendingGrading(req.user)).length,
    bank: { mcq: (await c("SELECT COUNT(*) n FROM questions WHERE kind='mcq'")), essay: (await c("SELECT COUNT(*) n FROM questions WHERE kind='essay'")) },
    users: (await c('SELECT COUNT(*) n FROM users')), attempts: (await c("SELECT COUNT(*) n FROM attempts WHERE status='submitted'")),
  });
}));

// ---------------- Câu hỏi (AD-01, AD-03, AD-06) ----------------
function cleanQuestion(b) {
  const tags = { grammar: [], kanji: [], situation: [], ...(b.tags || {}) };
  for (const k of ['grammar', 'kanji', 'situation']) tags[k] = (Array.isArray(tags[k]) ? tags[k] : String(tags[k]).split(/[,、;]/)).map((x) => String(x).trim()).filter(Boolean);
  const kind = b.kind === 'essay' ? 'essay' : 'mcq';
  const accepted = (Array.isArray(b.accepted) ? b.accepted : String(b.accepted || '').split(/[|\n]/)).map((x) => String(x).trim()).filter(Boolean).slice(0, 20);
  const points = b.points === undefined || b.points === '' || b.points === null ? 1 : Number(b.points);
  const lim = Number(b.max_len) || 0;
  return { kind, model_answer: kind === 'essay' ? String(b.model_answer || '').trim() : '', accepted: kind === 'essay' ? accepted : [], points,
    difficulty: Number(b.difficulty) || 0, catalog: C.EXAM_KINDS[b.catalog] ? b.catalog : '', etype: kind === 'essay' && C.ETYPES[b.etype] ? b.etype : '', max_len: kind === 'essay' ? lim : 0,
    level: b.level, section: b.section, qtype: String(b.qtype || '').trim(), stem: String(b.stem || '').trim(), passage: String(b.passage || '').trim(),
    audio_script: Array.isArray(b.audio_script) ? b.audio_script.filter((l) => l && l.text).map((l) => ({ speaker: l.speaker === 'F' ? 'F' : 'M', text: String(l.text) })) : [],
    audio_url: String(b.audio_url || ''), image_url: String(b.image_url || ''),
    options: kind === 'essay' ? [] : (b.options || []).map((o) => String(o ?? '').trim()), answer: kind === 'essay' ? -1 : b.answer, explanation: String(b.explanation || '').trim(), tags };
}
const authorName = async (id) => (id ? (await db.prepare('SELECT name FROM users WHERE id=?').get(id))?.name : '') || '';
const withAuthor = async (x) => ({ ...x, author: (await authorName(x.created_by)) });
// gắn tên người tạo cho cả danh sách bằng một truy vấn
async function withAuthors(rows) {
  const ids = [...new Set(rows.map((x) => x.created_by).filter(Boolean))];
  const names = new Map(ids.length ? (await db.prepare('SELECT id, name FROM users WHERE id = ANY(?)').all(ids)).map((u) => [u.id, u.name]) : []);
  return rows.map((x) => ({ ...x, author: names.get(x.created_by) || '' }));
}
async function snapshotVersion(q, userId) {
  (await db.prepare('INSERT INTO question_versions(question_id,version,snapshot,changed_by,at) VALUES(?,?,?,?,?) ON CONFLICT(question_id,version) DO UPDATE SET snapshot=excluded.snapshot, changed_by=excluded.changed_by, at=excluded.at').run(q.id, q.version, JSON.stringify(q), userId, now()));
}
async function insertQuestion(q, userId, status = 'draft', isSheet = false) {
  const r = (await db.prepare(`INSERT INTO questions(level,section,qtype,stem,passage,audio_script,audio_url,image_url,options,answer,explanation,tags,kind,model_answer,accepted,points,status,created_by,created_at,updated_at,is_sheet,difficulty,etype,max_len,catalog)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(q.level, q.section, q.qtype, q.stem, q.passage, JSON.stringify(q.audio_script), q.audio_url, q.image_url,
    JSON.stringify(q.options), q.answer, q.explanation, JSON.stringify(q.tags), q.kind, q.model_answer, JSON.stringify(q.accepted), q.points, status, userId, now(), now(), isSheet ? 1 : 0, q.difficulty || 0, q.etype || '', q.max_len || 0, q.catalog || ''));
  const id = Number(r.lastInsertRowid);
  (await snapshotVersion(C.rowToQuestion((await db.prepare('SELECT * FROM questions WHERE id=?').get(id))), userId));
  return id;
}
router.get('/questions', wrap(async (req, res) => {
  const { status, level, section, qtype, q, tag, kind, mine, page = 1 } = req.query;
  const where = [], args = [];
  if (kind) { where.push('kind=?'); args.push(kind); }
  if (mine) { where.push('created_by=?'); args.push(req.user.id); }
  if (req.user.role === 'teacher') { where.push("(created_by=? OR status='published')"); args.push(req.user.id); }   // không xem nháp của giảng viên khác
  if (status) { where.push('status=?'); args.push(status); }
  if (level) { where.push('level=?'); args.push(level); }
  if (section) { where.push('section=?'); args.push(section); }
  if (qtype) { where.push('qtype=?'); args.push(qtype); }
  let rows = (await db.prepare(`SELECT * FROM questions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC`).all(...args)).map(C.rowToQuestion);
  if (q) { const n = C.normalize(q); rows = rows.filter((r) => C.normalize(C.stripMarkup(r.stem) + ' ' + r.explanation).includes(n) || String(r.id) === q); }
  if (tag) rows = rows.filter((r) => Object.values(r.tags).flat().includes(tag));
  const total = rows.length, per = 25, p = Math.max(1, Number(page) || 1);
  res.json({ total, page: p, per, items: await withAuthors(rows.slice((p - 1) * per, p * per)) });
}));
router.get('/questions/stats', wrap(async (_req, res) => {   // AD-07
  const subs = (await db.prepare("SELECT result FROM attempts WHERE status='submitted'").all());
  const st = {};
  for (const s of subs) {
    const r = j(s.result, null); if (!r) continue;
    for (const it of r.items) {
      const x = (st[it.qid] ||= { attempts: 0, correct: 0, choices: {} });
      if (!it.answered || it.kind === 'essay') continue;
      x.attempts++; if (it.ok) x.correct++;
      x.choices[it.chosenText] = (x.choices[it.chosenText] || 0) + 1;
    }
  }
  const qs = (await db.prepare("SELECT * FROM questions WHERE status='published' AND kind='mcq'").all()).map(C.rowToQuestion);
  const openReports = new Map((await db.prepare("SELECT question_id, COUNT(*) n FROM reports WHERE status!='closed' GROUP BY question_id").all()).map((r) => [r.question_id, r.n]));
  const out = await Promise.all(qs.map(async (q) => {
    const x = st[q.id] || { attempts: 0, correct: 0, choices: {} };
    const rate = x.attempts ? x.correct / x.attempts : null;
    const flags = [];
    if (x.attempts >= 5) {
      if (rate < 0.2) flags.push('Tỷ lệ đúng quá thấp - kiểm tra đáp án');
      if (rate > 0.98) flags.push('Quá dễ');
      const topWrong = Object.entries(x.choices).filter(([k]) => k !== q.options[q.answer]).sort((a, b) => b[1] - a[1])[0];
      if (topWrong && topWrong[1] > x.correct) flags.push(`Đáp án “${topWrong[0]}” được chọn nhiều hơn đáp án đúng - có thể mơ hồ`);
    }
    const open = openReports.get(q.id) || 0;
    if (open) flags.push(`${open} báo lỗi chưa xử lý`);
    return { id: q.id, level: q.level, section: q.section, stem: C.stripMarkup(q.stem).slice(0, 70), attempts: x.attempts, rate, flags };
  }));
  res.json(out.sort((a, b) => b.flags.length - a.flags.length || (a.rate ?? 2) - (b.rate ?? 2)));
}));
router.get('/questions/:id', wrap(async (req, res) => {
  const r = (await db.prepare('SELECT * FROM questions WHERE id=?').get(Number(req.params.id)));
  if (!r || (req.user.role === 'teacher' && r.created_by !== req.user.id && r.status !== 'published')) return bad(res, 'Không tìm thấy.', 404);
  const versions = (await db.prepare('SELECT version, changed_by, at FROM question_versions WHERE question_id=? ORDER BY version DESC').all(r.id));
  res.json({ ...(await withAuthor(C.rowToQuestion(r))), versions });
}));
router.post('/questions', A.requireRole(...AUTHORS), wrap(async (req, res) => {
  const q = cleanQuestion(req.body || {});
  const errs = C.validateQuestion(q);
  if (errs.length) return bad(res, errs.join('; '), 422, { errors: errs });
  res.json({ id: (await insertQuestion(q, req.user.id)) });
}));
router.put('/questions/:id', A.requireRole(...AUTHORS), wrap(async (req, res) => {
  const old = (await db.prepare('SELECT * FROM questions WHERE id=?').get(Number(req.params.id)));
  if (!old) return bad(res, 'Không tìm thấy.', 404);
  if (!owns(req.user, old.created_by)) return bad(res, NOT_OWNER, 403);
  const q = cleanQuestion(req.body || {});
  const errs = C.validateQuestion(q);
  if (errs.length) return bad(res, errs.join('; '), 422, { errors: errs });
  // Sửa nội dung đã đăng: tăng phiên bản; bài làm cũ giữ nguyên bản chụp nên điểm cũ không đổi (AD-06).
  // Biên tập viên sửa câu đã đăng -> quay về "chờ duyệt" để người duyệt kiểm tra lại.
  let status = old.status;
  if (old.status === 'published' && req.user.role === 'editor') status = 'pending';
  const version = old.version + 1;
  (await db.prepare(`UPDATE questions SET level=?,section=?,qtype=?,stem=?,passage=?,audio_script=?,audio_url=?,image_url=?,options=?,answer=?,explanation=?,tags=?,kind=?,model_answer=?,accepted=?,points=?,difficulty=?,etype=?,max_len=?,catalog=?,status=?,version=?,updated_at=? WHERE id=?`)
    .run(q.level, q.section, q.qtype, q.stem, q.passage, JSON.stringify(q.audio_script), q.audio_url, q.image_url, JSON.stringify(q.options), q.answer, q.explanation, JSON.stringify(q.tags), q.kind, q.model_answer, JSON.stringify(q.accepted), q.points, q.difficulty, q.etype, q.max_len, q.catalog, status, version, now(), old.id));
  (await snapshotVersion(C.rowToQuestion((await db.prepare('SELECT * FROM questions WHERE id=?').get(old.id))), req.user.id));
  res.json({ ok: true, version, status });
}));
router.post('/questions/:id/status', wrap(async (req, res) => {
  const old = (await db.prepare('SELECT * FROM questions WHERE id=?').get(Number(req.params.id)));
  if (!old) return bad(res, 'Không tìm thấy.', 404);
  const to = req.body?.status;
  const err = checkTransition(req.user, old.status, to, old.created_by);
  if (err) return bad(res, err, 403);
  if (to === 'pending' || to === 'published') {
    const errs = C.validateQuestion(C.rowToQuestion(old));
    if (errs.length) return bad(res, errs.join('; '), 422);
  }
  (await db.prepare('UPDATE questions SET status=?, updated_at=? WHERE id=?').run(to, now(), old.id));
  res.json({ ok: true });
}));
router.delete('/questions/:id', A.requireRole('admin', 'teacher'), wrap(async (req, res) => {
  const q = (await db.prepare('SELECT status, created_by FROM questions WHERE id=?').get(Number(req.params.id)));
  if (!q) return bad(res, 'Không tìm thấy.', 404);
  if (!owns(req.user, q.created_by)) return bad(res, NOT_OWNER, 403);
  if (q.status === 'published') return bad(res, 'Hãy gỡ câu hỏi trước khi xóa.', 409);
  const used = (await db.prepare('SELECT id,sections FROM exams').all()).some((e) => j(e.sections, []).some((s) => s.question_ids.includes(Number(req.params.id))));
  if (used) return bad(res, 'Câu hỏi đang nằm trong một đề, hãy gỡ khỏi đề trước.', 409);
  (await db.prepare('DELETE FROM questions WHERE id=?').run(Number(req.params.id)));
  (await db.prepare('DELETE FROM question_versions WHERE question_id=?').run(Number(req.params.id)));
  res.json({ ok: true });
}));

// ---------------- Nhập hàng loạt (AD-02) ----------------
function parseCSV(text) {
  const rows = []; let row = [], cur = '', inq = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inq) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inq = false; } else cur += ch; }
    else if (ch === '"') inq = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}
const IMPORT_COLS = ['kind', 'level', 'section', 'qtype', 'stem', 'passage', 'option1', 'option2', 'option3', 'option4', 'answer', 'explanation', 'model_answer', 'accepted', 'points', 'grammar', 'kanji', 'situation', 'audio_script', 'difficulty', 'etype', 'max_len', 'catalog'];
// Tên cột tiếng Việt cũng được chấp nhận (giảng viên dễ soạn trên Excel)
const COL_ALIAS = { 'loai': 'kind', 'loại': 'kind', 'loại câu': 'kind', 'cap do': 'level', 'cấp độ': 'level', 'phan thi': 'section', 'phần thi': 'section', 'dạng câu': 'qtype',
  'câu hỏi': 'stem', 'nội dung': 'stem', 'đoạn văn': 'passage', 'đáp án 1': 'option1', 'đáp án 2': 'option2', 'đáp án 3': 'option3', 'đáp án 4': 'option4',
  'đáp án đúng': 'answer', 'giải thích': 'explanation', 'đáp án mẫu': 'model_answer', 'đáp án chấp nhận': 'accepted', 'điểm': 'points',
  'mức độ': 'difficulty', 'độ khó': 'difficulty', 'dạng tự luận': 'etype', 'giới hạn chữ': 'max_len', 'giới hạn': 'max_len', 'danh mục': 'catalog', 'loại đề': 'catalog' };
const parseCatalog = (v) => { const n = C.normalize(v).replace(/^thi\s+/, '').trim(); return C.EXAM_KINDS[n] ? n : ''; };
// "Khó vừa", "3", "dịch Nhật → Việt"… → giá trị lưu trong CSDL
const DIFF_NAMES = C.DIFFS.map((d) => C.normalize(d));
const parseDiff = (v) => { const s = String(v ?? '').trim(); if (/^[0-5]$/.test(s)) return Number(s); const i = DIFF_NAMES.indexOf(C.normalize(s)); return i > 0 ? i : 0; };
function parseEtype(v) {
  const s = String(v || '').trim(); if (C.ETYPES[s]) return s; const n = C.normalize(s);
  if (/nhat\W*(sang|->|→|-)?\W*viet|日越/.test(n)) return 'ja_vi';
  if (/viet\W*(sang|->|→|-)?\W*nhat|越日/.test(n)) return 'vi_ja';
  if (/loi|sua|訂正/.test(n)) return 'fix';
  if (/viet van|作文|bai van/.test(n)) return 'composition';
  if (/ngan|short/.test(n)) return 'short';
  return '';
}
const headKey = (h) => { const k = String(h).trim().toLowerCase(); return COL_ALIAS[k] || k; };
const KIND_ALIAS = { mcq: 'mcq', 'trac-nghiem': 'mcq', 'trắc nghiệm': 'mcq', 'tn': 'mcq', essay: 'essay', 'tu-luan': 'essay', 'tự luận': 'essay', 'tl': 'essay' };
function rowsToObjects(matrix) {
  if (!matrix.length) return [];
  const head = matrix[0].map(headKey);
  return matrix.slice(1).map((r, i) => { const o = { _row: i + 2 }; head.forEach((h, k) => { o[h] = r[k] == null ? '' : String(r[k]); }); return o; });
}
function importRowToQuestion(o) {
  const opts = ['option1', 'option2', 'option3', 'option4', 'option5', 'option6'].map((k) => (o[k] || '').trim()).filter((x, i, a) => x || a.slice(i + 1).some(Boolean));
  const script = (o.audio_script || '').split('|').map((s) => s.trim()).filter(Boolean).map((s) => { const m = s.match(/^([MFmf])\s*[:：]\s*(.*)$/); return m ? { speaker: m[1].toUpperCase(), text: m[2] } : { speaker: 'M', text: s }; });
  const ans = parseInt(o.answer, 10);
  const k = String(o.kind || '').trim().toLowerCase();
  // không ghi loại: không có phương án mà có đáp án mẫu -> tự luận
  const kind = KIND_ALIAS[k] || (!k && !opts.length && (o.model_answer || o.accepted) ? 'essay' : k ? k : 'mcq');
  const pts = String(o.points || '').trim();
  return { ...cleanQuestion({ kind, level: (o.level || '').trim().toUpperCase(), section: (o.section || '').trim().toLowerCase(), qtype: o.qtype, stem: o.stem, passage: o.passage,
    options: opts, answer: Number.isNaN(ans) ? -1 : ans - 1, explanation: o.explanation, audio_script: script,
    model_answer: o.model_answer, accepted: o.accepted || '', points: pts === '' ? 1 : Number(pts),
    difficulty: parseDiff(o.difficulty), catalog: parseCatalog(o.catalog), etype: parseEtype(o.etype), max_len: Number(String(o.max_len || '').trim() || 0),
    tags: { grammar: o.grammar || '', kanji: o.kanji || '', situation: o.situation || '' } }), ...(KIND_ALIAS[k] || !k ? {} : { kind: k }) };
}
const TEMPLATE_ROWS = [
  ['mcq', 'N5', 'grammar', 'Trợ từ', 'わたしは まいにち バス＿＿ 学校へ 行きます。', '', 'で', 'を', 'に', 'が', '1', 'Dùng で để chỉ phương tiện.', '', '', '1', 'で(手段)', '', '', ''],
  ['essay', 'N5', 'writing', 'Dịch Việt → Nhật', 'Dịch sang tiếng Nhật: "Tôi là sinh viên."', '', '', '', '', '', '', 'Mẫu câu N は N です。', 'わたしは がくせいです。', 'わたしはがくせいです|私は学生です', '2', 'は〜です', '', '', ''],
  ['essay', 'N4', 'writing', 'Viết đoạn văn', 'Hãy viết 3-5 câu tiếng Nhật giới thiệu về gia đình bạn.', '', '', '', '', '', '', '', 'Gợi ý chấm: đủ 3 câu (4đ), đúng trợ từ (3đ), dùng đúng thể ます (3đ).', '', '10', '', '', '', ''],
];
router.get('/import/template.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="mau-nhap-cau-hoi.csv"');
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  res.send('\ufeff' + IMPORT_COLS.join(',') + '\n' + TEMPLATE_ROWS.map((r) => r.map(q).join(',')).join('\n') + '\n');
});
router.get('/import/template.xlsx', (_req, res) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([IMPORT_COLS, ...TEMPLATE_ROWS]), 'CauHoi');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Cột', 'Bắt buộc', 'Ý nghĩa'],
    ['kind', 'không', 'mcq = trắc nghiệm (mặc định), essay = tự luận. Viết "trắc nghiệm"/"tự luận" cũng được.'],
    ['level', 'có', 'N5, N4, N3, N2, N1'],
    ['section', 'có', 'vocab, grammar, reading, listening, conversation, writing (viết / tự luận)'],
    ['qtype', 'không', 'Dạng câu tự đặt, ví dụ: Trợ từ, Dịch câu, Viết đoạn văn'],
    ['stem', 'có', 'Nội dung câu hỏi. Furigana: {漢字|かんじ}, gạch chân: __chữ__'],
    ['passage', 'không', 'Đoạn văn / ngữ cảnh dùng chung'],
    ['option1..option4', 'trắc nghiệm', 'Các phương án (2-4, có thể thêm option5, option6). Bỏ trống với câu tự luận'],
    ['answer', 'trắc nghiệm', 'Số thứ tự phương án đúng (1-4)'],
    ['explanation', 'trắc nghiệm', 'Giải thích tiếng Việt (tự luận: không bắt buộc)'],
    ['model_answer', 'tự luận', 'Đáp án mẫu / hướng dẫn chấm, chỉ người học thấy sau khi nộp'],
    ['accepted', 'không', 'Câu trả lời ngắn được chấp nhận, cách nhau bởi |. Nếu khớp, hệ thống tự chấm đủ điểm; không khớp thì giảng viên chấm tay'],
    ['points', 'không', 'Điểm tối đa của câu (1-100, mặc định 1)'],
    ['grammar, kanji, situation', 'không', 'Thẻ phân loại, cách nhau dấu phẩy'],
    ['audio_script', 'câu nghe', 'Kịch bản nghe: M:lời|F:lời'],
  ]), 'HuongDan');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="mau-nhap-cau-hoi.xlsx"');
  res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
});
router.post('/import/questions', A.requireRole(...AUTHORS), express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }), express.raw({ type: 'application/octet-stream', limit: '10mb' }), wrap(async (req, res) => {
  let matrix;
  if (Buffer.isBuffer(req.body)) {
    const wb = XLSX.read(req.body, { type: 'buffer' });
    matrix = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
  } else if (typeof req.body === 'string') matrix = parseCSV(req.body);
  else return bad(res, 'Cần gửi file CSV hoặc XLSX.');
  const objs = rowsToObjects(matrix);
  if (!objs.length) return bad(res, 'File không có dòng dữ liệu nào.');
  const head = matrix[0].map(headKey);
  const missing = ['level', 'section', 'stem'].filter((c) => !head.includes(c));
  if (missing.length) return bad(res, 'Thiếu cột bắt buộc: ' + missing.join(', '));
  const parsed = objs.map((o) => ({ row: o._row, q: importRowToQuestion(o) }));
  const errors = parsed.map((p) => ({ row: p.row, errors: C.validateQuestion(p.q) })).filter((e) => e.errors.length);
  if (errors.length) return bad(res, `Có ${errors.length} dòng lỗi. Không câu nào được nhập.`, 422, { errors });  // không nhập một nửa
  const ids = await tx(async () => { const a = []; for (const p of parsed) a.push(await insertQuestion(p.q, req.user.id)); return a; });
  res.json({ ok: true, imported: ids.length, ids, mcq: parsed.filter((p) => p.q.kind === 'mcq').length, essay: parsed.filter((p) => p.q.kind === 'essay').length });
}));

// ---------------- Đề thi ----------------
const examRow = (e) => ({ ...e, sections: j(e.sections, []), scoring: j(e.scoring, {}) });
router.get('/exams', wrap(async (req, res) => res.json(await withAuthors((await db.prepare(`SELECT * FROM exams ${req.query.mine ? 'WHERE created_by=?' : ''} ORDER BY id DESC`).all(...(req.query.mine ? [req.user.id] : []))).map(examRow)))));
// ---- Tải đề từ file PDF / Word: tách câu (bản nháp) -> giảng viên duyệt lại -> tạo câu hỏi + đề ----
const DOC = require('../lib/docimport');
router.post('/import/document', A.requireRole(...AUTHORS), express.raw({ type: () => true, limit: '20mb' }), wrap(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return bad(res, 'Chưa chọn file.');
  const name = decodeURIComponent(String(req.headers['x-filename'] || ''));
  let ex;
  try { ex = await DOC.extractText(req.body, name); } catch (e) { return bad(res, /chưa hỗ trợ/.test(e.message) ? e.message : 'Không đọc được file. Hãy dùng PDF có chữ (xuất từ Word) hoặc .docx.', 422); }
  const letters = (ex.text.match(/[\p{L}\p{N}]/gu) || []).length;
  if (letters < 40) return bad(res, 'File không có chữ để đọc (có thể là ảnh chụp hoặc bản scan). Hãy dùng file PDF xuất từ Word, hoặc file .docx.', 422);
  const doc = DOC.parseExam(ex.text);
  if (!doc.count) return bad(res, 'Không tìm thấy câu hỏi nào. Câu hỏi cần được đánh số "1." "2." hoặc "Câu 1:", phương án "A. B. C. D.".', 422);
  res.json({ ...doc, file: name, type: ex.type, pages: ex.pages || null });
}));
// Điền đáp án từ bảng đáp án dán vào ("1.C 2.B …", "41 DBAC", "111 ○")
router.post('/import/document/key', A.requireRole(...AUTHORS), express.json({ limit: '10mb' }), wrap(async (req, res) => {
  const doc = req.body?.doc; if (!doc?.sections) return bad(res, 'Thiếu dữ liệu đề.');
  const n = DOC.applyKey(doc, String(req.body.key || ''));
  res.json({ doc, applied: n });
}));
router.post('/import/document/commit', A.requireRole(...AUTHORS), express.json({ limit: '10mb' }), wrap(async (req, res) => {
  const b = req.body || {};
  const level = /^N[1-5]$/.test(b.level) ? b.level : null; if (!level) return bad(res, 'Chọn cấp độ của đề.');
  const title = String(b.title || '').trim().slice(0, 150); if (!title) return bad(res, 'Nhập tên đề.');
  const secs = (Array.isArray(b.sections) ? b.sections : []).filter((s) => s && Array.isArray(s.questions) && s.questions.length);
  if (!secs.length) return bad(res, 'Đề chưa có câu hỏi nào.');
  const errors = [], built = [];
  secs.forEach((s, si) => {
    const short = (String(s.name || '').match(/^(問題\s*\d+|第\s*\d+\s*部|PHẦN\s+\S+|Phần\s+\S+)/i) || [])[1] || '';
    built.push({ name: String(s.name || `Phần ${si + 1}`).slice(0, 80), qs: s.questions.map((x) => {
      const kind = x.kind === 'essay' ? 'essay' : 'mcq';
      const opts = kind === 'mcq' ? (x.options || []).map((o) => String(o ?? '').trim()) : [];
      const ans = Number.isInteger(x.answer) ? x.answer : -1;
      const q = cleanQuestion({ kind, level, section: x.section, qtype: x.qtype || short, stem: x.stem, passage: x.passage, options: opts, answer: ans,
        explanation: String(x.explanation || '').trim() || (kind === 'mcq' && ans >= 0 ? `Đáp án đúng: ${'ABCDEF'[ans]}. ${opts[ans] || ''}` : ''),
        model_answer: kind === 'essay' ? (String(x.model_answer || '').trim() || (String(x.accepted || '').trim() ? '' : '(Giáo viên chấm theo đáp án riêng.)')) : '',
        accepted: kind === 'essay' ? x.accepted : '', points: Number(x.points) || 1, tags: {}, difficulty: Number(b.difficulty) || 0, etype: x.etype, max_len: Number(x.max_len) || 0 });
      const errs = C.validateQuestion(q).map((e) => (e === 'Đáp án đúng không hợp lệ' ? 'Chưa chọn đáp án đúng' : e));
      if (errs.length) errors.push({ label: String(x.label || ''), section: si, errors: errs });
      return q;
    }) });
  });
  if (errors.length) return bad(res, `Còn ${errors.length} câu cần sửa trước khi tạo đề.`, 422, { errors });
  const anyEssay = built.some((s) => s.qs.some((q) => q.kind === 'essay'));
  const kindE = kindOf(b.exam_kind, anyEssay);
  if (C.MCQ_ONLY.includes(kindE) && anyEssay) return bad(res, CERT_MCQ, 422);
  for (const s of built) for (const q of s.qs) q.catalog = kindE;
  const publish = b.publish !== false;
  const status = !publish ? 'draft' : req.user.role === 'editor' ? 'pending' : 'published';
  const ALL_SECS = ['vocab', 'conversation', 'grammar', 'reading', 'listening', 'writing'];
  const max = Number(b.scale) === 100 ? 100 : 10;
  const scoring = { groups: [{ key: 'all', name: 'Toàn bài', sections: ALL_SECS, max, min: 0 }], total_pass: max / 2, ...(max === 10 ? { decimals: 1 } : {}), note: `Thang điểm ${max}, quy đổi theo điểm từng câu.` };
  const out = await tx(async () => {
    const sections = [];
    for (const [i, s] of built.entries()) { const ids = []; for (const q of s.qs) ids.push(await insertQuestion(q, req.user.id, status)); sections.push({ key: 's' + (i + 1), name: s.name, question_ids: ids }); }
    const minutes = Math.min(600, Math.max(5, Number(b.minutes) || 60));
    const r = await db.prepare('INSERT INTO exams(title,exam_type,exam_kind,difficulty,level,duration_min,description,sections,scoring,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(title, 'CUSTOM', kindE, Number(b.difficulty) || 0, level, minutes, String(b.description || '').slice(0, 2000), JSON.stringify(sections), JSON.stringify(scoring), status, req.user.id, now(), now());
    return { id: Number(r.lastInsertRowid), questions: sections.reduce((a, s) => a + s.question_ids.length, 0) };
  });
  res.json({ ...out, status });
}));

// ---- Đề PDF/ảnh scan + phiếu trả lời: học viên xem file đề, tô đáp án trên phiếu; giáo viên nhập đáp án ----
const SHEET_TYPES = { mcq: 1, tf: 1, text: 1, essay: 1 };
const examMeta = (b) => {
  const level = /^N[1-5]$/.test(b.level) ? b.level : null;
  const title = String(b.title || '').trim().slice(0, 150);
  const max = Number(b.scale) === 100 ? 100 : 10;
  const ALL_SECS = ['vocab', 'conversation', 'grammar', 'reading', 'listening', 'writing'];
  return { level, title, minutes: Math.min(600, Math.max(5, Number(b.minutes) || 60)), publish: b.publish !== false,
    scoring: { groups: [{ key: 'all', name: 'Toàn bài', sections: ALL_SECS, max, min: 0 }], total_pass: max / 2, ...(max === 10 ? { decimals: 1 } : {}), note: `Thang điểm ${max}, quy đổi theo điểm từng câu.` } };
};
router.post('/import/sheet', A.requireRole(...AUTHORS), express.json({ limit: '2mb' }), wrap(async (req, res) => {
  const b = req.body || {}, M = examMeta(b);
  if (!M.level) return bad(res, 'Chọn cấp độ của đề.');
  if (!M.title) return bad(res, 'Nhập tên đề.');
  const docUrl = String(b.doc_url || '').trim();
  if (!docUrl || !(await db.prepare("SELECT id FROM media WHERE url=? OR '/uploads/' || path=?").get(docUrl, docUrl))) return bad(res, 'Hãy tải file đề (PDF hoặc ảnh) lên trước.');
  const groups = Array.isArray(b.groups) ? b.groups.slice(0, 30) : [];
  if (!groups.length) return bad(res, 'Thêm ít nhất một nhóm câu.');
  const answers = b.answers && typeof b.answers === 'object' ? b.answers : {};
  const used = new Set(), built = [], missing = [];
  for (const [gi, g] of groups.entries()) {
    const from = Number(g.from), to = Number(g.to), type = SHEET_TYPES[g.type] ? g.type : 'mcq';
    const name = String(g.name || '').trim().slice(0, 80) || `Nhóm ${gi + 1}`;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > 999) return bad(res, `${name}: số câu "từ … đến …" không hợp lệ.`);
    const points = Number(g.points) || 1;
    if (!Number.isInteger(points) || points < 1 || points > 100) return bad(res, `${name}: điểm mỗi câu phải là số nguyên 1-100.`);
    const section = C.SECTIONS[g.section] && g.section !== 'listening' ? g.section : 'reading';
    const n = Math.min(6, Math.max(2, Number(g.n) || 4));
    const opts = type === 'mcq' ? 'ABCDEF'.slice(0, n).split('') : type === 'tf' ? ['Đúng', 'Sai'] : [];
    const qs = [];
    for (let no = from; no <= to; no++) {
      if (used.has(no)) return bad(res, `Câu ${no} nằm trong hai nhóm. Sửa lại khoảng số câu.`);
      used.add(no);
      const v = answers[no] ?? answers[String(no)];
      let q;
      if (type === 'mcq' || type === 'tf') {
        const ans = Number.isInteger(v) && v >= 0 && v < opts.length ? v : -1;
        if (ans < 0) missing.push(no);
        q = { kind: 'mcq', options: opts, answer: ans, explanation: ans >= 0 ? `Đáp án đúng: ${opts[ans]}.` : '' };
      } else {
        const t = String(v ?? '').trim().slice(0, 2000);
        if (type === 'text' && !t) missing.push(no);
        q = { kind: 'essay', options: [], answer: -1, accepted: type === 'text' ? t : '', model_answer: t || '(Giáo viên chấm theo đáp án riêng.)', etype: type === 'text' ? 'short' : g.etype, max_len: Number(g.max_len) || 0 };
      }
      qs.push(cleanQuestion({ ...q, difficulty: Number(b.difficulty) || 0, level: M.level, section, qtype: type === 'essay' ? 'Phiếu trả lời · viết' : 'Phiếu trả lời', stem: `Câu ${no}`, points, tags: {} }));
    }
    built.push({ name, qs });
  }
  if (used.size > 400) return bad(res, 'Phiếu trả lời tối đa 400 câu.');
  if (missing.length) return bad(res, `Còn ${missing.length} câu chưa có đáp án: ${missing.slice(0, 30).join(', ')}${missing.length > 30 ? '…' : ''}.`, 422, { missing });
  for (const s of built) for (const q of s.qs) { const errs = C.validateQuestion(q); if (errs.length) return bad(res, `${q.stem}: ${errs.join('; ')}`, 422); }
  const anyEssay = built.some((s) => s.qs.some((q) => q.kind === 'essay'));
  const kindE = kindOf(b.exam_kind, anyEssay);
  if (C.MCQ_ONLY.includes(kindE) && anyEssay) return bad(res, CERT_MCQ, 422);
  for (const s of built) for (const q of s.qs) q.catalog = kindE;
  const status = !M.publish ? 'draft' : req.user.role === 'editor' ? 'pending' : 'published';
  const out = await tx(async () => {
    const sections = [];
    for (const [i, s] of built.entries()) { const ids = []; for (const q of s.qs) ids.push(await insertQuestion(q, req.user.id, status, true)); sections.push({ key: 's' + (i + 1), name: s.name, question_ids: ids }); }
    const r = await db.prepare('INSERT INTO exams(title,exam_type,exam_kind,difficulty,level,duration_min,description,sections,scoring,status,created_by,created_at,updated_at,doc_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(M.title, 'CUSTOM', kindE, Number(b.difficulty) || 0, M.level, M.minutes, String(b.description || '').slice(0, 2000), JSON.stringify(sections), JSON.stringify(M.scoring), status, req.user.id, now(), now(), docUrl);
    return { id: Number(r.lastInsertRowid), questions: used.size };
  });
  res.json({ ...out, status });
}));
// ---- Thay đề mẫu: xóa các đề mô phỏng cài sẵn (và câu hỏi chỉ thuộc các đề đó), nạp đề Chuyên 10 số 01 làm đề mẫu ----
const SAMPLE_TITLES = () => [...['N5', 'N4', 'N3'].map((lv) => `JLPT ${lv} - Đề mô phỏng rút gọn 01`), ...require('../seed/extra').exams.map((e) => e.title)];
const NEW_SAMPLE = () => require('../scripts/data/chuyen-10-de-01');
async function sampleState() {
  const titles = SAMPLE_TITLES();
  const ex = await db.prepare('SELECT id,title FROM exams WHERE title = ANY(?) ORDER BY id').all(titles);
  const has = !!(await db.prepare('SELECT 1 FROM exams WHERE title=?').get(NEW_SAMPLE().title));
  return { old: ex, new_title: NEW_SAMPLE().title, has_new: has };
}
router.get('/sample', A.requireRole('admin'), wrap(async (_req, res) => res.json(await sampleState())));
router.post('/sample/replace', A.requireRole('admin'), wrap(async (req, res) => {
  const st = await sampleState(), D = NEW_SAMPLE();
  // dựng sẵn câu hỏi của đề mới, kiểm tra trước khi xóa gì
  const qs = st.has_new ? [] : D.rows.map((r) => {
    const essay = r.kind === 'essay';
    const options = essay ? [] : [r.option1, r.option2, r.option3, r.option4].filter((o) => String(o ?? '').trim());
    return cleanQuestion({ kind: essay ? 'essay' : 'mcq', level: r.level || D.level, section: r.section, qtype: r.qtype, stem: r.stem, passage: r.passage, options,
      answer: essay ? -1 : Number(r.answer) - 1, explanation: r.explanation, model_answer: r.model_answer, accepted: r.accepted, points: Number(r.points) || 1,
      tags: { grammar: r.grammar || '', kanji: r.kanji || '', situation: r.situation || '' }, difficulty: D.difficulty || 0, catalog: D.exam_kind || 'chuyen', etype: r.etype, max_len: Number(r.max_len) || 0 });
  });
  for (const [i, q] of qs.entries()) { const errs = C.validateQuestion(q); if (errs.length) return bad(res, `Đề mẫu mới, câu ${i + 1}: ${errs.join('; ')}`, 500); }
  const out = await tx(async () => {
    const delIds = st.old.map((e) => e.id);
    const old = delIds.length ? await db.prepare('SELECT id,sections FROM exams WHERE id = ANY(?)').all(delIds) : [];
    const oldQ = new Set(old.flatMap((e) => j(e.sections, []).flatMap((x) => x.question_ids)));
    const others = (await db.prepare('SELECT id,sections FROM exams').all()).filter((e) => !delIds.includes(Number(e.id)));
    const used = new Set(others.flatMap((e) => j(e.sections, []).flatMap((x) => x.question_ids)));
    const dropQ = [...oldQ].filter((id) => !used.has(id));
    if (delIds.length) await db.prepare('DELETE FROM exams WHERE id = ANY(?)').run(delIds);
    if (dropQ.length) for (const t of ['question_versions', 'comments', 'reports']) await db.prepare(`DELETE FROM ${t} WHERE question_id = ANY(?)`).run(dropQ);
    if (dropQ.length) await db.prepare('DELETE FROM questions WHERE id = ANY(?)').run(dropQ);
    // bỏ các bước "làm đề" trỏ tới đề đã xóa trong khóa học
    const gone = new Set(st.old.map((e) => e.title));
    for (const c of await db.prepare('SELECT id,steps FROM courses').all()) {
      const steps = j(c.steps, []); const kept = steps.filter((x) => !(x.type === 'exam' && gone.has(x.ref)));
      if (kept.length !== steps.length) await db.prepare('UPDATE courses SET steps=? WHERE id=?').run(JSON.stringify(kept), c.id);
    }
    let created = null;
    if (qs.length) {
      const ids = []; for (const q of qs) ids.push(await insertQuestion(q, req.user.id, 'published'));
      const sections = D.parts.map((pt) => ({ key: pt.key, name: pt.name, question_ids: ids.slice(pt.from, pt.to) }));
      const r = await db.prepare("INSERT INTO exams(title,exam_type,exam_kind,difficulty,level,duration_min,description,sections,scoring,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'published',?,?,?)")
        .run(D.title, D.exam_type || 'CUSTOM', D.exam_kind || 'chuyen', D.difficulty || 0, D.level, D.minutes, D.description, JSON.stringify(sections), JSON.stringify(D.scoring), req.user.id, now(), now());
      created = { id: Number(r.lastInsertRowid), questions: ids.length };
    }
    return { deleted_exams: delIds.length, deleted_questions: dropQ.length, created };
  });
  res.json(out);
}));
const CERT_MCQ = 'Đề JLPT và BJT chỉ gồm câu trắc nghiệm. Đề có câu tự luận, dịch hoặc viết văn hãy chọn danh mục "Thi chuyên" hoặc "EJU".';
const kindOf = (want, anyEssay) => (C.EXAM_KINDS[want] ? want : anyEssay ? 'chuyen' : 'jlpt');
const hasEssay = async (ids) => ids.length > 0 && !!(await db.prepare("SELECT 1 FROM questions WHERE id = ANY(?) AND kind='essay' LIMIT 1").get(ids));
function cleanExam(b) {
  const sections = (b.sections || []).map((s) => ({ key: s.key, name: s.name || C.SECTIONS[s.key] || s.key, question_ids: (s.question_ids || []).map(Number).filter(Number.isInteger) }));
  return { title: String(b.title || '').trim(), exam_type: b.exam_type || 'JLPT', exam_kind: C.EXAM_KINDS[b.exam_kind] ? b.exam_kind : '', difficulty: Number(b.difficulty) || 0, level: b.level, duration_min: Number(b.duration_min) || 30, description: String(b.description || ''), sections, scoring: b.scoring || {} };
}
async function examErrors(e, user) {
  const errs = [];
  if (user && user.role === 'teacher') {   // giảng viên dùng câu của mình hoặc câu đã đăng trong ngân hàng chung
    const bad = []; for (const id of e.sections.flatMap((s) => s.question_ids)) if (!(await db.prepare("SELECT 1 FROM questions WHERE id=? AND (created_by=? OR status='published')").get(id, user.id))) bad.push(id);
    if (bad.length) errs.push(`Không dùng được câu nháp của người khác (ID: ${bad.slice(0, 10).join(', ')})`);
  }
  if (!e.title) errs.push('Thiếu tên đề');
  if (!/^N[1-5]$/.test(e.level || '')) errs.push('Cấp độ không hợp lệ');
  if (!['JLPT', 'JFT', 'NAT', 'CUSTOM'].includes(e.exam_type)) errs.push('Kỳ thi không hợp lệ');
  if (!e.sections.length || e.sections.some((s) => !s.question_ids.length)) errs.push('Mỗi phần thi cần ít nhất một câu hỏi');
  if (!e.scoring?.groups?.length || !e.scoring.total_pass) errs.push('Thiếu cấu hình thang điểm');
  if (!(Number.isInteger(e.difficulty) && e.difficulty >= 0 && e.difficulty <= 5)) errs.push('Mức độ khó phải từ 1 đến 5');
  const essay = await hasEssay(e.sections.flatMap((s) => s.question_ids));
  e.exam_kind = kindOf(e.exam_kind, essay);   // không chọn danh mục: tự xếp theo câu trong đề
  if (C.MCQ_ONLY.includes(e.exam_kind) && essay) errs.push(CERT_MCQ);
  return errs;
}
router.post('/exams', A.requireRole(...AUTHORS), wrap(async (req, res) => {
  const e = cleanExam(req.body || {}); const errs = await examErrors(e, req.user);
  if (errs.length) return bad(res, errs.join('; '), 422);
  const r = (await db.prepare('INSERT INTO exams(title,exam_type,exam_kind,difficulty,level,duration_min,description,sections,scoring,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(e.title, e.exam_type, e.exam_kind, e.difficulty, e.level, e.duration_min, e.description, JSON.stringify(e.sections), JSON.stringify(e.scoring), req.user.id, now(), now()));
  res.json({ id: Number(r.lastInsertRowid) });
}));
router.put('/exams/:id', A.requireRole(...AUTHORS), wrap(async (req, res) => {
  const old = (await db.prepare('SELECT * FROM exams WHERE id=?').get(Number(req.params.id)));
  if (!old) return bad(res, 'Không tìm thấy.', 404);
  if (!owns(req.user, old.created_by)) return bad(res, NOT_OWNER, 403);
  const e = cleanExam(req.body || {}); const errs = await examErrors(e, req.user);
  if (errs.length) return bad(res, errs.join('; '), 422);
  const status = old.status === 'published' && req.user.role === 'editor' ? 'pending' : old.status;
  (await db.prepare('UPDATE exams SET title=?,exam_type=?,exam_kind=?,difficulty=?,level=?,duration_min=?,description=?,sections=?,scoring=?,status=?,version=version+1,updated_at=? WHERE id=?')
    .run(e.title, e.exam_type, e.exam_kind, e.difficulty, e.level, e.duration_min, e.description, JSON.stringify(e.sections), JSON.stringify(e.scoring), status, now(), old.id));
  res.json({ ok: true });
}));
router.post('/exams/:id/status', wrap(async (req, res) => {
  const old = (await db.prepare('SELECT * FROM exams WHERE id=?').get(Number(req.params.id)));
  if (!old) return bad(res, 'Không tìm thấy.', 404);
  const to = req.body?.status;
  const err = checkTransition(req.user, old.status, to, old.created_by);
  if (err) return bad(res, err, 403);
  if (to === 'published') {   // đề chỉ đăng khi mọi câu đã duyệt
    const ids = j(old.sections, []).flatMap((s) => s.question_ids);
    const notOk = []; for (const id of ids) if (!(await db.prepare("SELECT 1 FROM questions WHERE id=? AND status='published'").get(id))) notOk.push(id);
    if (notOk.length) return bad(res, `Còn ${notOk.length} câu chưa được duyệt (ID: ${notOk.slice(0, 10).join(', ')}).`, 422);
  }
  (await db.prepare('UPDATE exams SET status=?, updated_at=? WHERE id=?').run(to, now(), old.id));
  res.json({ ok: true });
}));

// ---------------- Bài học đời sống ----------------
const lessonRow = (l) => ({ ...l, dialogue: j(l.dialogue, []), vocab: j(l.vocab, []), phrases: j(l.phrases, []), doc: j(l.doc, null), quiz: j(l.quiz, []), grammar_tags: j(l.grammar_tags, []) });
function lessonErrors(b) {
  const e = [];
  if (!String(b.title || '').trim()) e.push('Thiếu tiêu đề');
  if (!String(b.situation || '').trim()) e.push('Thiếu tình huống');
  if (!/^N[1-5]$/.test(b.level || '')) e.push('Cấp độ không hợp lệ');
  if (!(b.dialogue || []).length) e.push('Cần ít nhất một lời thoại');
  for (const [i, q] of (b.quiz || []).entries()) if (!q.stem || (q.options || []).length < 2 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) e.push(`Câu kiểm tra ${i + 1} không hợp lệ`);
  return e;
}
router.get('/lessons', wrap(async (_req, res) => res.json((await db.prepare('SELECT * FROM lessons ORDER BY id DESC').all()).map(lessonRow))));
router.post('/lessons', A.requireRole('admin', 'editor'), wrap(async (req, res) => {
  const b = req.body || {}; const errs = lessonErrors(b);
  if (errs.length) return bad(res, errs.join('; '), 422);
  const r = (await db.prepare('INSERT INTO lessons(title,situation,level,summary,dialogue,vocab,phrases,doc,culture,quiz,grammar_tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(b.title, b.situation, b.level, b.summary || '', JSON.stringify(b.dialogue || []), JSON.stringify(b.vocab || []), JSON.stringify(b.phrases || []), JSON.stringify(b.doc || null), b.culture || '', JSON.stringify(b.quiz || []), JSON.stringify(b.grammar_tags || []), now(), now()));
  res.json({ id: Number(r.lastInsertRowid) });
}));
router.put('/lessons/:id', A.requireRole('admin', 'editor'), wrap(async (req, res) => {
  const old = (await db.prepare('SELECT * FROM lessons WHERE id=?').get(Number(req.params.id)));
  if (!old) return bad(res, 'Không tìm thấy.', 404);
  const b = req.body || {}; const errs = lessonErrors(b);
  if (errs.length) return bad(res, errs.join('; '), 422);
  const status = old.status === 'published' && req.user.role === 'editor' ? 'pending' : old.status;
  (await db.prepare('UPDATE lessons SET title=?,situation=?,level=?,summary=?,dialogue=?,vocab=?,phrases=?,doc=?,culture=?,quiz=?,grammar_tags=?,status=?,version=version+1,updated_at=? WHERE id=?')
    .run(b.title, b.situation, b.level, b.summary || '', JSON.stringify(b.dialogue || []), JSON.stringify(b.vocab || []), JSON.stringify(b.phrases || []), JSON.stringify(b.doc || null), b.culture || '', JSON.stringify(b.quiz || []), JSON.stringify(b.grammar_tags || []), status, now(), old.id));
  res.json({ ok: true });
}));
router.post('/lessons/:id/status', wrap(async (req, res) => {
  const old = (await db.prepare('SELECT * FROM lessons WHERE id=?').get(Number(req.params.id)));
  if (!old) return bad(res, 'Không tìm thấy.', 404);
  const err = checkTransition(req.user, old.status, req.body?.status);
  if (err) return bad(res, err, 403);
  (await db.prepare('UPDATE lessons SET status=?, updated_at=? WHERE id=?').run(req.body.status, now(), old.id));
  res.json({ ok: true });
}));


// ---------------- Ngữ pháp & khóa học ----------------
const STEP_TYPES = ['grammar', 'lesson', 'dictation', 'exam', 'practice', 'cards'];
router.get('/refs', wrap(async (_req, res) => res.json({
  exams: (await db.prepare("SELECT title FROM exams WHERE status='published' ORDER BY id").all()).map((r) => r.title),
  lessons: (await db.prepare("SELECT title FROM lessons WHERE status='published' ORDER BY id").all()).map((r) => r.title),
  grammar: (await db.prepare('SELECT tag FROM grammar ORDER BY level DESC, seq').all()).map((r) => r.tag) })));
router.get('/grammar', wrap(async (_req, res) => res.json((await db.prepare('SELECT * FROM grammar ORDER BY level DESC, seq').all()).map((g) => ({ ...g, examples: j(g.examples, []) })))));
function grammarErrors(g) {
  const e = [];
  if (!String(g.tag || '').trim()) e.push('Thiếu thẻ (tên mẫu ngữ pháp). Thẻ này phải trùng với thẻ ngữ pháp gắn trên câu hỏi/bài học');
  if (!/^N[1-5]$/.test(g.level || '')) e.push('Cấp độ không hợp lệ');
  if (!String(g.title || '').trim()) e.push('Thiếu cấu trúc ngắn gọn (tiêu đề)');
  if (!String(g.meaning || '').trim()) e.push('Thiếu ý nghĩa');
  if (!Array.isArray(g.examples) || !g.examples.length) e.push('Cần ít nhất một ví dụ');
  else g.examples.forEach((x, i) => { if (!String(x.ja || '').trim() || !String(x.vi || '').trim()) e.push(`Ví dụ ${i + 1} thiếu tiếng Nhật hoặc bản dịch`); });
  return e;
}
router.post('/grammar', A.requireRole('admin', 'editor'), wrap(async (req, res) => {
  const g = req.body || {}; const errs = grammarErrors(g);
  if (errs.length) return bad(res, errs.join('; '), 422, { errors: errs });
  const tag = String(g.tag).trim();
  const exists = (await db.prepare('SELECT 1 FROM grammar WHERE tag=?').get(tag));
  if (exists && !g.overwrite) return bad(res, 'Mẫu ngữ pháp này đã tồn tại. Hãy mở và sửa mẫu đó.', 409);
  (await db.prepare('INSERT INTO grammar(tag,level,title,meaning,structure,notes,examples,compare) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tag) DO UPDATE SET level=excluded.level,title=excluded.title,meaning=excluded.meaning,structure=excluded.structure,notes=excluded.notes,examples=excluded.examples,compare=excluded.compare')
    .run(tag, g.level, String(g.title).trim(), String(g.meaning).trim(), String(g.structure || '').trim(), String(g.notes || '').trim(),
      JSON.stringify(g.examples.map((x) => ({ ja: String(x.ja).trim(), vi: String(x.vi).trim() }))), String(g.compare || '').trim()));
  res.json({ ok: true, tag });
}));
router.delete('/grammar', A.requireRole('admin'), wrap(async (req, res) => {
  const tag = String(req.query.tag || '');
  const used = (await db.prepare('SELECT steps FROM courses').all()).some((c) => j(c.steps, []).some((s) => s.type === 'grammar' && s.ref === tag));
  if (used) return bad(res, 'Mẫu ngữ pháp đang được dùng trong một khóa học. Hãy gỡ khỏi khóa học trước.', 409);
  (await db.prepare('DELETE FROM grammar WHERE tag=?').run(tag)); res.json({ ok: true });
}));

function cleanCourse(b) {
  return { title: String(b.title || '').trim(), level: b.level, goal: String(b.goal || '').trim(), description: String(b.description || '').trim(), weeks: Number(b.weeks) || 4,
    steps: (b.steps || []).map((s) => ({ week: Number(s.week), type: s.type, ref: String(s.ref || ''), title: String(s.title || '').trim(), ...(s.level ? { level: s.level } : {}), ...(s.section ? { section: s.section } : {}), ...(s.type === 'cards' ? { count: Number(s.count) || 5 } : {}) })) };
}
async function courseErrors(c) {
  const e = [];
  if (!c.title) e.push('Thiếu tên khóa học');
  if (!/^N[1-5]$/.test(c.level || '')) e.push('Cấp độ không hợp lệ');
  if (!(c.weeks >= 1 && c.weeks <= 52)) e.push('Số tuần phải từ 1 đến 52');
  if (!c.steps.length) e.push('Khóa học cần ít nhất một bước');
  const has = async (sql, v) => !!(await db.prepare(sql).get(v));
  for (const [i, s] of c.steps.entries()) {
    const n = `Bước ${i + 1}`;
    if (!STEP_TYPES.includes(s.type)) { e.push(`${n}: loại bước không hợp lệ`); continue; }
    if (!(s.week >= 1 && s.week <= c.weeks)) e.push(`${n}: tuần phải từ 1 đến ${c.weeks}`);
    if (!s.title) e.push(`${n}: thiếu tiêu đề`);
    if (s.type === 'exam' && !(await has("SELECT 1 FROM exams WHERE title=? AND status='published'", s.ref))) e.push(`${n}: không tìm thấy đề đã đăng “${s.ref}”`);
    if ((s.type === 'lesson' || s.type === 'dictation') && !(await has("SELECT 1 FROM lessons WHERE title=? AND status='published'", s.ref))) e.push(`${n}: không tìm thấy bài đã đăng “${s.ref}”`);
    if (s.type === 'grammar' && !(await has('SELECT 1 FROM grammar WHERE tag=?', s.ref))) e.push(`${n}: không tìm thấy mẫu ngữ pháp “${s.ref}”`);
    if (s.type === 'practice' && !/^N[1-5]$/.test(s.level || '')) e.push(`${n}: luyện tập cần cấp độ`);
  }
  return e;
}
router.get('/courses', wrap(async (_req, res) => res.json((await db.prepare('SELECT * FROM courses ORDER BY id DESC').all()).map((c) => ({ ...c, steps: j(c.steps, []) })))));
router.post('/courses', A.requireRole('admin', 'editor'), wrap(async (req, res) => {
  const c = cleanCourse(req.body || {}); const errs = await courseErrors(c);
  if (errs.length) return bad(res, errs.join('; '), 422, { errors: errs });
  if ((await db.prepare('SELECT 1 FROM courses WHERE title=?').get(c.title))) return bad(res, 'Đã có khóa học trùng tên.', 409);
  const r = (await db.prepare("INSERT INTO courses(title,level,goal,description,weeks,steps,status) VALUES(?,?,?,?,?,?, 'draft')").run(c.title, c.level, c.goal, c.description, c.weeks, JSON.stringify(c.steps)));
  res.json({ id: Number(r.lastInsertRowid) });
}));
router.put('/courses/:id', A.requireRole('admin', 'editor'), wrap(async (req, res) => {
  const old = (await db.prepare('SELECT * FROM courses WHERE id=?').get(Number(req.params.id)));
  if (!old) return bad(res, 'Không tìm thấy.', 404);
  const c = cleanCourse(req.body || {}); const errs = await courseErrors(c);
  if (errs.length) return bad(res, errs.join('; '), 422, { errors: errs });
  if ((await db.prepare('SELECT 1 FROM courses WHERE title=? AND id!=?').get(c.title, old.id))) return bad(res, 'Đã có khóa học trùng tên.', 409);
  const status = old.status === 'published' && req.user.role === 'editor' ? 'pending' : old.status;
  (await db.prepare('UPDATE courses SET title=?,level=?,goal=?,description=?,weeks=?,steps=?,status=? WHERE id=?').run(c.title, c.level, c.goal, c.description, c.weeks, JSON.stringify(c.steps), status, old.id));
  res.json({ ok: true, status });
}));
router.post('/courses/:id/status', wrap(async (req, res) => {
  const old = (await db.prepare('SELECT * FROM courses WHERE id=?').get(Number(req.params.id)));
  if (!old) return bad(res, 'Không tìm thấy.', 404);
  const err = checkTransition(req.user, old.status, req.body?.status);
  if (err) return bad(res, err, 403);
  (await db.prepare('UPDATE courses SET status=? WHERE id=?').run(req.body.status, old.id)); res.json({ ok: true });
}));
router.delete('/courses/:id', A.requireRole('admin'), wrap(async (req, res) => {
  const id = Number(req.params.id); const c = (await db.prepare('SELECT status FROM courses WHERE id=?').get(id));
  if (!c) return bad(res, 'Không tìm thấy.', 404);
  if (c.status === 'published') return bad(res, 'Hãy gỡ khóa học trước khi xóa.', 409);
  (await db.prepare('DELETE FROM enrollments WHERE course_id=?').run(id)); (await db.prepare('DELETE FROM courses WHERE id=?').run(id)); res.json({ ok: true });
}));

// ---------------- Báo lỗi & bình luận (AD-05) ----------------
router.get('/reports', wrap(async (req, res) => {
  const st = req.query.status;
  const rows = (await db.prepare(`SELECT r.*, u.name user_name, a.name assignee_name FROM reports r JOIN users u ON u.id=r.user_id LEFT JOIN users a ON a.id=r.assignee
    ${st ? 'WHERE r.status=?' : ''} ORDER BY (r.status='closed'), r.id DESC LIMIT 200`).all(...(st ? [st] : [])));
  res.json(await Promise.all(rows.map(async (r) => { const q = (await db.prepare('SELECT stem FROM questions WHERE id=?').get(r.question_id)); return { ...r, stem: q ? C.stripMarkup(q.stem).slice(0, 80) : '' }; })));
}));
router.patch('/reports/:id', wrap(async (req, res) => {
  const r = (await db.prepare('SELECT * FROM reports WHERE id=?').get(Number(req.params.id)));
  if (!r) return bad(res, 'Không tìm thấy.', 404);
  const status = ['open', 'in_progress', 'closed'].includes(req.body?.status) ? req.body.status : r.status;
  const reply = req.body?.reply != null ? String(req.body.reply).slice(0, 1000) : r.reply;
  const assignee = status === 'open' ? r.assignee : (r.assignee || req.user.id);
  (await db.prepare('UPDATE reports SET status=?, reply=?, assignee=?, updated_at=? WHERE id=?').run(status, reply, assignee, now(), r.id));
  if (reply && reply !== r.reply) (await db.prepare('INSERT INTO notifications(user_id,text,link,created_at) VALUES(?,?,?,?)')
    .run(r.user_id, `Báo lỗi #${r.id} của bạn đã có phản hồi: ${reply.slice(0, 100)}`, '#/bao-loi', now()));
  res.json({ ok: true });
}));
router.get('/comments', wrap(async (_req, res) => {
  res.json((await db.prepare(`SELECT c.*, u.name user_name FROM comments c JOIN users u ON u.id=c.user_id ORDER BY c.id DESC LIMIT 100`).all()));
}));
router.patch('/comments/:id', wrap(async (req, res) => {
  (await db.prepare('UPDATE comments SET hidden=? WHERE id=?').run(req.body?.hidden ? 1 : 0, Number(req.params.id))); res.json({ ok: true });
}));


// ---------------- Chấm câu tự luận ----------------
// Giảng viên chấm được bài làm đề của mình, hoặc bài luyện tập có câu tự luận do mình soạn; admin/biên tập/duyệt thấy tất cả.
const teacherMayGrade = (user, a) => user.role !== 'teacher' || a.exam_owner === user.id
  || (!a.exam_id && (j(a.snapshot, {}).questions || []).some((q) => q.kind === 'essay' && q.created_by === user.id));
async function gradableAttempts(user) {
  const rows = (await db.prepare(`SELECT a.id,a.user_id,a.exam_id,a.title,a.level,a.mode,a.submitted_at,a.result,a.snapshot,u.name user_name,u.email user_email,e.created_by exam_owner
    FROM attempts a JOIN users u ON u.id=a.user_id LEFT JOIN exams e ON e.id=a.exam_id WHERE a.status='submitted' AND a.result LIKE '%"kind":"essay"%' ORDER BY a.submitted_at DESC LIMIT 500`).all());
  return rows.filter((r) => teacherMayGrade(user, r))
    .map((r) => { const x = j(r.result, {}); const essays = (x.items || []).filter((i) => i.kind === 'essay');
      return essays.length ? { id: r.id, title: r.title, level: r.level, mode: r.mode, submitted_at: r.submitted_at, user_name: r.user_name, user_email: r.user_email,
        essays: essays.length, pending: x.pending_grading || 0, score: x.score, maxScore: x.maxScore } : null; })
    .filter(Boolean);
}
async function pendingGrading(user) { return (await gradableAttempts(user || { role: 'admin' })).filter((a) => a.pending > 0); }
router.get('/grading', wrap(async (req, res) => {
  const all = (await gradableAttempts(req.user));
  res.json(req.query.status === 'all' ? all : all.filter((a) => a.pending > 0));
}));
async function loadGradable(req, res) {
  const a = (await db.prepare('SELECT a.*, e.created_by exam_owner FROM attempts a LEFT JOIN exams e ON e.id=a.exam_id WHERE a.id=?').get(Number(req.params.id)));
  if (!a || a.status !== 'submitted') { bad(res, 'Không tìm thấy bài đã nộp.', 404); return null; }
  if (!teacherMayGrade(req.user, a)) { bad(res, 'Giảng viên chỉ chấm bài làm đề / câu hỏi của mình.', 403); return null; }
  return a;
}
router.get('/grading/:id', wrap(async (req, res) => {
  const a = (await loadGradable(req, res)); if (!a) return;
  const snap = j(a.snapshot, {}); const r = j(a.result, {});
  const u = (await db.prepare('SELECT name,email FROM users WHERE id=?').get(a.user_id));
  const items = snap.questions.map((q, i) => ({ q, it: r.items[i], n: i + 1 })).filter((x) => x.it.kind === 'essay')
    .map(({ q, it, n }) => ({ n, qid: q.id, stem: q.stem, passage: q.passage, model_answer: q.model_answer, accepted: q.accepted, max: it.max, text: it.text,
      points: it.points, graded: it.graded, auto: !!it.auto, feedback: it.feedback || '' }));
  res.json({ id: a.id, title: a.title, level: a.level, submitted_at: a.submitted_at, user_name: u?.name, user_email: u?.email,
    score: r.score, maxScore: r.maxScore, passed: r.passed, pending: r.pending_grading || 0, items });
}));
router.post('/grading/:id', A.requireRole('admin', 'editor', 'teacher'), wrap(async (req, res) => {
  const a = (await loadGradable(req, res)); if (!a) return;
  const snap = j(a.snapshot, {}); const old = j(a.result, {});
  const manual = { ...(old.manual || {}) };
  const grades = req.body?.grades || {};
  for (const [qid, g] of Object.entries(grades)) {
    const q = snap.questions.find((x) => String(x.id) === String(qid));
    if (!q || q.kind !== 'essay') return bad(res, `Câu ${qid} không phải câu tự luận của bài này.`);
    const pts = Number(g.points);
    if (!Number.isFinite(pts) || pts < 0 || pts > (q.points || 1)) return bad(res, `Điểm câu #${qid} phải từ 0 đến ${q.points || 1}.`);
    manual[q.id] = { points: Math.round(pts * 10) / 10, feedback: String(g.feedback || '').slice(0, 2000), by: req.user.id, at: now() };
  }
  const result = C.scoreAttempt(snap, j(a.answers, {}), snap.scoring, manual);
  Object.assign(result, { manual, timed_out: old.timed_out, duration_s: old.duration_s, graded_at: now() });
  (await db.prepare('UPDATE attempts SET result=? WHERE id=?').run(JSON.stringify(result), a.id));
  if (result.pending_grading === 0 && (old.pending_grading || 0) > 0) (await db.prepare('INSERT INTO notifications(user_id,text,link,created_at) VALUES(?,?,?,?)')
    .run(a.user_id, `Bài “${a.title}” đã được giảng viên chấm xong: ${result.score}/${result.maxScore}.`, `#/ketqua/${a.id}`, now()));
  res.json({ ok: true, score: result.score, maxScore: result.maxScore, pending: result.pending_grading });
}));

// ---------------- Người dùng (AD-08) - chỉ quản trị viên ----------------
const ROLES_ALL = ['learner', 'teacher', 'editor', 'reviewer', 'admin'];
router.get('/users', A.requireRole('admin'), wrap(async (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const rows = (await db.prepare("SELECT id,email,name,role,locked,plan,created_at,last_login,(pass_hash<>'') AS has_password,(google_sub IS NOT NULL) AS google FROM users ORDER BY id DESC").all()).filter((u) => !q || (u.email + u.name).toLowerCase().includes(q));
  res.json(rows);
}));
router.patch('/users/:id', A.requireRole('admin'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id && (req.body?.locked || (req.body?.role && req.body.role !== 'admin'))) return bad(res, 'Không thể tự khóa hoặc hạ quyền chính mình.', 409);
  const u = (await db.prepare('SELECT * FROM users WHERE id=?').get(id));
  if (!u) return bad(res, 'Không tìm thấy.', 404);
  const role = ROLES_ALL.includes(req.body?.role) ? req.body.role : u.role;
  const plan = ['free', 'pro'].includes(req.body?.plan) ? req.body.plan : u.plan;
  const locked = req.body && 'locked' in req.body ? (req.body.locked ? 1 : 0) : u.locked;
  (await db.prepare('UPDATE users SET role=?, plan=?, locked=? WHERE id=?').run(role, plan, locked, id));
  res.json({ ok: true });
}));

// Quản trị viên tạo tài khoản (giảng viên, biên tập... hoặc học viên của trung tâm)
const Acc = require('./account');
router.post('/users', A.requireRole('admin'), wrap(async (req, res) => {
  const b = req.body || {};
  const em = String(b.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(em)) return bad(res, 'Email không hợp lệ.');
  if (await db.prepare('SELECT 1 FROM users WHERE email=?').get(em)) return bad(res, 'Email này đã có tài khoản.', 409);
  const role = ROLES_ALL.includes(b.role) ? b.role : 'learner';
  const pw = String(b.password || '');
  if (pw) { const pp = A.passwordProblem(pw, em); if (pp) return bad(res, pp); }
  const r = await db.prepare('INSERT INTO users(email,name,pass_hash,role,created_at) VALUES(?,?,?,?,?)')
    .run(em, String(b.name || '').trim().slice(0, 60) || em.split('@')[0], pw ? A.hashPassword(pw) : '', role, now());
  // Không đặt mật khẩu: tạo link (hạn 7 ngày) để người dùng tự đặt mật khẩu lần đầu
  const link = pw ? null : await Acc.makeResetLink(req, r.lastInsertRowid, 24 * 7, req.user.id);
  res.json({ id: r.lastInsertRowid, link });
}));
router.post('/users/:id/reset-link', A.requireRole('admin'), wrap(async (req, res) => {
  const u = await db.prepare('SELECT id, locked FROM users WHERE id=?').get(Number(req.params.id));
  if (!u) return bad(res, 'Không tìm thấy.', 404);
  if (u.locked) return bad(res, 'Tài khoản đang bị khóa, hãy mở khóa trước.', 409);
  res.json({ link: await Acc.makeResetLink(req, u.id, 24, req.user.id), hours: 24 });
}));
router.post('/users/:id/logout-all', A.requireRole('admin'), wrap(async (req, res) => {
  const r = await db.prepare('UPDATE users SET token_ver=token_ver+1 WHERE id=?').run(Number(req.params.id));
  if (!r.changes) return bad(res, 'Không tìm thấy.', 404);
  res.json({ ok: true });
}));

// ---------------- Kho media dùng lại được (AD-09) ----------------
const MIME = { pdf: 'application/pdf', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const Store = require('../lib/storage');
const upDir = Store.upDir;
const mediaUrl = (m) => m.url || '/uploads/' + m.path;
router.post('/media', A.requireRole(...AUTHORS), express.raw({ type: '*/*', limit: '25mb' }), wrap(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return bad(res, 'Không có dữ liệu file.');
  const name = decodeURIComponent(String(req.headers['x-filename'] || 'file')).replace(/[^\w.\-぀-ヿ一-龯 ]/g, '_').slice(0, 100);
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (!MIME[ext]) return bad(res, 'Chỉ nhận file pdf, mp3, wav, m4a, ogg, png, jpg, webp.', 415);
  const sha = crypto.createHash('sha256').update(req.body).digest('hex');
  let m = (await db.prepare('SELECT * FROM media WHERE sha256=?').get(sha));
  let reused = !!m;
  if (!m) {
    const p = `${sha.slice(0, 24)}.${ext}`;
    let url;
    try { url = await Store.save(p, req.body, MIME[ext]); } catch (e) { console.error(e.message); return bad(res, 'Không lưu được file lên kho lưu trữ. Kiểm tra cấu hình Supabase Storage.', 502); }
    const r = (await db.prepare('INSERT INTO media(sha256,filename,mime,size,path,url,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(sha256) DO NOTHING').run(sha, name, MIME[ext], req.body.length, p, url, now()));
    if (!r.lastInsertRowid) reused = true;
    m = (await db.prepare('SELECT * FROM media WHERE sha256=?').get(sha));
  }
  res.json({ id: m.id, url: mediaUrl(m), filename: m.filename, mime: m.mime, reused });
}));
// Tải thẳng lên Supabase: (1) xin URL ký sẵn, (2) trình duyệt PUT file lên đó, (3) báo hoàn tất để ghi vào kho.
// Không cấu hình Supabase thì trả mode 'server' để trình duyệt gửi file qua POST /media như cũ.
const MAX_MEDIA = 50 * 1024 * 1024;
async function mediaInfo(req, res) {
  const b = req.body || {};
  const name = String(b.filename || 'file').replace(/[^\w.\-぀-ヿ一-龯 ]/g, '_').slice(0, 100);
  const ext = (name.split('.').pop() || '').toLowerCase();
  const sha = String(b.sha256 || '').toLowerCase(); const size = Number(b.size);
  if (!MIME[ext]) { bad(res, 'Chỉ nhận file pdf, mp3, wav, m4a, ogg, png, jpg, webp.', 415); return null; }
  if (!/^[0-9a-f]{64}$/.test(sha) || !(size > 0)) { bad(res, 'Thông tin file không hợp lệ.'); return null; }
  if (size > MAX_MEDIA) { bad(res, 'File quá lớn (tối đa 50 MB).', 413); return null; }
  return { name, ext, sha, size, p: `${sha.slice(0, 24)}.${ext}` };
}
const mediaOut = (m, reused) => ({ id: m.id, url: mediaUrl(m), filename: m.filename, mime: m.mime, reused });
router.post('/media/sign', A.requireRole(...AUTHORS), wrap(async (req, res) => {
  const f = await mediaInfo(req, res); if (!f) return;
  const m = await db.prepare('SELECT * FROM media WHERE sha256=?').get(f.sha);
  if (m) return res.json({ mode: 'done', ...mediaOut(m, true) });
  if (!Store.remote) return res.json({ mode: 'server' });
  try { res.json({ mode: 'direct', upload_url: await Store.signUpload(f.p), mime: MIME[f.ext] }); }
  catch (e) { console.error(e.message); bad(res, 'Không kết nối được kho lưu trữ. Kiểm tra cấu hình Supabase Storage.', 502); }
}));
router.post('/media/commit', A.requireRole(...AUTHORS), wrap(async (req, res) => {
  const f = await mediaInfo(req, res); if (!f) return;
  if (!Store.remote) return bad(res, 'Chưa cấu hình Supabase Storage.');
  let m = await db.prepare('SELECT * FROM media WHERE sha256=?').get(f.sha);
  if (m) return res.json(mediaOut(m, true));
  const got = await Store.stat(f.p).catch(() => null);
  if (got === null) return bad(res, 'Chưa thấy file trên kho lưu trữ, hãy tải lại.', 409);
  const r = await db.prepare('INSERT INTO media(sha256,filename,mime,size,path,url,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(sha256) DO NOTHING').run(f.sha, f.name, MIME[f.ext], got || f.size, f.p, Store.publicUrl(f.p), now());
  m = await db.prepare('SELECT * FROM media WHERE sha256=?').get(f.sha);
  res.json(mediaOut(m, !r.lastInsertRowid));
}));
router.get('/media', wrap(async (_req, res) => res.json((await db.prepare('SELECT id,filename,mime,size,path,url,created_at FROM media ORDER BY id DESC LIMIT 200').all()).map((m) => ({ ...m, url: mediaUrl(m) })))));

module.exports = router;
module.exports.upDir = upDir;
