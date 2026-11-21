// Kiểm thử đầu-cuối trên DB tạm: node test/smoke.js
const { execFileSync } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nihongo-'));
process.env.DATA_DIR = tmp; process.env.UPLOAD_DIR = path.join(tmp, 'up');
// Kiểm thử XÓA SẠCH dữ liệu: chỉ chạy trên Postgres riêng cho kiểm thử (TEST_DATABASE_URL), mặc định dùng PGlite trong thư mục tạm
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; else delete process.env.DATABASE_URL;
delete process.env.SUPABASE_URL;   // kiểm thử lưu file trên ổ đĩa tạm
// Giả lập Google và Brevo (không gọi mạng thật)
process.env.GOOGLE_CLIENT_ID = 'test-client'; process.env.BREVO_API_KEY = 'test'; process.env.MAIL_FROM = 'no-reply@test.vn';
const mails = []; let googleInfo = null;
const realFetch = global.fetch;
global.fetch = async (url, o = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.brevo.com/')) { mails.push(JSON.parse(o.body)); return new Response('{"messageId":"x"}', { status: 201 }); }
  if (u.startsWith('https://oauth2.googleapis.com/tokeninfo')) return googleInfo ? new Response(JSON.stringify(googleInfo), { status: 200 }) : new Response('{}', { status: 400 });
  return realFetch(url, o);
};
execFileSync('node', [path.join(__dirname, '..', 'seed', 'seed.js'), '--reset'], { env: process.env, stdio: 'pipe' });
const app = require('../server');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

