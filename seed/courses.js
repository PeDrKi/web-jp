// Khóa học theo lộ trình. `ref` là tên đề/bài/mẫu ngữ pháp trong hệ thống.
const S = (week, type, ref, title, extra = {}) => ({ week, type, ref, title, ...extra });
module.exports = [
  { title: 'Lộ trình N5 trong 4 tuần', level: 'N5', weeks: 4, goal: 'Đậu JLPT N5', description: 'Dành cho người mới bắt đầu: học mẫu câu cốt lõi, tình huống cơ bản, luyện nghe chép chính tả và làm đề mô phỏng.',
    steps: [
      S(1, 'grammar', 'で(手段)', 'Học và luyện mẫu で (phương tiện)'), S(1, 'grammar', 'てください', 'Học và luyện mẫu 〜てください'),
      S(1, 'lesson', 'Thanh toán ở siêu thị', 'Bài tình huống: Thanh toán ở siêu thị'), S(1, 'dictation', 'Thanh toán ở siêu thị', 'Chép chính tả: Siêu thị'),
      S(2, 'grammar', 'まえに', 'Học và luyện mẫu 〜まえに'), S(2, 'grammar', 'たいです', 'Học và luyện mẫu 〜たいです'),
      S(2, 'lesson', 'Gọi món ở nhà hàng', 'Bài tình huống: Gọi món ở nhà hàng'), S(2, 'exam', 'JLPT N5 - Đề mô phỏng rút gọn 01', 'Làm đề N5 số 01'),
      S(3, 'grammar', 'ましょう', 'Học và luyện mẫu 〜ましょう'), S(3, 'lesson', 'Hỏi đường và mua vé tàu', 'Bài tình huống: Tàu điện'),
      S(3, 'dictation', 'Hỏi đường và mua vé tàu', 'Chép chính tả: Tàu điện'), S(3, 'cards', '', 'Lưu ít nhất 5 thẻ flashcard', { count: 5 }),
      S(4, 'practice', '', 'Luyện tập tổng hợp N5', { level: 'N5' }), S(4, 'exam', 'JLPT N5 - Đề mô phỏng rút gọn 02', 'Làm đề N5 số 02 (kiểm tra cuối)'),
    ] },
  { title: 'Tiếng Nhật đi làm và sống ở Nhật (N4)', level: 'N4', weeks: 6, goal: 'Giao tiếp được ở công ty và khi sống một mình', description: 'Kết hợp hai nhánh: mẫu ngữ pháp N4, bài tình huống thực tế (bệnh viện, ngân hàng, SIM, làm thêm) và đề JFT-Basic.',
    steps: [
      S(1, 'lesson', 'Khám bệnh ở bệnh viện', 'Bài tình huống: Bệnh viện'), S(1, 'grammar', 'ていただく', 'Học và luyện mẫu 〜ていただく'), S(1, 'dictation', 'Khám bệnh ở bệnh viện', 'Chép chính tả: Bệnh viện'),
      S(2, 'lesson', 'Mở tài khoản ngân hàng', 'Bài tình huống: Mở tài khoản ngân hàng'), S(2, 'grammar', 'と(条件)', 'Học và luyện mẫu と (điều kiện)'),
      S(3, 'lesson', 'Đăng ký SIM điện thoại', 'Bài tình huống: Đăng ký SIM'), S(3, 'grammar', 'ことがある', 'Học và luyện mẫu 〜ことがある'),
      S(4, 'lesson', 'Phỏng vấn làm thêm (バイト)', 'Bài tình huống: Phỏng vấn làm thêm'), S(4, 'grammar', 'ように', 'Học và luyện mẫu 〜ように'), S(4, 'grammar', 'そうです(様態)', 'Học và luyện mẫu 〜そうです'),
      S(5, 'exam', 'JLPT N4 - Đề mô phỏng rút gọn 01', 'Làm đề N4 số 01'), S(5, 'cards', '', 'Lưu ít nhất 10 thẻ flashcard', { count: 10 }),
      S(6, 'exam', 'JFT-Basic - Đề mô phỏng rút gọn 01', 'Làm đề JFT-Basic'), S(6, 'exam', 'JLPT N4 - Đề mô phỏng rút gọn 02', 'Làm đề N4 số 02 (kiểm tra cuối)'),
    ] },
  { title: 'Lộ trình N3 trong 8 tuần', level: 'N3', weeks: 8, goal: 'Đậu JLPT N3', description: 'Ngữ pháp N3 trọng tâm, tình huống công sở và thủ tục hành chính, luyện đọc hiểu và hai đề mô phỏng.',
    steps: [
      S(1, 'grammar', 'なのに', 'Học và luyện mẫu 〜なのに'), S(1, 'grammar', 'ても', 'Học và luyện mẫu 〜ても'),
      S(2, 'grammar', 'はず', 'Học và luyện mẫu 〜はず'), S(2, 'lesson', 'Báo cáo trễ hạn với trưởng phòng', 'Bài tình huống: Báo cáo trễ hạn'), S(2, 'dictation', 'Báo cáo trễ hạn với trưởng phòng', 'Chép chính tả: Công ty'),
      S(3, 'grammar', '向けに', 'Học và luyện mẫu 〜向けに'), S(3, 'grammar', 'うえに', 'Học và luyện mẫu 〜うえに'), S(3, 'lesson', 'Làm thủ tục chuyển đến ở ủy ban quận', 'Bài tình huống: Ủy ban quận'),
      S(4, 'exam', 'JLPT N3 - Đề mô phỏng rút gọn 01', 'Làm đề N3 số 01'),
      S(5, 'grammar', 'ことになっている', 'Học và luyện mẫu 〜ことになっている'), S(5, 'grammar', 'にもかかわらず', 'Học và luyện mẫu 〜にもかかわらず'), S(5, 'lesson', 'Thuê nhà và nói chuyện với môi giới', 'Bài tình huống: Thuê nhà'),
      S(6, 'grammar', 'べき', 'Học và luyện mẫu 〜べき'), S(6, 'grammar', 'ながら', 'Học và luyện mẫu 〜ながら'), S(6, 'practice', '', 'Luyện đọc hiểu N3', { level: 'N3', section: 'reading' }),
      S(7, 'practice', '', 'Luyện nghe N3', { level: 'N3', section: 'listening' }), S(7, 'cards', '', 'Lưu ít nhất 10 thẻ flashcard', { count: 10 }),
      S(8, 'exam', 'JLPT N3 - Đề mô phỏng rút gọn 02', 'Làm đề N3 số 02 (kiểm tra cuối)'),
    ] },
];
