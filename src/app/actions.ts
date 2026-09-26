"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { cardSchema, classSchema, inviteSchema, lessonSchema, roleSchema, uuidSchema } from "@/lib/validation";
import { parseCardXlsx } from "@/lib/xlsx";
import { resolveWorkspaceRole } from "@/lib/roles";
import type { ActionState } from "@/lib/action-state";
import type { Profile, ReviewRating, WorkspaceRole } from "@/lib/types";

function result(previous: ActionState, status: ActionState["status"], message: string): ActionState {
  return { status, message, revision: previous.revision + 1 };
}

function failure(previous: ActionState, error: unknown, fallback: string): ActionState {
  if (error instanceof ZodError) return result(previous, "error", error.issues[0]?.message ?? fallback);
  if (error instanceof Error && error.message) return result(previous, "error", error.message);
  return result(previous, "error", fallback);
}

async function userOrThrow() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) throw new Error("Bạn cần đăng nhập");
  return { supabase, user: { id: data.claims.sub } };
}

async function userForRole(requiredRole: WorkspaceRole) {
  const { supabase, user } = await userOrThrow();
  const { data: profile, error } = await supabase.from("profiles").select("id,email,display_name,avatar_url,role,active_mode").eq("id", user.id).single();
  if (error || !profile) throw new Error("Không tìm thấy hồ sơ");
  if (resolveWorkspaceRole(profile as Profile) !== requiredRole) throw new Error(`Hãy chuyển sang chế độ ${requiredRole === "teacher" ? "giáo viên" : "học sinh"}`);
  return { supabase, user, profile: profile as Profile };
}

export async function signOut() {
  const { supabase } = await userOrThrow();
  await supabase.auth.signOut();
  redirect("/");
}

export async function chooseRole(formData: FormData) {
  const role = roleSchema.parse(formData.get("role"));
  const { supabase } = await userOrThrow();
  const { error } = await supabase.rpc("set_my_role", { chosen_role: role });
  if (error) throw new Error("Vai trò đã được chọn hoặc không hợp lệ");
  redirect(role === "teacher" ? "/teacher" : "/student");
}

export async function switchAdminMode(mode: WorkspaceRole) {
  const selectedMode = roleSchema.parse(mode);
  const supabase = await createClient();
  // The RPC checks auth.uid() and the persisted admin role atomically with the update.
  const { error } = await supabase.rpc("set_admin_mode", { selected_mode: selectedMode });
  if (error) throw new Error("Không thể chuyển chế độ admin");
  redirect(selectedMode === "teacher" ? "/teacher" : "/student");
}

export async function createClass(previous: ActionState, formData: FormData): Promise<ActionState> {
  let classId = "";
  try {
    const parsed = classSchema.parse({ name: formData.get("name"), description: formData.get("description") });
    const { supabase, user } = await userForRole("teacher");
    const { data, error } = await supabase.from("classes").insert({ ...parsed, teacher_id: user.id }).select("id").single();
    if (error || !data) throw new Error("Không thể tạo lớp. Hãy thử lại.");
    classId = data.id;
  } catch (error) {
    return failure(previous, error, "Không thể tạo lớp. Hãy thử lại.");
  }
  redirect(`/teacher/classes/${classId}`);
}

export async function createLesson(classId: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  let lessonId = "";
  try {
    uuidSchema.parse(classId);
    const parsed = lessonSchema.parse({ title: formData.get("title"), description: formData.get("description") });
    const { supabase } = await userForRole("teacher");
    const { data, error } = await supabase.from("lessons").insert({ ...parsed, class_id: classId }).select("id").single();
    if (error || !data) throw new Error("Không thể tạo bài học. Hãy thử lại.");
    lessonId = data.id;
  } catch (error) {
    return failure(previous, error, "Không thể tạo bài học. Hãy thử lại.");
  }
  redirect(`/teacher/classes/${classId}/lessons/${lessonId}`);
}

