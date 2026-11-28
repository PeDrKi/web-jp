// Tải đề từ file PDF / Word / TXT: lấy chữ trong file rồi tách thành từng câu theo cách trình bày thông dụng
// (câu đánh số "1." / "Câu 1:", phương án "A. B. C. D.", nhóm "問題 1" / "第1部", đoạn văn "【…】", phần "ĐÁP ÁN" ở cuối).
// Không dùng AI: kết quả là bản nháp để giảng viên xem lại, đánh đáp án rồi mới tạo đề.
'use strict';

// Chữ bộ thủ (CJK Radicals Supplement) mà PDF hay dùng thay chữ Hán thường; NFKC không đổi các chữ này
const RADICALS = { '⺠': '民', '⻑': '長', '⻄': '西', '⻘': '青', '⻝': '食', '⻤': '鬼', '⻩': '黄', '⺟': '母', '⻭': '歯', '⻨': '麦', '⻲': '亀', '⻆': '角', '⻁': '虎', '⺬': '示', '⻖': '阝', '⺅': '亻' };
const CIRCLED = { '①': 'A.', '②': 'B.', '③': 'C.', '④': 'D.', '⑤': 'E.', '⑥': 'F.' };

async function extractText(buf, filename = '') {
  const name = filename.toLowerCase();
  const isPdf = buf.subarray(0, 5).toString('latin1') === '%PDF-';
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (isPdf) {
    const { extractText: pdfText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfText(pdf, { mergePages: false });
    return { text: text.join('\n'), pages: text.length, type: 'pdf' };
  }
  if (isZip || name.endsWith('.docx')) {
    const mammoth = require('mammoth');
    const r = await mammoth.extractRawText({ buffer: buf });
    return { text: r.value, type: 'docx' };
  }
  if (name.endsWith('.doc')) throw new Error('File .doc (Word 97-2003) chưa hỗ trợ. Hãy mở bằng Word và Lưu thành .docx hoặc PDF.');
  return { text: buf.toString('utf8'), type: 'txt' };
}

function cleanLines(text) {
  let t = String(text || '').replace(/[①-⑥]/g, (c) => CIRCLED[c] + ' ').normalize('NFKC');
  t = t.replace(/[⺀-⻳]/g, (c) => RADICALS[c] || c).replace(/\r/g, '').replace(/　/g, ' ').replace(/\t/g, ' ');
  return t.split('\n').map((l) => l.replace(/ {2,}/g, ' ').trim())
    .filter((l) => l && !/^[_\-−‐ー.…\s|]+$/.test(l) && !/^(Trang|Page)\s*\d+(\s*\/\s*\d+)?$/i.test(l) && !/^-\s*\d+\s*-$/.test(l));
}

const ITEM = /^(テーマ|・|[-•*]|\(?\d+[.)）]|[A-F][.)）]|Đề\s*\d|Chủ đề)/;
const CJK = /[぀-ヿ㐀-鿿＀-￯、。]/;
const join = (a, b) => (!a ? b : CJK.test(a.slice(-1)) && CJK.test(b[0]) ? a + b : a + ' ' + b);

const PART = /^(第\s*[0-9一二三四五六七八九十]+\s*部|PHẦN\s+[IVX0-9]+\b|Phần\s+[IVX0-9]+\b|PART\s+[IVX0-9]+\b)[.:：]?\s*(.*)$/i;
const SECTION = /^(問題\s*[0-9]+|もんだい\s*[0-9]+|Mondai\s*[0-9]+)[.:：]?\s*(.*)$/i;
const QUESTION = /^(?:Câu|Question|Q)?\s*(\d{1,3})\s*[.．:：)）、]\s*(.*)$/i;
const BLANK = /^(解答欄|訂正|読み|答え|回答|Bản dịch|Trả lời|Đáp án của em|Answer)\s*[:：]?\s*[_\-−ー.…\s]*$/i;
const KEY_HEAD = /^(ĐÁP ÁN|Đáp án|ĐÁP ÁN THAM KHẢO|解答|正解|答え|模範解答|ANSWER KEY|ANSWERS)\b[\s:：]*.*$/i;
const OPT_DOT = /(?:^|\s)([A-F])\s*[.．)）:：]\s*/g;

