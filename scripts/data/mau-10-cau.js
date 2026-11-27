const { makeRow } = require('../lib/builder');
const R = makeRow('N5');
const PASSAGE = '{今日|きょう}は{日曜日|にちようび}です。{私|わたし}は{朝|あさ}{九時|くじ}に{起|お}きて、{友|とも}だちと{公園|こうえん}でテニスをしました。{昼|ひる}ごはんは{友|とも}だちの{家|いえ}で{食|た}べました。{夜|よる}は{家|いえ}で{本|ほん}を{読|よ}みました。';

const rows = [
  R('vocab', 'Cách đọc Kanji', '__先生__に 質問します。', ['せんせい', 'せんせ', 'さんせい', 'せんぜい'], 1, '先生 = せんせい (giáo viên). 先 đọc せん, 生 đọc せい (trường âm).', { kanji: '先,生' }),
  R('vocab', 'Cách đọc Kanji', '__八百屋__で やさいを 買います。', ['はっぴゃくや', 'やおや', 'はちひゃくや', 'やおおく'], 2, '八百屋 = やおや (cửa hàng rau củ) - từ đọc đặc biệt, không phải 八 + 百.', { kanji: '八,百,屋', situation: 'siêu thị' }),
  R('vocab', 'Chọn từ phù hợp', 'のどが いたいので、びょういんへ ____。', ['行きます', '見ます', '買います', '作ります'], 1, 'Đau họng nên đi bệnh viện → 行きます. Các động từ khác không hợp nghĩa.', { situation: 'bệnh viện' }),
  R('grammar', 'Trợ từ', 'わたしは コーヒー____ すきです。', ['が', 'を', 'に', 'へ'], 1, 'Với すき (thích), đối tượng được thích đi với が: コーヒーが すき.', { grammar: 'が(好き)' }),
  R('grammar', 'Trợ từ', '兄は 毎朝 六時____ おきます。', ['を', 'で', 'に', 'と'], 3, 'Thời điểm cụ thể dùng に: 六時に.', { grammar: 'に(時間)' }),
  R('grammar', 'Dạng て', 'ここで 写真を ____ いいですか。', ['とって', 'とる', 'とった', 'とり'], 1, 'Xin phép: Vて + も いいですか. とる → とって.', { grammar: 'てもいい' }),
  R('grammar', 'Phủ định', 'きのうは どこ____ 行きませんでした。', ['が', 'も', 'を', 'で'], 2, 'どこへも / どこにも + phủ định = không đi đâu cả. Ở đây "も" đi sau "どこ(へ)".', { grammar: 'どこも〜ない' }),
  R('reading', 'Đọc hiểu ngắn', '「私」は 昼ごはんを どこで 食べましたか。', ['公園', '友だちの 家', '自分の 家', 'レストラン'], 2, 'Bài viết: 昼ごはんは友だちの家で食べました.', { kanji: '昼,家' }, { passage: PASSAGE }),
  R('reading', 'Đọc hiểu ngắn', '夜、「私」は 何を しましたか。', ['テニスを した', '本を 読んだ', '友だちに 会った', '映画を 見た'], 2, 'Bài viết: 夜は家で本を読みました.', { kanji: '夜,本' }, { passage: PASSAGE }),
  R('listening', 'Nghe số lượng', '男の 人は りんごを いくつ 買いますか。', ['一つ', '二つ', '三つ', '四つ'], 3, 'Ban đầu định mua 2, sau đó đổi ý thành 3 cái (三つに します).', { situation: 'siêu thị', audio_script: 'M:すみません、りんごを ふたつ ください。|F:はい、ふたつですね。|M:あ、やっぱり みっつに します。' }),
];

module.exports = { rows, title: 'JLPT N5 - Bộ đề mẫu từ script', minutes: 15, description: 'Bộ đề mẫu 10 câu tạo bằng script.' };
