// Tính năng chuyên tiếng Nhật: thư viện ngữ pháp, chép chính tả, khóa học theo lộ trình
const express = require('express');
const { db, j } = require('../lib/db');
const A = require('../lib/auth');
const C = require('../lib/content');
const JP = require('../lib/jp');
const router = express.Router();
const now = () => Date.now();
const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ error: 'Lỗi máy chủ.' }); } };
const bad = (res, m, c = 400) => res.status(c).json({ error: m });

// ---------------- Thư viện ngữ pháp ----------------
router.get('/grammar', wrap(async (req, res) => {
  const rows = (await db.prepare('SELECT tag, level, title, meaning FROM grammar ORDER BY level DESC, seq').all());
  const qs = (await db.prepare("SELECT tags FROM questions WHERE status='published'").all()).map((r) => j(r.tags, {}).grammar || []);
  const stats = req.user ? (await C.tagStats(req.user.id)).gram : {};
  const { level, q } = req.query;
  let out = rows.map((g) => ({ ...g, questions: qs.filter((t) => t.includes(g.tag)).length, mine: stats[g.tag] || null }));
  if (level) out = out.filter((g) => g.level === level);
  if (q) { const n = C.normalize(q); out = out.filter((g) => C.normalize(g.tag + ' ' + g.title + ' ' + g.meaning).includes(n) || (g.tag + g.title).includes(q)); }
  res.json(out);
}));
router.get('/grammar/item', wrap(async (req, res) => {
  const g = (await db.prepare('SELECT * FROM grammar WHERE tag=?').get(String(req.query.tag || '')));
  if (!g) return bad(res, 'Không tìm thấy mẫu ngữ pháp.', 404);
  const lessons = (await C.lessonsForTags([g.tag]));
  const nq = (await db.prepare("SELECT tags FROM questions WHERE status='published'").all()).filter((r) => (j(r.tags, {}).grammar || []).includes(g.tag)).length;
  const mine = req.user ? ((await C.tagStats(req.user.id)).gram[g.tag] || null) : null;
  res.json({ ...g, examples: j(g.examples, []), lessons, question_count: nq, mine });
}));

// ---------------- Chép chính tả (nghe → gõ lại) ----------------
router.get('/dictation/sets', wrap(async (req, res) => {
  const ls = (await db.prepare("SELECT id,title,level,situation,dialogue FROM lessons WHERE status='published' ORDER BY level DESC, id").all());
  const prog = {};
  if (req.user) for (const r of (await db.prepare('SELECT lesson_id, COUNT(DISTINCT line) n FROM dictation_log WHERE user_id=? AND ok=1 GROUP BY lesson_id').all(req.user.id))) prog[r.lesson_id] = r.n;
  res.json(ls.map((l) => ({ id: l.id, title: l.title, level: l.level, situation: l.situation, lines: j(l.dialogue, []).length, done: prog[l.id] || 0 })));
}));
router.get('/dictation/sets/:id', wrap(async (req, res) => {
  const l = (await db.prepare("SELECT * FROM lessons WHERE id=? AND status='published'").get(Number(req.params.id)));
  if (!l) return bad(res, 'Không tìm thấy bài.', 404);
  const done = new Set(req.user ? (await db.prepare('SELECT DISTINCT line FROM dictation_log WHERE user_id=? AND lesson_id=? AND ok=1').all(req.user.id, l.id)).map((r) => r.line) : []);
  // Văn bản đọc (TTS) buộc phải gửi để trình duyệt phát âm; đây là bài luyện tập, không phải thi nên chấp nhận.
  res.json({ id: l.id, title: l.title, level: l.level, lines: j(l.dialogue, []).map((d, i) => ({ i, role: d.role, tts: JP.surfaceOf(d.ja), done: done.has(i) })) });
}));
router.post('/dictation/check', A.requireUser, wrap(async (req, res) => {
  const { lesson_id, line, answer } = req.body || {};
  const l = (await db.prepare("SELECT dialogue FROM lessons WHERE id=? AND status='published'").get(Number(lesson_id)));
  const d = l && j(l.dialogue, [])[Number(line)];
  if (!d) return bad(res, 'Không tìm thấy câu.', 404);
  if (!String(answer || '').trim()) return bad(res, 'Hãy gõ những gì bạn nghe được.');
  const r = JP.checkDictation(d.ja, String(answer).slice(0, 300));
  (await db.prepare('INSERT INTO dictation_log(user_id,lesson_id,line,ok,ratio,at) VALUES(?,?,?,?,?,?)').run(req.user.id, Number(lesson_id), Number(line), r.ok || r.close ? 1 : 0, r.ratio, now()));
  res.json({ ...r, vi: d.vi });
}));

