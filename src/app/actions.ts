"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError, z } from "zod";
import { signOut as authSignOut } from "@/auth";
import { actorQuery, withActor } from "@/lib/db";
import { cardSchema, classSchema, inviteSchema, lessonSchema, roleSchema, uuidSchema } from "@/lib/validation";
import { parseCardXlsx } from "@/lib/xlsx";
import { parseCardCsv, parseCardCsvFile } from "@/lib/csv";
import type { CardImportResult } from "@/lib/card-import";
import type { ActionState } from "@/lib/action-state";
import type { ReviewRating, WorkspaceRole } from "@/lib/types";
import { getViewer, requireProfile } from "@/lib/auth";

function result(previous: ActionState, status: ActionState["status"], message: string): ActionState {
  return { status, message, revision: previous.revision + 1 };
}

function failure(previous: ActionState, error: unknown, fallback: string): ActionState {
  if (error instanceof ZodError) return result(previous, "error", error.issues[0]?.message ?? fallback);
  if (error instanceof Error && error.message) return result(previous, "error", error.message);
  return result(previous, "error", fallback);
}

async function actorOrThrow() {
  const viewer = await getViewer();
  if (!viewer?.profile) throw new Error("Bạn cần đăng nhập");
  return viewer;
}

async function actorForRole(requiredRole: WorkspaceRole) {
  const { actorId, profile } = await requireProfile(requiredRole);
  return { actorId, profile };
}

async function actorForLesson(lessonId: string, classId: string) {
  const { actorId } = await requireProfile();
  const editable = await actorQuery(actorId,
    "SELECT id FROM public.lessons WHERE id=$1 AND class_id=$2 AND public.kotoba_can_edit_lesson(id)",
    [lessonId, classId]);
  if (!editable.rowCount) throw new Error("Không tìm thấy bài học hoặc bạn không có quyền chỉnh sửa.");
  return { actorId };
}

function refreshLesson(lessonId: string, classId: string) {
  revalidatePath(`/teacher/classes/${classId}`);
  revalidatePath(`/teacher/classes/${classId}/lessons/${lessonId}`);
  revalidatePath(`/student/classes/${classId}/lessons/${lessonId}`);
  revalidatePath("/student");
  revalidatePath(`/study/${lessonId}`);
  revalidatePath(`/preview/${lessonId}`);
}

export async function signOut() {
  await authSignOut({ redirectTo: "/" });
}

export async function chooseRole(formData: FormData) {
  const role = roleSchema.parse(formData.get("role"));
  const { actorId } = await actorOrThrow();
  await withActor(actorId, (client) => client.query("SELECT public.kotoba_choose_role($1::public.user_role)", [role]));
  redirect(role === "teacher" ? "/teacher" : "/student");
}

export async function switchAdminMode(mode: WorkspaceRole) {
  const selectedMode = roleSchema.parse(mode);
  const { actorId } = await actorOrThrow();
  await withActor(actorId, (client) => client.query("SELECT public.kotoba_switch_admin_mode($1)", [selectedMode]));
  redirect(selectedMode === "teacher" ? "/teacher" : "/student");
}

export async function createClass(previous: ActionState, formData: FormData): Promise<ActionState> {
  let classId = "";
  try {
    const parsed = classSchema.parse({ name: formData.get("name"), description: formData.get("description") });
    const { actorId } = await actorForRole("teacher");
    const created = await actorQuery<{ id: string }>(actorId,
      "INSERT INTO public.classes (name, description, teacher_id) VALUES ($1, $2, $3) RETURNING id",
      [parsed.name, parsed.description, actorId]);
    classId = created.rows[0].id;
  } catch (error) {
    return failure(previous, error, "Không thể tạo lớp. Hãy thử lại.");
  }
  redirect(`/teacher/classes/${classId}`);
}

