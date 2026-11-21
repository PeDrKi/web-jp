// Lớp học & giao bài: giảng viên tạo lớp, học viên vào lớp bằng mã, giao đề có hạn nộp, bảng điểm, nhắc nộp bài.
const express = require('express');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { db, j } = require('../lib/db');
const A = require('../lib/auth');
const Mail = require('../lib/mail');
const router = express.Router();
const now = () => Date.now();
const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ error: 'Lỗi máy chủ.' }); } };
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const TEACH = ['teacher', 'admin'];
// Mã lớp 6 ký tự, bỏ các ký tự dễ nhầm (0/O, 1/I/L)
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.randomBytes(6), (b) => ALPHA[b % ALPHA.length]).join('');

// Điểm phần trăm của một bài đã nộp (thang điểm JLPT, điểm tự luận, hoặc số câu đúng)
function pctOf(r) {
  if (!r) return null;
  if (r.maxScore) return Math.round((100 * r.score) / r.maxScore);
  if (r.maxPoints) return Math.round((100 * r.points) / r.maxPoints);
  return r.total ? Math.round((100 * r.correct) / r.total) : 0;
}
const scoreText = (r) => (r.maxScore && r.passed != null ? `${r.score}/${r.maxScore}` : r.maxPoints != null && r.maxPoints !== r.total ? `${r.points}/${r.maxPoints}` : `${r.correct}/${r.total}`);

async function ownClass(req, res) {
  const c = await db.prepare('SELECT * FROM classes WHERE id=?').get(Number(req.params.id));
  if (!c || (req.user.role !== 'admin' && c.teacher_id !== req.user.id)) { bad(res, 'Không tìm thấy lớp.', 404); return null; }
  return c;
}
async function ownAssignment(req, res) {
  const a = await db.prepare('SELECT s.*, c.teacher_id, c.name AS class_name FROM assignments s JOIN classes c ON c.id=s.class_id WHERE s.id=?').get(Number(req.params.id));
  if (!a || (req.user.role !== 'admin' && a.teacher_id !== req.user.id)) { bad(res, 'Không tìm thấy bài giao.', 404); return null; }
  return a;
}
// Tình trạng của từng học viên với từng bài giao
async function progressFor(assignIds, userIds) {
  if (!assignIds.length || !userIds.length) return new Map();
  const rows = await db.prepare('SELECT id,user_id,assignment_id,status,result,submitted_at,started_at FROM attempts WHERE assignment_id = ANY(?) AND user_id = ANY(?) ORDER BY id').all(assignIds, userIds);
  const m = new Map();
  for (const r of rows) {
    const k = r.assignment_id + ':' + r.user_id;
    const o = m.get(k) || { tries: 0, best: null, bestPct: null, in_progress: null, last_submitted: null, attempt_id: null, pending: false };
    if (r.status === 'submitted') {
      o.tries++; const res = j(r.result, null); const p = pctOf(res);
      if (o.bestPct == null || p > o.bestPct) { o.bestPct = p; o.best = res; o.attempt_id = r.id; o.pending = !!res?.pending_grading; }
      o.last_submitted = Math.max(o.last_submitted || 0, r.submitted_at || 0);
      if (o.first_submitted == null || r.submitted_at < o.first_submitted) o.first_submitted = r.submitted_at;
    } else if (r.status === 'in_progress') o.in_progress = r.id;
    m.set(k, o);
  }
  return m;
}
function statusOf(o, a) {
  if (!o || (!o.tries && !o.in_progress)) return a.due_at && a.due_at < now() ? 'missing' : 'todo';
  if (!o.tries) return 'doing';
  if (o.pending) return 'grading';
  return a.due_at && o.first_submitted > a.due_at ? 'late' : 'done';
}
const assignOut = (a) => ({ id: a.id, class_id: a.class_id, exam_id: a.exam_id, title: a.title, note: a.note, due_at: a.due_at, max_attempts: a.max_attempts,
  mode: a.mode, show_answers: a.show_answers, allow_late: !!a.allow_late, created_at: a.created_at, exam_title: a.exam_title, question_count: a.question_count });
async function withExam(list) {
  if (!list.length) return list;
  const ex = new Map((await db.prepare('SELECT id,title,sections FROM exams WHERE id = ANY(?)').all([...new Set(list.map((a) => a.exam_id))]))
    .map((e) => [e.id, { title: e.title, n: j(e.sections, []).reduce((s, x) => s + x.question_ids.length, 0) }]));
  return list.map((a) => ({ ...a, exam_title: ex.get(a.exam_id)?.title || '(đề đã xóa)', question_count: ex.get(a.exam_id)?.n || 0 }));
}

