import type { Metadata } from "next";
import Link from "next/link";
import { BasicsTopicList } from "@/learn/basics/BasicsTopicList";
import { MARKS } from "@/learn/basics/topics";

export const metadata: Metadata = {
  title: "하늘 읽기 기초",
  description:
    "위도·경도, 적경·적위, 항성시, 지구의 기울기, 별의 밝기와 거리, 은하수, 별 건너뛰기, 옛 항해술 — 밤하늘을 읽는 기초 개념",
};

// 하늘 읽기 기초 첫 페이지: 표시 설명과 목록
export default function Page() {
  return (
    <div className="flex w-full max-w-4xl min-w-0 flex-col gap-8 pb-16">
      <header className="fx-rise mt-4 flex flex-col gap-3">
        <nav className="text-xs">
          <Link href="/learn" className="link link-hover opacity-70">
            찾는 원리
          </Link>
          <span className="opacity-40"> › </span>
          <span className="font-bold">하늘 읽기 기초</span>
        </nav>
        <h1 className="text-3xl font-black md:text-4xl">하늘 읽기 기초</h1>
        <p className="opacity-80 md:text-lg">
          플레이트 솔버와 별 놀이터 밑에 깔린 천문 개념들이에요. 페이지마다
          어디에 쓰이는지 표시해 두었어요.
        </p>
        <ul className="flex flex-col gap-1 text-sm opacity-80">
          {Object.values(MARKS).map((m) => (
            <li key={m.label}>
              {m.icon} <b>{m.label}</b>
            </li>
          ))}
        </ul>
      </header>
      <BasicsTopicList />
    </div>
  );
}
