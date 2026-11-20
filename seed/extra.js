// Nội dung mở rộng (tự soạn): N5/N4/N3 đề 02, N2 đề 01, JFT-Basic đề 01, thêm 5 bài đời sống.
const Q = (level, section, qtype, stem, options, ans, explanation, tags = {}, extra = {}) =>
  ({ level, section, qtype, stem, options, answer: ans, explanation, tags: { grammar: [], kanji: [], situation: [], ...tags }, ...extra });
const L = (role, speaker, ja, vi, register) => ({ role, speaker, ja, vi, register });

const P_N5b = '{私|わたし}は{毎朝|まいあさ}、{公園|こうえん}を{走|はし}ります。{朝|あさ}ごはんの{前|まえ}に{三十分|さんじゅっぷん}ぐらい{走|はし}ります。{走|はし}ったあとは、{冷|つめ}たい{水|みず}を{飲|の}みます。';
const P_N4b = '{先週|せんしゅう}、{友|とも}だちと{山|やま}へ{行|い}きました。{朝|あさ}は{天気|てんき}がよかったのに、{昼|ひる}から{雨|あめ}が{降|ふ}り{始|はじ}めました。かさを{持|も}って{行|い}かなかったので、びしょぬれになってしまいました。{帰|かえ}ってすぐにおふろに{入|はい}りました。';
const P_N3b = '{先月|せんげつ}、{駅|えき}の{近|ちか}くに{新|あたら}しい{図書館|としょかん}ができた。{平日|へいじつ}は{夜|よる}九{時|じ}まで{開|あ}いているので、{仕事|しごと}の{帰|かえ}りに{寄|よ}れる。また、{子|こ}どもが{遊|あそ}べるスペースもあり、{家族|かぞく}で{来|く}る{人|ひと}が{多|おお}い。ただし、{土曜日|どようび}は{混|こ}むので、{静|しず}かに{本|ほん}を{読|よ}みたい{人|ひと}には{平日|へいじつ}の{利用|りよう}をすすめる。';
const P_N2 = '{最近|さいきん}、{在宅勤務|ざいたくきんむ}を{導入|どうにゅう}する{企業|きぎょう}が{増|ふ}えている。{通勤|つうきん}の{時間|じかん}が{減|へ}り、{家族|かぞく}と{過|す}ごす{時間|じかん}が{増|ふ}えたと{喜|よろこ}ぶ{声|こえ}がある{一方|いっぽう}、{同僚|どうりょう}との{会話|かいわ}が{減|へ}って{孤独|こどく}を{感|かん}じる{人|ひと}も{少|すく}なくない。そのため、{週|しゅう}に{数日|すうじつ}だけ{出社|しゅっしゃ}する{方式|ほうしき}を{選|えら}ぶ{会社|かいしゃ}も{出|で}てきた。';
const P_JFT = 'ごみの{出|だ}し{方|かた}\n\n・{燃|も}えるごみ：{月曜日|げつようび}と{木曜日|もくようび}　{朝|あさ}8{時|じ}まで\n・プラスチック：{水曜日|すいようび}　{朝|あさ}8{時|じ}まで\n・びん・かん：{第|だい}2・{第|だい}4{土曜日|どようび}　{朝|あさ}8{時|じ}まで\n\n{決|き}められた{日|ひ}と{時間|じかん}を{守|まも}ってください。';