// Tách dòng phương án: "A. x B. y C. z D. w" hoặc "A x B y C z D w" (dạng sắp xếp)
function splitOptions(line) {
  const dot = [...line.matchAll(OPT_DOT)];
  const seq = (ms) => ms.length >= 1 && ms.every((m, i) => m[1] === 'ABCDEF'[i]);
  if (dot.length && dot[0].index === 0 && seq(dot)) {
    return dot.map((m, i) => line.slice(m.index + m[0].length, i + 1 < dot.length ? dot[i + 1].index : undefined).trim());
  }
  if (/^A\s+\S/.test(line)) {
    const sp = [...line.matchAll(/(?:^|\s)([A-F])\s+(?=\S)/g)];
    if (sp.length >= 2 && seq(sp)) return sp.map((m, i) => line.slice(m.index + m[0].length, i + 1 < sp.length ? sp[i + 1].index : undefined).trim());
  }
  return null;
}
// Dòng câu hỏi có lẫn phương án phía sau: "81. A. … B. …" hoặc "1. 文… A. x B. y"
function splitStemOptions(rest) {
  const m = rest.match(/(^|\s)A\s*[.．)）]\s*/);
  if (!m) return [rest, null];
  const opts = splitOptions(rest.slice(m.index).trim());
  return opts && opts.length >= 2 ? [rest.slice(0, m.index).trim(), opts] : [rest, null];
}

function guessSection(text) {
  const t = text || '';
  if (/聴解|聞いて|Nghe/i.test(t)) return 'listening';
  if (/漢字|読み方|ひらがなで|言葉|語彙|từ vựng|chữ Hán|kanji/i.test(t)) return 'vocab';
  if (/文章を読んで|読解|Đọc hiểu|đọc đoạn|đọc văn bản/i.test(t)) return 'reading';
  if (/訳しなさい|作文|dịch|viết đoạn|viết bài/i.test(t)) return 'writing';
  return 'grammar';
}
const isTrueFalse = (t) => /[○〇◯]/.test(t || '') && /[×✕xX]/.test(t || '') || /Đúng\s*\/\s*Sai|True\s*\/\s*False/i.test(t || '');
const isReorder = (t) => /並べ替え|並べかえ|sắp xếp|ならべ/i.test(t || '');
// Dạng tự luận theo yêu cầu đề; bài văn lấy giới hạn chữ từ "400〜500字"
function etypeOf(t, reorder) {
  t = String(t || '');
  if (reorder) return 'short';
  if (/作文|viết (bài|đoạn) văn/i.test(t)) return 'composition';
  if (/ベトナム語に訳|日越|sang tiếng Việt/i.test(t)) return 'ja_vi';
  if (/日本語に訳|越日|sang tiếng Nhật/i.test(t)) return 'vi_ja';
  if (/訂正|誤り|間違|lỗi sai|sửa lỗi/i.test(t)) return 'fix';
  if (/読み|ひらがなで/i.test(t)) return 'short';
  return '';
}
const lenOf = (t) => { const m = String(t || '').match(/(\d{2,4})\s*字/g); return m ? Math.max(...m.map((x) => parseInt(x, 10))) : 0; };
const pointsOf = (t) => { const m = String(t || '').match(/各?\s*(\d{1,3})\s*(点|điểm)/i); return m ? Math.min(100, Number(m[1])) : null; };

