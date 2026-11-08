# Kotoba

Kotoba là web app học từ vựng tiếng Nhật dành cho giáo viên và học sinh. Giáo viên tạo lớp, bài học và flashcard; học sinh nhận lời mời trong app và ôn bằng lịch hẹn cá nhân.

## Công nghệ

- Next.js 16 App Router, React 19, TypeScript và Tailwind CSS 4
- Auth.js Google OAuth, Neon PostgreSQL, Row Level Security và thông báo trong ứng dụng
- Lịch ôn cố định và lịch sử câu trả lời được lưu trong PostgreSQL
- Vitest, Playwright và Vercel

Node.js 20.9 trở lên và pnpm 11.25.0 được khuyến nghị. Phiên bản pnpm được cố định trong `packageManager` và `engines.pnpm` để giữ lockfile tương thích với Vercel CLI.

## Lịch ôn

Danh sách mặc định gồm thẻ chưa học và thẻ đã đến hạn. Học sinh có thể xem và luyện riêng nhóm Sai, Chưa chắc, Đúng hoặc tất cả thẻ; nhóm được xác định bởi câu trả lời gần nhất. Sai đến hạn ngay ở phiên kế tiếp, Chưa chắc sau 1 giờ. Bốn lần Đúng liên tiếp lần lượt hẹn sau 6 giờ, 1 ngày, 2 ngày, rồi đánh dấu đã thuộc và không có hạn. Sai hoặc Chưa chắc đặt lại chuỗi Đúng. Ôn thẻ ghi nhớ theo bất kỳ nhóm nào đều cập nhật lịch; trắc nghiệm không cập nhật lịch.

## Chạy local

`.env.local` giữ kết nối runtime giới hạn quyền, khóa Auth.js và thông tin Google OAuth. `.env` hiện có giữ kết nối chủ sở hữu Neon chỉ dành cho migrations; các script database đọc giá trị này bên trong và không gửi nó lên Vercel. Không thay `DATABASE_URL` migration bằng kết nối runtime.

```bash
rtk pnpm install --frozen-lockfile
rtk pnpm run dev
```

`DATABASE_URL` runtime được tạo và lưu vào `.env.local` khi migration đầu tiên tạo role `kotoba_runtime`. `.env.template` liệt kê biến production; script deploy đọc giá trị runtime từ `.env.local` để chỉ đồng bộ role giới hạn lên Vercel.

Kiểm tra cấu hình và migration production trước khi áp dụng:

```bash
rtk pnpm run env:check
rtk pnpm run db:migrate:dry-run
```

Để kiểm thử đăng nhập, phân quyền và dữ liệu hoàn toàn cô lập, dùng PostgreSQL local:

```bash
rtk pnpm run db:up:local
rtk pnpm run db:migrate:local
rtk pnpm run dev:local
```

Stack kiểm thử dùng container `kotoba-postgres-local`, chỉ mở cổng loopback 55439, volume được giữ lại khi dừng và không kết nối Neon production. Auth.js Credentials provider cùng endpoint test chỉ bật trong development cục bộ khi `ALLOW_TEST_AUTH=1`; production không có đường đăng nhập này.

Các lệnh database tương ứng:

```bash
rtk pnpm run db:status:local       # xem trạng thái PostgreSQL local
rtk pnpm run db:migrate:local      # áp dụng migration còn thiếu ở local
rtk pnpm run db:reset:local -- --confirm-reset-local-data # chỉ dùng khi chủ động xóa dữ liệu local
rtk pnpm run db:down:local         # dừng container local, giữ dữ liệu
rtk pnpm run db:history            # xem migration production
rtk pnpm run db:inspect            # xem thống kê bảng production (read-only)
rtk pnpm run db:verify             # kiểm tra schema và quyền runtime (read-only)
rtk pnpm run db:migrate:dry-run    # xem trước migration production
rtk pnpm run db:migrate            # áp dụng migration production còn thiếu
```

## Neon và Google OAuth

1. Neon project `japanese-flashcard` dùng PostgreSQL ở Singapore. Migration đầu tiên tạo role `kotoba_runtime` không sở hữu bảng và không có `BYPASSRLS`.
2. Tạo OAuth Client loại Web trong Google Cloud Console. Thêm callback `http://localhost:3000/api/auth/callback/google` và `https://japanese-flashcard-nu.vercel.app/api/auth/callback/google`.
3. Lưu `AUTH_GOOGLE_ID` và `AUTH_GOOGLE_SECRET` trong `.env.local`. Lệnh `rtk pnpm run db:prepare:runtime` tạo kết nối ứng dụng giới hạn và một `AUTH_SECRET` ổn định trong `.env.local`.
4. `rtk pnpm run deploy:prod` chuẩn bị role runtime, kiểm tra biến, xem trước/ap dụng migration bằng kết nối owner từ `.env`, đồng bộ kết nối runtime và OAuth từ `.env.local` lên Vercel Production/Preview, rồi deploy.