/* ================= Giảng viên ================= */
router.get('/admin/classes', A.requireRole(...TEACH), wrap(async (req, res) => {
  const mine = req.user.role === 'admin' ? '' : 'WHERE c.teacher_id=?';
  const rows = await db.prepare(`SELECT c.*, u.name AS teacher_name,
      (SELECT COUNT(*) FROM class_members m WHERE m.class_id=c.id) AS members,
      (SELECT COUNT(*) FROM assignments s WHERE s.class_id=c.id) AS assignments
    FROM classes c LEFT JOIN users u ON u.id=c.teacher_id ${mine} ORDER BY c.archived, c.id DESC`).all(...(mine ? [req.user.id] : []));
  res.json(rows);
}));
router.post('/admin/classes', A.requireRole(...TEACH), wrap(async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 80);
  if (!name) return bad(res, 'Nhập tên lớp.');
  let code = newCode(); while (await db.prepare('SELECT 1 FROM classes WHERE code=?').get(code)) code = newCode();
  const r = await db.prepare('INSERT INTO classes(name,description,code,teacher_id,created_at) VALUES(?,?,?,?,?)').run(name, String(req.body?.description || '').slice(0, 500), code, req.user.id, now());
  res.json({ id: r.lastInsertRowid, code });
}));
router.get('/admin/classes/:id', A.requireRole(...TEACH), wrap(async (req, res) => {
  const c = await ownClass(req, res); if (!c) return;
  const members = await db.prepare('SELECT u.id,u.name,u.email,m.joined_at,u.last_login FROM class_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=? ORDER BY u.name').all(c.id);
  const assigns = await withExam(await db.prepare('SELECT * FROM assignments WHERE class_id=? ORDER BY COALESCE(due_at, 9e15) DESC, id DESC').all(c.id));
  const prog = await progressFor(assigns.map((a) => a.id), members.map((m) => m.id));
  res.json({ ...c, members, assignments: assigns.map((a) => {
    const st = members.map((m) => statusOf(prog.get(a.id + ':' + m.id), a));
    return { ...assignOut(a), done: st.filter((s) => ['done', 'late', 'grading'].includes(s)).length, total: members.length };
  }) });
}));
router.patch('/admin/classes/:id', A.requireRole(...TEACH), wrap(async (req, res) => {
  const c = await ownClass(req, res); if (!c) return;
  const b = req.body || {};
  const name = b.name != null ? String(b.name).trim().slice(0, 80) || c.name : c.name;
  const desc = b.description != null ? String(b.description).slice(0, 500) : c.description;
  const archived = 'archived' in b ? (b.archived ? 1 : 0) : c.archived;
  let code = c.code;
  if (b.new_code) { code = newCode(); while (await db.prepare('SELECT 1 FROM classes WHERE code=?').get(code)) code = newCode(); }
  await db.prepare('UPDATE classes SET name=?, description=?, archived=?, code=? WHERE id=?').run(name, desc, archived, code, c.id);
  res.json({ ok: true, code });
}));
router.delete('/admin/classes/:id', A.requireRole(...TEACH), wrap(async (req, res) => {
  const c = await ownClass(req, res); if (!c) return;
  await db.prepare('UPDATE attempts SET assignment_id=NULL WHERE assignment_id IN (SELECT id FROM assignments WHERE class_id=?)').run(c.id);
  await db.prepare('DELETE FROM assignments WHERE class_id=?').run(c.id);
  await db.prepare('DELETE FROM class_members WHERE class_id=?').run(c.id);
  await db.prepare('DELETE FROM classes WHERE id=?').run(c.id);
  res.json({ ok: true });
}));
// Thêm học viên bằng email (mỗi dòng/dấu phẩy một email; chỉ thêm người đã có tài khoản)
router.post('/admin/classes/:id/members', A.requireRole(...TEACH), wrap(async (req, res) => {
  const c = await ownClass(req, res); if (!c) return;
  const emails = [...new Set(String(req.body?.emails || '').toLowerCase().split(/[\s,;]+/).filter((e) => e.includes('@')))].slice(0, 300);
  if (!emails.length) return bad(res, 'Nhập ít nhất một email.');
  const users = await db.prepare('SELECT id,email FROM users WHERE email = ANY(?)').all(emails);
  for (const u of users) await db.prepare('INSERT INTO class_members(class_id,user_id,joined_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(c.id, u.id, now());
  const found = new Set(users.map((u) => u.email));
  res.json({ added: users.length, not_found: emails.filter((e) => !found.has(e)) });
}));
router.delete('/admin/classes/:id/members/:uid', A.requireRole(...TEACH), wrap(async (req, res) => {
  const c = await ownClass(req, res); if (!c) return;
  await db.prepare('DELETE FROM class_members WHERE class_id=? AND user_id=?').run(c.id, Number(req.params.uid));
  res.json({ ok: true });
}));

// Giao bài
async function readAssignment(req, res, cur = {}) {
  const b = req.body || {};
  const examId = Number(b.exam_id ?? cur.exam_id);
  const e = await db.prepare("SELECT id,title,status,created_by FROM exams WHERE id=?").get(examId);
  if (!e || e.status !== 'published') { bad(res, 'Chọn một đề đã đăng.'); return null; }
  const due = b.due_at === null || b.due_at === '' ? null : b.due_at != null ? Number(b.due_at) : cur.due_at ?? null;
  if (due != null && !(due > 0)) { bad(res, 'Hạn nộp không hợp lệ.'); return null; }
  return {
    exam_id: e.id, title: String(b.title ?? cur.title ?? '').trim().slice(0, 120) || e.title, note: String(b.note ?? cur.note ?? '').slice(0, 1000), due_at: due,
    max_attempts: Math.max(0, Math.min(20, Number(b.max_attempts ?? cur.max_attempts ?? 1) || 0)),
    mode: (b.mode ?? cur.mode) === 'real' ? 'real' : 'practice',
    show_answers: (b.show_answers ?? cur.show_answers) === 'after_due' ? 'after_due' : 'after_submit',
    allow_late: (b.allow_late ?? cur.allow_late ?? 1) ? 1 : 0,
  };
}
async function notifyMembers(classId, userIds, text, link) {
  for (const uid of userIds) await db.prepare('INSERT INTO notifications(user_id,text,link,created_at) VALUES(?,?,?,?)').run(uid, text, link, now());
}
router.post('/admin/classes/:id/assignments', A.requireRole(...TEACH), wrap(async (req, res) => {
  const c = await ownClass(req, res); if (!c) return;
  const v = await readAssignment(req, res); if (!v) return;
  const r = await db.prepare('INSERT INTO assignments(class_id,exam_id,title,note,due_at,max_attempts,mode,show_answers,allow_late,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run(c.id, v.exam_id, v.title, v.note, v.due_at, v.max_attempts, v.mode, v.show_answers, v.allow_late, req.user.id, now());
  const mem = (await db.prepare('SELECT user_id FROM class_members WHERE class_id=?').all(c.id)).map((m) => m.user_id);
  await notifyMembers(c.id, mem, `Lớp ${c.name}: bài mới "${v.title}"${v.due_at ? ' · hạn ' + new Date(v.due_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''}`, `#/lop/${c.id}`);
  res.json({ id: r.lastInsertRowid });
}));
router.get('/admin/assignments/:id', A.requireRole(...TEACH), wrap(async (req, res) => {
  const a = await ownAssignment(req, res); if (!a) return;
  const [full] = await withExam([a]);
  const members = await db.prepare('SELECT u.id,u.name,u.email FROM class_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=? ORDER BY u.name').all(a.class_id);
  const prog = await progressFor([a.id], members.map((m) => m.id));
  const students = members.map((m) => { const o = prog.get(a.id + ':' + m.id);
    return { ...m, status: statusOf(o, a), tries: o?.tries || 0, pct: o?.bestPct ?? null, score: o?.best ? scoreText(o.best) : null, attempt_id: o?.attempt_id || null, submitted_at: o?.first_submitted || null }; });
  // Phân tích câu: tỷ lệ đúng của cả lớp ở từng câu (lần nộp tốt nhất của mỗi người)
  const best = students.filter((s) => s.attempt_id).map((s) => s.attempt_id);
  const stats = new Map();
  if (best.length) for (const r of await db.prepare('SELECT snapshot,result FROM attempts WHERE id = ANY(?)').all(best)) {
    const qs = j(r.snapshot, {}).questions || [], items = j(r.result, {}).items || [];
    qs.forEach((q, i) => { const s = stats.get(q.id) || { id: q.id, stem: q.stem, section: q.section, kind: q.kind, n: 0, ok: 0, wrong: {} };
      s.n++; if (items[i]?.ok) s.ok++; else if (items[i]?.chosen != null && q.options) { const t = q.options[items[i].chosen]; s.wrong[t] = (s.wrong[t] || 0) + 1; }
      stats.set(q.id, s); });
  }
  const questions = [...stats.values()].map((s) => { const top = Object.entries(s.wrong).sort((x, y) => y[1] - x[1])[0];
    return { id: s.id, stem: s.stem, section: s.section, kind: s.kind, n: s.n, pct: Math.round((100 * s.ok) / s.n), common_wrong: top ? { text: top[0], n: top[1] } : null }; })
    .sort((x, y) => x.pct - y.pct);
  res.json({ ...assignOut(full), class_name: a.class_name, students, questions });
}));
router.patch('/admin/assignments/:id', A.requireRole(...TEACH), wrap(async (req, res) => {
  const a = await ownAssignment(req, res); if (!a) return;
  const v = await readAssignment(req, res, a); if (!v) return;
  await db.prepare('UPDATE assignments SET title=?, note=?, due_at=?, max_attempts=?, mode=?, show_answers=?, allow_late=? WHERE id=?')
    .run(v.title, v.note, v.due_at, v.max_attempts, v.mode, v.show_answers, v.allow_late, a.id);   // không đổi đề sau khi đã giao
  res.json({ ok: true });
}));
router.delete('/admin/assignments/:id', A.requireRole(...TEACH), wrap(async (req, res) => {
  const a = await ownAssignment(req, res); if (!a) return;
  await db.prepare('UPDATE attempts SET assignment_id=NULL WHERE assignment_id=?').run(a.id);
  await db.prepare('DELETE FROM assignments WHERE id=?').run(a.id);
  res.json({ ok: true });
}));
// Nhắc những người chưa nộp (thông báo trong web + email nếu đã bật Brevo)
router.post('/admin/assignments/:id/remind', A.requireRole(...TEACH), wrap(async (req, res) => {
  const a = await ownAssignment(req, res); if (!a) return;
  const lim = A.limiter('remind|' + a.id, 3, 3600e3); if (lim.blocked) return bad(res, 'Đã nhắc gần đây, vui lòng đợi một lúc.', 429); lim.hit();
  const members = await db.prepare('SELECT u.id,u.name,u.email FROM class_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=? AND u.locked=0').all(a.class_id);
  const prog = await progressFor([a.id], members.map((m) => m.id));
  const todo = members.filter((m) => ['todo', 'doing', 'missing'].includes(statusOf(prog.get(a.id + ':' + m.id), a)));
  const due = a.due_at ? new Date(a.due_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
  await notifyMembers(a.class_id, todo.map((m) => m.id), `Nhắc: bạn chưa nộp "${a.title}" (lớp ${a.class_name})${due ? ' · hạn ' + due : ''}`, `#/lop/${a.class_id}`);
  let emailed = 0;
  if (Mail.enabled) for (const m of todo) {
    try { await Mail.send(m.email, `Nhắc nộp bài: ${a.title}`, `<p>Chào ${m.name},</p><p>Bạn chưa nộp bài <b>${a.title.replace(/</g, '&lt;')}</b> của lớp ${a.class_name.replace(/</g, '&lt;')}${due ? `, hạn nộp <b>${due}</b>` : ''}.</p><p>Đăng nhập để làm bài.</p>`); emailed++; } catch (e) { console.error(e.message); }
  }
  res.json({ reminded: todo.length, emailed });
}));
// Bảng điểm lớp (JSON hoặc Excel)
async function gradebook(c) {
  const members = await db.prepare('SELECT u.id,u.name,u.email FROM class_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=? ORDER BY u.name').all(c.id);
  const assigns = await db.prepare('SELECT * FROM assignments WHERE class_id=? ORDER BY COALESCE(due_at, created_at), id').all(c.id);
  const prog = await progressFor(assigns.map((a) => a.id), members.map((m) => m.id));
  const rows = members.map((m) => {
    const cells = assigns.map((a) => { const o = prog.get(a.id + ':' + m.id); return { status: statusOf(o, a), pct: o?.bestPct ?? null, score: o?.best ? scoreText(o.best) : null, attempt_id: o?.attempt_id || null }; });
    const done = cells.filter((x) => x.pct != null);
    return { ...m, cells, avg: done.length ? Math.round(done.reduce((s, x) => s + x.pct, 0) / done.length) : null, missing: cells.filter((x) => x.status === 'missing').length };
  });
  return { assignments: assigns.map((a) => ({ id: a.id, title: a.title, due_at: a.due_at })), rows };
}
router.get('/admin/classes/:id/gradebook', A.requireRole(...TEACH), wrap(async (req, res) => {
  const c = await ownClass(req, res); if (!c) return;
  res.json(await gradebook(c));
}));
router.get('/admin/classes/:id/gradebook.xlsx', A.requireRole(...TEACH), wrap(async (req, res) => {
  const c = await ownClass(req, res); if (!c) return;
  const g = await gradebook(c);
  const ST = { todo: 'Chưa làm', doing: 'Đang làm', missing: 'Không nộp', grading: 'Chờ chấm', late: 'Nộp muộn', done: '' };
  const aoa = [['Họ tên', 'Email', ...g.assignments.map((a) => a.title), 'Điểm TB (%)', 'Số bài không nộp'],
    ...g.rows.map((r) => [r.name, r.email, ...r.cells.map((x) => (x.pct != null ? `${x.pct}%${x.status === 'late' ? ' (muộn)' : x.status === 'grading' ? ' (chờ chấm)' : ''}` : ST[x.status])), r.avg ?? '', r.missing])];
  const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 24 }, { wch: 28 }, ...g.assignments.map(() => ({ wch: 16 })), { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, 'BangDiem');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const fname = `bang-diem-${c.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^\w]+/g, '-').toLowerCase()}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.send(buf);
}));
// Danh sách đề đã đăng để chọn khi giao bài
router.get('/admin/assignable-exams', A.requireRole(...TEACH), wrap(async (_req, res) => {
  res.json((await db.prepare("SELECT id,title,level,exam_type,duration_min,sections FROM exams WHERE status='published' ORDER BY level, title").all())
    .map((e) => ({ id: e.id, title: e.title, level: e.level, exam_type: e.exam_type, duration_min: e.duration_min, question_count: j(e.sections, []).reduce((s, x) => s + x.question_ids.length, 0) })));
}));

/* ================= Học viên ================= */
router.post('/classes/join', A.requireUser, wrap(async (req, res) => {
  const lim = A.limiter('join|' + req.user.id, 10, 600e3); if (lim.blocked) return bad(res, 'Thử quá nhiều lần, vui lòng đợi.', 429);
  const code = String(req.body?.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const c = await db.prepare('SELECT * FROM classes WHERE code=? AND archived=0').get(code);
  if (!c) { lim.hit(); return bad(res, 'Mã lớp không đúng hoặc lớp đã đóng.', 404); }
  await db.prepare('INSERT INTO class_members(class_id,user_id,joined_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(c.id, req.user.id, now());
  res.json({ id: c.id, name: c.name });
}));
router.post('/classes/:id/leave', A.requireUser, wrap(async (req, res) => {
  await db.prepare('DELETE FROM class_members WHERE class_id=? AND user_id=?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
}));
async function myAssignments(uid, classIds) {
  if (!classIds.length) return [];
  const list = await withExam(await db.prepare('SELECT s.*, c.name AS class_name FROM assignments s JOIN classes c ON c.id=s.class_id WHERE s.class_id = ANY(?) AND c.archived=0 ORDER BY COALESCE(s.due_at, 9e15), s.id').all(classIds));
  const prog = await progressFor(list.map((a) => a.id), [uid]);
  return list.map((a) => { const o = prog.get(a.id + ':' + uid);
    return { ...assignOut(a), class_name: a.class_name, status: statusOf(o, a), tries: o?.tries || 0, pct: o?.bestPct ?? null, score: o?.best ? scoreText(o.best) : null,
      attempt_id: o?.attempt_id || null, in_progress: o?.in_progress || null,
      can_start: !o?.in_progress && (!a.max_attempts || (o?.tries || 0) < a.max_attempts) && (a.allow_late || !a.due_at || a.due_at > now()) }; });
}
router.get('/classes', A.requireUser, wrap(async (req, res) => {
  const cls = await db.prepare('SELECT c.id,c.name,c.description,u.name AS teacher_name FROM class_members m JOIN classes c ON c.id=m.class_id LEFT JOIN users u ON u.id=c.teacher_id WHERE m.user_id=? AND c.archived=0 ORDER BY c.name').all(req.user.id);
  const asg = await myAssignments(req.user.id, cls.map((c) => c.id));
  res.json({ classes: cls.map((c) => ({ ...c, todo: asg.filter((a) => a.class_id === c.id && ['todo', 'doing'].includes(a.status)).length })), upcoming: asg.filter((a) => ['todo', 'doing'].includes(a.status)).slice(0, 6) });
}));
router.get('/classes/:id', A.requireUser, wrap(async (req, res) => {
  const c = await db.prepare('SELECT c.id,c.name,c.description,u.name AS teacher_name FROM class_members m JOIN classes c ON c.id=m.class_id LEFT JOIN users u ON u.id=c.teacher_id WHERE m.user_id=? AND c.id=?').get(req.user.id, Number(req.params.id));
  if (!c) return bad(res, 'Bạn chưa ở trong lớp này.', 404);
  res.json({ ...c, assignments: await myAssignments(req.user.id, [c.id]) });
}));

module.exports = router;
module.exports.pctOf = pctOf;
