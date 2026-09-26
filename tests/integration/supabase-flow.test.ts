// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
    const { data: invitationId, error: invitationError } = await teacher.rpc("send_class_invitation", { target_class: classId, recipient_email: studentEmail });
    const invitation = invitationId ? { id: invitationId } : null;
    if (invitationError || !invitation) throw invitationError ?? new Error("Không tạo được lời mời kiểm thử");
    expect((await student.rpc("claim_pending_invitations")).error).toBeNull();
    expect((await student.rpc("accept_class_invitation", { target_invitation: invitation.id, accept_invitation: true })).error).toBeNull();
    expect((await student.from("cards").select("id").eq("id", cardId).single()).data?.id).toBe(cardId);

    const sessionId = crypto.randomUUID();
    // An older open page can still call the original RPC after the migration.
    expect((await student.rpc("record_review", { target_card: cardId, target_session: sessionId, selected_rating: "good", previous_state: {}, next_state: {}, reviewed_time: "2026-09-16T08:00:00.000Z" })).error).toBeNull();
    expect((await student.from("card_progress").select("card_id").eq("card_id", cardId).single()).data?.card_id).toBe(cardId);
    expect((await student.rpc("undo_latest_review", { target_session: sessionId })).error).toBeNull();
    expect((await student.from("card_progress").select("card_id").eq("card_id", cardId)).data).toEqual([]);
    expect((await student.from("review_logs").select("undone_at").eq("card_id", cardId).single()).data?.undone_at).toBeTruthy();

    const rate = async (rating: "again" | "hard" | "good") => {
      const result = await student.rpc("record_review_v2", { target_card: cardId, target_session: sessionId, selected_rating: rating });
      expect(result.error).toBeNull();
      const progress = await student.from("card_progress").select("due_at,last_review_at,last_rating,good_streak,review_count").eq("card_id", cardId).single();
      expect(progress.error).toBeNull();
      return progress.data!;
    };
    const hours = (progress: { due_at: string | null; last_review_at: string | null }) =>
      (new Date(progress.due_at!).getTime() - new Date(progress.last_review_at!).getTime()) / 3_600_000;
    const first = await rate("good");
    expect(first.good_streak).toBe(1);
    expect(hours(first)).toBe(6);
    expect(hours(await rate("good"))).toBe(24);
    expect(hours(await rate("good"))).toBe(48);
    const mastered = await rate("good");
    expect(mastered).toMatchObject({ good_streak: 4, last_rating: "good", due_at: null });
    expect((await rate("good")).due_at).toBeNull();
    const uncertain = await rate("hard");
    expect(uncertain.good_streak).toBe(0);
    expect(hours(uncertain)).toBe(1);
    expect(hours(await rate("good"))).toBe(6);
    const wrong = await rate("again");
    expect(wrong.good_streak).toBe(0);
    expect(wrong.due_at).toBe(wrong.last_review_at);
    expect((await student.rpc("undo_latest_review", { target_session: sessionId })).error).toBeNull();
    const restored = await student.from("card_progress").select("good_streak,last_rating,due_at,last_review_at").eq("card_id", cardId).single();
    expect(restored.data).toMatchObject({ good_streak: 1, last_rating: "good" });
    expect(hours(restored.data!)).toBe(6);
  });

  it("keeps the selected role immutable", async () => {
    expect((await teacher.rpc("set_my_role", { chosen_role: "student" })).error).toBeTruthy();
    expect((await teacher.rpc("set_admin_mode", { selected_mode: "student" })).error).toBeTruthy();
    expect((await student.rpc("set_admin_mode", { selected_mode: "teacher" })).error).toBeTruthy();
    expect((await teacher.from("profiles").update({ role: "student" }).eq("id", userIds[0]).select("role")).data).toEqual([]);
    expect((await teacher.from("profiles").select("role").eq("id", userIds[0]).single()).data?.role).toBe("teacher");
  });

  it("summarizes published cards and more than 1000 reviews without truncation or draft leakage", async () => {
    const { data: klass, error } = await teacher.from("classes").insert({ teacher_id: userIds[0], name: "Large review history" }).select("id").single();
    if (error || !klass) throw error;
    const { data: lessons, error: lessonError } = await teacher.from("lessons").insert([
      { class_id: klass.id, title: "Published", status: "published" }, { class_id: klass.id, title: "Draft", status: "draft" },
    ]).select("id,status");
    if (lessonError || !lessons) throw lessonError;
    const published = lessons.find((lesson) => lesson.status === "published")!;
    const draft = lessons.find((lesson) => lesson.status === "draft")!;
    const { data: cards, error: cardsError } = await teacher.from("cards").insert([published.id, published.id, draft.id].map((lesson_id, position) => ({ lesson_id, position, kanji: "学ぶ", hiragana: "まなぶ", meaning_vi: "học", example_ja: "学びます。", example_vi: "Tôi học." }))).select("id,lesson_id");
    if (cardsError || !cards) throw cardsError;
    const card = cards.find((card) => card.lesson_id === published.id)!;
    expect((await admin.from("class_memberships").insert({ class_id: klass.id, student_id: userIds[1] })).error).toBeNull();
    expect((await admin.from("card_progress").insert({ student_id: userIds[1], card_id: card.id, due_at: "2100-01-01" })).error).toBeNull();
    expect((await admin.from("review_logs").insert(Array.from({ length: 1003 }, (_, index) => ({ student_id: userIds[1], card_id: card.id, session_id: crypto.randomUUID(), rating: index === 1001 ? "hard" : "good", state_before: {}, state_after: {}, reviewed_at: "2026-09-01T00:00:00Z", undone_at: index === 1002 ? "2026-09-02T00:00:00Z" : null })))).error).toBeNull();
    const summary = await teacher.rpc("class_student_progress", { target_class: klass.id });
    expect(summary.error).toBeNull();
    expect(summary.data).toEqual([expect.objectContaining({ studied: 1, total: 2, due: 1, good_reviews: 1001, review_count: 1002 })]);
    expect((await outsider.rpc("class_student_progress", { target_class: klass.id })).error).toBeTruthy();
    expect((await outsider.rpc("send_class_invitation", { target_class: klass.id, recipient_email: outsiderEmail })).error).toBeTruthy();
  });

  it("rejects accepting an unclaimed invitation intended for someone else", async () => {
    const { data: klass, error } = await teacher.from("classes").insert({ teacher_id: userIds[0], name: "Private invitation" }).select("id").single();
    if (error || !klass) throw error;
    const { data: invitation, error: inviteError } = await teacher.from("class_invitations").insert({ class_id: klass.id, invited_by: userIds[0], email: "someone-else@example.test" }).select("id").single();
    if (inviteError || !invitation) throw inviteError;
    expect((await student.rpc("accept_class_invitation", { target_invitation: invitation.id, accept_invitation: true })).error).toBeTruthy();
    expect((await admin.from("class_memberships").select("student_id").eq("class_id", klass.id)).data).toEqual([]);
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
