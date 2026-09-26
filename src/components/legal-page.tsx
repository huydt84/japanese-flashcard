import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/brand";

type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export function LegalPage({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-[100dvh]">
      <header className="mx-auto flex h-18 max-w-5xl items-center justify-between px-5 sm:px-8">
        <Brand />
        <Link href="/" className="quiet-link inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm">
          <ArrowLeft size={18} weight="bold" aria-hidden="true" />
          Về trang đăng nhập
        </Link>
      </header>

      <article className="mx-auto max-w-3xl px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-18">
        <header className="border-b border-line pb-10">
          <h1 className="text-balance text-[clamp(2.5rem,6vw,4.75rem)] font-bold leading-[.96] tracking-[-0.04em]">
            {title}
          </h1>
          <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-muted">{description}</p>
          <p className="mt-5 text-sm font-semibold text-muted">Cập nhật lần cuối: 25 tháng 9, 2026</p>
        </header>

        <div className="space-y-11 pt-10">
          {sections.map((section) => (
            <section key={section.title} aria-labelledby={section.title.toLowerCase().replaceAll(" ", "-")}>
              <h2
                id={section.title.toLowerCase().replaceAll(" ", "-")}
                className="text-2xl font-bold tracking-[-0.025em]"
              >
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-4 leading-7 text-muted">
                  {paragraph}
                </p>
              ))}
              {section.items ? (
                <ul className="mt-4 space-y-3 pl-5 text-muted marker:text-brand">
                  {section.items.map((item) => (
                    <li key={item} className="pl-1 leading-7">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
