// Lớp truy cập cơ sở dữ liệu PostgreSQL.
// - Có biến môi trường DATABASE_URL (Supabase, Render, Postgres tự cài...): dùng thư viện `pg`.
// - Không có: dùng PGlite (Postgres chạy ngay trong Node, lưu ở thư mục data/pg) để chạy thử trên máy mà không cần cài gì.
// Giữ kiểu gọi quen thuộc: await db.prepare(sql).get/all/run(...tham số), dấu ? được đổi sang $1, $2...
const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');

const URL_ = process.env.DATABASE_URL || '';
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
let file;            // mô tả nơi lưu, để in ra log
let driver;          // { query(sql, params, client), tx(fn), close() }

if (URL_) {
  const { Pool, types } = require('pg');
  types.setTypeParser(20, Number);      // bigint -> number (mốc thời gian ms, COUNT)
  types.setTypeParser(1700, Number);    // numeric -> number (SUM)
  const local = /localhost|127\.0\.0\.1/.test(URL_);
  const pool = new Pool({ connectionString: URL_, max: Number(process.env.DB_POOL || 5), ssl: local || process.env.DB_SSL === '0' ? false : { rejectUnauthorized: false } });
  pool.on('error', (e) => console.error('Lỗi kết nối DB:', e.message));
  file = URL_.replace(/:\/\/[^@]*@/, '://***@');
  driver = {
    query: (sql, params, client) => (client || pool).query(sql, params),
    async tx(fn) {
      const c = await pool.connect();
      try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
      catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
      finally { c.release(); }
    },
    close: () => pool.end(),
  };
} else {
  const { PGlite } = require('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR || (process.env.PGLITE_MEMORY ? undefined : path.join(dataDir, 'pg'));
  if (dir) fs.mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir, { parsers: { 20: Number, 1700: Number } });
  file = dir ? `PGlite ${dir}` : 'PGlite (bộ nhớ tạm)';
  driver = {
    query: async (sql, params, client) => { const r = await (client || pg).query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; },
    tx: (fn) => pg.transaction((t) => fn(t)),
    close: () => pg.close(),
  };
}

