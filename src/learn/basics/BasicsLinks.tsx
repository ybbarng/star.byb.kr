import Link from "next/link";
import { basicsHref, basicsTopic } from "@/learn/basics/topics";
import { cn } from "@/utils/cn";

// 다른 갈래(놀이터·찾는 원리·플레이트 솔버)에서 "하늘 읽기 기초"로 건너가는 작은 한 줄.
// 큰 상자 대신 글자 크기의 링크만 둔다
export default function BasicsLinks({
  slugs,
  label = "더 알아보기",
  className,
}: {
  slugs: readonly string[];
  label?: string;
  className?: string;
}) {
  const topics = slugs.flatMap((s) => basicsTopic(s) ?? []);

  if (!topics.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs",
        className,
      )}
    >
      <span className="opacity-60">📘 {label}</span>
      {topics.map((t) => (
        <Link
          key={t.slug}
          href={basicsHref(t.slug)}
          className="link link-hover text-indigo-200"
        >
          {t.icon} {t.title}
        </Link>
      ))}
    </div>
  );
}

// 글 속에서 개념이 처음 나오는 곳을 기초 페이지로 잇는다. 점선 밑줄만 두어 읽기를 방해하지 않는다
export function BasicsTerm({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const topic = basicsTopic(slug);

  return (
    <Link
      href={basicsHref(slug)}
      title={topic ? `하늘 읽기 기초: ${topic.title}` : undefined}
      className="underline decoration-indigo-300/60 decoration-dotted underline-offset-4 hover:text-indigo-200"
    >
      {children}
    </Link>
  );
}
