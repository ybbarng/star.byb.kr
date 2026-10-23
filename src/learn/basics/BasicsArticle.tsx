import type { BasicsMark, BasicsTopic } from "@/learn/basics/topics";
import Link from "next/link";
import { BASICS_TOPICS, basicsHref, MARKS } from "@/learn/basics/topics";
import { cn } from "@/utils/cn";

// 하늘 읽기 기초 하위 페이지 공용 틀: 위에 목차·표시, 본문, 아래에 "이 개념을 쓰는 곳"과 이전·다음
export default function BasicsArticle({
  slug,
  lead,
  children,
}: {
  slug: string;
  lead: React.ReactNode;
  children: React.ReactNode;
}) {
  const index = BASICS_TOPICS.findIndex((t) => t.slug === slug);
  const topic = BASICS_TOPICS[index];
  const prev = BASICS_TOPICS[index - 1];
  const next = BASICS_TOPICS[index + 1];

  return (
    <article className="flex w-full max-w-3xl min-w-0 flex-col gap-8 pb-16">
      <header className="fx-rise flex flex-col gap-3">
        <nav className="flex flex-wrap items-center gap-1 text-xs">
          <Link href="/learn" className="link link-hover opacity-70">
            찾는 원리
          </Link>
          <span className="opacity-40">›</span>
          <Link href="/learn/basics" className="link link-hover opacity-70">
            하늘 읽기 기초
          </Link>
          <span className="opacity-40">›</span>
          <span className="font-bold">
            {index + 1}. {topic.title}
          </span>
        </nav>
        <h1 className="flex items-center gap-3 text-3xl font-black md:text-4xl">
          <span>{topic.icon}</span>
          {topic.title}
        </h1>
        <MarkBadges marks={topic.marks} />
        <p className="text-lg opacity-80">{lead}</p>
      </header>

      <div className="learn-body fx-rise flex min-w-0 flex-col gap-6">
        {children}
      </div>

      <UsedIn topic={topic} />

      <footer className="grid grid-cols-2 gap-3">
        <Link
          href={prev ? basicsHref(prev.slug) : "/learn/basics"}
          className="fx-card bg-base-200/70 rounded-box p-4 backdrop-blur"
        >
          <div className="text-xs opacity-60">
            {prev ? "← 이전" : "← 처음으로"}
          </div>
          <div className="font-bold">
            {prev ? prev.title : "하늘 읽기 기초"}
          </div>
        </Link>
        <Link
          href={next ? basicsHref(next.slug) : "/games"}
          className={cn(
            "fx-card rounded-box p-4 text-right backdrop-blur",
            next ? "bg-base-200/70" : "bg-primary/30",
          )}
        >
          <div className="text-xs opacity-60">
            {next ? "다음 →" : "직접 해 보기 →"}
          </div>
          <div className="font-bold">{next ? next.title : "별 놀이터"}</div>
        </Link>
      </footer>
    </article>
  );
}

export function MarkBadges({
  marks,
  small,
}: {
  marks: BasicsMark[];
  small?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {marks.map((m) => (
        <span
          key={m}
          className={cn(
            "rounded-full border px-2 py-0.5 whitespace-nowrap",
            small ? "text-[11px]" : "text-xs",
            MARKS[m].tone,
          )}
        >
          {MARKS[m].icon} {MARKS[m].label}
        </span>
      ))}
    </div>
  );
}

// 이 개념을 쓰는 곳: 표시마다 묶어 링크로
function UsedIn({ topic }: { topic: BasicsTopic }) {
  if (!topic.links.length) {
    return null;
  }

  const groups = (["solver", "games"] as const)
    .map((mark) => ({
      mark,
      links: topic.links.filter((l) => l.mark === mark),
    }))
    .filter((g) => g.links.length);

  return (
    <section className="bg-base-200/70 rounded-box flex flex-col gap-3 p-4 backdrop-blur">
      <h2 className="font-bold">이 개념을 쓰는 곳</h2>
      {groups.map((g) => (
        <div key={g.mark} className="flex flex-col gap-1.5">
          <div className="text-xs opacity-70">
            {MARKS[g.mark].icon} {MARKS[g.mark].label}
          </div>
          <div className="flex flex-wrap gap-2">
            {g.links.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                className="btn btn-sm h-auto min-h-8 py-1 text-left whitespace-normal"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