export async function createLesson(classId: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  let lessonId = "";
  let workspace: WorkspaceRole = "teacher";
  try {
    uuidSchema.parse(classId);
    const parsed = lessonSchema.parse({ title: formData.get("title"), description: formData.get("description") });
    const { actorId, workspaceRole } = await requireProfile();
    workspace = workspaceRole;
    const created = await actorQuery<{ id: string }>(actorId,
      "INSERT INTO public.lessons (title, description, class_id, student_creator_id) VALUES ($1, $2, $3, $4) RETURNING id",
      [parsed.title, parsed.description, classId, workspaceRole === "student" ? actorId : null]);
    lessonId = created.rows[0].id;
    refreshLesson(lessonId, classId);
  } catch (error) {
    return failure(previous, error, "Không thể tạo bài học. Hãy thử lại.");
  }
  redirect(`/${workspace}/classes/${classId}/lessons/${lessonId}`);
}

export async function updateLessonTitle(lessonId: string, classId: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    uuidSchema.parse(lessonId); uuidSchema.parse(classId);
    const { title } = lessonSchema.pick({ title: true }).parse({ title: formData.get("title") });
    const { actorId } = await actorForLesson(lessonId, classId);
    const updated = await actorQuery(actorId,
      "UPDATE public.lessons SET title = $1, updated_at = now() WHERE id = $2 AND class_id = $3 RETURNING id",
      [title, lessonId, classId]);
    if (!updated.rowCount) throw new Error("Không thể đổi tên buổi học. Hãy thử lại.");
    refreshLesson(lessonId, classId);
    return result(previous, "success", "Đã đổi tên buổi học.");
  } catch (error) { return failure(previous, error, "Không thể đổi tên buổi học. Hãy thử lại."); }
}

async function appendCards(actorId: string, lessonId: string, classId: string, cards: CardImportResult["rows"]) {
  await withActor(actorId, async (client) => {
    const lesson = await client.query("SELECT id FROM public.lessons WHERE id = $1 AND class_id = $2 FOR UPDATE", [lessonId, classId]);
    if (!lesson.rowCount) throw new Error("Không tìm thấy bài học hoặc bạn không có quyền nhập thẻ.");
    const position = await client.query<{ next_position: number }>("SELECT coalesce(max(position), -1) + 1 AS next_position FROM public.cards WHERE lesson_id = $1", [lessonId]);
    const values: unknown[] = [];
    const rows = cards.map((card, index) => {
      const offset = values.length;
      values.push(lessonId, card.kanji, card.hiragana, card.meaning_vi, card.example_ja, card.example_vi, position.rows[0].next_position + index);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    });
    await client.query(`INSERT INTO public.cards (lesson_id, kanji, hiragana, meaning_vi, example_ja, example_vi, position) VALUES ${rows.join(",")}`, values);
  });
}

export async function addCard(lessonId: string, classId: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    uuidSchema.parse(lessonId); uuidSchema.parse(classId);
    const parsed = cardSchema.parse(Object.fromEntries(["kanji", "hiragana", "meaning_vi", "example_ja", "example_vi"].map((key) => [key, formData.get(key)])));
    const { actorId } = await actorForLesson(lessonId, classId);
    await appendCards(actorId, lessonId, classId, [parsed]);
    refreshLesson(lessonId, classId);
    return result(previous, "success", "Đã thêm thẻ.");
  } catch (error) { return failure(previous, error, "Không thể thêm thẻ. Hãy thử lại."); }
}

