import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
export default async function TeacherLayout({children}:{children:React.ReactNode}){const{profile,workspaceRole}=await requireProfile("teacher");return <AppShell profile={profile} workspaceRole={workspaceRole}>{children}</AppShell>}
