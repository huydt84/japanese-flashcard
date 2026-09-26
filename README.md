# Kotoba

Kotoba là web app học từ vựng tiếng Nhật dành cho giáo viên và học sinh. Giáo viên tạo lớp, bài học và flashcard; học sinh nhận lời mời trong app và ôn bằng lịch FSRS cá nhân.

## Công nghệ

- Next.js 16 App Router, React 19, TypeScript và Tailwind CSS 4
- Supabase Google OAuth, PostgreSQL, Row Level Security và Realtime-ready notifications
- `ts-fsrs` cho spaced repetition
- Vitest, Playwright và Vercel

Node.js 20.9 trở lên và pnpm 12 được khuyến nghị.

## Chạy local

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Nếu chưa có biến Supabase, landing page vẫn chạy và hiển thị hướng dẫn cấu hình; đăng nhập chưa hoạt động.

## Thiết lập Supabase

1. Tạo một Supabase project.
2. Chạy `supabase/migrations/202609160001_initial_schema.sql` bằng Supabase CLI hoặc SQL Editor.
3. Trong Authentication, bật Google provider và nhập Google OAuth client ID/secret.
4. Trong Google Cloud Console, thêm Supabase callback URL được hiển thị trong cấu hình Google provider.
5. Trong Supabase URL Configuration, thêm `http://localhost:3000/auth/callback`, domain production và các Vercel preview cần kiểm thử.
6. Sao chép Project URL và publishable key vào `.env.local` và Vercel Environment Variables.

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

Sau khi cấu hình Supabase và Google OAuth:

```bash
vercel
vercel env add NEXT_PUBLIC_SITE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel --prod
```

Sau lần deploy đầu, cập nhật Site URL/Redirect URLs trong Supabase và Authorized origins/redirects trong Google Cloud bằng domain production, rồi đăng nhập thử trên domain thật.

## Cấu trúc chính

- `src/app/teacher`: lớp, bài học, card editor, invitation và tiến độ
- `src/app/student`: lớp, notification và bài học đã xuất bản
- `src/app/study`: phiên flashcard FSRS
- `src/app/actions.ts`: mutations đã xác thực
- `supabase/migrations`: schema, transaction functions và RLS
- `PRODUCT.md`: product truth đã xác nhận

