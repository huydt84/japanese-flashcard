import { Check, X } from "@phosphor-icons/react/dist/ssr";
import { respondInvitation } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { EmptyState } from "@/components/empty-state";
import { getStudentNotifications } from "@/lib/student-notifications";

export default async function Notifications() {
  const { invites } = await getStudentNotifications();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-4xl font-bold tracking-[-.035em] sm:text-5xl">Thông báo</h1>
      <p className="mt-3 text-lg text-muted">Lời mời và cập nhật lớp học của bạn.</p>
      <div className="mt-10">
        {!invites?.length ? (
          <EmptyState title="Không có thông báo mới" description="Khi giáo viên mời bạn vào lớp, lời mời sẽ xuất hiện ở đây." />
        ) : (
          <div className="divide-y divide-line border-y border-line">
            {invites.map((invite) => {
              const klass = invite.classes as unknown as { name: string; description: string } | null;
              return (
                <article key={invite.id} className="flex flex-col justify-between gap-5 py-6 sm:flex-row sm:items-center">
                  <div className="min-w-0"><h2 className="break-words text-xl font-bold">{klass?.name ?? "Lời mời tham gia lớp học"}</h2><p className="mt-2 break-words text-muted">{klass?.description || "Bạn được mời tham gia lớp học này."}</p></div>
                  <div className="flex flex-wrap gap-2">
                    <ActionForm action={respondInvitation.bind(null, invite.id, false)} submitClassName="button-secondary" submitLabel="Từ chối" pendingLabel="Đang xử lý" icon={<X aria-hidden="true" />} />
                    <ActionForm action={respondInvitation.bind(null, invite.id, true)} submitClassName="button-primary" submitLabel="Tham gia" pendingLabel="Đang tham gia" icon={<Check aria-hidden="true" />} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
