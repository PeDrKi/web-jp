const { db, j } = require('./db');
const JP = require('./jp');

const SECTIONS = { vocab: 'Văn tự - từ vựng', conversation: 'Hội thoại và biểu hiện', grammar: 'Ngữ pháp', reading: 'Đọc hiểu', listening: 'Nghe hiểu', writing: 'Viết / Tự luận' };
const KINDS = { mcq: 'Trắc nghiệm', essay: 'Tự luận' };
const ETYPES = { short: 'Trả lời ngắn', fix: 'Tìm và sửa lỗi sai', ja_vi: 'Dịch Nhật → Việt', vi_ja: 'Dịch Việt → Nhật', composition: 'Viết văn (作文)' };
const DIFFS = ['Chưa xếp mức', 'Cơ bản', 'Vừa', 'Khó vừa', 'Khó', 'Rất khó'];
// 4 danh mục lớn; JLPT và BJT chỉ gồm trắc nghiệm, Thi chuyên và EJU có tự luận
const EXAM_KINDS = { chuyen: 'Thi chuyên', jlpt: 'JLPT', bjt: 'BJT', eju: 'EJU' };
const MCQ_ONLY = ['jlpt', 'bjt'];
// Bài dịch sang tiếng Việt đếm theo từ; viết tiếng Nhật đếm theo chữ (không tính khoảng trắng)
const lenUnit = (etype) => (etype === 'ja_vi' ? 'words' : 'chars');
const countLen = (t, unit) => (unit === 'words' ? (String(t || '').match(/\S+/g) || []).length : [...String(t || '').replace(/\s/g, '')].length);
// Cắt bài làm về đúng giới hạn (giữ nguyên khoảng trắng / xuống dòng phía trước)
function clipLen(t, max, unit) {
  t = String(t || '');
  if (!max || countLen(t, unit) <= max) return t;
  if (unit === 'words') { const re = /\S+/g; let m, n = 0; while ((m = re.exec(t))) if (++n === max) return t.slice(0, m.index + m[0].length); return t; }
  let n = 0, out = '';
  for (const ch of t) { if (!/\s/.test(ch)) { if (n === max) break; n++; } out += ch; }
  return out;
}

function rowToQuestion(r) {
  return { id: r.id, level: r.level, section: r.section, qtype: r.qtype, stem: r.stem, passage: r.passage,
    audio_script: j(r.audio_script, []), audio_url: r.audio_url, image_url: r.image_url,
    options: j(r.options, []), answer: r.answer, explanation: r.explanation, tags: j(r.tags, {}),
    kind: r.kind || 'mcq', model_answer: r.model_answer || '', accepted: j(r.accepted, []), points: r.points || 1, created_by: r.created_by,
    difficulty: r.difficulty || 0, etype: r.etype || '', max_len: r.max_len || 0, catalog: r.catalog || '',
    status: r.status, version: r.version, source: r.source, created_at: r.created_at, updated_at: r.updated_at };
}
// Bản gửi cho người học khi đang làm bài: KHÔNG có đáp án / giải thích (bảo mật - mục 8)
function publicQuestion(q) {
  return { id: q.id, level: q.level, section: q.section, qtype: q.qtype, stem: q.stem, passage: q.passage,
    kind: q.kind || 'mcq', points: q.points || 1, etype: q.etype || '', max_len: q.max_len || 0,
    has_audio: !!(q.audio_url || (q.audio_script && q.audio_script.length)),
    audio_url: q.audio_url, image_url: q.image_url, options: q.options, version: q.version,
    // Văn bản nghe KHÔNG gửi trước khi nộp; chỉ gửi script để trình duyệt đọc TTS khi chưa có file audio
    tts: !q.audio_url ? q.audio_script : [] };
}
function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}
const stripMarkup = (s) => String(s || '').replace(/\{([^|}]+)\|[^}]*\}/g, '$1').replace(/__/g, '');

