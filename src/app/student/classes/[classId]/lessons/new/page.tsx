import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { createLesson } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { requireProfile } from "@/lib/auth";
import { getStudentClass } from "@/lib/queries";

export default async function NewStudentLesson({ params }: PageProps<"/student/classes/[classId]/lessons/new">) {
  const { classId } = await params;
  const { actorId } = await requireProfile("student");
  const klass = await getStudentClass(actorId, classId);
  if (!klass) notFound();

  return <div className="mx-auto max-w-2xl">
    <Link href="/student" className="quiet-link inline-flex min-h-11 items-center gap-2"><ArrowLeft aria-hidden="true" />Quay lại lớp của bạn</Link>
    <header className="mt-5">
      <h1 className="text-4xl font-bold tracking-[-.035em]">Tạo bài học cá nhân</h1>
      <p className="mt-3 break-words text-lg text-muted">{klass.name}</p>
      <p className="mt-3 text-muted">Chỉ bạn và giáo viên của lớp có thể xem bài học này, kể cả sau khi xuất bản.</p>
    </header>
    <ActionForm action={createLesson.bind(null, classId)} className="mt-8 space-y-5 rounded-2xl bg-surface-strong p-6 paper-shadow" submitClassName="button-primary w-full sm:w-auto" submitLabel="Tạo bài" pendingLabel="Đang tạo bài">
      <div><label className="label" htmlFor="title">Tên bài</label><input className="field" id="title" name="title" required minLength={2} maxLength={100} /></div>
      <div><label className="label" htmlFor="description">Mô tả</label><textarea className="field" id="description" name="description" rows={3} maxLength={300} /></div>
    </ActionForm>
  </div>;
}
