# Deploy miễn phí: Vercel + Supabase

| Thành phần | Nền tảng | Gói |
|---|---|---|
| Giao diện (thư mục `public/`) | Vercel, phục vụ qua CDN | Hobby (free) |
| Backend (Express, `/api/*`) | Vercel Functions (`api/index.js`) | Hobby (free) |
| Cơ sở dữ liệu (PostgreSQL) | Supabase | Free |
| Audio / ảnh tải lên | Supabase Storage (bucket `media`, tự tạo) | Free |

**So với Render:**
- Vercel không "ngủ": trang mở gần như ngay, không phải chờ 30-60 giây. Mỗi lần backend khởi động nguội chỉ mất khoảng 1 giây.
- Mỗi request gửi lên Vercel tối đa khoảng **4,5 MB**. Vì vậy audio/ảnh được trình duyệt **tải thẳng lên Supabase** (tối đa 50 MB/file), không đi qua Vercel. File Excel/CSV nhập câu hỏi phải nhỏ hơn 4,5 MB; nếu lớn hơn, chia thành nhiều file.
- Gói Hobby của Vercel chỉ dành cho **mục đích phi thương mại**. Khi web bắt đầu thu tiền, cần lên gói Pro hoặc chuyển sang Render.
- Không tự nạp dữ liệu mẫu khi deploy. Bạn nạp một lần từ máy mình (Bước 3).

Code vẫn giữ cấu hình Render (`render.yaml`), nên có thể đổi qua lại giữa hai nền tảng mà không phải sửa gì.

## Bước 1. Tạo project Supabase
Làm như Bước 1 của `docs/06-deploy-render-supabase.md`, chỉ khác ở **DATABASE_URL**:
- Nút **Connect** → chọn **Transaction pooler** (cổng **6543**), không chọn Session pooler hay Direct connection. Chuỗi có dạng
  `postgresql://postgres.abcxyz:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`.
- Thay `[YOUR-PASSWORD]` (bỏ luôn dấu ngoặc vuông) bằng mật khẩu database.
- Transaction pooler hợp với Vercel vì mỗi lần chạy, Vercel có thể mở nhiều bản backend cùng lúc.

Ghi lại 3 giá trị: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (khóa `sb_secret_...` hoặc `service_role`).

## Bước 2. Đưa code lên GitHub
Giống Bước 2 của `docs/06`. Nếu đã đẩy rồi thì chỉ cần:
```
git add .
git commit -m "ho tro Vercel"
git push
```

## Bước 3. Nạp dữ liệu mẫu từ máy (làm một lần)
1. Trong thư mục Web_JP, sao chép `.env.example` thành `.env` (`copy .env.example .env` trên cmd), mở bằng Notepad và điền:
   ```
   DATABASE_URL=<chuỗi Transaction pooler ở Bước 1>
   SEED_PASSWORD=<mật khẩu bạn tự đặt cho 5 tài khoản mẫu, ít nhất 8 ký tự>
   ```
2. Chạy `npm run seed`. Khi thấy `Đã nạp: 5 người dùng, 90 câu hỏi...` là xong. Lệnh này tạo bảng và dữ liệu mẫu trên Supabase.
3. Sau khi nạp, **xóa dòng DATABASE_URL trong `.env`** (hoặc xóa luôn file `.env`) để lần sau chạy `npm start` trên máy không đụng vào dữ liệu thật. Không dùng `--reset` với database thật: lệnh đó xóa sạch dữ liệu.

Không muốn dữ liệu mẫu: bỏ qua bước này. Bảng sẽ tự tạo khi web chạy lần đầu; đăng ký một tài khoản rồi vào Supabase → Table Editor → bảng `users`, sửa cột `role` của tài khoản đó thành `admin`.

## Bước 4. Tạo project trên Vercel
1. Vào https://vercel.com → **Sign Up** → chọn **Hobby** → **Continue with GitHub**.
2. Bấm **Add New…** → **Project**. Ở danh sách repo, bấm **Import** cạnh repo `web-jp` (nếu không thấy, bấm **Adjust GitHub App Permissions** và cho Vercel quyền truy cập repo).
3. Ở màn hình cấu hình:
   - **Framework Preset**: để **Other** (file `vercel.json` đã cấu hình sẵn, không cần sửa Build/Output).
   - Mở **Environment Variables**, thêm 4 biến:

     | Key | Value |
     |---|---|
     | `DATABASE_URL` | chuỗi Transaction pooler ở Bước 1 |
     | `SUPABASE_URL` | `https://abcxyz.supabase.co` |
     | `SUPABASE_SERVICE_KEY` | khóa secret / service_role |
     | `APP_SECRET` | một chuỗi ngẫu nhiên dài, tạo bằng lệnh bên dưới |

     Tạo `APP_SECRET` trên máy: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` rồi dán kết quả. Thiếu biến này thì backend báo lỗi và không chạy.
4. Bấm **Deploy**. Khoảng 1-2 phút sau Vercel hiện "Congratulations" và địa chỉ dạng `https://web-jp-xxxx.vercel.app`.

## Bước 5. Kiểm tra
1. Mở địa chỉ web, đăng nhập `admin@nihongo.local` với mật khẩu `SEED_PASSWORD`.
2. Vào **Quản trị → Kho audio/ảnh**, tải thử một file mp3. Thành công thì trên Supabase, mục **Storage**, có bucket `media` chứa file đó.
3. Vào **Quản trị → Người dùng**, khóa các tài khoản mẫu không dùng.

## Cập nhật phiên bản mới
`git add . && git commit -m "..." && git push`. Vercel tự build và deploy lại trong khoảng 1 phút. Mỗi nhánh khác `main` còn có một địa chỉ xem thử riêng (Preview).

## Sự cố thường gặp
Xem log: Vercel → project → **Logs** (hoặc Deployments → chọn bản deploy → **Functions**).

| Hiện tượng | Cách xử lý |
|---|---|
| Trang báo `500` / `FUNCTION_INVOCATION_FAILED`, log có `Thiếu biến APP_SECRET` | Thêm `APP_SECRET` trong Settings → Environment Variables, rồi vào Deployments → bản mới nhất → **Redeploy**. |
| Log báo `Không khởi tạo được cơ sở dữ liệu`, `ENOTFOUND`, `password authentication failed` | Kiểm tra `DATABASE_URL`: phải là Transaction pooler cổng 6543, đúng mật khẩu, không còn dấu `[ ]`. Sửa xong phải Redeploy. |
| Tải audio báo "Tải file lên kho lưu trữ thất bại" | Kiểm tra `SUPABASE_URL` và `SUPABASE_SERVICE_KEY` (khóa secret/service_role, không phải publishable/anon). |
| Nhập Excel báo lỗi `413` / `FUNCTION_PAYLOAD_TOO_LARGE` | File lớn hơn 4,5 MB: chia nhỏ file. |
| Đăng nhập được nhưng một lúc sau bị đăng xuất | `APP_SECRET` bị đổi giữa các lần deploy; đặt một giá trị cố định. |
| Supabase báo project bị tạm dừng | Không có ai dùng khoảng 1 tuần; vào Supabase bấm **Restore**, dữ liệu vẫn còn. |