(async () => {
  const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}/api`;
  const jar = {};
  const call = async (who, method, url, body, headers = {}) => {
    const h = { ...headers }; if (jar[who]) h.cookie = jar[who];
    let b = body;
    if (body !== undefined && !Buffer.isBuffer(body) && typeof body !== 'string') { b = JSON.stringify(body); h['content-type'] = 'application/json'; }
    const r = await fetch(base + url, { method, headers: h, body: b });
    const sc = r.headers.get('set-cookie'); if (sc) jar[who] = sc.split(';')[0];
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('json') ? await r.json() : await r.text();
    return { s: r.status, d: data };
  };
  console.log('Tài khoản');
  let r = await call('u', 'POST', '/auth/register', { email: 'bad', password: '12345678' }); ok(r.s === 400, 'email sai bị từ chối');
  r = await call('u', 'POST', '/auth/register', { email: 'a@b.vn', password: '123' }); ok(r.s === 400, 'mật khẩu ngắn bị từ chối');
  r = await call('u', 'POST', '/auth/register', { email: 'a@b.vn', password: 'matkhau123', name: 'An' }); ok(r.s === 200 && r.d.role === 'learner', 'đăng ký thành công');
  r = await call('u', 'POST', '/auth/register', { email: 'a@b.vn', password: 'matkhau123' }); ok(r.s === 409, 'email trùng bị chặn');
  r = await call('u', 'PATCH', '/me', { goal: { type: 'both', level: 'N5', deadline: '2027-03-01' } }); ok(r.d.goal.level === 'N5', 'lưu mục tiêu');
  r = await call('anon', 'GET', '/dashboard'); ok(r.s === 401, 'chưa đăng nhập không vào được dashboard');

  console.log('Kho đề & lọc');
  r = await call('u', 'GET', '/exams'); ok(r.d.length === 8, '8 đề đã đăng');
  r = await call('u', 'GET', '/exams?level=N4'); ok(r.d.length === 3 && r.d.every((e) => e.level === 'N4'), 'lọc theo cấp độ');
  r = await call('u', 'GET', '/exams?level=N4&section=listening'); ok(r.d.length === 3, 'kết hợp nhiều bộ lọc');
  r = await call('u', 'GET', '/search?q=' + encodeURIComponent('benh vien')); ok(r.d.lessons.length === 1, 'tìm tiếng Việt không dấu: "benh vien"');
  r = await call('u', 'GET', '/search?q=' + encodeURIComponent('銀行')); ok(r.d.lessons.length >= 1, 'tìm tiếng Nhật: 銀行');

  console.log('Làm đề thi thật (N5)');
  const exams = (await call('u', 'GET', '/exams?level=N5')).d; const ex = exams.find((e) => e.question_count === 17);
  r = await call('u', 'POST', '/attempts', { exam_id: ex.id, mode: 'real' }); const at = r.d;
  ok(r.s === 200 && at.deadline > Date.now(), 'bắt đầu thi có hạn chót');
  ok(at.questions.length === 17, '17 câu');
  const leaked = JSON.stringify(at).match(/"answer"|"explanation"/);
  ok(!leaked, 'KHÔNG lộ đáp án/giải thích trong dữ liệu gửi về trình duyệt');
  ok(at.questions.filter((q) => q.section === 'listening').every((q) => q.tts.length > 0), 'câu nghe có kịch bản TTS cho trình phát');
  r = await call('u', 'POST', `/attempts/${at.id}/check`, { qid: at.questions[0].id }); ok(r.s === 403, 'thi thật không cho xem đáp án trước khi nộp');
  r = await call('u', 'POST', `/attempts/${at.id}/play`, { qid: at.questions[15].id }); ok(r.s === 200, 'lần nghe đầu được phép');
  r = await call('u', 'POST', `/attempts/${at.id}/play`, { qid: at.questions[15].id }); ok(r.s === 403, 'lần nghe thứ 2 bị chặn (thi thật)');
  r = await call('u', 'POST', '/attempts', { exam_id: ex.id, mode: 'real', sections: ['vocab'] }); ok(r.s === 400, 'thi thật không cho làm theo phần');
  // tự lưu + làm tiếp
  await call('u', 'PUT', `/attempts/${at.id}/answers`, { answers: { [at.questions[0].id]: { c: 0 }, [at.questions[1].id]: { c: 2, flag: true } }, leaves: 2 });
  r = await call('u', 'GET', `/attempts/${at.id}`); ok(r.d.answers[at.questions[0].id].c === 0 && r.d.answers[at.questions[1].id].flag === true, 'tải lại trang vẫn còn đáp án đã chọn và cờ đánh dấu');
  ok(!JSON.stringify(r.d).includes('"explanation"'), 'khi tải lại bài đang làm vẫn không lộ đáp án');
  r = await call('u', 'PUT', `/attempts/${at.id}/answers`, { answers: { [at.questions[0].id]: { c: 99 } } }); r = await call('u', 'GET', `/attempts/${at.id}`); ok(r.d.answers[at.questions[0].id].c === 0, 'đáp án ngoài phạm vi bị bỏ qua');
  // trả lời toàn bộ: biết đáp án đúng qua DB (chỉ test)
  const { db } = require('../lib/db');
  const snap = JSON.parse((await db.prepare('SELECT snapshot FROM attempts WHERE id=?').get(at.id)).snapshot);
  const ans = {}; snap.questions.forEach((q, i) => { ans[q.id] = { c: i < 14 ? q.answer : (q.answer + 1) % 4 }; });
  await call('u', 'PUT', `/attempts/${at.id}/answers`, { answers: ans });
  r = await call('u', 'POST', `/attempts/${at.id}/submit`);
  const att = r;
  ok(r.s === 200 && r.d.status === 'submitted', 'nộp bài');
  ok(r.d.result.correct === 14 && r.d.result.total === 17, 'chấm đúng 14/17');
  ok(r.d.result.groups.length === 2 && typeof r.d.result.passed === 'boolean', 'có điểm từng phần và kết quả đậu/rớt');
  ok(r.d.questions[0].explanation && r.d.questions[0].answer !== undefined, 'sau khi nộp mới có đáp án + giải thích');
  ok(r.d.questions.find((q) => q.tags.grammar?.includes('で(手段)')).lessons.length >= 1, 'FR-18: câu ngữ pháp được liên kết với bài đời sống');
  ok(r.d.leaves === 2, 'ghi nhận số lần rời tab');
  r = await call('u', 'PUT', `/attempts/${at.id}/answers`, { answers: {} }); ok(r.s === 409, 'không sửa được bài đã nộp');
  console.log('JFT-Basic / N2');
  r = await call('u', 'GET', '/exams?exam_type=JFT'); ok(r.d.length === 1 && r.d[0].sections.some((x) => x.key === 'conversation'), 'có đề JFT-Basic với phần Hội thoại và biểu hiện');
  r = await call('u', 'POST', '/attempts', { exam_id: r.d[0].id, mode: 'practice' }); const jf = r.d; r = await call('u', 'POST', `/attempts/${jf.id}/submit`);
  ok(r.d.result.maxScore === 250 && r.d.result.passScore === 200, 'JFT: thang 250, đạt 200');
  r = await call('u', 'GET', '/exams?level=N2'); ok(r.d.length === 1, 'có đề N2');
  console.log('Hết giờ');
  r = await call('u', 'POST', '/attempts', { exam_id: ex.id, mode: 'real' }); const at2 = r.d;
  (await db.prepare('UPDATE attempts SET deadline=? WHERE id=?').run(Date.now() - 60000, at2.id));
  r = await call('u', 'PUT', `/attempts/${at2.id}/answers`, { answers: {} }); ok(r.s === 409, 'hết giờ thì không lưu thêm');
  r = await call('u', 'POST', `/attempts/${at2.id}/submit`); ok(r.d.result.timed_out === true, 'nộp sau hạn được đánh dấu hết giờ');

  console.log('Luyện tập theo phần / dạng câu');
  r = await call('u', 'POST', '/attempts', { practice: { level: 'N5', section: 'grammar', qtype: 'Trợ từ', count: 10 } }); const pr = r.d;
  ok(r.s === 200 && pr.questions.every((q) => q.section === 'grammar'), 'luyện theo dạng câu Trợ từ');
  r = await call('u', 'POST', `/attempts/${pr.id}/check`, { qid: pr.questions[0].id }); ok(r.s === 200 && r.d.explanation, 'chế độ luyện xem được đáp án từng câu');
  r = await call('u', 'POST', '/attempts', { exam_id: ex.id, mode: 'practice', sections: ['grammar'] }); ok(r.s === 200 && r.d.questions.every((q) => q.section === 'grammar') && !r.d.deadline, 'làm theo phần, không giới hạn thời gian');

  console.log('Thống kê / gợi ý');
  r = await call('u', 'GET', '/stats'); ok(r.d.sections.length > 0 && r.d.history.length >= 1, 'có thống kê theo phần và lịch sử');
  r = await call('u', 'GET', '/dashboard'); ok(r.d.plan.length > 0 && r.d.inProgress.length >= 1, 'dashboard có lộ trình và bài đang làm');

  console.log('Bài học đời sống / flashcard');
  r = await call('u', 'GET', '/lessons'); ok(r.d.length === 10, '10 bài tình huống');
  const l1 = (await call('u', 'GET', '/lessons/1')).d;
  ok(!JSON.stringify(l1).includes('"answer"') || !l1.quiz.some((x) => 'answer' in x), 'bài kiểm tra không lộ đáp án');
  ok(l1.related_questions.length >= 1, 'bài học liên kết ngược tới câu đề thi');
  r = await call('u', 'POST', '/lessons/1/submit', { answers: [0, 0, 0] });
  const keyed = r.d.detail.map((d) => d.answer); r = await call('u', 'POST', '/lessons/1/submit', { answers: keyed }); ok(r.d.score === 3, 'chấm bài kiểm tra tình huống (đáp án đã xáo)');
  const ex1 = (await call('u', 'GET', '/exams?level=N5')).d[0]; const orders = new Set(); const pos = new Set();
  for (let i = 0; i < 10; i++) { const a = (await call('u', 'POST', '/attempts', { exam_id: ex1.id, mode: 'practice' })).d; orders.add(a.questions[0].options.join('|')); const ch = (await call('u', 'POST', `/attempts/${a.id}/check`, { qid: a.questions[0].id })).d; pos.add(ch.answer); await call('u', 'DELETE', `/attempts/${a.id}`); }
  ok(orders.size > 1 && pos.size > 1, 'thứ tự đáp án được xáo mỗi lần làm (vị trí đáp án đúng thay đổi)');
  r = await call('u', 'POST', '/cards', { front: '袋', reading: 'ふくろ', back: 'túi' }); ok(r.d.created, 'lưu flashcard');
  r = await call('u', 'POST', '/cards', { front: '袋', reading: 'ふくろ', back: 'túi' }); ok(!r.d.created, 'không trùng thẻ');
  let cards = (await call('u', 'GET', '/cards')).d; ok(cards.due.length === 1, 'thẻ mới đến hạn ôn ngay');
  r = await call('u', 'POST', `/cards/${cards.cards[0].id}/review`, { grade: 2 }); ok(r.d.interval === 1, 'ôn "tốt" lần 1 → hẹn 1 ngày');
  cards = (await call('u', 'GET', '/cards')).d; ok(cards.due.length === 0, 'sau khi ôn, thẻ không còn đến hạn');

  console.log('Bình luận / báo lỗi');
  const qid = att.d.questions[0].id;
  r = await call('u', 'POST', `/questions/${qid}/comments`, { body: 'Tại sao không phải と?' }); ok(r.s === 200, 'bình luận');
  const cid = r.d.id;
  await call('adm', 'POST', '/auth/login', { email: 'admin@nihongo.local', password: 'Admin@12345' });
  r = await call('adm', 'POST', `/questions/${qid}/comments`, { body: 'Vì...', parent_id: cid }); ok(r.s === 200, 'trả lời bình luận');
  r = await call('u', 'GET', '/dashboard'); ok(r.d.notifications.length === 1, 'người học nhận thông báo khi có trả lời');
  r = await call('u', 'POST', '/reports', { question_id: qid, type: 'dap-an', note: 'Đáp án đáng ngờ' }); ok(r.s === 200, 'báo lỗi câu hỏi');
  const rid = r.d.id;
  r = await call('u', 'GET', '/admin/overview'); ok(r.s === 403, 'học viên không vào được API quản trị');

  console.log('Quản trị: soạn câu, quy trình duyệt, phiên bản');
  await call('ed', 'POST', '/auth/login', { email: 'bientap@nihongo.local', password: 'Editor@12345' });
  await call('rv', 'POST', '/auth/login', { email: 'duyet@nihongo.local', password: 'Review@12345' });
  const newQ = { level: 'N5', section: 'grammar', qtype: 'Trợ từ', stem: 'わたしは パン＿＿ たべます。', options: ['を', 'が', 'で', 'へ'], answer: 0, explanation: 'を đánh dấu tân ngữ.', tags: { grammar: 'を(目的語)' } };
  r = await call('ed', 'POST', '/admin/questions', { ...newQ, options: ['を', 'を', 'で', 'へ'] }); ok(r.s === 422, 'đáp án trùng bị từ chối');
  r = await call('ed', 'POST', '/admin/questions', { ...newQ, explanation: '' }); ok(r.s === 422, 'thiếu giải thích bị từ chối');
  r = await call('ed', 'POST', '/admin/questions', newQ); const nq = r.d.id; ok(r.s === 200, 'biên tập viên soạn câu mới (nháp)');
  r = await call('ed', 'POST', `/admin/questions/${nq}/status`, { status: 'published' }); ok(r.s === 403, 'biên tập viên không tự đăng được (draft→published bị chặn)');
  r = await call('ed', 'POST', `/admin/questions/${nq}/status`, { status: 'pending' }); ok(r.s === 200, 'gửi duyệt');
  r = await call('ed', 'POST', `/admin/questions/${nq}/status`, { status: 'published' }); ok(r.s === 403, 'biên tập viên không duyệt được');
  r = await call('rv', 'POST', `/admin/questions/${nq}/status`, { status: 'published' }); ok(r.s === 200, 'người duyệt đăng');
  r = await call('rv', 'POST', '/admin/questions', newQ); ok(r.s === 403, 'người duyệt không soạn được');
  r = await call('u', 'POST', '/attempts', { practice: { level: 'N5', qtype: 'Trợ từ', count: 50 } });
  ok(r.d.questions.some((q) => q.id === nq), 'câu đã duyệt hiện cho người học');
  // phiên bản: sửa câu đã đăng không làm đổi điểm bài cũ
  const before = (await call('u', 'GET', `/attempts/${att.d.id}`)).d.result.score;
  const q0 = (await call('adm', 'GET', `/admin/questions/${qid}`)).d;
  r = await call('ed', 'PUT', `/admin/questions/${qid}`, { ...q0, answer: (q0.answer + 1) % 4 }); ok(r.d.version === 2 && r.d.status === 'pending', 'biên tập viên sửa câu đã đăng → v2, quay lại chờ duyệt');
  const after = (await call('u', 'GET', `/attempts/${att.d.id}`)).d.result.score; ok(before === after, 'kết quả cũ không đổi sau khi sửa đề (gắn phiên bản)');
  const oldView = (await call('u', 'GET', `/attempts/${att.d.id}`)).d.questions.find((q) => q.id === qid); ok(oldView.options[oldView.answer] === q0.options[q0.answer], 'xem lại bài cũ vẫn hiện đáp án đúng của phiên bản đã làm');
  await call('rv', 'POST', `/admin/questions/${qid}/status`, { status: 'published' });

  console.log('Quản trị: nhập hàng loạt (nguyên tử)');
  const head = 'level,section,qtype,stem,passage,option1,option2,option3,option4,answer,explanation,grammar,kanji,situation,audio_script\n';
  const good = 'N5,vocab,Chọn từ,"Câu có, dấu phẩy",,a,b,c,d,2,Giải thích 1,,,\nN5,listening,Nghe,Hỏi gì,,x,y,z,w,1,Giải thích 2,,,,"M:こんにちは|F:はい"\n';
  const badRow = 'N9,vocab,Chọn từ,Sai cấp,,a,b,c,d,2,GT,,,\n';
  const before2 = (await db.prepare('SELECT COUNT(*) n FROM questions').get()).n;
  r = await call('ed', 'POST', '/admin/import/questions', head + good + badRow, { 'content-type': 'text/csv' });
  ok(r.s === 422 && r.d.errors[0].row === 4, 'lỗi báo đúng số dòng (dòng 4)');
  ok((await db.prepare('SELECT COUNT(*) n FROM questions').get()).n === before2, 'có dòng lỗi → không nhập câu nào (không nhập một nửa)');
  r = await call('ed', 'POST', '/admin/import/questions', head + good, { 'content-type': 'text/csv' }); ok(r.s === 200 && r.d.imported === 2, 'nhập CSV hợp lệ (2 câu, có dấu phẩy trong ô)');
  const XLSX = require('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([head.trim().split(','), ['N4', 'grammar', 'Mẫu câu', 'Câu xlsx', '', 'a', 'b', 'c', 'd', 3, 'GT', '', '', '', '']]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'S1');
  r = await call('ed', 'POST', '/admin/import/questions', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { 'content-type': 'application/octet-stream' }); ok(r.s === 200 && r.d.imported === 1, 'nhập file Excel (.xlsx)');
  r = await call('adm', 'GET', '/admin/questions?status=draft'); ok(r.d.total >= 3, 'câu nhập vào ở trạng thái nháp');

  console.log('Quản trị: đề thi, báo lỗi, báo cáo, media, người dùng');
  const exAdmin = (await call('adm', 'GET', '/admin/exams')).d[0];
  r = await call('ed', 'POST', '/admin/exams', { ...exAdmin, title: 'Đề thử' }); const nexam = r.d.id; ok(r.s === 200, 'tạo đề mới');
  r = await call('rv', 'POST', `/admin/exams/${nexam}/status`, { status: 'pending' }); ok(r.s === 403 || r.s === 200, 'quy trình đề');
  await call('ed', 'POST', `/admin/exams/${nexam}/status`, { status: 'pending' });
  r = await call('adm', 'GET', '/admin/reports'); ok(r.d.length === 1 && r.d[0].status === 'open', 'báo lỗi hiện trong hộp thư quản trị');
  r = await call('ed', 'PATCH', `/admin/reports/${rid}`, { status: 'closed', reply: 'Cảm ơn, đã kiểm tra lại.' }); ok(r.s === 200, 'xử lý + trả lời báo lỗi');
  r = await call('u', 'GET', '/reports/mine'); ok(r.d[0].status === 'closed' && r.d[0].reply, 'người báo lỗi nhận được phản hồi');
  r = await call('adm', 'GET', '/admin/questions/stats'); ok(Array.isArray(r.d) && r.d.length > 0, 'báo cáo tỷ lệ đúng từng câu');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  r = await call('ed', 'POST', '/admin/media', png, { 'content-type': 'application/octet-stream', 'x-filename': 'a.png' }); const m1 = r.d; ok(r.s === 200 && !m1.reused, 'tải ảnh lên');
  r = await call('ed', 'POST', '/admin/media', png, { 'content-type': 'application/octet-stream', 'x-filename': 'copy.png' }); ok(r.d.reused && r.d.url === m1.url, 'tải lại cùng file → dùng lại, không lưu trùng');
  r = await call('ed', 'POST', '/admin/media', Buffer.from('<script>'), { 'content-type': 'application/octet-stream', 'x-filename': 'x.html' }); ok(r.s === 415, 'từ chối loại file không cho phép');
  const shaPng = require('crypto').createHash('sha256').update(png).digest('hex');
  r = await call('ed', 'POST', '/admin/media/sign', { filename: 'b.png', size: png.length, sha256: shaPng }); ok(r.s === 200 && r.d.mode === 'done' && r.d.url === m1.url, 'xin URL tải lên cho file đã có → dùng lại ngay');
  r = await call('ed', 'POST', '/admin/media/sign', { filename: 'n.mp3', size: 100, sha256: 'a'.repeat(64) }); ok(r.s === 200 && r.d.mode === 'server', 'không có Supabase → tải qua máy chủ');
  r = await call('ed', 'POST', '/admin/media/sign', { filename: 'n.mp3', size: 100, sha256: 'xyz' }); ok(r.s === 400, 'mã băm không hợp lệ bị từ chối');
  r = await call('ed', 'POST', '/admin/media/sign', { filename: 'n.exe', size: 100, sha256: 'a'.repeat(64) }); ok(r.s === 415, 'xin URL cho loại file cấm bị từ chối');
  r = await call('u', 'POST', '/admin/media/sign', { filename: 'n.mp3', size: 100, sha256: 'a'.repeat(64) }); ok(r.s === 403, 'học viên không tải media được');
  r = await call('ed', 'GET', '/admin/users'); ok(r.s === 403, 'biên tập viên không quản lý được người dùng');
  r = await call('adm', 'GET', '/admin/users'); const lu = r.d.find((x) => x.email === 'a@b.vn');
  r = await call('adm', 'PATCH', `/admin/users/${lu.id}`, { locked: true }); ok(r.s === 200, 'khóa tài khoản');
  r = await call('u', 'GET', '/me'); ok(r.d === null, 'tài khoản bị khóa mất phiên đăng nhập ngay');

  console.log('Ngữ pháp / chép chính tả / khóa học');
  await call('u3', 'POST', '/auth/register', { email: 'e@f.vn', password: 'matkhau123' });
  r = await call('u3', 'GET', '/grammar?level=N3'); ok(r.d.length >= 8 && r.d.every((g) => g.level === 'N3'), 'thư viện ngữ pháp lọc theo cấp độ');
  r = await call('u3', 'GET', '/grammar/item?tag=' + encodeURIComponent('で(手段)')); ok(r.d.examples.length >= 3 && r.d.question_count >= 1 && r.d.lessons.length >= 1, 'mẫu ngữ pháp có ví dụ, câu đề và bài đời sống liên quan');
  r = await call('u3', 'GET', '/dictation/sets/1'); ok(r.d.lines.length === 7 && r.d.lines[2].tts.includes('千二百円'), 'bộ chép chính tả lấy từ hội thoại bài học');
  r = await call('u3', 'POST', '/dictation/check', { lesson_id: 1, line: 2, answer: 'ぜんぶで せんにひゃくえんです' }); ok(r.d.ok === true, 'chép bằng hiragana được chấm đúng');
  r = await call('u3', 'POST', '/dictation/check', { lesson_id: 1, line: 2, answer: '全部で千二百円です。' }); ok(r.d.ok === true, 'chép bằng kanji + dấu câu cũng đúng');
  r = await call('u3', 'POST', '/dictation/check', { lesson_id: 1, line: 2, answer: 'ぜんぶで せんひゃくえんです' }); ok(!r.d.ok && r.d.marks.some((m) => !m.hit), 'chép sai được đánh dấu ký tự sai');
  r = await call('u3', 'GET', '/courses'); ok(r.d.length === 3, '3 khóa học');
  const courseId = r.d.find((c) => c.level === 'N5').id;
  r = await call('u3', 'POST', `/courses/${courseId}/enroll`); r = await call('u3', 'GET', `/courses/${courseId}`); ok(r.d.enrolled && r.d.done === 0 && r.d.next.type === 'grammar', 'đăng ký khóa học, bước đầu là ngữ pháp');
  await call('u3', 'POST', '/lessons/1/submit', { answers: [0, 0, 0] });
  r = await call('u3', 'GET', `/courses/${courseId}`); ok(r.d.steps.find((s) => s.type === 'lesson' && s.week === 1).done === true, 'làm xong bài học thì bước khóa học tự được đánh dấu');
  for (let i = 0; i < 4; i++) await call('u3', 'POST', '/dictation/check', { lesson_id: 1, line: i, answer: i === 2 ? 'ぜんぶでせんにひゃくえんです' : i === 0 ? 'いらっしゃいませ ふくろはいりますか' : i === 1 ? 'はいおねがいします' : 'カードではらえますか' });
  r = await call('u3', 'GET', `/courses/${courseId}`); ok(r.d.steps.find((s) => s.type === 'dictation').done === true, 'chép đủ một nửa số câu thì bước chép chính tả hoàn thành');
  r = await call('u3', 'GET', '/dashboard'); ok(r.d.course && r.d.plan[0].type === 'course', 'dashboard hiện bước tiếp theo của khóa học');
  console.log('Quản trị ngữ pháp / khóa học');
  const gnew = { tag: 'ばかり(直前)', level: 'N3', title: 'Vたばかり', meaning: 'Vừa mới làm xong', examples: [{ ja: '{食|た}べたばかりです。', vi: 'Tôi vừa mới ăn xong.' }] };
  r = await call('ed', 'POST', '/admin/grammar', { ...gnew, examples: [] }); ok(r.s === 422, 'ngữ pháp thiếu ví dụ bị từ chối');
  r = await call('ed', 'POST', '/admin/grammar', gnew); ok(r.s === 200, 'biên tập viên thêm mẫu ngữ pháp');
  r = await call('ed', 'POST', '/admin/grammar', gnew); ok(r.s === 409, 'không ghi đè mẫu đã có khi tạo mới');
  r = await call('u', 'GET', '/grammar/item?tag=' + encodeURIComponent('ばかり(直前)')); ok(r.s === 200 && r.d.examples.length === 1, 'người học thấy mẫu mới ngay');
  const cnew = { title: 'Khóa thử', level: 'N5', weeks: 2, goal: 'Thử', steps: [{ week: 1, type: 'grammar', ref: 'で(手段)', title: 'Học で' }, { week: 2, type: 'practice', level: 'N5', title: 'Luyện N5' }] };
  r = await call('ed', 'POST', '/admin/courses', { ...cnew, steps: [{ week: 3, type: 'exam', ref: 'Không có', title: 'x' }] }); ok(r.s === 422 && r.d.errors.length >= 2, 'khóa học tham chiếu sai bị từ chối, báo từng lỗi');
  r = await call('ed', 'POST', '/admin/courses', cnew); const nc = r.d.id; ok(r.s === 200, 'tạo khóa học (nháp)');
  r = await call('u', 'GET', '/courses'); ok(!r.d.some((c) => c.title === 'Khóa thử'), 'khóa nháp không hiện cho người học');
  r = await call('ed', 'POST', `/admin/courses/${nc}/status`, { status: 'pending' }); r = await call('ed', 'POST', `/admin/courses/${nc}/status`, { status: 'published' }); ok(r.s === 403, 'biên tập viên không tự đăng khóa học');
  r = await call('rv', 'POST', `/admin/courses/${nc}/status`, { status: 'published' }); r = await call('u', 'GET', '/courses'); ok(r.d.some((c) => c.title === 'Khóa thử'), 'sau khi duyệt, khóa học hiện cho người học');
  r = await call('adm', 'DELETE', '/admin/grammar?tag=' + encodeURIComponent('で(手段)')); ok(r.s === 409, 'không xóa mẫu ngữ pháp đang dùng trong khóa học');
  console.log('Ngân hàng đề: giảng viên, câu tự luận, chấm bài');
  r = await call('gv', 'POST', '/auth/login', { email: 'giangvien@nihongo.local', password: 'Teacher@12345' }); ok(r.s === 200 && r.d.role === 'teacher', 'giảng viên đăng nhập');
  r = await call('gv', 'GET', '/admin/overview'); ok(r.s === 200 && r.d.bank && typeof r.d.grading_pending === 'number', 'giảng viên vào khu quản trị, thấy thống kê ngân hàng');
  const essayQ = { kind: 'essay', level: 'N5', section: 'writing', qtype: 'Dịch Việt → Nhật', stem: 'Dịch: "Tôi là sinh viên."', model_answer: 'わたしは がくせいです。', accepted: ['わたしはがくせいです', '私は学生です'], points: 2, explanation: '' };
  r = await call('gv', 'POST', '/admin/questions', { ...essayQ, model_answer: '', accepted: [] }); ok(r.s === 422, 'câu tự luận thiếu đáp án mẫu bị từ chối');
  r = await call('gv', 'POST', '/admin/questions', { ...essayQ, points: 0 }); ok(r.s === 422, 'điểm câu ngoài 1-100 bị từ chối');
  r = await call('gv', 'POST', '/admin/questions', essayQ); const eq1 = r.d.id; ok(r.s === 200, 'giảng viên thêm câu tự luận (có đáp án chấp nhận)');
  r = await call('gv', 'POST', '/admin/questions', { kind: 'essay', level: 'N5', section: 'writing', stem: 'Viết 3 câu giới thiệu bản thân.', model_answer: 'Gợi ý chấm: đủ 3 câu, đúng です/ます.', points: 8 }); const eq2 = r.d.id; ok(r.s === 200, 'thêm câu tự luận dài (chấm tay)');
  r = await call('gv', 'POST', '/admin/questions', { kind: 'mcq', level: 'N5', section: 'grammar', stem: 'バス＿＿ 行きます。', options: ['で', 'を', 'に'], answer: 0, explanation: 'で chỉ phương tiện.' }); const mq = r.d.id; ok(r.s === 200, 'giảng viên thêm câu trắc nghiệm');
  r = await call('gv', 'GET', `/admin/questions/${eq1}`); ok(r.d.kind === 'essay' && r.d.options.length === 0 && r.d.accepted.length === 2 && r.d.points === 2, 'câu tự luận lưu đúng loại, đáp án chấp nhận, điểm');
  r = await call('gv', 'POST', `/admin/questions/${eq1}/status`, { status: 'published' }); ok(r.s === 200, 'giảng viên tự đăng câu của mình (không cần người duyệt)');
  for (const qid of [eq2, mq]) await call('gv', 'POST', `/admin/questions/${qid}/status`, { status: 'published' });
  r = await call('ed', 'POST', '/admin/questions', { kind: 'mcq', level: 'N5', section: 'vocab', stem: 'テスト', options: ['a', 'b'], answer: 0, explanation: 'x' }); const edDraft = r.d.id;
  r = await call('gv', 'PUT', `/admin/questions/${edDraft}`, { kind: 'mcq', level: 'N5', section: 'vocab', stem: 'sửa', options: ['a', 'b'], answer: 0, explanation: 'x' }); ok(r.s === 403, 'giảng viên không sửa được câu của người khác');
  r = await call('gv', 'POST', `/admin/questions/${edDraft}/status`, { status: 'pending' }); ok(r.s === 403, 'giảng viên không đổi trạng thái câu của người khác');
  r = await call('gv', 'GET', `/admin/questions/${edDraft}`); ok(r.s === 404, 'giảng viên không xem được câu nháp của người khác');
  r = await call('gv', 'GET', '/admin/questions?mine=1'); ok(r.d.total === 3 && r.d.items.every((x) => x.author === 'Giảng viên Mẫu'), 'lọc "câu của tôi" + hiện tên người tạo');
  r = await call('gv', 'GET', '/admin/questions?kind=essay'); ok(r.d.total === 2 && r.d.items.every((x) => x.kind === 'essay'), 'lọc theo loại câu tự luận');
  // tải file: trộn trắc nghiệm + tự luận, cột tiếng Việt
  const csv2 = 'Loại câu,level,section,Câu hỏi,Đáp án 1,Đáp án 2,Đáp án đúng,Giải thích,Đáp án mẫu,accepted,Điểm\n'
    + 'trắc nghiệm,N5,vocab,"{水|みず}の読み方",みず,すい,1,"水 đọc là みず",,,\n'
    + 'tự luận,N5,writing,"Viết từ ""nước"" bằng hiragana",,,,,みず,みず,3\n'
    + ',N5,writing,"Viết từ ""núi"" bằng hiragana",,,,,やま,やま|ヤマ,\n';
  r = await call('gv', 'POST', '/admin/import/questions', Buffer.from(csv2), { 'content-type': 'text/csv' }); ok(r.s === 200 && r.d.imported === 3 && r.d.mcq === 1 && r.d.essay === 2, 'tải CSV trộn trắc nghiệm + tự luận (cột tiếng Việt, tự nhận loại)');
  const impIds = r.d.ids || [];
  r = await call('gv', 'POST', '/admin/import/questions', Buffer.from('kind,level,section,stem,option1,option2,answer\nessay,N5,writing,"Thiếu đáp án mẫu",,,\nxyz,N5,vocab,abc,a,b,1\n'), { 'content-type': 'text/csv' });
  ok(r.s === 422 && r.d.errors.length === 2, 'file có câu tự luận thiếu đáp án mẫu / loại sai -> báo lỗi từng dòng, không nhập');
  r = await call('gv', 'GET', '/admin/import/template.xlsx'); ok(r.s === 200, 'tải file mẫu Excel');
  const wb2 = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet([['kind', 'level', 'section', 'stem', 'model_answer', 'points'], ['essay', 'N4', 'writing', 'Viết về sở thích', 'Gợi ý: dùng 〜のが好きです', 5]]), 'S');
  r = await call('gv', 'POST', '/admin/import/questions', XLSX.write(wb2, { type: 'buffer', bookType: 'xlsx' }), { 'content-type': 'application/octet-stream' }); ok(r.s === 200 && r.d.essay === 1, 'tải XLSX câu tự luận');
  // tạo đề giảng viên thang 10
  const scoring10 = { groups: [{ key: 'all', name: 'Toàn bài', sections: ['vocab', 'conversation', 'grammar', 'reading', 'listening', 'writing'], max: 10, min: 0 }], total_pass: 5, decimals: 1 };
  r = await call('gv', 'POST', '/admin/exams', { title: 'Kiểm tra lớp N5 - tuần 1', exam_type: 'CUSTOM', level: 'N5', duration_min: 30, scoring: scoring10, sections: [{ key: 'grammar', question_ids: [edDraft] }] });
  ok(r.s === 422, 'giảng viên không đưa câu nháp của người khác vào đề');
  r = await call('gv', 'POST', '/admin/exams', { title: 'Kiểm tra lớp N5 - tuần 1', exam_type: 'CUSTOM', level: 'N5', duration_min: 30, scoring: scoring10, sections: [{ key: 'grammar', question_ids: [mq] }, { key: 'writing', question_ids: [eq1, eq2] }] });
  const gex = r.d.id; ok(r.s === 200, 'giảng viên tạo đề riêng (thang 10)');
  r = await call('gv', 'POST', `/admin/exams/${gex}/status`, { status: 'published' }); ok(r.s === 200, 'giảng viên tự đăng đề của mình');
  r = await call('ed', 'PUT', `/admin/exams/${gex}`, { title: 'x', exam_type: 'CUSTOM', level: 'N5', duration_min: 30, scoring: scoring10, sections: [{ key: 'grammar', question_ids: [mq] }] }); ok(r.s === 200, 'biên tập viên vẫn sửa được đề (quyền chung)');
  await call('gv', 'PUT', `/admin/exams/${gex}`, { title: 'Kiểm tra lớp N5 - tuần 1', exam_type: 'CUSTOM', level: 'N5', duration_min: 30, scoring: scoring10, sections: [{ key: 'grammar', question_ids: [mq] }, { key: 'writing', question_ids: [eq1, eq2] }] });
  await call('gv', 'POST', `/admin/exams/${gex}/status`, { status: 'published' });
  // học viên làm đề
  await call('hv', 'POST', '/auth/login', { email: 'hocvien@nihongo.local', password: 'Hocvien@12345' });
  r = await call('hv', 'GET', '/exams?exam_type=CUSTOM'); ok(r.d.some((e) => e.id === gex), 'học viên thấy đề của giảng viên');
  r = await call('hv', 'POST', '/attempts', { exam_id: gex, mode: 'practice' }); const ga = r.d;
  const qE1 = ga.questions.find((q) => q.id === eq1), qE2 = ga.questions.find((q) => q.id === eq2), qM = ga.questions.find((q) => q.id === mq);
  ok(qE1 && qE1.kind === 'essay' && qE1.points === 2 && qE1.options.length === 0, 'câu tự luận gửi về đúng loại + điểm');
  ok(!JSON.stringify(ga).includes('model_answer') && !JSON.stringify(ga).includes('がくせいです') && !JSON.stringify(ga).includes('accepted'), 'KHÔNG lộ đáp án mẫu / đáp án chấp nhận khi đang làm');
  await call('hv', 'PUT', `/attempts/${ga.id}/answers`, { answers: { [eq1]: { t: 'ワタシハ　ガクセイデス。' }, [eq2]: { t: 'わたしは リンです。ベトナムじんです。よろしく おねがいします。', c: 1 } } });
  r = await call('hv', 'GET', `/attempts/${ga.id}`); ok(r.d.answers[eq1].t.startsWith('ワタシ') && r.d.answers[eq2].c === undefined, 'lưu bài viết tự luận; bỏ qua lựa chọn c ở câu tự luận');
  r = await call('hv', 'POST', `/attempts/${ga.id}/check`, { qid: eq1 }); ok(r.d.kind === 'essay' && r.d.model_answer && r.d.auto_ok === true, 'luyện tập: xem đáp án mẫu, báo khớp đáp án (katakana ≡ hiragana, bỏ dấu câu)');
  const gsnap = JSON.parse((await db.prepare('SELECT snapshot FROM attempts WHERE id=?').get(ga.id)).snapshot);
  await call('hv', 'PUT', `/attempts/${ga.id}/answers`, { answers: { [mq]: { c: gsnap.questions.find((q) => q.id === mq).answer } } });
  r = await call('hv', 'POST', `/attempts/${ga.id}/submit`); let R2 = r.d.result;
  ok(R2.pending_grading === 1 && R2.final === false, 'nộp bài: 1 câu tự luận chờ chấm');
  ok(R2.items.find((i) => i.qid === eq1).graded && R2.items.find((i) => i.qid === eq1).points === 2, 'câu khớp đáp án chấp nhận được tự chấm đủ điểm');
  ok(R2.score === 2.7 && R2.maxScore === 10, `điểm tạm tính thang 10 theo điểm từng câu (3/11 -> 2.7, nhận ${R2.score})`);
  ok(r.d.questions.find((q) => q.id === eq2).model_answer, 'sau khi nộp mới thấy đáp án mẫu');
  r = await call('hv', 'GET', '/attempts'); ok(r.d.find((x) => x.id === ga.id).pending_grading === 1, 'lịch sử hiện "chờ chấm"');
  // chấm bài
  r = await call('gv', 'GET', '/admin/grading'); ok(r.d.some((x) => x.id === ga.id && x.pending === 1), 'giảng viên thấy bài chờ chấm');
  r = await call('rv', 'POST', `/admin/grading/${ga.id}`, { grades: { [eq2]: { points: 5 } } }); ok(r.s === 403, 'người duyệt không chấm bài');
  r = await call('gv', 'GET', `/admin/grading/${ga.id}`); ok(r.d.items.length === 2 && r.d.items.find((x) => x.qid === eq2).text.includes('リン'), 'xem bài làm tự luận + đáp án mẫu');
  r = await call('gv', 'POST', `/admin/grading/${ga.id}`, { grades: { [eq2]: { points: 9 } } }); ok(r.s === 400, 'điểm vượt tối đa bị từ chối');
  r = await call('gv', 'POST', `/admin/grading/${ga.id}`, { grades: { [mq]: { points: 1 } } }); ok(r.s === 400, 'không chấm tay câu trắc nghiệm');
  r = await call('gv', 'POST', `/admin/grading/${ga.id}`, { grades: { [eq2]: { points: 6.5, feedback: 'Tốt, thiếu câu về sở thích.' } } });
  ok(r.s === 200 && r.d.pending === 0 && r.d.score === 8.6, `chấm xong, điểm cập nhật (9.5/11 -> 8.6, nhận ${r.d.score})`);
  r = await call('hv', 'GET', `/attempts/${ga.id}`); R2 = r.d.result;
  ok(R2.final && R2.passed === true && R2.items.find((i) => i.qid === eq2).feedback.includes('Tốt'), 'học viên thấy điểm chính thức + nhận xét');
  r = await call('hv', 'GET', '/dashboard'); ok(r.d.notifications.some((n) => n.text.includes('chấm xong')), 'học viên nhận thông báo đã chấm');
  r = await call('gv', 'GET', '/admin/grading'); ok(!r.d.some((x) => x.id === ga.id), 'bài đã chấm rời khỏi danh sách chờ');
  r = await call('gv', 'GET', '/admin/grading?status=all'); ok(r.d.some((x) => x.id === ga.id), 'vẫn xem lại / sửa điểm được ở "tất cả"');
  // giảng viên khác không chấm được
  const gv2 = (await db.prepare("INSERT INTO users(email,name,pass_hash,role,created_at) VALUES('gv2@x.vn','GV2',?, 'teacher', ?)").run(require('../lib/auth').hashPassword('Teacher@12345'), Date.now()));
  await call('gv2', 'POST', '/auth/login', { email: 'gv2@x.vn', password: 'Teacher@12345' });
  r = await call('gv2', 'GET', `/admin/grading/${ga.id}`); ok(r.s === 403, 'giảng viên khác không xem/chấm bài làm đề không phải của mình');
  r = await call('gv2', 'PUT', `/admin/exams/${gex}`, { title: 'x', exam_type: 'CUSTOM', level: 'N5', duration_min: 30, scoring: scoring10, sections: [{ key: 'grammar', question_ids: [mq] }] }); ok(r.s === 403, 'giảng viên khác không sửa được đề');
  r = await call('adm', 'PATCH', `/admin/users/${Number(gv2.lastInsertRowid)}`, { role: 'learner' }); ok(r.s === 200, 'quản trị viên đổi vai trò giảng viên');
  r = await call('gv', 'DELETE', `/admin/questions/${impIds[0]}`); ok(r.s === 200, 'giảng viên xóa câu nháp của mình');
  // luyện tập ngẫu nhiên có câu tự luận
  r = await call('hv', 'POST', '/attempts', { practice: { level: 'N5', section: 'writing', count: 10 } }); ok(r.s === 200 && r.d.questions.every((q) => q.kind === 'essay'), 'luyện tập phần Viết / Tự luận');

  console.log('Làm lại câu sai');
  r = await call('hv', 'POST', '/attempts', { practice: { level: 'N5', section: 'grammar', count: 5 } }); const ra = r.d;
  await call('hv', 'PUT', `/attempts/${ra.id}/answers`, { answers: { [ra.questions[0].id]: { c: 0 } } });
  r = await call('hv', 'POST', `/attempts/${ra.id}/submit`); const wrongN = r.d.result.items.filter((it) => !it.ok).length;
  r = await call('hv', 'POST', '/attempts', { practice: { retry: ra.id } }); ok(r.s === 200 && r.d.questions.length === wrongN && /^Làm lại câu sai/.test(r.d.title), 'tạo bài làm lại đúng các câu sai');
  r = await call('u3', 'POST', '/attempts', { practice: { retry: ra.id } }); ok(r.s === 404, 'không làm lại được bài của người khác');

  console.log('Đăng ký / đăng nhập / mật khẩu');
  r = await call('a1', 'POST', '/auth/register', { email: 'm@n.vn', password: 'chiconchu', name: 'M' }); ok(r.s === 400 && /chữ và số/.test(r.d.error), 'mật khẩu không có số bị từ chối');
  r = await call('a1', 'POST', '/auth/register', { email: 'm@n.vn', password: 'matkhau123', website: 'spam.com' }); ok(r.s === 400, 'bot điền ô bẫy bị chặn');
  r = await call('a1', 'POST', '/auth/register', { email: 'M@N.vn ', password: 'matkhau123', name: 'Minh' }); ok(r.s === 200 && r.d.email === 'm@n.vn' && r.d.has_password, 'đăng ký, email chuẩn hóa chữ thường');
  r = await call('a2', 'POST', '/auth/login', { email: 'm@n.vn', password: 'matkhau123' }); ok(r.s === 200, 'đăng nhập ở thiết bị thứ hai');
  r = await call('a1', 'POST', '/me/password', { current: 'sai12345', password: 'moimoi456' }); ok(r.s === 403, 'đổi mật khẩu: sai mật khẩu hiện tại bị từ chối');
  r = await call('a1', 'POST', '/me/password', { current: 'matkhau123', password: 'moimoi456' }); ok(r.s === 200, 'đổi mật khẩu thành công');
  r = await call('a1', 'GET', '/me'); ok(r.d?.email === 'm@n.vn', 'thiết bị vừa đổi mật khẩu vẫn đăng nhập');
  r = await call('a2', 'GET', '/me'); ok(r.d === null, 'thiết bị khác bị đăng xuất sau khi đổi mật khẩu');
  r = await call('a2', 'POST', '/auth/login', { email: 'm@n.vn', password: 'matkhau123' }); ok(r.s === 401, 'mật khẩu cũ không dùng được nữa');
  r = await call('a2', 'POST', '/auth/login', { email: 'm@n.vn', password: 'moimoi456' }); ok(r.s === 200, 'đăng nhập bằng mật khẩu mới');
  r = await call('a1', 'POST', '/auth/logout-all'); ok(r.s === 200, 'đăng xuất mọi thiết bị');
  r = await call('a2', 'GET', '/me'); ok(r.d === null, 'mọi phiên đều hết hiệu lực');
  r = await call('a3', 'GET', '/me', undefined, { cookie: 'sid=1.0.99999999999999.xxx' }); ok(r.d === null, 'cookie giả mạo không đăng nhập được');

  r = await call('anon', 'GET', '/auth/config'); ok(r.d.email_reset === true && r.d.google_client_id === 'test-client', 'cấu hình đăng nhập công khai');
  r = await call('anon', 'POST', '/auth/forgot', { email: 'khongco@x.vn' }); ok(r.s === 200 && mails.length === 0, 'quên mật khẩu với email lạ: trả lời như thường, không gửi thư');
  r = await call('anon', 'POST', '/auth/forgot', { email: 'm@n.vn' }); ok(r.s === 200 && mails.length === 1 && mails[0].to[0].email === 'm@n.vn', 'gửi email đặt lại mật khẩu');
  const tok = (mails[0].htmlContent.match(/dat-lai-mat-khau\?t=([\w-]+)/) || [])[1];
  r = await call('anon', 'GET', '/auth/reset?t=' + tok); ok(r.s === 200 && r.d.email === 'm@n.vn', 'mở link đặt lại mật khẩu');
  r = await call('anon', 'POST', '/auth/reset', { token: tok, password: 'ngan' }); ok(r.s === 400, 'mật khẩu mới yếu bị từ chối');
  r = await call('a4', 'POST', '/auth/reset', { token: tok, password: 'datlai789' }); ok(r.s === 200 && r.d.email === 'm@n.vn', 'đặt lại mật khẩu và đăng nhập luôn');
  r = await call('a4', 'POST', '/auth/reset', { token: tok, password: 'datlai000' }); ok(r.s === 410, 'link đặt lại chỉ dùng được một lần');
  r = await call('a5', 'POST', '/auth/login', { email: 'm@n.vn', password: 'datlai789' }); ok(r.s === 200, 'đăng nhập bằng mật khẩu vừa đặt lại');
  r = await call('anon', 'GET', '/auth/reset?t=abc'); ok(r.s === 410, 'link sai bị từ chối');

  r = await call('ed', 'POST', '/admin/users', { email: 'gv9@x.vn', role: 'teacher' }); ok(r.s === 403, 'chỉ quản trị viên tạo tài khoản');
  r = await call('adm', 'POST', '/admin/users', { email: 'gv9@x.vn', name: 'Cô Lan', role: 'teacher' }); ok(r.s === 200 && /dat-lai-mat-khau\?t=/.test(r.d.link), 'quản trị viên tạo tài khoản giảng viên, nhận link tự đặt mật khẩu');
  const tok2 = r.d.link.split('t=')[1];
  r = await call('a6', 'POST', '/auth/login', { email: 'gv9@x.vn', password: '' }); ok(r.s === 401, 'tài khoản chưa đặt mật khẩu không đăng nhập bằng mật khẩu rỗng');
  r = await call('a6', 'POST', '/auth/reset', { token: tok2, password: 'giangvien9' }); ok(r.s === 200 && r.d.role === 'teacher', 'giảng viên tự đặt mật khẩu lần đầu');
  r = await call('adm', 'POST', '/admin/users', { email: 'gv9@x.vn' }); ok(r.s === 409, 'không tạo trùng email');
  r = await call('adm', 'POST', '/admin/users', { email: 'hv9@x.vn', password: 'hocvien999', role: 'learner' }); ok(r.s === 200 && !r.d.link, 'tạo tài khoản có sẵn mật khẩu');
  const uid9 = r.d.id;
  r = await call('a7', 'POST', '/auth/login', { email: 'hv9@x.vn', password: 'hocvien999' }); ok(r.s === 200, 'học viên đăng nhập bằng mật khẩu được cấp');
  r = await call('adm', 'POST', `/admin/users/${uid9}/logout-all`); r = await call('a7', 'GET', '/me'); ok(r.d === null, 'quản trị viên đăng xuất người dùng khỏi mọi thiết bị');
  r = await call('adm', 'POST', `/admin/users/${uid9}/reset-link`); ok(r.s === 200 && r.d.hours === 24, 'quản trị viên cấp link đặt lại mật khẩu');
  r = await call('adm', 'GET', '/admin/users?q=hv9'); ok(r.d[0].last_login > 0 && r.d[0].has_password === true, 'danh sách người dùng có lần đăng nhập gần nhất');

  googleInfo = { aud: 'test-client', iss: 'https://accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), sub: 'g-123', email: 'Google.User@gmail.com', email_verified: 'true', name: 'Google User' };
  r = await call('g1', 'POST', '/auth/google', { credential: 'tok' }); ok(r.s === 200 && r.d.is_new && r.d.email === 'google.user@gmail.com' && r.d.google && !r.d.has_password, 'đăng nhập Google lần đầu tạo tài khoản');
  r = await call('g1', 'POST', '/auth/login', { email: 'google.user@gmail.com', password: 'gibberish1' }); ok(r.s === 401 && /Google/.test(r.d.error), 'tài khoản Google đăng nhập bằng mật khẩu được nhắc dùng Google');
  r = await call('g1', 'POST', '/auth/google', { credential: 'tok' }); ok(r.s === 200 && !r.d.is_new, 'đăng nhập Google lần sau dùng lại tài khoản');
  r = await call('g1', 'POST', '/me/password', { password: 'matkhau456' }); ok(r.s === 200 && r.d.has_password, 'tài khoản Google đặt thêm mật khẩu');
  googleInfo = { ...googleInfo, sub: 'g-456', email: 'm@n.vn', name: 'Minh G' };
  r = await call('g2', 'POST', '/auth/google', { credential: 'tok' }); ok(r.s === 200 && !r.d.is_new && r.d.name === 'Minh', 'Google cùng email liên kết vào tài khoản sẵn có');
  googleInfo = { ...googleInfo, aud: 'ung-dung-khac' };
  r = await call('g3', 'POST', '/auth/google', { credential: 'tok' }); ok(r.s === 401, 'token Google của ứng dụng khác bị từ chối');
  googleInfo = { ...googleInfo, aud: 'test-client', email_verified: 'false' };
  r = await call('g3', 'POST', '/auth/google', { credential: 'tok' }); ok(r.s === 401, 'email Google chưa xác minh bị từ chối');

  console.log('Lớp học & giao bài');
  r = await call('hv', 'POST', '/admin/classes', { name: 'X' }); ok(r.s === 403, 'học viên không tạo được lớp');
  r = await call('gv', 'POST', '/admin/classes', { name: 'N5 tối thứ 3' }); ok(r.s === 200 && /^[A-Z2-9]{6}$/.test(r.d.code), 'giảng viên tạo lớp, có mã 6 ký tự');
  const cls = r.d;
  r = await call('hv', 'POST', '/classes/join', { code: 'SAIMA1' }); ok(r.s === 404, 'mã lớp sai bị từ chối');
  r = await call('hv', 'POST', '/classes/join', { code: cls.code.toLowerCase() }); ok(r.s === 200 && r.d.id === cls.id, 'học viên vào lớp bằng mã (không phân biệt hoa thường)');
  r = await call('gv', 'POST', `/admin/classes/${cls.id}/members`, { emails: 'e@f.vn, khongco@x.vn' }); ok(r.d.added === 1 && r.d.not_found[0] === 'khongco@x.vn', 'thêm học viên bằng email, báo email chưa có tài khoản');
  r = await call('ed', 'GET', `/admin/classes/${cls.id}`); ok(r.s === 403, 'biên tập viên không xem lớp của giảng viên');
  r = await call('gv', 'POST', `/admin/classes/${cls.id}/assignments`, { exam_id: 1, title: 'Bài tuần 1', due_at: Date.now() + 86400e3, max_attempts: 2, mode: 'practice', show_answers: 'after_due' });
  ok(r.s === 200, 'giao đề cho lớp'); const cas1 = r.d.id;
  r = await call('hv', 'GET', '/dashboard'); ok(r.d.notifications.some((n) => n.text.includes('Bài tuần 1')), 'học viên nhận thông báo bài mới');
  r = await call('hv', 'GET', '/classes'); ok(r.d.classes.length === 1 && r.d.upcoming[0].id === cas1 && r.d.upcoming[0].status === 'todo', 'học viên thấy lớp và bài cần làm');
  r = await call('a7', 'POST', '/attempts', { assignment_id: cas1 }); ok(r.s === 401 || r.s === 404, 'người ngoài lớp không làm được bài giao');
  r = await call('hv', 'POST', '/attempts', { assignment_id: cas1 }); const cat1 = r.d; ok(r.s === 200 && cat1.assignment_id === cas1 && cat1.title === 'Bài tuần 1', 'học viên bắt đầu bài được giao');
  r = await call('hv', 'POST', '/attempts', { assignment_id: cas1 }); ok(r.d.id === cat1.id, 'bấm lại thì mở tiếp bài đang làm dở');
  r = await call('hv', 'POST', `/attempts/${cat1.id}/check`, { qid: cat1.questions[0].id }); ok(r.s === 403, 'không xem đáp án từng câu khi giảng viên khóa đáp án tới hạn nộp');
  await call('hv', 'PUT', `/attempts/${cat1.id}/answers`, { answers: { [cat1.questions[0].id]: { c: 0 }, [cat1.questions[1].id]: { c: 1 } } });
  r = await call('hv', 'POST', `/attempts/${cat1.id}/submit`); ok(r.s === 200 && r.d.answers_locked_until > 0 && r.d.questions[0].answer === undefined && r.d.result.score != null, 'nộp bài: thấy điểm nhưng chưa thấy đáp án');
  r = await call('hv', 'POST', '/attempts', { practice: { retry: cat1.id } }); ok(r.s === 403, 'không làm lại câu sai khi đáp án còn khóa');
  r = await call('gv', 'GET', `/admin/assignments/${cas1}`); const st = r.d.students;
  ok(st.find((x) => x.email === 'hocvien@nihongo.local').status === 'done' && st.find((x) => x.email === 'e@f.vn').status === 'todo', 'giảng viên thấy ai đã nộp, ai chưa');
  ok(r.d.questions.length > 0 && r.d.questions.every((q) => q.pct >= 0 && q.pct <= 100), 'phân tích tỷ lệ đúng từng câu của lớp');
  r = await call('gv', 'GET', `/attempts/${cat1.id}`); ok(r.s === 200 && r.d.review_of.email === 'hocvien@nihongo.local' && r.d.questions[0].answer !== undefined, 'giảng viên xem bài làm của học viên (kèm đáp án)');
  r = await call('ed', 'GET', `/attempts/${cat1.id}`); ok(r.s === 404, 'người khác không xem được bài làm của học viên');
  r = await call('gv', 'POST', `/admin/assignments/${cas1}/remind`); ok(r.s === 200 && r.d.reminded === 1, 'nhắc người chưa nộp');
  r = await call('u3', 'GET', '/dashboard'); ok(r.d.notifications.some((n) => n.text.startsWith('Nhắc')), 'người chưa nộp nhận lời nhắc');
  r = await call('hv', 'POST', '/attempts', { assignment_id: cas1 }); const cat2 = r.d; await call('hv', 'POST', `/attempts/${cat2.id}/submit`);
  r = await call('hv', 'POST', '/attempts', { assignment_id: cas1 }); ok(r.s === 403, 'hết số lượt làm bài');
  r = await call('gv', 'GET', `/admin/classes/${cls.id}/gradebook`); ok(r.d.rows.length === 2 && r.d.assignments.length === 1 && r.d.rows.find((x) => x.email === 'hocvien@nihongo.local').cells[0].pct != null, 'bảng điểm lớp');
  r = await call('gv', 'GET', `/admin/classes/${cls.id}/gradebook.xlsx`);
  ok(r.s === 200 && typeof r.d === 'string' && r.d.startsWith('PK'), 'xuất bảng điểm Excel');
  // hết hạn mà không cho nộp muộn
  r = await call('gv', 'POST', `/admin/classes/${cls.id}/assignments`, { exam_id: 2, due_at: Date.now() - 1000, allow_late: false }); const cas2 = r.d.id;
  r = await call('u3', 'POST', '/attempts', { assignment_id: cas2 }); ok(r.s === 403, 'quá hạn, không cho nộp muộn');
  r = await call('gv', 'GET', `/admin/assignments/${cas2}`); ok(r.d.students.every((x) => x.status === 'missing'), 'quá hạn chưa nộp → "không nộp"');
  // mở khóa đáp án khi hết hạn
  await call('gv', 'PATCH', `/admin/assignments/${cas1}`, { due_at: Date.now() - 1000 });
  r = await call('hv', 'GET', `/attempts/${cat1.id}`); ok(r.d.answers_locked_until === null && r.d.questions[0].answer !== undefined, 'hết hạn thì học viên xem được đáp án');
  r = await call('gv', 'PATCH', `/admin/classes/${cls.id}`, { new_code: true }); ok(r.d.code && r.d.code !== cls.code, 'đổi mã lớp');
  r = await call('hv', 'POST', `/classes/${cls.id}/leave`); r = await call('hv', 'GET', '/classes'); ok(r.d.classes.length === 0, 'học viên rời lớp');
  r = await call('gv', 'DELETE', `/admin/classes/${cls.id}`); ok(r.s === 200, 'xóa lớp');
  r = await call('hv', 'GET', `/attempts/${cat1.id}`); ok(r.s === 200, 'bài đã làm vẫn còn sau khi xóa lớp');

  console.log('Quyền riêng tư');
  r = await call('u2', 'POST', '/auth/register', { email: 'c@d.vn', password: 'matkhau123' });
  r = await call('u2', 'DELETE', '/me'); ok(r.s === 200, 'người dùng tự xóa tài khoản + dữ liệu');
  r = await call('u2', 'POST', '/auth/login', { email: 'c@d.vn', password: 'matkhau123' }); ok(r.s === 401, 'tài khoản đã xóa không đăng nhập lại được');
  for (let i = 0; i < 9; i++) await call('x', 'POST', '/auth/login', { email: 'zz@zz.vn', password: 'sai' });
  r = await call('x', 'POST', '/auth/login', { email: 'zz@zz.vn', password: 'sai' }); ok(r.s === 429, 'giới hạn thử đăng nhập sai');

  srv.close();
  console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
