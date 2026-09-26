import { notFound } from "next/navigation";
import { StudySession } from "@/components/study-session";
import { requireProfile } from "@/lib/auth";
import type { StudyCard } from "@/lib/types";

export default async function StudyPage({params}:PageProps<"/study/[lessonId]">){const{lessonId}=await params;const{profile,supabase}=await requireProfile("student");const{data:lesson}=await supabase.from("lessons").select("id,title,class_id,status").eq("id",lessonId).eq("status","published").single();if(!lesson)notFound();const{data:cards}=await supabase.from("cards").select("id,kanji,hiragana,meaning_vi,example_ja,example_vi,position").eq("lesson_id",lessonId).order("position");const ids=(cards??[]).map(c=>c.id);const{data:progress}=ids.length?await supabase.from("card_progress").select("card_id,due_at").eq("student_id",profile.id).in("card_id",ids):{data:[]};const due=new Map((progress??[]).map(p=>[p.card_id,new Date(p.due_at)]));const now=new Date();const queue=(cards??[]).filter(c=>!due.has(c.id)||(due.get(c.id) as Date)<=now) as StudyCard[];return <main className="min-h-[100dvh] px-4 py-5 sm:px-7"><StudySession lessonTitle={lesson.title} cards={queue} backHref="/student"/></main>}

