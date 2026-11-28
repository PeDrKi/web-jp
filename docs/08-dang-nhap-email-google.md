# Đăng ký, đăng nhập, quên mật khẩu

Đăng nhập bằng Google đã được bỏ (2026-11-28). Tài khoản từng đăng nhập bằng Google mà chưa có mật khẩu thì dùng "Quên mật khẩu?" (hoặc quản trị viên cấp link đặt lại mật khẩu) để đặt mật khẩu.

## Có sẵn, không cần cấu hình
- **Đăng ký** bằng email và mật khẩu. Mật khẩu cần ít nhất 8 ký tự, có cả chữ và số. Người dùng phải nhập lại mật khẩu, có nút Hiện/Ẩn và thanh báo độ mạnh. Có ô bẫy chống bot, và mỗi địa chỉ IP được tạo tối đa 50 tài khoản/giờ.
- **Đăng nhập** có ô "Ghi nhớ đăng nhập": bỏ tích thì phiên chỉ giữ 1 ngày, mặc định là 30 ngày. Sai 8 lần trong 10 phút thì bị tạm chặn. Sau khi đăng nhập, giảng viên, biên tập viên và quản trị viên được đưa thẳng vào trang Quản trị.
- **Cài đặt → Tài khoản**: đổi tên hiển thị, đổi mật khẩu (các thiết bị khác tự bị đăng xuất), và nút **Đăng xuất mọi thiết bị**.
- **Quản trị → Người dùng** (chỉ quản trị viên):
  - **+ Tạo tài khoản** cho giảng viên hoặc học viên của trung tâm. Có thể đặt sẵn mật khẩu, hoặc để trống để hệ thống tạo link cho người dùng tự đặt mật khẩu (hạn 7 ngày).
  - **Link đặt lại mật khẩu** (hạn 24 giờ, dùng một lần): dùng khi học viên quên mật khẩu mà hệ thống chưa bật gửi email. Sao chép link và gửi qua Zalo/Messenger.
  - **Đăng xuất mọi nơi**: thu hồi mọi phiên đăng nhập của một người.
  - Xem được lần đăng nhập gần nhất và tài khoản nào chưa đặt mật khẩu.

Phiên đăng nhập cũ (trước bản này) hết hiệu lực một lần khi cập nhật, nên mọi người cần đăng nhập lại.

## Bật gửi email "Quên mật khẩu" (Brevo, miễn phí 300 email/ngày)
Chưa bật thì trang Quên mật khẩu sẽ hướng dẫn người dùng liên hệ quản trị viên để được cấp link.

1. Đăng ký tại https://www.brevo.com (gói Free).
2. Vào **Senders, Domains & Dedicated IPs** → **Senders** → **Add a sender**. Nhập email người gửi (ví dụ Gmail của trung tâm), rồi xác minh bằng mã Brevo gửi về hộp thư đó.
3. Vào **SMTP & API** → tab **API Keys** → **Generate a new API key**, rồi sao chép khóa (dạng `xkeysib-...`).
4. Trên Render, mở service → **Environment** → **Add Environment Variable** và thêm:

   | Key | Value |
   |---|---|
   | `BREVO_API_KEY` | khóa ở bước 3 |
   | `MAIL_FROM` | email người gửi đã xác minh ở bước 2 |
   | `MAIL_FROM_NAME` | (không bắt buộc) tên hiển thị, ví dụ `Nihongo ICN` |

   Bấm **Save Changes**, Render sẽ tự khởi động lại.
5. Thử: đăng xuất, bấm **Quên mật khẩu?**, rồi nhập email của bạn. Thư có thể nằm trong mục Spam/Quảng cáo ở những lần đầu.

Link trong email lấy theo địa chỉ web đang chạy. Nếu dùng tên miền riêng mà link vẫn ra địa chỉ `onrender.com`, thêm biến `APP_URL=https://ten-mien-cua-ban`.

## Giữ khóa Brevo không hết hạn
Brevo tự hủy khóa API nếu 90 ngày không dùng, và khóa có hạn tối đa theo mục Expiry khi tạo. Để tránh, web tự gửi một thư ngắn tới `MAIL_FROM` mỗi lần khởi động và mỗi 20 ngày (1 thư, rất nhỏ so với 300 thư/ngày). Tắt bằng biến `MAIL_KEEPALIVE=0`. Khi khóa đến hạn (xem cột Expires on ở Brevo → SMTP & API), tạo khóa mới và dán lại vào Render.
