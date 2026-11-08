import "server-only";

import { withActor } from "@/lib/db";
import type { Profile, ReviewRating, StudyCard } from "@/lib/types";

type TeacherClass = { id: string; name: string; description: string; created_at: Date; member_count: number; lesson_count: number };
type TeacherLesson = { id: string; title: string; status: string; card_count: number };
type PendingInvite = { id: string; email: string; status: string; created_at: Date };
type ProgressRow = { student_id: string; studied: string; total: string; due: string; good_reviews: string; review_count: string; last_review: Date | null };
type StudyProgress = { card_id: string; due_at: Date | null; last_rating: ReviewRating | null };
type StudyCardRow = StudyCard & { position: number; created_at: Date };

export async function getTeacherClasses(actorId: string) {
  return withActor(actorId, async (client) => {
    const result = await client.query<TeacherClass>(
      `SELECT c.id, c.name, c.description, c.created_at,
        (SELECT count(*)::int FROM public.class_memberships m WHERE m.class_id=c.id) AS member_count,
        (SELECT count(*)::int FROM public.lessons l WHERE l.class_id=c.id) AS lesson_count
      FROM public.classes c WHERE c.archived_at IS NULL ORDER BY c.created_at DESC`,
    );
    return result.rows;
  });
}

export async function getTeacherClass(actorId: string, classId: string) {
  return withActor(actorId, async (client) => {
    const klass = await client.query("SELECT id,name,description FROM public.classes WHERE id=$1", [classId]);
    const lessons = await client.query<TeacherLesson>(
      `SELECT l.id,l.title,l.status,count(c.id)::int AS card_count
      FROM public.lessons l LEFT JOIN public.cards c ON c.lesson_id=l.id
      WHERE l.class_id=$1 GROUP BY l.id ORDER BY l.position`, [classId]);
    const members = await client.query<{ student_id: string; display_name: string | null; email: string }>(
      `SELECT m.student_id,p.display_name,p.email
      FROM public.class_memberships m JOIN public.profiles p ON p.id=m.student_id
      WHERE m.class_id=$1 ORDER BY p.display_name,p.email`, [classId]);
    const invites = await client.query<PendingInvite>("SELECT id,email,status,created_at FROM public.class_invitations WHERE class_id=$1 AND status='pending' ORDER BY created_at DESC", [classId]);
    const progress = await client.query<ProgressRow>("SELECT * FROM public.kotoba_class_student_progress($1)", [classId]);
    return {
      klass: klass.rows[0] ?? null,
      lessons: lessons.rows,
      members: members.rows,
      invites: invites.rows,
      progress: progress.rows.map((item) => ({
        ...item,
        studied: Number(item.studied), total: Number(item.total), due: Number(item.due),
        good_reviews: Number(item.good_reviews), review_count: Number(item.review_count),
      })),
    };
  });
}

export async function getTeacherLesson(actorId: string, lessonId: string, classId: string) {
  return withActor(actorId, async (client) => {
    const lesson = await client.query<{ id: string; title: string; description: string; status: string }>("SELECT id,title,description,status FROM public.lessons WHERE id=$1 AND class_id=$2", [lessonId, classId]);
    const cards = await client.query<StudyCardRow>("SELECT * FROM public.cards WHERE lesson_id=$1 ORDER BY position,created_at", [lessonId]);
    return { lesson: lesson.rows[0] ?? null, cards: cards.rows };
  });
}