// Câu lệnh nằm trong tx() tự đi qua kết nối của giao dịch đó
const als = new AsyncLocalStorage();
// Đổi ? -> $n (bỏ qua chuỗi trong dấu nháy)
function toPg(sql) {
  let n = 0, out = '', q = null;
  for (const ch of sql) {
    if (q) { if (ch === q) q = null; out += ch; continue; }
    if (ch === "'" || ch === '"') { q = ch; out += ch; continue; }
    out += ch === '?' ? `$${++n}` : ch;
  }
  return out;
}
const ID_TABLES = /^\s*INSERT\s+INTO\s+(users|questions|exams|attempts|lessons|cards|comments|notifications|reports|courses|dictation_log|media)\b/i;
const clean = (v) => (v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

let ready;
async function raw(sql, params = []) {
  await ready;
  return driver.query(sql, params.map(clean), als.getStore());
}
const db = {
  prepare(sql) {
    let text = toPg(sql);
    if (ID_TABLES.test(text) && !/\bRETURNING\b/i.test(text)) text += ' RETURNING id';
    return {
      get: async (...a) => (await raw(text, a)).rows[0],
      all: async (...a) => (await raw(text, a)).rows,
      run: async (...a) => { const r = await raw(text, a); return { changes: r.rowCount, lastInsertRowid: r.rows?.[0]?.id }; },
    };
  },
  exec: async (sql) => { await ready; return driver.query(sql, [], als.getStore()); },
  close: () => driver.close(),
};
async function tx(fn) {
  await ready;
  if (als.getStore()) return fn();   // đã ở trong giao dịch
  return driver.tx((client) => als.run(client, fn));
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users(
    id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, pass_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'learner', goal TEXT NOT NULL DEFAULT '{}', settings TEXT NOT NULL DEFAULT '{}',
    locked INTEGER NOT NULL DEFAULT 0, plan TEXT NOT NULL DEFAULT 'free', created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS questions(
    id BIGSERIAL PRIMARY KEY, level TEXT NOT NULL, section TEXT NOT NULL, qtype TEXT NOT NULL DEFAULT '',
    stem TEXT NOT NULL, passage TEXT NOT NULL DEFAULT '', audio_script TEXT NOT NULL DEFAULT '[]',
    audio_url TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '',
    options TEXT NOT NULL, answer INTEGER NOT NULL, explanation TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'draft', version INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'tu-soan', created_by BIGINT, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'mcq', model_answer TEXT NOT NULL DEFAULT '', accepted TEXT NOT NULL DEFAULT '[]', points INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS question_versions(
    question_id BIGINT NOT NULL, version INTEGER NOT NULL, snapshot TEXT NOT NULL, changed_by BIGINT, at BIGINT NOT NULL,
    PRIMARY KEY(question_id, version))`,
  `CREATE TABLE IF NOT EXISTS exams(
    id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, exam_type TEXT NOT NULL, level TEXT NOT NULL,
    duration_min INTEGER NOT NULL, description TEXT NOT NULL DEFAULT '', sections TEXT NOT NULL,
    scoring TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', version INTEGER NOT NULL DEFAULT 1,
    created_by BIGINT, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS attempts(
    id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL, kind TEXT NOT NULL, exam_id BIGINT, exam_version INTEGER,
    mode TEXT NOT NULL, title TEXT NOT NULL, level TEXT NOT NULL DEFAULT '', snapshot TEXT NOT NULL,
    answers TEXT NOT NULL DEFAULT '{}', plays TEXT NOT NULL DEFAULT '{}', leaves INTEGER NOT NULL DEFAULT 0,
    started_at BIGINT NOT NULL, deadline BIGINT, submitted_at BIGINT, result TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress')`,
  'CREATE INDEX IF NOT EXISTS ix_attempts_user ON attempts(user_id, status)',
  `CREATE TABLE IF NOT EXISTS lessons(
    id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, situation TEXT NOT NULL, level TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
    dialogue TEXT NOT NULL DEFAULT '[]', vocab TEXT NOT NULL DEFAULT '[]', phrases TEXT NOT NULL DEFAULT '[]',
    doc TEXT NOT NULL DEFAULT 'null', culture TEXT NOT NULL DEFAULT '', quiz TEXT NOT NULL DEFAULT '[]',
    grammar_tags TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'draft', version INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS lesson_progress(
    user_id BIGINT NOT NULL, lesson_id BIGINT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, at BIGINT NOT NULL,
    PRIMARY KEY(user_id, lesson_id))`,
  `CREATE TABLE IF NOT EXISTS cards(
    id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL, kind TEXT NOT NULL DEFAULT 'vocab', front TEXT NOT NULL,
    reading TEXT NOT NULL DEFAULT '', back TEXT NOT NULL, source TEXT NOT NULL DEFAULT '',
    ease DOUBLE PRECISION NOT NULL DEFAULT 2.5, interval DOUBLE PRECISION NOT NULL DEFAULT 0, reps INTEGER NOT NULL DEFAULT 0,
    due BIGINT NOT NULL, created_at BIGINT NOT NULL, UNIQUE(user_id, front, kind))`,
  `CREATE TABLE IF NOT EXISTS comments(
    id BIGSERIAL PRIMARY KEY, question_id BIGINT NOT NULL, user_id BIGINT NOT NULL, parent_id BIGINT,
    body TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS notifications(
    id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL, text TEXT NOT NULL, link TEXT NOT NULL DEFAULT '',
    read INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reports(
    id BIGSERIAL PRIMARY KEY, question_id BIGINT NOT NULL, user_id BIGINT NOT NULL, type TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open', assignee BIGINT, reply TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS grammar(
    tag TEXT PRIMARY KEY, seq BIGSERIAL, level TEXT NOT NULL, title TEXT NOT NULL, meaning TEXT NOT NULL, structure TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '', examples TEXT NOT NULL DEFAULT '[]', compare TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS courses(
    id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL UNIQUE, level TEXT NOT NULL, goal TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
    weeks INTEGER NOT NULL DEFAULT 4, steps TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'published')`,
  `CREATE TABLE IF NOT EXISTS enrollments(
    user_id BIGINT NOT NULL, course_id BIGINT NOT NULL, started_at BIGINT NOT NULL, PRIMARY KEY(user_id, course_id))`,
  `CREATE TABLE IF NOT EXISTS dictation_log(
    id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL, lesson_id BIGINT NOT NULL, line INTEGER NOT NULL, ok INTEGER NOT NULL, ratio DOUBLE PRECISION NOT NULL, at BIGINT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS ix_dict ON dictation_log(user_id, lesson_id)',
  // file tải lên: lưu ở Supabase Storage (khi có cấu hình) hoặc thư mục uploads/
  `CREATE TABLE IF NOT EXISTS media(
    id BIGSERIAL PRIMARY KEY, sha256 TEXT UNIQUE NOT NULL, filename TEXT NOT NULL, mime TEXT NOT NULL, size BIGINT NOT NULL,
    path TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', created_at BIGINT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS ix_q_owner ON questions(created_by)',
  'CREATE INDEX IF NOT EXISTS ix_q_status ON questions(status, level, section)',
  'CREATE INDEX IF NOT EXISTS ix_notif_user ON notifications(user_id, read)',
  'CREATE INDEX IF NOT EXISTS ix_comments_q ON comments(question_id)',
];
const TABLES = ['users', 'questions', 'question_versions', 'exams', 'attempts', 'lessons', 'lesson_progress', 'cards', 'comments', 'notifications', 'reports', 'media', 'grammar', 'courses', 'enrollments', 'dictation_log'];
ready = (async () => { for (const s of SCHEMA) await driver.query(s, []); })();
ready.catch((e) => { console.error('Không khởi tạo được cơ sở dữ liệu:', e.message); });
// Xóa sạch dữ liệu và đặt lại bộ đếm id (dùng cho seed --reset)
async function resetAll() { await db.exec(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY`); }

const j = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
module.exports = { db, j, tx, file, ready, resetAll };
