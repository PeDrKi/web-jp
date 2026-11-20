/* Web luyện đề tiếng Nhật - giao diện người học (vanilla JS, không cần build) */
'use strict';
const S = { user: null, route: null, timers: [], cleanup: [] };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SECTIONS = { vocab: 'Văn tự - từ vựng', conversation: 'Hội thoại và biểu hiện', grammar: 'Ngữ pháp', reading: 'Đọc hiểu', listening: 'Nghe hiểu', writing: 'Viết / Tự luận' };
const STATUS = { draft: 'Nháp', pending: 'Chờ duyệt', published: 'Đã đăng', removed: 'Đã gỡ' };
const REPORT_TYPES = { 'dap-an': 'Đáp án sai', 'de-bai': 'Đề bài sai/khó hiểu', audio: 'Lỗi audio', 'giai-thich': 'Giải thích chưa đúng', khac: 'Khác' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Định dạng nội dung: {漢字|かんじ} → furigana, __chữ__ → gạch chân (đã escape trước nên an toàn)
const rich = (s) => esc(s).replace(/\{([^|}]+)\|([^}]*)\}/g, '<ruby>$1<rt>$2</rt></ruby>').replace(/__(.+?)__/g, '<u>$1</u>').replace(/\n/g, '<br>');
const plain = (s) => String(s ?? '').replace(/\{([^|}]+)\|[^}]*\}/g, '$1').replace(/__/g, '');
const fmtDate = (t) => t ? new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const fmtDur = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

async function api(method, url, body, raw) {
  const o = { method, headers: {}, credentials: 'same-origin' };
  if (raw !== undefined) { o.body = raw; Object.assign(o.headers, body || {}); }
  else if (body !== undefined) { o.body = JSON.stringify(body); o.headers['content-type'] = 'application/json'; }
  const r = await fetch('/api' + url, o);
  let d = null; try { d = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(d?.error || 'Có lỗi xảy ra.'); e.status = r.status; e.data = d; throw e; }
  return d;
}
function toast(msg, bad) {
  const t = $('#toast'); const d = document.createElement('div'); d.textContent = msg; if (bad) d.className = 'bad';
  t.appendChild(d); setTimeout(() => d.remove(), bad ? 5000 : 3000);
}
function modal(html, onMount) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-bg" role="dialog" aria-modal="true"><div class="modal">${html}</div></div>`;
  const close = () => { root.innerHTML = ''; };
  root.firstChild.addEventListener('mousedown', (e) => { if (e.target === root.firstChild) close(); });
  onMount && onMount(root.querySelector('.modal'), close);
  return close;
}
const confirmBox = (msg) => new Promise((res) => {
  modal(`<p>${esc(msg)}</p><div class="row" style="justify-content:flex-end"><button id="c-no">Hủy</button><button id="c-ok" class="primary">Đồng ý</button></div>`, (m, close) => {
    $('#c-no', m).onclick = () => { close(); res(false); }; $('#c-ok', m).onclick = () => { close(); res(true); };
  });
});

/* ---------- Cài đặt hiển thị (FR-09): nhớ cho lần sau ---------- */
function applySettings() {
  let s = {}; try { s = JSON.parse(localStorage.getItem('settings') || '{}'); } catch {}
  if (S.user?.settings) s = { ...s, ...S.user.settings };
  document.body.classList.toggle('no-furi', s.furigana === false);
  document.body.classList.toggle('no-vi', s.translation === false);
  document.documentElement.style.setProperty('--fs', ({ s: '15px', m: '17px', l: '20px', xl: '23px' })[s.fontSize || 'm']);
  S.settings = s;
}
async function setSetting(k, v) {
  const s = { ...(S.settings || {}), [k]: v };
  try { localStorage.setItem('settings', JSON.stringify(s)); } catch {}
  if (S.user) { try { S.user = await api('PATCH', '/me', { settings: { [k]: v } }); } catch {} }
  applySettings();
}

/* ---------- Phát âm / audio (FR-08) ---------- */
let voices = [];
const loadVoices = () => { voices = (window.speechSynthesis?.getVoices() || []).filter((v) => /^ja/i.test(v.lang)); };
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
const hasTTS = () => 'speechSynthesis' in window;
let ttsToken = 0;
function speak(lines, { rate = 1, onend } = {}) {
  stopAudio();
  const my = ++ttsToken;
  if (!hasTTS()) { toast('Trình duyệt này chưa hỗ trợ đọc tiếng Nhật.', true); onend && onend(); return; }
  const list = lines.map((l) => ({ ...l, text: plain(l.text).replace(/[「」]/g, '') }));
  const female = voices.find((v) => /female|kyoko|nanami|haruka|ayumi|o-ren|google/i.test(v.name)) || voices[0];
  const male = voices.find((v) => /male|ichiro|keita|otoya|takumi/i.test(v.name) && v !== female) || voices.find((v) => v !== female) || voices[0];
  const next = (i) => {
    if (my !== ttsToken) return;
    if (i >= list.length) { onend && onend(); return; }
    const u = new SpeechSynthesisUtterance(list[i].text);
    u.lang = 'ja-JP'; u.rate = rate;
    const v = list[i].speaker === 'F' ? female : male; if (v) u.voice = v;
    u.pitch = list[i].speaker === 'F' ? 1.15 : 0.85;
    u.onend = () => setTimeout(() => next(i + 1), 450); u.onerror = () => next(i + 1);
    speechSynthesis.speak(u);
  };
  next(0);
}
let curAudio = null;
function stopAudio() { ttsToken++; try { speechSynthesis.cancel(); } catch {} if (curAudio) { curAudio.pause(); curAudio = null; } }
function playUrl(url, { rate = 1, onend } = {}) { stopAudio(); curAudio = new Audio(url); curAudio.playbackRate = rate; curAudio.onended = onend; curAudio.play().catch(() => toast('Không phát được audio.', true)); }

/* ---------- Router ---------- */
const ROUTES = [];
const route = (re, fn, opts = {}) => ROUTES.push({ re, fn, opts });
function nav(h) { location.hash = h; }
async function render() {
  S.cleanup.forEach((f) => { try { f(); } catch {} }); S.cleanup = [];
  stopAudio();
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?'); S.query = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (m) {
      if (r.opts.auth && !S.user) { nav('/dang-nhap?next=' + encodeURIComponent(h)); return; }
      if (r.opts.staff && !(S.user && ['admin', 'editor', 'reviewer', 'teacher'].includes(S.user.role))) { toast('Bạn không có quyền vào khu vực này.', true); nav('/'); return; }
      shell(path, r.opts);
      try { await r.fn(...m.slice(1)); } catch (e) { if (e.status === 401) { S.user = null; nav('/dang-nhap'); return; } $('#view').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
      window.scrollTo(0, 0);
      return;
    }
  }
  shell(path, {}); $('#view').innerHTML = `<div class="empty"><h2>Không tìm thấy trang</h2><a class="btn" href="#/">Về trang chủ</a></div>`;
}
function shell(path, opts) {
  const links = [['/', 'Trang chủ'], ['/de', 'Kho đề'], ['/luyen', 'Luyện tập'], ['/khoa-hoc', 'Khóa học'], ['/ngu-phap', 'Ngữ pháp'], ['/doi-song', 'Đời sống'], ['/chep-chinh-ta', 'Chép chính tả'], ['/the', 'Flashcard'], ['/thong-ke', 'Thống kê']];
  const isStaff = S.user && ['admin', 'editor', 'reviewer', 'teacher'].includes(S.user.role);
  const focus = opts.focus;   // làm bài: giao diện gọn
  const on = (p) => (p === '/' ? path === '/' : path.startsWith(p));
  $('#app').innerHTML = `
  <header class="top"><div class="top-in">
    <a class="brand" href="#/"><i></i><span>Luyện đề tiếng Nhật</span></a>
    ${focus ? '' : `<nav class="main" aria-label="Điều hướng chính">${links.map(([p, t]) => `<a href="#${p}" class="${on(p) ? 'on' : ''}">${t}</a>`).join('')}${isStaff ? `<a href="#/quan-tri" class="${path.startsWith('/quan-tri') ? 'on' : ''}">Quản trị</a>` : ''}</nav>`}
    <div class="top-r">
      ${focus ? '' : `<form id="sf" class="row" style="gap:4px"><input id="sq" type="search" placeholder="Tìm đề, bài học…" aria-label="Tìm kiếm" style="width:150px;min-height:36px;padding:5px 10px"></form>`}
      ${S.user ? `<a class="btn sm ghost" href="#/cai-dat" title="Cài đặt">${esc(S.user.name.split(' (')[0].slice(0, 14))}</a>` : `<a class="btn sm primary" href="#/dang-nhap">Đăng nhập</a>`}
    </div></div></header>
  <main id="view"><div class="empty">Đang tải…</div></main>`;
  const cur = $('nav.main a.on'); if (cur && cur.parentElement.scrollWidth > cur.parentElement.clientWidth) cur.parentElement.scrollLeft = cur.offsetLeft - 40;   // điện thoại: cuộn tới mục đang mở
  const sf = $('#sf'); if (sf) sf.onsubmit = (e) => { e.preventDefault(); const q = $('#sq').value.trim(); if (q) nav('/tim?q=' + encodeURIComponent(q)); };
}
const view = (html) => { $('#view').innerHTML = html; };
const needLogin = () => view(`<div class="card center"><h2>Bạn cần đăng nhập</h2><p class="muted">Đăng nhập để lưu bài làm, theo dõi tiến bộ và ôn tập.</p><a class="btn primary" href="#/dang-nhap">Đăng nhập</a></div>`);
const chipLevel = (l) => `<span class="chip">${esc(l)}</span>`;

