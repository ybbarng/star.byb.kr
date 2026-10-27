import Link from "next/link";
import { GAMES } from "@/game/hub";
import { LEARN_STEPS, learnHref } from "@/learn/steps";
import GameCarousel from "@/ui/GameCarousel";
import SiteShell from "@/ui/SiteShell";
import SkyNowNote from "@/ui/SkyNowNote";

// 첫 화면: 무엇을 하는 곳인지 풀린 사진 한 장으로 보여 주고, 찾는 원리 세 단계와 별 놀이터를 소개한다.
// 위쪽 길잡이와 겹치지 않게 버튼은 "별 찾으러 가기" 하나만 둔다.
export default function Page() {
  const games = GAMES.filter((g) => g.ready);
  const steps = LEARN_STEPS.filter((s) => s.core);

  return (
    <SiteShell>
      <div className="flex w-full max-w-5xl flex-col gap-12 pb-16">
        <section className="fx-rise mt-4 flex flex-col items-center gap-4 text-center md:mt-10">
          <h1 className="bg-gradient-to-b from-white via-indigo-100 to-indigo-300 bg-clip-text text-4xl leading-tight font-black text-transparent md:text-6xl">
            어떤 별이 찍혔는지
            <br />
            궁금하세요?
          </h1>
          <p className="max-w-xl opacity-75 md:text-lg">
            여러분의 추억과 함께한 그 별이 무엇인지,
            <br className="md:hidden" /> 지금 바로 찾아보세요.
          </p>
          <Link href="/plate-solver" className="btn btn-primary btn-lg mt-2">
            별 찾으러 가기
          </Link>
        </section>

        <figure
          className="fx-rise rounded-box overflow-hidden shadow-2xl ring-1 shadow-indigo-900/40 ring-white/10"
          style={{ animationDelay: "150ms" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 정적 내보내기라 next/image 최적화를 쓰지 않는다 */}
          <img
            src="/home/solved-aurora.webp"
            alt="캐나다 옐로나이프의 오로라 사진에 카시오페이아자리·안드로메다자리·백조자리 선과 별 이름이 그려진 모습"
            width={1600}
            height={738}
            className="block h-auto w-full"
          />
          <figcaption className="bg-base-200/80 px-4 py-2 text-xs opacity-80">
            캐나다 옐로나이프에서 찍은 오로라. 카시오페이아자리와 안드로메다
            은하, 백조자리가 함께 했어요.
          </figcaption>
        </figure>

        <section
          className="fx-rise flex flex-col gap-4"
          style={{ animationDelay: "250ms" }}
        >
          <div className="flex items-end justify-between gap-2">
            <h2 className="text-2xl font-black">어떻게 찾을까요?</h2>
            <Link href="/learn" className="link link-hover text-sm opacity-70">
              원리 전체 보기 →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, i) => (
              <Link
                key={step.slug}
                href={learnHref(step.slug)}
                className="fx-card bg-base-200/70 rounded-box flex flex-col gap-1 p-5 backdrop-blur"
              >
                <span className="text-2xl text-indigo-300">{step.icon}</span>
                <span className="text-xs opacity-50">{i + 1}단계</span>
                <span className="font-bold">{step.title}</span>
                <span className="text-sm opacity-70">{step.summary}</span>
                <span className="text-primary mt-auto pt-2 text-sm">
                  자세히 →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section
          className="fx-rise flex flex-col gap-4"
          style={{ animationDelay: "350ms" }}
        >
          <div className="flex items-end justify-between gap-2">
            <h2 className="text-2xl font-black">별 놀이터</h2>
            <Link href="/games" className="link link-hover text-sm opacity-70">
              전체 보기 →
            </Link>
          </div>
          <p className="-mt-2 text-sm opacity-75">
            게임 {games.filter((g) => g.kind === "game").length}개와 둘러보기{" "}
            {games.filter((g) => g.kind === "explore").length}개로 놀면서
            별자리와 하늘의 움직임을 배워요.
          </p>
          <GameCarousel games={games} />
        </section>

        <footer className="flex flex-col items-center gap-2 text-center text-xs opacity-50">
          <SkyNowNote />
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <span>
              만든 이{" "}
              <a
                className="link link-hover"
                href="https://github.com/ybbarng"
                target="_blank"
                rel="noopener noreferrer"
              >
                ybbarng
              </a>{" "}
              with{" "}
              <a
                className="link link-hover"
                href="https://www.claude.com/product/claude-code"
                target="_blank"
                rel="noopener noreferrer"
              >
                Claude Code
              </a>
            </span>
            <a className="link link-hover" href="/presentation/v3.html">
              발표 자료 V3
            </a>
            <Link href="/credits" className="link link-hover">
              출처와 참고 자료
            </Link>
          </div>
        </footer>
      </div>
    </SiteShell>
  );
}
