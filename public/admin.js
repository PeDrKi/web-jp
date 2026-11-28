// Tải audio/ảnh: có Supabase thì trình duyệt gửi thẳng lên kho (file lớn không bị giới hạn của máy chủ),
// không thì gửi qua máy chủ như cũ.
async function uploadMedia(file) {
  const sha = crypto.subtle ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map((b) => b.toString(16).padStart(2, '0')).join('') : '';
  const info = { filename: file.name, size: file.size, sha256: sha };
  const s = sha ? await api('POST', '/admin/media/sign', info) : { mode: 'server' };
  if (s.mode === 'done') return s;
  if (s.mode === 'server') return api('POST', '/admin/media', { 'content-type': 'application/octet-stream', 'x-filename': encodeURIComponent(file.name) }, file);
  const up = await fetch(s.upload_url, { method: 'PUT', headers: { 'content-type': s.mime, 'x-upsert': 'true', 'cache-control': '604800' }, body: file });
  if (!up.ok) throw new Error('Tải file lên kho lưu trữ thất bại (' + up.status + ').');
  return api('POST', '/admin/media/commit', info);
}
/* Khu vực quản trị: soạn đề, nhập hàng loạt, duyệt, báo cáo (AD-01..AD-09) */
'use strict';
const ROLE = { admin: 'Quản trị viên', teacher: 'Giảng viên', editor: 'Biên tập viên', reviewer: 'Người duyệt', learner: 'Người học' };
const KINDS = { mcq: 'Trắc nghiệm', essay: 'Tự luận' };
const kindChip = (k) => `<span class="chip ${k === 'essay' ? 'verm' : ''}">${KINDS[k] || KINDS.mcq}</span>`;
const isTeacher = () => S.user.role === 'teacher';
const ownsIt = (x) => !isTeacher() || (x && x.created_by === S.user.id);
const stChip = (s) => `<span class="chip ${s === 'published' ? 'ok' : s === 'pending' ? 'warn' : s === 'removed' ? 'bad' : ''}">${STATUS[s] || s}</span>`;
const can = { edit: () => ['admin', 'editor', 'teacher'].includes(S.user.role), review: () => ['admin', 'reviewer'].includes(S.user.role), admin: () => S.user.role === 'admin',
  grade: () => ['admin', 'editor', 'teacher'].includes(S.user.role) };

function adminShell(active, html) {
  const items = isTeacher()
    ? [['', 'Tổng quan'], ['lop', 'Lớp học'], ['cau-hoi', 'Ngân hàng câu hỏi'], ['tai-de', 'Tải đề PDF/Word'], ['nhap', 'Tải đề lên (Excel/CSV)'], ['de', 'Đề thi'], ['cham-bai', 'Chấm tự luận'], ['bao-loi', 'Báo lỗi'], ['media', 'Kho audio/ảnh']]
    : [['', 'Tổng quan'], ...(can.admin() ? [['lop', 'Lớp học']] : []), ['cau-hoi', 'Ngân hàng câu hỏi'], ['tai-de', 'Tải đề PDF/Word'], ['nhap', 'Nhập hàng loạt'], ['de', 'Đề thi'], ['cham-bai', 'Chấm tự luận'], ['bai-hoc', 'Bài đời sống'], ['ngu-phap', 'Ngữ pháp'], ['khoa-hoc', 'Khóa học'], ['bao-loi', 'Báo lỗi'], ['binh-luan', 'Bình luận'], ['thong-ke', 'Báo cáo câu hỏi'], ['media', 'Kho audio/ảnh'], ...(can.admin() ? [['nguoi-dung', 'Người dùng']] : [])];
  view(`<div class="admin-wrap"><nav class="admin-nav card flat" aria-label="Quản trị">${items.map(([k, t]) => `<a href="#/quan-tri${k ? '/' + k : ''}" class="${k === active ? 'on' : ''}">${t}</a>`).join('')}<div class="small muted" style="padding:8px 12px">Vai trò: ${ROLE[S.user.role]}</div></nav><div id="ad">${html}</div></div>`);
}
const ST = { staff: true };

route(/^\/quan-tri$/, async () => {
  const o = await api('GET', '/admin/overview');
  const box = (t, v, link) => `<a class="card" href="#/quan-tri/${link}"><div class="muted small">${t}</div><div class="stat">${v}</div></a>`;
  adminShell('', `<h1>Tổng quan</h1><div class="grid g3">
    ${box('Câu hỏi chờ duyệt', o.questions.pending, 'cau-hoi?status=pending')}${box('Câu hỏi nháp', o.questions.draft, 'cau-hoi?status=draft')}${box('Câu hỏi đã đăng', o.questions.published, 'cau-hoi?status=published')}
    ${box('Đề đã đăng / chờ duyệt', `${o.exams.published} / ${o.exams.pending}`, 'de')}${box('Bài đời sống đã đăng / chờ', `${o.lessons.published} / ${o.lessons.pending}`, 'bai-hoc')}${box('Báo lỗi chưa xử lý', o.reports_open, 'bao-loi')}
    <div class="card"><div class="muted small">Người dùng</div><div class="stat">${o.users}</div></div><div class="card"><div class="muted small">Lượt nộp bài</div><div class="stat">${o.attempts}</div></div>
    ${box('Ngân hàng: trắc nghiệm / tự luận', `${o.bank.mcq} / ${o.bank.essay}`, 'cau-hoi')}${box('Bài tự luận chờ chấm', o.grading_pending, 'cham-bai')}</div>
    ${isTeacher() ? `<div class="alert info mt"><b>Dành cho giảng viên:</b> thêm từng câu (trắc nghiệm hoặc tự luận) ở <a href="#/quan-tri/cau-hoi/moi">Ngân hàng câu hỏi</a>, hoặc <a href="#/quan-tri/nhap">tải cả bộ đề từ Excel/CSV</a>. Giảng viên tự đăng câu hỏi và đề của mình, rồi chấm phần tự luận ở <a href="#/quan-tri/cham-bai">Chấm tự luận</a>.</div>` : ''}
    <div class="alert info mt">Quy trình nội dung: <b>Nháp → Chờ duyệt → Đã đăng → Đã gỡ</b>. Biên tập viên soạn và gửi duyệt; người duyệt (hoặc quản trị viên) đăng. Chỉ nội dung đã đăng mới đến tay người học.</div><div id="smp"></div>`);
  if (!can.admin()) return;
  const sm = await api('GET', '/admin/sample').catch(() => null);
  if (!sm || (!sm.old.length && sm.has_new)) return;
  $('#smp').innerHTML = `<div class="card mt"><h3 style="margin-top:0">Đề mẫu</h3>
    <p class="small">${sm.old.length ? `Web đang có <b>${sm.old.length} đề mô phỏng cài sẵn</b>: ${sm.old.map((e) => esc(e.title)).join(', ')}.` : 'Các đề mô phỏng cài sẵn đã được xóa.'}${sm.has_new ? '' : ` Đề mẫu mới: <b>${esc(sm.new_title)}</b> (153 câu, thang 10).`}</p>
    <p class="small muted">Bấm nút dưới đây để xóa các đề cài sẵn cùng câu hỏi của chúng${sm.has_new ? '' : ' và đưa đề mẫu mới vào Kho đề'}. Bài học, ngữ pháp, khóa học và tài khoản giữ nguyên. Lịch sử làm bài cũ vẫn còn. Không hoàn tác được.</p>
    <button class="accent" id="smp-go">${sm.old.length ? `Xóa ${sm.old.length} đề cài sẵn` : ''}${sm.old.length && !sm.has_new ? ', ' : ''}${sm.has_new ? '' : 'dùng đề Chuyên 10 số 01 làm mẫu'}</button></div>`;
  $('#smp-go').onclick = async () => {
    if (!(await confirmBox(`${sm.old.length ? `Xóa vĩnh viễn ${sm.old.length} đề cài sẵn và câu hỏi của chúng` : 'Thêm đề mẫu mới'}? Không hoàn tác được.`))) return;
    const b = $('#smp-go'); b.disabled = true;
    try { const r = await api('POST', '/admin/sample/replace');
      toast(`Đã xóa ${r.deleted_exams} đề, ${r.deleted_questions} câu hỏi${r.created ? `; đã thêm đề mẫu mới (${r.created.questions} câu)` : ''}.`);
      $('#smp').innerHTML = `<div class="alert ok mt">Xong. ${r.created ? `<a href="#/de/${r.created.id}">Xem đề mẫu mới</a>` : ''}</div>`;
    } catch (e) { b.disabled = false; toast(e.message, true); }
  };
}, ST);