function parseExam(text) {
  let lines = cleanLines(text);
  // Phần đáp án ở cuối file
  let keyText = '';
  const ki = lines.findIndex((l, i) => i > 5 && KEY_HEAD.test(l));
  if (ki > 0) { keyText = lines.slice(ki).join(' '); lines = lines.slice(0, ki); }

  const out = { title: '', minutes: null, level: null, sections: [], warnings: [] };
  const head = [];
  let part = null, sec = null, q = null, passage = null, last = null, lastNo = 0;
  const newSec = (name, instruction) => {
    sec = { name, part: part?.name || '', instruction: instruction || '', questions: [], passages: [], pts: null };
    out.sections.push(sec); passage = null; q = null; last = 'section';
  };
  const ensureSec = () => { if (!sec) newSec(part ? part.name : 'Toàn bài', part?.instruction || ''); };
  const newQ = (no, stem, opts, guessed) => {
    ensureSec();
    q = { no, stem: stem || '', options: opts || [], blank: false, passage, guessed: !!guessed };
    sec.questions.push(q); lastNo = no; last = opts && opts.length ? 'options' : 'question';
  };
  // Đoạn văn / đề bài không đánh số (đoạn dịch, 作文): thành một câu tự luận
  const flushLoose = () => {
    if (!sec) return;
    for (const p of sec.passages) if (!p.used && p.blank) { sec.questions.push({ no: null, stem: '', options: [], blank: true, passage: p, loose: true }); p.used = true; }
  };

  for (const line of lines) {
    let m;
    if ((m = line.match(PART))) {
      flushLoose(); part = { name: line, instruction: '' }; sec = null; q = null; passage = null; last = 'part'; continue;
    }
    if ((m = line.match(SECTION))) { flushLoose(); newSec(line, m[2]); continue; }
    if (BLANK.test(line)) {
      if (q && last !== 'passage') q.blank = true; else if (passage) passage.blank = true;
      last = 'blank'; continue;
    }
    if (/^【.*】$/.test(line) || /^【[^】]+】\s*$/.test(line)) {
      ensureSec(); passage = { title: line, text: '', used: false, blank: false }; sec.passages.push(passage); q = null; last = 'passage'; continue;
    }
    if ((m = line.match(QUESTION))) {
      const no = Number(m[1]);
      const plausible = !lastNo || no === 1 || (no > lastNo && no <= lastNo + 3);
      if (plausible && (sec || part || no <= 3)) {
        const [stem, opts] = splitStemOptions(m[2]);
        if (no > lastNo + 1 && lastNo) out.warnings.push(`Không thấy câu ${lastNo + 1}${no > lastNo + 2 ? `–${no - 1}` : ''} (bản in có thể thiếu số).`);
        newQ(no, stem, opts); continue;
      }
    }
    const opts = splitOptions(line);
    if (opts && (opts.length >= 2 || (last === 'question' && opts[0])) && q && !q.options.length) { q.options = opts; last = 'options'; continue; }   // một phương án mỗi dòng: dòng 'A.' mở đầu
    // dòng chữ thường
    if (!sec && !part) { head.push(line); continue; }
    if (!sec && part) {   // chữ ngay sau "第4部 作文": đề bài của phần
      part.instruction = join(part.instruction, line); newSec(part.name, part.instruction); sec.instruction = part.instruction; sec.loose = true; continue;
    }
    if (sec.loose && !sec.questions.length && last !== 'passage') { sec.instruction = ITEM.test(line) ? sec.instruction + '\n' + line : join(sec.instruction, line); continue; }
    if (last === 'options' && q && q.options.length < 6) {   // phương án bị xuống dòng: "…なく" / "なった D …"
      const L = 'ABCDEF'[q.options.length], cm = line.match(new RegExp(`(?:^|\\s)${L}\\s*[.．)）]?\\s+`));
      if (cm) {
        const more = splitOptions(line.slice(cm.index).trim().replace(new RegExp(`^${L}`), 'A')) || [line.slice(cm.index + cm[0].length).trim()];
        if (cm.index > 0) q.options[q.options.length - 1] = join(q.options[q.options.length - 1], line.slice(0, cm.index).trim());
        q.options.push(...more); continue;
      }
    }
    if (last === 'options' && q && line.length <= 24) { q.options[q.options.length - 1] = join(q.options[q.options.length - 1], line); continue; }
    if (last === 'blank' && q && !passage?.blank) {   // câu bị thiếu số trên bản in (vd. sau "訂正:" là câu mới)
      out.warnings.push(`Câu ${lastNo + 1} không có số trên bản in, đã tự đánh số.`); newQ(lastNo + 1, line, null, true); continue;
    }
    if (last === 'passage' || (passage && !q)) { passage.text = passage.text ? join(passage.text, line) : line; last = 'passage'; continue; }
    if (q && last === 'question') { q.stem = join(q.stem, line); continue; }
    if (q && (last === 'options' || last === 'blank')) {   // đoạn văn không có tiêu đề nằm sau câu trước
      passage = { title: '', text: line, used: false, blank: false }; sec.passages.push(passage); q = null; last = 'passage'; continue;
    }
    if (last === 'section') { sec.instruction = join(sec.instruction, line); continue; }
    ensureSec(); passage = { title: '', text: line, used: false, blank: false }; sec.passages.push(passage); last = 'passage';
  }
  flushLoose();
  // Phần chỉ có đề bài (作文) mà không có câu đánh số
  for (const s of out.sections) if (!s.questions.length && s.instruction.trim()) s.questions.push({ no: null, stem: '', options: [], blank: true, passage: null, loose: true, essayOnly: true });

  // Tiêu đề, thời gian, cấp độ
  out.title = (head[0] || '').slice(0, 150);
  const hm = head.join(' ').match(/(\d{2,3})\s*(phút|分)/i); if (hm) out.minutes = Number(hm[1]);
  const lv = head.join(' ').match(/\bN([1-5])\b/); if (lv) out.level = 'N' + lv[1];

  // Chuẩn hóa từng câu
  let auto = 1;
  for (const s of out.sections) {
    const ctx = `${s.part} ${s.name} ${s.instruction}`;
    const section = guessSection(`${s.name} ${s.instruction}`) === 'grammar' ? guessSection(ctx) : guessSection(`${s.name} ${s.instruction}`);
    const tf = isTrueFalse(s.instruction), reorder = isReorder(s.instruction), pts = pointsOf(s.instruction) || pointsOf(s.part);
    const instr = s.instruction.replace(/\(\s*\d+[^()]*?(問|câu|điểm|点|段落|題|bài)\s*\)\s*$/i, '').trim();
    s.questions = s.questions.map((x) => {
      // câu điền chỗ trống trong đoạn văn: tìm đoạn có "(số câu)"
      let p = x.passage;
      if (x.no && s.passages.length > 1) { const hit = s.passages.find((pp) => pp.text.includes(`(${x.no})`)); if (hit) p = hit; }
      const passageText = p ? [p.title, p.text].filter(Boolean).join('\n') : '';
      let stem = x.stem.trim(), options = x.options, kind = 'mcq', answer = -1, note = '';
      if (x.loose) {
        kind = 'essay'; stem = x.essayOnly ? instr : instr || 'Làm theo yêu cầu của đề.';
      } else {
        if (!stem && options.length) stem = `(${x.no})`;
        if (options.length >= 2 && (x.blank || reorder)) {   // câu sắp xếp: phương án in kèm, học viên gõ thứ tự
          stem = `${stem}\n${options.map((o, i) => `${'ABCDEF'[i]} ${o}`).join('　')}`; options = []; kind = 'essay';
          if (reorder) note = 'Nhập thứ tự các chữ cái, ví dụ: BADC';
        } else if (options.length >= 2) kind = 'mcq';
        else if (tf) { kind = 'mcq'; options = ['○', '×']; }
        else kind = 'essay';
        if (instr) stem = `${instr}\n${stem}`;
        if (note) stem += `\n（${note}）`;
      }
      const qq = { no: x.no ?? null, label: x.no ? String(x.no) : `Tự luận ${auto++}`, kind, section: x.essayOnly || x.loose ? (guessSection(ctx) === 'grammar' ? 'writing' : guessSection(ctx)) : section,
        stem, passage: passageText, options, answer, explanation: '', model_answer: '', accepted: '', points: pts && kind === 'essay' ? pts : 1, guessed: x.guessed };
      if (kind === 'essay') { qq.etype = etypeOf(ctx, reorder) || etypeOf(stem); qq.max_len = qq.etype === 'composition' ? lenOf(`${ctx} ${stem}`) : 0; }
      return qq;
    });
  }
  out.sections = out.sections.filter((s) => s.questions.length).map((s) => ({ name: s.name.slice(0, 80), part: s.part, questions: s.questions }));
  const n = out.sections.reduce((a, s) => a + s.questions.length, 0);
  if (keyText) { const k = applyKey(out, keyText); out.key_applied = k; }
  out.count = n;
  return out;
}

