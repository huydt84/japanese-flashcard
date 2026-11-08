# Dữ liệu đã khôi phục từ Supabase sang Neon

Ngày 2026-11-02, script `scripts/migrate-supabase-backup.mjs` nhập dữ liệu Kotoba từ backup Supabase ngày 2026-10-06 vào Neon. Dữ liệu nguồn và đích có cùng số hàng và SHA-256 cho cả 10 bảng được chuyển.

Supabase `fkwdrdnyzuippanyjtpf` vẫn tạm dừng. Việc khôi phục không ghi vào project nguồn. Đích là Neon `jolly-morning-09908819`, database `neondb`, nhánh `production`.

Ngày 2026-11-08, các migration Auth.js/RLS đã được áp dụng trên Neon và `db:verify` xác nhận đủ chín bảng bật RLS, role `kotoba_runtime` không có quyền vượt RLS, các profile cùng Google identity đã được liên kết. Website đã deploy tại [japanese-flashcard-nu.vercel.app](https://japanese-flashcard-nu.vercel.app). Smoke test production xác nhận trang chính, quyền riêng tư và điều khoản trả HTTP 200; đăng nhập Google thành công; workspace admin/học sinh/giáo viên mở được; trình nhập CSV và chế độ dán CSV hiển thị. Không gửi dữ liệu CSV thử lên production.

## Dữ liệu đã chuyển

| Bảng đích | Số hàng |
| --- | ---: |
| `profiles` | 2 |
| `classes` | 2 |
| `class_memberships` | 1 |
| `class_invitations` | 1 |
| `lessons` | 3 |
| `cards` | 23 |
| `card_progress` | 22 |
| `review_logs` | 24 |
| `notifications` | 1 |
| `auth_identities` | 2 |

UUID, quyền sở hữu, thành viên lớp, trạng thái xuất bản, lịch ôn và lịch sử trả lời giữ nguyên giá trị trong backup. Nguồn không có bucket hoặc đối tượng Storage cần chuyển.

`auth_identities` giữ Google provider ID và liên kết tới UUID trong `profiles`. Bảng này cho phép phần đăng nhập mới nhận ra tài khoản cũ. Script không đưa mật khẩu, phiên đăng nhập hoặc refresh token của Supabase vào Neon. Mỗi người dùng cần đăng nhập Google lại lần đầu; một lần đăng nhập production đã được xác nhận sau deploy.

## Bản sao và bằng chứng kiểm tra

Backup nguồn có tên `db_cluster-06-10-2026@04-10-07.backup.gz`, PostgreSQL 17.6. SHA-256 của tệp nén là:

```text
6626a9d6c0dde4f9da0d06ab036d6153faa3bb9d81c09f60184934fbf79d7eb2
```

Thư mục riêng tư `backups/supabase-6626a9d6c0dde4f9/` chứa các tệp sau:

- `source.backup.gz`: bản sao nguồn, có cả dữ liệu xác thực Supabase cũ.
- `plan.json`: số hàng, hash nguồn và kết quả kiểm tra Neon trống trước khi nhập.
- `rehearse-verified.json`: kết quả chạy thử trong database tạm.
- `apply-verified.json`: kết quả nhập Neon, chỉ ghi sau khi transaction commit thành công.
- `verify-verified.json`: kết quả đọc lại Neon và so sánh với nguồn sau khi commit.

Các tệp dùng quyền `0600`; thư mục backup dùng quyền `0700`. Git và Vercel đều bỏ qua `backups/`. Báo cáo chứa số hàng và hash, không chứa nội dung hàng hoặc thông tin kết nối. Backup chứa dữ liệu cá nhân và không được đưa lên repository hay gói deploy.

## Lệnh khôi phục

Lệnh chạy từ thư mục repository bằng pnpm 11.25.0. Wrapper đọc cấu hình nội bộ từ `.env`; không nhận chuỗi kết nối hay mật khẩu trên dòng lệnh. Docker và image `public.ecr.aws/supabase/postgres:17.6.1.166` là các yêu cầu để khôi phục nguồn.

```bash
rtk pnpm run db:migrate:backup plan backups/supabase-6626a9d6c0dde4f9/source.backup.gz
rtk pnpm run db:migrate:backup rehearse backups/supabase-6626a9d6c0dde4f9/source.backup.gz
rtk pnpm run db:migrate:backup apply backups/supabase-6626a9d6c0dde4f9/source.backup.gz
rtk pnpm run db:migrate:backup verify backups/supabase-6626a9d6c0dde4f9/source.backup.gz
```

| Chế độ | Hành vi |
| --- | --- |
| `plan` | Khôi phục nguồn trong container riêng và kiểm tra danh sách bảng Neon, không ghi vào Neon. |
| `rehearse` | Nhập vào database tạm trong cùng container, không kết nối Neon. |
| `apply` | Nhập Neon trong một transaction có advisory lock. Từ chối đích đã có dữ liệu khác. Chạy lại cùng backup chỉ kiểm tra và trả `alreadyMigrated`, không tạo bản trùng. |
| `verify` | Đọc dữ liệu Neon, so sánh số hàng và hash với nguồn, không ghi database. |

Mỗi lần chạy tạo container riêng, chỉ mở cổng trên loopback và tự xóa container khi kết thúc. Script không dùng hoặc reset Supabase local đang có. Các lỗi tạo role đã tồn tại trong image được chấp nhận; lỗi SQL khác làm dừng quá trình.

Script sao chép kiểu enum, định nghĩa cột, mặc định, CHECK, khóa chính, khóa duy nhất, khóa ngoại giữa các bảng ứng dụng và index. Khóa `profiles.id` tới `auth.users` được thay bằng liên kết từ `auth_identities.user_id` tới `profiles.id`. Script không sao chép functions, triggers hoặc policies phụ thuộc Supabase Auth. Các bảng nhập bật RLS và thu hồi quyền từ `PUBLIC`.

## Chuyển ứng dụng và xác thực

Ứng dụng đã được chuyển trong mã nguồn sang PostgreSQL/Auth.js. Các thao tác đọc và ghi dùng Neon; role runtime bị giới hạn, RLS và các function giao dịch giữ cách ly giữa các lớp. Các migration của ứng dụng nằm trong `database/migrations`; các lệnh `db:migrate`, `db:verify` và `deploy:prod` quản lý Neon. Năm mốc migration production gồm `000_app_schema.sql` (nhận schema đã có) và `000_auth_users_seed.sql` đến `003_class_insert_returning_policy.sql`.

Auth.js liên kết Google provider ID cũ với UUID profile đã nhập, giữ quyền sở hữu và dữ liệu tiến độ. Không chuyển mật khẩu hay phiên Supabase. Google OAuth đã được cấu hình cho callback Auth.js local/production; client ID và secret nằm trong `.env.local` và Vercel, không nằm trong repository. Sau khi đăng nhập production thành công, secret cũ gắn với callback Supabase đã được disable nhưng chưa xóa để có thể bật lại khi cần rollback. Vercel Production hiện chạy code Neon/Auth.js.

Kiểm thử local bao gồm các luồng giáo viên/học sinh, CSV/Excel, preview không ghi tiến độ, ôn tập và undo trên PostgreSQL cô lập. Production đã được mở bằng trình duyệt để xác nhận đăng nhập và quyền lớp; lệnh `db:verify` xác nhận schema và mapping identity sau migration.
