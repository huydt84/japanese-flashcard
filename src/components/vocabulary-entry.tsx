import type { StudyCard } from "@/lib/types";

export function VocabularyEntry({ card }: { card: StudyCard }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] sm:gap-8">
      <div className="min-w-0">
        <p lang="ja" className="break-words font-jp text-2xl font-semibold leading-relaxed">{card.kanji}</p>
        <p lang="ja" className="mt-1 break-words font-jp text-sm text-muted">{card.hiragana}</p>
      </div>
      <div className="min-w-0">
        <p className="break-words text-lg font-semibold">{card.meaning_vi}</p>
        <p lang="ja" className="mt-3 break-words font-jp leading-relaxed">{card.example_ja}</p>
        <p className="mt-1 break-words text-sm leading-relaxed text-muted">{card.example_vi}</p>
      </div>
    </div>
  );
}