/* ---------- Trang chủ (FR-02, FR-22) ---------- */
route(/^\/$/, async () => {
  if (!S.user) {
    const exams = await api('GET', '/exams');
    view(`<section class="hero"><div>
      <span class="chip verm">JLPT · JFT-Basic · Tiếng Nhật đời sống</span>
      <h1 class="mt">Luyện đề như thi thật,<br>học tiếng Nhật dùng được ngay</h1>
      <p class="muted" style="font-size:1.08rem">Làm đề có đồng hồ, chấm điểm tự động, giải thích bằng tiếng Việt. Học thêm tình huống thật: siêu thị, bệnh viện, ngân hàng, công ty, thủ tục hành chính.</p>
      <div class="row mt"><a class="btn accent" href="#/dang-ky">Bắt đầu miễn phí</a><a class="btn" href="#/de">Xem kho đề</a></div></div>
      <div class="sun" aria-hidden="true"><b>日本語</b></div></section>
      <div class="grid g3">
        <div class="card flat"><h3>Thi cử</h3><p class="muted">Đề mô phỏng N5-N3 có đồng hồ, phần nghe một lần như thi thật, thống kê điểm yếu theo dạng câu và mẫu ngữ pháp.</p></div>
        <div class="card flat"><h3>Đời sống</h3><p class="muted">Hội thoại có audio, từ vựng, câu mẫu và mức lịch sự: thể thông thường, lịch sự, kính ngữ.</p></div>
        <div class="card flat"><h3>Liên kết hai nhánh</h3><p class="muted">Mẫu ngữ pháp trong đề được gắn với tình huống ngoài đời và ngược lại.</p></div></div>
      <h2 class="mt2">Đề mới</h2><div class="grid g2">${exams.map(examCard).join('')}</div>`);
    return;
  }
  const d = await api('GET', '/dashboard');
  const g = d.goal;
  const goalTxt = !g.type ? '' : `${g.type === 'exam' ? 'Thi' : g.type === 'life' ? 'Đời sống' : 'Thi + Đời sống'} ${g.level || ''}${d.daysLeft != null ? ` · còn ${d.daysLeft} ngày` : ''}`;
  view(`
  <div class="row between"><div><h1>Chào ${esc(S.user.name)}</h1><div class="muted">${goalTxt ? `Mục tiêu: <b>${esc(goalTxt)}</b> · <a href="#/cai-dat">đổi</a>` : `<a href="#/cai-dat">Đặt mục tiêu</a> để nhận gợi ý phù hợp`}</div></div>
    <div class="row"><div class="card flat center" style="padding:10px 18px"><div class="stat">${d.streak}</div><div class="small muted">ngày liên tiếp</div></div>
    <div class="card flat center" style="padding:10px 18px"><div class="stat">${d.dueCards}</div><div class="small muted">thẻ cần ôn</div></div></div></div>
  ${d.notifications.length ? `<div class="alert info mt">${d.notifications.map((n) => `<div><a href="${esc(n.link || '#/')}">${esc(n.text)}</a></div>`).join('')}<button class="sm mt" id="nread">Đã đọc</button></div>` : ''}
  ${d.inProgress.length ? `<h2 class="mt2">Bài đang làm dở</h2><div class="grid g2">${d.inProgress.map((a) => `<a class="card" href="#/lam/${a.id}"><div class="row between"><b>${esc(a.title)}</b><span class="chip warn">Làm tiếp</span></div><div class="small muted">Bắt đầu ${fmtDate(a.started_at)}</div></a>`).join('')}</div>` : ''}
  <h2 class="mt2">Kế hoạch hôm nay ${d.doneToday ? '<span class="chip ok">Đã học hôm nay</span>' : ''}</h2>
  <div class="grid g2">${d.plan.length ? d.plan.map(planCard).join('') : '<div class="card flat muted">Hãy chọn một đề hoặc một bài tình huống để bắt đầu.</div>'}</div>
  <div class="row mt2"><a class="btn primary" href="#/de">Kho đề</a><a class="btn" href="#/doi-song">Bài tình huống</a><a class="btn" href="#/luyen">Luyện theo dạng câu</a><a class="btn" href="#/lich-su">Lịch sử làm bài</a></div>`);
  const nr = $('#nread'); if (nr) nr.onclick = async () => { await api('POST', '/notifications/read'); render(); };
});
function planCard(p) {
  const href = p.type === 'course' ? p.link : p.type === 'exam' ? `#/de/${p.id}` : p.type === 'lesson' ? `#/doi-song/${p.id}` : p.type === 'cards' ? '#/the'
    : p.type === 'practice' ? `#/luyen?level=${p.level || ''}&section=${p.section}` : p.type === 'grammar' ? `#/luyen?grammar=${encodeURIComponent(p.tag)}` : '#/thong-ke';
  const label = { course: 'Khóa học', exam: 'Đề thi', lesson: 'Đời sống', cards: 'Ôn tập', practice: 'Điểm yếu', grammar: 'Ngữ pháp' }[p.type];
  return `<a class="card" href="${href}"><span class="chip ${p.type === 'lesson' ? 'verm' : ''}">${label}</span><div class="mt"><b>${esc(p.text)}</b></div></a>`;
}

/* ---------- Kho đề (FR-03, FR-04) ---------- */
const examCard = (e) => `<a class="card" href="#/de/${e.id}"><div class="row between"><span class="chip">${esc(e.exam_type === 'CUSTOM' ? 'Đề giảng viên' : e.exam_type)} ${esc(e.level)}</span><span class="small muted">${e.duration_min} phút · ${e.question_count} câu</span></div>
  <h3 class="mt">${esc(e.title)}</h3><div class="row">${e.sections.map((s) => `<span class="chip ${s.key === 'listening' ? 'verm' : ''}">${esc(SECTIONS[s.key] || s.name)} (${s.count})</span>`).join('')}</div></a>`;
route(/^\/de$/, async () => {
  const q = S.query;
  view(`<h1>Kho đề</h1>
  <div class="card flat"><div class="field-row">
    <div><label for="f-type">Kỳ thi</label><select id="f-type"><option value="">Tất cả</option><option value="JLPT">JLPT</option><option value="JFT">JFT-Basic</option><option value="NAT">NAT-TEST</option><option value="CUSTOM">Đề của giảng viên</option></select></div>
    <div><label for="f-lv">Cấp độ</label><select id="f-lv"><option value="">Tất cả</option>${['N5', 'N4', 'N3', 'N2', 'N1'].map((l) => `<option>${l}</option>`).join('')}</select></div>
    <div><label for="f-sec">Phần thi</label><select id="f-sec"><option value="">Tất cả</option>${Object.entries(SECTIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    <div><label for="f-q">Từ khóa</label><input id="f-q" type="search" placeholder="Tên đề…"></div></div></div>
  <div id="exam-list" class="grid g2 mt"></div>`);
  const load = async () => {
    const p = new URLSearchParams(); for (const [k, id] of [['exam_type', 'f-type'], ['level', 'f-lv'], ['section', 'f-sec'], ['q', 'f-q']]) if ($('#' + id).value) p.set(k, $('#' + id).value);
    const list = await api('GET', '/exams?' + p);
    $('#exam-list').innerHTML = list.length ? list.map(examCard).join('') : '<div class="empty" style="grid-column:1/-1">Chưa có đề phù hợp. JFT-Basic, N2, N1 và NAT-TEST sẽ có ở các giai đoạn sau.</div>';
  };
  $$('#f-type,#f-lv,#f-sec').forEach((el) => el.onchange = load); $('#f-q').oninput = load;
  if (q.level) $('#f-lv').value = q.level; load();
});
route(/^\/de\/(\d+)$/, async (id) => {
  const list = await api('GET', '/exams'); const e = list.find((x) => x.id === Number(id));
  if (!e) return view('<div class="empty">Không tìm thấy đề.</div>');
  view(`<a href="#/de" class="small">← Kho đề</a><h1 class="mt">${esc(e.title)}</h1>
  <p class="muted">${esc(e.description)}</p>
  <div class="card"><div class="row between"><div><b>${e.question_count} câu · ${e.duration_min} phút</b></div><span class="chip">${esc(e.exam_type)} ${esc(e.level)}</span></div>
    <table class="mt"><tr><th>Phần thi</th><th>Số câu</th><th></th></tr>${e.sections.map((s) => `<tr><td>${esc(SECTIONS[s.key] || s.name)}</td><td>${s.count}</td><td><button class="sm" data-sec="${s.key}">Luyện riêng phần này</button></td></tr>`).join('')}</table></div>
  <div class="grid g2 mt">
    <div class="card"><h3>Thi thật</h3><p class="muted small">Có đồng hồ đếm ngược. Hết giờ tự nộp. Phần nghe chỉ nghe một lần, không xem đáp án trước khi nộp. Rời tab sẽ bị cảnh báo.</p><button class="accent" id="go-real">Bắt đầu thi</button></div>
    <div class="card"><h3>Luyện tập</h3><p class="muted small">Không giới hạn thời gian. Xem đáp án và giải thích từng câu ngay khi làm. Nghe lại thoải mái.</p><button class="primary" id="go-prac">Bắt đầu luyện</button></div></div>`);
  const start = async (body) => { if (!S.user) return nav('/dang-nhap?next=' + encodeURIComponent(location.hash.slice(1))); try { const a = await api('POST', '/attempts', body); nav('/lam/' + a.id); } catch (er) { toast(er.message, true); } };
  $('#go-real').onclick = () => start({ exam_id: e.id, mode: 'real' });
  $('#go-prac').onclick = () => start({ exam_id: e.id, mode: 'practice' });
  $$('[data-sec]').forEach((b) => b.onclick = () => start({ exam_id: e.id, mode: 'practice', sections: [b.dataset.sec] }));
});

