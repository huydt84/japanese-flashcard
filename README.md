# Kotoba

Kotoba là web app học từ vựng tiếng Nhật dành cho giáo viên và học sinh. Giáo viên tạo lớp, bài học và flashcard; học sinh nhận lời mời trong app và ôn bằng lịch FSRS cá nhân.

## Công nghệ

- Next.js 16 App Router, React 19, TypeScript và Tailwind CSS 4
- Supabase Google OAuth, PostgreSQL, Row Level Security và Realtime-ready notifications
- `ts-fsrs` cho spaced repetition
- Vitest, Playwright và Vercel

Node.js 20.9 trở lên và pnpm 12 được khuyến nghị.

## Chạy local

`.env` là nguồn cấu hình chuẩn cho development dùng backend thật và cho mỗi lần deploy. Tạo file này từ template một lần, sau đó điền cấu hình production:

```bash
pnpm install
cp .env.template .env
pnpm dev
```

Next.js tự đọc `.env`. File này bị Git bỏ qua, còn `.env.template` được commit để làm danh sách biến chính thức.

Để debug hoàn toàn cô lập với Supabase local, điền ba biến `LOCAL_*` trong cùng file `.env`, khởi động Supabase rồi chạy:

```bash
pnpm dlx supabase start
pnpm run dev:local
```

`dev:local` ánh xạ các biến `LOCAL_*` sang cấu hình runtime và chỉ bật endpoint đăng nhập kiểm thử trong development. Nó không thay đổi `.env` và không thể đưa địa chỉ localhost lên Vercel. Không đặt service-role key vào biến `NEXT_PUBLIC_*`. Mỗi khi sửa `.env`, hãy khởi động lại server.

## Thiết lập Supabase

1. Tạo một Supabase project.
2. Chạy `supabase/migrations/202609160001_initial_schema.sql` bằng Supabase CLI hoặc SQL Editor.
3. Trong Authentication, bật Google provider và nhập Google OAuth client ID/secret.
4. Trong Google Cloud Console, thêm Supabase callback URL được hiển thị trong cấu hình Google provider.
5. Trong Supabase URL Configuration, thêm `http://localhost:3000/auth/callback`, domain production và các Vercel preview cần kiểm thử.
6. Sao chép Project URL và publishable key vào `.env`. Không chỉnh tay Vercel Environment Variables; lệnh deploy sẽ đồng bộ chúng từ file này.

Migration tạo toàn bộ bảng, database functions, review/undo transaction và RLS. Không dùng service-role key trong frontend.

## CSV flashcard

Header phải đúng thứ tự:

```csv
kanji,hiragana,meaning_vi,example_ja,example_vi
学ぶ,まなぶ,"học, học hỏi",毎日、日本語を学びます。,Tôi học tiếng Nhật mỗi ngày.
```

Giá trị có dấu phẩy phải được đặt trong dấu ngoặc kép.

## Kiểm tra chất lượng

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Nếu máy chưa có browser của Playwright: `pnpm exec playwright install chromium webkit`.

## Deploy Vercel

Sau khi cấu hình Supabase và Google OAuth, chạy một lệnh:

```bash
pnpm run deploy:prod
```

`deploy:prod` đọc `.env`, dùng `.env.template` làm allowlist, đồng bộ mọi biến không bắt đầu bằng `LOCAL_` lên Vercel Production và Preview, rồi mới deploy. Lệnh sẽ dừng nếu thiếu biến hoặc nếu URL production trỏ vào localhost. Việc này khiến `.env` trở thành nguồn cấu hình chính thay vì dựa vào giá trị chỉ tồn tại trong Vercel.

Sau lần deploy đầu, cập nhật Site URL/Redirect URLs trong Supabase và Authorized origins/redirects trong Google Cloud bằng domain production, rồi đăng nhập thử trên domain thật.

## Cấu trúc chính

- `src/app/teacher`: lớp, bài học, card editor, invitation và tiến độ
- `src/app/student`: lớp, notification và bài học đã xuất bản
- `src/app/study`: phiên flashcard FSRS
- `src/app/actions.ts`: mutations đã xác thực
- `supabase/migrations`: schema, transaction functions và RLS
- `PRODUCT.md`: product truth đã xác nhận
