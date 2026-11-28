const express = require('express');
const { db, j, tx } = require('../lib/db');
const A = require('../lib/auth');
const C = require('../lib/content');
const router = express.Router();
// hoán vị cố định theo (bài, câu) để GET và chấm điểm dùng cùng một thứ tự
function lessonPerm(lessonId, qi, n) {
  let x = (lessonId * 7919 + qi * 104729 + 12345) >>> 0; const rnd = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
  const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; }
  return a;
}
const now = () => Date.now();
const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ error: 'Lỗi máy chủ.' }); } };
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// ---------------- Tài khoản (FR-01, FR-02, FR-09) ----------------
const { userOut } = require('./account');
router.get('/me', (req, res) => res.json(req.user ? userOut(req.user) : null));
router.patch('/me', A.requireUser, wrap(async (req, res) => {
  const { name, goal, settings } = req.body || {};
  const u = req.user;
  if (name) (await db.prepare('UPDATE users SET name=? WHERE id=?').run(String(name).slice(0, 60), u.id));
  if (goal) {
    const g = { type: ['exam', 'life', 'both'].includes(goal.type) ? goal.type : 'exam',
      level: /^N[1-5]$/.test(goal.level) ? goal.level : 'N5', deadline: /^\d{4}-\d{2}-\d{2}$/.test(goal.deadline || '') ? goal.deadline : '' };
    (await db.prepare('UPDATE users SET goal=? WHERE id=?').run(JSON.stringify(g), u.id));
  }
  if (settings) {
    const s = { ...j(u.settings, {}), ...['furigana', 'translation', 'fontSize'].reduce((o, k) => (k in settings ? { ...o, [k]: settings[k] } : o), {}) };
    (await db.prepare('UPDATE users SET settings=? WHERE id=?').run(JSON.stringify(s), u.id));
  }
  res.json(userOut((await db.prepare('SELECT * FROM users WHERE id=?').get(u.id))));
}));
router.delete('/me', A.requireUser, wrap(async (req, res) => {   // quyền riêng tư: xóa tài khoản và dữ liệu
  const id = req.user.id;
  if (req.user.role !== 'learner') return bad(res, 'Tài khoản nội bộ cần quản trị viên xóa.', 403);
  await tx(async () => { for (const t of ['attempts', 'lesson_progress', 'cards', 'comments', 'notifications', 'reports', 'password_resets', 'class_members']) (await db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(id)); (await db.prepare('DELETE FROM users WHERE id=?').run(id)); });
  A.clearCookie(res); res.json({ ok: true });
}));

// ---------------- Kho đề (FR-03, FR-04) ----------------
const examOut = (e) => {
  const secs = j(e.sections, []);
  const qids = secs.flatMap((s) => s.question_ids);
  return { id: e.id, title: e.title, exam_type: e.exam_type, exam_kind: e.exam_kind || 'jlpt', difficulty: e.difficulty || 0, level: e.level, duration_min: e.duration_min, description: e.description,
    sections: secs.map((s) => ({ key: s.key, name: s.name, count: s.question_ids.length })), question_count: qids.length, doc: !!e.doc_url };
};
router.get('/exams', wrap(async (req, res) => {
  const { exam_type, exam_kind, difficulty, level, section, q } = req.query;
  let rows = (await db.prepare("SELECT * FROM exams WHERE status='published' ORDER BY level DESC, id").all()).map(examOut);
  if (exam_type) rows = rows.filter((e) => e.exam_type === exam_type);
  if (exam_kind) rows = rows.filter((e) => e.exam_kind === exam_kind);
  if (difficulty) rows = rows.filter((e) => e.difficulty === Number(difficulty));
  if (level) rows = rows.filter((e) => e.level === level);
  if (section) rows = rows.filter((e) => e.sections.some((s) => s.key === section));
  if (q) { const n = C.normalize(q); rows = rows.filter((e) => C.normalize(e.title + ' ' + e.description).includes(n)); }
  res.json(rows);
}));
router.get('/search', wrap(async (req, res) => {
  const q = C.normalize(req.query.q || '').trim();
  if (!q) return res.json({ exams: [], lessons: [] });
  const exams = (await db.prepare("SELECT * FROM exams WHERE status='published'").all()).map(examOut)
    .filter((e) => C.normalize(e.title + ' ' + e.description + ' ' + e.level).includes(q));
  const lessons = (await db.prepare("SELECT * FROM lessons WHERE status='published'").all()).filter((l) => {
    const hay = [l.title, l.situation, l.summary, ...j(l.vocab, []).flatMap((v) => [v.ja, v.reading, v.vi]),
      ...j(l.dialogue, []).flatMap((d) => [C.stripMarkup(d.ja), d.vi]), ...j(l.phrases, []).flatMap((p) => [C.stripMarkup(p.ja), p.vi])].join(' ');
    return C.normalize(hay).includes(q) || hay.includes(req.query.q);
  }).map((l) => ({ id: l.id, title: l.title, level: l.level, situation: l.situation, summary: l.summary }));
  const qs = (await db.prepare("SELECT id,level,section,stem FROM questions WHERE status='published' AND is_sheet=0").all())
    .filter((x) => C.normalize(C.stripMarkup(x.stem)).includes(q) || C.stripMarkup(x.stem).includes(req.query.q)).slice(0, 10)
    .map((x) => ({ id: x.id, level: x.level, section: x.section, stem: C.stripMarkup(x.stem).slice(0, 80) }));
  res.json({ exams, lessons, questions: qs });
}));
router.get('/practice/options', wrap(async (req, res) => {
  const rows = (await db.prepare("SELECT catalog, level, section, qtype, difficulty, COUNT(*) n FROM questions WHERE status='published' AND is_sheet=0 GROUP BY catalog, level, section, qtype, difficulty").all());
  res.json(rows);
}));

