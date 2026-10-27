import Link from "next/link";
import { GAMES, KIND_LABELS } from "@/game/hub";
import HubRecord from "@/game/HubRecord";
import BasicsLinks from "@/learn/basics/BasicsLinks";
import { cn } from "@/utils/cn";

// 별 놀이터: 플레이트 솔버로 쌓은 하늘 계산으로 만든 게임들
export default function Page() {
  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-8">
      <div className="fx-rise mt-4 flex flex-col items-center gap-2 text-center">
        <h1 className="bg-gradient-to-b from-white via-indigo-100 to-indigo-300 bg-clip-text text-5xl font-black text-transparent md:text-6xl">
          별 놀이터
        </h1>
        <p className="opacity-70">
          놀다 보면 별자리와 하늘의 움직임, 그리고 컴퓨터가 사진 속 하늘을 찾는
          방법을 알게 돼요.
        </p>
      </div>
      {(["game", "learn", "explore"] as const).map((kind, k) => (
        <section key={kind} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-2xl font-bold">{KIND_LABELS[kind].title}</h2>
            <span className="text-sm opacity-60">{KIND_LABELS[kind].note}</span>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {GAMES.filter((g) => g.kind === kind).map((g, i) => (
              // 카드 전체가 게임으로 가는 링크다(제목 링크를 카드 크기로 늘림). 기초 링크는 그 위에 따로 눌린다
              <div
                key={g.href}
                className="fx-rise"
                style={{ animationDelay: `${150 + (k * 6 + i) * 80}ms` }}
              >
                <div
                  className={cn(
                    "rounded-box flex h-full flex-col gap-3 bg-gradient-to-br p-[1.5px]",
                    g.accent,
                    g.ready ? "fx-card" : "opacity-50",
                  )}
                >
                  <div className="bg-base-200/90 rounded-box relative flex h-full flex-col gap-2 p-5 backdrop-blur">
                    <div className="flex items-start justify-between">
                      <span className="text-4xl">{g.icon}</span>
                      {g.ready ? (
                        <HubRecord href={g.href} />
                      ) : (
                        <span className="badge badge-sm badge-ghost">
                          준비 중
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold">
                      {g.ready ? (
                        <Link
                          href={g.href}
                          className="before:rounded-box before:absolute before:inset-0"
                        >
                          {g.title}
                        </Link>
                      ) : (
                        g.title
                      )}
                    </h2>
                    <p className="text-sm">{g.summary}</p>
                    <p className="mt-auto text-xs opacity-60">
                      배우는 것: {g.learn}
                    </p>
                    {g.basics && (
                      <BasicsLinks slugs={g.basics} className="relative z-10" />
                    )}
                    {g.ready && (
                      <span className="text-primary text-sm font-bold">
                        {g.kind === "game"
                          ? "플레이 →"
                          : g.kind === "learn"
                            ? "배우러 가기 →"
                            : "둘러보기 →"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
