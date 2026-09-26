export function WorkspaceLoading() {
  return (
    <div role="status" aria-label="Đang tải nội dung" className="mx-auto max-w-6xl">
      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
        <div className="h-12 w-3/4 max-w-md rounded-xl bg-line" />
        <div className="mt-4 h-6 w-2/3 max-w-sm rounded-lg bg-line" />
        <div className="mt-12 h-8 w-40 rounded-lg bg-line" />
        <div className="mt-6 h-28 rounded-xl bg-line" />
      </div>
    </div>
  );
}