// ---------------- Làm bài (FR-05..FR-10) ----------------
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
// Xáo thứ tự đáp án mỗi lần bắt đầu bài (đáp án đúng được ánh xạ lại), bản chụp lưu thứ tự đã xáo
function shuffleOptions(q) {
  const perm = shuffle(q.options.map((_, i) => i));
  return { ...q, options: perm.map((i) => q.options[i]), answer: perm.indexOf(q.answer) };
}
async function loadQuestions(ids) {
  if (!ids.length) return [];
  const rows = new Map((await db.prepare("SELECT * FROM questions WHERE id = ANY(?) AND status='published'").all(ids)).map((r) => [r.id, r]));
  return ids.filter((id) => rows.has(id)).map((id) => { const q = C.rowToQuestion(rows.get(id)); return rows.get(id).is_sheet ? q : shuffleOptions(q); });   // giữ thứ tự trong đề; câu phiếu trả lời giữ nguyên A-B-C-D
}
// Bài giao có "hiện đáp án sau hạn nộp": trả về thời điểm được xem đáp án (null nếu xem được ngay)
async function answersLockedUntil(a) {
  if (!a.assignment_id) return null;
  const s = await db.prepare('SELECT due_at, show_answers FROM assignments WHERE id=?').get(a.assignment_id);
  return s && s.show_answers === 'after_due' && s.due_at && s.due_at > now() ? s.due_at : null;
}
async function attemptView(a, { reveal = false } = {}) {
  const snap = j(a.snapshot, {});
  const answers = j(a.answers, {});
  const lockedUntil = await answersLockedUntil(a);
  const base = { id: a.id, kind: a.kind, mode: a.mode, title: a.title, level: a.level, status: a.status, exam_id: a.exam_id,
    started_at: a.started_at, deadline: a.deadline, submitted_at: a.submitted_at, server_now: now(), leaves: a.leaves,
    sections: snap.sections || [], answers, plays: j(a.plays, {}), play_limit: a.mode === 'real' ? 1 : 0, assignment_id: a.assignment_id || null, answers_locked_until: lockedUntil, doc_url: snap.doc_url || '' };
  if (a.status === 'submitted' && lockedUntil && !reveal) {   // chỉ cho xem điểm, chưa cho xem đáp án
    const r = j(a.result, null);
    base.questions = snap.questions.map(C.publicQuestion);
    base.result = r && { ...r, items: (r.items || []).map((it) => ({ kind: it.kind, answered: it.answered, chosen: it.chosen, graded: it.graded })) };
    base.recommend = [];
    return base;
  }
  if (a.status === 'submitted' || reveal) {
    base.questions = snap.questions.map((q) => ({ ...C.publicQuestion(q), tts: q.audio_script, answer: q.answer, explanation: q.explanation, tags: q.tags, audio_script: q.audio_script,
      ...(q.kind === 'essay' ? { model_answer: q.model_answer, accepted: q.accepted } : {}) }));
    base.result = j(a.result, null);
    base.recommend = a.status === 'submitted' ? (await C.recommend(a.user_id, a.level)) : [];
    const ex = a.exam_id ? (await db.prepare('SELECT title, exam_type FROM exams WHERE id=?').get(a.exam_id)) : null;
    base.exam_title = ex?.title || null; base.exam_type = ex?.exam_type || null;
    const qids = base.questions.map((q) => q.id);
    const cc = new Map((await db.prepare('SELECT question_id, COUNT(*) n FROM comments WHERE question_id = ANY(?) AND hidden=0 GROUP BY question_id').all(qids)).map((r) => [r.question_id, r.n]));
    const lessons = await C.publishedLessons();
    for (const q of base.questions) {
      q.lessons = C.lessonsForTags(q.tags.grammar || [], lessons).slice(0, 3);   // FR-18: dùng ngoài đời ở đâu
      q.comment_count = cc.get(q.id) || 0;
    }
  } else {
    base.questions = snap.questions.map(C.publicQuestion);
  }
  return base;
}
const ownAttempt = async (req, res) => {
  const a = (await db.prepare('SELECT * FROM attempts WHERE id=? AND user_id=?').get(Number(req.params.id), req.user.id));
  if (!a) { bad(res, 'Không tìm thấy bài làm.', 404); return null; }
  return a;
};

