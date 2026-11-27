# Deploy miễn phí: Render + Supabase

| Thành phần | Nền tảng | Gói |
|---|---|---|
| Backend + giao diện (Express) | Render, Web Service | Free |
| Cơ sở dữ liệu (PostgreSQL) | Supabase | Free |
| Audio / ảnh tải lên | Supabase Storage (bucket `media`, tự tạo) | Free |
| Mã nguồn | GitHub (repo riêng tư cũng được) | Free |

**Giới hạn của gói free (kiểm tra lại trên trang chủ của từng nền tảng vì có thể thay đổi):**
- Render free tự "ngủ" sau khoảng 15 phút không có truy cập. Người vào đầu tiên phải chờ khoảng 30-60 giây.
- Supabase free tạm dừng project nếu khoảng 1 tuần không có hoạt động; vào trang Supabase bấm Restore là chạy lại, dữ liệu vẫn còn.
- Dung lượng: khoảng 500 MB database và 1 GB lưu file. Đủ cho giai đoạn thử nghiệm.

## Bước 1. Tạo project Supabase
1. Vào https://supabase.com → đăng ký (có thể đăng nhập bằng GitHub) → **New project**.
2. Đặt tên, đặt **Database Password** (ghi lại), chọn Region **Southeast Asia (Singapore)**.
3. Khi project tạo xong, lấy 3 giá trị:
   - **DATABASE_URL**: nút **Connect** ở đầu trang → mục **Session pooler** → sao chép chuỗi `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-...pooler.supabase.com:5432/postgres`, thay `[YOUR-PASSWORD]` bằng mật khẩu ở bước 2.
     Dùng Session pooler (không dùng "Direct connection") vì Render free kết nối qua IPv4.
   - **SUPABASE_URL**: Project Settings → Data API → Project URL, dạng `https://xxxx.supabase.co`.
   - **SUPABASE_SERVICE_KEY**: Project Settings → API Keys → khóa **secret** (`sb_secret_...`) hoặc **service_role**. Khóa này toàn quyền, chỉ dán vào Render, không gửi cho ai và không đưa lên GitHub.

Không cần tạo bảng hay bucket: ứng dụng tự tạo khi khởi động lần đầu.

## Bước 2. Đưa mã nguồn lên GitHub
1. Tạo repo mới trên https://github.com/new (chọn Private nếu muốn).
2. Trong thư mục `Web_JP`:
   ```bash
   git init
   git add .
   git commit -m "Web_JP"
   git branch -M main
   git remote add origin https://github.com/<tên-bạn>/<tên-repo>.git
   git push -u origin main
   ```
   File `.gitignore` đã loại `node_modules/`, `data/`, `uploads/`, `.env`.

## Bước 3. Tạo Web Service trên Render
1. Vào https://render.com → đăng nhập bằng GitHub → **New** → **Blueprint** → chọn repo vừa tạo. Render đọc file `render.yaml` và tạo sẵn service `web-jp` (gói Free, Singapore).
2. Render hỏi các biến chưa có giá trị, điền:
   - `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`: từ bước 1.
   - `SEED_PASSWORD`: mật khẩu bạn tự đặt cho 5 tài khoản mẫu (ít nhất 8 ký tự).
   - `APP_SECRET` được Render tự sinh.
3. Bấm **Apply**. Lần build đầu mất vài phút. Khi log hiện `Web luyện đề tiếng Nhật chạy tại...` là xong; địa chỉ có dạng `https://web-jp-xxxx.onrender.com`.

Lần chạy đầu, vì `SEED_ON_EMPTY=1` và database trống, hệ thống tự nạp dữ liệu mẫu (90 câu, 8 đề, 10 bài đời sống) cùng 5 tài khoản `admin@nihongo.local`, `giangvien@nihongo.local`, `bientap@...`, `duyet@...`, `hocvien@...`, **tất cả dùng mật khẩu SEED_PASSWORD**. Đăng nhập admin, vào Quản trị → Người dùng để khóa các tài khoản mẫu không dùng.

Không muốn dữ liệu mẫu: xóa biến `SEED_ON_EMPTY` trước khi deploy, rồi tự tạo tài khoản quản trị bằng cách chạy seed từ máy (bước 5) hoặc đăng ký rồi đổi vai trò trong Supabase (bảng `users`, cột `role` = `admin`).

