import type { Profile, WorkspaceRole } from "@/lib/types";

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return value === "teacher" || value === "student";
}

export function resolveWorkspaceRole(
  profile: Pick<Profile, "role" | "active_mode">,
): WorkspaceRole | null {
  if (profile.role === "admin") return profile.active_mode ?? "student";
  return isWorkspaceRole(profile.role) ? profile.role : null;
}
