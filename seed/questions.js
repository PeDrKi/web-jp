// Câu hỏi mô phỏng TỰ SOẠN (không sao chép đề thi thật). Furigana: {漢字|かんじ}; gạch chân: __chữ__
const Q = (level, section, qtype, stem, options, ans, explanation, tags = {}, extra = {}) =>
  ({ level, section, qtype, stem, options, answer: ans, explanation, tags: { grammar: [], kanji: [], situation: [], ...tags }, ...extra });

const P_N5 = '{田中|たなか}さんは {毎日|まいにち}、{自転車|じてんしゃ}で{会社|かいしゃ}へ{行|い}きます。でも、{今日|きょう}は{雨|あめ}だったので、{電車|でんしゃ}で{行|い}きました。{電車|でんしゃ}は{人|ひと}が{多|おお}くて、{座|すわ}れませんでした。';
const P_N4 = '{来月|らいげつ}から、{会社|かいしゃ}の{近|ちか}くに{引|ひ}っ{越|こ}すことにしました。{今|いま}の{家|いえ}は{会社|かいしゃ}まで{電車|でんしゃ}で{一時間|いちじかん}かかりますが、{新|あたら}しい{家|いえ}からは{歩|ある}いて{十分|じゅっぷん}です。{家賃|やちん}は{少|すこ}し{高|たか}くなりますが、{朝|あさ}ゆっくり{寝|ね}られるので、うれしいです。';
const P_N3 = '{最近|さいきん}、スマートフォンで{本|ほん}を{読|よ}む{人|ひと}が{増|ふ}えている。{便利|べんり}な{点|てん}は、たくさんの{本|ほん}を{持|も}ち{歩|ある}かなくてもいいことだ。{一方|いっぽう}で、{画面|がめん}を{長|なが}い{時間|じかん}{見|み}ると{目|め}が{疲|つか}れると{言|い}う{人|ひと}も{多|おお}い。そこで、{時々|ときどき}{休|やす}んで{遠|とお}くを{見|み}ることをすすめる{専門家|せんもんか}もいる。';

