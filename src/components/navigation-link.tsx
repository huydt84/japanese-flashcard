"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";

function NavigationPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span role="status" aria-label="Đang mở trang" className="ml-auto">
      <CircleNotch size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
    </span>
  ) : null;
}

export function NavigationLink({ href, exact = false, children }: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || (!exact && pathname.startsWith(`${href}/`));

  return (
    <Link href={href} prefetch={true} aria-current={active ? "page" : undefined}
      className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 font-semibold ${active ? "bg-surface-strong" : "hover:bg-surface-strong"}`}>
      {children}
      <NavigationPending />
    </Link>
  );
}
