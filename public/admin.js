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
    ? [['', 'Tổng quan'], ['cau-hoi', 'Ngân hàng câu hỏi'], ['nhap', 'Tải đề lên (Excel/CSV)'], ['de', 'Đề thi'], ['cham-bai', 'Chấm tự luận'], ['bao-loi', 'Báo lỗi'], ['media', 'Kho audio/ảnh']]
    : [['', 'Tổng quan'], ['cau-hoi', 'Ngân hàng câu hỏi'], ['nhap', 'Nhập hàng loạt'], ['de', 'Đề thi'], ['cham-bai', 'Chấm tự luận'], ['bai-hoc', 'Bài đời sống'], ['ngu-phap', 'Ngữ pháp'], ['khoa-hoc', 'Khóa học'], ['bao-loi', 'Báo lỗi'], ['binh-luan', 'Bình luận'], ['thong-ke', 'Báo cáo câu hỏi'], ['media', 'Kho audio/ảnh'], ...(can.admin() ? [['nguoi-dung', 'Người dùng']] : [])];
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
    <div class="alert info mt">Quy trình nội dung: <b>Nháp → Chờ duyệt → Đã đăng → Đã gỡ</b>. Biên tập viên soạn và gửi duyệt; người duyệt (hoặc quản trị viên) đăng. Chỉ nội dung đã đăng mới đến tay người học.</div>`);
}, ST);

/* ---- Câu hỏi ---- */
route(/^\/quan-tri\/cau-hoi$/, async () => {
  const q = S.query; const p = new URLSearchParams(q);
  const r = await api('GET', '/admin/questions?' + p);
  const sel = (id, opts, v) => `<select id="${id}" aria-label="${id}"><option value="">Tất cả</option>${opts.map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  adminShell('cau-hoi', `<div class="row between"><h1 style="margin:0">Ngân hàng câu hỏi (${r.total})</h1>${can.edit() ? '<div class="row"><a class="btn" href="#/quan-tri/nhap">⇪ Tải file đề</a><a class="btn" href="#/quan-tri/cau-hoi/moi?kind=essay">＋ Câu tự luận</a><a class="btn primary" href="#/quan-tri/cau-hoi/moi">＋ Câu trắc nghiệm</a></div>' : ''}</div>
  <div class="card flat mt"><div class="field-row">${sel('a-kind', Object.entries(KINDS), q.kind)}${sel('a-st', Object.entries(STATUS), q.status)}${sel('a-lv', ['N5', 'N4', 'N3', 'N2', 'N1'].map((l) => [l, l]), q.level)}${sel('a-sec', Object.entries(SECTIONS), q.section)}<input id="a-q" type="search" placeholder="Tìm nội dung, thẻ, ID…" value="${esc(q.q || '')}"></div>
    <label class="inline mt"><input type="checkbox" id="a-mine" ${q.mine ? 'checked' : ''}> Chỉ câu do tôi tạo</label></div>
  <div class="card tw mt"><table><tr><th>ID</th><th>Câu hỏi</th><th>Loại</th><th>Phần</th><th>Thẻ</th><th>Người tạo</th><th>Trạng thái</th><th></th></tr>${r.items.map((x) => `<tr><td>${x.id}<div class="small muted">v${x.version}</div></td><td class="jp">${esc(plain(x.stem).slice(0, 70))}</td><td>${kindChip(x.kind)}${x.points > 1 ? `<div class="small muted">${x.points} điểm</div>` : ''}</td><td>${chipLevel(x.level)} <div class="small">${esc(SECTIONS[x.section])}</div></td><td class="small">${[...(x.tags.grammar || []), ...(x.tags.kanji || [])].map((t) => `<span class="chip">${esc(t)}</span>`).join(' ')}</td><td class="small">${esc(x.author || '')}</td><td>${stChip(x.status)}</td><td><a class="btn sm" href="#/quan-tri/cau-hoi/${x.id}">Mở</a></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Không có câu hỏi.</td></tr>'}</table></div>
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
      <div><label>Dạng câu</label><input name="qtype" value="${esc(Q.qtype)}" placeholder="VD: Trợ từ" list="qtypes"><datalist id="qtypes">${['Cách đọc Kanji', 'Chọn từ phù hợp', 'Trợ từ', 'Dạng て', 'Hội thoại', 'Đọc hiểu', 'Nghe hội thoại', 'Dịch Việt → Nhật', 'Dịch Nhật → Việt', 'Viết câu', 'Viết đoạn văn', 'Điền từ'].map((t) => `<option>${t}</option>`).join('')}</datalist></div></div>
    <label>Đoạn văn / ngữ cảnh (đọc hiểu, không bắt buộc)</label><textarea name="passage" rows="3">${esc(Q.passage)}</textarea>
    <label>Nội dung câu hỏi</label><textarea name="stem" rows="3" required>${esc(Q.stem)}</textarea>
    <div class="small muted">Furigana: <span class="kbd">{漢字|かんじ}</span> · Gạch chân: <span class="kbd">__chữ__</span></div>
    <div id="blk-mcq"><label>Đáp án (chọn nút tròn ở đáp án đúng)</label>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<div class="row" style="flex-wrap:nowrap;margin-bottom:6px"><input type="radio" name="ans" value="${i}" ${Q.answer === i ? 'checked' : ''} style="width:20px;min-height:0" aria-label="Đáp án ${i + 1} đúng"><input name="o${i}" value="${esc(Q.options[i] || '')}" placeholder="Đáp án ${i + 1}${i >= 4 ? ' (không bắt buộc)' : ''}"></div>`).join('')}</div>
    <div id="blk-essay"><label>Đáp án mẫu / hướng dẫn chấm (người học chỉ thấy sau khi nộp)</label><textarea name="model_answer" rows="4" class="jp">${esc(Q.model_answer || '')}</textarea>
      <label>Đáp án ngắn được chấp nhận (mỗi dòng một đáp án, không bắt buộc)</label><textarea name="accepted" rows="2" class="jp" placeholder="わたしはがくせいです&#10;私は学生です">${esc((Q.accepted || []).join('\n'))}</textarea>
      <div class="small muted">Nếu câu trả lời khớp một dòng ở trên (bỏ qua dấu câu, khoảng trắng, katakana/hiragana), hệ thống tự chấm đủ điểm. Không khớp thì giảng viên chấm tay ở mục “Chấm tự luận”.</div></div>
    <label id="lbl-exp">Giải thích tiếng Việt (nêu vì sao các đáp án khác sai)</label><textarea name="explanation" rows="3">${esc(Q.explanation)}</textarea>
    <div class="field-row"><div><label>Mẫu ngữ pháp (cách nhau dấu phẩy)</label><input name="grammar" value="${esc((Q.tags.grammar || []).join(', '))}"></div><div><label>Kanji</label><input name="kanji" value="${esc((Q.tags.kanji || []).join(', '))}"></div><div><label>Tình huống</label><input name="situation" value="${esc((Q.tags.situation || []).join(', '))}"></div></div>
    <label>Kịch bản bài nghe (mỗi dòng: <span class="kbd">M: lời</span> hoặc <span class="kbd">F: lời</span>) - dùng giọng đọc tổng hợp nếu chưa có file audio</label><textarea name="script" rows="4" class="jp">${esc(scriptTxt)}</textarea>
    <div class="field-row"><div><label>Audio (URL từ kho media)</label><input name="audio_url" value="${esc(Q.audio_url)}" placeholder="/uploads/…"></div><div><label>Hình ảnh (URL)</label><input name="image_url" value="${esc(Q.image_url)}" placeholder="/uploads/…"></div></div>
    <div class="row"><input type="file" id="up" accept=".mp3,.wav,.m4a,.ogg,.png,.jpg,.jpeg,.webp" style="width:auto"><span class="small muted" id="upmsg">Tải audio/ảnh: file trùng sẽ được dùng lại</span></div>
    <div id="qerr" class="alert bad mt" hidden></div>
    <div class="row mt">${editable ? '<button class="primary" id="save">Lưu</button>' : ''}
      ${id && Q.status === 'draft' && editable ? (T ? '<button type="button" class="accent" id="to-pub">Đăng vào ngân hàng</button>' : '<button type="button" id="to-pending">Gửi duyệt</button>') : ''}
      ${id && Q.status === 'pending' && canRev ? '<button type="button" class="accent" id="to-pub">Duyệt & đăng</button><button type="button" id="to-draft">Trả về nháp</button>' : ''}
      ${id && Q.status === 'published' && canRev ? '<button type="button" class="danger" id="to-removed">Gỡ khỏi người học</button>' : ''}
      ${id && Q.status === 'removed' && editable ? `${T ? '<button type="button" class="accent" id="to-pub">Đăng lại</button>' : ''}<button type="button" id="to-draft2">Chuyển về nháp</button>` : ''}
      ${id && (can.admin() || (T && mine)) && Q.status !== 'published' ? '<button type="button" class="danger ghost" id="del">Xóa</button>' : ''}</div>
    ${id && Q.status === 'published' && S.user.role === 'editor' ? '<div class="small muted mt">Lưu thay đổi sẽ tạo phiên bản mới và đưa câu hỏi về “Chờ duyệt”. Kết quả cũ của người học vẫn giữ theo phiên bản họ đã làm.</div>' : ''}
  </form>
  <div><div class="card"><h3>Xem trước (đúng như người học thấy)</h3><div id="pv" class="preview qcard"></div></div>
    ${id ? `<div class="card mt"><h3>Lịch sử phiên bản</h3>${Q.versions.map((v) => `<div class="small">v${v.version} · ${fmtDate(v.at)}</div>`).join('')}</div>` : ''}</div></div>`);
  const f = $('#qf');
  const read = () => {
    const fd = new FormData(f);
    const script = String(fd.get('script') || '').split('\n').map((s) => s.trim()).filter(Boolean).map((s) => { const m = s.match(/^([MFmf])\s*[:：]\s*(.*)$/); return m ? { speaker: m[1].toUpperCase(), text: m[2] } : { speaker: 'M', text: s }; });
    const kind = fd.get('kind') || 'mcq';
    return { kind, points: Number(fd.get('points') || 1), model_answer: fd.get('model_answer'), accepted: String(fd.get('accepted') || '').split('\n').map((x) => x.trim()).filter(Boolean),
      level: fd.get('level'), section: fd.get('section'), qtype: fd.get('qtype'), passage: fd.get('passage'), stem: fd.get('stem'), options: kind === 'essay' ? [] : [0, 1, 2, 3, 4, 5].map((i) => fd.get('o' + i)).filter((o, i, a) => o || a.slice(i + 1).some(Boolean)), answer: Number(fd.get('ans')), explanation: fd.get('explanation'),
      tags: { grammar: fd.get('grammar'), kanji: fd.get('kanji'), situation: fd.get('situation') }, audio_script: script, audio_url: fd.get('audio_url'), image_url: fd.get('image_url') };
  };
  const preview = () => {
    const q = read();
    $('#pv').innerHTML = `<div class="row mb"><span class="chip">${esc(q.level)}</span><span class="chip">${esc(SECTIONS[q.section])}</span></div>
      ${q.audio_script.length || q.audio_url ? `<div class="audio-box"><button type="button" class="ic" id="pv-play">▶</button><div><b>Bài nghe</b></div></div>` : ''}${q.image_url ? `<img src="${esc(q.image_url)}" alt="" style="max-width:100%">` : ''}
      ${q.passage ? `<div class="passage">${rich(q.passage)}</div>` : ''}<p class="stem">${rich(q.stem)}</p>
      ${q.kind === 'essay' ? `<textarea rows="4" disabled placeholder="Người học viết câu trả lời ở đây…"></textarea><div class="small muted">${q.points} điểm</div>${q.model_answer ? `<div class="explain"><b>Đáp án mẫu:</b><div class="jp">${rich(q.model_answer)}</div></div>` : ''}`
        : `<div class="opts">${q.options.map((o, i) => `<div class="opt ${i === q.answer ? 'right' : ''}"><span class="n">${i + 1}</span><span>${rich(o)}</span></div>`).join('')}</div>`}${q.explanation ? `<div class="explain">${rich(q.explanation)}</div>` : ''}`;
    const pp = $('#pv-play'); if (pp) pp.onclick = () => q.audio_url ? playUrl(q.audio_url) : speak(q.audio_script);
  };
  const toggleKind = () => { const es = (new FormData(f).get('kind') || 'mcq') === 'essay'; $('#blk-mcq').hidden = es; $('#blk-essay').hidden = !es;
    $('#lbl-exp').textContent = es ? 'Giải thích / ghi chú thêm (không bắt buộc)' : 'Giải thích tiếng Việt (nêu vì sao các đáp án khác sai)'; };
  f.oninput = preview; f.onchange = () => { toggleKind(); preview(); }; toggleKind(); preview();
  if (!editable) $$('#qf input, #qf textarea, #qf select').forEach((el) => { el.disabled = true; });
  $('#up').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const r = await api('POST', '/admin/media', { 'content-type': 'application/octet-stream', 'x-filename': encodeURIComponent(file.name) }, file);
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
  adminShell('de', `<div class="row between"><h1 style="margin:0">Đề thi</h1>${can.edit() ? '<a class="btn primary" href="#/quan-tri/de/moi">＋ Tạo đề</a>' : ''}</div>
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
    return { title: f.elements.title.value, exam_type: f.elements.exam_type.value, level: f.elements.level.value, duration_min: Number(f.elements.duration_min.value), description: f.elements.description.value, scoring,
      sections: Object.keys(SECTIONS).filter((k) => chosen[k]?.size).map((k) => ({ key: k, name: SECTIONS[k], question_ids: [...chosen[k]] })) };
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
  adminShell('nguoi-dung', `<h1>Người dùng (${list.length})</h1><form class="row mb" id="uf"><input name="q" type="search" placeholder="Tìm email / tên" value="${esc(q)}" style="max-width:320px"><button>Tìm</button></form>
  <div class="card tw"><table><tr><th>Người dùng</th><th>Vai trò</th><th>Gói</th><th>Trạng thái</th></tr>${list.map((u) => `<tr><td>${esc(u.name)}<div class="small muted">${esc(u.email)}</div></td>
    <td><select data-role="${u.id}" ${u.id === S.user.id ? 'disabled' : ''}>${Object.entries(ROLE).map(([k, t]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
    <td><select data-plan="${u.id}"><option value="free" ${u.plan === 'free' ? 'selected' : ''}>Miễn phí</option><option value="pro" ${u.plan === 'pro' ? 'selected' : ''}>Trả phí</option></select></td>
    <td>${u.id === S.user.id ? '(bạn)' : `<button class="sm ${u.locked ? 'accent' : 'danger'}" data-lock="${u.id}" data-v="${u.locked ? 0 : 1}">${u.locked ? 'Mở khóa' : 'Khóa'}</button>`}</td></tr>`).join('')}</table></div>`);
  $('#uf').onsubmit = (e) => { e.preventDefault(); nav('/quan-tri/nguoi-dung?q=' + encodeURIComponent(e.target.q.value)); };
  const patch = (id, b) => api('PATCH', `/admin/users/${id}`, b).then(() => toast('Đã cập nhật.')).catch((e) => toast(e.message, true));
  $$('[data-role]').forEach((s) => s.onchange = () => patch(s.dataset.role, { role: s.value })); $$('[data-plan]').forEach((s) => s.onchange = () => patch(s.dataset.plan, { plan: s.value }));
  $$('[data-lock]').forEach((b) => b.onclick = async () => { await patch(b.dataset.lock, { locked: b.dataset.v === '1' }); render(); });
}, ST);

/* ---- Kho audio/ảnh (AD-09) ---- */
route(/^\/quan-tri\/media$/, async () => {
  const list = await api('GET', '/admin/media');
  adminShell('media', `<h1>Kho audio & hình ảnh</h1>${can.edit() ? '<input type="file" id="mu" accept=".mp3,.wav,.m4a,.ogg,.png,.jpg,.jpeg,.webp" multiple>' : ''}<div class="small muted mt">Tải lên một lần, dùng cho nhiều đề. File trùng nội dung được nhận diện tự động.</div>
  <div class="card tw mt"><table><tr><th>File</th><th>Xem</th><th>URL (dán vào câu hỏi)</th></tr>${list.map((m) => `<tr><td>${esc(m.filename)}<div class="small muted">${Math.round(m.size / 1024)} KB · ${fmtDate(m.created_at)}</div></td><td>${/^audio/.test(m.mime) ? `<audio controls preload="none" src="${esc(m.url)}" style="max-width:240px"></audio>` : `<img src="${esc(m.url)}" alt="" style="max-height:50px">`}</td><td><span class="kbd">${esc(m.url)}</span></td></tr>`).join('') || '<tr><td colspan="3" class="empty">Chưa có file.</td></tr>'}</table></div>`);
  const mu = $('#mu'); if (mu) mu.onchange = async () => {
    for (const f of mu.files) { try { const r = await api('POST', '/admin/media', { 'content-type': 'application/octet-stream', 'x-filename': encodeURIComponent(f.name) }, f); toast(r.reused ? `${f.name}: đã có sẵn, dùng lại.` : `Đã tải ${f.name}.`); } catch (e) { toast(`${f.name}: ${e.message}`, true); } }
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
