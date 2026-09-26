export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="rounded-2xl bg-surface px-6 py-14 text-center"><h2 className="text-xl font-bold">{title}</h2><p className="mx-auto mt-2 max-w-md leading-relaxed text-muted">{description}</p>{action&&<div className="mt-6">{action}</div>}</div> }

