import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightIcon, EnvelopeSimple, Plus, X } from "@phosphor-icons/react/dist/ssr";
import { createLesson, inviteStudent, revokeInvitation } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { EmptyState } from "@/components/empty-state";
import { requireProfile } from "@/lib/auth";
import { getTeacherClass } from "@/lib/queries";

export default async function ClassPage({ params }: PageProps<"/teacher/classes/[classId]">) {
  const { classId } = await params;
  const { actorId } = await requireProfile("teacher");
  const { klass, lessons, members, invites, progress } = await getTeacherClass(actorId, classId);
  if (!klass) notFound();
  const progressByStudent = new Map(progress.map((item) => [item.student_id, item]));

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/teacher" className="quiet-link inline-flex min-h-11 items-center gap-2">
        <ArrowLeft aria-hidden="true" /> Tất cả lớp
      </Link>
      <header className="mt-5">
        <h1 className="break-words text-4xl font-bold tracking-[-.035em] sm:text-5xl">{klass.name}</h1>
        <p className="mt-3 max-w-3xl break-words text-lg text-muted">{klass.description || "Chưa có mô tả."}</p>
      </header>

      <div className="mt-10 grid gap-10 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <section aria-labelledby="lessons-heading">
            <h2 id="lessons-heading" className="text-2xl font-bold">Bài học</h2>
            <div className="mt-5">
              {!lessons?.length ? (
                <EmptyState title="Chưa có bài học" description="Tạo bài mới ở bên cạnh, thêm thẻ rồi xuất bản cho học viên." />
              ) : (
                <div className="divide-y divide-line border-y border-line">
                  {lessons.map((lesson) => (
                    <Link key={lesson.id} href={`/teacher/classes/${classId}/lessons/${lesson.id}`} className="group flex items-center justify-between gap-4 py-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="break-words text-lg font-bold group-hover:text-brand">{lesson.title}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${lesson.status === "published" ? "bg-correct/10 text-correct" : "bg-line/60 text-muted"}`}>{lesson.status === "published" ? "Đã xuất bản" : "Bản nháp"}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted">{lesson.card_count} thẻ</p>
                      </div>
                      <ArrowRightIcon className="shrink-0" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="mt-12" aria-labelledby="progress-heading">
            <h2 id="progress-heading" className="text-2xl font-bold">Tiến độ học viên</h2>
            <div className="mt-5 overflow-x-auto border-y border-line" tabIndex={0} aria-label="Bảng tiến độ học viên, có thể cuộn ngang">
              <table className="w-full min-w-[620px] text-left">
                <thead className="text-xs font-bold text-muted"><tr><th className="py-3 pr-4">Học viên</th><th className="px-3 py-3">Đã học</th><th className="px-3 py-3">Đến hạn</th><th className="px-3 py-3">Tỷ lệ đúng</th><th className="py-3 pl-3">Lần gần nhất</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {members.map((member) => {
                    const stats = progressByStudent.get(member.student_id);
                    return <tr key={member.student_id}><td className="py-4 pr-4"><p className="font-bold">{member.display_name || "Học viên"}</p><p className="text-sm text-muted">{member.email}</p></td><td className="px-3 py-4 font-semibold tabular-nums">{stats?.studied ?? 0}/{stats?.total ?? 0}</td><td className="px-3 py-4 font-semibold tabular-nums">{stats?.due ?? 0}</td><td className="px-3 py-4 font-semibold tabular-nums">{stats?.review_count ? `${Math.round((stats.good_reviews / stats.review_count) * 100)}%` : "—"}</td><td className="py-4 pl-3 text-sm text-muted">{stats?.last_review ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(stats.last_review)) : "Chưa học"}</td></tr>;
                  })}
                  {!members.length && <tr><td colSpan={5} className="py-8 text-center text-muted">Chưa có học viên tham gia.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-7">
          <div className="rounded-2xl bg-surface-strong p-6 paper-shadow">
            <div className="flex items-center gap-3"><Plus size={22} className="text-brand" aria-hidden="true" /><h2 className="text-xl font-bold">Tạo bài học</h2></div>
            <ActionForm action={createLesson.bind(null, classId)} className="mt-5 space-y-4" submitClassName="button-primary w-full" submitLabel="Tạo bài" pendingLabel="Đang tạo bài">
              <div><label className="label" htmlFor="title">Tên bài</label><input className="field" id="title" name="title" required minLength={2} maxLength={100} defaultValue={`Buổi ${(lessons?.length ?? 0) + 1}`} /></div>
              <div><label className="label" htmlFor="lesson-description">Mô tả</label><textarea className="field" id="lesson-description" name="description" rows={2} maxLength={300} /></div>
            </ActionForm>
          </div>

          <div className="rounded-2xl bg-surface p-6">
            <div className="flex items-center gap-3"><EnvelopeSimple size={22} aria-hidden="true" /><h2 className="text-xl font-bold">Mời học viên</h2></div>
            <ActionForm action={inviteStudent.bind(null, classId)} className="mt-5 space-y-3" submitClassName="button-primary w-full sm:w-auto" submitLabel="Mời" pendingLabel="Đang gửi" resetOnSuccess>
              <div><label className="sr-only" htmlFor="invite-email">Email học viên</label><input className="field" id="invite-email" name="email" type="email" required maxLength={254} placeholder="hocvien@gmail.com" /></div>
            </ActionForm>
            {invites.length ? <div className="mt-5 space-y-3">{invites.map((invite) => <div key={invite.id} className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0 break-all text-sm text-muted">{invite.email}</span><ActionForm action={revokeInvitation.bind(null, invite.id, classId)} submitClassName="button-secondary shrink-0" submitLabel="Thu hồi" pendingLabel="Đang thu hồi" confirmMessage={`Thu hồi lời mời gửi đến ${invite.email}?`} icon={<X aria-hidden="true" />} /></div>)}</div> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