export async function updateLessonTitle(lessonId: string, classId: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    uuidSchema.parse(lessonId); uuidSchema.parse(classId);
    const { title } = lessonSchema.pick({ title: true }).parse({ title: formData.get("title") });
    const { supabase } = await userForRole("teacher");
    const { data, error } = await supabase.from("lessons").update({ title }).eq("id", lessonId).eq("class_id", classId).select("id").single();
    if (error || !data) throw new Error("Không thể đổi tên buổi học. Hãy thử lại.");
    revalidatePath(`/teacher/classes/${classId}`);
    revalidatePath(`/teacher/classes/${classId}/lessons/${lessonId}`);
    revalidatePath("/student");
    revalidatePath(`/study/${lessonId}`);
    return result(previous, "success", "Đã đổi tên buổi học.");
  } catch (error) {
    return failure(previous, error, "Không thể đổi tên buổi học. Hãy thử lại.");
  }
}

export async function addCard(lessonId: string, classId: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    uuidSchema.parse(lessonId); uuidSchema.parse(classId);
    const parsed = cardSchema.parse(Object.fromEntries(["kanji", "hiragana", "meaning_vi", "example_ja", "example_vi"].map((key) => [key, formData.get(key)])));
    const { supabase } = await userForRole("teacher");
    const { data: lastCard } = await supabase.from("cards").select("position").eq("lesson_id", lessonId).order("position", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("cards").insert({ ...parsed, lesson_id: lessonId, position: (lastCard?.position ?? -1) + 1 });
    if (error) throw new Error("Không thể thêm thẻ. Hãy thử lại.");
    revalidatePath(`/teacher/classes/${classId}/lessons/${lessonId}`);
    return result(previous, "success", "Đã thêm thẻ.");
  } catch (error) {
    return failure(previous, error, "Không thể thêm thẻ. Hãy thử lại.");
  }
}

export async function updateCard(cardId: string, lessonId: string, classId: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    uuidSchema.parse(cardId); uuidSchema.parse(lessonId); uuidSchema.parse(classId);
    const parsed = cardSchema.parse(Object.fromEntries(["kanji", "hiragana", "meaning_vi", "example_ja", "example_vi"].map((key) => [key, formData.get(key)])));
    const { supabase } = await userForRole("teacher");
    const { error } = await supabase.from("cards").update(parsed).eq("id", cardId).eq("lesson_id", lessonId);
    if (error) throw new Error("Không thể lưu thay đổi. Hãy thử lại.");
    revalidatePath(`/teacher/classes/${classId}/lessons/${lessonId}`);
    return result(previous, "success", "Đã lưu thay đổi.");
  } catch (error) {
    return failure(previous, error, "Không thể lưu thay đổi. Hãy thử lại.");
  }
}

export async function deleteCard(cardId: string, lessonId: string, classId: string, previous: ActionState): Promise<ActionState> {
  try {
    uuidSchema.parse(cardId);
    const { supabase } = await userForRole("teacher");
    const { error } = await supabase.from("cards").delete().eq("id", cardId).eq("lesson_id", lessonId);
    if (error) throw new Error("Không thể xóa thẻ. Hãy thử lại.");
    revalidatePath(`/teacher/classes/${classId}/lessons/${lessonId}`);
    return result(previous, "success", "Đã xóa thẻ.");
  } catch (error) {
    return failure(previous, error, "Không thể xóa thẻ. Hãy thử lại.");
  }
}

export async function moveCard(cardId: string, direction: "up" | "down", lessonId: string, classId: string, previous: ActionState): Promise<ActionState> {
  try {
    uuidSchema.parse(cardId);
    const { supabase } = await userForRole("teacher");
    const { error } = await supabase.rpc("move_card", { target_card: cardId, movement: direction });
    if (error) throw new Error("Không thể đổi vị trí thẻ. Hãy thử lại.");
    revalidatePath(`/teacher/classes/${classId}/lessons/${lessonId}`);
    return result(previous, "success", "Đã đổi vị trí thẻ.");
  } catch (error) {
    return failure(previous, error, "Không thể đổi vị trí thẻ. Hãy thử lại.");
  }
}

