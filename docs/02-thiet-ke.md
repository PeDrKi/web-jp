# Ý tưởng và thiết kế

## 1. Nguyên tắc thiết kế
1. **Một hệ thống câu hỏi dùng chung** cho đề thi và bài đời sống; khác nhau ở loại bài và thẻ (đúng tinh thần URD mục 6).
2. **Đội nội dung không cần lập trình:** mọi thứ nhập qua CSV/XLSX hoặc giao diện quản trị; thang điểm cấu hình bằng JSON.
3. **Tin cậy hơn tiện lợi:** đáp án chỉ ở server cho đến khi nộp; thời gian do server tính; kết quả cũ không bị đề sửa làm đổi.
4. **Chuyên tiếng Nhật:** furigana, chuẩn hóa chữ Nhật, ngữ pháp là thực thể hạng nhất, không phải "tag cho đẹp".
5. **Không cần build, ít phụ thuộc:** chạy bằng `node server.js`; chỉ cần `express` và `xlsx`.

## 2. Kiến trúc
```
Trình duyệt (SPA JS thuần, hash router)
   │  JSON qua /api  (cookie sid ký HMAC)
Express 5  ── server.js
   ├─ routes/learner.js  tài khoản, đề, bài làm, thống kê, bài học, flashcard, bình luận, báo lỗi
   ├─ routes/extra.js    ngữ pháp, chép chính tả, khóa học
   └─ routes/admin.js    câu hỏi, nhập hàng loạt, đề, bài học, báo lỗi, người dùng, media, ngữ pháp, khóa học
lib/  db.js (schema PostgreSQL, pg / PGlite) · storage.js (Supabase Storage / uploads) · auth.js · content.js (chấm điểm, gợi ý, kiểm tra hợp lệ) · jp.js (xử lý chữ Nhật)
PostgreSQL (Supabase; PGlite khi chạy local)  ·  Supabase Storage hoặc thư mục uploads/ (media)
```
Thứ tự mount: `/api/admin` → `/api` (extra) → learner router. Thân yêu cầu thô (raw) cho tải file nhập và media.

## 3. Mô hình dữ liệu (PostgreSQL)
| Bảng | Vai trò |
|---|---|
| `users` | tài khoản, vai trò learner/admin/editor/reviewer, mục tiêu, cài đặt, chuỗi ngày học |
| `questions`, `question_versions` | câu hỏi (JSON thẻ, trạng thái, số phiên bản) và snapshot từng phiên bản |
| `exams` | đề: danh sách câu, thời lượng, **cấu hình chấm điểm (JSON)**, phiên bản, trạng thái |
| `attempts` | bài làm: **snapshot đầy đủ câu hỏi đã xáo**, đáp án, hạn chót, số lần nghe, số lần rời tab, kết quả |
| `lessons`, `lesson_progress` | bài đời sống (hội thoại, từ vựng, câu mẫu, kiểm tra, ghi chú văn hóa) |
| `cards` | flashcard và lịch ôn |
| `comments`, `notifications`, `reports` | cộng đồng, thông báo, báo lỗi |
| `grammar` | mẫu ngữ pháp (khóa là thẻ ngữ pháp) |
| `courses`, `enrollments` | khóa học và tiến độ ghi danh |
| `dictation_log` | lượt chép chính tả (tính vào chuỗi ngày học) |
| `media` | file tải lên, khử trùng bằng SHA-256 |

**Phiên bản (AD-06):** khi sửa câu/đề đã đăng, hệ thống tăng `version` và lưu snapshot; `attempts` giữ snapshot riêng nên xem lại luôn đúng như lúc làm.

## 4. Bộ máy làm đề
1. `POST /attempts` dựng snapshot từ đề/câu, **xáo thứ tự đáp án phía server** và lưu ánh xạ.
2. Trình duyệt chỉ nhận câu hỏi, không có đáp án đúng/giải thích (thi thật).
3. `PUT /attempts/:id/answers` tự lưu từng lần chọn (kèm cờ đánh dấu, số lần rời tab); giá trị ngoài phạm vi bị bỏ qua.
4. `POST /attempts/:id/play` đếm lượt nghe; thi thật chỉ 1 lượt/câu (403 khi vượt).
5. `POST /attempts/:id/submit` (hoặc quá hạn chót): `scoreAttempt` chấm theo nhóm trong `scoring` – mỗi nhóm có `max`, `min` (điểm liệt), và `total_pass`. Điểm nhóm = tỷ lệ đúng × max.
6. Chế độ luyện cho phép `POST /attempts/:id/check` xem đáp án từng câu; thi thật trả 403.

Ví dụ cấu hình N5: `language` (vocab + grammar + reading) max 120, min 38; `listening` max 60, min 19; `total_pass` 80.

## 5. Chữ Nhật và furigana
- Đánh dấu: `{漢字|かんじ}` → thẻ `<ruby>`; `__từ__` → gạch chân. Công tắc furigana ẩn `<rt>` bằng CSS.
- `lib/jp.js`: `norm` (katakana → hiragana, bỏ dấu câu/khoảng trắng), `readingOf`/`surfaceOf` (tách cách đọc / mặt chữ), `checkDictation` (so khớp LCS theo ký tự, trả vị trí đúng/sai).
- Audio: file mp3/wav nếu có `audio_url`, nếu không dùng Web Speech API (ja-JP) đọc `audio_script` dạng `M:lời|F:lời` (nam/nữ).

## 6. Quy trình nội dung
`draft → pending → published → removed`. Biên tập viên soạn/sửa và gửi duyệt; chỉ người duyệt/quản trị đăng. Học viên chỉ thấy `published`. Nhập hàng loạt chỉ tạo bản nháp, **nguyên tử** (một lỗi thì không nhập gì, trả danh sách lỗi theo dòng).

## 7. Bảo mật
Mật khẩu scrypt có salt; cookie `sid` ký HMAC (`APP_SECRET`), HttpOnly; giới hạn đăng nhập sai; kiểm tra vai trò ở từng route quản trị; tải file kiểm tra loại và kích thước; xóa tài khoản xóa toàn bộ dữ liệu liên quan; đáp án không rời server trước khi nộp.

## 8. Giao diện
Phong cách "giấy washi": nền kem, mực chàm, điểm nhấn đỏ son; chế độ tối; ưu tiên điện thoại. Điều hướng: Trang chủ, Kho đề, Luyện tập, Khóa học, Ngữ pháp, Đời sống, Chép chính tả, Flashcard, Thống kê (+ Quản trị cho vai trò nội dung). Chia thành `app.js` (học viên), `jp.js` (ngữ pháp, chính tả, khóa học), `admin.js` (quản trị).

## 9. API chính
Học viên: `/auth/*`, `/me`, `/exams`, `/attempts*`, `/practice/options`, `/search`, `/stats`, `/dashboard`, `/lessons*`, `/cards*`, `/comments*`, `/reports*`, `/notifications/read`.
Mở rộng: `/grammar`, `/grammar/item?tag=`, `/dictation/sets`, `/dictation/check`, `/courses*` (+ ghi danh).
Quản trị (`/api/admin/…`): `questions`, `import/questions`, `import/template.csv`, `exams`, `lessons`, `reports`, `comments`, `users`, `media`, `refs`, `grammar`, `courses`, `overview`.

## 10. Kiểm thử
`test/smoke.js` chạy 107 kiểm tra đầu–cuối trên DB tạm (xác thực, chấm điểm, thi thật, quyền, nhập hàng loạt, phiên bản, bình luận, ngữ pháp, chính tả, khóa học…). Chạy: `npm test`.
