import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const notoJp = Noto_Sans_JP({ variable: "--font-noto-jp", subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: { default: "Kotoba — Học từ vựng Nhật", template: "%s · Kotoba" },
  description: "Tạo bài học, mời học viên và ôn từ vựng tiếng Nhật đúng lúc.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${notoJp.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