export async function importCards(lessonId: string, classId: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    uuidSchema.parse(lessonId); uuidSchema.parse(classId);
    const { supabase } = await userForRole("teacher");
    const file = formData.get("xlsx");
    if (!(file instanceof File)) return result(previous, "error", "Hãy chọn tệp Excel .xlsx");
    const parsed = await parseCardXlsx(file);
    if (parsed.errors.length) return result(previous, "error", parsed.errors.slice(0, 4).map((error) => `Hàng ${error.row}: ${error.message}`).join("; ") + (parsed.errors.length > 4 ? `; và ${parsed.errors.length - 4} lỗi khác` : ""));
    const { data: lastCard } = await supabase.from("cards").select("position").eq("lesson_id", lessonId).order("position", { ascending: false }).limit(1).maybeSingle();
    const firstPosition = (lastCard?.position ?? -1) + 1;
    const { error } = await supabase.from("cards").insert(parsed.rows.map((row, index) => ({ ...row, lesson_id: lessonId, position: firstPosition + index })));
    if (error) throw new Error("Không thể nhập danh sách. Hãy thử lại.");
    revalidatePath(`/teacher/classes/${classId}/lessons/${lessonId}`);
    return result(previous, "success", `Đã nhập ${parsed.rows.length} thẻ.`);
  } catch (error) {
    return failure(previous, error, "Không thể nhập danh sách. Hãy thử lại.");
  }
}

export async function publishLesson(lessonId: string, classId: string, previous: ActionState): Promise<ActionState> {
  try {
    const { supabase } = await userForRole("teacher");
    const { count } = await supabase.from("cards").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId);
    if (!count) throw new Error("Cần ít nhất một thẻ trước khi xuất bản.");
    const { error } = await supabase.from("lessons").update({ status: "published", published_at: new Date().toISOString() }).eq("id", lessonId);
    if (error) throw new Error("Không thể xuất bản bài học. Hãy thử lại.");
    revalidatePath(`/teacher/classes/${classId}`);
    revalidatePath(`/teacher/classes/${classId}/lessons/${lessonId}`);
    return result(previous, "success", "Đã xuất bản bài học.");
  } catch (error) {
    return failure(previous, error, "Không thể xuất bản bài học. Hãy thử lại.");
  }
}

export async function inviteStudent(classId: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { email } = inviteSchema.parse({ email: formData.get("email") });
    uuidSchema.parse(classId);
    const supabase = await createClient();
    // Ownership, recipient lookup and notification delivery are one authorized transaction.
    const { error } = await supabase.rpc("send_class_invitation", { target_class: classId, recipient_email: email });
    if (error) throw new Error(error.code === "23505" ? "Email này đã có lời mời đang chờ." : error.message === "teacher_recipient" ? "Email này thuộc tài khoản giáo viên." : "Không thể gửi lời mời. Hãy thử lại.");
    revalidatePath(`/teacher/classes/${classId}`);
    return result(previous, "success", `Đã mời ${email}.`);
  } catch (error) {
    return failure(previous, error, "Không thể gửi lời mời. Hãy thử lại.");
  }
}

export async function revokeInvitation(invitationId: string, classId: string, previous: ActionState): Promise<ActionState> {
  try {
    const { supabase } = await userForRole("teacher");
    const { error } = await supabase.from("class_invitations").update({ status: "revoked", responded_at: new Date().toISOString() }).eq("id", invitationId);
    if (error) throw new Error("Không thể thu hồi lời mời. Hãy thử lại.");
    revalidatePath(`/teacher/classes/${classId}`);
    return result(previous, "success", "Đã thu hồi lời mời.");
  } catch (error) {
    return failure(previous, error, "Không thể thu hồi lời mời. Hãy thử lại.");
  }
}

export async function respondInvitation(invitationId: string, accept: boolean, previous: ActionState): Promise<ActionState> {
  try {
    const { supabase } = await userForRole("student");
    const { error } = await supabase.rpc("accept_class_invitation", { target_invitation: invitationId, accept_invitation: accept });
    if (error) throw new Error("Không thể cập nhật lời mời. Hãy thử lại.");
    revalidatePath("/student"); revalidatePath("/student/notifications");
    return result(previous, "success", accept ? "Đã tham gia lớp." : "Đã từ chối lời mời.");
  } catch (error) {
    return failure(previous, error, "Không thể cập nhật lời mời. Hãy thử lại.");
  }
}

export async function submitReview(cardId: string, sessionId: string, rating: ReviewRating) {
  const { supabase } = await userOrThrow();
  const { error } = await supabase.rpc("record_review_v2", { target_card: cardId, target_session: sessionId, selected_rating: rating });
  if (error) throw new Error(error.message);
  revalidatePath("/student");
  return { saved: true };
}

export async function undoReview(sessionId: string) {
  const { supabase } = await userOrThrow();
  const { data, error } = await supabase.rpc("undo_latest_review", { target_session: sessionId });
  if (error) throw new Error(error.message);
  revalidatePath("/student");
  return { cardId: data as string };
}