export async function getStudentClasses(actorId: string) {
  return withActor(actorId, async (client) => {
    const result = await client.query<{
      class_id: string; class_name: string; class_description: string;
      lesson_id: string | null; lesson_title: string | null; lesson_status: string | null;
      card_count: number; due_count: number;
    }>(
      `SELECT c.id AS class_id,c.name AS class_name,c.description AS class_description,
        l.id AS lesson_id,l.title AS lesson_title,l.status AS lesson_status,
        count(card.id)::int AS card_count,
        count(card.id) FILTER (WHERE progress.card_id IS NULL OR progress.due_at <= now())::int AS due_count
      FROM public.class_memberships membership
      JOIN public.classes c ON c.id=membership.class_id
      LEFT JOIN public.lessons l ON l.class_id=c.id AND l.status='published'
      LEFT JOIN public.cards card ON card.lesson_id=l.id
      LEFT JOIN public.card_progress progress ON progress.card_id=card.id AND progress.student_id=$1
      WHERE membership.student_id=$1
      GROUP BY c.id,c.name,c.description,l.id,l.title,l.status
      ORDER BY c.name,l.position`, [actorId]);
    const classes = new Map<string, { id: string; name: string; description: string; lessons: { id: string; title: string; status: string; card_count: number; due_count: number }[] }>();
    for (const row of result.rows) {
      let klass = classes.get(row.class_id);
      if (!klass) {
        klass = { id: row.class_id, name: row.class_name, description: row.class_description, lessons: [] };
        classes.set(row.class_id, klass);
      }
      if (row.lesson_id && row.lesson_title && row.lesson_status) {
        klass.lessons.push({ id: row.lesson_id, title: row.lesson_title, status: row.lesson_status, card_count: row.card_count, due_count: row.due_count });
      }
    }
    return [...classes.values()];
  });
}

export async function getStudyLesson(actorId: string, lessonId: string) {
  return withActor(actorId, async (client) => {
    const lessonResult = await client.query("SELECT id,title,description,class_id FROM public.lessons WHERE id=$1 AND status='published'", [lessonId]);
    const lesson = lessonResult.rows[0] ?? null;
    if (!lesson) return null;
    const cardsResult = await client.query<StudyCardRow>(
      "SELECT id,kanji,hiragana,meaning_vi,example_ja,example_vi,position,created_at FROM public.cards WHERE lesson_id=$1 ORDER BY position,created_at", [lessonId]);
    const cards = cardsResult.rows;
    const progressResult = cards.length
      ? await client.query<StudyProgress>(
          "SELECT p.card_id,p.due_at,p.last_rating FROM public.card_progress p JOIN public.cards c ON c.id=p.card_id WHERE p.student_id=$1 AND c.lesson_id=$2", [actorId, lessonId])
      : { rows: [] };
    return {
      lesson,
      cards,
      progress: progressResult.rows.map((item) => ({
        card_id: item.card_id,
        due_at: item.due_at?.toISOString() ?? null,
        last_rating: item.last_rating,
      })),
    };
  });
}

export async function getTeacherPreview(actorId: string, lessonId: string) {
  return withActor(actorId, async (client) => {
    const lessonResult = await client.query<{ id: string; title: string; description: string; class_id: string }>("SELECT id,title,description,class_id FROM public.lessons WHERE id=$1", [lessonId]);
    const lesson = lessonResult.rows[0] ?? null;
    if (!lesson) return null;
    const cards = await client.query<StudyCardRow>(
      "SELECT id,kanji,hiragana,meaning_vi,example_ja,example_vi,position,created_at FROM public.cards WHERE lesson_id=$1 ORDER BY position,created_at", [lessonId]);
    return { lesson, cards: cards.rows };
  });
}

export async function getStudentNotifications(actorId: string) {
  return withActor(actorId, async (client) => {
    await client.query("SELECT public.kotoba_claim_pending_invitations()");
    const invites = await client.query<{ id: string; created_at: Date; name: string; description: string }>(
      `SELECT i.id,i.created_at,c.name,c.description FROM public.class_invitations i
      JOIN public.classes c ON c.id=i.class_id WHERE i.recipient_id=$1 AND i.status='pending'
      ORDER BY i.created_at DESC`, [actorId]);
    const notifications = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM public.notifications WHERE user_id=$1 AND read_at IS NULL", [actorId]);
    return { invites: invites.rows, unread: notifications.rows[0].count as number };
  });
}

export type MemberProgress = {
  student_id: string; studied: number; total: number; due: number;
  good_reviews: number; review_count: number; last_review: string | null;
};

export type ProfileRow = Profile;