function validateQuestion(q) {
  const errs = [];
  const kind = q.kind || 'mcq';
  if (!KINDS[kind]) errs.push('Loại câu phải là mcq (trắc nghiệm) hoặc essay (tự luận)');
  if (!/^N[1-5]$/.test(q.level || '')) errs.push('Cấp độ phải là N1-N5');
  if (!SECTIONS[q.section]) errs.push('Phần thi phải là vocab, conversation, grammar, reading, listening hoặc writing');
  if (!String(q.stem || '').trim()) errs.push('Thiếu nội dung câu hỏi');
  if (!(Number.isInteger(q.difficulty ?? 0) && (q.difficulty ?? 0) >= 0 && (q.difficulty ?? 0) <= 5)) errs.push('Mức độ khó phải từ 1 đến 5');
  if (!(Number.isInteger(q.max_len ?? 0) && (q.max_len ?? 0) >= 0 && (q.max_len ?? 0) <= 5000)) errs.push('Giới hạn chữ phải từ 0 đến 5000');
  const pts = q.points ?? 1;
  if (!Number.isInteger(pts) || pts < 1 || pts > 100) errs.push('Điểm của câu phải là số nguyên từ 1 đến 100');
  if (kind === 'essay') {
    if ((q.options || []).length) errs.push('Câu tự luận không có phương án lựa chọn');
    if (!String(q.model_answer || '').trim() && !(q.accepted || []).length) errs.push('Câu tự luận cần đáp án mẫu (hoặc danh sách đáp án chấp nhận)');
  } else {
    const opts = (q.options || []).map((x) => String(x || '').trim());
    if (opts.length < 2 || opts.length > 6 || opts.some((o) => !o)) errs.push('Cần 2-6 đáp án, không để trống');
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) errs.push('Đáp án đúng không hợp lệ');
    if (new Set(opts).size !== opts.length) errs.push('Các đáp án bị trùng nhau');
    if (!String(q.explanation || '').trim()) errs.push('Thiếu giải thích tiếng Việt');
  }
  if (q.section === 'listening' && !q.audio_url && !(q.audio_script || []).length) errs.push('Câu nghe cần file audio hoặc kịch bản audio');
  return errs;
}
// Câu tự luận ngắn: khớp một đáp án chấp nhận (bỏ dấu câu, khoảng trắng, katakana ≡ hiragana, không phân biệt hoa thường)
const normAnswer = (s) => JP.norm(normalize(String(s || '')));
function autoGradeEssay(q, text) {
  if (!(q.accepted || []).length || !String(text || '').trim()) return null;
  const t = normAnswer(text);
  return q.accepted.some((a) => normAnswer(a) === t) ? (q.points || 1) : null;
}

// ---- Chấm điểm theo cấu hình của từng kỳ thi (thêm kỳ thi mới = thêm cấu hình, không sửa code) ----
// manual: { [qid]: { points, feedback, by, at } } - điểm giảng viên chấm cho câu tự luận
function scoreAttempt(snapshot, answers, scoring, manual = {}) {
  const items = snapshot.questions.map((q) => {
    const a = answers[q.id] || {};
    const max = q.points || 1;
    if ((q.kind || 'mcq') === 'essay') {
      const text = typeof a.t === 'string' ? a.t : '';
      const answered = !!text.trim();
      const m = manual[q.id];
      let pts = 0, graded = true, auto = false, feedback = '';
      if (m) { pts = m.points; feedback = m.feedback || ''; }
      else if (!answered) pts = 0;
      else { const g = autoGradeEssay(q, text); if (g !== null) { pts = g; auto = true; } else graded = false; }
      return { qid: q.id, section: q.section, qtype: q.qtype, tags: q.tags || {}, kind: 'essay', text, answered, graded, auto, points: pts, max, feedback,
        ok: graded && pts * 2 >= max, chosen: null, chosenText: null, correctText: q.model_answer || (q.accepted || [])[0] || '' };
    }
    const c = Number.isInteger(a.c) ? a.c : null;
    const ok = c === q.answer;
    return { qid: q.id, section: q.section, qtype: q.qtype, tags: q.tags || {}, kind: 'mcq', chosen: c, chosenText: c !== null ? q.options[c] : null, correctText: q.options[q.answer], ok, answered: c !== null, graded: true, points: ok ? max : 0, max };
  });
  const bySection = {};
  for (const it of items) {
    const s = (bySection[it.section] ||= { total: 0, correct: 0, answered: 0, points: 0, max: 0 });
    s.total++; if (it.ok) s.correct++; if (it.answered) s.answered++; s.points += it.points; s.max += it.max;
  }
  const pending = items.filter((i) => !i.graded).length;
  const result = { items, bySection, correct: items.filter((i) => i.ok).length, total: items.length,
    points: items.reduce((a, i) => a + i.points, 0), maxPoints: items.reduce((a, i) => a + i.max, 0), pending_grading: pending, final: pending === 0 };
  if (scoring && scoring.groups) {
    let total = 0, allMin = true;
    const f = 10 ** (Number.isInteger(scoring.decimals) ? Math.min(Math.max(scoring.decimals, 0), 2) : 0);   // số chữ số thập phân (thang 10 dùng 1)
    result.groups = scoring.groups.map((g) => {
      // quy đổi theo điểm từng câu (câu trắc nghiệm mặc định 1 điểm -> giống tỷ lệ câu đúng như trước)
      let t = 0, c = 0, pm = 0, pp = 0;
      for (const s of g.sections) { const x = bySection[s]; if (x) { t += x.total; c += x.correct; pm += x.max; pp += x.points; } }
      const score = pm ? Math.round(((g.max * pp) / pm) * f) / f : 0;
      const metMin = score >= (g.min || 0);
      total += score; if (!metMin) allMin = false;
      return { key: g.key, name: g.name, max: g.max, min: g.min || 0, score, correct: c, questions: t, metMin };
    });
    total = Math.round(total * f) / f;
    result.score = total;
    result.maxScore = scoring.groups.reduce((a, g) => a + g.max, 0);
    result.passScore = scoring.total_pass;
    result.passed = total >= scoring.total_pass && allMin;
    result.note = scoring.note || '';
  } else {
    result.score = result.points; result.maxScore = result.maxPoints;
  }
  return result;
}