/* ---------- Luyện tập theo phần / dạng câu (FR-06) ---------- */
route(/^\/luyen$/, async () => {
  const opts = await api('GET', '/practice/options');
  const q = S.query;
  const levels = [...new Set(opts.map((o) => o.level))].sort().reverse();
  view(`<h1>Luyện tập theo dạng câu</h1><p class="muted">Chọn phần và dạng câu bạn hay sai. Không giới hạn thời gian, xem đáp án ngay khi làm.</p>
  ${q.grammar ? `<div class="alert info mb">Mẫu ngữ pháp: <b>${esc(q.grammar)}</b></div>` : ''}
  <div class="card"><div class="field-row">
    <div><label for="p-lv">Cấp độ</label><select id="p-lv"><option value="">Tất cả</option>${levels.map((l) => `<option>${l}</option>`).join('')}</select></div>
    <div><label for="p-sec">Phần thi</label><select id="p-sec"><option value="">Tất cả</option>${Object.entries(SECTIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    <div><label for="p-qt">Dạng câu</label><select id="p-qt"></select></div>
    <div><label for="p-n">Số câu</label><select id="p-n">${[5, 10, 15, 20].map((n) => `<option ${n === 10 ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="row mt"><button class="primary" id="p-go">Bắt đầu</button><span class="muted small" id="p-info"></span></div></div>`);
  const refresh = () => {
    const lv = $('#p-lv').value, sec = $('#p-sec').value;
    const m = opts.filter((o) => (!lv || o.level === lv) && (!sec || o.section === sec));
    const types = [...new Set(m.map((o) => o.qtype).filter(Boolean))];
    const cur = $('#p-qt').value;
    $('#p-qt').innerHTML = '<option value="">Tất cả</option>' + types.map((t) => `<option ${t === cur ? 'selected' : ''}>${esc(t)}</option>`).join('');
    $('#p-info').textContent = `${m.reduce((a, o) => a + o.n, 0)} câu có sẵn`;
  };
  $('#p-lv').onchange = $('#p-sec').onchange = refresh;
  if (q.level) $('#p-lv').value = q.level; if (q.section) $('#p-sec').value = q.section; refresh();
  $('#p-go').onclick = async () => {
    if (!S.user) return nav('/dang-nhap?next=' + encodeURIComponent(location.hash.slice(1)));
    try { const a = await api('POST', '/attempts', { practice: { level: $('#p-lv').value, section: $('#p-sec').value, qtype: $('#p-qt').value, count: Number($('#p-n').value), grammar: q.grammar || '' } }); nav('/lam/' + a.id); } catch (e) { toast(e.message, true); }
  };
});

/* ---------- Làm bài (FR-05..FR-10) ---------- */
route(/^\/lam\/(\d+)$/, async (id) => {
  let A = await api('GET', `/attempts/${id}`);
  if (A.status === 'submitted') return nav('/ketqua/' + id);
  const key = 'att' + id;
  let local = {}; try { local = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
  const ans = { ...A.answers };
  const pending = {};   // thay đổi chưa gửi được (mất mạng)
  for (const [qid, v] of Object.entries(local.pending || {})) { ans[qid] = { ...(ans[qid] || {}), ...v }; pending[qid] = v; }
  const qs = A.questions; const real = A.mode === 'real';
  const offset = A.server_now - Date.now();
  let cur = Math.min(local.cur || 0, qs.length - 1), leaves = A.leaves || 0, checked = {}, plays = { ...A.plays }, submitting = false, audioState = {};
  const saveLocal = () => { try { localStorage.setItem(key, JSON.stringify({ pending, cur })); } catch {} };
  const ind = () => $('#save-ind');
  const setInd = (t, err) => { const e = ind(); if (e) { e.textContent = t; e.className = 'save-ind' + (err ? ' err' : ''); } };
  async function flush() {
    if (!Object.keys(pending).length && !flush.leaves) return true;
    const batch = { ...pending };
    try { await api('PUT', `/attempts/${id}/answers`, { answers: batch, leaves }); for (const k of Object.keys(batch)) if (JSON.stringify(pending[k]) === JSON.stringify(batch[k])) delete pending[k]; flush.leaves = false; saveLocal(); setInd('Đã lưu ✓'); return true; }
    catch (e) { if (e.status === 409) { setInd('Đã hết giờ', true); return false; } setInd('Chưa lưu được - sẽ thử lại khi có mạng', true); return false; }
  }
  const change = (qid, patch) => { ans[qid] = { ...(ans[qid] || {}), ...patch }; pending[qid] = { ...(pending[qid] || {}), ...patch }; saveLocal(); setInd('Đang lưu…'); flush(); };
  const retry = setInterval(flush, 8000); S.cleanup.push(() => clearInterval(retry));
  window.addEventListener('online', flush); S.cleanup.push(() => window.removeEventListener('online', flush));

  const onVis = () => { if (document.hidden && real) { leaves++; flush.leaves = true; flush(); toast('Cảnh báo: bạn vừa rời khỏi tab thi (lần ' + leaves + ').', true); } };
  document.addEventListener('visibilitychange', onVis); S.cleanup.push(() => document.removeEventListener('visibilitychange', onVis));

  const secOf = (i) => A.sections.find((s) => i >= s.from && i < s.from + s.count);
  const isDone = (x) => ans[x.id]?.c != null || !!String(ans[x.id]?.t || '').trim();
  let essayTimer = null;
  const typeEssay = (qid, t) => { ans[qid] = { ...(ans[qid] || {}), t }; pending[qid] = { ...(pending[qid] || {}), t }; saveLocal(); setInd('Đang lưu…'); clearTimeout(essayTimer); essayTimer = setTimeout(flush, 800); };
  function draw() {
    const q = qs[cur]; const a = ans[q.id] || {};
    const done = qs.filter(isDone).length;
    const essay = q.kind === 'essay';
    const sec = secOf(cur); const ck = checked[q.id];
    const prevQ = qs[cur - 1]; const showPassage = q.passage && !(prevQ && prevQ.passage === q.passage) ? true : q.passage;
    view(`
    <div class="exam-bar">
      <div style="flex:1;min-width:150px"><b>${esc(A.title)}</b><div class="small muted">${real ? 'Chế độ thi thật' : 'Chế độ luyện tập'} · <span id="save-ind" class="save-ind"></span></div></div>
      ${A.deadline ? `<div class="timer" id="timer" aria-live="off">--:--</div>` : ''}
      <div class="small muted">${done}/${qs.length} câu</div>
      <button class="sm" id="t-furi">ふりがな ${S.settings.furigana === false ? 'tắt' : 'bật'}</button>
      <select id="t-fs" aria-label="Cỡ chữ" style="width:auto;min-height:34px;padding:4px 8px">${[['s', 'Chữ nhỏ'], ['m', 'Chữ vừa'], ['l', 'Chữ lớn'], ['xl', 'Chữ rất lớn']].map(([v, t]) => `<option value="${v}" ${(S.settings.fontSize || 'm') === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <button class="accent sm" id="t-submit">Nộp bài</button>
    </div>
    <div class="qwrap"><div>
      <div class="card qcard">
        <div class="row between mb"><span class="chip">Câu ${cur + 1}/${qs.length}</span><span class="chip ${q.section === 'listening' ? 'verm' : ''}">${esc(SECTIONS[q.section] || q.section)}${q.qtype ? ' · ' + esc(q.qtype) : ''}</span>
          <button class="sm ${a.flag ? 'accent' : ''}" id="t-flag" aria-pressed="${!!a.flag}">${a.flag ? '⚑ Đã đánh dấu' : '⚐ Đánh dấu xem lại'}</button></div>
        ${q.has_audio ? audioBox(q) : ''}
        ${q.image_url ? `<img src="${esc(q.image_url)}" alt="Hình minh họa của đề" style="max-width:100%;border-radius:10px;margin-bottom:12px">` : ''}
        ${showPassage ? `<div class="passage">${rich(q.passage)}</div>` : ''}
        <p class="stem">${rich(q.stem)}</p>
        ${essay ? `<label for="t-essay" class="small muted">Câu trả lời của bạn (tự luận · ${q.points} điểm)</label><textarea id="t-essay" class="jp" rows="7" maxlength="5000" placeholder="Gõ câu trả lời bằng tiếng Nhật (hoặc theo yêu cầu đề)…" ${ck ? 'disabled' : ''}>${esc(a.t || '')}</textarea>
          <div class="small muted"><span id="t-count">${(a.t || '').length}</span>/5000 ký tự · tự động lưu</div>` : ''}
        <div class="opts" role="radiogroup" aria-label="Đáp án" ${essay ? 'hidden' : ''}>${q.options.map((o, i) => {
          let c = a.c === i ? 'sel' : '';
          if (ck) { if (i === ck.answer) c = 'right'; else if (a.c === i) c = 'wrong'; }
          return `<button class="opt ${c}" role="radio" aria-checked="${a.c === i}" data-i="${i}" ${ck ? 'disabled' : ''}><span class="n">${i + 1}</span><span>${rich(o)}</span></button>`;
        }).join('')}</div>
        ${ck && ck.kind === 'essay' ? `<div class="explain"><b>${ck.auto_ok === true ? '✓ Khớp đáp án!' : ck.auto_ok === false ? 'Chưa khớp đáp án ngắn, hãy so với đáp án mẫu.' : 'Tự so sánh với đáp án mẫu'}</b>${ck.model_answer ? `<div class="mt"><b>Đáp án mẫu:</b><div class="jp" style="white-space:pre-wrap">${rich(ck.model_answer)}</div></div>` : ''}${ck.explanation ? `<div class="mt">${rich(ck.explanation)}</div>` : ''}<div class="small muted mt">Giảng viên sẽ chấm điểm chính thức sau khi bạn nộp bài.</div></div>` : ''}
        ${ck && ck.kind !== 'essay' ? `<div class="explain"><b>${a.c === ck.answer ? '✓ Chính xác!' : '✗ Chưa đúng. Đáp án đúng là ' + (ck.answer + 1)}</b><div class="mt">${rich(ck.explanation)}</div>${ck.audio_script?.length ? `<details class="mt"><summary>Xem văn bản bài nghe</summary>${ck.audio_script.map((l) => `<div class="jp">${l.speaker === 'F' ? '女' : '男'}：${rich(l.text)}</div>`).join('')}</details>` : ''}</div>` : ''}
        <div class="row between mt">
          <button id="t-prev" ${cur === 0 ? 'disabled' : ''}>← Câu trước</button>
          ${!real && !ck ? `<button id="t-check" class="primary" ${!isDone(q) ? 'disabled' : ''}>${essay ? 'Xem đáp án mẫu' : 'Kiểm tra đáp án'}</button>` : ''}
          <button id="t-next" class="${cur === qs.length - 1 ? '' : 'primary'}" ${cur === qs.length - 1 ? 'disabled' : ''}>Câu sau →</button></div>
      </div></div>
      <aside class="card" aria-label="Bảng câu hỏi"><h3>Bảng câu hỏi</h3>
        ${A.sections.map((s) => `<div class="small muted mt">${esc(SECTIONS[s.key] || s.name)}</div><div class="palette">${qs.slice(s.from, s.from + s.count).map((x, k) => { const i = s.from + k; const st = ans[x.id]; return `<button class="pal ${isDone(x) ? 'done' : ''} ${st?.flag ? 'flag' : ''} ${i === cur ? 'cur' : ''}" data-go="${i}" aria-label="Câu ${i + 1}">${i + 1}</button>`; }).join('')}</div>`).join('') || `<div class="palette mt">${qs.map((x, i) => `<button class="pal ${isDone(x) ? 'done' : ''} ${ans[x.id]?.flag ? 'flag' : ''} ${i === cur ? 'cur' : ''}" data-go="${i}">${i + 1}</button>`).join('')}</div>`}
        <div class="small muted mt"><span class="chip">Đã làm</span> <span class="chip verm">● Đánh dấu</span></div>
      </aside></div>`);
    wire();
  }
  function audioBox(q) {
    const used = real && (plays[q.id] || 0) >= 1;
    const st = audioState[q.id];
    return `<div class="audio-box"><button class="ic" id="a-play" aria-label="Phát audio" ${used && !st ? 'disabled' : ''}>${st === 'playing' ? '■' : '▶'}</button>
      <div style="flex:1"><b>Bài nghe</b><div class="small muted">${real ? (used && st !== 'playing' ? 'Đã nghe (thi thật chỉ nghe một lần)' : 'Chỉ được nghe một lần') : 'Có thể nghe lại và chỉnh tốc độ'}${q.audio_url ? '' : ' · giọng đọc tổng hợp của trình duyệt'}</div></div>
      ${real ? '' : `<select id="a-rate" aria-label="Tốc độ" style="width:auto;min-height:34px;padding:4px 8px"><option value="0.7">0.7×</option><option value="0.85">0.85×</option><option value="1" selected>1×</option></select>`}</div>`;
  }
  function wire() {
    const q = qs[cur];
    $$('.opt').forEach((b) => b.onclick = () => { change(q.id, { c: Number(b.dataset.i) }); draw(); });
    const te = $('#t-essay'); if (te) te.oninput = () => { typeEssay(q.id, te.value); $('#t-count').textContent = te.value.length; const ch = $('#t-check'); if (ch) ch.disabled = !te.value.trim(); const pal = $(`[data-go="${cur}"]`); if (pal) pal.classList.toggle('done', !!te.value.trim()); };
    $$('[data-go]').forEach((b) => b.onclick = () => { cur = Number(b.dataset.go); saveLocal(); draw(); });
    $('#t-prev').onclick = () => { cur--; saveLocal(); draw(); }; $('#t-next').onclick = () => { cur++; saveLocal(); draw(); };
    $('#t-flag').onclick = () => { change(q.id, { flag: !ans[q.id]?.flag }); draw(); };
    $('#t-furi').onclick = async () => { await setSetting('furigana', S.settings.furigana === false); draw(); };
    $('#t-fs').onchange = (e) => { setSetting('fontSize', e.target.value); };
    $('#t-submit').onclick = submit;
    const ch = $('#t-check'); if (ch) ch.onclick = async () => { try { checked[q.id] = await api('POST', `/attempts/${id}/check`, { qid: q.id }); draw(); } catch (e) { toast(e.message, true); } };
    const ap = $('#a-play'); if (ap) ap.onclick = async () => {
      if (audioState[q.id] === 'playing') { stopAudio(); audioState[q.id] = 'idle'; return draw(); }
      if (real) { try { await api('POST', `/attempts/${id}/play`, { qid: q.id }); plays[q.id] = 1; } catch (e) { toast(e.message, true); return; } }
      audioState[q.id] = 'playing'; draw();
      const rate = Number($('#a-rate')?.value || 1);
      const done = () => { audioState[q.id] = 'idle'; if (qs[cur] === q) draw(); };
      if (q.audio_url) playUrl(q.audio_url, { rate, onend: done }); else speak(q.tts, { rate, onend: done });
    };
  }
  async function submit(auto) {
    if (submitting) return;
    const left = qs.filter((x) => !isDone(x)).length;
    clearTimeout(essayTimer);
    if (auto !== true && !(await confirmBox(left ? `Bạn còn ${left} câu chưa làm. Nộp bài ngay?` : 'Nộp bài và xem kết quả?'))) return;
    submitting = true; stopAudio();
    await flush();
    try { await api('POST', `/attempts/${id}/submit`); try { localStorage.removeItem(key); } catch {} nav('/ketqua/' + id); }
    catch (e) { submitting = false; toast(e.message, true); }
  }
  if (A.deadline) {
    const tick = () => {
      const left = A.deadline - (Date.now() + offset); const t = $('#timer'); if (t) { t.textContent = fmtDur(left); t.classList.toggle('low', left < 5 * 60e3); }
      if (left <= 0) { clearInterval(iv); toast('Hết giờ! Bài đang được nộp.'); submit(true); }
    };
    const iv = setInterval(tick, 1000); S.cleanup.push(() => clearInterval(iv));
  }
  draw();
}, { auth: true, focus: true });

/* ---------- Kết quả & xem lại (FR-11..FR-14, FR-18, FR-20, FR-21) ---------- */
route(/^\/ketqua\/(\d+)$/, async (id) => {
  const A = await api('GET', `/attempts/${id}`);
  if (A.status !== 'submitted') return nav('/lam/' + id);
  const R = A.result; const hasScale = !!R.groups;
  const pct = hasScale ? (R.maxScore ? Math.round((100 * R.score) / R.maxScore) : 0) : R.maxPoints ? Math.round((100 * R.points) / R.maxPoints) : (R.total ? Math.round((100 * R.correct) / R.total) : 0);
  const usePts = R.maxPoints != null && R.maxPoints !== R.total;   // có câu nhiều điểm (tự luận)
  let only = false;
  const draw = () => {
    view(`<a class="small" href="#/lich-su">← Lịch sử</a><h1 class="mt">${esc(A.title)}</h1>
    <div class="card score-card">
      <div class="ring" style="--p:${pct};--c:${hasScale ? (R.passed ? 'var(--ok)' : 'var(--vermilion)') : 'var(--indigo)'}"><div><div><b>${hasScale ? R.score : usePts ? R.points : R.correct}</b><div class="small muted">/ ${hasScale ? R.maxScore : usePts ? R.maxPoints : R.total}</div></div></div></div>
      <div>
        ${R.pending_grading ? `<div class="alert info mb">Bài có <b>${R.pending_grading}</b> câu tự luận đang chờ giảng viên chấm. Điểm dưới đây là <b>tạm tính</b> và sẽ cập nhật khi chấm xong (bạn sẽ nhận thông báo).</div>` : ''}
        ${hasScale ? `<div class="row"><span class="chip ${R.pending_grading ? 'warn' : R.passed ? 'ok' : 'bad'}" style="font-size:1rem;padding:4px 14px">${R.pending_grading ? 'CHỜ CHẤM TỰ LUẬN' : (R.passed ? 'ĐẬU' : 'CHƯA ĐẠT') + (A.exam_type === 'CUSTOM' ? '' : ' (mô phỏng)')}</span><span class="muted small">Điểm đậu: ${R.passScore}/${R.maxScore}</span></div>
        <div class="mt">${R.groups.map((g) => `<div class="mb"><div class="row between small"><span>${esc(g.name)} ${g.metMin ? '' : `<span class="chip bad">dưới điểm liệt ${g.min}</span>`}</span><b>${g.score}/${g.max}</b></div><div class="bar ${g.metMin ? 'ok' : 'bad'}"><i style="width:${(100 * g.score) / g.max}%"></i></div></div>`).join('')}</div>
        <div class="small muted">${esc(R.note || '')}</div>` : usePts ? `<b style="font-size:1.2rem">${R.points}/${R.maxPoints} điểm (${pct}%)</b><div class="small muted">${R.correct}/${R.total} câu đạt</div>` : `<b style="font-size:1.2rem">${R.correct}/${R.total} câu đúng (${pct}%)</b>`}
        <div class="small muted mt">Thời gian làm: ${fmtDur(R.duration_s * 1000)}${R.timed_out ? ' · <b>hết giờ</b>' : ''}${A.leaves ? ` · rời tab ${A.leaves} lần` : ''}</div></div></div>
    <h2 class="mt2">Theo phần thi</h2><div class="grid g3">${Object.entries(R.bySection).map(([k, v]) => { const pv = v.max != null && v.max !== v.total; const p = Math.round(100 * (pv ? v.points / v.max : v.correct / v.total)); return `<div class="card flat"><div class="small muted">${esc(SECTIONS[k] || k)}</div><div class="stat">${pv ? `${v.points}/${v.max}` : `${v.correct}/${v.total}`}</div>${pv ? '<div class="small muted">điểm</div>' : ''}<div class="bar ${p >= 70 ? 'ok' : 'bad'} mt"><i style="width:${p}%"></i></div></div>`; }).join('')}</div>
    ${A.recommend?.length ? `<h2 class="mt2">Nên làm tiếp</h2><div class="grid g2">${A.recommend.map(planCard).join('')}</div>` : ''}
    <div class="row between mt2"><h2 style="margin:0">Xem lại bài</h2><label class="inline"><input type="checkbox" id="only-wrong" ${only ? 'checked' : ''}> Chỉ hiện câu sai/chưa làm</label></div>
    <div class="mt" id="review">${A.questions.map((q, i) => ({ q, i, it: R.items[i] })).filter(({ it }) => !only || !it.ok).map(reviewCard).join('') || '<div class="empty">Tuyệt vời, không có câu sai!</div>'}</div>`);
    $('#only-wrong').onchange = (e) => { only = e.target.checked; draw(); };
    wireReview();
  };
  function reviewCard({ q, i, it }) {
    const chosen = it.chosen;
    if (it.kind === 'essay') return essayReview({ q, i, it });
    return `<div class="card mb qcard" id="rq${q.id}"><div class="row between mb"><span class="chip ${it.ok ? 'ok' : 'bad'}">Câu ${i + 1} · ${it.ok ? 'Đúng' : chosen == null ? 'Chưa làm' : 'Sai'}</span><span class="small muted">${esc(SECTIONS[q.section] || q.section)}${q.qtype ? ' · ' + esc(q.qtype) : ''}</span></div>
      ${q.has_audio ? `<div class="audio-box"><button class="ic" data-play="${q.id}" aria-label="Nghe lại">▶</button><div><b>Nghe lại</b></div></div>` : ''}
      ${q.image_url ? `<img src="${esc(q.image_url)}" alt="" style="max-width:100%;border-radius:10px">` : ''}
      ${q.passage ? `<div class="passage">${rich(q.passage)}</div>` : ''}
      <p class="stem">${rich(q.stem)}</p>
      <div class="opts">${q.options.map((o, k) => `<div class="opt ${k === q.answer ? 'right' : k === chosen ? 'wrong' : ''}"><span class="n">${k + 1}</span><span>${rich(o)}</span>${k === q.answer ? '<span class="chip ok" style="margin-left:auto">Đáp án đúng</span>' : k === chosen ? '<span class="chip bad" style="margin-left:auto">Bạn chọn</span>' : ''}</div>`).join('')}</div>
      <div class="explain">${rich(q.explanation)}${q.audio_script?.length ? `<details class="mt"><summary>Văn bản bài nghe</summary>${q.audio_script.map((l) => `<div class="jp">${l.speaker === 'F' ? '女' : '男'}：${rich(l.text)}</div>`).join('')}</details>` : ''}</div>
      <div class="row mt small">${(q.tags.grammar || []).map((t) => `<a class="chip" href="#/ngu-phap/${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}${(q.tags.kanji || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
      ${q.lessons?.length ? `<div class="alert info mt small"><b>Dùng ngoài đời ở đâu?</b> ${q.lessons.map((l) => `<a href="#/doi-song/${l.id}">${esc(l.title)} (${esc(l.level)})</a>`).join(' · ')}</div>` : ''}
      <div class="row mt"><button class="sm" data-card="${q.id}">＋ Lưu vào flashcard</button><button class="sm" data-cm="${q.id}">Bình luận (${q.comment_count})</button><button class="sm" data-rp="${q.id}">⚠ Báo lỗi</button></div>
      <div id="cm${q.id}"></div></div>`;
  }
  function essayReview({ q, i, it }) {
    const st = !it.graded ? ['warn', 'Chờ chấm'] : !it.answered ? ['bad', 'Chưa làm'] : [it.ok ? 'ok' : 'bad', `${it.points}/${it.max} điểm`];
    return `<div class="card mb qcard" id="rq${q.id}"><div class="row between mb"><span class="chip ${st[0]}">Câu ${i + 1} · Tự luận · ${st[1]}</span><span class="small muted">${esc(SECTIONS[q.section] || q.section)}${q.qtype ? ' · ' + esc(q.qtype) : ''}</span></div>
      ${q.has_audio ? `<div class="audio-box"><button class="ic" data-play="${q.id}" aria-label="Nghe lại">▶</button><div><b>Nghe lại</b></div></div>` : ''}
      ${q.image_url ? `<img src="${esc(q.image_url)}" alt="" style="max-width:100%;border-radius:10px">` : ''}
      ${q.passage ? `<div class="passage">${rich(q.passage)}</div>` : ''}<p class="stem">${rich(q.stem)}</p>
      <div class="small muted">Bài làm của bạn</div><div class="passage jp" style="white-space:pre-wrap">${it.text ? esc(it.text) : '<i class="muted">(bỏ trống)</i>'}</div>
      ${it.feedback ? `<div class="alert info mt"><b>Nhận xét của giảng viên:</b> ${esc(it.feedback)}</div>` : ''}${it.auto ? '<div class="small muted mt">Tự chấm: câu trả lời khớp đáp án.</div>' : ''}
      ${q.model_answer ? `<div class="explain"><b>Đáp án mẫu:</b><div class="jp" style="white-space:pre-wrap">${rich(q.model_answer)}</div>${q.explanation ? `<div class="mt">${rich(q.explanation)}</div>` : ''}</div>` : q.explanation ? `<div class="explain">${rich(q.explanation)}</div>` : ''}
      <div class="row mt"><button class="sm" data-cm="${q.id}">Bình luận (${q.comment_count})</button><button class="sm" data-rp="${q.id}">⚠ Báo lỗi</button></div>
      <div id="cm${q.id}"></div></div>`;
  }
  function wireReview() {
    $$('[data-play]').forEach((b) => b.onclick = () => { const q = A.questions.find((x) => x.id === Number(b.dataset.play)); if (q.audio_url) playUrl(q.audio_url); else speak(q.tts); });
    $$('[data-card]').forEach((b) => b.onclick = async () => {
      const q = A.questions.find((x) => x.id === Number(b.dataset.card));
      try { const r = await api('POST', '/cards', { kind: 'phrase', front: plain(q.stem).slice(0, 90), reading: '', back: `${plain(q.options[q.answer])} — ${plain(q.explanation)}`.slice(0, 280), source: A.title }); toast(r.created ? 'Đã lưu vào flashcard.' : 'Thẻ này đã có rồi.'); } catch (e) { toast(e.message, true); }
    });
    $$('[data-rp]').forEach((b) => b.onclick = () => reportModal(Number(b.dataset.rp)));
    $$('[data-cm]').forEach((b) => b.onclick = () => commentBox(Number(b.dataset.cm)));
  }
  draw();
}, { auth: true });

function reportModal(qid) {
  modal(`<h3>Báo lỗi câu hỏi</h3><label for="r-t">Loại lỗi</label><select id="r-t">${Object.entries(REPORT_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <label for="r-n">Mô tả (không bắt buộc)</label><textarea id="r-n" maxlength="1000" placeholder="Ví dụ: Theo mình đáp án 2 cũng đúng vì…"></textarea>
    <div class="row mt" style="justify-content:flex-end"><button id="r-x">Hủy</button><button class="primary" id="r-ok">Gửi báo lỗi</button></div>`, (m, close) => {
    $('#r-x', m).onclick = close;
    $('#r-ok', m).onclick = async () => { try { await api('POST', '/reports', { question_id: qid, type: $('#r-t', m).value, note: $('#r-n', m).value }); close(); toast('Đã gửi. Bạn sẽ nhận phản hồi trong mục Báo lỗi của tôi.'); } catch (e) { toast(e.message, true); } };
  });
}
async function commentBox(qid) {
  const box = $('#cm' + qid); if (box.innerHTML) { box.innerHTML = ''; return; }
  const draw = async () => {
    const list = await api('GET', `/questions/${qid}/comments`);
    const top = list.filter((c) => !c.parent_id);
    box.innerHTML = `<div class="mt">${top.map((c) => `<div class="comment"><b>${esc(c.name)}</b> ${c.role !== 'learner' ? '<span class="chip">Giáo viên</span>' : ''} <span class="small muted">${fmtDate(c.created_at)}</span><div>${esc(c.body)}</div>
      <button class="sm ghost" data-reply="${c.id}">Trả lời</button>${list.filter((r) => r.parent_id === c.id).map((r) => `<div class="comment reply"><b>${esc(r.name)}</b> ${r.role !== 'learner' ? '<span class="chip">Giáo viên</span>' : ''} <span class="small muted">${fmtDate(r.created_at)}</span><div>${esc(r.body)}</div></div>`).join('')}</div>`).join('') || '<div class="muted small">Chưa có bình luận.</div>'}
      <form class="row mt" id="cf${qid}"><input placeholder="Viết bình luận…" maxlength="1000" required style="flex:1"><button class="primary sm">Gửi</button></form></div>`;
    $(`#cf${qid}`).onsubmit = async (e) => { e.preventDefault(); try { await api('POST', `/questions/${qid}/comments`, { body: e.target.firstElementChild.value }); draw(); } catch (er) { toast(er.message, true); } };
    $$('[data-reply]', box).forEach((b) => b.onclick = () => { const t = prompt('Nội dung trả lời:'); if (t) api('POST', `/questions/${qid}/comments`, { body: t, parent_id: Number(b.dataset.reply) }).then(draw).catch((er) => toast(er.message, true)); });
  };
  draw();
}

/* ---------- Lịch sử, thống kê (FR-13) ---------- */
route(/^\/lich-su$/, async () => {
  const list = await api('GET', '/attempts');
  view(`<h1>Lịch sử làm bài</h1>${list.length ? `<div class="card tw"><table><tr><th>Bài</th><th>Chế độ</th><th>Ngày</th><th>Kết quả</th><th></th></tr>${list.map((a) => `<tr><td>${esc(a.title)}</td><td>${a.mode === 'real' ? 'Thi thật' : 'Luyện'}</td><td>${fmtDate(a.submitted_at || a.started_at)}</td>
    <td>${a.status === 'submitted' ? `<b>${a.maxScore && a.passed != null ? `${a.score}/${a.maxScore}` : `${a.correct}/${a.total}`}</b> ${a.pending_grading ? '<span class="chip warn">Chờ chấm tự luận</span>' : a.passed != null ? `<span class="chip ${a.passed ? 'ok' : 'bad'}">${a.passed ? 'Đậu' : 'Chưa đạt'}</span>` : ''}` : '<span class="chip warn">Đang làm</span>'}</td>
    <td><a class="btn sm" href="#/${a.status === 'submitted' ? 'ketqua' : 'lam'}/${a.id}">${a.status === 'submitted' ? 'Xem lại' : 'Làm tiếp'}</a></td></tr>`).join('')}</table></div>` : '<div class="empty">Bạn chưa làm bài nào. <a href="#/de">Chọn một đề</a> để bắt đầu.</div>'}`);
}, { auth: true });
route(/^\/thong-ke$/, async () => {
  const st = await api('GET', '/stats');
  const bars = (arr, label) => arr.length ? arr.map((x) => { const p = Math.round(100 * x.rate); return `<div class="mb"><div class="row between small"><span>${esc(label ? label(x.key) : x.key)}</span><span>${x.correct}/${x.total} · <b>${p}%</b></span></div><div class="bar ${p >= 70 ? 'ok' : 'bad'}"><i style="width:${p}%"></i></div></div>`; }).join('') : '<div class="muted small">Chưa có dữ liệu.</div>';
  const h = st.history;
  const W = 520, H = 160, pts = h.map((x, i) => [h.length === 1 ? W / 2 : 30 + (i * (W - 60)) / (h.length - 1), H - 24 - (x.pct / 100) * (H - 44)]);
  view(`<h1>Thống kê & điểm yếu</h1>
  ${h.length ? `<div class="card"><h3>Tiến bộ qua các lần làm đề (% câu đúng)</h3><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Biểu đồ tiến bộ">
    ${[0, 50, 100].map((v) => `<line x1="30" x2="${W - 20}" y1="${H - 24 - (v / 100) * (H - 44)}" y2="${H - 24 - (v / 100) * (H - 44)}" stroke="var(--line)"/><text x="4" y="${H - 20 - (v / 100) * (H - 44)}" font-size="10" fill="var(--muted)">${v}%</text>`).join('')}
    <polyline fill="none" stroke="var(--indigo)" stroke-width="2.5" points="${pts.map((p) => p.join(',')).join(' ')}"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--vermilion)"><title>${esc(h[i].title)}: ${h[i].pct}%</title></circle>`).join('')}</svg></div>` : '<div class="alert info">Làm vài đề để thấy biểu đồ tiến bộ ở đây.</div>'}
  <div class="grid g2 mt"><div class="card"><h3>Theo phần thi</h3>${bars(st.sections, (k) => SECTIONS[k] || k)}</div>
    <div class="card"><h3>Theo dạng câu</h3>${bars(st.qtypes)}</div>
    <div class="card"><h3>Mẫu ngữ pháp (yếu nhất trước)</h3>${bars(st.grammar)}</div>
    <div class="card"><h3>Kanji</h3>${bars(st.kanji)}</div></div>
  ${st.recommend.length ? `<h2 class="mt2">Gợi ý cho bạn</h2><div class="grid g2">${st.recommend.map(planCard).join('')}</div>` : ''}`);
}, { auth: true });

/* ---------- Đời sống (FR-15..FR-17) ---------- */
route(/^\/doi-song$/, async () => {
  const list = await api('GET', '/lessons');
  view(`<h1>Tiếng Nhật đời sống</h1><p class="muted">Mỗi bài 10–15 phút: hội thoại có audio, từ vựng, câu mẫu, mức lịch sự và câu hỏi kiểm tra.</p>
  <div class="tabs">${['', 'N5', 'N4', 'N3'].map((l) => `<button class="tab ${!l ? 'on' : ''}" data-lv="${l}">${l || 'Tất cả'}</button>`).join('')}</div>
  <div class="grid g2" id="ll"></div>`);
  const draw = (lv) => { $('#ll').innerHTML = list.filter((l) => !lv || l.level === lv).map((l) => `<a class="card" href="#/doi-song/${l.id}"><div class="row between"><span class="chip verm">${esc(l.situation)}</span>${chipLevel(l.level)}</div><h3 class="mt">${esc(l.title)}</h3><p class="muted small">${esc(l.summary)}</p>
    <div class="row">${l.has_doc ? '<span class="chip">Có tài liệu thực tế</span>' : ''}${l.progress ? `<span class="chip ok">Đã làm ${l.progress.score}/${l.progress.total}</span>` : ''}</div></a>`).join(''); };
  draw('');
  $$('.tab').forEach((t) => t.onclick = () => { $$('.tab').forEach((x) => x.classList.remove('on')); t.classList.add('on'); draw(t.dataset.lv); });
});
route(/^\/doi-song\/(\d+)$/, async (id) => {
  const L = await api('GET', `/lessons/${id}`);
  const regChip = (r) => `<span class="chip ${r === 'kính ngữ' ? 'verm' : r === 'thông thường' ? 'warn' : ''}">${esc(r)}</span>`;
  view(`<a class="small" href="#/doi-song">← Bài tình huống</a>
  <div class="row between mt"><h1 style="margin:0">${esc(L.title)}</h1><div class="row"><span class="chip verm">${esc(L.situation)}</span>${chipLevel(L.level)}</div></div>
  <div class="row mt"><label class="inline"><input type="checkbox" id="l-furi" ${S.settings.furigana === false ? '' : 'checked'}> Furigana</label><label class="inline"><input type="checkbox" id="l-vi" ${S.settings.translation === false ? '' : 'checked'}> Bản dịch tiếng Việt</label>
    <a class="btn sm" href="#/chep-chinh-ta/${L.id}">✎ Chép chính tả bài này</a><button class="sm" id="l-all">▶ Nghe cả hội thoại</button><button class="sm" id="l-stop">■ Dừng</button><select id="l-rate" aria-label="Tốc độ" style="width:auto;min-height:34px;padding:4px 8px"><option value="0.7">Chậm 0.7×</option><option value="1" selected>Bình thường</option><option value="1.2">Nhanh (tự nhiên)</option></select></div>
  <div class="card mt"><h2>Hội thoại</h2>${L.dialogue.map((d, i) => `<div class="dialog-line"><div class="who">${rich(d.speaker)}<div>${regChip(d.register)}</div></div><div><div class="jp" style="font-size:1.1rem;line-height:2">${rich(d.ja)}</div><div class="vi muted small">${esc(d.vi)}</div></div><button class="sm" data-line="${i}" aria-label="Nghe câu ${i + 1}">▶</button></div>`).join('')}</div>
  <div class="grid g2 mt"><div class="card"><h3>Từ vựng</h3>${L.vocab.map((v) => `<div class="row between" style="padding:5px 0;border-bottom:1px dashed var(--line)"><div><span class="jp" style="font-size:1.1rem">${rich(v.ja)}</span> <span class="muted small">${esc(v.reading)}</span><div class="vi small">${esc(v.vi)}</div></div><button class="sm" data-save='${esc(JSON.stringify({ front: plain(v.ja), reading: v.reading, back: v.vi }))}'>＋ Thẻ</button></div>`).join('')}</div>
    <div class="card"><h3>Câu mẫu & mức lịch sự</h3>${L.phrases.map((p) => `<div style="padding:8px 0;border-bottom:1px dashed var(--line)"><div class="row between"><span class="jp" style="font-size:1.05rem">${rich(p.ja)}</span>${regChip(p.register)}</div><div class="vi small">${esc(p.vi)}</div><div class="small muted">${esc(p.note)}</div><button class="sm ghost" data-sp="${esc(plain(p.ja))}">▶ Nghe</button> <button class="sm ghost" data-savep='${esc(JSON.stringify({ front: plain(p.ja), back: p.vi, kind: 'phrase' }))}'>＋ Thẻ</button></div>`).join('')}</div></div>
  ${L.doc ? `<div class="card mt"><h2>Tài liệu thực tế: ${esc(L.doc.title)}</h2><div class="doc ${L.doc.kind}">${esc(L.doc.text)}</div><details class="mt vi"><summary>Bản dịch tiếng Việt</summary><p>${esc(L.doc.vi)}</p></details></div>` : ''}
  <div class="card mt"><h3>Ghi chú văn hóa</h3><p>${esc(L.culture)}</p></div>
  ${L.grammar_tags.length ? `<div class="card mt"><h3>Mẫu ngữ pháp trong bài</h3><div class="row">${L.grammar_tags.map((g) => `<a class="chip" href="#/ngu-phap/${encodeURIComponent(g)}">Ngữ pháp: ${esc(g)}</a>`).join('')}</div></div>` : ''}
  <div class="card mt"><h2>Kiểm tra</h2><form id="qz">${L.quiz.map((q, i) => `<fieldset style="border:0;padding:0;margin:0 0 16px"><legend><b>${i + 1}. ${rich(q.stem)}</b></legend>${q.options.map((o, k) => `<label class="inline" style="display:flex;padding:7px 0;font-weight:500"><input type="radio" name="q${i}" value="${k}"> <span>${rich(o)}</span></label>`).join('')}<div id="qx${i}"></div></fieldset>`).join('')}
    <button class="primary" ${S.user ? '' : 'disabled'}>Nộp bài kiểm tra</button> ${S.user ? '' : '<span class="muted small">Đăng nhập để lưu kết quả</span>'}</form><div id="qr"></div></div>`);
  $('#l-furi').onchange = (e) => setSetting('furigana', e.target.checked); $('#l-vi').onchange = (e) => setSetting('translation', e.target.checked);
  const rate = () => Number($('#l-rate').value);
  const lines = L.dialogue.map((d) => ({ speaker: d.role, text: d.ja }));
  $('#l-all').onclick = () => speak(lines, { rate: rate() }); $('#l-stop').onclick = stopAudio;
  $$('[data-line]').forEach((b) => b.onclick = () => speak([lines[Number(b.dataset.line)]], { rate: rate() }));
  $$('[data-sp]').forEach((b) => b.onclick = () => speak([{ speaker: 'F', text: b.dataset.sp }], { rate: rate() }));
  const saveCard = (data) => async () => { if (!S.user) return nav('/dang-nhap?next=' + encodeURIComponent(location.hash.slice(1))); try { const r = await api('POST', '/cards', { ...data, source: L.title }); toast(r.created ? 'Đã lưu vào flashcard.' : 'Thẻ này đã có rồi.'); } catch (e) { toast(e.message, true); } };
  $$('[data-save]').forEach((b) => b.onclick = saveCard(JSON.parse(b.dataset.save))); $$('[data-savep]').forEach((b) => b.onclick = saveCard(JSON.parse(b.dataset.savep)));
  $('#qz').onsubmit = async (e) => {
    e.preventDefault(); const a = L.quiz.map((_, i) => { const c = e.target.querySelector(`input[name=q${i}]:checked`); return c ? Number(c.value) : null; });
    try { const r = await api('POST', `/lessons/${id}/submit`, { answers: a });
      r.detail.forEach((d, i) => { $('#qx' + i).innerHTML = `<div class="explain"><b>${d.ok ? '✓ Đúng' : '✗ Sai - đáp án đúng: ' + (d.answer + 1)}</b><div>${rich(d.explanation)}</div></div>`; });
      $('#qr').innerHTML = `<div class="alert ${r.score === r.total ? 'ok' : 'info'} mt"><b>${r.score}/${r.total}</b> câu đúng.</div>`; } catch (er) { toast(er.message, true); }
  };
});

/* ---------- Flashcard (FR-19) ---------- */
route(/^\/the$/, async () => {
  let D = await api('GET', '/cards'); let idx = 0, shown = false;
  const draw = () => {
    const c = D.due[idx];
    view(`<h1>Flashcard ôn tập</h1><div class="row between mb"><span class="muted">${D.due.length} thẻ đến hạn · ${D.cards.length} thẻ tổng cộng</span></div>
    ${c ? `<div class="card flash"><div><span class="chip">${esc(c.kind === 'phrase' ? 'câu mẫu' : c.kind)}</span><div class="front mt ${c.front.length > 14 ? '' : ''}" style="${c.front.length > 14 ? 'font-size:1.4rem' : ''}">${esc(c.front)}</div>${shown ? `<div class="mt"><div class="muted">${esc(c.reading)}</div><div style="font-size:1.2rem" class="mt">${esc(c.back)}</div></div>` : ''}
      <div class="mt row" style="justify-content:center">${shown ? `<button data-g="0" class="danger">Quên</button><button data-g="1">Khó</button><button data-g="2" class="primary">Tốt</button><button data-g="3">Dễ</button>` : `<button class="primary" id="show">Hiện đáp án</button><button class="sm" id="say">▶ Nghe</button>`}</div></div></div>`
      : `<div class="card empty">🎉 Không còn thẻ nào cần ôn hôm nay.<br><span class="small">Thêm từ mới từ các bài tình huống hoặc từ phần xem lại đề.</span></div>`}
    <h2 class="mt2">Thêm thẻ</h2><form class="card" id="nf"><div class="field-row"><div><label>Mặt trước (từ/kanji/câu)</label><input name="front" required maxlength="100"></div><div><label>Cách đọc</label><input name="reading" maxlength="100"></div><div><label>Nghĩa tiếng Việt</label><input name="back" required maxlength="300"></div></div><button class="primary mt">Lưu thẻ</button></form>
    <h2 class="mt2">Tất cả thẻ</h2><div class="card tw">${D.cards.length ? `<table><tr><th>Thẻ</th><th>Nghĩa</th><th>Ôn tiếp</th><th></th></tr>${D.cards.map((x) => `<tr><td class="jp">${esc(x.front)}</td><td>${esc(x.back)}</td><td>${x.due <= Date.now() ? '<span class="chip warn">Hôm nay</span>' : fmtDate(x.due).slice(0, 10)}</td><td><button class="sm ghost" data-del="${x.id}">Xóa</button></td></tr>`).join('')}</table>` : '<div class="muted">Chưa có thẻ.</div>'}</div>`);
    const sh = $('#show'); if (sh) sh.onclick = () => { shown = true; draw(); };
    const sy = $('#say'); if (sy) sy.onclick = () => speak([{ speaker: 'F', text: c.front }]);
    $$('[data-g]').forEach((b) => b.onclick = async () => { await api('POST', `/cards/${c.id}/review`, { grade: Number(b.dataset.g) }); D = await api('GET', '/cards'); idx = 0; shown = false; draw(); });
    $$('[data-del]').forEach((b) => b.onclick = async () => { await api('DELETE', `/cards/${b.dataset.del}`); D = await api('GET', '/cards'); idx = 0; draw(); });
    $('#nf').onsubmit = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); try { await api('POST', '/cards', f); D = await api('GET', '/cards'); idx = 0; draw(); toast('Đã lưu thẻ.'); } catch (er) { toast(er.message, true); } };
  };
  draw();
}, { auth: true });

/* ---------- Tìm kiếm (FR-04) ---------- */
route(/^\/tim$/, async () => {
  const q = S.query.q || ''; const r = await api('GET', '/search?q=' + encodeURIComponent(q));
  view(`<h1>Kết quả cho “${esc(q)}”</h1>
  <h2>Đề thi (${r.exams.length})</h2><div class="grid g2">${r.exams.map(examCard).join('') || '<div class="muted">Không có.</div>'}</div>
  <h2 class="mt2">Bài học đời sống (${r.lessons.length})</h2><div class="grid g2">${r.lessons.map((l) => `<a class="card" href="#/doi-song/${l.id}"><span class="chip verm">${esc(l.situation)}</span> ${chipLevel(l.level)}<h3 class="mt">${esc(l.title)}</h3><p class="muted small">${esc(l.summary)}</p></a>`).join('') || '<div class="muted">Không có.</div>'}</div>
  ${r.questions.length ? `<h2 class="mt2">Câu hỏi (${r.questions.length})</h2><div class="card flat">${r.questions.map((x) => `<div>${chipLevel(x.level)} ${esc(x.stem)}</div>`).join('')}<div class="small muted mt">Làm đề hoặc luyện tập để xem đầy đủ câu hỏi.</div></div>` : ''}`);
});

/* ---------- Tài khoản ---------- */
// Ô mật khẩu có nút Hiện/Ẩn
const pwField = (id, label, ac, extra = '') => `<label for="${id}">${label}</label><div class="pw"><input id="${id}" type="password" required autocomplete="${ac}" maxlength="128" ${extra}><button type="button" class="ghost sm" data-eye="${id}" aria-label="Hiện mật khẩu">Hiện</button></div>`;
function bindEyes() { $$('[data-eye]').forEach((b) => b.onclick = () => { const i = $('#' + b.dataset.eye); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? 'Ẩn' : 'Hiện'; b.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'); }); }
// Giống quy tắc ở máy chủ, để báo lỗi ngay khi gõ
const pwProblem = (pw) => pw.length < 8 ? 'Cần ít nhất 8 ký tự.' : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? 'Cần có cả chữ và số.' : '';
function pwStrength(inp, out) {
  inp.addEventListener('input', () => { const v = inp.value; const pr = pwProblem(v);
    const score = pr ? 0 : (v.length >= 12) + /[A-Z]/.test(v) + /[^A-Za-z0-9]/.test(v);
    out.textContent = !v ? '' : pr || ['Mật khẩu tạm được', 'Mật khẩu khá', 'Mật khẩu mạnh', 'Mật khẩu rất mạnh'][score];
    out.className = 'small ' + (!v ? '' : pr ? 'bad-text' : score >= 2 ? 'ok-text' : 'muted'); });
}
const showErr = (er, sel = '#err') => { const el = $(sel); el.hidden = false; el.textContent = er.message || er; };
const authCfg = async () => (S.authCfg ||= await api('GET', '/auth/config').catch(() => ({})));
// Nút "Đăng nhập bằng Google" (chỉ hiện khi quản trị viên đã cấu hình GOOGLE_CLIENT_ID)
async function googleButton(box, after) {
  const cfg = await authCfg(); if (!cfg.google_client_id || !box) return;
  box.hidden = false;
  if (!window.google?.accounts) await new Promise((ok, fail) => { const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.onload = ok; sc.onerror = fail; document.head.appendChild(sc); }).catch(() => {});
  if (!window.google?.accounts) { box.innerHTML = '<div class="small muted">Không tải được nút Google.</div>'; return; }
  google.accounts.id.initialize({ client_id: cfg.google_client_id, callback: async (r) => {
    try { S.user = await api('POST', '/auth/google', { credential: r.credential }); applySettings(); after(S.user); } catch (er) { showErr(er); } } });
  google.accounts.id.renderButton($('.gbtn', box), { theme: 'outline', size: 'large', text: 'continue_with', locale: 'vi', width: Math.min(360, box.clientWidth || 360) });
}
const afterLogin = (u) => nav(u.is_new ? '/cai-dat?moi=1' : S.query.next ? decodeURIComponent(S.query.next) : (['admin', 'editor', 'reviewer', 'teacher'].includes(u.role) && !S.query.next ? '/quan-tri' : '/'));
const googleBox = '<div id="gbox" hidden><div class="or"><span>hoặc</span></div><div class="gbtn"></div></div>';

route(/^\/dang-nhap$/, () => {
  if (S.user) return nav('/');
  view(`<div class="card auth"><h2>Đăng nhập</h2><form id="lf" novalidate><label for="e">Email</label><input id="e" type="email" required autocomplete="email" value="${esc(S.query.email || '')}">
    ${pwField('p', 'Mật khẩu', 'current-password')}
    <div class="row between mt"><label class="inline"><input type="checkbox" id="rm" checked> Ghi nhớ đăng nhập</label><a class="small" href="#/quen-mat-khau">Quên mật khẩu?</a></div>
    <div id="err" class="alert bad mt" hidden></div><button class="primary mt" style="width:100%">Đăng nhập</button></form>
    ${googleBox}<p class="small muted mt">Chưa có tài khoản? <a href="#/dang-ky${S.query.next ? '?next=' + encodeURIComponent(S.query.next) : ''}">Đăng ký miễn phí</a></p></div>`);
  bindEyes(); googleButton($('#gbox'), afterLogin);
  $('#lf').onsubmit = async (e) => { e.preventDefault(); const em = $('#e').value.trim(); if (!em || !$('#p').value) return showErr('Nhập email và mật khẩu.');
    const btn = e.submitter; btn.disabled = true;
    try { S.user = await api('POST', '/auth/login', { email: em, password: $('#p').value, remember: $('#rm').checked }); applySettings(); afterLogin(S.user); } catch (er) { showErr(er); } finally { btn.disabled = false; } };
});
route(/^\/dang-ky$/, () => {
  if (S.user) return nav('/');
  view(`<div class="card auth"><h2>Tạo tài khoản</h2><form id="rf" novalidate><label for="n">Tên hiển thị</label><input id="n" required maxlength="60" autocomplete="name"><label for="e">Email</label><input id="e" type="email" required autocomplete="email">
    ${pwField('p', 'Mật khẩu (ít nhất 8 ký tự, có chữ và số)', 'new-password')}<div id="ps" class="small"></div>
    ${pwField('p2', 'Nhập lại mật khẩu', 'new-password')}
    <input name="website" id="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
    <div id="err" class="alert bad mt" hidden></div><button class="accent mt" style="width:100%">Đăng ký</button></form>
    ${googleBox}<p class="small muted mt">Đã có tài khoản? <a href="#/dang-nhap">Đăng nhập</a></p></div>`);
  bindEyes(); pwStrength($('#p'), $('#ps')); googleButton($('#gbox'), afterLogin);
  $('#rf').onsubmit = async (e) => { e.preventDefault();
    const em = $('#e').value.trim(), pw = $('#p').value;
    if (!$('#n').value.trim()) return showErr('Nhập tên hiển thị.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(em)) return showErr('Email không hợp lệ.');
    if (pwProblem(pw)) return showErr('Mật khẩu: ' + pwProblem(pw));
    if (pw !== $('#p2').value) return showErr('Hai lần nhập mật khẩu không khớp.');
    const btn = e.submitter; btn.disabled = true;
    try { S.user = await api('POST', '/auth/register', { name: $('#n').value, email: em, password: pw, website: $('#hp').value }); applySettings(); nav(S.query.next ? '/cai-dat?moi=1&next=' + encodeURIComponent(S.query.next) : '/cai-dat?moi=1'); }
    catch (er) { showErr(er); } finally { btn.disabled = false; } };
});
route(/^\/quen-mat-khau$/, async () => {
  const cfg = await authCfg();
  if (!cfg.email_reset) return view(`<div class="card auth"><h2>Quên mật khẩu</h2><p>Hệ thống chưa bật gửi email tự động.</p><p>Hãy liên hệ <b>giảng viên hoặc quản trị viên</b> để được cấp link đặt lại mật khẩu (vào Quản trị → Người dùng → "Link đặt lại mật khẩu").</p><a class="btn mt" href="#/dang-nhap">Quay lại đăng nhập</a></div>`);
  view(`<div class="card auth"><h2>Quên mật khẩu</h2><p class="muted">Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu (hiệu lực 1 giờ).</p><form id="ff" novalidate><label for="e">Email</label><input id="e" type="email" required autocomplete="email">
    <div id="err" class="alert bad mt" hidden></div><div id="done" class="alert ok mt" hidden></div><button class="primary mt" style="width:100%">Gửi link</button></form><p class="small mt"><a href="#/dang-nhap">Quay lại đăng nhập</a></p></div>`);
  $('#ff').onsubmit = async (e) => { e.preventDefault(); $('#err').hidden = true; const btn = e.submitter; btn.disabled = true;
    try { await api('POST', '/auth/forgot', { email: $('#e').value.trim() }); $('#done').hidden = false; $('#done').textContent = 'Nếu email này đã đăng ký, link đặt lại mật khẩu đã được gửi. Kiểm tra hộp thư, kể cả mục Spam/Quảng cáo.'; }
    catch (er) { showErr(er); } finally { btn.disabled = false; } };
});
route(/^\/dat-lai-mat-khau$/, async () => {
  const t = S.query.t || '';
  let info; try { info = await api('GET', '/auth/reset?t=' + encodeURIComponent(t)); }
  catch (er) { return view(`<div class="card auth"><h2>Đặt lại mật khẩu</h2><div class="alert bad">${esc(er.message)}</div><p class="mt"><a class="btn" href="#/quen-mat-khau">Yêu cầu link mới</a></p></div>`); }
  view(`<div class="card auth"><h2>Đặt mật khẩu mới</h2><p class="muted">Tài khoản: <b>${esc(info.email)}</b></p><form id="rsf" novalidate>
    ${pwField('p', 'Mật khẩu mới', 'new-password')}<div id="ps" class="small"></div>${pwField('p2', 'Nhập lại mật khẩu mới', 'new-password')}
    <div id="err" class="alert bad mt" hidden></div><button class="primary mt" style="width:100%">Lưu mật khẩu và đăng nhập</button></form></div>`);
  bindEyes(); pwStrength($('#p'), $('#ps'));
  $('#rsf').onsubmit = async (e) => { e.preventDefault(); const pw = $('#p').value;
    if (pwProblem(pw)) return showErr('Mật khẩu: ' + pwProblem(pw));
    if (pw !== $('#p2').value) return showErr('Hai lần nhập mật khẩu không khớp.');
    try { S.user = await api('POST', '/auth/reset', { token: t, password: pw }); applySettings(); toast('Đã đặt mật khẩu mới.'); nav('/'); } catch (er) { showErr(er); } };
});
route(/^\/cai-dat$/, async () => {
  const u = S.user; const g = u.goal || {};
  view(`<h1>${S.query.moi ? 'Chọn mục tiêu của bạn' : 'Cài đặt'}</h1>
  <div class="card"><h3>Mục tiêu học</h3><form id="gf"><div class="field-row">
    <div><label for="g-t">Bạn học để…</label><select id="g-t"><option value="exam" ${g.type === 'exam' ? 'selected' : ''}>Thi chứng chỉ</option><option value="life" ${g.type === 'life' ? 'selected' : ''}>Dùng tiếng Nhật trong đời sống</option><option value="both" ${g.type === 'both' ? 'selected' : ''}>Cả hai</option></select></div>
    <div><label for="g-l">Cấp độ mục tiêu</label><select id="g-l">${['N5', 'N4', 'N3', 'N2', 'N1'].map((l) => `<option ${g.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div><label for="g-d">Thời hạn (nếu có)</label><input id="g-d" type="date" value="${esc(g.deadline || '')}"></div></div><button class="primary mt">Lưu mục tiêu</button></form></div>
  <div class="card mt"><h3>Hiển thị</h3><div class="row"><label class="inline"><input type="checkbox" id="s-f" ${S.settings.furigana === false ? '' : 'checked'}> Furigana</label><label class="inline"><input type="checkbox" id="s-v" ${S.settings.translation === false ? '' : 'checked'}> Bản dịch tiếng Việt</label>
    <select id="s-fs" aria-label="Cỡ chữ" style="width:auto">${[['s', 'Chữ nhỏ'], ['m', 'Chữ vừa'], ['l', 'Chữ lớn'], ['xl', 'Chữ rất lớn']].map(([v, t]) => `<option value="${v}" ${(S.settings.fontSize || 'm') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
  <div class="card mt"><h3>Tài khoản</h3><form id="nf" class="row" style="align-items:flex-end"><div style="flex:1;min-width:200px"><label for="nm">Tên hiển thị</label><input id="nm" maxlength="60" required value="${esc(u.name)}"></div><button>Lưu tên</button></form>
    <p class="muted mt">Email: <b>${esc(u.email)}</b>${u.google ? ' · đã liên kết Google' : ''}</p>
    <div class="row"><a class="btn" href="#/bao-loi">Báo lỗi của tôi</a><button id="lo">Đăng xuất</button><button id="loa" title="Dùng khi bạn đăng nhập ở máy lạ hoặc nghi bị lộ mật khẩu">Đăng xuất mọi thiết bị</button>${u.role === 'learner' ? '<button class="danger" id="del">Xóa tài khoản và dữ liệu</button>' : ''}</div></div>
  <div class="card mt"><h3>${u.has_password ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}</h3>${u.has_password ? '' : '<p class="small muted">Bạn đang đăng nhập bằng Google. Đặt thêm mật khẩu để có thể đăng nhập bằng email.</p>'}<form id="pf" novalidate style="max-width:420px">
    ${u.has_password ? pwField('pc', 'Mật khẩu hiện tại', 'current-password') : ''}${pwField('pn', 'Mật khẩu mới', 'new-password')}<div id="ps" class="small"></div>${pwField('pn2', 'Nhập lại mật khẩu mới', 'new-password')}
    <div id="perr" class="alert bad mt" hidden></div><button class="primary mt">Lưu mật khẩu</button><div class="small muted mt">Sau khi đổi, các thiết bị khác sẽ bị đăng xuất.</div></form></div>`);
  bindEyes(); pwStrength($('#pn'), $('#ps'));
  $('#nf').onsubmit = async (e) => { e.preventDefault(); try { S.user = await api('PATCH', '/me', { name: $('#nm').value.trim() }); toast('Đã lưu tên.'); render(); } catch (er) { toast(er.message, true); } };
  $('#pf').onsubmit = async (e) => { e.preventDefault(); $('#perr').hidden = true; const pw = $('#pn').value;
    if (pwProblem(pw)) return showErr('Mật khẩu mới: ' + pwProblem(pw), '#perr');
    if (pw !== $('#pn2').value) return showErr('Hai lần nhập mật khẩu mới không khớp.', '#perr');
    try { S.user = await api('POST', '/me/password', { current: $('#pc')?.value || '', password: pw }); toast('Đã lưu mật khẩu mới.'); render(); } catch (er) { showErr(er, '#perr'); } };
  $('#loa').onclick = async () => { if (await confirmBox('Đăng xuất tài khoản trên tất cả thiết bị, kể cả máy này?')) { await api('POST', '/auth/logout-all'); S.user = null; applySettings(); nav('/dang-nhap'); toast('Đã đăng xuất trên mọi thiết bị.'); } };
  $('#gf').onsubmit = async (e) => { e.preventDefault(); S.user = await api('PATCH', '/me', { goal: { type: $('#g-t').value, level: $('#g-l').value, deadline: $('#g-d').value } }); toast('Đã lưu mục tiêu.'); if (S.query.moi) nav(S.query.next ? decodeURIComponent(S.query.next) : '/'); };
  $('#s-f').onchange = (e) => setSetting('furigana', e.target.checked); $('#s-v').onchange = (e) => setSetting('translation', e.target.checked); $('#s-fs').onchange = (e) => setSetting('fontSize', e.target.value);
  $('#lo').onclick = async () => { await api('POST', '/auth/logout'); S.user = null; applySettings(); nav('/'); };
  const del = $('#del'); if (del) del.onclick = async () => { if (await confirmBox('Xóa vĩnh viễn tài khoản cùng toàn bộ bài làm, thẻ và bình luận của bạn?')) { await api('DELETE', '/me'); S.user = null; applySettings(); nav('/'); toast('Đã xóa tài khoản.'); } };
}, { auth: true });
route(/^\/bao-loi$/, async () => {
  const list = await api('GET', '/reports/mine');
  const st = { open: ['Chưa xử lý', 'warn'], in_progress: ['Đang xử lý', ''], closed: ['Đã đóng', 'ok'] };
  view(`<h1>Báo lỗi của tôi</h1>${list.length ? list.map((r) => `<div class="card mb"><div class="row between"><b>${esc(REPORT_TYPES[r.type])} · câu #${r.question_id}</b><span class="chip ${st[r.status][1]}">${st[r.status][0]}</span></div><div class="small muted">${fmtDate(r.created_at)}</div><p>${esc(r.note)}</p>${r.reply ? `<div class="alert ok"><b>Phản hồi:</b> ${esc(r.reply)}</div>` : ''}</div>`).join('') : '<div class="empty">Bạn chưa gửi báo lỗi nào.</div>'}`);
}, { auth: true });

/* ---------- Khởi động ---------- */
window.addEventListener('hashchange', render);
async function boot() {
  try { S.user = await api('GET', '/me'); } catch {}
  applySettings();
  render();
}
