import Link from "next/link";
import { GAMES } from "@/game/hub";

// 별 놀이터: 플레이트 솔버로 쌓은 하늘 계산으로 만든 게임들
export default function Page() {
  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">별 놀이터</h1>
        <p className="opacity-70">
          놀다 보면 별자리와 하늘의 움직임, 그리고 컴퓨터가 사진 속 하늘을 찾는
          방법을 알게 돼요.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g) => {
          const body = (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{g.title}</h2>
                {!g.ready && (
                  <span className="badge badge-sm badge-ghost">준비 중</span>
                )}
              </div>
              <p className="text-sm">{g.summary}</p>
              <p className="text-xs opacity-60">배우는 것: {g.learn}</p>
            </>
          );

          return g.ready ? (
            <Link
              key={g.href}
              href={g.href}
              className="bg-base-200 hover:bg-base-300 rounded-box flex flex-col gap-2 p-5 transition"
            >
              {body}
            </Link>
          ) : (
            <div
              key={g.href}
              className="bg-base-200 rounded-box flex flex-col gap-2 p-5 opacity-60"
            >
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
