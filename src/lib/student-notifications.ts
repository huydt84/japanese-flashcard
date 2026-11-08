import { requireProfile } from "@/lib/auth";
import { getStudentNotifications as queryStudentNotifications } from "@/lib/queries";

// Shared by the badge, invitation banner and inbox for this render only.
export async function getStudentNotifications() {
  const { actorId } = await requireProfile("student");
  return queryStudentNotifications(actorId);
}
