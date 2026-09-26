# Kotoba

Kotoba là web app học từ vựng tiếng Nhật dành cho giáo viên và học sinh. Giáo viên tạo lớp, bài học và flashcard; học sinh nhận lời mời trong app và ôn bằng lịch hẹn cá nhân.

## Công nghệ

- Next.js 16 App Router, React 19, TypeScript và Tailwind CSS 4
- Supabase Google OAuth, PostgreSQL, Row Level Security và Realtime-ready notifications
- Lịch ôn cố định và lịch sử câu trả lời được lưu trong PostgreSQL
- Vitest, Playwright và Vercel

Node.js 20.9 trở lên và pnpm 11.25.0 được khuyến nghị. Phiên bản pnpm được cố định trong `packageManager` và `engines.pnpm` để giữ lockfile tương thích với Vercel CLI.

## Lịch ôn

Danh sách mặc định gồm thẻ chưa học và thẻ đã đến hạn. Học sinh có thể xem và luyện riêng nhóm Sai, Chưa chắc, Đúng hoặc tất cả thẻ; nhóm được xác định bởi câu trả lời gần nhất. Sai đến hạn ngay ở phiên kế tiếp, Chưa chắc sau 1 giờ. Bốn lần Đúng liên tiếp lần lượt hẹn sau 6 giờ, 1 ngày, 2 ngày, rồi đánh dấu đã thuộc và không có hạn. Sai hoặc Chưa chắc đặt lại chuỗi Đúng. Ôn thẻ ghi nhớ theo bất kỳ nhóm nào đều cập nhật lịch; trắc nghiệm không cập nhật lịch.

## Chạy local

`.env` là nguồn cấu hình chuẩn cho development dùng backend thật và cho mỗi lần deploy. Tạo file này từ template một lần, sau đó điền cấu hình production:

```bash
pnpm install
cp .env.template .env
pnpm dev
```

Next.js tự đọc `.env`. File này bị Git bỏ qua, còn `.env.template` được commit để làm danh sách biến chính thức.

Ngoài ba biến `NEXT_PUBLIC_*`, điền `SUPABASE_PROJECT_REF` và `SUPABASE_ACCESS_TOKEN`. Có thể thêm `SUPABASE_DB_PASSWORD` nếu tài khoản không dùng được kết nối CLI passwordless. Các biến quản trị này chỉ được truyền cho Supabase CLI, không bao giờ được đồng bộ lên Vercel. Kiểm tra cấu hình mà không thay đổi hệ thống bên ngoài bằng:

```bash
pnpm run env:check
pnpm run db:migrate:dry-run
```

Để debug hoàn toàn cô lập với Supabase local, điền ba biến `LOCAL_*` trong cùng file `.env`, khởi động Supabase rồi chạy:

```bash
pnpm run db:up:local
pnpm run db:migrate:local
pnpm run dev:local
```

`dev:local` ánh xạ các biến `LOCAL_*` sang cấu hình runtime và chỉ bật endpoint đăng nhập kiểm thử trong development. Nó không thay đổi `.env` và không thể đưa địa chỉ localhost lên Vercel. Không đặt service-role key vào biến `NEXT_PUBLIC_*`. Mỗi khi sửa `.env`, hãy khởi động lại server.

Các lệnh database tương ứng:

```bash
pnpm run db:status:local       # xem trạng thái Supabase local
pnpm run db:migrate:local      # áp dụng migration còn thiếu ở local
pnpm run db:reset:local        # chủ động reset local rồi chạy lại migration + seed
pnpm run db:down:local         # dừng Supabase local, giữ dữ liệu
pnpm run db:link               # liên kết CLI với project trong .env
pnpm run db:history            # so sánh migration local và production
pnpm run db:inspect            # xem thống kê bảng production (read-only)
pnpm run db:verify             # kiểm tra các mốc schema production (read-only)
pnpm run db:migrate:dry-run    # xem trước migration production
pnpm run db:migrate            # áp dụng migration production còn thiếu
```

## Thiết lập Supabase

1. Tạo một Supabase project.
2. Chạy toàn bộ tệp trong `supabase/migrations` theo thứ tự tên bằng Supabase CLI hoặc SQL Editor.
3. Trong Authentication, bật Google provider và nhập Google OAuth client ID/secret.
4. Trong Google Cloud Console, thêm Supabase callback URL được hiển thị trong cấu hình Google provider.
5. Trong Supabase URL Configuration, thêm `http://localhost:3000/auth/callback`, domain production và các Vercel preview cần kiểm thử.
6. Sao chép Project URL và publishable key vào `.env`. Không chỉnh tay Vercel Environment Variables; lệnh deploy sẽ đồng bộ chúng từ file này.

Migration tạo toàn bộ bảng, database functions, review/undo transaction và RLS. Không dùng service-role key trong frontend.

## Nhập thẻ từ Excel

Trong trang buổi học, mở **Nhập từ Excel**, tải tệp mẫu và thay hàng ví dụ bằng nội dung của bạn. Lưu tệp ở định dạng `.xlsx`, chọn tệp rồi bấm **Kiểm tra và nhập thẻ**.

Trang tính đầu tiên phải có đúng năm cột A–E. Hàng 1 là tiêu đề chính xác theo thứ tự dưới đây; mỗi hàng từ hàng 2 là một thẻ:

| Cột | Tiêu đề hàng 1 | Nội dung | Ví dụ hàng 2 |
| --- | --- | --- | --- |
| A | `kanji` | Từ hoặc chữ Hán | 学ぶ |
| B | `hiragana` | Cách đọc bằng hiragana | まなぶ |
| C | `meaning_vi` | Nghĩa tiếng Việt | học, học hỏi |
| D | `example_ja` | Câu ví dụ tiếng Nhật | 毎日、日本語を学びます。 |
| E | `example_vi` | Bản dịch câu ví dụ | Tôi học tiếng Nhật mỗi ngày. |

Điền đủ cả năm ô bằng văn bản. Không dùng công thức, số, ngày hay cột bổ sung. Hàng trống được bỏ qua. Mỗi tệp chứa tối đa 500 thẻ và có kích thước tối đa 750 KB. Nếu một hàng có lỗi, hệ thống sẽ báo số hàng và không nhập thẻ nào trong tệp.

## Biểu tượng và ảnh chia sẻ

Các tài nguyên thương hiệu được commit trong `src/app`:

- `favicon.ico`: biểu tượng tab trình duyệt ở nhiều kích thước.
- `icon.png`: biểu tượng PNG 192 × 192.
- `apple-icon.png`: biểu tượng Apple 180 × 180.
- `opengraph-image.png`: ảnh xem trước khi chia sẻ liên kết, kích thước 1200 × 630. Nội dung thay thế trong `opengraph-image.alt.txt` là “Kotoba — Học từ vựng tiếng Nhật bằng flashcard.”

`src/app/layout.tsx` khai báo metadata tĩnh cho tiêu đề, mô tả, Open Graph và Twitter. `metadataBase` lấy URL qua `siteUrl()`, ưu tiên `NEXT_PUBLIC_SITE_URL`; đặt biến này thành domain production để liên kết ảnh chia sẻ có địa chỉ tuyệt đối đúng.

Để tạo lại các ảnh sau khi sửa thiết kế trong script:

```bash
node scripts/generate-brand-assets.mjs
```

Lệnh cần Playwright Chromium (`pnpm exec playwright install chromium`) và kết nối internet tới Google Fonts. Commit các ảnh được tạo lại; production phục vụ trực tiếp các tệp tĩnh này, không chạy script hay tải font để tạo ảnh.

## Kiểm tra chất lượng

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Nếu máy chưa có browser của Playwright: `pnpm exec playwright install chromium webkit`.

Để chạy toàn bộ luồng trình duyệt với giáo viên và học sinh thật trên Supabase local, khởi động stack bằng `pnpm run db:up:local`, rồi chạy `pnpm run test:e2e:local`. Lệnh này tạo tài khoản kiểm thử riêng cho từng kịch bản, khởi động app tại cổng 3110 và xóa tài khoản sau khi hoàn thành. Có thể thêm đường dẫn hoặc bộ lọc Playwright sau `--`, ví dụ `pnpm run test:e2e:local -- tests/e2e/teacher-student-flow.spec.ts`.

## Deploy Vercel

Sau khi cấu hình Supabase và Google OAuth, chạy một lệnh:

```bash
pnpm run deploy:prod
```

`deploy:prod` đọc `.env`, kiểm tra toàn bộ contract, áp dụng migration production, đồng bộ duy nhất các dòng public được đánh dấu `@vercel` trong `.env.template` lên Vercel Production và Preview, rồi mới deploy. Lệnh sẽ dừng ngay nếu thiếu credential, project ref không khớp URL, migration lỗi hoặc URL production trỏ vào localhost. Các biến được đánh dấu `@supabase-cli` không bao giờ được gửi lên Vercel. Personal access token nên có hạn dùng và phải được xoay trong `.env` trước khi hết hạn.

`vercel.json` đặt Functions tại Tokyo (`hnd1`), cùng vùng với Supabase production (`ap-northeast-1`). Giữ máy chủ ứng dụng gần database để các thao tác học, mời và chuyển vai trò không phải thực hiện nhiều lượt gọi xuyên Thái Bình Dương. Nếu chuyển vùng database, cập nhật cấu hình này và deploy lại.

`.vercelignore` loại bỏ `.env`, cache build local (`.next`, `.next-*`), báo cáo kiểm thử và trạng thái Supabase CLI khỏi gói upload. Vercel CLI không dùng `.gitignore` để loại bỏ các tệp này. Không bỏ qua `pnpm-lock.yaml`: Vercel cần lockfile để nhận diện package manager và cài đúng dependency. Giữ pnpm 11.25.0 khi dùng Vercel CLI 58.4.4; lockfile nhiều YAML document của pnpm 12 khiến CLI này báo lỗi parse và nhận diện sai package manager.

Để xem trước các tệp sẽ upload mà không deploy hoặc thay đổi database/environment:

```bash
pnpm exec vercel deploy --dry --json
```

Sau lần deploy đầu, cập nhật Site URL/Redirect URLs trong Supabase và Authorized origins/redirects trong Google Cloud bằng domain production, rồi đăng nhập thử trên domain thật.

## Cấu trúc chính

- `src/app/teacher`: lớp, bài học, card editor, invitation và tiến độ
- `src/app/student`: lớp, notification và bài học đã xuất bản
- `src/app/study`: danh sách từ vựng, phiên thẻ ghi nhớ và trắc nghiệm
- `src/app/actions.ts`: mutations đã xác thực
- `supabase/migrations`: schema, transaction functions và RLS
- `PRODUCT.md`: product truth đã xác nhận