const questions = {
  'N5-2': [
    Q('N5', 'vocab', 'Cách đọc Kanji', '__土曜日__に 買い物に 行きます。', ['どようび', 'とようび', 'どよび', 'どようひ'], 0, '土 đọc là ど trong 土曜日 (どようび, thứ Bảy).', { kanji: ['土', '曜', '日'] }),
    Q('N5', 'vocab', 'Cách đọc Kanji', '__大きい__ 犬が います。', ['おおきい', 'だいきい', 'おおいい', 'たいきい'], 0, '大きい = おおきい (to). 大 đọc おお khi là tính từ đuôi い.', { kanji: ['大'] }),
    Q('N5', 'grammar', 'Trợ từ', 'これは 私____ 本です。', ['の', 'を', 'に', 'で'], 0, 'の biểu thị sở hữu: 私の本 (sách của tôi).', { grammar: ['の(所有)'] }),
    Q('N5', 'grammar', 'Mẫu câu', 'あした 友だちと 京都へ ____ たいです。', ['行き', '行く', '行って', '行った'], 0, 'Muốn làm gì: thân động từ (bỏ ます) + たい → 行きたい.', { grammar: ['たいです'] }),
    Q('N5', 'grammar', 'Danh từ hóa', '田中さんは 日本語を 話す____ が じょうずです。', ['の', 'ところ', 'まえ', 'ばかり'], 0, 'Vる + の + が じょうず: giỏi việc làm gì. の biến động từ thành danh từ.', { grammar: ['の(名詞化)'] }),
    Q('N5', 'grammar', 'Thể tiếp diễn', 'いま 雨が ふって ____。', ['います', 'あります', 'します', 'ありません'], 0, 'Vて + います: đang diễn ra. 雨が ふっています = trời đang mưa.', { grammar: ['ています'] }),
    Q('N5', 'reading', 'Đọc hiểu ngắn', 'いつ 走りますか。', ['朝ごはんの 前', '朝ごはんの 後', '夜', '昼ごはんの 前'], 0, 'Bài viết: 朝ごはんの前に三十分ぐらい走ります.', { kanji: ['朝', '前'] }, { passage: P_N5b }),
    Q('N5', 'reading', 'Đọc hiểu ngắn', '走ったあとは 何を しますか。', ['冷たい 水を 飲む', 'おふろに 入る', 'ごはんを 作る', '本を 読む'], 0, 'Bài viết: 走ったあとは、冷たい水を飲みます.', { kanji: ['冷', '水'] }, { passage: P_N5b }),
    Q('N5', 'listening', 'Nghe hội thoại', '男の人は きのう 何を 買いましたか。', ['くつ', 'かばん', 'シャツ', 'ほん'], 0, 'Người nam đến デパート và くつを かいました (mua giày).', { situation: ['siêu thị'] }, {
      audio_script: [{ speaker: 'F', text: 'たなかさん、きのう どこへ いきましたか。' }, { speaker: 'M', text: 'デパートへ いきました。くつを かいました。' }, { speaker: 'F', text: 'そうですか。いい くつですか。' }] }),
  ],
  'N4-2': [
    Q('N4', 'vocab', 'Cách đọc Kanji', '__郵便局__で 切手を 買います。', ['ゆうびんきょく', 'ゆびんきょく', 'ゆうびんぎょく', 'ゆうへんきょく'], 0, '郵便局 = ゆうびんきょく (bưu điện). 郵 đọc ゆう (trường âm).', { kanji: ['郵', '便', '局'] }),
    Q('N4', 'vocab', 'Cách đọc Kanji', '彼は とても __親切__な 人です。', ['しんせつ', 'しんぜつ', 'しんさつ', 'しんきり'], 0, '親切 = しんせつ (tốt bụng).', { kanji: ['親', '切'] }),
    Q('N4', 'grammar', 'Thể khả năng', 'この 荷物は 重くて、ひとりでは ____ ません。', ['持て', '持ち', '持つ', '持った'], 0, 'Thể khả năng phủ định: 持てません (không thể cầm nổi). 持ちません là "không cầm" (không liên quan khả năng).', { grammar: ['可能形'] }),
    Q('N4', 'grammar', 'Trạng thái giữ nguyên', '電気を つけた____ 寝て しまいました。', ['まま', 'ばかり', 'あいだ', 'ところ'], 0, 'Vた + まま: giữ nguyên trạng thái (đèn bật mà ngủ quên).', { grammar: ['まま'] }),
    Q('N4', 'grammar', 'Nguyên nhân', '雨の ____、試合は 中止に なりました。', ['ため', 'はず', 'ほう', 'ように'], 0, 'Nのため: vì N (lý do). はず/ほう/ように không tạo thành nghĩa lý do ở đây.', { grammar: ['ため(原因)'] }),
    Q('N4', 'grammar', 'Thể sai khiến bị động', '母に 部屋を 掃除____。', ['させられました', 'されました', 'させました', 'させて くれました'], 0, 'Bị mẹ bắt dọn phòng → sai khiến + bị động: 掃除させられました. させました nghĩa là "tôi bắt (người khác) dọn".', { grammar: ['使役受身'] }),
    Q('N4', 'reading', 'Đọc hiểu', 'どうして びしょぬれに なりましたか。', ['かさを 持って 行かなかったから', '山で 川に 落ちたから', '朝から 雨だったから', '友だちが 水を かけたから'], 0, 'Bài viết: かさを持って行かなかったので、びしょぬれになってしまいました. Sáng trời đẹp, mưa từ trưa.', { kanji: ['雨', '持'] }, { passage: P_N4b }),
    Q('N4', 'reading', 'Đọc hiểu', '帰ってから まず 何を しましたか。', ['おふろに 入った', '晩ごはんを 食べた', '友だちに 電話した', '寝た'], 0, 'Câu cuối: 帰ってすぐにおふろに入りました.', {}, { passage: P_N4b }),
    Q('N4', 'listening', 'Nghe hội thoại công việc', '会議室は どこですか。', ['三階', '二階', '一階', '四階'], 0, 'Phòng họp từng ở tầng 2 (đến tuần trước), từ tuần này chuyển lên tầng 3.', { situation: ['công ty'] }, {
      audio_script: [{ speaker: 'M', text: 'たなかさん、かいぎの へや、どこでしたっけ。' }, { speaker: 'F', text: 'さんがいの かいぎしつBですよ。' }, { speaker: 'M', text: 'にかいじゃ なかったですか。' }, { speaker: 'F', text: 'にかいは せんしゅうまでです。こんしゅうから さんがいに かわりました。' }] }),
  ],
  'N3-2': [
    Q('N3', 'vocab', 'Cách đọc Kanji', '__途中__で 電話が 切れた。', ['とちゅう', 'どちゅう', 'とじゅう', 'とうちゅう'], 0, '途中 = とちゅう (giữa chừng). Cả hai chữ đều đọc ngắn.', { kanji: ['途', '中'] }),
    Q('N3', 'vocab', 'Cách đọc Kanji', '__規則__を 守って ください。', ['きそく', 'きぞく', 'ぎそく', 'きしょく'], 0, '規則 = きそく (quy tắc). きぞく là 貴族 (quý tộc).', { kanji: ['規', '則'] }),
    Q('N3', 'vocab', 'Chọn từ phù hợp', '田中さんは いつも ____ 話すので、聞き取りやすい。', ['はっきり', 'ぐっすり', 'うっかり', 'のんびり'], 0, 'はっきり (rõ ràng) hợp với 話す. ぐっすり (ngủ say), うっかり (sơ ý), のんびり (thong thả) không hợp.', {}),
    Q('N3', 'grammar', 'Nghịch tiếp', '雨が 降って いた____、試合は 行われた。', ['にもかかわらず', 'かわりに', 'おかげで', 'ばかりか'], 0, 'Nにもかかわらず: bất chấp N. Trận đấu vẫn diễn ra dù mưa.', { grammar: ['にもかかわらず'] }),
    Q('N3', 'grammar', 'Nghĩa vụ', '約束は 守る____ だ。', ['べき', 'ところ', 'ばかり', 'さえ'], 0, 'Vるべきだ: nên/phải làm (lẽ đương nhiên). べき đi với thể từ điển.', { grammar: ['べき'] }),
    Q('N3', 'grammar', 'Đồng thời', '彼女は 笑い____、話を 続けた。', ['ながら', 'ように', 'ために', 'ほど'], 0, 'Vながら: vừa làm A vừa làm B. 笑いながら話を続けた = vừa cười vừa tiếp tục nói.', { grammar: ['ながら'] }),
    Q('N3', 'reading', 'Đọc hiểu', '仕事帰りの 人に とって 便利な 点は 何ですか。', ['平日は 夜九時まで 開いて いる こと', '子どもが 遊べる こと', '土曜日が 静かな こと', '駅から 遠い こと'], 0, 'Bài viết: 平日は夜九時まで開いているので、仕事の帰りに寄れる.', { kanji: ['図', '書', '館'] }, { passage: P_N3b }),
    Q('N3', 'reading', 'Đọc hiểu', '静かに 本を 読みたい 人に すすめて いるのは どれですか。', ['平日に 利用する こと', '土曜日に 利用する こと', '家族で 来る こと', '夜に 来る こと'], 0, 'Câu cuối: 静かに本を読みたい人には平日の利用をすすめる.', {}, { passage: P_N3b }),
    Q('N3', 'listening', 'Nghe hội thoại công việc', '女の 人は この あと 何を しますか。', ['新幹線の 切符を 取る', 'ホテルを 予約する', '出張に 行く', '部長に 電話する'], 0, 'Khách sạn đã đặt xong; vé shinkansen chưa nên chị sẽ lấy trong hôm nay.', { situation: ['công ty'] }, {
      audio_script: [{ speaker: 'F', text: 'ぶちょう、らいしゅうの しゅっちょうですが、ホテルは よやくして おきました。' }, { speaker: 'M', text: 'ありがとう。しんかんせんの きっぷは？' }, { speaker: 'F', text: 'それは まだです。きょうじゅうに とります。' }, { speaker: 'M', text: 'じゃあ、おねがいね。' }] }),
  ],
  N2: [
    Q('N2', 'vocab', 'Cách đọc Kanji', 'この 地域は 農業で __栄えて__ きた。', ['さかえて', 'はえて', 'ひえて', 'ささえて'], 0, '栄える = さかえる (phồn vinh). 支える (ささえる) là chữ khác.', { kanji: ['栄'] }),
    Q('N2', 'vocab', 'Cách đọc Kanji', '若者の 読書量が 減る __傾向__が ある。', ['けいこう', 'けいごう', 'けいほう', 'きょうこう'], 0, '傾向 = けいこう (xu hướng).', { kanji: ['傾', '向'] }),
    Q('N2', 'vocab', 'Chọn từ phù hợp', '彼の 意見には ____ 賛成できない。', ['とうてい', 'ぜひ', 'まるで', 'いかにも'], 0, 'とうてい + phủ định: hoàn toàn không thể. ぜひ đi với mong muốn; まるで "cứ như"; いかにも "quả thật là".', {}),
    Q('N2', 'grammar', 'Nhượng bộ', '雨が 降ろう____、試合は 行われる。', ['と', 'し', 'に', 'て'], 0, 'Vよう + と(も): dù cho ... đi nữa. 降ろうと = dù trời có mưa.', { grammar: ['ようと'] }),
    Q('N2', 'grammar', 'Nghịch tiếp', '彼は 医者____、薬の ことを あまり 知らない。', ['でありながら', 'であるうちに', 'であるにつれて', 'であるついでに'], 0, 'N + でありながら: mặc dù là N mà ... (mâu thuẫn với kỳ vọng).', { grammar: ['でありながら'] }),
    Q('N2', 'grammar', 'Phủ nhận kết luận', '努力した____、結果が 出るとは 限らない。', ['からといって', 'ことだから', 'というより', 'とあって'], 0, 'Vたからといって〜とは限らない: không phải cứ ... thì ...', { grammar: ['からといって'] }),
    Q('N2', 'grammar', 'Không phân biệt', '年齢や 経験を ____、誰でも 応募できます。', ['問わず', '問いず', '問うず', '問ずに'], 0, 'Nを問わず: bất kể N. Dạng đúng là 問わず (không có biến thể khác).', { grammar: ['を問わず'] }),
    Q('N2', 'reading', 'Đọc hiểu', '在宅勤務の よい 点として 挙げられて いるのは どれですか。', ['通勤時間が 減り、家族と 過ごす 時間が 増えた', '同僚と 会話が 増えた', '給料が 上がった', '会社が 近くなった'], 0, 'Bài viết: 通勤の時間が減り、家族と過ごす時間が増えたと喜ぶ声がある.', { kanji: ['在宅', '勤務'] }, { passage: P_N2 }),
    Q('N2', 'reading', 'Đọc hiểu', '週に 数日だけ 出社する 方式を 選ぶ 会社が 出てきた 理由は 何ですか。', ['同僚との 会話が 減り、孤独を 感じる 人が いるから', '通勤が 楽に なったから', '家族が 反対したから', '事務所が 狭いから'], 0, 'Câu trước đó nêu vấn đề cô đơn vì ít trò chuyện với đồng nghiệp; そのため dẫn tới giải pháp đi làm vài ngày/tuần.', {}, { passage: P_N2 }),
    Q('N2', 'listening', 'Nghe hội thoại công việc', '男の 人は 女の 人に 何を して あげますか。', ['原稿を 確認する', 'グラフを 作る', '発表を 代わる', '締め切りを 延ばす'], 0, 'Chị đã làm xong biểu đồ, còn bản thuyết trình thì chưa. Người nam bảo viết xong hôm nay thì anh sẽ kiểm tra (確認する).', { situation: ['công ty'] }, {
      audio_script: [{ speaker: 'F', text: 'せんぱい、らいしゅうの プレゼンの しりょうなんですが、まだ じゅんびできて いなくて…。' }, { speaker: 'M', text: 'え、きんようびが しめきりだよね。なにが おわって ないの？' }, { speaker: 'F', text: 'グラフは つくったんですが、せつめいの げんこうが…。' }, { speaker: 'M', text: 'じゃあ、げんこうは あしたまでに かいて。ぼくが かくにんするよ。' }, { speaker: 'F', text: 'ありがとうございます。たすかります。' }] }),
  ],
  JFT: [
    Q('N4', 'vocab', 'Cách đọc Kanji', '毎日、__朝食__を 作ります。', ['ちょうしょく', 'あさしょく', 'ちょしょく', 'ちょうじき'], 0, '朝食 = ちょうしょく (bữa sáng).', { kanji: ['朝', '食'] }),
    Q('N4', 'vocab', 'Cách đọc Kanji', 'ここに __名前__を 書いて ください。', ['なまえ', 'なまい', 'めいまえ', 'なもえ'], 0, '名前 = なまえ (tên).', { kanji: ['名', '前'] }),
    Q('N4', 'vocab', 'Chọn từ phù hợp', 'ごみは 月曜日と 木曜日に ____ ます。', ['出し', '乗り', '書き', '着'], 0, 'ごみを出す: đem rác ra (đúng ngày). 乗る (lên xe), 書く (viết), 着る (mặc) không hợp.', { situation: ['thủ tục hành chính'] }),
    Q('N4', 'conversation', 'Đáp lại trong giao tiếp', 'A：「すみません、ここに 座っても いいですか。」\nB：「____」', ['どうぞ', 'いってきます', 'ありがとうございました', 'おねがいします'], 0, 'Được phép → trả lời どうぞ (xin mời).', {}),
    Q('N4', 'conversation', 'Biểu hiện hằng ngày', '友だちの 家に 入る とき、何と 言いますか。', ['おじゃまします', 'いってきます', 'ただいま', 'いただきます'], 0, 'Vào nhà người khác: おじゃまします. ただいま (về nhà mình), いただきます (trước bữa ăn).', {}),
    Q('N4', 'conversation', 'Biểu hiện ở nơi làm việc', '仕事が 終わって、先に 帰る とき、同僚に 何と 言いますか。', ['お先に 失礼します', 'いってらっしゃい', 'お待たせしました', 'おかえりなさい'], 0, 'Về trước đồng nghiệp: お先に失礼します.', { situation: ['công ty'] }),
    Q('N4', 'reading', 'Đọc thông báo', 'プラスチックの ごみは いつ 出しますか。', ['水曜日の 朝8時まで', '月曜日の 朝8時まで', '木曜日の 夜', '第2土曜日'], 0, 'Bảng: プラスチック：水曜日 朝8時まで.', { situation: ['thủ tục hành chính'] }, { passage: P_JFT }),
    Q('N4', 'reading', 'Đọc thông báo', '燃えるごみは 何曜日に 出しますか。', ['月曜日と 木曜日', '水曜日', '第2・第4土曜日', '毎日'], 0, 'Bảng: 燃えるごみ：月曜日と木曜日.', {}, { passage: P_JFT }),
    Q('N4', 'reading', 'Đọc thông báo', 'びん・かんは いつですか。', ['第2・第4土曜日', '毎週土曜日', '水曜日', '月曜日と木曜日'], 0, 'Bảng: びん・かん：第2・第4土曜日 (thứ Bảy tuần thứ 2 và thứ 4).', {}, { passage: P_JFT }),
    Q('N4', 'listening', 'Nghe số', '空港へ 行く 電車は 何番ホームですか。', ['3番', '2番', '5番', '8番'], 0, 'Nhân viên ga nói 3番ホームです.', { situation: ['tàu điện'] }, {
      audio_script: [{ speaker: 'F', text: 'すみません、くうこうへ いく でんしゃは なんばんホームですか。' }, { speaker: 'M', text: 'さんばんホームです。かいだんを あがって ください。' }] }),
    Q('N4', 'listening', 'Nghe giờ giấc', '女の 人は 何時ごろ 仕事が 終わりますか。', ['6時ごろ', '5時', '7時ごろ', '4時'], 0, 'Bình thường 5 giờ, nhưng có cuộc họp nên khoảng 6 giờ.', { situation: ['công ty'] }, {
      audio_script: [{ speaker: 'M', text: 'きょうは なんじに しごとが おわりますか。' }, { speaker: 'F', text: 'ごじです。でも、かいぎが あるので、ろくじごろに なります。' }] }),
    Q('N4', 'listening', 'Nghe mua sắm', '客は 何を 買いますか。', ['Lサイズの シャツ', 'Sサイズの シャツ', 'ズボン', 'ぼうし'], 0, 'Khách hỏi size lớn hơn; cửa hàng có size L; khách quyết định lấy cái đó.', { situation: ['siêu thị'] }, {
      audio_script: [{ speaker: 'M', text: 'すみません、この シャツ、もう すこし おおきい サイズは ありますか。' }, { speaker: 'F', text: 'はい、エルサイズが ございます。' }, { speaker: 'M', text: 'じゃあ、それを ください。' }] }),
  ],
};

