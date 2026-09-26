import { cache } from "react";
import { requireProfile } from "@/lib/auth";

// Shared by the badge, invitation banner and inbox for this render only.
export const getStudentNotifications = cache(async () => {
  const { profile, supabase } = await requireProfile("student");
  const { error: claimError } = await supabase.rpc("claim_pending_invitations");
  if (claimError) throw new Error("Không thể tải lời mời lớp học.");

  const [invitations, notifications] = await Promise.all([
    supabase.from("class_invitations")
      .select("id,created_at,classes(name,description)")
      .eq("recipient_id", profile.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("read_at", null),
  ]);
  if (invitations.error || notifications.error) throw new Error("Không thể tải thông báo.");
  return { invites: invitations.data ?? [], unread: notifications.count ?? 0 };
});