Auth.js lưu liên kết Google vào PostgreSQL. UUID profile cũ được giữ nguyên nên lớp, thành viên, thẻ và lịch ôn tiếp tục thuộc cùng tài khoản Google. Người dùng cần đăng nhập Google lại một lần; mật khẩu và phiên Supabase cũ không được chuyển.

## Khôi phục dữ liệu sang Neon

Dữ liệu từ backup Supabase ngày 2026-10-06 đã được nhập và đối chiếu trên Neon ngày 2026-11-02. [Báo cáo di trú](docs/data-migration.md) ghi số lượng, vị trí backup riêng tư và cách xác minh.

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

## Nhập thẻ từ CSV hoặc dán CSV

Trong trang buổi học, mở **Nhập từ CSV**. Chọn **Tải tệp CSV** để nhập tệp `.csv` lưu bằng UTF-8, hoặc **Dán nội dung CSV** để nhập trực tiếp văn bản. Có thể tải tệp mẫu ngay trong mục này. Bấm **Kiểm tra và nhập CSV** để thêm thẻ vào cuối danh sách hiện có.

Hàng đầu phải có đúng năm tiêu đề như Excel, cùng thứ tự. Dùng dấu phẩy để phân cách cột và điền đủ cả năm trường:

```csv
kanji,hiragana,meaning_vi,example_ja,example_vi
学ぶ,まなぶ,"học, học hỏi",毎日、日本語を学びます。,Tôi học tiếng Nhật mỗi ngày.
```

Đặt trường có dấu phẩy hoặc xuống dòng trong dấu ngoặc kép. Dấu ngoặc kép bên trong trường phải viết thành hai dấu liền nhau, ví dụ `"Tôi đọc ""sách""."`. Hỗ trợ UTF-8 có hoặc không có BOM và xuống dòng Windows hoặc Unix. Không tự đoán mã hóa Shift-JIS hay đổi dấu phân cách thành dấu chấm phẩy.

Mỗi lần nhập tối đa 500 thẻ và 750 KB, áp dụng cho cả tệp lẫn nội dung dán. Hàng trống được bỏ qua. Nếu có lỗi, ứng dụng báo số dòng trong nguồn CSV và không nhập thẻ nào; nội dung đã dán được giữ lại để sửa. Các thẻ mới dùng quyền sở hữu và trạng thái xuất bản của bài học hiện tại.

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
rtk pnpm run lint
rtk pnpm run typecheck
rtk pnpm test
rtk pnpm run test:e2e
rtk pnpm run build
```

Nếu máy chưa có browser của Playwright: `pnpm exec playwright install chromium webkit`.

Để chạy toàn bộ luồng trình duyệt trên PostgreSQL local, chạy `rtk pnpm run db:up:local`, `rtk pnpm run db:migrate:local`, rồi `rtk pnpm run test:e2e:local`. Lệnh test quản lý server ở cổng 3110, tạo/xóa người dùng thử và không dùng dữ liệu production. Có thể chỉ định suite, ví dụ `rtk pnpm run test:e2e:local -- tests/e2e/teacher-student-flow.spec.ts`.

## Deploy Vercel

Sau khi cấu hình Google OAuth và biến runtime, chạy:

```bash
rtk pnpm run deploy:prod
```

`deploy:prod` kiểm tra domain và OAuth, chạy migration bằng kết nối owner Neon, chỉ đồng bộ những biến được đánh dấu `@vercel` và sau đó deploy. Kết nối owner không được gửi lên Vercel; ứng dụng production dùng `kotoba_runtime` với RLS. Nếu một migration thất bại, lệnh dừng trước khi deploy.

`vercel.json` đặt Functions tại Singapore (`sin1`), cùng vùng AWS với Neon. [Vercel xác nhận `sin1` là Singapore (`ap-southeast-1`)](https://vercel.com/docs/regions).

`.vercelignore` loại bỏ `.env*`, backup, cache build local, báo cáo kiểm thử và trạng thái Supabase CLI khỏi gói upload. Vercel CLI không dùng `.gitignore` để loại bỏ các tệp này. Giữ `pnpm-lock.yaml` và pnpm 11.25.0 để Vercel dùng đúng package manager đã khóa.

Để xem trước các tệp sẽ upload mà không deploy hoặc thay đổi database/environment:

```bash
rtk pnpm exec vercel deploy --dry --json
```

Sau deploy, đăng nhập thử bằng Google trên domain production và xác nhận quyền lớp học, nhập thẻ, lịch ôn và undo.

## Cấu trúc chính

- `src/app/teacher`: lớp, bài học, card editor, invitation và tiến độ
- `src/app/student`: lớp, notification và bài học đã xuất bản
- `src/app/study`: danh sách từ vựng, phiên thẻ ghi nhớ và trắc nghiệm
- `src/app/actions.ts`: mutations đã xác thực
- `database/migrations`: schema PostgreSQL, Auth.js profile sync, domain commands và RLS
- `PRODUCT.md`: product truth đã xác nhận
