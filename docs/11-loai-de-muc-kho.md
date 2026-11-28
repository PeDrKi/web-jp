# Danh mục đề, mức độ khó, dạng tự luận và giới hạn chữ

## 4 danh mục lớn
| Danh mục | Loại câu |
|---|---|
| **Thi chuyên** | Có tự luận, dịch, tìm lỗi sai, viết văn (作文) |
| **JLPT** | Chỉ trắc nghiệm |
| **BJT** | Chỉ trắc nghiệm |
| **EJU** | Có tự luận (記述) |

- Chọn ở **Sửa đề → Danh mục**, khi tải đề PDF/Word và khi tạo phiếu trả lời. Đề JLPT/BJT có câu tự luận sẽ bị báo lỗi.
- Không chọn thì hệ thống tự xếp: đề có câu tự luận vào Thi chuyên, còn lại vào JLPT.
- Học viên chọn danh mục bằng các thẻ ở đầu **Kho đề**, và lọc câu theo danh mục ở **Luyện tập**.
- Mỗi câu hỏi cũng có danh mục (Ngân hàng câu hỏi → Danh mục). Câu tạo từ tải đề/phiếu trả lời lấy danh mục của đề. Khi cập nhật, câu cũ được gắn theo đề đang chứa nó. Đây là nền để sau này trộn đề theo từng danh mục.
- Đề "Thi chứng chỉ" cũ được chuyển sang JLPT.

## 5 mức độ khó
Cơ bản · Vừa · Khó vừa · Khó · Rất khó, dùng cho từng câu hỏi và từng đề, độc lập với cấp N5–N1 (một đề N5 có thể ở mức "Khó").
Học viên lọc theo **Mức độ** ở Kho đề; phần Luyện tập lọc câu theo mức độ.

## Dạng tự luận
Trả lời ngắn · Tìm và sửa lỗi sai · Dịch Nhật → Việt · Dịch Việt → Nhật · Viết văn (作文).
Khi tải đề PDF/Word, dạng được đoán theo yêu cầu của nhóm câu (訂正, ベトナム語に訳, 日本語に訳, 作文…), giáo viên sửa lại được.

## Giới hạn chữ
- Đặt cho từng câu (Ngân hàng câu hỏi), cho cả nhóm (tải đề PDF/Word: ô "Giới hạn cả nhóm"; phiếu trả lời: cột "Giới hạn").
- **Dịch Nhật → Việt đếm theo từ**; các dạng viết tiếng Nhật đếm theo **chữ**, không tính khoảng trắng. 0 = không giới hạn.
- Học viên thấy bộ đếm "120/500 chữ" và không gõ được quá giới hạn; máy chủ cũng cắt phần thừa.
- Bài 作文 có ghi "400〜500字" trong đề được tự đặt giới hạn 500 chữ.

## Nhập Excel/CSV
Thêm các cột (không bắt buộc): `difficulty` / **Mức độ** (1–5 hoặc "Khó vừa"), `etype` / **Dạng tự luận** ("Dịch Nhật → Việt", "Viết văn"…), `max_len` / **Giới hạn chữ**, `catalog` / **Danh mục** ("JLPT", "BJT", "EJU", "Thi chuyên").
