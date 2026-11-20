/* Tính năng chuyên tiếng Nhật: Thư viện ngữ pháp, Chép chính tả, Khóa học theo lộ trình */
'use strict';

/* ---------- Thư viện ngữ pháp ---------- */
route(/^\/ngu-phap$/, async () => {
  const q = S.query; const list = await api('GET', '/grammar?' + new URLSearchParams({ level: q.level || '', q: q.q || '' }));
  view(`<h1>Thư viện ngữ pháp</h1><p class="muted">Mỗi mẫu có cách dùng, ví dụ có furigana và audio, câu đề liên quan và bài tình huống ngoài đời.</p>
  <div class="row mb"><div class="tabs" style="margin:0">${['', 'N5', 'N4', 'N3', 'N2'].map((l) => `<a class="tab ${(q.level || '') === l ? 'on' : ''}" href="#/ngu-phap${l ? '?level=' + l : ''}">${l || 'Tất cả'}</a>`).join('')}</div><input id="gq" type="search" placeholder="Tìm mẫu ngữ pháp…" value="${esc(q.q || '')}" style="max-width:240px"></div>
  <div class="grid g2">${list.map((g) => { const p = g.mine ? Math.round(100 * g.mine.correct / g.mine.total) : null;
    return `<a class="card" href="#/ngu-phap/${encodeURIComponent(g.tag)}"><div class="row between">${chipLevel(g.level)}<span class="small muted">${g.questions} câu trong đề</span></div><h3 class="jp mt">${esc(g.tag)}</h3><div class="small muted">${esc(g.title)}</div><p class="small">${esc(g.meaning)}</p>${p != null ? `<div class="bar ${p >= 70 ? 'ok' : 'bad'}"><i style="width:${p}%"></i></div><div class="small muted">Bạn đúng ${g.mine.correct}/${g.mine.total} câu</div>` : ''}</a>`; }).join('') || '<div class="empty">Không tìm thấy mẫu nào.</div>'}</div>`);
  $('#gq').onkeydown = (e) => { if (e.key === 'Enter') nav('/ngu-phap?' + new URLSearchParams({ ...(q.level ? { level: q.level } : {}), q: e.target.value })); };
});
route(/^\/ngu-phap\/(.+)$/, async (tag) => {
  tag = decodeURIComponent(tag);
  let g; try { g = await api('GET', '/grammar/item?tag=' + encodeURIComponent(tag)); } catch (e) { return view(`<a href="#/ngu-phap" class="small">← Thư viện</a><div class="empty">Chưa có bài giảng cho mẫu “${esc(tag)}”.<br><a class="btn mt" href="#/luyen?grammar=${encodeURIComponent(tag)}">Luyện các câu có mẫu này</a></div>`); }
  view(`<a href="#/ngu-phap" class="small">← Thư viện ngữ pháp</a>
  <div class="row between mt"><h1 class="jp" style="margin:0">${esc(g.tag)}</h1>${chipLevel(g.level)}</div>
  <div class="card mt"><div class="small muted">Cấu trúc</div><div class="jp" style="font-size:1.2rem;font-weight:700">${esc(g.structure)}</div><h3 class="mt">Ý nghĩa</h3><p>${esc(g.meaning)}</p>${g.notes ? `<h3>Lưu ý</h3><p>${esc(g.notes)}</p>` : ''}${g.compare ? `<div class="alert info"><b>So sánh:</b> ${esc(g.compare)}</div>` : ''}</div>
  <div class="card mt"><div class="row between"><h2 style="margin:0">Ví dụ</h2><label class="inline small"><input type="checkbox" id="gf" ${S.settings.furigana === false ? '' : 'checked'}> Furigana</label></div>${g.examples.map((x, i) => `<div class="dialog-line" style="grid-template-columns:1fr auto"><div><div class="jp" style="font-size:1.15rem;line-height:2.1">${rich(x.ja)}</div><div class="vi muted small">${esc(x.vi)}</div></div><button class="sm" data-say="${i}" aria-label="Nghe ví dụ ${i + 1}">▶</button></div>`).join('')}</div>
  <div class="grid g2 mt"><div class="card"><h3>Luyện tập</h3><p class="small muted">${g.question_count} câu trong kho đề dùng mẫu này.${g.mine ? ` Bạn đã đúng ${g.mine.correct}/${g.mine.total}.` : ''}</p>${g.question_count ? `<a class="btn primary" href="#/luyen?grammar=${encodeURIComponent(g.tag)}">Luyện các câu có mẫu này</a>` : '<span class="muted small">Chưa có câu hỏi.</span>'}</div>
    <div class="card"><h3>Dùng ngoài đời</h3>${g.lessons.length ? g.lessons.map((l) => `<div><a href="#/doi-song/${l.id}">${esc(l.title)}</a> ${chipLevel(l.level)}</div>`).join('') : '<span class="muted small">Chưa có bài tình huống dùng mẫu này.</span>'}</div></div>`);
  $('#gf').onchange = (e) => setSetting('furigana', e.target.checked);
  $$('[data-say]').forEach((b) => b.onclick = () => speak([{ speaker: 'F', text: g.examples[Number(b.dataset.say)].ja }]));
});

