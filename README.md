# Web luyện đề tiếng Nhật (MVP theo URD v0.1)

Node ≥ 22.9 + Express + **PostgreSQL** (Supabase khi deploy; PGlite nhúng sẵn khi chạy trên máy, không cần cài gì) + giao diện web tiếng Việt thuần JS (không cần build).

**Deploy miễn phí:** Vercel + Supabase, xem [docs/07-deploy-vercel-supabase.md](docs/07-deploy-vercel-supabase.md); hoặc Render + Supabase, xem [docs/06-deploy-render-supabase.md](docs/06-deploy-render-supabase.md).

## Chạy
```bash
npm install
npm run seed -- --reset   # nạp dữ liệu mẫu (90 câu, 8 đề: N5×2, N4×2, N3×2, N2, JFT-Basic; 10 bài đời sống)
npm start                 # http://localhost:3000
npm test                  # 154 kiểm thử đầu-cuối trên DB tạm
```
Biến môi trường (đặt trong `.env`, xem `.env.example`): `DATABASE_URL` (bỏ trống = PGlite trong `data/pg`), `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (lưu audio/ảnh lên Supabase Storage; bỏ trống = thư mục `uploads/`), `APP_SECRET`, `PORT`, `SEED_ON_EMPTY`, `SEED_PASSWORD`.
Kiểm thử luôn chạy trên DB tạm; muốn kiểm thử trên Postgres thật thì đặt `TEST_DATABASE_URL` (database riêng, sẽ bị xóa sạch).

## Tài khoản mẫu (ĐỔI MẬT KHẨU / XÓA trước khi triển khai)
| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị viên | admin@nihongo.local | Admin@12345 |
| Biên tập viên | bientap@nihongo.local | Editor@12345 |
| Người duyệt | duyet@nihongo.local | Review@12345 |
| Học viên | hocvien@nihongo.local | Hocvien@12345 |
| Giảng viên | giangvien@nihongo.local | Teacher@12345 |

## Đã làm (theo MoSCoW của URD)
- **Must**: FR-01,03,05,06,07,08,10,11,12; AD-01,02,03,04.
- **Should**: FR-02,09 (furigana + cỡ chữ),13,14,15,19,21; AD-05,06,07.
- **Could (làm luôn)**: FR-04,16,17,18,20,22 (chuỗi ngày học, kế hoạch hằng ngày); AD-08,09.
- Bảo mật: đáp án/giải thích không gửi về trình duyệt trước khi nộp; thi thật: hạn chót tính ở server, nghe một lần (server đếm), cảnh báo rời tab; mật khẩu scrypt; xóa tài khoản + dữ liệu.
- Thêm kỳ thi mới = thêm cấu hình thang điểm (JSON) trong trình soạn đề, không sửa code.

## Giới hạn hiện tại (nói thẳng)
- **Nội dung chỉ là mẫu**: 8 đề rút gọn (9–17 câu, 20–25 phút), không phải đủ khối lượng thi thật. Giáo viên cần soạn và duyệt thêm; câu mẫu cũng nên được giáo viên tiếng Nhật rà soát.
- **Audio**: dùng giọng tổng hợp của trình duyệt (Web Speech, cần có giọng ja-JP; chất lượng tùy thiết bị). Có sẵn upload file mp3/wav và trình phát khi câu có `audio_url`.
- Điểm JLPT là **quy đổi theo tỷ lệ đúng** (mô phỏng), không phải thang tương đương hóa của kỳ thi thật.
- Nhập file Word, bản dịch tiếng Việt cho từng đề bài (chỉ bài đời sống có bản dịch), N1/NAT-TEST, thanh toán, AI: chưa làm (giai đoạn 2–3).
- Chống gian lận chỉ ở mức cảnh báo (đúng như URD).

## Mở rộng đợt 2
- Thêm đề N2 và JFT-Basic (phần mới “Hội thoại và biểu hiện”, thang mô phỏng 250/đạt 200), thêm đề 02 cho N5/N4/N3, thêm 5 bài đời sống (nhà hàng, tàu điện, SIM, thuê nhà, làm thêm).
- Thứ tự đáp án được **xáo mỗi lần làm** (đáp án đúng ánh xạ lại phía server); bài kiểm tra đời sống cũng xáo cố định theo bài.
- Thêm nội dung bằng `node seed/extend.js` (idempotent, không xóa dữ liệu hiện có).

## Script tạo bộ đề mẫu
```bash
node scripts/tao-de-mau.js            # chỉ ghi output/de-mau-N5.csv và .xlsx (10 câu, đúng mẫu nhập hàng loạt)
node scripts/tao-de-mau.js --import   # ghi file + nhập vào hệ thống + tạo đề + duyệt và đăng
# tùy chọn: --base URL --email … --password … --title "Tên đề" --minutes 15 --draft
```
Muốn tạo bộ đề khác: sửa mảng `rows` trong script (mỗi dòng là một câu hỏi).

## Tính năng chuyên tiếng Nhật (đợt 3)
- **Thư viện ngữ pháp** (`#/ngu-phap`): 34 mẫu N5–N2 có cấu trúc, ý nghĩa, lưu ý, ví dụ furigana + audio; liên kết sang câu đề, bài đời sống và thống kê đúng/sai của bạn. Nội dung ở `seed/grammar.js`.
- **Chép chính tả** (`#/chep-chinh-ta`): nghe từng câu hội thoại, gõ hiragana/katakana/kanji; chấm từng ký tự (bỏ qua dấu câu, katakana ≡ hiragana), tô đỏ chỗ sai.
- **Khóa học theo lộ trình** (`#/khoa-hoc`): 3 khóa (N5 4 tuần, N4 đi làm 6 tuần, N3 8 tuần); tự đánh dấu bước đã xong, cảnh báo trễ lịch, bước tiếp theo hiện ở trang chủ. Định nghĩa ở `seed/courses.js`.
- Ngữ pháp và khóa học có giao diện quản trị (Quản trị → Ngữ pháp / Khóa học); `seed/grammar.js`, `seed/courses.js` chỉ là dữ liệu khởi tạo.


