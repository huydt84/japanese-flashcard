// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { nextReview } from "@/lib/fsrs";

const run = process.env.RUN_SUPABASE_INTEGRATION === "1" ? describe : describe.skip;
const apiUrl = process.env.TEST_SUPABASE_URL ?? "";
const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.TEST_SUPABASE_SECRET_KEY ?? "";

run("authenticated teacher-to-student flow and RLS", () => {
  const password = "Local-test-only-123!";
  const stamp = Date.now();
  const teacherEmail = `teacher-${stamp}@example.test`;
  const studentEmail = `student-${stamp}@example.test`;
  const outsiderEmail = `outsider-${stamp}@example.test`;
  const developerEmail = `admin-${stamp}@example.test`;
  const userIds: string[] = [];
  let admin: SupabaseClient;
  let teacher: SupabaseClient;
  let student: SupabaseClient;
  let outsider: SupabaseClient;
  let developer: SupabaseClient;
  let cardId = "";

  beforeAll(async () => {
    admin = createClient(apiUrl, secretKey, { auth: { persistSession: false } });
    for (const email of [teacherEmail, studentEmail, outsiderEmail, developerEmail]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      userIds.push(data.user.id);
    }
    const signedIn = await Promise.all([teacherEmail, studentEmail, outsiderEmail, developerEmail].map(async (email) => {
      const client = createClient(apiUrl, publishableKey, { auth: { persistSession: false } });
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return client;
    }));
    [teacher, student, outsider, developer] = signedIn;
    expect((await teacher.rpc("set_my_role", { chosen_role: "teacher" })).error).toBeNull();
    expect((await student.rpc("set_my_role", { chosen_role: "student" })).error).toBeNull();
    expect((await outsider.rpc("set_my_role", { chosen_role: "teacher" })).error).toBeNull();
    expect((await admin.from("profiles").update({ role: "admin", active_mode: "student", onboarding_completed_at: new Date().toISOString() }).eq("id", userIds[3])).error).toBeNull();
  });

  afterAll(async () => {
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it("creates, publishes, invites, accepts, reviews and undoes atomically", async () => {
    const teacherId = userIds[0];
    const { data: klass, error: classError } = await teacher.from("classes").insert({ teacher_id: teacherId, name: "N5 buổi sáng" }).select("id").single();
    expect(classError).toBeNull();
    if (!klass) throw classError ?? new Error("Không tạo được lớp kiểm thử");
    const classId = klass.id;
    expect((await outsider.from("classes").select("id").eq("id", classId)).data).toEqual([]);
    const { data: lesson, error: lessonError } = await teacher.from("lessons").insert({ class_id: classId, title: "Động từ mỗi ngày" }).select("id").single();
    if (lessonError || !lesson) throw lessonError ?? new Error("Không tạo được bài học kiểm thử");
    const { data: card, error: cardError } = await teacher.from("cards").insert({ lesson_id: lesson.id, kanji: "学ぶ", hiragana: "まなぶ", meaning_vi: "học", example_ja: "毎日学びます。", example_vi: "Tôi học mỗi ngày." }).select("id").single();
    if (cardError || !card) throw cardError ?? new Error("Không tạo được thẻ kiểm thử");
    cardId = card.id;
    const { data: secondCard, error: secondCardError } = await teacher.from("cards").insert({ lesson_id: lesson.id, kanji: "食べる", hiragana: "たべる", meaning_vi: "ăn", example_ja: "朝ご飯を食べます。", example_vi: "Tôi ăn sáng.", position: 1 }).select("id").single();
    if (secondCardError || !secondCard) throw secondCardError ?? new Error("Không tạo được thẻ thứ hai");
    expect((await teacher.rpc("move_card", { target_card: card.id, movement: "down" })).error).toBeNull();
    const reordered = await teacher.from("cards").select("id,position").eq("lesson_id", lesson.id).order("position");
    expect(reordered.data?.map((item) => item.id)).toEqual([secondCard.id, card.id]);
    expect((await outsider.rpc("move_card", { target_card: card.id, movement: "up" })).error).toBeTruthy();
    expect((await teacher.from("lessons").update({ status: "published", published_at: new Date().toISOString() }).eq("id", lesson.id)).error).toBeNull();
    const { data: invitation, error: invitationError } = await teacher.from("class_invitations").insert({ class_id: classId, invited_by: teacherId, email: studentEmail }).select("id").single();
    if (invitationError || !invitation) throw invitationError ?? new Error("Không tạo được lời mời kiểm thử");
    expect((await student.rpc("claim_pending_invitations")).error).toBeNull();
    expect((await student.rpc("accept_class_invitation", { target_invitation: invitation.id, accept_invitation: true })).error).toBeNull();
    expect((await student.from("cards").select("id").eq("id", cardId).single()).data?.id).toBe(cardId);

    const next = nextReview(null, "good", new Date("2026-09-16T08:00:00.000Z"));
    const sessionId = crypto.randomUUID();
    expect((await student.rpc("record_review", { target_card: cardId, target_session: sessionId, selected_rating: "good", previous_state: {}, next_state: JSON.parse(JSON.stringify(next.card)), reviewed_time: "2026-09-16T08:00:00.000Z" })).error).toBeNull();
    expect((await student.from("card_progress").select("card_id").eq("card_id", cardId).single()).data?.card_id).toBe(cardId);
    expect((await student.rpc("undo_latest_review", { target_session: sessionId })).error).toBeNull();
    expect((await student.from("card_progress").select("card_id").eq("card_id", cardId)).data).toEqual([]);
    expect((await student.from("review_logs").select("undone_at").eq("card_id", cardId).single()).data?.undone_at).toBeTruthy();
  });

  it("keeps the selected role immutable", async () => {
    expect((await teacher.rpc("set_my_role", { chosen_role: "student" })).error).toBeTruthy();
    expect((await teacher.rpc("set_admin_mode", { selected_mode: "student" })).error).toBeTruthy();
    expect((await student.rpc("set_admin_mode", { selected_mode: "teacher" })).error).toBeTruthy();
    expect((await teacher.from("profiles").update({ role: "student" }).eq("id", userIds[0]).select("role")).data).toEqual([]);
    expect((await teacher.from("profiles").select("role").eq("id", userIds[0]).single()).data?.role).toBe("teacher");
  });

  it("lets an admin switch between isolated student and teacher modes", async () => {
    const developerId = userIds[3];
    expect((await developer.from("classes").insert({ teacher_id: developerId, name: "Không được tạo" })).error).toBeTruthy();
    expect((await developer.rpc("set_admin_mode", { selected_mode: "teacher" })).error).toBeNull();
    const { data: ownClass, error: classError } = await developer.from("classes").insert({ teacher_id: developerId, name: "Lớp debug" }).select("id").single();
    expect(classError).toBeNull();
    if (!ownClass) throw classError ?? new Error("Không tạo được lớp admin kiểm thử");
    expect((await developer.from("classes").select("id").eq("id", ownClass.id).single()).data?.id).toBe(ownClass.id);
    expect((await developer.rpc("set_admin_mode", { selected_mode: "student" })).error).toBeNull();
    expect((await developer.from("classes").select("id").eq("id", ownClass.id)).data).toEqual([]);
    expect((await developer.from("classes").insert({ teacher_id: developerId, name: "Không được tạo nữa" })).error).toBeTruthy();
  });
});
