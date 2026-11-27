# Tải đề thi từ file PDF / Word

Menu **Quản trị → Tải đề PDF/Word** (giảng viên, biên tập viên, quản trị viên). Có hai cách, chọn ở hai tab đầu trang.

## 1. Đề có chữ: tự tách câu

Dùng cho PDF xuất từ Word/Google Docs, file `.docx` hoặc `.txt`.

1. Chọn file. Hệ thống đọc chữ và tách thành từng câu, nhóm theo `問題 1`, `第1部`, `Phần I`…
2. Xem lại từng câu: sửa đề, sửa phương án, đổi trắc nghiệm ↔ tự luận, đổi phần thi, điểm, xóa câu thừa.
3. Chọn đáp án đúng bằng nút tròn, hoặc dán bảng đáp án: `1.C 2.B 3.A`, câu sắp xếp `41.DBAC`, đúng/sai `111.○ 112.×`, đọc kanji `96.つづけて`. Nếu cuối file có phần **ĐÁP ÁN / 解答** thì đáp án được điền sẵn.
4. Bấm **Tạo đề**. Câu nào còn thiếu đáp án sẽ được tô đỏ để sửa. Đề tạo xong nằm trong Kho đề (thể loại CUSTOM, thang 10 hoặc 100) và giao được cho lớp.

Cách trình bày file để tách tốt:
- Câu đánh số `1.` `2.` hoặc `Câu 1:`; phương án `A. B. C. D.` (cùng dòng hoặc mỗi phương án một dòng).
- Đoạn văn đọc hiểu có tiêu đề `【…】`; câu điền chỗ trống trong đoạn văn đánh dấu `(1)`, `(2)`.
- Câu không có phương án thành câu tự luận. Câu có **đáp án tự chấm** (sắp xếp, đọc kanji…) được chấm ngay khi nộp; câu còn lại giáo viên chấm ở **Chấm tự luận**.
- File `.doc` (Word cũ) chưa đọc được: mở bằng Word rồi lưu thành `.docx` hoặc PDF.

## 2. Đề scan / ảnh: phiếu trả lời

Dùng cho đề scan, ảnh chụp, hoặc đề có hình vẽ, bảng biểu khó tách.

1. Tải file đề (PDF hoặc ảnh png/jpg/webp). File được lưu vào Kho audio/ảnh.
2. Nhập tên đề, cấp độ, thời gian, thang điểm.
3. Khai báo **nhóm câu** theo đúng số trên đề, ví dụ câu 1–40 trắc nghiệm A–D, câu 41–44 đúng/sai, câu 45–48 điền ngắn, câu 49 tự luận. Mỗi nhóm có điểm/câu và phần thi.
4. Dán bảng đáp án hoặc bấm trực tiếp trên phiếu. Câu **điền ngắn** cần đáp án (nhiều đáp án cách nhau `|`); câu **tự luận** do giáo viên chấm, đáp án mẫu không bắt buộc.
5. Bấm **Tạo đề**.

Học viên làm bài: bên trái là file đề (vẽ từng trang bằng pdf.js, chạy được trên điện thoại), bên phải là phiếu trả lời, tự lưu mỗi lần bấm. Trên điện thoại có nút chuyển **Đề thi / Phiếu trả lời**. Nếu trình duyệt không hiển thị được file, có link **Mở file đề** để xem ở tab mới.

Câu trên phiếu trả lời (`Câu 1`, `Câu 2`…) không lẫn vào phần Luyện tập theo dạng câu và tìm kiếm. Phương án A–B–C–D giữ nguyên thứ tự, không xáo trộn.

## Kỹ thuật

- `lib/docimport.js`: đọc chữ (unpdf cho PDF, mammoth cho .docx), tách câu, đọc bảng đáp án.
- API: `POST /api/admin/import/document` (file thô, header `x-filename`), `POST /api/admin/import/document/key`, `POST /api/admin/import/document/commit`, `POST /api/admin/import/sheet`.
- CSDL: `exams.doc_url` (file đề của đề dạng phiếu), `questions.is_sheet` (câu thuộc phiếu trả lời). Tự thêm cột khi khởi động.
- pdf.js phục vụ tại `/vendor/pdfjs/` từ gói `pdfjs-dist`, không phụ thuộc CDN.
- File PDF dùng chung giới hạn kho media (tối đa 50 MB khi tải thẳng lên Supabase, 25 MB khi qua máy chủ).
