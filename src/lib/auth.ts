import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withActor } from "@/lib/db";
import { resolveWorkspaceRole } from "@/lib/roles";
import type { Profile, UserRole, WorkspaceRole } from "@/lib/types";

export const getViewer = cache(async () => {
  const session = await auth();
  const actorId = session?.user?.id;
  if (!actorId) return null;
  const profile = await withActor(actorId, async (client) => {
    const result = await client.query<Profile>(
      "SELECT id, email, display_name, avatar_url, role, active_mode FROM public.profiles WHERE id = $1",
      [actorId],
    );
    return result.rows[0] ?? null;
  });
  return { actorId, profile };
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
