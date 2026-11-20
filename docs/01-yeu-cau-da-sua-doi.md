# Tài liệu yêu cầu người dùng – Web luyện đề tiếng Nhật (v0.2, đã sửa đổi)

Dựa trên URD v0.1 (Phạm Đăng Khuê, 01/11/2026, bản gốc ở `docs/goc/`). Bản này ghi lại các thay đổi phát sinh trong quá trình thực hiện và trạng thái thực tế của từng yêu cầu.

## 1. Thay đổi so với v0.1

| # | Thay đổi | Lý do |
|---|---|---|
| 1 | **Chỉ phục vụ tiếng Nhật.** Bỏ định hướng "đa ngôn ngữ"; mọi tính năng thiết kế riêng cho tiếng Nhật (furigana, kanji, trợ từ, thể lịch sự…). | Quyết định của chủ dự án. |
| 2 | **Mục tiêu định vị: tốt hơn STUDY4 ở mảng tiếng Nhật** nhờ chuyên sâu (xem `03-so-sanh-study4.md`). | Quyết định của chủ dự án. |
| 3 | **Thêm FR-23 Thư viện ngữ pháp**: mẫu câu có cấu trúc, ý nghĩa, lưu ý, ví dụ furigana + audio, liên kết sang câu đề / bài đời sống / thống kê cá nhân. | Điểm khác biệt chính. |
| 4 | **Thêm FR-24 Chép chính tả (dictation)**: nghe câu, gõ lại, chấm từng ký tự (katakana ≡ hiragana, bỏ dấu câu). | Luyện nghe đặc thù tiếng Nhật. |
| 5 | **Thêm FR-25 Khóa học theo lộ trình**: chuỗi bước (ngữ pháp, bài học, chính tả, đề, luyện tập, flashcard), tự đánh dấu hoàn thành, cảnh báo trễ lịch. Cụ thể hóa FR-22. | Giữ chân người học. |
| 6 | **Thêm AD-10** giao diện quản trị ngữ pháp và khóa học; **AD-11** script tạo bộ đề mẫu từ CSV/XLSX. | Đội nội dung không cần sửa file seed. |
| 7 | Thêm phần thi **"Hội thoại và biểu hiện"** (JFT-Basic) và thang điểm cấu hình được (JSON) cho mỗi đề. | Thêm kỳ thi mà không sửa code (phi chức năng "Bảo trì"). |
| 8 | Phạm vi làm sớm hơn kế hoạch 3 giai đoạn: gần như toàn bộ Must/Should/Could, thêm N2 và JFT-Basic mẫu. | Thực hiện mở rộng theo yêu cầu. |
| 9 | Thứ tự đáp án **xáo mỗi lần làm** (server ánh xạ lại đáp án đúng). | Chống học vẹt vị trí đáp án; seed ban đầu luôn để đáp án đúng ở vị trí 1. |
| 10 | Điểm JLPT là **quy đổi theo tỷ lệ đúng** theo nhóm (ví dụ N5: 120 + 60, liệt 38/19, đậu 80/180), không phải thang tương đương hóa thật. | JEES không công bố công thức; ghi rõ là mô phỏng. |

## 2. Trạng thái từng yêu cầu

Chú thích: ✅ đã làm · ◐ làm một phần · ❌ chưa làm.

### Người học
| Mã | Trạng thái | Ghi chú |
|---|---|---|
| FR-01 | ◐ | Email + mật khẩu (scrypt). **Chưa có đăng nhập Google.** |
| FR-02 | ✅ | Chọn mục tiêu thi / đi làm / cả hai; trang chủ gợi ý theo mục tiêu. |
| FR-03, FR-04 | ✅ | Lọc kết hợp; tìm kiếm tiếng Việt và tiếng Nhật (gồm tên tình huống bằng tiếng Nhật). |
| FR-05 | ✅ | Đồng hồ; hạn chót tính ở server; hết giờ tự nộp; lưu tự động, làm tiếp được. |
| FR-06, FR-07 | ✅ | Luyện theo phần/dạng/số câu; bảng tổng quan, đánh dấu cần xem lại. |
| FR-08 | ✅ | Thi thật: nghe 1 lần (server đếm). Luyện: nghe lại. Audio: file tải lên hoặc giọng tổng hợp của trình duyệt. |
| FR-09 | ✅ | Bật/tắt furigana, cỡ chữ. **Bản dịch tiếng Việt chỉ có ở bài đời sống**, chưa có cho từng câu đề. |
| FR-10 | ✅ | Đoạn văn, bảng, hình. |
| FR-11, FR-12 | ✅ | Điểm từng nhóm + tổng, đậu/rớt, điểm liệt; xem lại, lọc câu sai, giải thích. |
| FR-13, FR-14 | ✅ | Thống kê theo phần, dạng, ngữ pháp, kanji; gợi ý bài tiếp theo sau khi nộp. |
| FR-15–FR-18 | ✅ | 10 bài tình huống (có hội thoại, từ vựng, câu mẫu, kiểm tra, mức lịch sự, tài liệu mô phỏng); nhãn liên kết hai chiều. |
| FR-19 | ✅ | Flashcard lặp lại ngắt quãng. |
| FR-20, FR-21 | ✅ | Bình luận trả lời lồng + thông báo; báo lỗi có trạng thái và phản hồi. |
| FR-22 | ✅ | Chuỗi ngày học, kế hoạch hằng ngày; mở rộng bằng FR-25. **Chưa có nhắc học qua email/đẩy.** |
| FR-23 | ✅ (mới) | 34 mẫu N5–N2. |
| FR-24 | ✅ (mới) | Dựa trên hội thoại bài đời sống. |
| FR-25 | ✅ (mới) | 3 khóa mẫu. |