router.post('/attempts', A.requireUser, wrap(async (req, res) => {
  let { exam_id, mode, practice } = req.body || {};
  let questions, title, level, deadline = null, scoring = null, examVersion = null, sections = [], assignment = null, docUrl = '';
  if (req.body?.assignment_id) {   // bài giảng viên giao cho lớp
    assignment = await db.prepare('SELECT s.* FROM assignments s JOIN class_members m ON m.class_id=s.class_id JOIN classes c ON c.id=s.class_id WHERE s.id=? AND m.user_id=? AND c.archived=0').get(Number(req.body.assignment_id), req.user.id);
    if (!assignment) return bad(res, 'Không tìm thấy bài được giao.', 404);
    const open_ = await db.prepare("SELECT id FROM attempts WHERE assignment_id=? AND user_id=? AND status='in_progress'").get(assignment.id, req.user.id);
    if (open_) return res.json(await attemptView(await db.prepare('SELECT * FROM attempts WHERE id=?').get(open_.id)));   // đang làm dở thì mở lại
    if (assignment.due_at && assignment.due_at < now() && !assignment.allow_late) return bad(res, 'Đã hết hạn nộp bài này.', 403);
    const tries = (await db.prepare("SELECT COUNT(*) n FROM attempts WHERE assignment_id=? AND user_id=? AND status='submitted'").get(assignment.id, req.user.id)).n;
    if (assignment.max_attempts && tries >= assignment.max_attempts) return bad(res, `Bạn đã dùng hết ${assignment.max_attempts} lượt làm bài này.`, 403);
    exam_id = assignment.exam_id; mode = assignment.mode; delete req.body.sections;
  }
  if (exam_id) {
    const e = (await db.prepare("SELECT * FROM exams WHERE id=? AND status='published'").get(Number(exam_id)));
    if (!e) return bad(res, 'Không tìm thấy đề.', 404);
    const secs = j(e.sections, []);
    const only = Array.isArray(req.body.sections) && req.body.sections.length ? req.body.sections : null;  // FR-06 làm theo phần
    const useSecs = only ? secs.filter((s) => only.includes(s.key)) : secs;
    questions = []; sections = [];
    for (const s of useSecs) {
      const qs = (await loadQuestions(s.question_ids));
      sections.push({ key: s.key, name: s.name, from: questions.length, count: qs.length });
      questions.push(...qs);
    }
    title = (assignment ? assignment.title : e.title) + (only ? ' (theo phần)' : ''); level = e.level; scoring = JSON.parse(e.scoring); examVersion = e.version; docUrl = e.doc_url || '';
    if (mode === 'real') { if (only) return bad(res, 'Chế độ thi thật phải làm trọn bộ đề.'); deadline = now() + e.duration_min * 60e3; }
  } else if (practice && practice.retry) {   // làm lại các câu sai của một bài đã nộp
    const src = await db.prepare("SELECT * FROM attempts WHERE id=? AND user_id=? AND status='submitted'").get(Number(practice.retry), req.user.id);
    if (!src) return bad(res, 'Không tìm thấy bài làm.', 404);
    if (await answersLockedUntil(src)) return bad(res, 'Giảng viên chọn chỉ hiện đáp án sau hạn nộp, hãy đợi hết hạn.', 403);
    const sq = j(src.snapshot, {}).questions || [], items = j(src.result, {}).items || [];
    const ids = sq.filter((q, i) => !items[i]?.ok && q.kind !== 'essay').map((q) => q.id);
    if (!ids.length) return bad(res, 'Bài này không có câu trắc nghiệm nào làm sai.', 404);
    questions = await loadQuestions(ids);
    title = 'Làm lại câu sai: ' + src.title.replace(/^Làm lại câu sai: /, ''); level = src.level || '';
  } else if (practice) {
    const { level: lv, section, qtype, count, grammar, difficulty, catalog } = practice;
    const where = ["status='published'", 'is_sheet=0'], args = [];
    if (lv) { where.push('level=?'); args.push(lv); }
    if (section) { where.push('section=?'); args.push(section); }
    if (qtype) { where.push('qtype=?'); args.push(qtype); }
    if (Number(difficulty)) { where.push('difficulty=?'); args.push(Number(difficulty)); }
    if (C.EXAM_KINDS[catalog]) { where.push('catalog=?'); args.push(catalog); }
    let rows = (await db.prepare(`SELECT * FROM questions WHERE ${where.join(' AND ')}`).all(...args));
    if (grammar) rows = rows.filter((r) => (j(r.tags, {}).grammar || []).includes(grammar));
    if (!rows.length) return bad(res, 'Chưa có câu hỏi phù hợp với lựa chọn của bạn.', 404);
    questions = shuffle(rows).slice(0, Math.min(Math.max(Number(count) || 10, 1), 50)).map((r) => shuffleOptions(C.rowToQuestion(r)));
    title = `Luyện tập: ${[C.EXAM_KINDS[catalog], lv, Number(difficulty) ? C.DIFFS[Number(difficulty)] : '', section ? C.SECTIONS[section] : (grammar ? '' : 'Tất cả phần'), qtype, grammar].filter(Boolean).join(' · ')}`; level = lv || '';
  } else return bad(res, 'Thiếu thông tin đề.');
  if (!questions.length) return bad(res, 'Đề chưa có câu hỏi đã duyệt.', 409);
  const kind = exam_id ? 'exam' : 'practice';
  const m = mode === 'real' && exam_id ? 'real' : 'practice';
  const r = (await db.prepare(`INSERT INTO attempts(user_id,kind,exam_id,exam_version,mode,title,level,snapshot,started_at,deadline,assignment_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, kind, exam_id || null, examVersion, m, title, level,
    JSON.stringify({ questions, sections, scoring, ...(docUrl ? { doc_url: docUrl } : {}) }), now(), deadline, assignment?.id || null));
  res.json((await attemptView((await db.prepare('SELECT * FROM attempts WHERE id=?').get(r.lastInsertRowid)))));
}));

router.get('/attempts', A.requireUser, wrap(async (req, res) => {
  const rows = (await db.prepare('SELECT id,kind,exam_id,mode,title,level,started_at,submitted_at,status,result,deadline FROM attempts WHERE user_id=? ORDER BY started_at DESC LIMIT 100').all(req.user.id));
  res.json(rows.map((r) => { const rs = j(r.result, null);
    return { id: r.id, kind: r.kind, exam_id: r.exam_id, mode: r.mode, title: r.title, level: r.level, started_at: r.started_at,
      submitted_at: r.submitted_at, status: r.status, deadline: r.deadline,
      score: rs?.score ?? null, maxScore: rs?.maxScore ?? null, passed: rs?.passed ?? null, correct: rs?.correct ?? null, total: rs?.total ?? null, pending_grading: rs?.pending_grading || 0 }; }));
}));
router.get('/attempts/:id', A.requireUser, wrap(async (req, res) => {
  let a = await db.prepare('SELECT * FROM attempts WHERE id=?').get(Number(req.params.id));
  if (a && a.user_id !== req.user.id) {   // giảng viên xem bài học viên nộp cho lớp của mình
    const ok = a.status === 'submitted' && a.assignment_id && ['teacher', 'admin'].includes(req.user.role) &&
      await db.prepare('SELECT 1 FROM assignments s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND (c.teacher_id=? OR ?)').get(a.assignment_id, req.user.id, req.user.role === 'admin');
    if (!ok) a = null;
    else { const u = await db.prepare('SELECT name,email FROM users WHERE id=?').get(a.user_id); return res.json({ ...(await attemptView(a, { reveal: true })), review_of: u, answers_locked_until: null }); }
  }
  if (!a) return bad(res, 'Không tìm thấy bài làm.', 404);
  res.json((await attemptView(a)));
}));
router.put('/attempts/:id/answers', A.requireUser, wrap(async (req, res) => {   // tự lưu mỗi lần chọn đáp án
  const a = (await ownAttempt(req, res)); if (!a) return;
  if (a.status !== 'in_progress') return bad(res, 'Bài đã nộp.', 409);
  if (a.deadline && now() > a.deadline + 5000) return bad(res, 'Đã hết giờ.', 409);
  const snap = j(a.snapshot, {});
  const answers = j(a.answers, {});
  const upd = req.body?.answers || {};
  for (const [qid, v] of Object.entries(upd)) {
    const q = snap.questions.find((x) => String(x.id) === String(qid)); if (!q) continue;
    const cur = (answers[qid] ||= {});
    if ('c' in v && q.kind !== 'essay') cur.c = v.c === null ? null : (Number.isInteger(v.c) && v.c >= 0 && v.c < q.options.length ? v.c : cur.c);
    if ('t' in v && q.kind === 'essay') cur.t = C.clipLen(String(v.t ?? '').slice(0, 5000), q.max_len, C.lenUnit(q.etype));   // bài viết tự luận, cắt theo giới hạn chữ
    if ('flag' in v) cur.flag = !!v.flag;
  }
  const leaves = Number.isInteger(req.body?.leaves) ? Math.max(a.leaves, Math.min(req.body.leaves, 999)) : a.leaves;
  (await db.prepare('UPDATE attempts SET answers=?, leaves=? WHERE id=?').run(JSON.stringify(answers), leaves, a.id));
  res.json({ ok: true, saved_at: now() });
}));
router.post('/attempts/:id/play', A.requireUser, wrap(async (req, res) => {  // giới hạn một lần nghe ở chế độ thi thật
  const a = (await ownAttempt(req, res)); if (!a) return;
  const qid = String(req.body?.qid);
  const plays = j(a.plays, {});
  const limit = a.mode === 'real' ? 1 : 0;
  if (limit && (plays[qid] || 0) >= limit) return bad(res, 'Chế độ thi thật chỉ cho nghe một lần.', 403);
  plays[qid] = (plays[qid] || 0) + 1;
  (await db.prepare('UPDATE attempts SET plays=? WHERE id=?').run(JSON.stringify(plays), a.id));
  res.json({ ok: true, plays: plays[qid] });
}));
router.post('/attempts/:id/check', A.requireUser, wrap(async (req, res) => {  // chỉ chế độ luyện tập: xem đáp án từng câu
  const a = (await ownAttempt(req, res)); if (!a) return;
  if (a.mode !== 'practice') return bad(res, 'Chế độ thi thật không cho xem đáp án trước khi nộp.', 403);
  if (await answersLockedUntil(a)) return bad(res, 'Giảng viên chọn chỉ hiện đáp án sau hạn nộp.', 403);
  const q = j(a.snapshot, {}).questions.find((x) => x.id === Number(req.body?.qid));
  if (!q) return bad(res, 'Không tìm thấy câu hỏi.', 404);
  if (q.kind === 'essay') {
    const text = j(a.answers, {})[q.id]?.t || '';
    const auto = C.autoGradeEssay(q, text);
    return res.json({ kind: 'essay', model_answer: q.model_answer, explanation: q.explanation, audio_script: q.audio_script, points: q.points, auto_ok: (q.accepted || []).length ? auto !== null : null });
  }
  res.json({ answer: q.answer, explanation: q.explanation, audio_script: q.audio_script });
}));
router.post('/attempts/:id/submit', A.requireUser, wrap(async (req, res) => {
  const a = (await ownAttempt(req, res)); if (!a) return;
  if (a.status === 'submitted') return res.json((await attemptView(a)));
  const snap = j(a.snapshot, {});
  const result = C.scoreAttempt(snap, j(a.answers, {}), snap.scoring);
  result.timed_out = !!(a.deadline && now() > a.deadline);
  result.duration_s = Math.round((now() - a.started_at) / 1000);
  (await db.prepare("UPDATE attempts SET status='submitted', submitted_at=?, result=? WHERE id=?").run(now(), JSON.stringify(result), a.id));
  res.json((await attemptView((await db.prepare('SELECT * FROM attempts WHERE id=?').get(a.id)))));
}));
router.delete('/attempts/:id', A.requireUser, wrap(async (req, res) => {
  const a = (await ownAttempt(req, res)); if (!a) return;
  (await db.prepare('DELETE FROM attempts WHERE id=?').run(a.id)); res.json({ ok: true });
}));

// ---------------- Thống kê, lộ trình (FR-13, FR-14, FR-22) ----------------
router.get('/stats', A.requireUser, wrap(async (req, res) => {
  const st = (await C.tagStats(req.user.id));
  const rate = (o) => Object.entries(o).map(([k, v]) => ({ key: k, ...v, rate: v.total ? v.correct / v.total : 0 })).sort((a, b) => a.rate - b.rate);
  const hist = (await db.prepare("SELECT id,title,level,submitted_at,result FROM attempts WHERE user_id=? AND status='submitted' AND kind='exam' ORDER BY submitted_at").all(req.user.id))
    .map((r) => { const x = j(r.result, {}); return { id: r.id, title: r.title, level: r.level, at: r.submitted_at, pct: x.total ? Math.round((100 * x.correct) / x.total) : 0, score: x.score, maxScore: x.maxScore, passed: x.passed }; });
  const goal = j(req.user.goal, {});
  res.json({ sections: rate(st.sec), grammar: rate(st.gram), qtypes: rate(st.qt), kanji: rate(st.kanji), history: hist,
    recommend: (await C.recommend(req.user.id, goal.level || '')) });
}));
router.get('/dashboard', A.requireUser, wrap(async (req, res) => {
  const goal = j(req.user.goal, {});
  const days = new Set();
  const ds = (t) => new Date(t + 7 * 3600e3).toISOString().slice(0, 10);   // ngày theo giờ Việt Nam
  for (const r of (await db.prepare("SELECT submitted_at t FROM attempts WHERE user_id=? AND status='submitted'").all(req.user.id))) days.add(ds(r.t));
  for (const r of (await db.prepare('SELECT at t FROM lesson_progress WHERE user_id=?').all(req.user.id))) days.add(ds(r.t));
  for (const r of (await db.prepare('SELECT at t FROM dictation_log WHERE user_id=?').all(req.user.id))) days.add(ds(r.t));
  let streak = 0; const d = new Date(Date.now() + 7 * 3600e3);
  if (!days.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setUTCDate(d.getUTCDate() - 1); }
  const doneToday = days.has(ds(now()));
  const inProgress = (await db.prepare("SELECT id,title,mode,started_at,kind FROM attempts WHERE user_id=? AND status='in_progress' ORDER BY started_at DESC LIMIT 3").all(req.user.id));
  const dueCards = (await db.prepare('SELECT COUNT(*) n FROM cards WHERE user_id=? AND due<=?').get(req.user.id, now())).n;
  const lv = goal.level || 'N5';
  const doneL = new Set((await db.prepare('SELECT lesson_id FROM lesson_progress WHERE user_id=?').all(req.user.id)).map((r) => r.lesson_id));
  const doneE = new Set((await db.prepare("SELECT exam_id FROM attempts WHERE user_id=? AND status='submitted' AND exam_id IS NOT NULL").all(req.user.id)).map((r) => r.exam_id));
  const wantExam = goal.type !== 'life', wantLife = goal.type !== 'exam';
  const exams = wantExam ? (await db.prepare("SELECT * FROM exams WHERE status='published' AND level=? ORDER BY id").all(lv)).map(examOut) : [];
  const lessons = wantLife ? (await db.prepare("SELECT id,title,level,situation,summary FROM lessons WHERE status='published' ORDER BY (level=?) DESC, level DESC, id").all(lv)) : [];
  let daysLeft = null;
  if (goal.deadline) daysLeft = Math.ceil((new Date(goal.deadline + 'T00:00:00+07:00') - Date.now()) / 864e5);
  const plan = [];
  const nextExam = exams.find((e) => !doneE.has(e.id)); const nextLesson = lessons.find((l) => !doneL.has(l.id));
  const weak = (await C.recommend(req.user.id, lv));
  const enr = (await db.prepare('SELECT c.* FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=? ORDER BY e.started_at DESC LIMIT 1').get(req.user.id));
  let course = null;
  if (enr) { const v = (await require('./extra').courseView(enr, req.user)); course = { id: v.id, title: v.title, done: v.done, total: v.total, behind: v.behind, day: v.day };
    if (v.next) plan.unshift({ type: 'course', id: v.id, link: v.next.link, text: `Khóa “${v.title}”: ${v.next.title}` }); }
  if (wantExam && nextExam) plan.push({ type: 'exam', id: nextExam.id, text: `Làm đề: ${nextExam.title}` });
  if (wantLife && nextLesson) plan.push({ type: 'lesson', id: nextLesson.id, text: `Học bài tình huống: ${nextLesson.title}` });
  for (const w of weak.slice(0, 2)) plan.push(w);
  if (dueCards) plan.push({ type: 'cards', text: `Ôn ${dueCards} thẻ đến hạn` });
  res.json({ goal, course, streak, doneToday, inProgress, dueCards, daysLeft, plan, doneExams: doneE.size, doneLessons: doneL.size,
    notifications: (await db.prepare('SELECT * FROM notifications WHERE user_id=? AND read=0 ORDER BY id DESC LIMIT 10').all(req.user.id)) });
}));
router.post('/notifications/read', A.requireUser, wrap(async (req, res) => { (await db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(req.user.id)); res.json({ ok: true }); }));

// ---------------- Nhánh Đời sống (FR-15, FR-16, FR-17) ----------------
router.get('/lessons', wrap(async (req, res) => {
  const { level, q } = req.query;
  let rows = (await db.prepare("SELECT * FROM lessons WHERE status='published' ORDER BY id").all());
  if (level) rows = rows.filter((l) => l.level === level);
  if (q) { const n = C.normalize(q); rows = rows.filter((l) => C.normalize(l.title + ' ' + l.situation + ' ' + l.summary).includes(n)); }
  const done = req.user ? new Map((await db.prepare('SELECT * FROM lesson_progress WHERE user_id=?').all(req.user.id)).map((r) => [r.lesson_id, r])) : new Map();
  res.json(rows.map((l) => ({ id: l.id, title: l.title, situation: l.situation, level: l.level, summary: l.summary,
    has_doc: j(l.doc, null) !== null, progress: done.get(l.id) ? { score: done.get(l.id).score, total: done.get(l.id).total } : null })));
}));
router.get('/lessons/:id', wrap(async (req, res) => {
  const l = (await db.prepare("SELECT * FROM lessons WHERE id=? AND status='published'").get(Number(req.params.id)));
  if (!l) return bad(res, 'Không tìm thấy bài học.', 404);
  const quiz = j(l.quiz, []);
  const related = (await db.prepare("SELECT q.id, q.level, q.section, q.stem, q.tags FROM questions q WHERE q.status='published' AND q.is_sheet=0").all())
    .filter((q) => (j(q.tags, {}).grammar || []).some((g) => j(l.grammar_tags, []).includes(g))).slice(0, 4)
    .map((q) => ({ id: q.id, level: q.level, section: q.section, stem: C.stripMarkup(q.stem).slice(0, 70) }));
  res.json({ id: l.id, title: l.title, situation: l.situation, level: l.level, summary: l.summary, dialogue: j(l.dialogue, []), vocab: j(l.vocab, []),
    phrases: j(l.phrases, []), doc: j(l.doc, null), culture: l.culture, grammar_tags: j(l.grammar_tags, []), related_questions: related,
    quiz: quiz.map((x, i) => ({ stem: x.stem, options: lessonPerm(l.id, i, x.options.length).map((k) => x.options[k]) })) });   // không gửi đáp án
}));
router.post('/lessons/:id/submit', A.requireUser, wrap(async (req, res) => {
  const l = (await db.prepare("SELECT * FROM lessons WHERE id=? AND status='published'").get(Number(req.params.id)));
  if (!l) return bad(res, 'Không tìm thấy bài học.', 404);
  const quiz = j(l.quiz, []); const ans = req.body?.answers || [];
  const detail = quiz.map((x, i) => { const p = lessonPerm(l.id, i, x.options.length); const ans2 = p.indexOf(x.answer); return { chosen: ans[i] ?? null, answer: ans2, ok: ans[i] === ans2, explanation: x.explanation }; });
  const score = detail.filter((d) => d.ok).length;
  (await db.prepare(`INSERT INTO lesson_progress(user_id,lesson_id,score,total,at) VALUES(?,?,?,?,?)
    ON CONFLICT(user_id,lesson_id) DO UPDATE SET score=GREATEST(lesson_progress.score,excluded.score), total=excluded.total, at=excluded.at`).run(req.user.id, l.id, score, quiz.length, now()));
  res.json({ score, total: quiz.length, detail });
}));

// ---------------- Flashcard SRS (FR-19) ----------------
router.get('/cards', A.requireUser, wrap(async (req, res) => {
  const rows = (await db.prepare('SELECT * FROM cards WHERE user_id=? ORDER BY due').all(req.user.id));
  res.json({ cards: rows, due: rows.filter((r) => r.due <= now()) });
}));
router.post('/cards', A.requireUser, wrap(async (req, res) => {
  const { front, reading, back, source, kind } = req.body || {};
  if (!String(front || '').trim() || !String(back || '').trim()) return bad(res, 'Thẻ cần có mặt trước và mặt sau.');
  const r = (await db.prepare('INSERT INTO cards(user_id,kind,front,reading,back,source,due,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING')
    .run(req.user.id, kind === 'kanji' ? 'kanji' : kind === 'phrase' ? 'phrase' : 'vocab', String(front).slice(0, 100), String(reading || '').slice(0, 100), String(back).slice(0, 300), String(source || '').slice(0, 100), now(), now()));
  res.json({ ok: true, created: r.changes > 0 });
}));
router.post('/cards/:id/review', A.requireUser, wrap(async (req, res) => {
  const c = (await db.prepare('SELECT * FROM cards WHERE id=? AND user_id=?').get(Number(req.params.id), req.user.id));
  if (!c) return bad(res, 'Không tìm thấy thẻ.', 404);
  const g = Number(req.body?.grade);   // 0 quên, 1 khó, 2 tốt, 3 dễ
  if (![0, 1, 2, 3].includes(g)) return bad(res, 'Mức đánh giá không hợp lệ.');
  let { ease, interval, reps } = c, due;
  if (g === 0) { reps = 0; interval = 0; ease = Math.max(1.3, ease - 0.2); due = now() + 10 * 60e3; }
  else {
    if (g === 1) { interval = Math.max(1, Math.round((interval || 1) * 1.2)); ease = Math.max(1.3, ease - 0.15); }
    else if (g === 2) { interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease); }
    else { interval = reps === 0 ? 3 : Math.round(Math.max(interval, 1) * ease * 1.3); ease += 0.1; }
    reps++; due = now() + interval * 864e5;
  }
  (await db.prepare('UPDATE cards SET ease=?, interval=?, reps=?, due=? WHERE id=?').run(ease, interval, reps, due, c.id));
  res.json({ ok: true, interval, due });
}));
router.delete('/cards/:id', A.requireUser, wrap(async (req, res) => { (await db.prepare('DELETE FROM cards WHERE id=? AND user_id=?').run(Number(req.params.id), req.user.id)); res.json({ ok: true }); }));

// ---------------- Cộng đồng (FR-20, FR-21) ----------------
router.get('/questions/:id/comments', wrap(async (req, res) => {
  const rows = (await db.prepare(`SELECT c.id,c.parent_id,c.body,c.created_at,u.name,u.role FROM comments c JOIN users u ON u.id=c.user_id
    WHERE c.question_id=? AND c.hidden=0 ORDER BY c.id`).all(Number(req.params.id)));
  res.json(rows);
}));
router.post('/questions/:id/comments', A.requireUser, wrap(async (req, res) => {
  const body = String(req.body?.body || '').trim().slice(0, 1000);
  if (!body) return bad(res, 'Bình luận không được để trống.');
  const qid = Number(req.params.id);
  if (!(await db.prepare("SELECT 1 FROM questions WHERE id=? AND status='published'").get(qid))) return bad(res, 'Không tìm thấy câu hỏi.', 404);
  const pid = req.body?.parent_id ? Number(req.body.parent_id) : null;
  const r = (await db.prepare('INSERT INTO comments(question_id,user_id,parent_id,body,created_at) VALUES(?,?,?,?,?)').run(qid, req.user.id, pid, body, now()));
  if (pid) {
    const p = (await db.prepare('SELECT user_id FROM comments WHERE id=?').get(pid));
    if (p && p.user_id !== req.user.id) (await db.prepare('INSERT INTO notifications(user_id,text,link,created_at) VALUES(?,?,?,?)')
      .run(p.user_id, `${req.user.name} đã trả lời bình luận của bạn.`, `#/cau/${qid}`, now()));
  }
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
}));
router.post('/reports', A.requireUser, wrap(async (req, res) => {
  const { question_id, type, note } = req.body || {};
  if (!['dap-an', 'de-bai', 'audio', 'giai-thich', 'khac'].includes(type)) return bad(res, 'Loại lỗi không hợp lệ.');
  if (!(await db.prepare('SELECT 1 FROM questions WHERE id=?').get(Number(question_id)))) return bad(res, 'Không tìm thấy câu hỏi.', 404);
  const r = (await db.prepare('INSERT INTO reports(question_id,user_id,type,note,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .run(Number(question_id), req.user.id, type, String(note || '').slice(0, 1000), now(), now()));
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
}));
router.get('/reports/mine', A.requireUser, wrap(async (req, res) => {
  res.json((await db.prepare('SELECT id,question_id,type,note,status,reply,created_at,updated_at FROM reports WHERE user_id=? ORDER BY id DESC').all(req.user.id)));
}));

module.exports = router;