const SC = {
  N3: { groups: [{ key: 'language', name: 'Kiến thức ngôn ngữ (từ vựng - ngữ pháp)', sections: ['vocab', 'grammar'], max: 60, min: 19 }, { key: 'reading', name: 'Đọc hiểu', sections: ['reading'], max: 60, min: 19 }, { key: 'listening', name: 'Nghe hiểu', sections: ['listening'], max: 60, min: 19 }], total_pass: 95 },
  N2: { groups: [{ key: 'language', name: 'Kiến thức ngôn ngữ (từ vựng - ngữ pháp)', sections: ['vocab', 'grammar'], max: 60, min: 19 }, { key: 'reading', name: 'Đọc hiểu', sections: ['reading'], max: 60, min: 19 }, { key: 'listening', name: 'Nghe hiểu', sections: ['listening'], max: 60, min: 19 }], total_pass: 90 },
  JFT: { groups: [{ key: 'vocab', name: 'Chữ và từ vựng', sections: ['vocab'], max: 60, min: 0 }, { key: 'conv', name: 'Hội thoại và biểu hiện', sections: ['conversation'], max: 60, min: 0 }, { key: 'listen', name: 'Nghe', sections: ['listening'], max: 70, min: 0 }, { key: 'read', name: 'Đọc', sections: ['reading'], max: 60, min: 0 }], total_pass: 200 },
};
const exams = [
  { key: 'N5-2', title: 'JLPT N5 - Đề mô phỏng rút gọn 02', type: 'JLPT', level: 'N5', min: 20, scKey: 'N5' },
  { key: 'N4-2', title: 'JLPT N4 - Đề mô phỏng rút gọn 02', type: 'JLPT', level: 'N4', min: 20, scKey: 'N4' },
  { key: 'N3-2', title: 'JLPT N3 - Đề mô phỏng rút gọn 02', type: 'JLPT', level: 'N3', min: 25, scKey: 'N3' },
  { key: 'N2', title: 'JLPT N2 - Đề mô phỏng rút gọn 01', type: 'JLPT', level: 'N2', min: 25, scKey: 'N2' },
  { key: 'JFT', title: 'JFT-Basic - Đề mô phỏng rút gọn 01', type: 'JFT', level: 'N4', min: 20, scKey: 'JFT', desc: 'Đề tự soạn mô phỏng JFT-Basic (trình độ A2, tương đương khoảng N4), ưu tiên cho người đi làm theo diện kỹ năng đặc định. Thang điểm mô phỏng 250, mức đạt 200.' },
];