export async function updateCard(cardId: string, lessonId: string, classId: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    uuidSchema.parse(cardId); uuidSchema.parse(lessonId); uuidSchema.parse(classId);
    const parsed = cardSchema.parse(Object.fromEntries(["kanji", "hiragana", "meaning_vi", "example_ja", "example_vi"].map((key) => [key, formData.get(key)])));
    const { actorId } = await actorForLesson(lessonId, classId);
    const updated = await actorQuery(actorId,
      "UPDATE public.cards SET kanji=$1, hiragana=$2, meaning_vi=$3, example_ja=$4, example_vi=$5, updated_at=now() WHERE id=$6 AND lesson_id=$7 RETURNING id",
      [parsed.kanji, parsed.hiragana, parsed.meaning_vi, parsed.example_ja, parsed.example_vi, cardId, lessonId]);
    if (!updated.rowCount) throw new Error("Không thể lưu thay đổi. Hãy thử lại.");
    refreshLesson(lessonId, classId);
    return result(previous, "success", "Đã lưu thay đổi.");
  } catch (error) { return failure(previous, error, "Không thể lưu thay đổi. Hãy thử lại."); }
}

export async function deleteCard(cardId: string, lessonId: string, classId: string, previous: ActionState): Promise<ActionState> {
  try {
    uuidSchema.parse(cardId); uuidSchema.parse(lessonId); uuidSchema.parse(classId);
    const { actorId } = await actorForLesson(lessonId, classId);
    const deleted = await actorQuery(actorId, "DELETE FROM public.cards WHERE id=$1 AND lesson_id=$2 RETURNING id", [cardId, lessonId]);
    if (!deleted.rowCount) throw new Error("Không thể xóa thẻ. Hãy thử lại.");
    refreshLesson(lessonId, classId);
    return result(previous, "success", "Đã xóa thẻ.");
  } catch (error) { return failure(previous, error, "Không thể xóa thẻ. Hãy thử lại."); }
}

export async function moveCard(cardId: string, direction: "up" | "down", lessonId: string, classId: string, previous: ActionState): Promise<ActionState> {
  try {
    uuidSchema.parse(cardId); uuidSchema.parse(lessonId); uuidSchema.parse(classId);
    const movement = z.enum(["up", "down"]).parse(direction);
    const { actorId } = await actorForLesson(lessonId, classId);
    await actorQuery(actorId, "SELECT public.kotoba_move_card($1, $2)", [cardId, movement]);
    refreshLesson(lessonId, classId);
    return result(previous, "success", "Đã đổi vị trí thẻ.");
  } catch (error) { return failure(previous, error, "Không thể đổi vị trí thẻ. Hãy thử lại."); }
}

export async function importCards(lessonId: string, classId: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    uuidSchema.parse(lessonId); uuidSchema.parse(classId);
    const { actorId } = await actorForLesson(lessonId, classId);
    let parsed: CardImportResult;
    if (formData.get("import_format") === "csv") {
      const source = formData.get("csv_source");
      if (source === "text") {
        const text = formData.get("csv_text");
        if (typeof text !== "string") return result(previous, "error", "Hãy dán nội dung CSV");
        parsed = parseCardCsv(text);
      } else if (source === "file") {
        const file = formData.get("csv_file");
        if (!(file instanceof File)) return result(previous, "error", "Hãy chọn tệp CSV .csv");
        parsed = await parseCardCsvFile(file);
      } else return result(previous, "error", "Hãy chọn tải tệp hoặc dán nội dung CSV");
    } else {
      const file = formData.get("xlsx");
      if (!(file instanceof File)) return result(previous, "error", "Hãy chọn tệp Excel .xlsx");
      parsed = await parseCardXlsx(file);
    }
    if (parsed.errors.length) return result(previous, "error", parsed.errors.slice(0, 4).map((error) => `Hàng ${error.row}: ${error.message}`).join("; ") + (parsed.errors.length > 4 ? `; và ${parsed.errors.length - 4} lỗi khác` : ""));
    await appendCards(actorId, lessonId, classId, parsed.rows);
    refreshLesson(lessonId, classId);
    return result(previous, "success", `Đã nhập ${parsed.rows.length} thẻ.`);
  } catch (error) { return failure(previous, error, "Không thể nhập danh sách. Hãy thử lại."); }
}