## Bước 4. Cập nhật phiên bản mới
Sửa code → `git add . && git commit -m "..." && git push`. Render tự build và deploy lại; dữ liệu trên Supabase giữ nguyên.

## Bước 5. Chạy trên máy (tùy chọn)
- Không cần cài Postgres: bỏ trống `DATABASE_URL` thì ứng dụng dùng **PGlite** (Postgres nhúng), dữ liệu lưu ở `data/pg`.
  ```bash
  npm install
  npm run seed -- --reset
  npm start
  ```
- Muốn làm việc trực tiếp với database trên Supabase: sao chép `.env.example` thành `.env`, điền `DATABASE_URL` (và `SUPABASE_*` nếu cần upload file). Cẩn thận: `npm run seed -- --reset` sẽ **xóa sạch** dữ liệu ở database đang trỏ tới.
- `npm test` luôn chạy trên database tạm (PGlite), không đụng tới Supabase.

## Giữ web không "ngủ" (tùy chọn)

Web có sẵn đường dẫn kiểm tra `https://<tên-web>.onrender.com/api/health`. Chỉ cần **một** lịch gọi đường dẫn này **mỗi 10 phút**:
- Render: được gọi đều đặn nên không ngủ (Render free ngủ sau 15 phút không có ai vào).
- Supabase: máy chủ tự hỏi CSDL một câu rất nhẹ lúc vừa khởi động và sau đó **6 ngày một lần** (Supabase free tạm dừng khi 7 ngày không hoạt động). Các lần gọi khác không chạm CSDL (trả `"db":"skipped"`). Muốn đổi số ngày, đặt biến môi trường `DB_PING_DAYS` trên Render. Muốn kiểm tra CSDL ngay, mở `/api/health?db=1`.

Không cần lịch gọi riêng cho Supabase. Chọn **một** trong hai dịch vụ miễn phí:

**UptimeRobot** (uptimerobot.com, có cả app điện thoại)
1. Đăng ký, bấm **New monitor**.
2. Monitor type: **HTTP(s)**. URL: đường dẫn `/api/health` ở trên.
3. Monitoring interval: **10 phút** (dưới 15 phút là được).
4. Bật thông báo email: web sập thì bạn nhận email ngay.

**cron-job.org**
1. Đăng ký, bấm **Create cronjob**.
2. URL: đường dẫn `/api/health`. Execution schedule: **Every 10 minutes**.
3. Ở phần Notifications, bật báo khi lỗi.

Lưu ý:
- Render free cho **750 giờ chạy mỗi tháng** cho cả tài khoản. Một web chạy suốt tháng dùng khoảng 720–744 giờ, vừa đủ. Nếu bạn có thêm web free khác cũng đang được giữ thức, tổng sẽ vượt và Render tạm dừng các web đến đầu tháng sau.
- Lần khởi động lại sau mỗi lần cập nhật (update.bat) vẫn mất khoảng 1 phút như bình thường.
- Muốn bỏ thì chỉ cần tạm dừng (Pause) monitor, không phải sửa gì trong web.

## Sao lưu
- Supabase free không có bản sao lưu tự động tải về được. Định kỳ chạy `pg_dump "<DATABASE_URL>" > backup.sql` (cài PostgreSQL client) hoặc dùng Supabase → Database → Backups nếu gói có.
- File audio/ảnh nằm trong Storage → bucket `media`.

## Sự cố thường gặp
| Hiện tượng | Cách xử lý |
|---|---|
| Log báo `Không khởi tạo được cơ sở dữ liệu` / `ENOTFOUND` / `ENETUNREACH` | Kiểm tra `DATABASE_URL`: phải là **Session pooler**, đã thay mật khẩu, không còn dấu `[ ]`. |
| `password authentication failed` | Sai mật khẩu database; đặt lại ở Supabase → Project Settings → Database. |
| Tải audio/ảnh báo lỗi kho lưu trữ | Kiểm tra `SUPABASE_URL` và `SUPABASE_SERVICE_KEY` (phải là khóa secret/service_role, không phải khóa publishable/anon). |
| Mọi người bị đăng xuất sau mỗi lần deploy | Thiếu `APP_SECRET`; đặt một chuỗi ngẫu nhiên dài trong Render → Environment. |
| Trang mở rất lâu lần đầu | Render free đang "ngủ", chờ 30-60 giây. Cài UptimeRobot theo mục "Giữ web không ngủ" để tránh. |
