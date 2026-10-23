import Link from "next/link";
import { MarkBadges } from "@/learn/basics/BasicsArticle";
import { BASICS_TOPICS, basicsHref } from "@/learn/basics/topics";

// 하늘 읽기 기초 목록 카드 (찾는 원리 첫 페이지와 기초 첫 페이지가 같이 쓴다)
export function BasicsTopicList() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {BASICS_TOPICS.map((t, i) => (
        <Link
          key={t.slug}
          href={basicsHref(t.slug)}
          className="fx-card bg-base-200/70 rounded-box flex min-w-0 gap-4 p-5 backdrop-blur"
        >
          <span className="text-3xl">{t.icon}</span>
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs opacity-60">{i + 1}</span>
            <span className="font-bold">{t.title}</span>
            <span className="text-sm opacity-70">{t.summary}</span>
            <MarkBadges marks={t.marks} small />
          </span>
        </Link>
      ))}
    </div>
  );
}
