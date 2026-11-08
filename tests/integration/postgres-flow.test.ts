// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient, type QueryResult } from "pg";

const run = process.env.RUN_NEON_INTEGRATION === "1" ? describe : describe.skip;
const ownerUrl = process.env.TEST_DATABASE_URL ?? "";
const runtimeUrl = process.env.TEST_RUNTIME_DATABASE_URL ?? "";

run("authenticated PostgreSQL access and domain commands", () => {
  const owner = new Pool({ connectionString: ownerUrl, max: 1 });
  const runtime = new Pool({ connectionString: runtimeUrl, max: 2, options: "-c search_path=auth,public" });
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
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
    for (const [index, role] of ["teacher", "student", "teacher", "admin"].entries()) {
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