/* ---- Câu hỏi ---- */
route(/^\/quan-tri\/cau-hoi$/, async () => {
  const q = S.query; const p = new URLSearchParams(q);
  const r = await api('GET', '/admin/questions?' + p);
  const sel = (id, opts, v) => `<select id="${id}" aria-label="${id}"><option value="">Tất cả</option>${opts.map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  adminShell('cau-hoi', `<div class="row between"><h1 style="margin:0">Ngân hàng câu hỏi (${r.total})</h1>${can.edit() ? '<div class="row"><a class="btn" href="#/quan-tri/nhap">⇪ Tải file đề</a><a class="btn" href="#/quan-tri/cau-hoi/moi?kind=essay">＋ Câu tự luận</a><a class="btn primary" href="#/quan-tri/cau-hoi/moi">＋ Câu trắc nghiệm</a></div>' : ''}</div>
  <div class="card flat mt"><div class="field-row">${sel('a-kind', Object.entries(KINDS), q.kind)}${sel('a-st', Object.entries(STATUS), q.status)}${sel('a-lv', ['N5', 'N4', 'N3', 'N2', 'N1'].map((l) => [l, l]), q.level)}${sel('a-sec', Object.entries(SECTIONS), q.section)}<input id="a-q" type="search" placeholder="Tìm nội dung, thẻ, ID…" value="${esc(q.q || '')}"></div>
    <label class="inline mt"><input type="checkbox" id="a-mine" ${q.mine ? 'checked' : ''}> Chỉ câu do tôi tạo</label></div>
  <div class="card tw mt"><table><tr><th>ID</th><th>Câu hỏi</th><th>Loại</th><th>Phần</th><th>Thẻ</th><th>Người tạo</th><th>Trạng thái</th><th></th></tr>${r.items.map((x) => `<tr><td>${x.id}<div class="small muted">v${x.version}</div></td><td class="jp">${esc(plain(x.stem).slice(0, 70))}</td><td>${kindChip(x.kind)}${diffChip(x.difficulty)}${x.points > 1 ? `<div class="small muted">${x.points} điểm</div>` : ''}</td><td>${chipLevel(x.level)} <div class="small">${esc(SECTIONS[x.section])}</div></td><td class="small">${[...(x.tags.grammar || []), ...(x.tags.kanji || [])].map((t) => `<span class="chip">${esc(t)}</span>`).join(' ')}</td><td class="small">${esc(x.author || '')}</td><td>${stChip(x.status)}</td><td><a class="btn sm" href="#/quan-tri/cau-hoi/${x.id}">Mở</a></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Không có câu hỏi.</td></tr>'}</table></div>
  <div class="row mt">${r.page > 1 ? `<a class="btn sm" href="#/quan-tri/cau-hoi?${new URLSearchParams({ ...q, page: r.page - 1 })}">← Trước</a>` : ''}<span class="muted small">Trang ${r.page}/${Math.max(1, Math.ceil(r.total / r.per))}</span>${r.page * r.per < r.total ? `<a class="btn sm" href="#/quan-tri/cau-hoi?${new URLSearchParams({ ...q, page: r.page + 1 })}">Sau →</a>` : ''}</div>`);
  const go = () => { const o = {}; for (const [k, id] of [['kind', 'a-kind'], ['status', 'a-st'], ['level', 'a-lv'], ['section', 'a-sec'], ['q', 'a-q']]) if ($('#' + id).value) o[k] = $('#' + id).value; if ($('#a-mine').checked) o.mine = '1'; nav('/quan-tri/cau-hoi?' + new URLSearchParams(o)); };
  $$('#a-kind,#a-st,#a-lv,#a-sec,#a-mine').forEach((e) => e.onchange = go); $('#a-q').onkeydown = (e) => { if (e.key === 'Enter') go(); };
}, ST);

const blankQ = () => ({ kind: 'mcq', model_answer: '', accepted: [], points: 1, level: 'N5', section: 'vocab', qtype: '', stem: '', passage: '', options: ['', '', '', ''], answer: 0, explanation: '', tags: { grammar: [], kanji: [], situation: [] }, audio_script: [], audio_url: '', image_url: '', status: 'draft', version: 0, versions: [] });
async function questionEditor(id) {
  const Q = id ? await api('GET', `/admin/questions/${id}`) : { ...blankQ(), ...(S.query.kind === 'essay' ? { kind: 'essay', section: 'writing', options: [] } : {}) };
  const mine = !id || ownsIt(Q);
  const editable = can.edit() && mine;
  const canRev = can.review() || (isTeacher() && mine);
  const T = isTeacher();
  const scriptTxt = (Q.audio_script || []).map((l) => `${l.speaker}: ${l.text}`).join('\n');
  adminShell('cau-hoi', `<a class="small" href="#/quan-tri/cau-hoi">← Danh sách</a>
  <div class="row between mt"><h1 style="margin:0">${id ? `Câu hỏi #${id} · v${Q.version}` : 'Câu hỏi mới'}</h1>${id ? stChip(Q.status) : ''}</div>
  <div class="grid g2 mt" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))"><form id="qf" class="card">
    ${id && !mine ? `<div class="alert mb">Câu hỏi của ${esc(Q.author || 'người khác')} trong ngân hàng chung: bạn chỉ xem được và có thể dùng nó khi tạo đề.</div>` : ''}
    <label>Loại câu hỏi</label><div class="row mb" role="radiogroup">${Object.entries(KINDS).map(([k, t]) => `<label class="inline"><input type="radio" name="kind" value="${k}" ${(Q.kind || 'mcq') === k ? 'checked' : ''}> ${t}</label>`).join('')}</div>
    <div class="field-row"><div><label>Cấp độ</label><select name="level">${['N5', 'N4', 'N3', 'N2', 'N1'].map((l) => `<option ${Q.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label>Phần thi</label><select name="section">${Object.entries(SECTIONS).map(([k, v]) => `<option value="${k}" ${Q.section === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label>Điểm tối đa</label><input name="points" type="number" min="1" max="100" value="${Q.points || 1}"></div>
      <div><label>Mức độ</label><select name="difficulty">${DIFFS.map((d, i) => `<option value="${i}" ${(Q.difficulty || 0) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      <div><label>Danh mục</label><select name="catalog"><option value="">Chưa xếp</option>${Object.entries(EXAM_KINDS).map(([k, t]) => `<option value="${k}" ${Q.catalog === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>Dạng câu</label><input name="qtype" value="${esc(Q.qtype)}" placeholder="VD: Trợ từ" list="qtypes"><datalist id="qtypes">${['Cách đọc Kanji', 'Chọn từ phù hợp', 'Trợ từ', 'Dạng て', 'Hội thoại', 'Đọc hiểu', 'Nghe hội thoại', 'Dịch Việt → Nhật', 'Dịch Nhật → Việt', 'Viết câu', 'Viết đoạn văn', 'Điền từ'].map((t) => `<option>${t}</option>`).join('')}</datalist></div></div>
    <label>Đoạn văn / ngữ cảnh (đọc hiểu, không bắt buộc)</label><textarea name="passage" rows="3">${esc(Q.passage)}</textarea>
    <label>Nội dung câu hỏi</label><textarea name="stem" rows="3" required>${esc(Q.stem)}</textarea>
    <div class="small muted">Furigana: <span class="kbd">{漢字|かんじ}</span> · Gạch chân: <span class="kbd">__chữ__</span></div>
    <div id="blk-mcq"><label>Đáp án (chọn nút tròn ở đáp án đúng)</label>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<div class="row" style="flex-wrap:nowrap;margin-bottom:6px"><input type="radio" name="ans" value="${i}" ${Q.answer === i ? 'checked' : ''} style="width:20px;min-height:0" aria-label="Đáp án ${i + 1} đúng"><input name="o${i}" value="${esc(Q.options[i] || '')}" placeholder="Đáp án ${i + 1}${i >= 4 ? ' (không bắt buộc)' : ''}"></div>`).join('')}</div>
    <div id="blk-essay"><div class="field-row"><div><label>Dạng tự luận</label><select name="etype"><option value="">Tự luận chung</option>${Object.entries(ETYPES).map(([k, t]) => `<option value="${k}" ${Q.etype === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>Giới hạn <span id="lim-unit">${lenUnit(Q.etype) === 'words' ? 'từ' : 'chữ'}</span> (0 = không giới hạn)</label><input name="max_len" type="number" min="0" max="5000" value="${Q.max_len || 0}"></div></div>
      <div class="small muted">Dịch Nhật → Việt đếm theo <b>từ</b>; các dạng viết tiếng Nhật đếm theo <b>chữ</b> (không tính khoảng trắng). Học viên không gõ được quá giới hạn.</div>
      <label>Đáp án mẫu / hướng dẫn chấm (người học chỉ thấy sau khi nộp)</label><textarea name="model_answer" rows="4" class="jp">${esc(Q.model_answer || '')}</textarea>
      <label>Đáp án ngắn được chấp nhận (mỗi dòng một đáp án, không bắt buộc)</label><textarea name="accepted" rows="2" class="jp" placeholder="わたしはがくせいです&#10;私は学生です">${esc((Q.accepted || []).join('\n'))}</textarea>
      <div class="small muted">Nếu câu trả lời khớp một dòng ở trên (bỏ qua dấu câu, khoảng trắng, katakana/hiragana), hệ thống tự chấm đủ điểm. Không khớp thì giảng viên chấm tay ở mục “Chấm tự luận”.</div></div>
    <label id="lbl-exp">Giải thích tiếng Việt (nêu vì sao các đáp án khác sai)</label><textarea name="explanation" rows="3">${esc(Q.explanation)}</textarea>
    <details class="more" ${(Q.tags.grammar || []).length || (Q.tags.kanji || []).length || (Q.tags.situation || []).length ? 'open' : ''}><summary>Thẻ phân loại <span class="small muted">(không bắt buộc · giúp thống kê điểm yếu và gợi ý bài học)</span></summary>
    <div class="field-row"><div><label>Mẫu ngữ pháp (cách nhau dấu phẩy)</label><input name="grammar" value="${esc((Q.tags.grammar || []).join(', '))}"></div><div><label>Kanji</label><input name="kanji" value="${esc((Q.tags.kanji || []).join(', '))}"></div><div><label>Tình huống</label><input name="situation" value="${esc((Q.tags.situation || []).join(', '))}"></div></div></details>
    <details class="more" id="blk-media" ${Q.section === 'listening' || scriptTxt || Q.audio_url || Q.image_url ? 'open' : ''}><summary>Audio, hình ảnh, kịch bản bài nghe <span class="small muted">(bắt buộc với phần Nghe hiểu)</span></summary>
    <label>Kịch bản bài nghe (mỗi dòng: <span class="kbd">M: lời</span> hoặc <span class="kbd">F: lời</span>) - dùng giọng đọc tổng hợp nếu chưa có file audio</label><textarea name="script" rows="4" class="jp">${esc(scriptTxt)}</textarea>
    <div class="field-row"><div><label>Audio (URL từ kho media)</label><input name="audio_url" value="${esc(Q.audio_url)}" placeholder="/uploads/…"></div><div><label>Hình ảnh (URL)</label><input name="image_url" value="${esc(Q.image_url)}" placeholder="/uploads/…"></div></div>
    <div class="row"><input type="file" id="up" accept=".mp3,.wav,.m4a,.ogg,.png,.jpg,.jpeg,.webp" style="width:auto"><span class="small muted" id="upmsg">Tải audio/ảnh: file trùng sẽ được dùng lại</span></div></details>
    <div id="qerr" class="alert bad mt" hidden></div>
    <div class="row mt savebar">${editable ? '<button class="primary" id="save">Lưu</button>' : ''}
      ${id && Q.status === 'draft' && editable ? (T ? '<button type="button" class="accent" id="to-pub">Đăng vào ngân hàng</button>' : '<button type="button" id="to-pending">Gửi duyệt</button>') : ''}
      ${id && Q.status === 'pending' && canRev ? '<button type="button" class="accent" id="to-pub">Duyệt & đăng</button><button type="button" id="to-draft">Trả về nháp</button>' : ''}
      ${id && Q.status === 'published' && canRev ? '<button type="button" class="danger" id="to-removed">Gỡ khỏi người học</button>' : ''}
      ${id && Q.status === 'removed' && editable ? `${T ? '<button type="button" class="accent" id="to-pub">Đăng lại</button>' : ''}<button type="button" id="to-draft2">Chuyển về nháp</button>` : ''}
      ${id && (can.admin() || (T && mine)) && Q.status !== 'published' ? '<button type="button" class="danger ghost" id="del">Xóa</button>' : ''}</div>
    ${id && Q.status === 'published' && S.user.role === 'editor' ? '<div class="small muted mt">Lưu thay đổi sẽ tạo phiên bản mới và đưa câu hỏi về “Chờ duyệt”. Kết quả cũ của người học vẫn giữ theo phiên bản họ đã làm.</div>' : ''}
  </form>
  <div class="sticky-col"><div class="card"><h3>Xem trước (đúng như người học thấy)</h3><div id="pv" class="preview qcard"></div></div>
    ${id ? `<div class="card mt"><h3>Lịch sử phiên bản</h3>${Q.versions.map((v) => `<div class="small">v${v.version} · ${fmtDate(v.at)}</div>`).join('')}</div>` : ''}</div></div>`);
  const f = $('#qf');
  const read = () => {
    const fd = new FormData(f);
    const script = String(fd.get('script') || '').split('\n').map((s) => s.trim()).filter(Boolean).map((s) => { const m = s.match(/^([MFmf])\s*[:：]\s*(.*)$/); return m ? { speaker: m[1].toUpperCase(), text: m[2] } : { speaker: 'M', text: s }; });
    const kind = fd.get('kind') || 'mcq';
    return { kind, points: Number(fd.get('points') || 1), difficulty: Number(fd.get('difficulty') || 0), catalog: fd.get('catalog') || '', etype: fd.get('etype') || '', max_len: Number(fd.get('max_len') || 0), model_answer: fd.get('model_answer'), accepted: String(fd.get('accepted') || '').split('\n').map((x) => x.trim()).filter(Boolean),
      level: fd.get('level'), section: fd.get('section'), qtype: fd.get('qtype'), passage: fd.get('passage'), stem: fd.get('stem'), options: kind === 'essay' ? [] : [0, 1, 2, 3, 4, 5].map((i) => fd.get('o' + i)).filter((o, i, a) => o || a.slice(i + 1).some(Boolean)), answer: Number(fd.get('ans')), explanation: fd.get('explanation'),
      tags: { grammar: fd.get('grammar'), kanji: fd.get('kanji'), situation: fd.get('situation') }, audio_script: script, audio_url: fd.get('audio_url'), image_url: fd.get('image_url') };
  };
  const preview = () => {
    const q = read();
    $('#pv').innerHTML = `<div class="row mb"><span class="chip">${esc(q.level)}</span><span class="chip">${esc(SECTIONS[q.section])}</span></div>
      ${q.audio_script.length || q.audio_url ? `<div class="audio-box"><button type="button" class="ic" id="pv-play">▶</button><div><b>Bài nghe</b></div></div>` : ''}${q.image_url ? `<img src="${esc(q.image_url)}" alt="" style="max-width:100%">` : ''}
      ${q.passage ? `<div class="passage">${rich(q.passage)}</div>` : ''}<p class="stem">${rich(q.stem)}</p>
      ${q.kind === 'essay' ? `<textarea rows="4" disabled placeholder="${ESSAY_HINT[q.etype] || 'Người học viết câu trả lời ở đây…'}"></textarea><div class="small muted">${esc(ETYPES[q.etype] || 'Tự luận')} · ${q.points} điểm${q.max_len ? ` · tối đa ${q.max_len} ${lenUnit(q.etype) === 'words' ? 'từ' : 'chữ'}` : ''}</div>${q.model_answer ? `<div class="explain"><b>Đáp án mẫu:</b><div class="jp">${rich(q.model_answer)}</div></div>` : ''}`
        : `<div class="opts">${q.options.map((o, i) => `<div class="opt ${i === q.answer ? 'right' : ''}"><span class="n">${i + 1}</span><span>${rich(o)}</span></div>`).join('')}</div>`}${q.explanation ? `<div class="explain">${rich(q.explanation)}</div>` : ''}`;
    const pp = $('#pv-play'); if (pp) pp.onclick = () => q.audio_url ? playUrl(q.audio_url) : speak(q.audio_script);
  };
  const toggleKind = () => { const es = (new FormData(f).get('kind') || 'mcq') === 'essay'; $('#blk-mcq').hidden = es; $('#blk-essay').hidden = !es;
    $('#lbl-exp').textContent = es ? 'Giải thích / ghi chú thêm (không bắt buộc)' : 'Giải thích tiếng Việt (nêu vì sao các đáp án khác sai)'; };
  f.oninput = preview; f.onchange = (e) => { toggleKind(); preview(); $('#lim-unit').textContent = lenUnit(f.elements.etype.value) === 'words' ? 'từ' : 'chữ'; if (e.target.name === 'section' && e.target.value === 'listening') $('#blk-media').open = true; }; toggleKind(); preview();
  if (!editable) $$('#qf input, #qf textarea, #qf select').forEach((el) => { el.disabled = true; });
  $('#up').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const r = await uploadMedia(file);
      f.elements[/^audio/.test(r.mime) ? 'audio_url' : 'image_url'].value = r.url; $('#upmsg').textContent = r.reused ? 'File đã có sẵn trong kho, dùng lại.' : 'Đã tải lên.'; preview(); } catch (er) { toast(er.message, true); }
  };
  const setStatus = (s) => async () => { try { await api('POST', `/admin/questions/${id}/status`, { status: s }); toast('Đã cập nhật trạng thái.'); render(); } catch (e) { toast(e.message, true); } };
  const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
  on('#to-pending', setStatus('pending')); on('#to-pub', setStatus('published')); on('#to-draft', setStatus('draft')); on('#to-draft2', setStatus('draft')); on('#to-removed', setStatus('removed'));
  on('#del', async () => { if (await confirmBox('Xóa câu hỏi này?')) { try { await api('DELETE', `/admin/questions/${id}`); nav('/quan-tri/cau-hoi'); } catch (e) { toast(e.message, true); } } });
  f.onsubmit = async (e) => {
    e.preventDefault(); if (!editable) return;
    try { const r = await api(id ? 'PUT' : 'POST', id ? `/admin/questions/${id}` : '/admin/questions', read()); toast('Đã lưu.'); if (id) render(); else nav('/quan-tri/cau-hoi/' + r.id); }
    catch (er) { const b = $('#qerr'); b.hidden = false; b.innerHTML = (er.data?.errors || [er.message]).map(esc).join('<br>'); }
  };
}
route(/^\/quan-tri\/cau-hoi\/moi$/, () => questionEditor(null), ST);
route(/^\/quan-tri\/cau-hoi\/(\d+)$/, (id) => questionEditor(Number(id)), ST);

/* ---- Nhập hàng loạt (AD-02) ---- */
route(/^\/quan-tri\/nhap$/, async () => {
  adminShell('nhap', `<h1>Tải đề lên ngân hàng câu hỏi</h1>
  <div class="card"><p>Tải file <b>Excel (.xlsx)</b> hoặc <b>CSV</b> theo mẫu. Một file có thể chứa cả câu <b>trắc nghiệm</b> và <b>tự luận</b>. Hệ thống kiểm tra từng dòng: <b>nếu có dòng lỗi thì không nhập câu nào</b>, và báo rõ dòng nào sai. Các câu nhập vào ở trạng thái <b>Nháp</b>${isTeacher() ? ', bạn mở từng câu hoặc chọn “Đăng tất cả” bên dưới để đưa vào ngân hàng' : ''}.</p>
    <div class="row"><a class="btn primary" href="/api/admin/import/template.xlsx">Tải file mẫu Excel (có hướng dẫn)</a><a class="btn" href="/api/admin/import/template.csv">Tải file mẫu CSV</a></div>
    <details class="mt"><summary><b>Các cột trong file</b></summary><div class="tw"><table class="small">
      <tr><th>Cột</th><th>Trắc nghiệm</th><th>Tự luận</th></tr>
      <tr><td><span class="kbd">kind</span></td><td><span class="kbd">mcq</span> (hoặc bỏ trống)</td><td><span class="kbd">essay</span> / “tự luận”</td></tr>
      <tr><td><span class="kbd">level, section, stem</span></td><td colspan="2">Bắt buộc. <span class="kbd">section</span>: vocab / grammar / reading / listening / conversation / writing</td></tr>
      <tr><td><span class="kbd">option1..option4</span>, <span class="kbd">answer</span></td><td>Bắt buộc (answer = 1-4)</td><td>Bỏ trống</td></tr>
      <tr><td><span class="kbd">explanation</span></td><td>Bắt buộc</td><td>Không bắt buộc</td></tr>
      <tr><td><span class="kbd">model_answer</span></td><td>-</td><td>Đáp án mẫu / hướng dẫn chấm</td></tr>
      <tr><td><span class="kbd">accepted</span></td><td>-</td><td>Đáp án ngắn chấp nhận, cách nhau <span class="kbd">|</span> → tự chấm</td></tr>
      <tr><td><span class="kbd">points</span></td><td colspan="2">Điểm tối đa của câu (mặc định 1)</td></tr>
      <tr><td><span class="kbd">grammar, kanji, situation, audio_script</span></td><td colspan="2">Không bắt buộc. audio_script: <span class="kbd">M:lời|F:lời</span></td></tr></table></div>
      <p class="small muted">Tên cột tiếng Việt cũng được: “Loại câu”, “Câu hỏi”, “Đáp án 1”…, “Đáp án đúng”, “Giải thích”, “Đáp án mẫu”, “Điểm”. File Word chưa được hỗ trợ - hãy dán sang Excel theo mẫu.</p></details>
    ${can.edit() ? `<input type="file" id="imp" accept=".csv,.xlsx" class="mt"><div id="imp-out" class="mt"></div>` : '<div class="alert">Bạn không có quyền nhập.</div>'}</div>`);
  const inp = $('#imp'); if (!inp) return;
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return; const out = $('#imp-out'); out.innerHTML = 'Đang xử lý…';
    try {
      const isX = /\.xlsx$/i.test(file.name);
      const body = isX ? await file.arrayBuffer() : await file.text();
      const r = await api('POST', '/admin/import/questions', { 'content-type': isX ? 'application/octet-stream' : 'text/csv' }, body);
      out.innerHTML = `<div class="alert ok">Đã nhập <b>${r.imported}</b> câu (${r.mcq} trắc nghiệm, ${r.essay} tự luận), trạng thái Nháp. <a href="#/quan-tri/cau-hoi?status=draft&mine=1">Xem các câu vừa nhập</a>
        ${isTeacher() ? '<div class="row mt"><button class="accent sm" id="pub-all">Đăng tất cả vào ngân hàng</button></div>' : ''}</div>`;
      const pa = $('#pub-all'); if (pa) pa.onclick = async () => {
        pa.disabled = true; let okN = 0; const errs = [];
        for (const qid of r.ids) { try { await api('POST', `/admin/questions/${qid}/status`, { status: 'published' }); okN++; } catch (e) { errs.push(`#${qid}: ${e.message}`); } }
        toast(`Đã đăng ${okN}/${r.ids.length} câu.`, !!errs.length); if (errs.length) out.insertAdjacentHTML('beforeend', `<div class="alert bad mt">${errs.map(esc).join('<br>')}</div>`);
      };
    } catch (e) {
      out.innerHTML = `<div class="alert bad"><b>${esc(e.message)}</b>${(e.data?.errors || []).map((x) => `<div>Dòng ${x.row}: ${(x.errors || []).map(esc).join('; ')}</div>`).join('')}</div>`;
    }
  };
}, ST);

/* ---- Đề thi ---- */
const SCORING_PRESETS = {
  N5: { groups: [{ key: 'language', name: 'Kiến thức ngôn ngữ + Đọc hiểu', sections: ['vocab', 'grammar', 'reading'], max: 120, min: 38 }, { key: 'listening', name: 'Nghe hiểu', sections: ['listening'], max: 60, min: 19 }], total_pass: 80 },
  N4: { groups: [{ key: 'language', name: 'Kiến thức ngôn ngữ + Đọc hiểu', sections: ['vocab', 'grammar', 'reading'], max: 120, min: 38 }, { key: 'listening', name: 'Nghe hiểu', sections: ['listening'], max: 60, min: 19 }], total_pass: 90 },
  N3: { groups: [{ key: 'language', name: 'Kiến thức ngôn ngữ', sections: ['vocab', 'grammar'], max: 60, min: 19 }, { key: 'reading', name: 'Đọc hiểu', sections: ['reading'], max: 60, min: 19 }, { key: 'listening', name: 'Nghe hiểu', sections: ['listening'], max: 60, min: 19 }], total_pass: 95 },
  N2: { groups: [{ key: 'language', name: 'Kiến thức ngôn ngữ + Đọc hiểu', sections: ['vocab', 'grammar', 'reading'], max: 120, min: 38 }, { key: 'listening', name: 'Nghe hiểu', sections: ['listening'], max: 60, min: 19 }], total_pass: 90 },
  N1: { groups: [{ key: 'language', name: 'Kiến thức ngôn ngữ + Đọc hiểu', sections: ['vocab', 'grammar', 'reading'], max: 120, min: 19 }, { key: 'listening', name: 'Nghe hiểu', sections: ['listening'], max: 60, min: 19 }], total_pass: 100 },
};
// Thang điểm cho đề giảng viên tự ra: tính trên toàn bài theo điểm từng câu
const ALL_SECS = ['vocab', 'conversation', 'grammar', 'reading', 'listening', 'writing'];
const CUSTOM_PRESETS = {
  ten: { groups: [{ key: 'all', name: 'Toàn bài', sections: ALL_SECS, max: 10, min: 0 }], total_pass: 5, decimals: 1, note: 'Thang điểm 10, quy đổi theo điểm từng câu.' },
  hundred: { groups: [{ key: 'all', name: 'Toàn bài', sections: ALL_SECS, max: 100, min: 0 }], total_pass: 50, note: 'Thang điểm 100, quy đổi theo điểm từng câu.' },
};
route(/^\/quan-tri\/de$/, async () => {
  const list = await api('GET', '/admin/exams');
  adminShell('de', `<div class="row between"><h1 style="margin:0">Đề thi</h1>${can.edit() ? '<div class="row"><a class="btn" href="#/quan-tri/tai-de">⇪ Tải đề PDF/Word</a><a class="btn primary" href="#/quan-tri/de/moi">＋ Tạo đề</a></div>' : ''}</div>
  <div class="card tw mt"><table><tr><th>Đề</th><th>Cấp</th><th>Số câu</th><th>Người tạo</th><th>Trạng thái</th><th></th></tr>${list.map((e) => `<tr><td>${esc(e.title)}<div class="small muted">v${e.version}</div></td><td>${esc(e.exam_type === 'CUSTOM' ? 'Đề GV' : e.exam_type)} ${esc(e.level)}</td><td>${e.sections.reduce((a, s) => a + s.question_ids.length, 0)}</td><td class="small">${esc(e.author || '')}</td><td>${stChip(e.status)}</td><td><a class="btn sm" href="#/quan-tri/de/${e.id}">Mở</a></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Chưa có đề.</td></tr>'}</table></div>`);
}, ST);
async function examEditor(id) {
  const list = id ? await api('GET', '/admin/exams') : [];
  const E = id ? list.find((x) => x.id === Number(id)) : (isTeacher() ? { title: '', exam_type: 'CUSTOM', level: 'N5', duration_min: 45, description: '', sections: [], scoring: CUSTOM_PRESETS.ten, status: 'draft', version: 0 }
    : { title: '', exam_type: 'JLPT', level: 'N5', duration_min: 30, description: '', sections: [], scoring: SCORING_PRESETS.N5, status: 'draft', version: 0 });
  const mine = !id || ownsIt(E); const T = isTeacher(); const editable = can.edit() && mine; const canRev = can.review() || (T && mine);
  const all = (await api('GET', '/admin/questions?per=1000')).items;   // trang đầu; tải thêm bên dưới
  let pool = [...all], pg = 1, got = all.length, total = (await api('GET', '/admin/questions')).total;
  while (got < total) { pg++; const r = await api('GET', '/admin/questions?page=' + pg); pool.push(...r.items); got += r.items.length; if (!r.items.length) break; }
  const chosen = {}; for (const s of E.sections) chosen[s.key] = new Set(s.question_ids);
  adminShell('de', `<a class="small" href="#/quan-tri/de">← Đề thi</a><div class="row between mt"><h1 style="margin:0">${id ? 'Sửa đề' : 'Đề mới'}</h1>${id ? stChip(E.status) : ''}</div>
  <form id="ef" class="card mt"><div class="field-row"><div><label>Tên đề</label><input name="title" required value="${esc(E.title)}"></div><div><label>Kỳ thi</label><select name="exam_type">${[['CUSTOM', 'Đề giảng viên (kiểm tra lớp)'], ['JLPT', 'JLPT'], ['JFT', 'JFT-Basic'], ['NAT', 'NAT-TEST']].map(([k, t]) => `<option value="${k}" ${E.exam_type === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div><label>Cấp độ</label><select name="level">${['N5', 'N4', 'N3', 'N2', 'N1'].map((l) => `<option ${E.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div><label>Thời lượng (phút)</label><input name="duration_min" type="number" min="1" value="${E.duration_min}"></div></div>
    <div class="field-row"><div><label>Danh mục</label><select name="exam_kind">${Object.entries(EXAM_KINDS).map(([k, t]) => `<option value="${k}" ${(E.exam_kind || (T ? 'chuyen' : 'jlpt')) === k ? 'selected' : ''}>${t}${MCQ_ONLY.includes(k) ? ' (chỉ trắc nghiệm)' : ' (có tự luận)'}</option>`).join('')}</select></div>
      <div><label>Mức độ</label><select name="difficulty">${DIFFS.map((d, i) => `<option value="${i}" ${(E.difficulty || 0) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></div></div>
    <label>Mô tả</label><textarea name="description" rows="2">${esc(E.description)}</textarea>
    <h3 class="mt">Chọn câu hỏi cho từng phần</h3><div class="small muted">Chỉ nên chọn câu cùng cấp độ. Đề chỉ đăng được khi mọi câu đã ở trạng thái “Đã đăng”.</div><div id="pick"></div>
    <div class="row mt"><span class="small muted">Thang điểm nhanh:</span><button type="button" class="sm" data-preset="ten">Thang 10</button><button type="button" class="sm" data-preset="hundred">Thang 100</button><button type="button" class="sm" data-preset="jlpt">Theo JLPT cấp đã chọn</button></div>
    <label>Thang điểm (JSON; tự điền theo cấp độ, có thể sửa để thêm kỳ thi mới)</label><textarea name="scoring" rows="7" style="font-family:monospace">${esc(JSON.stringify(E.scoring, null, 2))}</textarea>
    <div id="eerr" class="alert bad mt" hidden></div>
    ${id && !mine ? `<div class="alert mt">Đề của ${esc(E.author || 'người khác')}: bạn chỉ xem được.</div>` : ''}
    <div class="row mt">${editable ? '<button class="primary">Lưu đề</button>' : ''}${id && E.status === 'draft' && editable ? (T ? '<button type="button" class="accent" id="e-pub">Đăng đề cho học viên</button>' : '<button type="button" id="e-pend">Gửi duyệt</button>') : ''}${id && E.status === 'pending' && canRev ? '<button type="button" class="accent" id="e-pub">Duyệt & đăng</button><button type="button" id="e-draft">Trả về nháp</button>' : ''}${id && E.status === 'published' && canRev ? '<button type="button" class="danger" id="e-rm">Gỡ đề</button>' : ''}${id && E.status === 'removed' && editable ? `${T ? '<button type="button" class="accent" id="e-pub">Đăng lại</button>' : ''}<button type="button" id="e-draft">Chuyển về nháp</button>` : ''}</div></form>`);
  const f = $('#ef');
  const drawPick = () => {
    const lv = f.elements.level.value;
    $('#pick').innerHTML = Object.entries(SECTIONS).map(([k, name]) => { const qs = pool.filter((q) => q.section === k && q.level === lv && q.status !== 'removed');
      const pts = qs.filter((q) => chosen[k]?.has(q.id)).reduce((a, q) => a + (q.points || 1), 0);
      return `<details class="mt" ${chosen[k]?.size ? 'open' : ''}><summary><b>${name}</b> · đã chọn ${chosen[k]?.size || 0}/${qs.length}${pts ? ` · ${pts} điểm` : ''}</summary>${qs.map((q) => `<label class="inline" style="display:flex;padding:4px 0;font-weight:400"><input type="checkbox" data-s="${k}" value="${q.id}" ${chosen[k]?.has(q.id) ? 'checked' : ''}> <span>#${q.id} ${kindChip(q.kind)} ${stChip(q.status)} ${q.points > 1 ? `<span class="small muted">${q.points}đ</span>` : ''} <span class="jp">${esc(plain(q.stem).slice(0, 60))}</span>${q.author ? ` <span class="small muted">· ${esc(q.author)}</span>` : ''}</span></label>`).join('') || '<div class="muted small">Chưa có câu hỏi cấp độ này.</div>'}</details>`; }).join('');
    $$('#pick input').forEach((c) => c.onchange = () => { (chosen[c.dataset.s] ||= new Set())[c.checked ? 'add' : 'delete'](Number(c.value)); drawPick(); });
  };
  drawPick();
  f.elements.level.onchange = () => { if (!id && f.elements.exam_type.value !== 'CUSTOM') f.elements.scoring.value = JSON.stringify(SCORING_PRESETS[f.elements.level.value], null, 2); drawPick(); };
  $$('[data-preset]').forEach((b) => b.onclick = () => { const p = b.dataset.preset; f.elements.scoring.value = JSON.stringify(p === 'jlpt' ? SCORING_PRESETS[f.elements.level.value] : CUSTOM_PRESETS[p], null, 2); });
  if (!editable) $$('#ef input, #ef textarea, #ef select, #ef [data-preset]').forEach((el) => { el.disabled = true; });
  const body = () => {
    let scoring; try { scoring = JSON.parse(f.elements.scoring.value); } catch { throw new Error('Thang điểm không phải JSON hợp lệ.'); }
    return { title: f.elements.title.value, exam_type: f.elements.exam_type.value, exam_kind: f.elements.exam_kind.value, difficulty: Number(f.elements.difficulty.value), level: f.elements.level.value, duration_min: Number(f.elements.duration_min.value), description: f.elements.description.value, scoring,
      // giữ nguyên các phần riêng của đề tải từ file (第1部, Phần 1…), không chọn lại được ở đây
      sections: [...E.sections.filter((s) => !SECTIONS[s.key]), ...Object.keys(SECTIONS).filter((k) => chosen[k]?.size).map((k) => ({ key: k, name: SECTIONS[k], question_ids: [...chosen[k]] }))] };
  };
  f.onsubmit = async (e) => { e.preventDefault(); try { const r = await api(id ? 'PUT' : 'POST', id ? `/admin/exams/${id}` : '/admin/exams', body()); toast('Đã lưu đề.'); nav('/quan-tri/de/' + (id || r.id)); if (id) render(); } catch (er) { const b = $('#eerr'); b.hidden = false; b.textContent = er.message; } };
  const st = (s) => async () => { try { if (s === 'published' && T && editable) await api('PUT', `/admin/exams/${id}`, body()); await api('POST', `/admin/exams/${id}/status`, { status: s }); toast('Đã cập nhật.'); render(); } catch (e) { const b = $('#eerr'); b.hidden = false; b.textContent = e.message; } };
  const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
  on('#e-pend', st('pending')); on('#e-pub', st('published')); on('#e-draft', st('draft')); on('#e-rm', st('removed'));
}
route(/^\/quan-tri\/de\/moi$/, () => examEditor(null), ST);
route(/^\/quan-tri\/de\/(\d+)$/, (id) => examEditor(Number(id)), ST);


/* ---- Chấm câu tự luận ---- */
route(/^\/quan-tri\/cham-bai$/, async () => {
  const all = S.query.status === 'all';
  const list = await api('GET', '/admin/grading' + (all ? '?status=all' : ''));
  adminShell('cham-bai', `<div class="row between"><h1 style="margin:0">Chấm tự luận</h1><label class="inline"><input type="checkbox" id="g-all" ${all ? 'checked' : ''}> Hiện cả bài đã chấm</label></div>
  <p class="muted small">${isTeacher() ? 'Bài làm các đề do bạn tạo (và bài luyện tập có câu tự luận của bạn).' : 'Tất cả bài nộp có câu tự luận.'} Câu trả lời khớp “đáp án chấp nhận” đã được tự chấm.</p>
  <div class="card tw"><table><tr><th>Bài</th><th>Học viên</th><th>Nộp lúc</th><th>Tự luận</th><th>Điểm hiện tại</th><th></th></tr>${list.map((a) => `<tr><td>${esc(a.title)}</td><td>${esc(a.user_name)}<div class="small muted">${esc(a.user_email)}</div></td><td class="small">${fmtDate(a.submitted_at)}</td>
    <td>${a.pending ? `<span class="chip warn">${a.pending}/${a.essays} chờ chấm</span>` : `<span class="chip ok">Đã chấm ${a.essays}</span>`}</td><td>${a.score ?? '-'} / ${a.maxScore ?? '-'}</td><td><a class="btn sm ${a.pending ? 'primary' : ''}" href="#/quan-tri/cham-bai/${a.id}">${a.pending ? 'Chấm' : 'Xem / sửa'}</a></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Không có bài nào cần chấm.</td></tr>'}</table></div>`);
  $('#g-all').onchange = (e) => nav('/quan-tri/cham-bai' + (e.target.checked ? '?status=all' : ''));
}, ST);
route(/^\/quan-tri\/cham-bai\/(\d+)$/, async (id) => {
  const G = await api('GET', `/admin/grading/${id}`);
  adminShell('cham-bai', `<a class="small" href="#/quan-tri/cham-bai">← Danh sách bài</a>
  <div class="row between mt"><h1 style="margin:0">${esc(G.title)}</h1><span class="chip">${esc(G.user_name || '')}</span></div>
  <p class="muted small">Nộp lúc ${fmtDate(G.submitted_at)} · Điểm hiện tại <b>${G.score}/${G.maxScore}</b>${G.pending ? ` · còn <b>${G.pending}</b> câu chờ chấm` : ' · đã chấm xong'}</p>
  <form id="gf">${G.items.map((x) => `<div class="card mb qcard"><div class="row between mb"><span class="chip">Câu ${x.n}</span>${x.graded ? (x.auto ? '<span class="chip ok">Tự chấm (khớp đáp án)</span>' : '<span class="chip ok">Đã chấm</span>') : '<span class="chip warn">Chờ chấm</span>'}</div>
    ${x.passage ? `<div class="passage">${rich(x.passage)}</div>` : ''}<p class="stem">${rich(x.stem)}</p>
    <div class="grid g2" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))"><div><div class="small muted">Bài làm của học viên</div><div class="passage jp" style="white-space:pre-wrap">${x.text ? esc(x.text) : '<i class="muted">(bỏ trống)</i>'}</div></div>
      <div><div class="small muted">Đáp án mẫu / hướng dẫn chấm</div><div class="passage jp" style="white-space:pre-wrap">${rich(x.model_answer || '')}${x.accepted?.length ? `<div class="small muted mt">Chấp nhận: ${x.accepted.map(esc).join(' · ')}</div>` : ''}</div></div></div>
    <div class="field-row mt"><div style="max-width:160px"><label>Điểm (0 - ${x.max})</label><input type="number" name="p${x.qid}" min="0" max="${x.max}" step="0.5" value="${x.graded ? x.points : ''}" ${x.text ? '' : ''}></div>
      <div style="flex:3"><label>Nhận xét cho học viên</label><textarea name="f${x.qid}" rows="2">${esc(x.feedback || '')}</textarea></div></div></div>`).join('')}
  <div id="gerr" class="alert bad" hidden></div>
  ${can.grade() ? '<div class="row"><button class="primary">Lưu điểm</button><span class="small muted">Học viên nhận thông báo khi bài đã chấm xong tất cả câu.</span></div>' : '<div class="alert">Bạn chỉ xem được.</div>'}</form>`);
  $('#gf').onsubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target); const grades = {};
    for (const x of G.items) { const v = fd.get('p' + x.qid); if (v !== '' && v != null) grades[x.qid] = { points: Number(v), feedback: fd.get('f' + x.qid) || '' }; }
    if (!Object.keys(grades).length) { const b = $('#gerr'); b.hidden = false; b.textContent = 'Hãy nhập điểm cho ít nhất một câu.'; return; }
    try { const r = await api('POST', `/admin/grading/${id}`, { grades }); toast(r.pending ? `Đã lưu. Còn ${r.pending} câu chờ chấm.` : `Đã chấm xong: ${r.score}/${r.maxScore}.`); render(); }
    catch (er) { const b = $('#gerr'); b.hidden = false; b.textContent = er.message; }
  };
}, ST);

/* ---- Bài đời sống: soạn bằng các ô văn bản đơn giản, không cần biết lập trình ---- */
route(/^\/quan-tri\/bai-hoc$/, async () => {
  const list = await api('GET', '/admin/lessons');
  adminShell('bai-hoc', `<div class="row between"><h1 style="margin:0">Bài tình huống đời sống</h1>${can.edit() ? '<a class="btn primary" href="#/quan-tri/bai-hoc/moi">＋ Thêm bài</a>' : ''}</div>
  <div class="card tw mt"><table><tr><th>Bài</th><th>Tình huống</th><th>Cấp</th><th>Trạng thái</th><th></th></tr>${list.map((l) => `<tr><td>${esc(l.title)}</td><td>${esc(l.situation)}</td><td>${chipLevel(l.level)}</td><td>${stChip(l.status)}</td><td><a class="btn sm" href="#/quan-tri/bai-hoc/${l.id}">Mở</a></td></tr>`).join('')}</table></div>`);
}, ST);
async function lessonEditor(id) {
  const L = id ? (await api('GET', '/admin/lessons')).find((x) => x.id === Number(id)) : { title: '', situation: '', level: 'N5', summary: '', dialogue: [], vocab: [], phrases: [], doc: null, culture: '', quiz: [], grammar_tags: [], status: 'draft' };
  const dl = L.dialogue.map((d) => [d.speaker, d.role, d.ja, d.vi, d.register].join(' | ')).join('\n');
  const vl = L.vocab.map((v) => [v.ja, v.reading, v.vi].join(' | ')).join('\n');
  const pl = L.phrases.map((p) => [p.ja, p.vi, p.register, p.note].join(' | ')).join('\n');
  const ql = L.quiz.map((q) => [q.stem, ...q.options, q.answer + 1, q.explanation].join(' | ')).join('\n');
  adminShell('bai-hoc', `<a class="small" href="#/quan-tri/bai-hoc">← Bài đời sống</a><div class="row between mt"><h1 style="margin:0">${id ? 'Sửa bài' : 'Bài mới'}</h1>${id ? stChip(L.status) : ''}</div>
  <form id="lf2" class="card mt"><div class="field-row"><div><label>Tiêu đề</label><input name="title" required value="${esc(L.title)}"></div><div><label>Tình huống</label><input name="situation" required value="${esc(L.situation)}" placeholder="Siêu thị (スーパー)"></div><div><label>Cấp độ</label><select name="level">${['N5', 'N4', 'N3', 'N2', 'N1'].map((l) => `<option ${L.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <label>Tóm tắt</label><input name="summary" value="${esc(L.summary)}">
    <label>Hội thoại - mỗi dòng: <span class="kbd">Người nói | M hoặc F | tiếng Nhật | tiếng Việt | mức lịch sự</span> (lịch sự / kính ngữ / thông thường)</label><textarea name="dialogue" rows="7" class="jp">${esc(dl)}</textarea>
    <label>Từ vựng - mỗi dòng: <span class="kbd">từ | cách đọc | nghĩa</span></label><textarea name="vocab" rows="4" class="jp">${esc(vl)}</textarea>
    <label>Câu mẫu - mỗi dòng: <span class="kbd">câu | nghĩa | mức lịch sự | ghi chú</span></label><textarea name="phrases" rows="4" class="jp">${esc(pl)}</textarea>
    <label>Tài liệu thực tế mô phỏng (tiêu đề | loại: receipt/email/notice | bản dịch) và nội dung bên dưới</label><input name="doc_meta" value="${L.doc ? esc([L.doc.title, L.doc.kind, L.doc.vi].join(' | ')) : ''}"><textarea name="doc_text" rows="4" class="jp">${esc(L.doc?.text || '')}</textarea>
    <label>Ghi chú văn hóa</label><textarea name="culture" rows="2">${esc(L.culture)}</textarea>
    <label>Câu hỏi kiểm tra - mỗi dòng: <span class="kbd">câu hỏi | đáp án 1 | 2 | 3 | 4 | số đáp án đúng | giải thích</span></label><textarea name="quiz" rows="5">${esc(ql)}</textarea>
    <label>Mẫu ngữ pháp liên quan (để liên kết với câu đề thi, cách nhau dấu phẩy)</label><input name="grammar_tags" value="${esc(L.grammar_tags.join(', '))}">
    <div id="lerr" class="alert bad mt" hidden></div>
    <div class="row mt">${can.edit() ? '<button class="primary">Lưu</button>' : ''}${id && L.status === 'draft' && can.edit() ? '<button type="button" id="l-pend">Gửi duyệt</button>' : ''}${id && L.status === 'pending' && can.review() ? '<button type="button" class="accent" id="l-pub">Duyệt & đăng</button><button type="button" id="l-draft">Trả về nháp</button>' : ''}${id && L.status === 'published' && can.review() ? '<button type="button" class="danger" id="l-rm">Gỡ bài</button>' : ''}</div></form>`);
  const f = $('#lf2'); const lines = (n) => f.elements[n].value.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => s.split('|').map((x) => x.trim()));
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const dm = f.elements.doc_meta.value.split('|').map((x) => x.trim());
      const body = { title: f.elements.title.value, situation: f.elements.situation.value, level: f.elements.level.value, summary: f.elements.summary.value, culture: f.elements.culture.value,
        dialogue: lines('dialogue').map((p, i) => { if (p.length < 5) throw new Error(`Hội thoại dòng ${i + 1}: cần 5 phần cách nhau bằng dấu |`); return { speaker: p[0], role: p[1] === 'F' ? 'F' : 'M', ja: p[2], vi: p[3], register: p[4] }; }),
        vocab: lines('vocab').map((p, i) => { if (p.length < 3) throw new Error(`Từ vựng dòng ${i + 1}: cần 3 phần`); return { ja: p[0], reading: p[1], vi: p[2] }; }),
        phrases: lines('phrases').map((p, i) => { if (p.length < 3) throw new Error(`Câu mẫu dòng ${i + 1}: cần ít nhất 3 phần`); return { ja: p[0], vi: p[1], register: p[2], note: p[3] || '' }; }),
        doc: f.elements.doc_text.value.trim() ? { title: dm[0] || 'Tài liệu', kind: dm[1] || 'notice', vi: dm[2] || '', text: f.elements.doc_text.value } : null,
        quiz: lines('quiz').map((p, i) => { if (p.length < 5) throw new Error(`Câu kiểm tra dòng ${i + 1}: thiếu phần`); const ans = Number(p[p.length - 2]) - 1; return { stem: p[0], options: p.slice(1, p.length - 2), answer: ans, explanation: p[p.length - 1] }; }),
        grammar_tags: f.elements.grammar_tags.value.split(/[,、]/).map((x) => x.trim()).filter(Boolean) };
      const r = await api(id ? 'PUT' : 'POST', id ? `/admin/lessons/${id}` : '/admin/lessons', body); toast('Đã lưu bài.'); nav('/quan-tri/bai-hoc/' + (id || r.id)); if (id) render();
    } catch (er) { const b = $('#lerr'); b.hidden = false; b.textContent = er.message; }
  };
  const st = (s) => async () => { try { await api('POST', `/admin/lessons/${id}/status`, { status: s }); toast('Đã cập nhật.'); render(); } catch (e) { toast(e.message, true); } };
  const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
  on('#l-pend', st('pending')); on('#l-pub', st('published')); on('#l-draft', st('draft')); on('#l-rm', st('removed'));
}
route(/^\/quan-tri\/bai-hoc\/moi$/, () => lessonEditor(null), ST);
route(/^\/quan-tri\/bai-hoc\/(\d+)$/, (id) => lessonEditor(Number(id)), ST);

/* ---- Báo lỗi, bình luận (AD-05) ---- */
route(/^\/quan-tri\/bao-loi$/, async () => {
  const list = await api('GET', '/admin/reports');
  const stn = { open: 'Chưa xử lý', in_progress: 'Đang xử lý', closed: 'Đã đóng' };
  adminShell('bao-loi', `<h1>Báo lỗi từ người học</h1>${list.map((r) => `<div class="card mb"><div class="row between"><div><b>${esc(REPORT_TYPES[r.type])}</b> · câu <a href="#/quan-tri/cau-hoi/${r.question_id}">#${r.question_id}</a> <span class="small muted">${esc(r.stem)}</span></div><span class="chip ${r.status === 'closed' ? 'ok' : r.status === 'open' ? 'warn' : ''}">${stn[r.status]}</span></div>
    <div class="small muted">${esc(r.user_name)} · ${fmtDate(r.created_at)}${r.assignee_name ? ' · xử lý: ' + esc(r.assignee_name) : ''}</div><p>${esc(r.note) || '<i class="muted">(không có mô tả)</i>'}</p>
    <div class="row"><input data-reply="${r.id}" placeholder="Phản hồi cho người báo lỗi…" value="${esc(r.reply)}" style="flex:1;min-width:180px"><select data-st="${r.id}" style="width:auto">${Object.entries(stn).map(([k, t]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="sm primary" data-save="${r.id}">Lưu</button></div></div>`).join('') || '<div class="empty">Không có báo lỗi.</div>'}`);
  $$('[data-save]').forEach((b) => b.onclick = async () => { const id = b.dataset.save; try { await api('PATCH', `/admin/reports/${id}`, { status: $(`[data-st="${id}"]`).value, reply: $(`[data-reply="${id}"]`).value }); toast('Đã lưu.'); render(); } catch (e) { toast(e.message, true); } });
}, ST);
route(/^\/quan-tri\/binh-luan$/, async () => {
  const list = await api('GET', '/admin/comments');
  adminShell('binh-luan', `<h1>Bình luận</h1><div class="card tw"><table><tr><th>Người</th><th>Nội dung</th><th>Câu</th><th></th></tr>${list.map((c) => `<tr style="${c.hidden ? 'opacity:.5' : ''}"><td>${esc(c.user_name)}<div class="small muted">${fmtDate(c.created_at)}</div></td><td>${esc(c.body)}</td><td>#${c.question_id}</td><td><button class="sm" data-h="${c.id}" data-v="${c.hidden ? 0 : 1}">${c.hidden ? 'Hiện' : 'Ẩn'}</button></td></tr>`).join('')}</table></div>`);
  $$('[data-h]').forEach((b) => b.onclick = async () => { await api('PATCH', `/admin/comments/${b.dataset.h}`, { hidden: b.dataset.v === '1' }); render(); });
}, ST);

/* ---- Báo cáo chất lượng câu hỏi (AD-07) ---- */
route(/^\/quan-tri\/thong-ke$/, async () => {
  const list = await api('GET', '/admin/questions/stats');
  adminShell('thong-ke', `<h1>Báo cáo câu hỏi</h1><p class="muted">Câu có cảnh báo được đưa lên đầu: tỷ lệ đúng bất thường, đáp án sai được chọn nhiều hơn đáp án đúng (có thể mơ hồ), hoặc còn báo lỗi chưa xử lý. Cần tối thiểu 5 lượt làm để đánh giá.</p>
  <div class="card tw"><table><tr><th>ID</th><th>Câu hỏi</th><th>Lượt làm</th><th>Tỷ lệ đúng</th><th>Cảnh báo</th></tr>${list.map((x) => `<tr><td><a href="#/quan-tri/cau-hoi/${x.id}">#${x.id}</a></td><td class="jp">${chipLevel(x.level)} ${esc(x.stem)}</td><td>${x.attempts}</td><td>${x.rate == null ? '–' : Math.round(x.rate * 100) + '%'}</td><td>${x.flags.map((f) => `<span class="chip warn">${esc(f)}</span>`).join(' ')}</td></tr>`).join('')}</table></div>`);
}, ST);

/* ---- Người dùng (AD-08) ---- */
route(/^\/quan-tri\/nguoi-dung$/, async () => {
  if (!can.admin()) return view('<div class="alert bad">Chỉ quản trị viên được quản lý người dùng.</div>');
  const q = S.query.q || ''; const list = await api('GET', '/admin/users?q=' + encodeURIComponent(q));
  adminShell('nguoi-dung', `<div class="row between"><h1>Người dùng (${list.length})</h1><button class="accent" id="new-u">+ Tạo tài khoản</button></div>
  <form class="row mb" id="uf"><input name="q" type="search" placeholder="Tìm email / tên" value="${esc(q)}" style="max-width:320px"><button>Tìm</button></form>
  <div class="card tw"><table><tr><th>Người dùng</th><th>Vai trò</th><th>Đăng nhập gần nhất</th><th>Thao tác</th></tr>${list.map((u) => `<tr><td>${esc(u.name)}<div class="small muted">${esc(u.email)}${!u.has_password ? ' · <span class="bad-text">chưa đặt mật khẩu</span>' : ''}</div></td>
    <td><select data-role="${u.id}" ${u.id === S.user.id ? 'disabled' : ''}>${Object.entries(ROLE).map(([k, t]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
    <td class="small">${u.last_login ? fmtDate(u.last_login) : '<span class="muted">chưa</span>'}</td>
    <td><div class="row" style="gap:6px">${u.id === S.user.id ? '<span class="small muted">(bạn)</span>' : `<button class="sm" data-reset="${u.id}" ${u.locked ? 'disabled' : ''}>Link đặt lại mật khẩu</button><button class="sm ghost" data-out="${u.id}">Đăng xuất mọi nơi</button><button class="sm ${u.locked ? 'accent' : 'danger'}" data-lock="${u.id}" data-v="${u.locked ? 0 : 1}">${u.locked ? 'Mở khóa' : 'Khóa'}</button>`}</div></td></tr>`).join('')}</table></div>`);
  $('#uf').onsubmit = (e) => { e.preventDefault(); nav('/quan-tri/nguoi-dung?q=' + encodeURIComponent(e.target.q.value)); };
  const patch = (id, b) => api('PATCH', `/admin/users/${id}`, b).then(() => toast('Đã cập nhật.')).catch((e) => toast(e.message, true));
  $$('[data-role]').forEach((s) => s.onchange = () => patch(s.dataset.role, { role: s.value }));
  $$('[data-lock]').forEach((b) => b.onclick = async () => { await patch(b.dataset.lock, { locked: b.dataset.v === '1' }); render(); });
  $$('[data-out]').forEach((b) => b.onclick = async () => { try { await api('POST', `/admin/users/${b.dataset.out}/logout-all`); toast('Đã đăng xuất người dùng này trên mọi thiết bị.'); } catch (e) { toast(e.message, true); } });
  // Hiện link để quản trị viên sao chép, gửi cho người dùng qua Zalo/Messenger/email
  const closeModal = () => { $('#modal-root').innerHTML = ''; };
  const showLink = (title, link, note) => modal(`<h3>${esc(title)}</h3><p class="small muted">${esc(note)}</p><input id="lk" readonly value="${esc(link)}"><div class="row mt"><button class="primary" id="cp">Sao chép link</button><button id="cl">Đóng</button></div>`, () => {
    $('#lk').select();
    $('#cp').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Đã sao chép.'); } catch { $('#lk').select(); toast('Nhấn Ctrl+C để sao chép.'); } };
    $('#cl').onclick = () => { closeModal(); render(); }; });
  $$('[data-reset]').forEach((b) => b.onclick = async () => { try { const r = await api('POST', `/admin/users/${b.dataset.reset}/reset-link`); showLink('Link đặt lại mật khẩu', r.link, `Gửi link này cho người dùng. Link dùng được một lần, hết hạn sau ${r.hours} giờ.`); } catch (e) { toast(e.message, true); } });
  $('#new-u').onclick = () => modal(`<h3>Tạo tài khoản</h3><form id="cf" novalidate><label for="cu-n">Họ tên</label><input id="cu-n" maxlength="60"><label for="cu-e">Email</label><input id="cu-e" type="email" required>
    <label for="cu-r">Vai trò</label><select id="cu-r">${Object.entries(ROLE).map(([k, t]) => `<option value="${k}" ${k === 'teacher' ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <label for="cu-p">Mật khẩu (để trống: hệ thống tạo link để người dùng tự đặt)</label><input id="cu-p" type="text" autocomplete="off" maxlength="128">
    <div id="cerr" class="alert bad mt" hidden></div><div class="row mt"><button class="primary">Tạo</button><button type="button" id="cc">Hủy</button></div></form>`, () => {
    $('#cc').onclick = closeModal;
    $('#cf').onsubmit = async (e) => { e.preventDefault();
      try {
        const r = await api('POST', '/admin/users', { name: $('#cu-n').value, email: $('#cu-e').value.trim(), role: $('#cu-r').value, password: $('#cu-p').value });
        if (r.link) showLink('Đã tạo tài khoản', r.link, 'Gửi link này cho người dùng để họ tự đặt mật khẩu lần đầu. Link hết hạn sau 7 ngày.');
        else { closeModal(); toast('Đã tạo tài khoản.'); render(); }
      } catch (er) { $('#cerr').hidden = false; $('#cerr').textContent = er.message; } }; });
}, ST);

/* ---- Kho audio/ảnh (AD-09) ---- */
route(/^\/quan-tri\/media$/, async () => {
  const list = await api('GET', '/admin/media');
  adminShell('media', `<h1>Kho audio & hình ảnh</h1>${can.edit() ? '<input type="file" id="mu" accept=".mp3,.wav,.m4a,.ogg,.png,.jpg,.jpeg,.webp" multiple>' : ''}<div class="small muted mt">Tải lên một lần, dùng cho nhiều đề. File trùng nội dung được nhận diện tự động.</div>
  <div class="card tw mt"><table><tr><th>File</th><th>Xem</th><th>URL (dán vào câu hỏi)</th></tr>${list.map((m) => `<tr><td>${esc(m.filename)}<div class="small muted">${Math.round(m.size / 1024)} KB · ${fmtDate(m.created_at)}</div></td><td>${/^audio/.test(m.mime) ? `<audio controls preload="none" src="${esc(m.url)}" style="max-width:240px"></audio>` : `<img src="${esc(m.url)}" alt="" style="max-height:50px">`}</td><td><span class="kbd">${esc(m.url)}</span></td></tr>`).join('') || '<tr><td colspan="3" class="empty">Chưa có file.</td></tr>'}</table></div>`);
  const mu = $('#mu'); if (mu) mu.onchange = async () => {
    for (const f of mu.files) { try { const r = await uploadMedia(f); toast(r.reused ? `${f.name}: đã có sẵn, dùng lại.` : `Đã tải ${f.name}.`); } catch (e) { toast(`${f.name}: ${e.message}`, true); } }
    render();
  };
}, ST);


/* ---- Ngữ pháp ---- */
route(/^\/quan-tri\/ngu-phap$/, async () => {
  const list = await api('GET', '/admin/grammar');
  adminShell('ngu-phap', `<div class="row between"><h1 style="margin:0">Thư viện ngữ pháp (${list.length})</h1>${can.edit() ? '<a class="btn primary" href="#/quan-tri/ngu-phap/moi">＋ Thêm mẫu</a>' : ''}</div>
  <div class="card tw mt"><table><tr><th>Thẻ</th><th>Cấp</th><th>Ý nghĩa</th><th>Ví dụ</th><th></th></tr>${list.map((g) => `<tr><td class="jp"><b>${esc(g.tag)}</b></td><td>${chipLevel(g.level)}</td><td class="small">${esc(g.meaning)}</td><td>${g.examples.length}</td><td><a class="btn sm" href="#/quan-tri/ngu-phap/${encodeURIComponent(g.tag)}">Mở</a></td></tr>`).join('')}</table></div>`);
}, ST);
async function grammarEditor(tag) {
  const G = tag ? (await api('GET', '/admin/grammar')).find((x) => x.tag === tag) : { tag: '', level: 'N5', title: '', meaning: '', structure: '', notes: '', compare: '', examples: [] };
  if (!G) return view('<div class="alert bad">Không tìm thấy mẫu ngữ pháp.</div>');
  adminShell('ngu-phap', `<a class="small" href="#/quan-tri/ngu-phap">← Ngữ pháp</a><h1 class="mt">${tag ? 'Sửa mẫu ngữ pháp' : 'Mẫu ngữ pháp mới'}</h1>
  <form id="gf" class="card"><div class="field-row"><div><label>Thẻ (khóa liên kết)</label><input name="tag" required value="${esc(G.tag)}" ${tag ? 'readonly' : ''} class="jp" placeholder="VD: ばかり(直前)"></div><div><label>Cấp độ</label><select name="level">${['N5', 'N4', 'N3', 'N2', 'N1'].map((l) => `<option ${G.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    ${tag ? '' : '<div class="small muted">Thẻ phải trùng đúng với thẻ ngữ pháp bạn gắn trên câu hỏi/bài học thì hệ thống mới liên kết được. Không đổi được sau khi tạo.</div>'}
    <label>Cấu trúc ngắn gọn</label><input name="title" required value="${esc(G.title)}" class="jp"><label>Ý nghĩa (tiếng Việt)</label><textarea name="meaning" rows="2" required>${esc(G.meaning)}</textarea>
    <label>Cách chia / cấu trúc chi tiết</label><input name="structure" value="${esc(G.structure)}" class="jp"><label>Lưu ý</label><textarea name="notes" rows="3">${esc(G.notes)}</textarea>
    <label>So sánh với mẫu dễ nhầm (không bắt buộc)</label><textarea name="compare" rows="2">${esc(G.compare)}</textarea>
    <label>Ví dụ - mỗi dòng: <span class="kbd">câu tiếng Nhật | bản dịch</span> (furigana: <span class="kbd">{漢字|かんじ}</span>)</label><textarea name="examples" rows="5" class="jp">${esc(G.examples.map((x) => x.ja + ' | ' + x.vi).join('\n'))}</textarea>
    <div class="small muted mt">Xem trước: <div id="gpv" class="jp" style="font-size:1.1rem;line-height:2.1"></div></div>
    <div id="gerr" class="alert bad mt" hidden></div><div class="row mt">${can.edit() ? '<button class="primary">Lưu</button>' : ''}${tag && can.admin() ? '<button type="button" class="danger" id="gdel">Xóa</button>' : ''}</div></form>`);
  const f = $('#gf'); const ex = () => f.elements.examples.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.lastIndexOf('|'); return i < 0 ? { ja: l, vi: '' } : { ja: l.slice(0, i).trim(), vi: l.slice(i + 1).trim() }; });
  const pv = () => { $('#gpv').innerHTML = ex().map((x) => `<div>${rich(x.ja)}</div>`).join(''); }; f.oninput = pv; pv();
  f.onsubmit = async (e) => { e.preventDefault(); const b = $('#gerr'); b.hidden = true;
    try { await api('POST', '/admin/grammar', { tag: f.elements.tag.value, level: f.elements.level.value, title: f.elements.title.value, meaning: f.elements.meaning.value, structure: f.elements.structure.value, notes: f.elements.notes.value, compare: f.elements.compare.value, examples: ex(), overwrite: !!tag }); toast('Đã lưu.'); nav('/quan-tri/ngu-phap'); }
    catch (er) { b.hidden = false; b.innerHTML = (er.data?.errors || [er.message]).map(esc).join('<br>'); } };
  const d = $('#gdel'); if (d) d.onclick = async () => { if (await confirmBox('Xóa mẫu ngữ pháp này?')) { try { await api('DELETE', '/admin/grammar?tag=' + encodeURIComponent(tag)); nav('/quan-tri/ngu-phap'); } catch (er) { toast(er.message, true); } } };
}
route(/^\/quan-tri\/ngu-phap\/moi$/, () => grammarEditor(null), ST);
route(/^\/quan-tri\/ngu-phap\/(.+)$/, (t) => grammarEditor(decodeURIComponent(t)), ST);

/* ---- Khóa học ---- */
route(/^\/quan-tri\/khoa-hoc$/, async () => {
  const list = await api('GET', '/admin/courses');
  adminShell('khoa-hoc', `<div class="row between"><h1 style="margin:0">Khóa học</h1>${can.edit() ? '<a class="btn primary" href="#/quan-tri/khoa-hoc/moi">＋ Tạo khóa học</a>' : ''}</div>
  <div class="card tw mt"><table><tr><th>Khóa học</th><th>Cấp</th><th>Tuần</th><th>Bước</th><th>Trạng thái</th><th></th></tr>${list.map((c) => `<tr><td>${esc(c.title)}</td><td>${chipLevel(c.level)}</td><td>${c.weeks}</td><td>${c.steps.length}</td><td>${stChip(c.status)}</td><td><a class="btn sm" href="#/quan-tri/khoa-hoc/${c.id}">Mở</a></td></tr>`).join('')}</table></div>`);
}, ST);
async function courseEditor(id) {
  const [refs, all] = await Promise.all([api('GET', '/admin/refs'), id ? api('GET', '/admin/courses') : []]);
  const C = id ? all.find((x) => x.id === Number(id)) : { title: '', level: 'N5', goal: '', description: '', weeks: 4, steps: [], status: 'draft' };
  if (!C) return view('<div class="alert bad">Không tìm thấy khóa học.</div>');
  let steps = C.steps.map((s) => ({ ...s }));
  const TYPES = { grammar: 'Ngữ pháp', lesson: 'Bài tình huống', dictation: 'Chép chính tả', exam: 'Đề thi', practice: 'Luyện tập', cards: 'Flashcard' };
  const refList = (t) => t === 'exam' ? refs.exams : t === 'grammar' ? refs.grammar : (t === 'lesson' || t === 'dictation') ? refs.lessons : null;
  const draw = () => {
    adminShell('khoa-hoc', `<a class="small" href="#/quan-tri/khoa-hoc">← Khóa học</a><div class="row between mt"><h1 style="margin:0">${id ? 'Sửa khóa học' : 'Khóa học mới'}</h1>${id ? stChip(C.status) : ''}</div>
    <form id="cf" class="card mt"><div class="field-row"><div><label>Tên khóa học</label><input name="title" required value="${esc(C.title)}"></div><div><label>Cấp độ</label><select name="level">${['N5', 'N4', 'N3', 'N2', 'N1'].map((l) => `<option ${C.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div><label>Số tuần</label><input name="weeks" type="number" min="1" max="52" value="${C.weeks}"></div></div>
      <label>Mục tiêu</label><input name="goal" value="${esc(C.goal)}"><label>Mô tả</label><textarea name="description" rows="2">${esc(C.description)}</textarea>
      <h3 class="mt">Các bước</h3><div class="small muted">Chỉ chọn được đề, bài đã đăng và mẫu ngữ pháp đã có. Người học hoàn thành bước nào, hệ thống tự đánh dấu.</div>
      <div class="tw"><table><tr><th>Tuần</th><th>Loại</th><th>Nội dung</th><th>Tiêu đề hiển thị</th><th></th></tr>${steps.map((s, i) => `<tr><td style="width:70px"><input type="number" min="1" value="${s.week}" data-f="week" data-i="${i}"></td>
        <td><select data-f="type" data-i="${i}">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${s.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
        <td>${refList(s.type) ? `<select data-f="ref" data-i="${i}"><option value="">— chọn —</option>${refList(s.type).map((r) => `<option ${s.ref === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>` : s.type === 'practice' ? `<div class="row" style="flex-wrap:nowrap"><select data-f="level" data-i="${i}">${['N5', 'N4', 'N3', 'N2', 'N1'].map((l) => `<option ${s.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select><select data-f="section" data-i="${i}"><option value="">Mọi phần</option>${Object.entries(SECTIONS).map(([k, v]) => `<option value="${k}" ${s.section === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>` : `<input type="number" min="1" value="${s.count || 5}" data-f="count" data-i="${i}" title="Số thẻ tối thiểu">`}</td>
        <td><input value="${esc(s.title)}" data-f="title" data-i="${i}"></td><td><button type="button" class="sm danger" data-rm="${i}" aria-label="Xóa bước">✕</button></td></tr>`).join('')}</table></div>
      <button type="button" id="add-step" class="mt">＋ Thêm bước</button>
      <div id="cerr" class="alert bad mt" hidden></div>
      <div class="row mt">${can.edit() ? '<button class="primary">Lưu khóa học</button>' : ''}${id && C.status === 'draft' && can.edit() ? '<button type="button" id="c-pend">Gửi duyệt</button>' : ''}${id && C.status === 'pending' && can.review() ? '<button type="button" class="accent" id="c-pub">Duyệt & đăng</button><button type="button" id="c-draft">Trả về nháp</button>' : ''}${id && C.status === 'published' && can.review() ? '<button type="button" class="danger" id="c-rm">Gỡ khóa học</button>' : ''}${id && can.admin() && C.status !== 'published' ? '<button type="button" class="danger ghost" id="c-del">Xóa</button>' : ''}</div></form>`);
    const f = $('#cf');
    const sync = () => { C.title = f.elements.title.value; C.level = f.elements.level.value; C.weeks = Number(f.elements.weeks.value); C.goal = f.elements.goal.value; C.description = f.elements.description.value; };
    $$('[data-f]').forEach((el) => el.onchange = () => { sync(); const s = steps[Number(el.dataset.i)]; const k = el.dataset.f; s[k] = ['week', 'count'].includes(k) ? Number(el.value) : el.value; if (k === 'type') { s.ref = ''; delete s.level; delete s.section; if (el.value === 'practice') s.level = C.level; } if (k === 'ref' && !s.title) s.title = (({ grammar: 'Học và luyện mẫu ', lesson: 'Bài tình huống: ', dictation: 'Chép chính tả: ', exam: 'Làm đề: ' })[s.type] || '') + el.value; draw(); });
    $$('[data-rm]').forEach((b) => b.onclick = () => { sync(); steps.splice(Number(b.dataset.rm), 1); draw(); });
    $('#add-step').onclick = () => { sync(); steps.push({ week: steps.length ? steps[steps.length - 1].week : 1, type: 'grammar', ref: '', title: '' }); draw(); };
    f.onsubmit = async (e) => { e.preventDefault(); sync(); const b = $('#cerr'); b.hidden = true;
      try { const body = { ...C, steps }; const r = await api(id ? 'PUT' : 'POST', id ? `/admin/courses/${id}` : '/admin/courses', body); toast('Đã lưu.'); if (id) render(); else nav('/quan-tri/khoa-hoc/' + r.id); }
      catch (er) { b.hidden = false; b.innerHTML = (er.data?.errors || [er.message]).map(esc).join('<br>'); } };
    const st = (v) => async () => { try { await api('POST', `/admin/courses/${id}/status`, { status: v }); toast('Đã cập nhật.'); render(); } catch (e) { toast(e.message, true); } };
    const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
    on('#c-pend', st('pending')); on('#c-pub', st('published')); on('#c-draft', st('draft')); on('#c-rm', st('removed'));
    on('#c-del', async () => { if (await confirmBox('Xóa khóa học này?')) { try { await api('DELETE', `/admin/courses/${id}`); nav('/quan-tri/khoa-hoc'); } catch (e) { toast(e.message, true); } } });
  };
  draw();
}
route(/^\/quan-tri\/khoa-hoc\/moi$/, () => courseEditor(null), ST);
route(/^\/quan-tri\/khoa-hoc\/(\d+)$/, (id) => courseEditor(Number(id)), ST);

/* ---- Lớp học & giao bài (giảng viên) ---- */
const AST = { todo: ['Chưa làm', 'warn'], doing: ['Đang làm', ''], done: ['Đã nộp', 'ok'], late: ['Nộp muộn', 'warn'], missing: ['Không nộp', 'bad'], grading: ['Chờ chấm', ''] };
const astChip = (s) => `<span class="chip ${AST[s]?.[1] || ''}">${AST[s]?.[0] || s}</span>`;
const toLocalInput = (t) => (t ? new Date(t - new Date(t).getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '');
const joinLink = (code) => `${location.origin}${location.pathname}#/lop/vao?ma=${code}`;
const copyText = async (t) => { try { await navigator.clipboard.writeText(t); toast('Đã sao chép.'); } catch { toast('Không sao chép được, hãy chọn và nhấn Ctrl+C.', true); } };
const pctCls = (p) => (p == null ? '' : p >= 80 ? 'cell-ok' : p >= 50 ? 'cell-mid' : 'cell-bad');

route(/^\/quan-tri\/lop$/, async () => {
  const list = await api('GET', '/admin/classes');
  const active = list.filter((c) => !c.archived), old = list.filter((c) => c.archived);
  const card = (c) => `<a class="card" href="#/quan-tri/lop/${c.id}"><div class="row between"><b>${esc(c.name)}</b>${c.archived ? '<span class="chip">Đã lưu trữ</span>' : `<span class="chip">${esc(c.code)}</span>`}</div>
    <div class="small muted mt">${c.members} học viên · ${c.assignments} bài giao${can.admin() && c.teacher_id !== S.user.id ? ` · GV: ${esc(c.teacher_name || '')}` : ''}</div></a>`;
  adminShell('lop', `<div class="row between"><h1 style="margin:0">Lớp học</h1><button class="primary" id="new-c">＋ Tạo lớp</button></div>
    <p class="muted">Tạo lớp, đưa mã lớp hoặc link mời cho học viên, rồi giao đề có hạn nộp. Bạn theo dõi ai đã nộp, nhắc người chưa nộp và xuất bảng điểm ra Excel.</p>
    ${active.length ? `<div class="grid g3">${active.map(card).join('')}</div>` : '<div class="empty">Chưa có lớp nào. Bấm “Tạo lớp” để bắt đầu.</div>'}
    ${old.length ? `<details class="mt2"><summary>Lớp đã lưu trữ (${old.length})</summary><div class="grid g3 mt">${old.map(card).join('')}</div></details>` : ''}`);
  $('#new-c').onclick = () => modal(`<h3>Tạo lớp</h3><form id="ncf"><label for="nc-n">Tên lớp</label><input id="nc-n" maxlength="80" required placeholder="VD: N4 tối thứ 3-5">
    <label for="nc-d">Mô tả (không bắt buộc)</label><textarea id="nc-d" maxlength="500" rows="2" placeholder="Lịch học, phòng học, ghi chú cho học viên…"></textarea>
    <div class="row mt" style="justify-content:flex-end"><button type="button" id="nc-x">Hủy</button><button class="primary">Tạo lớp</button></div></form>`, (m, close) => {
    $('#nc-n', m).focus(); $('#nc-x', m).onclick = close;
    $('#ncf', m).onsubmit = async (e) => { e.preventDefault();
      try { const r = await api('POST', '/admin/classes', { name: $('#nc-n', m).value, description: $('#nc-d', m).value }); close(); nav(`/quan-tri/lop/${r.id}?tab=hv`); } catch (er) { toast(er.message, true); } };
  });
}, ST);

function assignForm(exams, a) {   // a: bài đang sửa (không đổi được đề)
  const v = a || { mode: 'practice', show_answers: 'after_submit', max_attempts: 1, allow_late: true };
  const def = new Date(); def.setDate(def.getDate() + 7); def.setHours(21, 0, 0, 0);
  return `<h3>${a ? 'Sửa bài giao' : 'Giao bài cho lớp'}</h3><form id="asf">
    ${a ? `<div class="small muted">Đề: <b>${esc(a.exam_title)}</b> (không đổi đề sau khi đã giao)</div>` : `<label for="as-e">Chọn đề (đề đã đăng)</label><select id="as-e" required><option value="">— Chọn đề —</option>${exams.map((e) => `<option value="${e.id}">[${esc(e.level)}] ${esc(e.title)} · ${e.question_count} câu</option>`).join('')}</select>`}
    <label for="as-t">Tên bài giao</label><input id="as-t" maxlength="120" value="${esc(v.title || '')}" placeholder="Để trống: dùng tên đề">
    <div class="grid g2"><div><label for="as-d">Hạn nộp</label><input id="as-d" type="datetime-local" value="${a ? toLocalInput(a.due_at) : toLocalInput(def.getTime())}"><label class="inline small"><input type="checkbox" id="as-nod" ${a && !a.due_at ? 'checked' : ''}> Không đặt hạn</label></div>
      <div><label for="as-m">Số lượt làm tối đa</label><select id="as-m">${[1, 2, 3, 5, 0].map((n) => `<option value="${n}" ${Number(v.max_attempts) === n ? 'selected' : ''}>${n ? n + ' lượt' : 'Không giới hạn'}</option>`).join('')}</select></div></div>
    <div class="grid g2"><div><label for="as-mode">Chế độ</label><select id="as-mode"><option value="practice" ${v.mode === 'practice' ? 'selected' : ''}>Luyện tập (không giới hạn giờ)</option><option value="real" ${v.mode === 'real' ? 'selected' : ''}>Thi thật (tính giờ, nghe 1 lần)</option></select></div>
      <div><label for="as-sa">Hiện đáp án cho học viên</label><select id="as-sa"><option value="after_submit" ${v.show_answers !== 'after_due' ? 'selected' : ''}>Ngay sau khi nộp</option><option value="after_due" ${v.show_answers === 'after_due' ? 'selected' : ''}>Sau hạn nộp (chống chép đáp án)</option></select></div></div>
    <label class="inline"><input type="checkbox" id="as-late" ${v.allow_late ? 'checked' : ''}> Cho nộp muộn sau hạn (được đánh dấu “Nộp muộn”)</label>
    <label for="as-n">Lời dặn cho học viên (không bắt buộc)</label><textarea id="as-n" rows="2" maxlength="1000" placeholder="VD: Làm phần nghe trước, chú ý câu 5–8.">${esc(v.note || '')}</textarea>
    <div class="row mt" style="justify-content:flex-end"><button type="button" id="as-x">Hủy</button><button class="primary">${a ? 'Lưu' : 'Giao bài'}</button></div></form>`;
}
function readAssignForm(m) {
  const d = $('#as-d', m).value, nod = $('#as-nod', m).checked;
  return { exam_id: $('#as-e', m) ? Number($('#as-e', m).value) : undefined, title: $('#as-t', m).value, due_at: nod || !d ? null : new Date(d).getTime(),
    max_attempts: Number($('#as-m', m).value), mode: $('#as-mode', m).value, show_answers: $('#as-sa', m).value, allow_late: $('#as-late', m).checked, note: $('#as-n', m).value };
}

route(/^\/quan-tri\/lop\/(\d+)$/, async (id) => {
  const tab = S.query.tab || 'bai';
  const c = await api('GET', '/admin/classes/' + id);
  const tabs = [['bai', `Bài giao (${c.assignments.length})`], ['hv', `Học viên (${c.members.length})`], ['diem', 'Bảng điểm'], ['cai-dat', 'Cài đặt']];
  let body = '';
  if (tab === 'bai') {
    body = `<div class="row between mb"><span class="muted small">Bài mới nhất ở trên. Bấm vào bài để xem ai đã nộp và câu nào cả lớp hay sai.</span><button class="accent" id="add-a" ${c.archived ? 'disabled' : ''}>＋ Giao bài</button></div>
      ${!c.members.length ? `<div class="alert info mb">Lớp chưa có học viên. Vào tab <a href="#/quan-tri/lop/${id}?tab=hv">Học viên</a> để lấy mã lớp hoặc thêm bằng email.</div>` : ''}
      ${c.assignments.length ? `<div class="card tw"><table><tr><th>Bài</th><th>Hạn nộp</th><th>Đã nộp</th><th></th></tr>${c.assignments.map((a) => { const p = a.total ? Math.round((100 * a.done) / a.total) : 0; const over = a.due_at && a.due_at < Date.now();
        return `<tr><td><a href="#/quan-tri/giao-bai/${a.id}"><b>${esc(a.title)}</b></a><div class="small muted">${esc(a.exam_title)} · ${a.question_count} câu · ${a.mode === 'real' ? 'thi thật' : 'luyện tập'}${a.show_answers === 'after_due' ? ' · đáp án sau hạn' : ''}</div></td>
        <td class="small">${a.due_at ? `${fmtDate(a.due_at)}${over ? '<div class="muted">đã hết hạn</div>' : ''}` : '<span class="muted">không hạn</span>'}</td>
        <td style="min-width:140px"><div class="small"><b>${a.done}</b>/${a.total}</div><div class="bar ${p >= 80 ? 'ok' : ''}"><i style="width:${p}%"></i></div></td>
        <td><a class="btn sm" href="#/quan-tri/giao-bai/${a.id}">Chi tiết</a></td></tr>`; }).join('')}</table></div>` : '<div class="empty">Chưa giao bài nào.</div>'}`;
  } else if (tab === 'hv') {
    body = `<div class="grid g2"><div class="card"><div class="small muted">Mã lớp</div><div class="code-big">${esc(c.code)}</div>
        <p class="small muted">Học viên đăng nhập, vào <b>Lớp học</b> và nhập mã này. Hoặc gửi link mời qua Zalo/Messenger:</p>
        <div class="row"><input id="jl" readonly value="${esc(joinLink(c.code))}" style="flex:1;min-width:0"><button id="cp-l">Sao chép link</button></div>
        <div class="row mt"><button class="sm ghost" id="cp-c">Sao chép mã</button><button class="sm ghost" id="new-code">Đổi mã mới</button></div></div>
      <div class="card"><b>Thêm bằng email</b><p class="small muted">Mỗi dòng hoặc dấu phẩy một email. Chỉ thêm được người đã có tài khoản.</p>
        <textarea id="em" rows="4" placeholder="an@gmail.com&#10;binh@gmail.com"></textarea><button class="primary mt" id="add-m">Thêm vào lớp</button><div id="add-r" class="mt"></div></div></div>
      <h2 class="mt2">Danh sách học viên (${c.members.length})</h2>
      ${c.members.length ? `<div class="card tw"><table><tr><th>Học viên</th><th>Vào lớp</th><th>Đăng nhập gần nhất</th><th></th></tr>${c.members.map((u) => `<tr><td>${esc(u.name)}<div class="small muted">${esc(u.email)}</div></td><td class="small">${fmtDate(u.joined_at)}</td><td class="small">${u.last_login ? fmtDate(u.last_login) : '<span class="muted">chưa</span>'}</td><td><button class="sm ghost" data-rm="${u.id}" data-n="${esc(u.name)}">Xóa khỏi lớp</button></td></tr>`).join('')}</table></div>` : '<div class="empty">Chưa có học viên.</div>'}`;
  } else if (tab === 'diem') {
    const g = await api('GET', `/admin/classes/${id}/gradebook`);
    body = `<div class="row between mb"><span class="small muted">Điểm cao nhất của mỗi học viên ở từng bài (%). Bấm vào điểm để xem bài làm.</span><a class="btn" href="/api/admin/classes/${id}/gradebook.xlsx" download>⇩ Tải Excel</a></div>
      ${g.rows.length && g.assignments.length ? `<div class="card tw"><table class="gb"><tr><th>Học viên</th>${g.assignments.map((a) => `<th title="${esc(a.title)}"><a href="#/quan-tri/giao-bai/${a.id}">${esc(a.title.length > 18 ? a.title.slice(0, 17) + '…' : a.title)}</a>${a.due_at ? `<div class="small muted">${new Date(a.due_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</div>` : ''}</th>`).join('')}<th>TB</th><th>Không nộp</th></tr>
        ${g.rows.map((r) => `<tr><td>${esc(r.name)}<div class="small muted">${esc(r.email)}</div></td>${r.cells.map((x) => `<td>${x.pct != null ? `<a class="${pctCls(x.pct)}" href="#/ketqua/${x.attempt_id}">${x.pct}%</a>${x.status === 'late' ? '<div class="small muted">muộn</div>' : x.status === 'grading' ? '<div class="small muted">chờ chấm</div>' : ''}` : `<span class="small ${x.status === 'missing' ? 'bad-text' : 'muted'}">${AST[x.status]?.[0] || ''}</span>`}</td>`).join('')}
          <td><b class="${pctCls(r.avg)}">${r.avg != null ? r.avg + '%' : '—'}</b></td><td>${r.missing ? `<span class="bad-text">${r.missing}</span>` : '0'}</td></tr>`).join('')}</table></div>` : '<div class="empty">Cần có học viên và ít nhất một bài giao để có bảng điểm.</div>'}`;
  } else {
    body = `<div class="card"><form id="cf2"><label for="c-n">Tên lớp</label><input id="c-n" maxlength="80" value="${esc(c.name)}"><label for="c-d">Mô tả</label><textarea id="c-d" rows="3" maxlength="500">${esc(c.description)}</textarea><button class="primary mt">Lưu</button></form></div>
      <div class="card mt"><b>${c.archived ? 'Mở lại lớp' : 'Lưu trữ lớp'}</b><p class="small muted">${c.archived ? 'Học viên lại thấy lớp và vào được bằng mã.' : 'Khi khóa học kết thúc: học viên không còn thấy lớp, không vào lớp bằng mã được nữa. Bảng điểm vẫn giữ.'}</p><button id="arch">${c.archived ? 'Mở lại lớp' : 'Lưu trữ lớp'}</button></div>
      <div class="card mt"><b class="bad-text">Xóa lớp</b><p class="small muted">Xóa lớp, danh sách học viên và các bài giao. Bài học viên đã làm vẫn nằm trong lịch sử của họ.</p><button class="danger" id="del-c">Xóa lớp</button></div>`;
  }
  adminShell('lop', `<a class="small" href="#/quan-tri/lop">← Lớp học</a><div class="row between mt"><div><h1 style="margin:0">${esc(c.name)}</h1><div class="small muted">Mã lớp <b>${esc(c.code)}</b> · ${c.members.length} học viên${c.archived ? ' · <span class="chip">Đã lưu trữ</span>' : ''}</div></div></div>
    <div class="tabs mt" role="tablist">${tabs.map(([k, t]) => `<a class="tab ${tab === k ? 'on' : ''}" role="tab" aria-selected="${tab === k}" href="#/quan-tri/lop/${id}?tab=${k}">${t}</a>`).join('')}</div>${body}`);

  if (tab === 'bai') { const b = $('#add-a'); if (b) b.onclick = async () => {
    const exams = await api('GET', '/admin/assignable-exams');
    if (!exams.length) return toast('Chưa có đề nào được đăng. Hãy tạo và đăng một đề trước.', true);
    modal(assignForm(exams), (m, close) => { $('#as-x', m).onclick = close;
      $('#as-e', m).onchange = () => { if (!$('#as-t', m).value) $('#as-t', m).placeholder = $('#as-e', m).selectedOptions[0].text.replace(/^\[[^\]]+\]\s*/, '').replace(/ · \d+ câu$/, ''); };
      $('#asf', m).onsubmit = async (e) => { e.preventDefault();
        try { const r = await api('POST', `/admin/classes/${id}/assignments`, readAssignForm(m)); close(); toast('Đã giao bài. Học viên trong lớp nhận được thông báo.'); nav('/quan-tri/giao-bai/' + r.id); } catch (er) { toast(er.message, true); } }; });
  }; }
  if (tab === 'hv') {
    $('#cp-l').onclick = () => copyText($('#jl').value); $('#cp-c').onclick = () => copyText(c.code);
    $('#new-code').onclick = async () => { if (await confirmBox('Đổi mã lớp? Mã và link mời cũ sẽ không dùng được nữa (học viên đã vào lớp không bị ảnh hưởng).')) { await api('PATCH', '/admin/classes/' + id, { new_code: true }); render(); } };
    $('#add-m').onclick = async () => { try { const r = await api('POST', `/admin/classes/${id}/members`, { emails: $('#em').value });
      if (r.added) await render();
      if (!r.not_found.length) return toast(`Đã thêm ${r.added} học viên.`);
      $('#add-r').innerHTML = `<div class="alert ${r.added ? 'info' : 'bad'}">Đã thêm ${r.added} người. Chưa có tài khoản: <b>${r.not_found.map(esc).join(', ')}</b>. Hãy gửi họ link mời (ô bên cạnh) để tự đăng ký và vào lớp.</div>`; $('#em').value = r.not_found.join('\n');
    } catch (e) { toast(e.message, true); } };
    $$('[data-rm]').forEach((b) => b.onclick = async () => { if (await confirmBox(`Xóa ${b.dataset.n} khỏi lớp? Bài họ đã làm vẫn được giữ.`)) { await api('DELETE', `/admin/classes/${id}/members/${b.dataset.rm}`); render(); } });
  }
  if (tab === 'cai-dat') {
    $('#cf2').onsubmit = async (e) => { e.preventDefault(); try { await api('PATCH', '/admin/classes/' + id, { name: $('#c-n').value, description: $('#c-d').value }); toast('Đã lưu.'); render(); } catch (er) { toast(er.message, true); } };
    $('#arch').onclick = async () => { await api('PATCH', '/admin/classes/' + id, { archived: !c.archived }); toast(c.archived ? 'Đã mở lại lớp.' : 'Đã lưu trữ lớp.'); render(); };
    $('#del-c').onclick = async () => { if (await confirmBox(`Xóa hẳn lớp "${c.name}"? Không hoàn tác được.`)) { await api('DELETE', '/admin/classes/' + id); toast('Đã xóa lớp.'); nav('/quan-tri/lop'); } };
  }
}, ST);

route(/^\/quan-tri\/giao-bai\/(\d+)$/, async (id) => {
  const a = await api('GET', '/admin/assignments/' + id);
  const n = (s) => a.students.filter((x) => s.includes(x.status)).length;
  const done = n(['done', 'late', 'grading']), left = n(['todo', 'doing', 'missing']);
  const scored = a.students.filter((x) => x.pct != null), avg = scored.length ? Math.round(scored.reduce((s, x) => s + x.pct, 0) / scored.length) : null;
  const order = { missing: 0, todo: 1, doing: 2, grading: 3, late: 4, done: 5 };
  const rows = [...a.students].sort((x, y) => order[x.status] - order[y.status] || x.name.localeCompare(y.name));
  adminShell('lop', `<a class="small" href="#/quan-tri/lop/${a.class_id}">← ${esc(a.class_name)}</a>
    <div class="row between mt"><div><h1 style="margin:0">${esc(a.title)}</h1><div class="small muted">${esc(a.exam_title)} · ${a.question_count} câu · ${a.mode === 'real' ? 'thi thật' : 'luyện tập'} · ${a.max_attempts ? a.max_attempts + ' lượt' : 'không giới hạn lượt'} · đáp án ${a.show_answers === 'after_due' ? 'hiện sau hạn' : 'hiện ngay khi nộp'}</div>
      <div class="small mt">${a.due_at ? `Hạn nộp <b>${fmtDate(a.due_at)}</b>${a.due_at < Date.now() ? ' <span class="chip">đã hết hạn</span>' : ''}${a.allow_late ? '' : ' · không nhận bài muộn'}` : 'Không đặt hạn nộp'}</div></div>
      <div class="row" style="gap:6px"><button class="sm" id="ed-a">Sửa</button><button class="sm danger" id="del-a">Xóa</button></div></div>
    ${a.note ? `<div class="small mt note" style="background:var(--indigo-soft);border-radius:8px;padding:6px 10px;white-space:pre-wrap">${esc(a.note)}</div>` : ''}
    <div class="grid g4 mt"><div class="card flat"><div class="small muted">Đã nộp</div><div class="stat">${done}/${a.students.length}</div></div><div class="card flat"><div class="small muted">Chưa nộp</div><div class="stat ${left ? 'bad-text' : ''}">${left}</div></div>
      <div class="card flat"><div class="small muted">Điểm TB (lần tốt nhất)</div><div class="stat">${avg != null ? avg + '%' : '—'}</div></div><div class="card flat"><div class="small muted">Chờ chấm tự luận</div><div class="stat">${n(['grading'])}</div>${n(['grading']) ? '<a class="small" href="#/quan-tri/cham-bai">Đi chấm →</a>' : ''}</div></div>
    <div class="row between mt2"><h2 style="margin:0">Học viên</h2><button class="accent" id="remind" ${left ? '' : 'disabled'}>🔔 Nhắc ${left} người chưa nộp</button></div>
    ${rows.length ? `<div class="card tw mt"><table><tr><th>Học viên</th><th>Tình trạng</th><th>Lượt</th><th>Điểm tốt nhất</th><th></th></tr>${rows.map((s) => `<tr><td>${esc(s.name)}<div class="small muted">${esc(s.email)}</div></td><td>${astChip(s.status)}${s.submitted_at ? `<div class="small muted">${fmtDate(s.submitted_at)}</div>` : ''}</td><td>${s.tries}</td>
      <td>${s.pct != null ? `<b class="${pctCls(s.pct)}">${s.pct}%</b> <span class="small muted">${esc(s.score)}</span>` : '—'}</td><td>${s.attempt_id ? `<a class="btn sm" href="#/ketqua/${s.attempt_id}">Xem bài</a>` : ''}</td></tr>`).join('')}</table></div>` : '<div class="empty">Lớp chưa có học viên.</div>'}
    <h2 class="mt2">Câu cả lớp hay sai</h2>
    ${a.questions.length ? `<p class="small muted">Tính trên lần nộp tốt nhất của mỗi học viên, câu có tỷ lệ đúng thấp nhất ở trên. Nên chữa những câu này trên lớp.</p>
      <div class="card tw"><table><tr><th>#</th><th>Câu hỏi</th><th>Tỷ lệ đúng</th><th>Đáp án sai hay chọn</th></tr>${a.questions.map((q) => `<tr><td><a href="#/quan-tri/cau-hoi/${q.id}">${q.id}</a></td><td><div class="jp clamp2" style="max-width:420px">${esc(plainA(q.stem))}</div><div class="small muted">${esc(SECTIONS[q.section] || q.section || '')}</div></td>
        <td style="min-width:120px"><b class="${pctCls(q.pct)}">${q.pct}%</b> <span class="small muted">(${q.n} bài)</span><div class="bar ${q.pct >= 70 ? 'ok' : 'bad'}"><i style="width:${q.pct}%"></i></div></td>
        <td class="small">${q.common_wrong ? `<span class="jp">${esc(plainA(q.common_wrong.text))}</span> <span class="muted">(${q.common_wrong.n} người)</span>` : '—'}</td></tr>`).join('')}</table></div>` : '<div class="empty">Chưa có ai nộp bài.</div>'}`);
  $('#remind').onclick = async () => { const b = $('#remind'); b.disabled = true;
    try { const r = await api('POST', `/admin/assignments/${id}/remind`); toast(`Đã gửi nhắc nhở tới ${r.reminded} học viên${r.emailed ? ` (kèm ${r.emailed} email)` : ''}.`); } catch (e) { b.disabled = false; toast(e.message, true); } };
  $('#del-a').onclick = async () => { if (await confirmBox(`Xóa bài giao "${a.title}"? Bài học viên đã làm vẫn nằm trong lịch sử của họ nhưng không còn trong bảng điểm lớp.`)) { await api('DELETE', '/admin/assignments/' + id); nav('/quan-tri/lop/' + a.class_id); } };
  $('#ed-a').onclick = () => modal(assignForm([], a), (m, close) => { $('#as-x', m).onclick = close;
    $('#asf', m).onsubmit = async (e) => { e.preventDefault(); const v = readAssignForm(m); delete v.exam_id;
      try { await api('PATCH', '/admin/assignments/' + id, v); close(); toast('Đã lưu.'); render(); } catch (er) { toast(er.message, true); } }; });
}, ST);
const plainA = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\{([^}|]+)\|[^}]+\}/g, '$1').replace(/\s+/g, ' ').trim();

/* ---- Tải đề từ file PDF / Word ---- */
route(/^\/quan-tri\/tai-de$/, async () => {
  if (!can.edit()) return view('<div class="alert bad">Chỉ giảng viên, biên tập viên hoặc quản trị viên được tải đề.</div>');
  if (S.query.kieu === 'phieu') return sheetBuilder();
  let D = null, busy = false;
  const LV = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const L = 'ABCDEF';
  const rowsOf = (t, min = 2, max = 8) => Math.max(min, Math.min(max, String(t || '').split('\n').length + Math.floor(String(t || '').length / 70)));
  const missing = () => D.sections.flatMap((s) => s.questions).filter((q) => q.kind === 'mcq' && !(q.answer >= 0)).length;
  const total = () => D.sections.reduce((a, s) => a + s.questions.length, 0);

  adminShell('tai-de', `<h1>Tải đề thi từ file PDF / Word</h1>${upTabs('chu')}
    <div class="card"><p class="muted" style="margin-top:0">Chọn file đề, hệ thống tự tách thành từng câu. Bạn xem lại, chọn đáp án đúng (hoặc dán bảng đáp án), rồi bấm <b>Tạo đề</b>. Đề tạo xong nằm trong Kho đề và giao được cho lớp.</p>
      <input type="file" id="df" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
      <div id="dmsg" class="mt"></div>
      <details class="mt small"><summary>File cần trình bày thế nào?</summary><ul class="muted">
        <li>PDF có chữ (xuất từ Word / Google Docs) hoặc file <b>.docx</b>. File scan, ảnh chụp không đọc được.</li>
        <li>Câu hỏi đánh số <b>1.</b> <b>2.</b> … hoặc <b>Câu 1:</b>; phương án <b>A. B. C. D.</b> (cùng dòng hoặc xuống dòng).</li>
        <li>Nhóm câu bắt đầu bằng <b>問題 1</b> … kèm yêu cầu; phần lớn bắt đầu bằng <b>第1部</b> hoặc <b>Phần I</b>. Đoạn văn đọc hiểu có tiêu đề <b>【…】</b> được gắn vào các câu phía sau.</li>
        <li>Câu không có phương án thành câu tự luận. Có dòng <b>解答欄 / 訂正 / 読み / Bản dịch</b> phía dưới cũng được.</li>
        <li>Cuối file có phần <b>ĐÁP ÁN</b> hoặc <b>解答</b> (vd. <code>1.C 2.B 3.A</code>) thì đáp án được điền sẵn.</li></ul></details></div>
    <div id="dv"></div>`);

  const card = (q, si, qi) => {
    const id = `${si}-${qi}`, miss = q.kind === 'mcq' && !(q.answer >= 0);
    return `<div class="card mb dq ${miss ? 'miss' : ''}" id="dq-${id}" data-si="${si}" data-qi="${qi}">
      <div class="row between"><div class="row" style="gap:6px"><b>Câu ${esc(q.label)}</b>${q.guessed ? '<span class="chip warn">số câu tự đánh</span>' : ''}${miss ? '<span class="chip bad">chưa chọn đáp án</span>' : ''}</div>
        <div class="row" style="gap:6px"><select data-f="kind" class="sm-sel"><option value="mcq" ${q.kind === 'mcq' ? 'selected' : ''}>Trắc nghiệm</option><option value="essay" ${q.kind === 'essay' ? 'selected' : ''}>Tự luận</option></select>
        <select data-f="section" class="sm-sel">${Object.entries(SECTIONS).map(([k, t]) => `<option value="${k}" ${q.section === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <label class="inline small">Điểm <input data-f="points" type="number" min="1" max="100" value="${q.points || 1}" style="width:64px"></label>
        <button class="sm ghost" data-del title="Xóa câu này">✕</button></div></div>
      <div class="qerr"></div>
      ${q.passage ? `<details class="mt"><summary class="small">Đoạn văn kèm theo (${q.passage.length} ký tự)</summary><textarea data-f="passage" class="jp" rows="${rowsOf(q.passage, 3, 10)}">${esc(q.passage)}</textarea></details>` : ''}
      <textarea data-f="stem" class="jp mt" rows="${rowsOf(q.stem)}">${esc(q.stem)}</textarea>
      ${q.kind === 'mcq' ? `<div class="dopts mt">${q.options.map((o, k) => `<label class="dopt ${q.answer === k ? 'on' : ''}"><input type="radio" name="a-${id}" value="${k}" ${q.answer === k ? 'checked' : ''}><b>${L[k]}</b><input data-opt="${k}" class="jp" value="${esc(o)}"></label>`).join('')}</div>
        <div class="row mt small" style="gap:6px">${q.options.length < 6 ? '<button class="sm ghost" data-addopt>+ phương án</button>' : ''}${q.options.length > 2 ? '<button class="sm ghost" data-rmopt>− bớt phương án</button>' : ''}<span class="muted">Bấm vào nút tròn để chọn đáp án đúng.</span></div>`
      : `<div class="row mt" style="gap:8px"><select data-f="etype" class="sm-sel"><option value="">Tự luận chung</option>${Object.entries(ETYPES).map(([k, t]) => `<option value="${k}" ${q.etype === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <label class="inline small">Giới hạn ${lenUnit(q.etype) === 'words' ? 'từ' : 'chữ'} <input data-f="max_len" type="number" min="0" max="5000" value="${q.max_len || 0}" style="width:80px"></label></div>
        <div class="grid g2 mt"><div><label class="small">Đáp án tự chấm (nếu khớp thì tự cho điểm, cách nhau dấu |)</label><input data-f="accepted" class="jp" value="${esc(q.accepted || '')}" placeholder="VD: DBAC  hoặc  つづけて"></div>
        <div><label class="small">Đáp án mẫu / hướng dẫn chấm (giáo viên xem khi chấm)</label><textarea data-f="model_answer" class="jp" rows="2">${esc(q.model_answer || '')}</textarea></div></div>`}
    </div>`;
  };
  const counts = () => { const qs = D.sections.flatMap((s) => s.questions); const m = missing();
    $('#dcount').innerHTML = `${qs.length} câu · ${qs.filter((q) => q.kind === 'mcq').length} trắc nghiệm · ${qs.filter((q) => q.kind === 'essay').length} tự luận${m ? ` · <b class="bad-text">${m} câu chưa chọn đáp án</b>` : ' · <b class="ok-text">đủ đáp án</b>'}`;
    $('#dgo').textContent = `Tạo đề (${qs.length} câu)`; };
  const draw = () => {
    const nE = D.sections.flatMap((s) => s.questions).filter((q) => q.kind === 'essay').length;
    $('#dv').innerHTML = `
      ${D.warnings?.length ? `<div class="alert warn mt">${D.warnings.map(esc).join('<br>')}</div>` : ''}
      <div class="card mt"><h2 style="margin-top:0">Thông tin đề</h2>
        <div class="field-row"><div style="flex:2"><label for="dt">Tên đề</label><input id="dt" value="${esc(D.title || '')}" maxlength="150"></div>
          <div><label for="dl">Cấp độ</label><select id="dl">${LV.map((l) => `<option ${(D.level || 'N3') === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div><label for="dm">Thời gian (phút)</label><input id="dm" type="number" min="5" max="600" value="${D.minutes || 60}"></div>
          <div><label for="ds">Thang điểm</label><select id="ds"><option value="10">Thang 10</option><option value="100">Thang 100</option></select></div></div>
        <div class="field-row"><div><label for="dkind">Danh mục</label><select id="dkind">${Object.entries(EXAM_KINDS).map(([k, t]) => `<option value="${k}" ${(nE ? 'chuyen' : 'jlpt') === k ? 'selected' : ''}>${t}${MCQ_ONLY.includes(k) ? ' (chỉ trắc nghiệm)' : ''}</option>`).join('')}</select></div>
          <div><label for="ddiff">Mức độ</label><select id="ddiff">${DIFFS.map((d, i) => `<option value="${i}">${d}</option>`).join('')}</select></div></div>
        <label class="inline mt"><input type="checkbox" id="dp" checked> Đăng ngay (bỏ chọn để lưu nháp, sửa thêm rồi đăng sau)</label></div>
      <div class="card mt"><b>Dán bảng đáp án</b> <span class="small muted">(không bắt buộc)</span>
        <p class="small muted">Ghi theo số câu trên đề, ví dụ: <code>1.C 2.B 3.A</code> · câu sắp xếp <code>41.DBAC</code> · đúng/sai <code>111.○ 112.×</code> · đọc kanji <code>96.つづけて</code>. Mỗi câu cách nhau dấu cách hoặc xuống dòng.</p>
        <textarea id="dk" rows="3" class="jp" placeholder="1.C 2.B 3.B 4.A …"></textarea><button class="mt" id="dka">Điền đáp án</button></div>
      ${nE ? `<div class="alert info mt">Có ${nE} câu tự luận. Câu có <b>đáp án tự chấm</b> (sắp xếp, đọc kanji…) được chấm ngay khi học viên nộp; câu còn lại giáo viên chấm ở <b>Chấm tự luận</b>.</div>` : ''}
      <div id="dqs">${D.sections.map((s, si) => `<div class="dsec" data-si="${si}"><div class="row between mt2"><input data-secname="${si}" value="${esc(s.name)}" style="font-weight:700;flex:1"><span class="small muted" style="margin-left:8px">${s.questions.length} câu</span>${s.questions.some((q) => q.kind === 'essay') ? `<label class="inline small" style="margin-left:8px">Giới hạn cả nhóm <input data-seclim="${si}" type="number" min="0" max="5000" placeholder="0" style="width:80px"></label>` : ''}</div>
        ${s.questions.map((q, qi) => card(q, si, qi)).join('')}</div>`).join('')}</div>
      <div class="savebar row between"><span id="dcount" class="small"></span><button class="primary" id="dgo"></button></div>`;
    counts(); wire();
  };
  const at = (el) => { const c = el.closest('.dq'); return c ? { c, q: D.sections[c.dataset.si].questions[c.dataset.qi], si: +c.dataset.si, qi: +c.dataset.qi } : null; };
  const redrawCard = (x) => { x.c.outerHTML = card(x.q, x.si, x.qi); counts(); };
  function wire() {
    const box = $('#dqs');
    box.oninput = (e) => { const t = e.target;
      if (t.dataset.secname != null) { D.sections[t.dataset.secname].name = t.value; return; }
      const x = at(t); if (!x) return;
      if (t.dataset.opt != null) x.q.options[+t.dataset.opt] = t.value;
      else if (t.dataset.f && t.tagName !== 'SELECT') x.q[t.dataset.f] = ['points', 'max_len'].includes(t.dataset.f) ? Number(t.value) : t.value; };
    box.onchange = (e) => { const t = e.target, x = at(t); if (!x) return;
      if (t.type === 'radio') { x.q.answer = Number(t.value); redrawCard(x); return; }
      if (t.dataset.f === 'kind') { x.q.kind = t.value; if (t.value === 'mcq' && x.q.options.length < 2) { x.q.options = ['', '', '', '']; x.q.answer = -1; } redrawCard(x); return; }
      if (t.dataset.f === 'section') x.q.section = t.value;
      if (t.dataset.f === 'etype') { x.q.etype = t.value; redrawCard(x); } };
    box.addEventListener('change', (e) => { const t = e.target; if (t.dataset.seclim == null) return;
      const v = Number(t.value) || 0; for (const q of D.sections[t.dataset.seclim].questions) if (q.kind === 'essay') q.max_len = v;
      t.closest('.dsec').querySelectorAll('[data-f="max_len"]').forEach((i) => { i.value = v; }); });
    box.onclick = (e) => { const t = e.target.closest('button'); if (!t) return; const x = at(t); if (!x) return;
      if (t.hasAttribute('data-del')) { D.sections[x.si].questions.splice(x.qi, 1); draw(); }
      else if (t.hasAttribute('data-addopt')) { x.q.options.push(''); redrawCard(x); }
      else if (t.hasAttribute('data-rmopt')) { x.q.options.pop(); if (x.q.answer >= x.q.options.length) x.q.answer = -1; redrawCard(x); } };
    $('#dka').onclick = async () => { try { D.title = $('#dt').value; const r = await api('POST', '/admin/import/document/key', { doc: D, key: $('#dk').value }); const keep = $('#dk').value;
      D = r.doc; draw(); $('#dk').value = keep; toast(r.applied ? `Đã điền ${r.applied} đáp án.` : 'Không khớp được câu nào. Kiểm tra lại số câu và cách ghi.', !r.applied); } catch (er) { toast(er.message, true); } };
    $('#dgo').onclick = commit;
  }
  async function commit() {
    if (busy) return; const m = missing();
    if (m && !(await confirmBox(`Còn ${m} câu trắc nghiệm chưa chọn đáp án. Hệ thống sẽ báo những câu đó để bạn sửa. Tiếp tục kiểm tra?`))) return;
    busy = true; const b = $('#dgo'); b.disabled = true; $$('.dq .qerr').forEach((x) => { x.innerHTML = ''; });
    try {
      const r = await api('POST', '/admin/import/document/commit', { title: $('#dt').value, level: $('#dl').value, minutes: Number($('#dm').value), scale: Number($('#ds').value), publish: $('#dp').checked, exam_kind: $('#dkind').value, difficulty: Number($('#ddiff').value), sections: D.sections });
      $('#dv').innerHTML = `<div class="card mt"><h2 style="margin-top:0">Đã tạo đề “${esc($('#dt')?.value || D.title)}”</h2><p>${r.questions} câu đã vào ngân hàng câu hỏi${r.status === 'published' ? ' và đề đã được đăng' : r.status === 'pending' ? ', đề đang chờ người duyệt đăng' : ', đề đang ở trạng thái nháp'}.</p>
        <div class="row"><a class="btn primary" href="#/de/${r.id}">Xem đề như học viên</a><a class="btn" href="#/quan-tri/de/${r.id}">Sửa đề</a>${['teacher', 'admin'].includes(S.user.role) ? '<a class="btn" href="#/quan-tri/lop">Giao cho lớp</a>' : ''}<a class="btn ghost" href="#/quan-tri/tai-de">Tải đề khác</a></div></div>`;
      scrollTo(0, 0); toast('Đã tạo đề.');
    } catch (e) {
      toast(e.message, true);
      for (const er of e.data?.errors || []) { const c = [...$$('.dq')].find((el) => +el.dataset.si === er.section && D.sections[er.section].questions[el.dataset.qi]?.label === er.label);
        if (c) { c.classList.add('miss'); c.querySelector('.qerr').innerHTML = `<div class="alert bad small mt">${er.errors.map(esc).join('; ')}</div>`; } }
      const first = $('.dq .qerr .alert'); if (first) first.closest('.dq').scrollIntoView({ block: 'center', behavior: 'smooth' });
    } finally { busy = false; const bb = $('#dgo'); if (bb) bb.disabled = false; }
  }
  $('#df').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 20 * 1024 * 1024) return toast('File quá lớn (tối đa 20 MB).', true);
    $('#dmsg').innerHTML = '<div class="small muted">Đang đọc file…</div>'; $('#dv').innerHTML = '';
    try {
      D = await api('POST', '/admin/import/document', { 'content-type': 'application/octet-stream', 'x-filename': encodeURIComponent(f.name) }, f);
      $('#dmsg').innerHTML = `<div class="alert ok">Đã đọc <b>${esc(f.name)}</b>${D.pages ? ` (${D.pages} trang)` : ''}: tách được <b>${total()}</b> câu trong ${D.sections.length} nhóm${D.key_applied ? `, tự điền ${D.key_applied} đáp án từ phần đáp án cuối file` : ''}. Xem lại bên dưới.</div>`;
      draw();
    } catch (er) { $('#dmsg').innerHTML = `<div class="alert bad">${esc(er.message)}${er.status === 422 ? '<div class="mt">Đề là file scan hoặc ảnh chụp? Dùng <a href="#/quan-tri/tai-de?kieu=phieu"><b>Đề scan + phiếu trả lời</b></a>: học viên xem file đề và tô đáp án.</div>' : ''}</div>`; }
    e.target.value = '';
  };
}, ST);
const upTabs = (on) => `<div class="tabs mb" role="tablist"><a class="tab ${on === 'chu' ? 'on' : ''}" href="#/quan-tri/tai-de">Đề có chữ: tự tách câu</a><a class="tab ${on === 'phieu' ? 'on' : ''}" href="#/quan-tri/tai-de?kieu=phieu">Đề scan / ảnh: phiếu trả lời</a></div>`;

/* Đề scan / ảnh chụp: học viên xem file đề, tô phiếu trả lời; giáo viên khai báo nhóm câu và đáp án */
function sheetBuilder() {
  const LV = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const TYPES = [['mcq', 'Trắc nghiệm'], ['tf', 'Đúng / Sai'], ['text', 'Điền ngắn (tự chấm)'], ['essay', 'Tự luận (GV chấm)']];
  const SECS = Object.entries(SECTIONS).filter(([k]) => k !== 'listening');
  const P = { doc: null, groups: [{ name: 'Phần 1', from: 1, to: 20, type: 'mcq', n: 4, points: 1, section: 'reading' }], ans: {} };
  let busy = false;
  const nums = (g) => { const a = []; const f = Number(g.from), t = Number(g.to); if (Number.isInteger(f) && Number.isInteger(t) && f >= 1 && t >= f && t - f < 400) for (let i = f; i <= t; i++) a.push(i); return a; };
  const optsOf = (g) => g.type === 'mcq' ? 'ABCDEF'.slice(0, Number(g.n) || 4).split('') : g.type === 'tf' ? ['Đúng', 'Sai'] : [];
  const need = (g, no) => (g.type === 'mcq' || g.type === 'tf') ? !Number.isInteger(P.ans[no]) || P.ans[no] >= optsOf(g).length : g.type === 'text' ? !String(P.ans[no] ?? '').trim() : false;
  adminShell('tai-de', `<h1>Tải đề thi từ file PDF / Word</h1>${upTabs('phieu')}
    <div class="card"><p class="muted" style="margin-top:0">Dùng cho đề <b>scan, ảnh chụp</b> hoặc đề có hình vẽ, bảng biểu khó tách. Học viên xem nguyên file đề và tô đáp án trên <b>phiếu trả lời</b>; hệ thống tự chấm theo đáp án bạn nhập.</p>
      <h3>1. File đề</h3><input type="file" id="phf" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"><div id="phmsg" class="mt small muted">PDF hoặc ảnh (png, jpg, webp).</div></div>
    <div class="card mt"><h3 style="margin-top:0">2. Thông tin đề</h3>
      <div class="field-row"><div style="flex:2"><label for="st">Tên đề</label><input id="pht" maxlength="150" placeholder="VD: Đề thi thử N3 tháng 11"></div>
        <div><label for="sl">Cấp độ</label><select id="phl">${LV.map((l) => `<option ${l === 'N3' ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label for="phm">Thời gian (phút)</label><input id="phm" type="number" min="5" max="600" value="60"></div>
        <div><label for="phs">Thang điểm</label><select id="phs"><option value="10">Thang 10</option><option value="100">Thang 100</option></select></div></div>
      <div class="field-row"><div><label for="phkind">Danh mục</label><select id="phkind"><option value="">Tự chọn theo nhóm câu</option>${Object.entries(EXAM_KINDS).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></div>
        <div><label for="phdiff">Mức độ</label><select id="phdiff">${DIFFS.map((d, i) => `<option value="${i}">${d}</option>`).join('')}</select></div></div>
      <label class="inline mt"><input type="checkbox" id="php" checked> Đăng ngay (bỏ chọn để lưu nháp)</label></div>
    <div class="card mt"><h3 style="margin-top:0">3. Các nhóm câu trên phiếu</h3><p class="small muted">Ghi số câu theo đúng đề. Ví dụ đề có câu 1-40 trắc nghiệm A-D, câu 41-45 điền từ, câu 46 viết đoạn văn thì tạo 3 nhóm.</p>
      <div id="phg"></div><button class="sm mt" id="phg-add">＋ Thêm nhóm</button></div>
    <div class="card mt"><h3 style="margin-top:0">4. Đáp án</h3>
      <p class="small muted">Dán bảng đáp án theo số câu, ví dụ <code>1.C 2.B 3.A</code>, đúng/sai <code>21.Đ 22.S</code>, điền ngắn <code>41.つづけて</code>. Hoặc bấm trực tiếp vào phiếu bên dưới.</p>
      <textarea id="phk" rows="3" class="jp" placeholder="1.C 2.B 3.B 4.A …"></textarea><button class="mt" id="phka">Điền đáp án</button>
      <div id="pha" class="mt"></div></div>
    <div class="savebar row between"><span id="phcount" class="small"></span><button class="primary" id="phgo">Tạo đề</button></div>
    <div id="phdone"></div>`);
  const drawGroups = () => {
    $('#phg').innerHTML = P.groups.map((g, i) => `<div class="sgrp" data-g="${i}">
      <div><label class="small">Tên nhóm</label><input data-k="name" value="${esc(g.name)}" maxlength="80"></div>
      <div><label class="small">Từ câu</label><input data-k="from" type="number" min="1" max="999" value="${esc(g.from)}"></div>
      <div><label class="small">Đến câu</label><input data-k="to" type="number" min="1" max="999" value="${esc(g.to)}"></div>
      <div><label class="small">Kiểu</label><select data-k="type">${TYPES.map(([k, t]) => `<option value="${k}" ${g.type === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div ${g.type === 'mcq' ? '' : 'hidden'}><label class="small">Số phương án</label><select data-k="n">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${Number(g.n) === n ? 'selected' : ''}>A–${'ABCDEF'[n - 1]}</option>`).join('')}</select></div>
      <div><label class="small">Điểm/câu</label><input data-k="points" type="number" min="1" max="100" value="${esc(g.points)}"></div>
      <div><label class="small">Phần thi</label><select data-k="section">${SECS.map(([k, t]) => `<option value="${k}" ${g.section === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div style="flex:1 1 170px" ${g.type === 'essay' ? '' : 'hidden'}><label class="small">Dạng tự luận</label><select data-k="etype"><option value="">Tự luận chung</option>${Object.entries(ETYPES).filter(([k]) => k !== 'short').map(([k, t]) => `<option value="${k}" ${g.etype === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div ${g.type === 'text' || g.type === 'essay' ? '' : 'hidden'}><label class="small">Giới hạn ${lenUnit(g.type === 'essay' ? g.etype : 'short') === 'words' ? 'từ' : 'chữ'}</label><input data-k="max_len" type="number" min="0" max="5000" value="${esc(g.max_len || 0)}"></div>
      <div class="sgx">${P.groups.length > 1 ? `<button class="sm ghost" data-rm="${i}" title="Xóa nhóm">✕</button>` : ''}</div></div>`).join('');
  };
  const drawSheet = () => {
    $('#pha').innerHTML = P.groups.map((g) => { const ns = nums(g); const o = optsOf(g);
      return `<div class="small muted mt"><b>${esc(g.name)}</b> · ${ns.length ? `câu ${ns[0]}-${ns[ns.length - 1]}` : '<span class="bad-text">khoảng số câu chưa đúng</span>'}</div>${ns.map((no) => {
        if (g.type === 'text' || g.type === 'essay') return `<div class="srow ${need(g, no) ? 'need' : ''}" data-row="${no}"><span class="sn">${no}</span><input class="jp" data-an="${no}" value="${esc(P.ans[no] ?? '')}" placeholder="${g.type === 'text' ? 'Đáp án đúng (nhiều đáp án cách nhau |)' : 'Đáp án mẫu cho giáo viên (không bắt buộc)'}"></div>`;
        return `<div class="srow ${need(g, no) ? 'need' : ''}" data-row="${no}"><span class="sn">${no}</span>${o.map((x, k) => `<button class="bub ${P.ans[no] === k ? 'on' : ''}" data-no="${no}" data-i="${k}">${esc(x)}</button>`).join('')}</div>`; }).join('')}`; }).join('');
    counts();
  };
  const counts = () => { let t = 0, m = 0; const seen = new Set(); let dup = 0;
    for (const g of P.groups) for (const no of nums(g)) { t++; if (seen.has(no)) dup++; seen.add(no); if (need(g, no)) m++; }
    $('#phcount').innerHTML = `${t} câu${dup ? ` · <b class="bad-text">${dup} câu trùng số giữa các nhóm</b>` : ''}${m ? ` · <b class="bad-text">${m} câu chưa có đáp án</b>` : t ? ' · <b class="ok-text">đủ đáp án</b>' : ''}${P.doc ? '' : ' · <b class="bad-text">chưa tải file đề</b>'}`;
    $('#phgo').textContent = `Tạo đề (${t} câu)`;
    $$('#pha .srow').forEach((r) => { const no = Number(r.dataset.row); const g = P.groups.find((x) => nums(x).includes(no)); if (g) r.classList.toggle('need', need(g, no)); });
  };
  drawGroups(); drawSheet();
  $('#phg').oninput = (e) => { const t = e.target, el = t.closest('[data-g]'); if (!el || !t.dataset.k) return; const g = P.groups[el.dataset.g];
    g[t.dataset.k] = ['from', 'to', 'points', 'n', 'max_len'].includes(t.dataset.k) ? Number(t.value) : t.value;
    if (t.tagName === 'SELECT') drawGroups(); clearTimeout(drawSheet.t); drawSheet.t = setTimeout(drawSheet, 250); };
  $('#phg').onclick = (e) => { const b = e.target.closest('[data-rm]'); if (!b) return; P.groups.splice(Number(b.dataset.rm), 1); drawGroups(); drawSheet(); };
  $('#phg-add').onclick = () => { const last = P.groups[P.groups.length - 1]; const f = (Number(last?.to) || 0) + 1;
    P.groups.push({ name: `Phần ${P.groups.length + 1}`, from: f, to: f + 9, type: last?.type || 'mcq', n: last?.n || 4, points: last?.points || 1, section: last?.section || 'reading' }); drawGroups(); drawSheet(); };
  $('#pha').onclick = (e) => { const b = e.target.closest('.bub'); if (!b) return; const no = Number(b.dataset.no), k = Number(b.dataset.i);
    P.ans[no] = P.ans[no] === k ? undefined : k;
    $$(`#pha .bub[data-no="${no}"]`).forEach((x) => x.classList.toggle('on', P.ans[no] === Number(x.dataset.i))); counts(); };
  $('#pha').oninput = (e) => { const t = e.target; if (t.dataset.an == null) return; P.ans[Number(t.dataset.an)] = t.value; counts(); };
  $('#phka').onclick = () => {
    const txt = $('#phk').value.normalize('NFKC').replace(/(ĐÁP ÁN|Đáp án|解答|正解)\s*[:：]?/g, ' '); let n = 0;
    for (const m of txt.matchAll(/(?:^|[\s,;、|])(?:Câu\s*)?(\d{1,3})\s*[.:：\-)）=]?\s*([^\s,;、|]+)/gi)) {
      const no = Number(m[1]), v = m[2].replace(/[.。]$/, ''); const g = P.groups.find((x) => nums(x).includes(no)); if (!g || !v) continue;
      if (g.type === 'text' || g.type === 'essay') { P.ans[no] = v; n++; continue; }
      let i = -1; const o = optsOf(g);
      if (g.type === 'tf') i = /^([○〇◯oOĐđTt]|Đúng|true)$/i.test(v) ? 0 : /^([×✕xXSsFf]|Sai|false)$/i.test(v) ? 1 : -1;
      else if (/^[A-Fa-f]$/.test(v)) i = 'ABCDEF'.indexOf(v.toUpperCase()); else if (/^[1-6]$/.test(v)) i = Number(v) - 1;
      if (i >= 0 && i < o.length) { P.ans[no] = i; n++; }
    }
    drawSheet(); toast(n ? `Đã điền ${n} đáp án.` : 'Không khớp được câu nào. Kiểm tra số câu và các nhóm câu.', !n);
  };
  $('#phf').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!/\.(pdf|png|jpe?g|webp)$/i.test(f.name)) { toast('Chỉ nhận file PDF hoặc ảnh png, jpg, webp.', true); e.target.value = ''; return; }
    $('#phmsg').innerHTML = 'Đang tải file lên…';
    try { const r = await uploadMedia(f); P.doc = r.url; if (!$('#pht').value) $('#pht').value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 150);
      $('#phmsg').innerHTML = `<span class="ok-text">✓ Đã tải <b>${esc(f.name)}</b>.</span> <a href="${esc(r.url)}" target="_blank" rel="noopener">Xem file</a>`; counts(); }
    catch (er) { $('#phmsg').innerHTML = `<span class="bad-text">${esc(er.message)}</span>`; }
  };
  $('#phgo').onclick = async () => {
    if (busy) return; busy = true; const b = $('#phgo'); b.disabled = true;
    try {
      const answers = {}; for (const [k, v] of Object.entries(P.ans)) if (v !== undefined && v !== '') answers[k] = v;
      const r = await api('POST', '/admin/import/sheet', { title: $('#pht').value, level: $('#phl').value, minutes: Number($('#phm').value), scale: Number($('#phs').value), publish: $('#php').checked, exam_kind: $('#phkind').value, difficulty: Number($('#phdiff').value), doc_url: P.doc || '', groups: P.groups, answers });
      $('#ad').innerHTML = `<h1>Tải đề thi từ file PDF / Word</h1><div class="card"><h2 style="margin-top:0">Đã tạo đề “${esc($('#pht').value)}”</h2><p>Phiếu trả lời có ${r.questions} câu${r.status === 'published' ? ', đề đã được đăng' : r.status === 'pending' ? ', đề đang chờ người duyệt đăng' : ', đề đang ở trạng thái nháp'}.</p>
        <div class="row"><a class="btn primary" href="#/de/${r.id}">Xem đề như học viên</a><a class="btn" href="#/quan-tri/de/${r.id}">Sửa đề</a>${['teacher', 'admin'].includes(S.user.role) ? '<a class="btn" href="#/quan-tri/lop">Giao cho lớp</a>' : ''}<a class="btn ghost" href="#/quan-tri/tai-de">Tải đề khác</a></div></div>`;
      scrollTo(0, 0); toast('Đã tạo đề.');
    } catch (er) { toast(er.message, true); const m = er.data?.missing?.[0]; if (m) { const el = $(`#pha [data-no="${m}"], #pha [data-an="${m}"]`); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
    finally { busy = false; const bb = $('#phgo'); if (bb) bb.disabled = false; }
  };
}