// Bảng đáp án: "1.C 2.B 3-A", "41 DBAC", "96 つづけて", "111 ○" ... (số theo bản in)
function parseKey(text) {
  const map = new Map();
  const t = String(text || '').normalize('NFKC').replace(KEY_HEAD, ' ');
  for (const m of t.matchAll(/(?:^|[\s,;、|])(?:Câu\s*)?(\d{1,3})\s*[.:：\-)）=]?\s*([^\s,;、|]+)/gi)) {
    const v = m[2].replace(/[.。]$/, '');
    if (v) map.set(Number(m[1]), v);
  }
  return map;
}
function applyKey(doc, text) {
  const key = parseKey(text); let n = 0;
  for (const s of doc.sections) for (const q of s.questions) {
    if (q.no == null || !key.has(q.no)) continue;
    const v = key.get(q.no);
    if (q.kind === 'mcq') {
      let i = -1;
      if (/^[A-Fa-f]$/.test(v)) i = 'ABCDEF'.indexOf(v.toUpperCase());
      else if (/^[1-6]$/.test(v) && q.options.length > 2) i = Number(v) - 1;
      else if (/^([○〇◯oOĐđTt]|Đúng|true)$/i.test(v)) i = 0;
      else if (/^([×✕xXSsFf]|Sai|false)$/i.test(v)) i = 1;
      if (i >= 0 && i < q.options.length) { q.answer = i; n++; }
    } else { q.accepted = v.replace(/[-−]/g, ''); q.model_answer = q.model_answer || v; n++; }
  }
  return n;
}
module.exports = { extractText, parseExam, parseKey, applyKey, cleanLines };
