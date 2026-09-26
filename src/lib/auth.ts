import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceRole } from "@/lib/roles";
import type { Profile, UserRole, WorkspaceRole } from "@/lib/types";

export const getViewer = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id,email,display_name,avatar_url,role,active_mode").eq("id", user.id).single();
  return { user, profile: profile as Profile | null, supabase };
});

const claimPendingInvitations = cache(async () => {
  const viewer = await getViewer();
  if (!viewer) return;
  const { error } = await viewer.supabase.rpc("claim_pending_invitations");
  if (error) throw new Error("Không thể tải lời mời lớp học.");
});

export async function requireProfile(role?: WorkspaceRole) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (!viewer.profile?.role) redirect("/onboarding");
  const profile = viewer.profile as Profile & { role: UserRole };
  const workspaceRole = resolveWorkspaceRole(profile);
  if (!workspaceRole) redirect("/onboarding");
  if (role && workspaceRole !== role) redirect(workspaceRole === "teacher" ? "/teacher" : "/student");
  if (role === "student") await claimPendingInvitations();
  return { ...viewer, profile, workspaceRole };
}