async function tagStats(userId) {
  const rows = (await db.prepare("SELECT result FROM attempts WHERE user_id=? AND status='submitted' ORDER BY submitted_at").all(userId));
  const sec = {}, gram = {}, qt = {}, kanji = {};
  const bump = (o, k, ok) => { const x = (o[k] ||= { total: 0, correct: 0 }); x.total++; if (ok) x.correct++; };
  for (const r of rows) {
    const res = j(r.result, null); if (!res) continue;
    for (const it of res.items) {
      if (it.graded === false) continue;   // câu tự luận chưa chấm
      bump(sec, it.section, it.ok);
      if (it.qtype) bump(qt, it.qtype, it.ok);
      for (const g of it.tags.grammar || []) bump(gram, g, it.ok);
      for (const k of it.tags.kanji || []) bump(kanji, k, it.ok);
    }
  }
  return { sec, gram, qt, kanji };
}
function weakest(obj, minTotal = 1, n = 3) {
  return Object.entries(obj).filter(([, v]) => v.total >= minTotal)
    .map(([k, v]) => ({ key: k, rate: v.correct / v.total, ...v })).filter((x) => x.rate < 0.7)
    .sort((a, b) => a.rate - b.rate).slice(0, n);
}
const publishedLessons = () => db.prepare("SELECT id,title,level,situation,grammar_tags FROM lessons WHERE status='published'").all();
// truyền sẵn danh sách bài (lessons) để tránh truy vấn lặp; không truyền thì trả về Promise
function lessonsForTags(tags, lessons) {
  if (!lessons) return publishedLessons().then((ls) => lessonsForTags(tags, ls));
  const set = new Set(tags);
  return lessons
    .filter((l) => j(l.grammar_tags, []).some((t) => set.has(t)))
    .map((l) => ({ id: l.id, title: l.title, level: l.level, situation: l.situation }));
}
async function recommend(userId, level) {
  const st = (await tagStats(userId));
  const wSec = weakest(st.sec), wGram = weakest(st.gram);
  const recs = [];
  for (const w of wSec) recs.push({ type: 'practice', section: w.key, level, text: `Luyện thêm phần ${SECTIONS[w.key] || w.key} (đúng ${Math.round(w.rate * 100)}%)` });
  const ls = (await lessonsForTags(wGram.map((w) => w.key)));
  for (const l of ls.slice(0, 2)) recs.push({ type: 'lesson', id: l.id, text: `Xem cách dùng ngoài đời: ${l.title}` });
  for (const g of wGram.slice(0, 2)) recs.push({ type: 'grammar', tag: g.key, text: `Mẫu ngữ pháp còn yếu: ${g.key} (${g.correct}/${g.total})` });
  return recs;
}
module.exports = { ETYPES, DIFFS, EXAM_KINDS, MCQ_ONLY, lenUnit, countLen, clipLen, publishedLessons, SECTIONS, KINDS, autoGradeEssay, rowToQuestion, publicQuestion, normalize, stripMarkup, validateQuestion, scoreAttempt, tagStats, weakest, lessonsForTags, recommend };
