import Link from "next/link";
import { Bell, Books, ChalkboardTeacher, SignOut, Student, Swap } from "@phosphor-icons/react/dist/ssr";
import { signOut, switchAdminMode } from "@/app/actions";
import { Brand } from "@/components/brand";
import { PendingButton } from "@/components/pending-button";
import type { Profile, UserRole, WorkspaceRole } from "@/lib/types";

export function AppShell({
  profile,
  workspaceRole,
  unread = 0,
  children,
}: {
  profile: Profile & { role: UserRole };
  workspaceRole: WorkspaceRole;
  unread?: number;
  children: React.ReactNode;
}) {
  const teacher = workspaceRole === "teacher";
  const home = teacher ? "/teacher" : "/student";
  const roleLabel = profile.role === "admin" ? `Admin · ${teacher ? "Giáo viên" : "Học sinh"}` : teacher ? "Giáo viên" : "Học sinh";

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[248px_1fr]">
      <aside className="border-b border-line bg-surface px-5 py-4 md:sticky md:top-0 md:h-[100dvh] md:border-r md:border-b-0 md:px-6 md:py-7">
        <div className="flex items-center justify-between gap-4">
          <Brand href={home} />
          <form action={signOut} className="md:hidden">
            <PendingButton className="icon-button" pendingLabel="Đợi" ariaLabel="Đăng xuất">
              <SignOut size={20} aria-hidden="true" />
              <span className="sr-only">Đăng xuất</span>
            </PendingButton>
          </form>
        </div>

        <div className="mt-7 hidden md:block">
          <p className="break-words text-sm font-semibold">{profile.display_name || profile.email}</p>
          <p className="mt-1 text-xs text-muted">{roleLabel}</p>
        </div>

        <nav className="mt-4 flex gap-2 overflow-x-auto md:mt-10 md:block md:space-y-2" aria-label="Điều hướng chính">
          <Link href={home} className="flex min-h-11 shrink-0 items-center gap-3 rounded-xl bg-surface-strong px-3 font-semibold">
            {teacher ? <ChalkboardTeacher size={20} aria-hidden="true" /> : <Books size={20} aria-hidden="true" />}
            {teacher ? "Lớp học" : "Bài học"}
          </Link>
          {!teacher ? <Link href="/student/notifications" className="flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 font-semibold hover:bg-surface-strong"><Bell size={20} aria-hidden="true" />Thông báo{unread > 0 ? <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs text-white" aria-label={`${unread} thông báo chưa đọc`}>{unread}</span> : null}</Link> : null}
        </nav>

        {profile.role === "admin" ? (
          <fieldset className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 md:mt-8">
            <legend className="flex items-center gap-2 pt-4 text-xs font-bold uppercase tracking-[.08em] text-muted md:pt-8"><Swap size={16} aria-hidden="true" />Chế độ debug</legend>
            <form action={switchAdminMode.bind(null, "teacher")}>
              <PendingButton pressed={teacher} disabled={teacher} pendingLabel="Đợi" className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold ${teacher ? "bg-ink text-canvas" : "bg-surface-strong text-muted hover:text-ink"}`}>
                <ChalkboardTeacher size={18} aria-hidden="true" />Giáo viên
              </PendingButton>
            </form>
            <form action={switchAdminMode.bind(null, "student")}>
              <PendingButton pressed={!teacher} disabled={!teacher} pendingLabel="Đợi" className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold ${!teacher ? "bg-ink text-canvas" : "bg-surface-strong text-muted hover:text-ink"}`}>
                <Student size={18} aria-hidden="true" />Học sinh
              </PendingButton>
            </form>
          </fieldset>
        ) : null}

        <form action={signOut} className="mt-8 hidden md:block">
          <PendingButton className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left font-semibold text-muted hover:bg-surface-strong hover:text-ink" pendingLabel="Đang đăng xuất">
            <SignOut size={20} aria-hidden="true" />Đăng xuất
          </PendingButton>
        </form>
      </aside>
      <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-11">{children}</main>
    </div>
  );
}