/* ---------- Chép chính tả ---------- */
route(/^\/chep-chinh-ta$/, async () => {
  const sets = await api('GET', '/dictation/sets');
  view(`<h1>Chép chính tả</h1><p class="muted">Nghe từng câu hội thoại rồi gõ lại bằng hiragana hoặc kanji đều được. Hệ thống chấm từng ký tự, bỏ qua dấu câu và khoảng trắng, chấp nhận cả katakana/hiragana tương đương. Rất hiệu quả để luyện nghe thật.</p>
  <div class="grid g2">${sets.map((s) => `<a class="card" href="#/chep-chinh-ta/${s.id}"><div class="row between"><span class="chip verm">${esc(s.situation)}</span>${chipLevel(s.level)}</div><h3 class="mt">${esc(s.title)}</h3><div class="bar ok"><i style="width:${Math.round(100 * s.done / s.lines)}%"></i></div><div class="small muted">${s.done}/${s.lines} câu đã chép đúng</div></a>`).join('')}</div>`);
});
route(/^\/chep-chinh-ta\/(\d+)$/, async (id) => {
  const D = await api('GET', `/dictation/sets/${id}`);
  let cur = Math.max(0, D.lines.findIndex((l) => !l.done)); let rate = 1; const plays = {};
  const draw = (res) => {
    const l = D.lines[cur];
    view(`<a href="#/chep-chinh-ta" class="small">← Danh sách</a><div class="row between mt"><h1 style="margin:0">${esc(D.title)}</h1>${chipLevel(D.level)}</div>
    <div class="card mt"><div class="row between mb"><b>Câu ${cur + 1}/${D.lines.length}</b><span class="small muted">${D.lines.filter((x) => x.done).length} câu đã đúng</span></div>
      <div class="audio-box"><button class="ic" id="d-play" aria-label="Phát">▶</button><div style="flex:1"><b>Nghe và gõ lại</b><div class="small muted">Đã nghe ${plays[cur] || 0} lần · giọng ${l.role === 'F' ? 'nữ' : 'nam'}${hasTTS() ? '' : ' · trình duyệt chưa hỗ trợ đọc tiếng Nhật'}</div></div>
        <select id="d-rate" aria-label="Tốc độ" style="width:auto;min-height:34px;padding:4px 8px"><option value="0.6" ${rate === 0.6 ? 'selected' : ''}>Rất chậm</option><option value="0.8" ${rate === 0.8 ? 'selected' : ''}>Chậm</option><option value="1" ${rate === 1 ? 'selected' : ''}>Bình thường</option><option value="1.2" ${rate === 1.2 ? 'selected' : ''}>Nhanh</option></select></div>
      <label for="d-in">Bạn nghe được gì?</label><textarea id="d-in" class="jp" rows="2" lang="ja" placeholder="Gõ bằng hiragana, katakana hoặc kanji…" style="font-size:1.2rem" ${res ? 'readonly' : ''}>${res ? esc(res.answer) : ''}</textarea>
      ${res ? `<div class="mt"><span class="chip ${res.ok ? 'ok' : res.close ? 'warn' : 'bad'}" style="font-size:.95rem">${res.ok ? '✓ Chính xác' : res.close ? '≈ Gần đúng' : '✗ Chưa đúng'} · ${Math.round(res.ratio * 100)}%</span>
        <div class="jp mt" style="font-size:1.4rem;letter-spacing:.05em">${res.marks.map((m) => `<span style="${m.hit ? 'color:var(--ok)' : 'color:var(--bad);text-decoration:underline wavy'}">${esc(m.c)}</span>`).join('')}</div>
        <div class="small muted">So với ${res.against === 'reading' ? 'cách đọc (kana)' : 'bản chữ'}. Chữ đỏ = chưa khớp.</div>
        <div class="explain"><div class="jp" style="font-size:1.1rem">${esc(res.surface)}</div><div class="muted">${esc(res.reading)}</div><div class="vi mt">${esc(res.vi)}</div></div></div>` : ''}
      <div class="row mt">${res ? `<button id="d-retry">Làm lại câu này</button>${cur < D.lines.length - 1 ? '<button class="primary" id="d-next">Câu tiếp →</button>' : '<a class="btn primary" href="#/chep-chinh-ta">Hoàn thành</a>'}` : `<button class="primary" id="d-check" ${S.user ? '' : 'disabled'}>Kiểm tra</button><button id="d-skip" class="ghost">Bỏ qua</button>${S.user ? '' : '<span class="small muted">Đăng nhập để chấm bài</span>'}`}</div></div>
    <div class="palette mt">${D.lines.map((x, i) => `<button class="pal ${x.done ? 'ok' : ''} ${i === cur ? 'cur' : ''}" data-go="${i}">${i + 1}</button>`).join('')}</div>`);
    const play = () => { plays[cur] = (plays[cur] || 0) + 1; speak([{ speaker: l.role, text: l.tts }], { rate }); const s = $('#d-play'); };
    $('#d-play').onclick = () => { play(); };
    $('#d-rate').onchange = (e) => { rate = Number(e.target.value); };
    $$('[data-go]').forEach((b) => b.onclick = () => { cur = Number(b.dataset.go); draw(); });
    const ck = $('#d-check'); if (ck) ck.onclick = async () => {
      const a = $('#d-in').value; if (!a.trim()) return toast('Hãy gõ những gì bạn nghe được.', true);
      try { const r = await api('POST', '/dictation/check', { lesson_id: Number(id), line: l.i, answer: a }); r.answer = a; if (r.ok || r.close) l.done = true; draw(r); } catch (e) { toast(e.message, true); }
    };
    const rt = $('#d-retry'); if (rt) rt.onclick = () => draw(); const nx = $('#d-next'); if (nx) nx.onclick = () => { cur++; draw(); };
    const sk = $('#d-skip'); if (sk) sk.onclick = () => { if (cur < D.lines.length - 1) { cur++; draw(); } };
    const inp = $('#d-in'); if (inp && !res) inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#d-check')?.click(); } };
  };
  draw();
});

