// Thêm nội dung mở rộng vào DB hiện có (idempotent): node seed/extend.js
const { db, tx } = require('../lib/db');
const X = require('./extra');
const SECNAME = { vocab: 'Văn tự - từ vựng', conversation: 'Hội thoại và biểu hiện', grammar: 'Ngữ pháp', reading: 'Đọc hiểu', listening: 'Nghe hiểu' };
const NOTE = 'Điểm quy đổi theo tỷ lệ câu đúng của từng phần (mô phỏng); kỳ thi thật dùng thang điểm tương đương hóa nên có thể chênh lệch.';
const ORDER = ['vocab', 'conversation', 'grammar', 'reading', 'listening'];
async function extend() {
  const now = Date.now(); let ne = 0, nl = 0, nq = 0;
  await tx(async () => {
    const old = async (lv) => JSON.parse((await db.prepare("SELECT scoring FROM exams WHERE level=? AND exam_type='JLPT' ORDER BY id LIMIT 1").get(lv)).scoring);
    for (const e of X.exams) {
      if ((await db.prepare('SELECT 1 FROM exams WHERE title=?').get(e.title))) continue;
      const qs = X.questions[e.key];
      const secs = {};
      for (const q of qs) {
        const r = (await db.prepare(`INSERT INTO questions(level,section,qtype,stem,passage,audio_script,options,answer,explanation,tags,status,created_by,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,'published',1,?,?)`).run(q.level, q.section, q.qtype, q.stem, q.passage || '', JSON.stringify(q.audio_script || []), JSON.stringify(q.options), q.answer, q.explanation, JSON.stringify(q.tags), now, now));
        const id = Number(r.lastInsertRowid);
        (await db.prepare('INSERT INTO question_versions(question_id,version,snapshot,changed_by,at) VALUES(?,?,?,?,?)').run(id, 1, JSON.stringify({ id, ...q, version: 1 }), 1, now));
        (secs[q.section] ||= []).push(id); nq++;
      }
      const sections = ORDER.filter((k) => secs[k]).map((k) => ({ key: k, name: SECNAME[k], question_ids: secs[k] }));
      const sc = X.SC[e.scKey] || (await old(e.scKey));
      (await db.prepare(`INSERT INTO exams(title,exam_type,level,duration_min,description,sections,scoring,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?, 'published',1,?,?)`)
        .run(e.title, e.type, e.level, e.min, e.desc || `Đề tự soạn mô phỏng cấu trúc JLPT ${e.level} (rút gọn ${qs.length} câu, ${e.min} phút). Phần nghe dùng giọng đọc tổng hợp của trình duyệt.`, JSON.stringify(sections), JSON.stringify({ ...sc, note: NOTE }), now, now));
      ne++;
    }
    for (const l of X.lessons) {
      if ((await db.prepare('SELECT 1 FROM lessons WHERE title=?').get(l.title))) continue;
      (await db.prepare(`INSERT INTO lessons(title,situation,level,summary,dialogue,vocab,phrases,doc,culture,quiz,grammar_tags,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'published',?,?)`)
        .run(l.title, l.situation, l.level, l.summary, JSON.stringify(l.dialogue), JSON.stringify(l.vocab), JSON.stringify(l.phrases), JSON.stringify(l.doc), l.culture, JSON.stringify(l.quiz), JSON.stringify(l.grammar_tags), now, now));
      nl++;
    }
  });
  let ng = 0, nc = 0;
  await tx(async () => {
    for (const g of require('./grammar')) {
      const r = (await db.prepare('INSERT INTO grammar(tag,level,title,meaning,structure,notes,examples,compare) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tag) DO UPDATE SET level=excluded.level,title=excluded.title,meaning=excluded.meaning,structure=excluded.structure,notes=excluded.notes,examples=excluded.examples,compare=excluded.compare').run(g.tag, g.level, g.title, g.meaning, g.structure, g.notes, JSON.stringify(g.examples), g.compare)); ng++;
    }
    for (const c of require('./courses')) {
      if ((await db.prepare('SELECT 1 FROM courses WHERE title=?').get(c.title))) continue;
      (await db.prepare('INSERT INTO courses(title,level,goal,description,weeks,steps) VALUES(?,?,?,?,?,?)').run(c.title, c.level, c.goal, c.description, c.weeks, JSON.stringify(c.steps))); nc++;
    }
  });
  return { exams: ne, lessons: nl, questions: nq, grammar: ng, courses: nc };
}
module.exports = { extend };
if (require.main === module) extend().then(async (r) => { console.log('Đã thêm:', r); await require('../lib/db').db.close(); }).catch((e) => { console.error(e); process.exit(1); });