// ---------------- Khóa học theo lộ trình ----------------
async function stepDone(userId, st) {
  if (st.type === 'exam') { const e = (await db.prepare('SELECT id FROM exams WHERE title=?').get(st.ref)); return !!e && !!(await db.prepare("SELECT 1 FROM attempts WHERE user_id=? AND exam_id=? AND status='submitted'").get(userId, e.id)); }
  if (st.type === 'lesson') { const l = (await db.prepare('SELECT id FROM lessons WHERE title=?').get(st.ref)); return !!l && !!(await db.prepare('SELECT 1 FROM lesson_progress WHERE user_id=? AND lesson_id=?').get(userId, l.id)); }
  if (st.type === 'grammar') return !!(await db.prepare("SELECT 1 FROM attempts WHERE user_id=? AND status='submitted' AND kind='practice' AND title ILIKE ?").get(userId, `%${st.ref}%`));
  if (st.type === 'practice') return !!(await db.prepare("SELECT 1 FROM attempts WHERE user_id=? AND status='submitted' AND kind='practice' AND level=? AND title ILIKE ?").get(userId, st.level || '', `%${st.section ? C.SECTIONS[st.section] : 'Tất cả phần'}%`));
  if (st.type === 'dictation') { const l = (await db.prepare('SELECT id,dialogue FROM lessons WHERE title=?').get(st.ref)); if (!l) return false; const n = (await db.prepare('SELECT COUNT(DISTINCT line) n FROM dictation_log WHERE user_id=? AND lesson_id=? AND ok=1').get(userId, l.id)).n; return n >= Math.ceil(j(l.dialogue, []).length / 2); }
  if (st.type === 'cards') return (await db.prepare('SELECT COUNT(*) n FROM cards WHERE user_id=?').get(userId)).n >= (st.count || 5);
  return false;
}
async function stepLink(st) {
  if (st.type === 'exam') { const e = (await db.prepare('SELECT id FROM exams WHERE title=?').get(st.ref)); return e ? `#/de/${e.id}` : ''; }
  if (st.type === 'lesson') { const l = (await db.prepare('SELECT id FROM lessons WHERE title=?').get(st.ref)); return l ? `#/doi-song/${l.id}` : ''; }
  if (st.type === 'grammar') return `#/ngu-phap/${encodeURIComponent(st.ref)}`;
  if (st.type === 'practice') return `#/luyen?level=${st.level || ''}${st.section ? '&section=' + st.section : ''}`;
  if (st.type === 'dictation') { const l = (await db.prepare('SELECT id FROM lessons WHERE title=?').get(st.ref)); return l ? `#/chep-chinh-ta/${l.id}` : ''; }
  if (st.type === 'cards') return '#/the';
  return '';
}
async function courseView(c, user) {
  const steps = j(c.steps, []);
  const enr = user ? (await db.prepare('SELECT * FROM enrollments WHERE user_id=? AND course_id=?').get(user.id, c.id)) : null;
  const out = await Promise.all(steps.map(async (st, i) => ({ ...st, i, link: (await stepLink(st)), done: user ? (await stepDone(user.id, st)) : false })));
  const doneN = out.filter((s) => s.done).length;
  const next = out.find((s) => !s.done) || null;
  let dayNo = null, expectedWeek = null;
  if (enr) { dayNo = Math.floor((now() - enr.started_at) / 864e5) + 1; expectedWeek = Math.min(c.weeks, Math.floor((dayNo - 1) / 7) + 1); }
  return { id: c.id, title: c.title, level: c.level, goal: c.goal, description: c.description, weeks: c.weeks, enrolled: !!enr, started_at: enr?.started_at || null,
    day: dayNo, expectedWeek, total: out.length, done: doneN, next, behind: !!(next && expectedWeek && next.week < expectedWeek), steps: out };
}
router.get('/courses', wrap(async (req, res) => {
  res.json(await Promise.all((await db.prepare("SELECT * FROM courses WHERE status='published' ORDER BY level DESC, id").all()).map(async (c) => { const v = (await courseView(c, req.user)); delete v.steps; return v; })));
}));
router.get('/courses/:id', wrap(async (req, res) => {
  const c = (await db.prepare("SELECT * FROM courses WHERE id=? AND status='published'").get(Number(req.params.id)));
  if (!c) return bad(res, 'Không tìm thấy khóa học.', 404);
  res.json((await courseView(c, req.user)));
}));
router.post('/courses/:id/enroll', A.requireUser, wrap(async (req, res) => {
  const c = (await db.prepare("SELECT id FROM courses WHERE id=? AND status='published'").get(Number(req.params.id)));
  if (!c) return bad(res, 'Không tìm thấy khóa học.', 404);
  (await db.prepare('INSERT INTO enrollments(user_id,course_id,started_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(req.user.id, c.id, now()));
  res.json({ ok: true });
}));
router.delete('/courses/:id/enroll', A.requireUser, wrap(async (req, res) => { (await db.prepare('DELETE FROM enrollments WHERE user_id=? AND course_id=?').run(req.user.id, Number(req.params.id))); res.json({ ok: true }); }));

module.exports = router;
module.exports.courseView = courseView;