const lessons = [
  { title: 'Gọi món ở nhà hàng', situation: 'Nhà hàng (レストラン)', level: 'N5', summary: 'Nói số người, hỏi món gợi ý và gọi món.', grammar_tags: ['てください', 'ましょう'],
    dialogue: [L('F', '{店員|てんいん}', 'いらっしゃいませ。{何名|なんめい}さまですか。', 'Xin chào. Quý khách đi mấy người ạ?', 'kính ngữ'), L('M', '{客|きゃく}', 'ふたりです。', 'Hai người.', 'lịch sự'), L('F', '{店員|てんいん}', 'こちらへ どうぞ。メニューです。', 'Mời đi lối này. Đây là thực đơn ạ.', 'lịch sự'), L('M', '{客|きゃく}', 'すみません、おすすめは なんですか。', 'Xin lỗi, món nào được gợi ý vậy ạ?', 'lịch sự'), L('F', '{店員|てんいん}', 'ラーメンが {人気|にんき}です。', 'Mì ramen được yêu thích ạ.', 'lịch sự'), L('M', '{客|きゃく}', 'じゃあ、ラーメンを ふたつ ください。', 'Vậy cho tôi hai bát ramen.', 'lịch sự')],
    vocab: [{ ja: '{何名|なんめい}', reading: 'なんめい', vi: 'mấy người (lịch sự)' }, { ja: 'メニュー', reading: 'メニュー', vi: 'thực đơn' }, { ja: 'おすすめ', reading: 'おすすめ', vi: 'món gợi ý' }, { ja: '{人気|にんき}', reading: 'にんき', vi: 'được ưa chuộng' }],
    phrases: [{ ja: 'おすすめは なんですか。', vi: 'Món nào được gợi ý ạ?', register: 'lịch sự', note: 'Hỏi nhân viên khi chưa biết chọn gì.' }, { ja: 'ラーメンを ふたつ ください。', vi: 'Cho tôi hai bát ramen.', register: 'lịch sự', note: 'Mẫu 「N を 数 ください」 để gọi món.' }, { ja: 'ラーメン、ふたつね。', vi: 'Hai bát ramen nhé.', register: 'thông thường', note: 'Nói với bạn bè/người thân.' }],
    doc: null, culture: 'Ở nhiều quán Nhật, bạn gọi nhân viên bằng 「すみません」 và không cần boa. Cuối bữa thường thanh toán ở quầy gần cửa ra vào.',
    quiz: [{ stem: 'Nhân viên hỏi 「何名さまですか」. Đi hai người thì trả lời thế nào?', options: ['ふたりです', 'ふたつです', 'にかいです', 'にほんです'], answer: 0, explanation: 'Đếm người: ひとり, ふたり, さんにん... Còn ふたつ dùng đếm đồ vật.' }, { stem: 'Gọi hai bát ramen, nói câu nào?', options: ['ラーメンを ふたつ ください', 'ラーメンが ふたつ です', 'ラーメンを ふたり ください', 'ラーメンへ ふたつ ください'], answer: 0, explanation: 'Món ăn đếm bằng ~つ: ふたつ; mẫu N を 数 ください.' }] },
  { title: 'Hỏi đường và mua vé tàu', situation: 'Tàu điện (電車)', level: 'N5', summary: 'Hỏi giá vé, số sân ga và nghe chỉ dẫn.', grammar_tags: ['で(手段)', 'てください'],
    dialogue: [L('M', '{客|きゃく}', 'すみません、{新宿|しんじゅく}まで いくらですか。', 'Xin lỗi, đến Shinjuku giá bao nhiêu ạ?', 'lịch sự'), L('M', '{駅員|えきいん}', '{二百三十円|にひゃくさんじゅうえん}です。', '230 yên ạ.', 'lịch sự'), L('M', '{客|きゃく}', '{何番|なんばん}ホームですか。', 'Sân ga số mấy ạ?', 'lịch sự'), L('M', '{駅員|えきいん}', '{二番|にばん}ホームです。{階段|かいだん}を {上|あ}がって ください。', 'Sân ga số 2. Xin hãy đi lên cầu thang.', 'lịch sự'), L('M', '{客|きゃく}', 'ありがとうございます。', 'Cảm ơn ạ.', 'lịch sự')],
    vocab: [{ ja: '{駅員|えきいん}', reading: 'えきいん', vi: 'nhân viên nhà ga' }, { ja: '{階段|かいだん}', reading: 'かいだん', vi: 'cầu thang' }, { ja: '{切符|きっぷ}', reading: 'きっぷ', vi: 'vé' }, { ja: '{乗|の}り{換|か}え', reading: 'のりかえ', vi: 'chuyển tuyến' }],
    phrases: [{ ja: '〜まで いくらですか。', vi: 'Đến ~ giá bao nhiêu?', register: 'lịch sự', note: 'Hỏi giá vé.' }, { ja: '{何番|なんばん}ホームですか。', vi: 'Sân ga số mấy?', register: 'lịch sự', note: 'Dùng để hỏi số sân ga.' }],
    doc: null, culture: 'Nhiều người Nhật dùng thẻ IC (Suica, Pasmo) thay vé giấy. Trong tàu điện nên để điện thoại ở chế độ im lặng và tránh nói chuyện điện thoại.',
    quiz: [{ stem: 'Muốn hỏi giá vé đến Shinjuku, nói câu nào?', options: ['新宿まで いくらですか', '新宿は どこですか', '新宿に いきますか', '新宿を ください'], answer: 0, explanation: 'いくらですか = bao nhiêu tiền.' }, { stem: 'Nhân viên nói 「階段を 上がって ください」. Bạn phải làm gì?', options: ['Đi lên cầu thang', 'Đi xuống cầu thang', 'Chờ ở đây', 'Mua vé'], answer: 0, explanation: '上がる = đi lên. Vて + ください = hãy làm.' }] },
  { title: 'Đăng ký SIM điện thoại', situation: 'Điện thoại và SIM (携帯電話)', level: 'N4', summary: 'Hỏi gói cước, giấy tờ và thời hạn hợp đồng.', grammar_tags: ['と(条件)', 'てください', 'ことがある'],
    dialogue: [L('M', '{客|きゃく}', 'すみません、SIMカードを {買|か}いたいんですが。', 'Xin lỗi, tôi muốn mua SIM.', 'lịch sự'), L('F', '{店員|てんいん}', '{在留|ざいりゅう}カードは お{持|も}ちですか。', 'Anh/chị có mang thẻ cư trú không ạ?', 'kính ngữ'), L('M', '{客|きゃく}', 'はい。データだけでも だいじょうぶですか。', 'Có. Chỉ dùng dữ liệu thì có được không ạ?', 'lịch sự'), L('F', '{店員|てんいん}', 'はい。{月|つき}に {三千円|さんぜんえん}で、二十ギガまで {使|つか}えます。', 'Được ạ. 3.000 yên/tháng, dùng tối đa 20GB.', 'lịch sự'), L('M', '{客|きゃく}', '{契約|けいやく}の {期間|きかん}は ありますか。', 'Có thời hạn hợp đồng không ạ?', 'lịch sự'), L('F', '{店員|てんいん}', '{二年間|にねんかん}です。{途中|とちゅう}で やめると、お{金|かね}が かかります。', 'Hai năm ạ. Nếu hủy giữa chừng sẽ bị tính phí.', 'kính ngữ')],
    vocab: [{ ja: '{契約|けいやく}', reading: 'けいやく', vi: 'hợp đồng' }, { ja: '{期間|きかん}', reading: 'きかん', vi: 'thời hạn' }, { ja: '{途中|とちゅう}', reading: 'とちゅう', vi: 'giữa chừng' }, { ja: '{解約|かいやく}', reading: 'かいやく', vi: 'hủy hợp đồng' }],
    phrases: [{ ja: '{契約|けいやく}の {期間|きかん}は ありますか。', vi: 'Có thời hạn hợp đồng không?', register: 'lịch sự', note: 'Luôn hỏi trước khi ký; ở Nhật hủy sớm thường mất phí.' }, { ja: '{途中|とちゅう}で やめると、お{金|かね}が かかります。', vi: 'Hủy giữa chừng sẽ mất phí.', register: 'lịch sự', note: '「Vると」 diễn tả hệ quả tất yếu.' }],
    doc: null, culture: 'Hợp đồng điện thoại ở Nhật thường kéo dài 1–2 năm và hủy sớm có thể bị phạt. Hãy hỏi kỹ về phí hủy hợp đồng (解約金) trước khi ký.',
    quiz: [{ stem: 'Nếu hủy hợp đồng giữa chừng thì sao?', options: ['Phải trả thêm tiền', 'Được hoàn tiền', 'Không sao cả', 'Phải đổi số'], answer: 0, explanation: '途中でやめると、お金がかかります.' }, { stem: 'Gói cước trong bài có giá bao nhiêu mỗi tháng?', options: ['3.000 yên', '2.000 yên', '20.000 yên', '300 yên'], answer: 0, explanation: '月に三千円で、二十ギガまで.' }] },
  { title: 'Thuê nhà và nói chuyện với môi giới', situation: 'Thuê nhà (不動産)', level: 'N3', summary: 'Hỏi tiền nhà, tiền đặt cọc, tiền lễ và người bảo lãnh.', grammar_tags: ['うえに', 'ても', 'なのに'],
    dialogue: [L('M', '{客|きゃく}', 'このアパートを {見|み}たいんですが。', 'Tôi muốn xem căn hộ này.', 'lịch sự'), L('F', '{不動産|ふどうさん}', '{家賃|やちん}は {六万円|ろくまんえん}で、{管理費|かんりひ}が {五千円|ごせんえん}です。', 'Tiền nhà 60.000 yên, phí quản lý 5.000 yên.', 'kính ngữ'), L('M', '{客|きゃく}', '{敷金|しききん}や {礼金|れいきん}は ありますか。', 'Có tiền đặt cọc và tiền lễ không ạ?', 'lịch sự'), L('F', '{不動産|ふどうさん}', '{敷金|しききん}が {一|いっ}か{月分|げつぶん}、{礼金|れいきん}が {一|いっ}か{月分|げつぶん}かかります。', 'Đặt cọc 1 tháng, tiền lễ 1 tháng ạ.', 'kính ngữ'), L('M', '{客|きゃく}', '{外国人|がいこくじん}でも {借|か}りられますか。', 'Người nước ngoài cũng thuê được không ạ?', 'lịch sự'), L('F', '{不動産|ふどうさん}', '{保証人|ほしょうにん}が いれば、だいじょうぶですよ。', 'Nếu có người bảo lãnh thì không vấn đề gì ạ.', 'kính ngữ')],
    vocab: [{ ja: '{家賃|やちん}', reading: 'やちん', vi: 'tiền nhà' }, { ja: '{敷金|しききん}', reading: 'しききん', vi: 'tiền đặt cọc' }, { ja: '{礼金|れいきん}', reading: 'れいきん', vi: 'tiền lễ (cho chủ nhà)' }, { ja: '{保証人|ほしょうにん}', reading: 'ほしょうにん', vi: 'người bảo lãnh' }, { ja: '{管理費|かんりひ}', reading: 'かんりひ', vi: 'phí quản lý' }],
    phrases: [{ ja: '{外国人|がいこくじん}でも {借|か}りられますか。', vi: 'Người nước ngoài cũng thuê được không?', register: 'lịch sự', note: '「Nでも」 = ngay cả N cũng...' }, { ja: '{家賃|やちん}は {高|たか}いうえに、{駅|えき}からも {遠|とお}い。', vi: 'Tiền nhà đã đắt lại còn xa ga.', register: 'thông thường', note: '「〜うえに」 cộng thêm một điểm (xấu hoặc tốt).' }],
    doc: null, culture: 'Ngoài tiền nhà, lúc ký hợp đồng bạn thường phải trả thêm 敷金, 礼金, phí môi giới và bảo hiểm hỏa hoạn: tổng có thể bằng 4–6 tháng tiền nhà. Nhiều nơi yêu cầu công ty bảo lãnh nếu bạn là người nước ngoài.',
    quiz: [{ stem: 'Tiền đặt cọc (敷金) trong bài là bao nhiêu?', options: ['1 tháng tiền nhà', '2 tháng tiền nhà', 'Không có', '5.000 yên'], answer: 0, explanation: '敷金が一か月分.' }, { stem: 'Điều kiện để người nước ngoài thuê được là gì?', options: ['Có người bảo lãnh', 'Có bằng N1', 'Trả trước 1 năm', 'Có xe hơi'], answer: 0, explanation: '保証人がいれば、だいじょうぶです.' }] },
  { title: 'Phỏng vấn làm thêm (バイト)', situation: 'Làm thêm (アルバイト)', level: 'N4', summary: 'Nói số ngày làm, xin nghỉ khi thi, nhận lịch ca.', grammar_tags: ['てください', 'ように'],
    dialogue: [L('M', '{店長|てんちょう}', '{週|しゅう}に {何日|なんにち} {働|はたら}けますか。', 'Một tuần em làm được mấy ngày?', 'lịch sự'), L('F', '{応募者|おうぼしゃ}', '{週|しゅう}に {四日|よっか} {働|はたら}けます。でも、{試験|しけん}の {時期|じき}は {休|やす}みたいです。', 'Một tuần em làm được 4 ngày. Nhưng em muốn nghỉ vào mùa thi.', 'lịch sự'), L('M', '{店長|てんちょう}', 'わかりました。シフトは {前|まえ}の {週|しゅう}までに {出|だ}して ください。', 'Được rồi. Hãy nộp lịch ca trước tuần trước đó.', 'lịch sự'), L('F', '{応募者|おうぼしゃ}', 'はい、わかりました。', 'Vâng, em hiểu rồi.', 'lịch sự'), L('M', '{店長|てんちょう}', '{遅|おく}れる ときは、{電話|でんわ}する ように して ください。', 'Khi nào đi trễ, hãy gọi điện nhé.', 'lịch sự')],
    vocab: [{ ja: '{応募|おうぼ}', reading: 'おうぼ', vi: 'ứng tuyển' }, { ja: 'シフト', reading: 'シフト', vi: 'ca làm' }, { ja: '{時期|じき}', reading: 'じき', vi: 'thời kỳ, mùa' }, { ja: '{制服|せいふく}', reading: 'せいふく', vi: 'đồng phục' }],
    phrases: [{ ja: '{試験|しけん}の {時期|じき}は {休|やす}みたいです。', vi: 'Em muốn nghỉ vào mùa thi.', register: 'lịch sự', note: 'Nói rõ điều kiện ngay từ lúc phỏng vấn.' }, { ja: '{遅|おく}れる ときは {電話|でんわ}して ください。', vi: 'Khi đi trễ hãy gọi điện.', register: 'lịch sự', note: 'Ở Nhật, báo sớm khi đi trễ là phép lịch sự cơ bản.' }],
    doc: null, culture: 'Du học sinh ở Nhật thường được làm thêm tối đa 28 giờ/tuần (theo giấy phép "hoạt động ngoài tư cách"). Hãy kiểm tra giấy phép và giờ làm trước khi nhận việc.',
    quiz: [{ stem: 'Người ứng tuyển làm được mấy ngày mỗi tuần?', options: ['4 ngày', '2 ngày', '7 ngày', '1 ngày'], answer: 0, explanation: '週に四日働けます.' }, { stem: 'Quản lý yêu cầu gì khi đi trễ?', options: ['Gọi điện báo', 'Nghỉ luôn', 'Gửi thư', 'Không cần báo'], answer: 0, explanation: '遅れるときは、電話するようにしてください.' }] },
];
module.exports = { questions, exams, lessons, SC };