export async function publishLesson(lessonId: string, classId: string, previous: ActionState): Promise<ActionState> {
  try {
    uuidSchema.parse(lessonId); uuidSchema.parse(classId);
    const { actorId } = await actorForLesson(lessonId, classId);
    const published = await withActor(actorId, async (client) => {
      const lesson = await client.query("SELECT id FROM public.lessons WHERE id=$1 AND class_id=$2 FOR UPDATE", [lessonId, classId]);
      if (!lesson.rowCount) throw new Error("Không tìm thấy bài học hoặc bạn không có quyền xuất bản.");
      const cards = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM public.cards WHERE lesson_id=$1", [lessonId]);
      if (Number(cards.rows[0].count) === 0) throw new Error("Cần ít nhất một thẻ trước khi xuất bản.");
      return client.query("UPDATE public.lessons SET status='published', published_at=coalesce(published_at, now()), updated_at=now() WHERE id=$1", [lessonId]);
    });
    void published;
    refreshLesson(lessonId, classId);
    return result(previous, "success", "Đã xuất bản bài học.");
  } catch (error) { return failure(previous, error, "Không thể xuất bản bài học. Hãy thử lại."); }
}

export async function inviteStudent(classId: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { email } = inviteSchema.parse({ email: formData.get("email") });
    uuidSchema.parse(classId);
    const { actorId } = await actorForRole("teacher");
    await actorQuery(actorId, "SELECT public.kotoba_send_class_invitation($1, $2)", [classId, email]);
    revalidatePath(`/teacher/classes/${classId}`);
    return result(previous, "success", `Đã mời ${email}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return failure(previous, message.includes("duplicate key") ? new Error("Email này đã có lời mời đang chờ.") : message.includes("teacher_recipient") ? new Error("Email này thuộc tài khoản giáo viên.") : error, "Không thể gửi lời mời. Hãy thử lại.");
  }
}

export async function revokeInvitation(invitationId: string, classId: string, previous: ActionState): Promise<ActionState> {
  try {
    uuidSchema.parse(invitationId); uuidSchema.parse(classId);
    const { actorId } = await actorForRole("teacher");
    await actorQuery(actorId, "SELECT public.kotoba_revoke_class_invitation($1, $2)", [invitationId, classId]);
    revalidatePath(`/teacher/classes/${classId}`);
    return result(previous, "success", "Đã thu hồi lời mời.");
  } catch (error) { return failure(previous, error, "Không thể thu hồi lời mời. Hãy thử lại."); }
}

export async function respondInvitation(invitationId: string, accept: boolean, previous: ActionState): Promise<ActionState> {
  try {
    uuidSchema.parse(invitationId);
    const accepted = z.boolean().parse(accept);
    const { actorId } = await actorForRole("student");
    await actorQuery(actorId, "SELECT public.kotoba_respond_to_invitation($1, $2)", [invitationId, accepted]);
    revalidatePath("/student"); revalidatePath("/student/notifications");
    return result(previous, "success", accepted ? "Đã tham gia lớp." : "Đã từ chối lời mời.");
  } catch (error) { return failure(previous, error, "Không thể cập nhật lời mời. Hãy thử lại."); }
}

export async function submitReview(cardId: string, sessionId: string, rating: ReviewRating) {
  uuidSchema.parse(cardId); uuidSchema.parse(sessionId);
  const selectedRating = z.enum(["again", "hard", "good"]).parse(rating);
  const { actorId } = await actorForRole("student");
  await actorQuery(actorId, "SELECT public.kotoba_record_review($1, $2, $3::public.review_rating)", [cardId, sessionId, selectedRating]);
  revalidatePath("/student");
  return { saved: true };
}

export async function undoReview(sessionId: string) {
  uuidSchema.parse(sessionId);
  const { actorId } = await actorForRole("student");
  const result = await actorQuery<{ card_id: string }>(actorId,
    "SELECT public.kotoba_undo_latest_review($1) AS card_id", [sessionId]);
  revalidatePath("/student");
  return { cardId: result.rows[0].card_id };
}
