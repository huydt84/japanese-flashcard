// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient, type QueryResult } from "pg";

const run = process.env.RUN_NEON_INTEGRATION === "1" ? describe : describe.skip;
const ownerUrl = process.env.TEST_DATABASE_URL ?? "";
const runtimeUrl = process.env.TEST_RUNTIME_DATABASE_URL ?? "";

run("authenticated PostgreSQL access and domain commands", () => {
  const owner = new Pool({ connectionString: ownerUrl, max: 1 });
  const runtime = new Pool({ connectionString: runtimeUrl, max: 2, options: "-c search_path=auth,public" });
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  let classId = "";
  let lessonId = "";
  let cardId = "";

  async function asActor<T>(actorId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await runtime.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id',$1,true)", [actorId]);
      const value = await work(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async function ownerQuery<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []): Promise<QueryResult<T>> {
    return owner.query<T>(sql, [...values]);
  }

  beforeAll(async () => {
    for (const [index, role] of ["teacher", "student", "teacher", "admin", "student", "student"].entries()) {
      const email = `integration-${ids[index]}@example.test`;
      await ownerQuery("INSERT INTO auth.users (id,name,email,\"emailVerified\") VALUES ($1,$2,$3,now())", [ids[index], `Tester ${index}`, email]);
      await ownerQuery("UPDATE public.profiles SET role=$2::public.user_role,active_mode=$3,onboarding_completed_at=now() WHERE id=$1", [ids[index], role, role === "admin" ? "student" : null]);
    }
  });

  afterAll(async () => {
    await ownerQuery("DELETE FROM auth.users WHERE id=ANY($1::uuid[])", [ids]);
    await Promise.all([owner.end(), runtime.end()]);
  });

  it("keeps classes tenant-isolated and preserves invite, review and undo behavior", async () => {
    const actorState = await asActor(ids[0], async (client) => (await client.query<{ role: string; actor_id: string; helper_actor_id: string; teacher: boolean }>(
      "SELECT p.role::text,p.id AS actor_id,public.kotoba_actor_id() AS helper_actor_id,public.kotoba_actor_is_teacher() AS teacher FROM public.profiles p WHERE p.id=$1", [ids[0]],
    )).rows[0]);
    expect(actorState).toEqual({ role: "teacher", actor_id: ids[0], helper_actor_id: ids[0], teacher: true });
    classId = (await asActor(ids[0], async (client) => (await client.query<{ id: string }>(
      "INSERT INTO public.classes (teacher_id,name) VALUES ($1,'N5 buổi sáng') RETURNING id", [ids[0]],
    )).rows[0].id));
    expect((await asActor(ids[2], (client) => client.query("SELECT id FROM public.classes WHERE id=$1", [classId]))).rows).toEqual([]);

    lessonId = (await asActor(ids[0], async (client) => (await client.query<{ id: string }>(
      "INSERT INTO public.lessons (class_id,title) VALUES ($1,'Động từ mỗi ngày') RETURNING id", [classId],
    )).rows[0].id));
    cardId = (await asActor(ids[0], async (client) => (await client.query<{ id: string }>(
      `INSERT INTO public.cards (lesson_id,kanji,hiragana,meaning_vi,example_ja,example_vi,position)
       VALUES ($1,'学ぶ','まなぶ','học','毎日学びます。','Tôi học mỗi ngày.',0) RETURNING id`, [lessonId],
    )).rows[0].id));
    await asActor(ids[0], (client) => client.query("UPDATE public.lessons SET status='published',published_at=now() WHERE id=$1", [lessonId]));

    const invitationId = (await asActor(ids[0], async (client) => (await client.query<{ kotoba_send_class_invitation: string }>(
      "SELECT public.kotoba_send_class_invitation($1,$2)", [classId, `integration-${ids[1]}@example.test`],
    )).rows[0].kotoba_send_class_invitation));
    await asActor(ids[1], (client) => client.query("SELECT public.kotoba_claim_pending_invitations()"));
    await asActor(ids[1], (client) => client.query("SELECT public.kotoba_respond_to_invitation($1,true)", [invitationId]));
    expect((await asActor(ids[1], (client) => client.query("SELECT id FROM public.cards WHERE id=$1", [cardId]))).rows).toHaveLength(1);

    const sessionId = crypto.randomUUID();
    await asActor(ids[1], (client) => client.query("SELECT public.kotoba_record_review($1,$2,'good'::public.review_rating)", [cardId, sessionId]));
    const progress = (await asActor(ids[1], (client) => client.query<{ good_streak: number; due_at: Date; last_rating: string }>(
      "SELECT good_streak,due_at,last_rating FROM public.card_progress WHERE student_id=$1 AND card_id=$2", [ids[1], cardId],
    ))).rows[0];
    expect(progress).toMatchObject({ good_streak: 1, last_rating: "good" });
    expect(progress.due_at.getTime()).toBeGreaterThan(Date.now() + 5 * 60 * 60 * 1000);
    await asActor(ids[1], (client) => client.query("SELECT public.kotoba_undo_latest_review($1)", [sessionId]));
    expect((await asActor(ids[1], (client) => client.query("SELECT card_id FROM public.card_progress WHERE student_id=$1 AND card_id=$2", [ids[1], cardId]))).rows).toEqual([]);

    const summary = await asActor(ids[0], (client) => client.query("SELECT * FROM public.kotoba_class_student_progress($1)", [classId]));
    expect(summary.rows[0]).toMatchObject({ total: "1" });
    await expect(asActor(ids[2], (client) => client.query("SELECT public.kotoba_class_student_progress($1)", [classId]))).rejects.toThrow();
    await expect(asActor(ids[0], (client) => client.query("UPDATE public.profiles SET role='student' WHERE id=$1", [ids[0]]))).rejects.toThrow();
  });

  it("restricts personal lesson authoring, study, and totals to its creator and classroom teacher", async () => {
    const personalClass = (await asActor(ids[0], (client) => client.query<{ id: string }>(
      "INSERT INTO public.classes (teacher_id,name) VALUES ($1,'Personal lesson class') RETURNING id", [ids[0]],
    ))).rows[0].id;
    await ownerQuery("INSERT INTO public.class_memberships(class_id,student_id) VALUES ($1,$2),($1,$3)", [personalClass, ids[1], ids[4]]);
    const insertLesson = (actor: string, creator: string | null, klass = personalClass) => asActor(actor, (client) => client.query<{ id: string }>(
      "INSERT INTO public.lessons(class_id,title,student_creator_id) VALUES ($1,'Personal vocabulary',$2) RETURNING id", [klass, creator]));
    await expect(insertLesson(ids[5], ids[5])).rejects.toThrow(/row-level security/);
    await expect(insertLesson(ids[1], null)).rejects.toThrow(/row-level security/);
    await expect(insertLesson(ids[1], ids[4])).rejects.toThrow(/row-level security/);
    const lesson = (await insertLesson(ids[1], ids[1])).rows[0].id;
    const add = (actor: string, target: string, position = 0) => asActor(actor, (client) => client.query<{ id: string }>(
      "INSERT INTO public.cards(lesson_id,kanji,hiragana,meaning_vi,example_ja,example_vi,position) VALUES ($1,'読む','よむ','đọc','本を読みます。','Tôi đọc sách.',$2) RETURNING id", [target, position]));
    const card = (await add(ids[1], lesson)).rows[0].id;
    const secondCard = (await add(ids[1], lesson, 1)).rows[0].id;
    await asActor(ids[1], (client) => client.query("SELECT public.kotoba_move_card($1,'up')", [secondCard]));
    expect((await asActor(ids[1], (client) => client.query("SELECT id FROM public.cards WHERE lesson_id=$1 ORDER BY position", [lesson]))).rows).toEqual([{ id: secondCard }, { id: card }]);
    await asActor(ids[1], (client) => client.query("DELETE FROM public.cards WHERE id=$1", [secondCard]));
    for (const actor of [ids[0], ids[1]]) {
      expect((await asActor(actor, (client) => client.query("SELECT id FROM public.lessons WHERE id=$1", [lesson]))).rows).toEqual([{ id: lesson }]);
      await expect(asActor(actor, (client) => client.query("UPDATE public.lessons SET student_creator_id=NULL WHERE id=$1", [lesson]))).rejects.toThrow('lesson_audience_is_immutable');
      await expect(asActor(actor, (client) => client.query("UPDATE public.lessons SET class_id=$2 WHERE id=$1", [lesson, classId]))).rejects.toThrow('lesson_audience_is_immutable');
    }
    for (const status of ["draft", "published"]) {
      await asActor(ids[1], (client) => client.query("UPDATE public.lessons SET status=$2::public.lesson_status WHERE id=$1", [lesson, status]));
      for (const actor of [ids[2], ids[3], ids[4], ids[5]]) {
        expect((await asActor(actor, (client) => client.query("SELECT id FROM public.lessons WHERE id=$1", [lesson]))).rows).toEqual([]);
        expect((await asActor(actor, (client) => client.query("SELECT id FROM public.cards WHERE lesson_id=$1", [lesson]))).rows).toEqual([]);
        expect((await asActor(actor, (client) => client.query("UPDATE public.lessons SET title='Stolen' WHERE id=$1 RETURNING id", [lesson]))).rows).toEqual([]);
        expect((await asActor(actor, (client) => client.query("DELETE FROM public.cards WHERE id=$1 RETURNING id", [card]))).rows).toEqual([]);
        await expect(add(actor, lesson)).rejects.toThrow(/row-level security/);
      }
      await expect(asActor(ids[4], (client) => client.query("SELECT public.kotoba_record_review($1,$2,'good')", [card, crypto.randomUUID()]))).rejects.toThrow('not_enrolled');
      if (status === 'draft') await expect(asActor(ids[1], (client) => client.query("SELECT public.kotoba_record_review($1,$2,'good')", [card, crypto.randomUUID()]))).rejects.toThrow('not_enrolled');
    }
    await expect(asActor(ids[4], (client) => client.query(
      "INSERT INTO public.card_progress(student_id,card_id,due_at) VALUES ($1,$2,now())", [ids[4], card],
    ))).rejects.toThrow(/row-level security/);
    await asActor(ids[3], (client) => client.query("SELECT public.kotoba_switch_admin_mode('teacher')"));
    expect((await asActor(ids[3], (client) => client.query("SELECT id FROM public.lessons WHERE id=$1", [lesson]))).rows).toEqual([]);
    await asActor(ids[3], (client) => client.query("SELECT public.kotoba_switch_admin_mode('student')"));
    await asActor(ids[0], (client) => client.query("UPDATE public.cards SET meaning_vi='đọc sách' WHERE id=$1", [card]));
    expect((await asActor(ids[1], (client) => client.query("SELECT meaning_vi FROM public.cards WHERE id=$1", [card]))).rows).toEqual([{ meaning_vi: 'đọc sách' }]);
    const sharedLesson = (await insertLesson(ids[0], null)).rows[0].id;
    await add(ids[0], sharedLesson);
    await asActor(ids[0], (client) => client.query("UPDATE public.lessons SET status='published' WHERE id=$1", [sharedLesson]));
    expect((await asActor(ids[1], (client) => client.query("UPDATE public.lessons SET title='Stolen' WHERE id=$1 RETURNING id", [sharedLesson]))).rows).toEqual([]);
    await expect(add(ids[1], sharedLesson)).rejects.toThrow(/row-level security/);
    await asActor(ids[1], (client) => client.query("SELECT public.kotoba_record_review($1,$2,'good')", [card, crypto.randomUUID()]));
    const totals = (await asActor(ids[0], (client) => client.query("SELECT student_id,total,studied FROM public.kotoba_class_student_progress($1) ORDER BY student_id", [personalClass]))).rows;
    expect(totals).toEqual(expect.arrayContaining([
      { student_id: ids[1], total: "2", studied: "1" },
      { student_id: ids[4], total: "1", studied: "0" },
    ]));
    await ownerQuery("DELETE FROM public.class_memberships WHERE class_id=$1 AND student_id=$2", [personalClass, ids[1]]);
    expect((await asActor(ids[1], (client) => client.query("SELECT id FROM public.lessons WHERE id=$1", [lesson]))).rows).toEqual([]);
    await expect(insertLesson(ids[1], ids[1])).rejects.toThrow(/row-level security/);
  });

  it("keeps administrator workspace switching explicit", async () => {
    await asActor(ids[3], (client) => client.query("SELECT public.kotoba_switch_admin_mode('teacher')"));
    const created = await asActor(ids[3], async (client) => {
      const actor = await client.query("SELECT public.kotoba_actor_is_teacher() AS teacher");
      expect(actor.rows[0].teacher).toBe(true);
      return client.query("INSERT INTO public.classes (teacher_id,name) VALUES ($1,'Admin debug') RETURNING id", [ids[3]]);
    });
    expect(created.rowCount).toBe(1);
    await asActor(ids[3], (client) => client.query("SELECT public.kotoba_switch_admin_mode('student')"));
    expect((await asActor(ids[3], (client) => client.query("SELECT id FROM public.classes WHERE id=$1", [created.rows[0].id]))).rows).toEqual([]);
  });
});
