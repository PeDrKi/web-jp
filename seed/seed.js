// Nạp dữ liệu mẫu: node seed/seed.js [--reset]
const { db, tx, file, resetAll } = require('../lib/db');
const A = require('../lib/auth');
const Qs = require('./questions');
const Ls = require('./lessons');
const fs = require('fs');

(async () => {
if (process.argv.includes('--reset')) await resetAll();
if ((await db.prepare('SELECT COUNT(*) n FROM questions').get()).n > 0) { console.log('Đã có dữ liệu, bỏ qua. Dùng --reset để nạp lại.'); await db.close(); return; }
const now = Date.now();

const users = [
  ['admin@nihongo.local', 'Quản trị viên', 'admin', 'Admin@12345'],
  ['bientap@nihongo.local', 'Biên tập viên', 'editor', 'Editor@12345'],
  ['duyet@nihongo.local', 'Người duyệt', 'reviewer', 'Review@12345'],
  ['hocvien@nihongo.local', 'Linh', 'learner', 'Hocvien@12345'],
  ['giangvien@nihongo.local', 'Giảng viên Mẫu', 'teacher', 'Teacher@12345'],
];
const SCORING = {
  N5: { groups: [{ key: 'language', name: 'Kiến thức ngôn ngữ + Đọc hiểu', sections: ['vocab', 'grammar', 'reading'], max: 120, min: 38 }, { key: 'listening', name: 'Nghe hiểu', sections: ['listening'], max: 60, min: 19 }], total_pass: 80 },
  N4: { groups: [{ key: 'language', name: 'Kiến thức ngôn ngữ + Đọc hiểu', sections: ['vocab', 'grammar', 'reading'], max: 120, min: 38 }, { key: 'listening', name: 'Nghe hiểu', sections: ['listening'], max: 60, min: 19 }], total_pass: 90 },
  N3: { groups: [{ key: 'language', name: 'Kiến thức ngôn ngữ (từ vựng - ngữ pháp)', sections: ['vocab', 'grammar'], max: 60, min: 19 }, { key: 'reading', name: 'Đọc hiểu', sections: ['reading'], max: 60, min: 19 }, { key: 'listening', name: 'Nghe hiểu', sections: ['listening'], max: 60, min: 19 }], total_pass: 95 },
};
const NOTE = 'Điểm quy đổi theo tỷ lệ câu đúng của từng phần (mô phỏng); JLPT thật dùng thang điểm tương đương hóa nên có thể chênh lệch.';
const SECNAME = { vocab: 'Văn tự - từ vựng', grammar: 'Ngữ pháp', reading: 'Đọc hiểu', listening: 'Nghe hiểu' };
const MINUTES = { N5: 20, N4: 20, N3: 25 };

await tx(async () => {
  // SEED_PASSWORD: dùng chung một mật khẩu riêng cho các tài khoản mẫu (bắt buộc khi nạp lên máy chủ thật)
  for (const [email, name, role, pw0] of users) { const pw = process.env.SEED_PASSWORD || pw0;
    (await db.prepare('INSERT INTO users(email,name,pass_hash,role,goal,created_at) VALUES(?,?,?,?,?,?)').run(email, name, A.hashPassword(pw), role,
      role === 'learner' ? JSON.stringify({ type: 'both', level: 'N3', deadline: '' }) : '{}', now)); }
  const ins = db.prepare(`INSERT INTO questions(level,section,qtype,stem,passage,audio_script,options,answer,explanation,tags,status,created_by,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,'published',1,?,?)`);
  const insV = db.prepare('INSERT INTO question_versions(question_id,version,snapshot,changed_by,at) VALUES(?,?,?,?,?)');
  const ids = {};
  for (const lv of ['N5', 'N4', 'N3']) {
    ids[lv] = {};
    for (const q of Qs[lv]) {
      const r = await ins.run(q.level, q.section, q.qtype, q.stem, q.passage || '', JSON.stringify(q.audio_script || []), JSON.stringify(q.options), q.answer, q.explanation, JSON.stringify(q.tags), now, now);
      const id = Number(r.lastInsertRowid);
      await insV.run(id, 1, JSON.stringify({ id, ...q, version: 1 }), 1, now);
      (ids[lv][q.section] ||= []).push(id);
    }
    const sections = Object.keys(ids[lv]).map((k) => ({ key: k, name: SECNAME[k], question_ids: ids[lv][k] }));
    (await db.prepare(`INSERT INTO exams(title,exam_type,level,duration_min,description,sections,scoring,status,created_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?, 'published',1,?,?)`).run(`JLPT ${lv} - Đề mô phỏng rút gọn 01`, 'JLPT', lv, MINUTES[lv],
      `Đề tự soạn mô phỏng cấu trúc JLPT ${lv} (rút gọn ${sections.reduce((a, s) => a + s.question_ids.length, 0)} câu, ${MINUTES[lv]} phút). Có phần nghe với audio đọc bằng giọng tổng hợp trên trình duyệt.`,
      JSON.stringify(sections), JSON.stringify({ ...SCORING[lv], note: NOTE }), now, now));
  }
  for (const l of Ls) (await db.prepare(`INSERT INTO lessons(title,situation,level,summary,dialogue,vocab,phrases,doc,culture,quiz,grammar_tags,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,'published',?,?)`).run(l.title, l.situation, l.level, l.summary, JSON.stringify(l.dialogue), JSON.stringify(l.vocab), JSON.stringify(l.phrases),
    JSON.stringify(l.doc), l.culture, JSON.stringify(l.quiz), JSON.stringify(l.grammar_tags), now, now));
});
console.log('Mở rộng:', await require('./extend').extend());
const n = async (t) => (await db.prepare(`SELECT COUNT(*) n FROM ${t}`).get()).n;
console.log(`Đã nạp: ${(await n('users'))} người dùng, ${(await n('questions'))} câu hỏi, ${(await n('exams'))} đề, ${(await n('lessons'))} bài học. DB: ${file}`);
await db.close();
})().catch((e) => { console.error(e); process.exit(1); });
