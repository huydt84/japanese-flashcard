import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceRole } from "@/lib/roles";
import type { Profile, UserRole, WorkspaceRole } from "@/lib/types";

export const getViewer = cache(async () => {
  const supabase = await createClient();
  // Cached signing keys avoid a user lookup; roles still come from the current database row.
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  const { data: profile } = await supabase.from("profiles").select("id,email,display_name,avatar_url,role,active_mode").eq("id", data.claims.sub).single();
  return { profile: profile as Profile | null, supabase };
});

export async function requireProfile(role?: WorkspaceRole) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (!viewer.profile?.role) redirect("/onboarding");
  const profile = viewer.profile as Profile & { role: UserRole };
  const workspaceRole = resolveWorkspaceRole(profile);
  if (!workspaceRole) redirect("/onboarding");
  if (role && workspaceRole !== role) redirect(workspaceRole === "teacher" ? "/teacher" : "/student");
  return { ...viewer, profile, workspaceRole };
}
