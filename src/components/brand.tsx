import Link from "next/link";
export function Brand({ href = "/" }: { href?: string }){return <Link href={href} className="inline-flex items-center gap-3 font-bold tracking-[-0.02em]"><span className="grid size-9 place-items-center rounded-full bg-brand text-sm text-white" aria-hidden="true">語</span><span>Kotoba</span></Link>}