## Đề mẫu N5 đủ cấu trúc

`node scripts/tao-de-n5-day-du.js` → `output/de-N5-day-du.csv/.xlsx` (58 câu: từ vựng 22, ngữ pháp 16, đọc hiểu 8, nghe 12; 75 phút; thang 180, đậu 80). Thêm `--import --base http://localhost:3000` để nhập + đăng luôn. Đề tự soạn, cần giáo viên rà soát; phần nghe dùng giọng đọc của trình duyệt (TTS).

## Ngân hàng đề cho giảng viên (đợt 4)
- **Vai trò Giảng viên**: tự thêm câu hỏi (trắc nghiệm hoặc tự luận), tải cả bộ đề từ Excel/CSV, ghép đề và **tự đăng** cho học viên. Giảng viên chỉ sửa được câu/đề của mình; câu đã đăng của người khác dùng chung trong ngân hàng.
- **Câu tự luận**: đáp án mẫu / hướng dẫn chấm, điểm tối đa từng câu, danh sách đáp án ngắn được chấp nhận (khớp thì tự chấm, bỏ qua dấu câu, khoảng trắng, katakana ≡ hiragana).
- **Tải đề lên** (Quản trị → Tải đề lên): file mẫu Excel có sheet hướng dẫn; một file trộn được trắc nghiệm + tự luận, cột tiếng Việt cũng nhận. Một dòng lỗi thì không nhập gì.
- **Chấm tự luận** (Quản trị → Chấm tự luận): nhập điểm + nhận xét; học viên thấy điểm tạm tính khi nộp và nhận thông báo khi chấm xong.
- Đề giảng viên có thang điểm nhanh **Thang 10 / Thang 100** tính theo điểm từng câu.
- DB cũ tự nâng cấp khi khởi động. Muốn có tài khoản giảng viên mẫu thì seed lại, hoặc quản trị viên đổi vai trò một tài khoản sang "Giảng viên".

## Tài liệu dự án (thư mục `docs/`)
- `docs/01-yeu-cau-da-sua-doi.md` – URD v0.2: yêu cầu đã chỉnh sửa so với v0.1, trạng thái từng yêu cầu.
- `docs/02-thiet-ke.md` – ý tưởng & thiết kế: kiến trúc, mô hình dữ liệu, API, bộ máy thi, bảo mật, giao diện.
- `docs/03-so-sanh-study4.md` – so sánh định vị với STUDY4.
- `docs/04-van-hanh-trien-khai.md` – chạy, nhập đề (CSV/XLSX), triển khai, sao lưu.
- `docs/05-trang-thai-va-viec-tiep-theo.md` – giới hạn hiện tại và backlog.
- `docs/06-deploy-render-supabase.md` – deploy miễn phí lên Render + Supabase từng bước.
- `docs/07-deploy-vercel-supabase.md` – deploy miễn phí lên Vercel + Supabase từng bước.
- `docs/08-dang-nhap-email-google.md` – đăng ký/đăng nhập, quên mật khẩu qua email (Brevo), tạo tài khoản giảng viên.
- `docs/09-lop-hoc-giao-bai.md` – lớp học: mã lớp/link mời, giao đề có hạn nộp, nhắc nộp bài, bảng điểm Excel.
- `docs/10-tai-de-pdf-word.md` – tải đề từ PDF/Word (tự tách câu) và đề scan + phiếu trả lời.
- `docs/11-loai-de-muc-kho.md` – 4 danh mục (Thi chuyên, JLPT, BJT, EJU), 5 mức độ khó, dạng tự luận (dịch, sửa lỗi, viết văn), giới hạn chữ.
- `docs/goc/URD_v0.1_ban-goc.docx` – tài liệu gốc.
