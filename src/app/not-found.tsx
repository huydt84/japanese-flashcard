import Link from "next/link";
export default function NotFound(){return <main className="grid min-h-[100dvh] place-items-center px-5"><div className="text-center"><p className="font-jp text-7xl font-bold text-brand">迷</p><h1 className="mt-5 text-3xl font-bold">Không tìm thấy trang</h1><p className="mt-3 text-muted">Nội dung có thể đã được chuyển hoặc bạn chưa có quyền xem.</p><Link href="/app" className="button-primary mt-7">Về tổng quan</Link></div></main>}

