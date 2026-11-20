# Vận hành và triển khai

## Chạy thử
Yêu cầu Node.js ≥ 22.9. Không cần cài database: khi không có `DATABASE_URL`, ứng dụng dùng PGlite (Postgres nhúng) lưu ở `data/pg`.
Deploy lên Render + Supabase: xem `docs/06-deploy-render-supabase.md`.
```bash
npm install
npm run seed -- --reset   # dữ liệu mẫu
npm start                 # http://localhost:3000
npm test
```
Biến môi trường: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`, `APP_SECRET`, `PORT`, `DATA_DIR`, `UPLOAD_DIR`, `SEED_ON_EMPTY`, `SEED_PASSWORD`, `DB_POOL`.

## Nhập đề hàng loạt (ngân hàng câu hỏi)
Cột CSV/XLSX: `kind, level, section, qtype, stem, passage, option1..option4, answer, explanation, model_answer, accepted, points, grammar, kanji, situation, audio_script`.
- `kind`: `mcq` (trắc nghiệm, mặc định) hoặc `essay` (tự luận); viết "trắc nghiệm" / "tự luận" cũng được. Bỏ trống mà không có phương án nhưng có `model_answer` → tự hiểu là tự luận.
- `section`: `vocab`, `grammar`, `reading`, `listening`, `conversation`, `writing` (viết / tự luận).
- Trắc nghiệm: `option1..option4` (có thể thêm `option5`, `option6`), `answer` = số thứ tự đáp án đúng từ 1, `explanation` bắt buộc.
- Tự luận: bỏ trống các option; `model_answer` = đáp án mẫu / hướng dẫn chấm (bắt buộc nếu không có `accepted`); `accepted` = các đáp án ngắn chấp nhận, cách nhau `|` → khớp thì tự chấm đủ điểm, không khớp thì giảng viên chấm tay.
- `points`: điểm tối đa của câu (1-100, mặc định 1).
- Tên cột tiếng Việt cũng nhận: "Loại câu", "Cấp độ", "Phần thi", "Câu hỏi", "Đáp án 1..4", "Đáp án đúng", "Giải thích", "Đáp án mẫu", "Đáp án chấp nhận", "Điểm".
- `passage`: đoạn văn dùng chung (các câu cùng đoạn có cùng nội dung); furigana `{漢字|かんじ}`.
- `audio_script` (câu nghe): `M:lời|F:lời`; hoặc tải audio ở mục Media.
- Mẫu tải ở Quản trị → Tải đề lên: `/api/admin/import/template.xlsx` (có sheet hướng dẫn) hoặc `/api/admin/import/template.csv`.
- Một dòng lỗi → không nhập gì và trả danh sách lỗi theo dòng. Câu nhập vào ở trạng thái nháp; giảng viên bấm "Đăng tất cả vào ngân hàng" ngay sau khi nhập.

## Giảng viên và chấm tự luận
- Vai trò **Giảng viên** (`teacher`): thêm/sửa/xóa câu hỏi và đề **của mình**, tự đăng (không qua người duyệt), dùng câu đã đăng của người khác khi ghép đề, không xem nháp của người khác.
- Quản trị viên cấp vai trò ở Quản trị → Người dùng. Tài khoản mẫu: `giangvien@nihongo.local` / `Teacher@12345` (chỉ có khi seed lại).
- Đề giảng viên dùng loại kỳ thi "Đề giảng viên" và thang điểm nhanh **Thang 10** / **Thang 100** (tính theo điểm từng câu).
- Quản trị → **Chấm tự luận**: danh sách bài có câu tự luận chờ chấm; nhập điểm (0 tới điểm tối đa, bước 0,5) và nhận xét. Học viên thấy điểm tạm tính ngay khi nộp, và nhận thông báo khi đã chấm xong.
- DB cũ được tự nâng cấp (thêm cột `kind, model_answer, accepted, points` cho bảng câu hỏi) khi khởi động, không mất dữ liệu.

## Tạo bộ đề bằng script
```bash
node scripts/tao-de-n5-day-du.js                                   # chỉ sinh CSV/XLSX
node scripts/tao-de-n5-day-du.js --import --base http://localhost:3000   # nhập + tạo đề + đăng
# tùy chọn: --email --password --title --minutes --draft
```
Đề mới: sao chép `scripts/data/n5-day-du.js`, đổi cấp độ trong `makeRow('N5')`, thang điểm và thời lượng; tạo wrapper như `scripts/tao-de-n5-day-du.js`.
Đề đủ cấu trúc N5 (58 câu, 75 phút): `output/de-N5-day-du.xlsx`.

## Triển khai thật (checklist)
1. **Đổi hoặc xóa 5 tài khoản mẫu** (xem README).
2. Đặt `APP_SECRET` ngẫu nhiên dài; chạy sau reverse proxy có **HTTPS** (Nginx/Caddy), cookie đặt `Secure`.
3. Chạy bằng trình quản lý tiến trình (systemd/pm2/Docker), `NODE_ENV=production`.
4. **Sao lưu** database (`pg_dump`) và file tải lên (Supabase Storage hoặc `uploads/`) định kỳ.
5. Giáo viên rà soát toàn bộ đề mẫu trước khi công khai; xóa hoặc gỡ đề chưa duyệt.
6. PGlite chỉ dùng chạy thử trên một máy; khi chạy thật luôn dùng PostgreSQL (`DATABASE_URL`).

## Thêm nội dung
- Ngữ pháp, khóa học: Quản trị → Ngữ pháp / Khóa học. Thẻ ngữ pháp trong câu hỏi phải trùng khóa mẫu ngữ pháp để liên kết.
- Thêm dữ liệu khởi tạo bằng `node seed/extend.js` (idempotent, không xóa dữ liệu).
