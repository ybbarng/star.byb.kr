import Link from "next/link";
import { GAMES } from "@/game/hub";
import HubRecord from "@/game/HubRecord";
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
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g, i) => {
          const body = (
            <div
              className={cn(
                "rounded-box flex h-full flex-col gap-3 bg-gradient-to-br p-[1.5px]",
                g.accent,
              )}
            >
              <div className="bg-base-200/90 rounded-box flex h-full flex-col gap-2 p-5 backdrop-blur">
                <div className="flex items-start justify-between">
                  <span className="text-4xl">{g.icon}</span>
                  {g.ready ? (
                    <HubRecord href={g.href} />
                  ) : (
                    <span className="badge badge-sm badge-ghost">준비 중</span>
                  )}
                </div>
                <h2 className="text-xl font-bold">{g.title}</h2>
                <p className="text-sm">{g.summary}</p>
                <p className="mt-auto text-xs opacity-60">
                  배우는 것: {g.learn}
                </p>
                {g.ready && (
                  <span className="text-primary text-sm font-bold">
                    플레이 →
                  </span>
                )}
              </div>
            </div>
          );

          return (
            <div
              key={g.href}
              className="fx-rise"
              style={{ animationDelay: `${150 + i * 80}ms` }}
            >
              {g.ready ? (
                <Link
                  href={g.href}
                  className="fx-card rounded-box block h-full"
                >
                  {body}
                </Link>
              ) : (
                <div className="h-full opacity-50">{body}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
