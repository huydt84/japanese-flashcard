export function LessonLoading() {
  return <main className="min-h-[100dvh] px-4 py-5 sm:px-7" role="status" aria-label="Đang tải bài học">
    <div className="mx-auto max-w-5xl animate-pulse motion-reduce:animate-none" aria-hidden="true">
      <div className="h-11 w-28 rounded-xl bg-line" />
      <div className="mt-5 h-12 w-3/4 max-w-lg rounded-xl bg-line" />
      <div className="mt-4 h-5 w-40 rounded-xl bg-line" />
      <div className="my-8 grid gap-3 sm:grid-cols-2"><div className="h-24 rounded-2xl bg-line" /><div className="h-24 rounded-2xl bg-line" /></div>
      {[0, 1, 2].map((index) => <div key={index} className="mt-6 h-32 rounded-xl bg-line/60" />)}
    </div>
  </main>;
}
