import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
import { getStudentNotifications } from "@/lib/student-notifications";

async function NotificationBadge() {
  const { unread } = await getStudentNotifications();
  return unread > 0 ? (
    <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs text-white" aria-label={`${unread} thông báo chưa đọc`}>{unread}</span>
  ) : null;
}

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { profile, workspaceRole } = await requireProfile("student");
  return (
    <AppShell profile={profile} workspaceRole={workspaceRole}
      notificationBadge={<Suspense fallback={null}><NotificationBadge /></Suspense>}>
      {children}
    </AppShell>
  );
}
