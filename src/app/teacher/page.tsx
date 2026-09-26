import Link from "next/link";
import { ArrowRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { createClass } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { EmptyState } from "@/components/empty-state";
import { requireProfile } from "@/lib/auth";

export default async function TeacherHome() {
  const { profile, supabase } = await requireProfile("teacher");
  const { data: classes } = await supabase
    .from("classes")
    .select("id,name,description,created_at,class_memberships(count),lessons(count)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <h1 className="text-4xl font-bold tracking-[-.035em] sm:text-5xl">
          Chào {profile.display_name?.split(" ").at(-1) || "bạn"}.
        </h1>
        <p className="mt-3 text-lg text-muted">Chuẩn bị bài học tiếp theo từ đây.</p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="classes-heading">
          <h2 id="classes-heading" className="text-2xl font-bold">Lớp của bạn</h2>
          <div className="mt-5">
            {!classes?.length ? (
              <EmptyState title="Chưa có lớp nào" description="Tạo lớp đầu tiên, sau đó thêm bài học và mời học viên." />
            ) : (
              <div className="divide-y divide-line border-y border-line">
                {classes.map((klass) => (
                  <Link key={klass.id} href={`/teacher/classes/${klass.id}`} className="group flex items-center justify-between gap-5 py-5">
                    <div className="min-w-0">
                      <h3 className="break-words text-lg font-bold group-hover:text-brand">{klass.name}</h3>
                      <p className="mt-1 line-clamp-2 break-words text-sm text-muted">{klass.description || "Chưa có mô tả"}</p>
                      <p className="mt-2 text-xs font-semibold tabular-nums text-muted">{klass.lessons?.[0]?.count ?? 0} bài · {klass.class_memberships?.[0]?.count ?? 0} học viên</p>
                    </div>
                    <ArrowRight size={22} className="shrink-0" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-2xl bg-surface-strong p-6 paper-shadow">
          <div className="flex items-center gap-3">
            <Plus size={24} className="text-brand" aria-hidden="true" />
            <h2 className="text-xl font-bold">Tạo lớp mới</h2>
          </div>
          <ActionForm action={createClass} className="mt-6 space-y-5" submitClassName="button-primary w-full" submitLabel="Tạo lớp" pendingLabel="Đang tạo lớp">
            <div>
              <label className="label" htmlFor="name">Tên lớp</label>
              <input className="field" id="name" name="name" required minLength={2} maxLength={80} placeholder="Tên lớp học" />
            </div>
            <div>
              <label className="label" htmlFor="description">Mô tả</label>
              <textarea className="field" id="description" name="description" rows={3} maxLength={240} placeholder="Mục tiêu hoặc lịch học của lớp" />
            </div>
          </ActionForm>
        </aside>
      </div>
    </div>
  );
}
