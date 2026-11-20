# Trạng thái và việc tiếp theo

## Hiện có
- 154 kiểm thử đầu–cuối đạt (thêm 47 kiểm thử cho ngân hàng đề, câu tự luận, chấm bài).
- **Ngân hàng đề cho giảng viên**: vai trò Giảng viên, câu tự luận, tải Excel/CSV trộn trắc nghiệm + tự luận, chấm tự luận có nhận xét.
- Dữ liệu mẫu: 90 câu/8 đề rút gọn (N5×2, N4×2, N3×2, N2, JFT-Basic), 10 bài đời sống, 34 mẫu ngữ pháp, 3 khóa học, **+1 đề N5 đủ cấu trúc 58 câu** (tạo bằng script).
- Đề N5 đủ cấu trúc đã nhập, đăng và làm thử ở chế độ thi thật, chấm đúng theo nhóm.

## Giới hạn đã biết
1. Toàn bộ nội dung do AI soạn, **chưa giáo viên duyệt**.
2. Audio dùng giọng trình duyệt; nên thay bằng thu âm.
3. Điểm là quy đổi mô phỏng, không phải thang JLPT thật.
4. Chưa có: đăng nhập Google, nhập Word, bản dịch Việt cho từng câu đề, nhắc học qua email, thanh toán, N1/NAT-TEST, AI.
5. Chưa đo hiệu năng/tải. Đã chuyển sang PostgreSQL (Supabase), có thể chạy nhiều tiến trình.
6. Chống gian lận chỉ cảnh báo (đúng URD).
7. Một số câu ngữ pháp có thể có nhiều đáp án chấp nhận được (ví dụ câu 34 đề N5) – giáo viên cần xem.

## Backlog đề xuất
**Ngắn hạn:** giáo viên rà đề; thu âm audio; đổi mật khẩu mẫu; triển khai thử cho nhóm nhỏ; đo số liệu tiêu chí thành công (URD mục 12).
**Trung hạn:** nhập đề từ Word (.docx); lớp học và giao đề cho nhóm học viên; đề N4/N3 đủ cấu trúc; bản dịch Việt từng câu; đăng nhập Google; nhắc học; N1 và NAT-TEST.
**Dài hạn:** gói trả phí; AI giải thích lỗi và luyện nói; ứng dụng di động; PostgreSQL + bộ nhớ đệm nếu lượng truy cập tăng.
