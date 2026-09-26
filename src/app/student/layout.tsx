import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";
export default async function StudentLayout({children}:{children:React.ReactNode}){const{profile,supabase,workspaceRole}=await requireProfile("student");const{count}=await supabase.from("notifications").select("id",{count:"exact",head:true}).is("read_at",null);return <AppShell profile={profile} workspaceRole={workspaceRole} unread={count??0}>{children}</AppShell>}