### Quản trị
| Mã | Trạng thái | Ghi chú |
|---|---|---|
| AD-01 | ✅ | Trình soạn + xem trước. |
| AD-02 | ◐ | CSV/XLSX (trắc nghiệm + tự luận trong cùng file, cột tiếng Việt), nhập nguyên tử (một dòng lỗi thì không nhập gì), báo lỗi từng dòng. **Chưa nhập Word.** |
| AD-03, AD-04 | ✅ | Thẻ; nháp → chờ duyệt → đã đăng → đã gỡ, kiểm tra vai trò. |
| AD-05–AD-07 | ✅ | Quản lý báo lỗi/bình luận; lưu phiên bản (kết quả cũ gắn snapshot); báo cáo tỷ lệ sai, câu mơ hồ. |
| AD-08, AD-09 | ✅ | Người dùng (khóa, đổi quyền); kho media chống trùng SHA-256. **Chưa có gói đăng ký/thanh toán.** |
| AD-10, AD-11 | ✅ (mới) | |

### Chưa làm (giữ nguyên ngoài phạm vi)
Luyện nói/chấm phát âm, chấm bài viết, ứng dụng di động riêng, N1 và NAT-TEST, thanh toán, AI giải thích lỗi, EJU, Kanji Kentei.

## 3. Yêu cầu phi chức năng – kiểm chứng
| Yêu cầu | Trạng thái |
|---|---|
| Tự lưu mỗi lần chọn đáp án | ✅ có kiểm thử |
| Đáp án không gửi trước khi nộp (thi thật) | ✅ có kiểm thử |
| Hạn chót phía server, nghe một lần, cảnh báo rời tab | ✅ |
| Mật khẩu mã hóa, giới hạn đăng nhập sai, xóa tài khoản + dữ liệu | ✅ |
| Responsive, chế độ tối, chỉnh cỡ chữ | ✅ (đã chụp màn hình 390px và máy tính) |
| Hiệu năng 4G < 3 giây, chịu tải đột biến tháng 7/12 | ❌ **Chưa đo.** SQLite + một tiến trình Node phù hợp quy mô nhỏ; xem `05`. |
| Bản quyền | Nội dung mẫu đều tự soạn; cần giáo viên rà soát trước khi công khai. |

## 4. Rủi ro cập nhật
- **Chất lượng nội dung** vẫn là rủi ro lớn nhất: 9 đề mẫu (8 đề rút gọn + 1 đề N5 đủ cấu trúc 58 câu) đều do AI soạn, **chưa qua giáo viên**.
- **Audio tổng hợp** của trình duyệt khác nhau theo thiết bị, một số máy không có giọng ja-JP.
- Chấm điểm là mô phỏng; không nên quảng cáo là "điểm JLPT thật".

## Bổ sung đợt 4: Ngân hàng đề cho giảng viên
| Mã | Trạng thái | Ghi chú |
|---|---|---|
| QB-01 | ✅ | Vai trò Giảng viên: tự soạn, tải lên, đăng câu hỏi và đề của mình; chỉ sửa nội dung của mình. |
| QB-02 | ✅ | Câu tự luận: đáp án mẫu / hướng dẫn chấm, đáp án ngắn chấp nhận (tự chấm), điểm tối đa từng câu. |
| QB-03 | ✅ | Thêm từng câu (trình soạn có xem trước) hoặc tải Excel/CSV trộn trắc nghiệm + tự luận. |
| QB-04 | ✅ | Ngân hàng chung: lọc theo loại câu, người tạo, cấp độ, phần thi, trạng thái; ghép đề từ câu đã đăng. |
| QB-05 | ✅ | Chấm tự luận: danh sách chờ chấm, nhập điểm + nhận xét, điểm tạm tính → điểm chính thức, thông báo học viên. |
| QB-06 | ✅ | Đề giảng viên với thang 10 / thang 100 tính theo điểm từng câu. |
| QB-07 | ☐ | Nhập đề từ file Word (.docx), lớp học / giao đề cho nhóm học viên, chấm tự luận bằng AI gợi ý. |
