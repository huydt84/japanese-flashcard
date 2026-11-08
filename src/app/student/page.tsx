import { Suspense } from "react";
import Link from "next/link";
import { ArrowRightIcon, Bell } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/components/empty-state";
import { requireProfile } from "@/lib/auth";
import { getStudentClasses } from "@/lib/queries";
import { getStudentNotifications } from "@/lib/student-notifications";

export default function StudentHome() {
  return (
    <div className="mx-auto max-w-6xl">
      <header><h1 className="text-4xl font-bold tracking-[-.035em] sm:text-5xl">Hôm nay học gì?</h1><p className="mt-3 text-lg text-muted">Những bài đã sẵn sàng đang chờ bạn.</p></header>
      <Suspense fallback={null}><InvitationNotice /></Suspense>
      <Suspense fallback={<p role="status" className="mt-10 text-muted">Đang tải bài học…</p>}><StudentClasses /></Suspense>
    </div>
  );
}

async function StudentClasses() {
  const { actorId } = await requireProfile("student");
  const classes = await getStudentClasses(actorId);
  return <section className="mt-10"><h2 className="text-2xl font-bold">Lớp của bạn</h2><div className="mt-5">{!classes.length ? <EmptyState title="Chưa tham gia lớp nào" description="Khi giáo viên mời đúng email Google này, lời mời sẽ xuất hiện trong Thông báo." action={<Link href="/student/notifications" className="button-secondary">Mở thông báo</Link>} /> : <div className="space-y-8">{classes.map((klass) => <article key={klass.id}><div className="border-b border-line pb-3"><h3 className="text-xl font-bold">{klass.name}</h3><p className="mt-1 text-sm text-muted">{klass.description}</p></div><div className="divide-y divide-line">{klass.lessons.map((lesson) => <Link key={lesson.id} href={`/study/${lesson.id}`} className="group flex items-center justify-between gap-4 py-5"><div><p className="font-bold group-hover:text-brand">{lesson.title}</p><p className="mt-1 text-sm font-semibold text-muted"><span className={lesson.due_count > 0 ? "text-brand" : "text-correct"}>{lesson.due_count > 0 ? `${lesson.due_count} thẻ đến hạn` : "Hiện chưa có thẻ đến hạn"}</span><span aria-hidden="true"> · </span>{lesson.card_count} thẻ tất cả</p></div><span className="button-secondary shrink-0">Xem bài học <ArrowRightIcon /></span></Link>)}{!klass.lessons.length && <p className="py-5 text-muted">Giáo viên chưa xuất bản bài học.</p>}</div></article>)}</div>}</div></section>;
}

async function InvitationNotice() {
  const { invites } = await getStudentNotifications();
  return invites.length > 0 ? (
    <Link href="/student/notifications" className="mt-8 flex items-center justify-between rounded-2xl bg-brand p-5 text-white">
      <span className="flex items-center gap-3 font-bold"><Bell size={22} />{invites.length} lời mời lớp học mới</span>
      <ArrowRightIcon />
    </Link>
  ) : null;
}