module.exports = {
  N5: [
    Q('N5', 'vocab', 'Cách đọc Kanji', '__毎朝__、六時に おきます。', ['まいあさ', 'まいちょう', 'まいあし', 'めいあさ'], 0, '毎 đọc là まい, 朝 đọc là あさ → まいあさ (mỗi sáng). Các đáp án còn lại ghép sai âm đọc của 朝 hoặc 毎.', { kanji: ['毎', '朝'] }),
    Q('N5', 'vocab', 'Cách đọc Kanji', '__図書館__で 本を かります。', ['としょかん', 'とうしょかん', 'としょうかん', 'どしょかん'], 0, '図書館 = としょかん (thư viện). Chú ý 図 đọc ngắn là と, không kéo dài thành とう.', { kanji: ['図', '書', '館'] }),
    Q('N5', 'vocab', 'Cách đọc Kanji', '__来週__、友だちと 会います。', ['らいしゅう', 'らいしゅ', 'ないしゅう', 'らいじゅう'], 0, '来週 = らいしゅう (tuần sau). 週 đọc là しゅう (trường âm), không phải しゅ hay じゅう.', { kanji: ['来', '週'] }),
    Q('N5', 'vocab', 'Cách đọc Kanji', '__電車__で 会社へ 行きます。', ['でんしゃ', 'てんしゃ', 'でんじゃ', 'でんしゅ'], 0, '電車 = でんしゃ (tàu điện). 電 là でん có dấu đục, 車 là しゃ.', { kanji: ['電', '車'] }),
    Q('N5', 'vocab', 'Chọn từ phù hợp', '{喉|のど}が かわいたので、____を のみたいです。', ['みず', 'くるま', 'つくえ', 'ほん'], 0, 'Khát nước nên muốn uống → みず (nước). Các từ còn lại (xe, bàn, sách) không thể "uống" (のむ).', { kanji: ['水'] }),
    Q('N5', 'vocab', 'Chọn từ phù hợp', 'この かばんは とても ____ ので、ひとりで もてます。', ['かるい', 'あつい', 'ふるい', 'ながい'], 0, 'Một mình cầm được vì túi rất nhẹ → かるい. あつい (dày/nóng), ふるい (cũ), ながい (dài) không giải thích được vì sao cầm một mình được.'),
    Q('N5', 'grammar', 'Trợ từ', 'わたしは まいにち バス____ 学校へ 行きます。', ['で', 'を', 'に', 'が'], 0, 'Trợ từ で chỉ phương tiện: バスで (bằng xe buýt). を dùng cho tân ngữ, に cho đích/thời điểm, が cho chủ ngữ.', { grammar: ['で(手段)'], situation: ['siêu thị', 'tàu điện'] }),
    Q('N5', 'grammar', 'Hội thoại', 'A：「あした、いっしょに えいがを 見ませんか。」\nB：「ええ、____。」', ['見ましょう', '見ません', '見ました', '見て います'], 0, 'A rủ rê (〜ませんか), B đồng ý (ええ) → đáp lại bằng 〜ましょう (nào cùng xem). 見ません là từ chối nên mâu thuẫn với ええ.', { grammar: ['ましょう'] }),
    Q('N5', 'grammar', 'Trợ từ', 'この へやには つくえ____ いすが あります。', ['と', 'を', 'へ', 'で'], 0, 'と dùng để liệt kê danh từ: つくえと いす (bàn và ghế).', { grammar: ['と(liệt kê)'] }),
    Q('N5', 'grammar', 'Trợ từ', 'きのうは あめ____ ふりました。', ['が', 'を', 'に', 'へ'], 0, 'Với hiện tượng thời tiết, danh từ làm chủ ngữ đi với が: あめが ふる (trời mưa).', { grammar: ['が(chủ ngữ)'] }),
    Q('N5', 'grammar', 'Phủ định danh từ', '田中さんは 先生____ ありません。', ['じゃ', 'が', 'を', 'に'], 0, 'Phủ định của danh từ: Nじゃ ありません (không phải là N).', { grammar: ['じゃありません'] }),
    Q('N5', 'grammar', 'Dạng て', 'すみません、もう すこし ゆっくり ____ ください。', ['はなして', 'はなす', 'はなした', 'はなさない'], 0, 'Nhờ vả: động từ dạng て + ください. はなす → はなして.', { grammar: ['てください'], situation: ['siêu thị', 'ngân hàng'] }),
    Q('N5', 'grammar', 'Mẫu câu', 'わたしは ねる ____ に、はを みがきます。', ['まえ', 'あと', 'うしろ', 'ところ'], 0, 'Vる + まえに: trước khi làm gì. あと cần động từ dạng た (ねた あとで), nên không đi với ねる.', { grammar: ['まえに'] }),
    Q('N5', 'reading', 'Đọc hiểu ngắn', '田中さんは 今日、何で 会社へ 行きましたか。', ['でんしゃ', 'じてんしゃ', 'バス', 'あるいて'], 0, 'Bài viết nói: 今日は雨だったので、電車で行きました (hôm nay mưa nên đi bằng tàu điện). Bình thường anh ấy đi xe đạp (じてんしゃ) nhưng hôm nay thì không.', { kanji: ['電', '車', '雨'] }, { passage: P_N5 }),
    Q('N5', 'reading', 'Đọc hiểu ngắn', '電車は どうでしたか。', ['ひとが おおくて、すわれなかった', 'ひとが すくなくて、すわれた', 'とても はやかった', 'おくれて、こまった'], 0, 'Bài viết: 人が多くて、座れませんでした (đông người nên không ngồi được).', { kanji: ['人', '多'] }, { passage: P_N5 }),
    Q('N5', 'listening', 'Nghe số lượng', 'バナナを いくつ 買いますか。', ['一本', '二本', '三本', '買いません'], 0, 'Người nam đổi ý: バナナは 一本で いいです → mua 1 quả chuối. Chú ý phải nghe đến hết đoạn hội thoại.', { situation: ['siêu thị'] }, {
      audio_script: [{ speaker: 'M', text: 'すみません、りんごを みっつと、バナナを にほん ください。' }, { speaker: 'F', text: 'はい、りんご みっつと、バナナ にほんですね。' }, { speaker: 'M', text: 'あ、やっぱり、バナナは いっぽんで いいです。' }] }),
    Q('N5', 'listening', 'Nghe giờ giấc', '二人は 何時に あいますか。', ['十一時', '十時', '十二時', '九時'], 0, 'Giờ 10 không được (ちょっと…), người nam nói 11 giờ thì được, người nữ chốt: 十一時に えきの まえで あいましょう.', {}, {
      audio_script: [{ speaker: 'M', text: 'あした、なんじに あいましょうか。' }, { speaker: 'F', text: 'じゅうじは どうですか。' }, { speaker: 'M', text: 'すみません、じゅうじは ちょっと…。じゅういちじなら だいじょうぶです。' }, { speaker: 'F', text: 'じゃあ、じゅういちじに、えきの まえで あいましょう。' }] }),
  ],

  N4: [
    Q('N4', 'vocab', 'Cách đọc Kanji', 'この くすりは とても __苦い__です。', ['にがい', 'くるい', 'にげい', 'くさい'], 0, '苦い = にがい (đắng). 苦 còn có âm く trong 苦しい (くるしい) nên dễ nhầm với くるい.', { kanji: ['苦'] }),
    Q('N4', 'vocab', 'Cách đọc Kanji', 'この __荷物__を 二階に はこんで ください。', ['にもつ', 'かもつ', 'にぶつ', 'かぶつ'], 0, '荷物 = にもつ (hành lý). 貨物 mới là かもつ (hàng hóa vận chuyển).', { kanji: ['荷', '物'] }),
    Q('N4', 'vocab', 'Cách đọc Kanji', '__準備__は できましたか。', ['じゅんび', 'じゅうび', 'じゅんひ', 'しゅんび'], 0, '準備 = じゅんび (chuẩn bị). Cả hai âm đều có dấu đục / ん.', { kanji: ['準', '備'] }),
    Q('N4', 'vocab', 'Chọn từ phù hợp', 'かぜを ひいたので、びょういんで ____を もらいました。', ['くすり', 'せき', 'てがみ', 'ねだん'], 0, 'Bị cảm → nhận thuốc ở bệnh viện: くすり. せき (ho/chỗ ngồi), てがみ (thư), ねだん (giá) không hợp nghĩa.', { situation: ['bệnh viện'] }),
    Q('N4', 'grammar', 'Kính ngữ - cho nhận', '先生に 日本語の 本を 貸して ____。', ['いただきました', 'あげました', 'くれました', 'くださいました'], 0, '"Được thầy cho mượn" - người nhận là mình, chủ ngữ là 私, dùng 〜ていただく (khiêm nhường). くださいました cần chủ ngữ là 先生が (先生に không đi với くださる).', { grammar: ['ていただく'], situation: ['bệnh viện'] }),
    Q('N4', 'grammar', 'Dạng そうです', '雨が ____ そうですね。かさを もって いきましょう。', ['ふり', 'ふる', 'ふった', 'ふって'], 0, 'そうです (có vẻ sắp) đi với thân động từ (bỏ ます): ふる → ふり + そう.', { grammar: ['そうです(様態)'] }),
    Q('N4', 'grammar', 'Điều kiện と', 'この 道を まっすぐ 行く____、右に 銀行が あります。', ['と', 'でも', 'ばかり', 'ほど'], 0, 'Vる + と: hễ làm A thì thấy/xảy ra B (hướng dẫn đường). でも, ばかり, ほど không tạo thành quan hệ điều kiện này.', { grammar: ['と(条件)'], situation: ['ngân hàng'] }),
    Q('N4', 'grammar', 'Kinh nghiệm', 'わたしは 北海道へ 行った____が あります。', ['こと', 'もの', 'ところ', 'はず'], 0, 'Vた + ことが あります: đã từng làm gì (kinh nghiệm).', { grammar: ['ことがある'], situation: ['bệnh viện'] }),
    Q('N4', 'grammar', 'Mục đích', 'しけんに ____ ように、まいにち べんきょうして います。', ['うかる', 'うかった', 'うかります', 'うかって'], 0, 'Vる + ように: để (đạt được trạng thái) ... Dùng thể từ điển, không dùng thể lịch sự ます hay quá khứ.', { grammar: ['ように'] }),
    Q('N4', 'reading', 'Đọc hiểu', '新しい 家に ついて、正しいのは どれですか。', ['会社まで 歩いて 十分', '会社まで 電車で 一時間', '今の 家より 家賃が 安い', '会社から とても 遠い'], 0, 'Bài viết: 新しい家からは歩いて十分. 一時間は nhà HIỆN TẠI; tiền nhà thì 少し高くなります (đắt hơn).', { kanji: ['家', '歩', '会', '社'] }, { passage: P_N4 }),
    Q('N4', 'reading', 'Đọc hiểu', '「うれしい」と 言った 理由は 何ですか。', ['朝 ゆっくり 寝られるから', '家賃が 安く なるから', '電車に 乗れるから', '新しい 友だちが できるから'], 0, 'Lý do được nêu rõ: 朝ゆっくり寝られるので、うれしいです.', {}, { passage: P_N4 }),
    Q('N4', 'listening', 'Nghe hội thoại công việc', 'ミーティングは 何時から ですか。', ['四時', '三時', '五時', '二時'], 0, 'Ban đầu là 3 giờ nhưng đã đổi sang 4 giờ vì trưởng phòng đi công tác (四時からに なりました).', { situation: ['công ty'] }, {
      audio_script: [{ speaker: 'F', text: 'きょうの ミーティング、さんじからでしたよね。' }, { speaker: 'M', text: 'あ、すみません。ぶちょうが しゅっちょうで、よじからに なりました。' }, { speaker: 'F', text: 'そうですか。じゃあ、かいぎしつは よじから よやくしますね。' }] }),
  ],

  N3: [
    Q('N3', 'vocab', 'Cách đọc Kanji', '彼は 約束を __守る__ 人です。', ['まもる', 'まぼる', 'たもる', 'ふせる'], 0, '守る = まもる (giữ lời, bảo vệ). ふせる (防ぐ: ngăn ngừa) và たもつ (保つ: duy trì) là các từ khác.', { kanji: ['守'] }),
    Q('N3', 'vocab', 'Cách đọc Kanji', 'この 仕事は __経験__が なくても できます。', ['けいけん', 'きょうけん', 'けいげん', 'けえけん'], 0, '経験 = けいけん (kinh nghiệm). Cả hai chữ đều đọc ngắn, không có dấu đục.', { kanji: ['経', '験'] }),
    Q('N3', 'vocab', 'Từ vựng - tự/tha động từ', '外国人の 観光客が __増えて__ います。', ['ふえて', 'ふやして', 'まして', 'ぞうえて'], 0, '増える (ふえる) là tự động từ: tự tăng lên. 増やす (ふやす) là tha động từ: làm cho tăng (cần tân ngữ).', { kanji: ['増'] }),
    Q('N3', 'vocab', 'Chọn từ phù hợp', '電車が ____ 遅れて いるので、会議に 間に合わないかもしれません。', ['かなり', 'ぜひ', 'まるで', 'ちっとも'], 0, 'かなり (khá/đáng kể) bổ nghĩa cho 遅れる. ぜひ dùng với mong muốn, まるで với "cứ như là", ちっとも đi với phủ định.', { situation: ['tàu điện', 'công ty'] }),
    Q('N3', 'grammar', 'Nghịch tiếp', '彼は 病気____、毎日 会社に 来て います。', ['なのに', 'なので', 'だったら', 'ですから'], 0, 'Dù đang bệnh mà vẫn đi làm: nghịch tiếp → なのに. なので/ですから là thuận tiếp (vì...nên).', { grammar: ['なのに'] }),
    Q('N3', 'grammar', 'Nhượng bộ', '先生に 注意され____、彼は 遅刻を やめなかった。', ['ても', 'ので', 'たら', 'ために'], 0, 'Dù bị nhắc nhở vẫn không bỏ → Vても (dù có ... cũng ...). Các đáp án khác thể hiện lý do/điều kiện nên mâu thuẫn với やめなかった.', { grammar: ['ても'], situation: ['công ty'] }),
    Q('N3', 'grammar', 'Đối tượng hướng đến', 'この 本は 子ども____ 書かれた ものですが、大人にも おもしろいです。', ['向けに', 'ついでに', 'わりに', 'ばかりに'], 0, 'Nむけに: dành cho đối tượng N (viết dành cho trẻ em). Các mẫu còn lại không tạo thành nghĩa hợp lý.', { grammar: ['向けに'], situation: ['văn phòng hành chính'] }),
    Q('N3', 'grammar', 'Suy đoán chắc chắn', '田中さんは 来る____なのに、まだ 来ません。', ['はず', 'ため', 'ほう', 'うち'], 0, 'Vるはずです: lẽ ra phải (đến) - nói về điều mình tin chắc; ở đây thực tế trái với dự đoán.', { grammar: ['はず'], situation: ['công ty'] }),
    Q('N3', 'grammar', 'Bổ sung', 'この 店は 安い____、味も いいので、人気が あります。', ['うえに', 'あいだに', 'かわりに', 'ために'], 0, 'A うえに B: không những A mà còn B. "安い" và "味もいい" đều là điểm cộng nên dùng うえに.', { grammar: ['うえに'], situation: ['văn phòng hành chính'] }),
    Q('N3', 'reading', 'Đọc hiểu', '便利な 点は 何ですか。', ['たくさんの 本を 持ち歩かなくても いい こと', '目が 疲れない こと', '本が 安く 買える こと', '遠くが よく 見える こと'], 0, 'Bài viết: たくさんの本を持ち歩かなくてもいいことだ. 目が疲れる là điểm bất lợi.', { kanji: ['便', '利', '持'] }, { passage: P_N3 }),
    Q('N3', 'reading', 'Đọc hiểu', '専門家は 何を すすめて いますか。', ['時々 休んで 遠くを 見る こと', '本を 読まない こと', '画面を 小さく する こと', '夜だけ 読む こと'], 0, 'Câu cuối: 時々休んで遠くを見ることをすすめる専門家もいる.', { kanji: ['専', '門', '遠'] }, { passage: P_N3 }),
    Q('N3', 'listening', 'Nghe so sánh', '二人は 何で 出張に 行きますか。', ['飛行機', '新幹線', '車', 'バス'], 0, 'Shinkansen rẻ hơn nhưng mất 3 giờ, máy bay đắt nhưng 1 giờ. Kết luận: 今回は時間がないから、飛行機にしよう.', { situation: ['công ty'] }, {
      audio_script: [{ speaker: 'M', text: 'らいしゅうの しゅっちょう、しんかんせんで いく？ひこうきで いく？' }, { speaker: 'F', text: 'しんかんせんの ほうが やすいけど、さんじかんも かかるんだよね。' }, { speaker: 'M', text: 'ひこうきは たかいけど、いちじかんで つくよ。' }, { speaker: 'F', text: 'こんかいは じかんが ないから、ひこうきに しよう。' }] }),
  ],
};