/* ---------- Khóa học theo lộ trình ---------- */
const STEP_ICON = { exam: '📝', lesson: '💬', grammar: '文', dictation: '✎', practice: '🎯', cards: '🗂' };
route(/^\/khoa-hoc$/, async () => {
  const list = await api('GET', '/courses');
  view(`<h1>Khóa học theo lộ trình</h1><p class="muted">Mỗi khóa là một lịch học theo tuần, kết hợp ngữ pháp, bài tình huống, chép chính tả và đề thi. Hệ thống tự đánh dấu bước bạn đã hoàn thành và nhắc bạn khi bị trễ lịch.</p>
  <div class="grid g2">${list.map((c) => `<a class="card" href="#/khoa-hoc/${c.id}"><div class="row between">${chipLevel(c.level)}<span class="chip ${c.enrolled ? 'ok' : ''}">${c.enrolled ? 'Đang học' : c.weeks + ' tuần'}</span></div><h3 class="mt">${esc(c.title)}</h3><div class="small"><b>Mục tiêu:</b> ${esc(c.goal)}</div><p class="small muted">${esc(c.description)}</p>${c.enrolled ? `<div class="bar ok"><i style="width:${Math.round(100 * c.done / c.total)}%"></i></div><div class="small muted">${c.done}/${c.total} bước${c.behind ? ' · <b style="color:var(--bad)">đang trễ lịch</b>' : ''}</div>` : `<div class="small muted">${c.total} bước</div>`}</a>`).join('')}</div>`);
});
route(/^\/khoa-hoc\/(\d+)$/, async (id) => {
  const c = await api('GET', `/courses/${id}`);
  const weeks = {}; c.steps.forEach((s) => (weeks[s.week] ||= []).push(s));
  const pct = Math.round(100 * c.done / c.total);
  view(`<a href="#/khoa-hoc" class="small">← Khóa học</a><div class="row between mt"><h1 style="margin:0">${esc(c.title)}</h1>${chipLevel(c.level)}</div>
  <p class="muted">${esc(c.description)}</p>
  <div class="card"><div class="row between"><div><b>Mục tiêu:</b> ${esc(c.goal)}<div class="small muted">${c.weeks} tuần · ${c.total} bước</div></div>${c.enrolled ? '<button class="sm danger" id="c-out">Thôi học khóa này</button>' : `<button class="accent" id="c-in">${S.user ? 'Bắt đầu khóa học' : 'Đăng nhập để bắt đầu'}</button>`}</div>
    ${c.enrolled ? `<div class="bar ok mt"><i style="width:${pct}%"></i></div><div class="row between small muted"><span>${c.done}/${c.total} bước (${pct}%)</span><span>Ngày thứ ${c.day} · tuần ${c.expectedWeek}/${c.weeks}</span></div>
      ${c.behind ? `<div class="alert bad mt">Bạn đang trễ lịch: bước tiếp theo thuộc tuần ${c.next.week} nhưng hiện đã là tuần ${c.expectedWeek}. Hãy học bù một chút nhé.</div>` : ''}
      ${c.next ? `<div class="alert info mt"><b>Bước tiếp theo:</b> ${esc(c.next.title)} ${c.next.link ? `<a class="btn sm primary" style="margin-left:8px" href="${esc(c.next.link)}">Bắt đầu</a>` : ''}</div>` : '<div class="alert ok mt">🎉 Bạn đã hoàn thành toàn bộ khóa học!</div>'}` : ''}</div>
  ${Object.entries(weeks).map(([w, steps]) => `<h2 class="mt2">Tuần ${w} ${c.enrolled && Number(w) === c.expectedWeek ? '<span class="chip verm">Tuần này</span>' : ''}</h2><div class="card">${steps.map((s) => `<div class="row between" style="padding:9px 0;border-bottom:1px dashed var(--line);flex-wrap:nowrap"><div class="row" style="flex-wrap:nowrap;gap:12px"><span style="width:28px;text-align:center;font-size:1.1rem" aria-hidden="true">${s.done ? '✅' : STEP_ICON[s.type]}</span><div><div style="${s.done ? 'text-decoration:line-through;color:var(--muted)' : 'font-weight:600'}">${esc(s.title)}</div></div></div>${s.link ? `<a class="btn sm ${c.next && c.next.i === s.i ? 'primary' : ''}" href="${esc(s.link)}">${s.done ? 'Xem lại' : 'Mở'}</a>` : ''}</div>`).join('')}</div>`).join('')}`);
  const i = $('#c-in'); if (i) i.onclick = async () => { if (!S.user) return nav('/dang-nhap?next=' + encodeURIComponent(location.hash.slice(1))); await api('POST', `/courses/${id}/enroll`); toast('Đã bắt đầu khóa học!'); render(); };
  const o = $('#c-out'); if (o) o.onclick = async () => { if (await confirmBox('Thôi học khóa này? Tiến độ vẫn được tính nếu bạn đăng ký lại.')) { await api('DELETE', `/courses/${id}/enroll`); render(); } };
});
