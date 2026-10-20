import Link from "next/link";
import { GAMES } from "@/game/hub";
import { LEARN_STEPS, learnHref } from "@/learn/steps";
import SiteShell from "@/ui/SiteShell";

// 첫 화면: 무엇을 하는 곳인지 풀린 사진 한 장으로 보여 주고, 찾는 원리 세 단계와 별 놀이터를 소개한다.
// 위쪽 길잡이와 겹치지 않게 버튼은 "내 사진으로 찾기" 하나만 둔다.
export default function Page() {
  const games = GAMES.filter((g) => g.ready);
  const steps = LEARN_STEPS.filter((s) => s.core);

  return (
    <SiteShell>
      <div className="flex w-full max-w-5xl flex-col gap-12 pb-16">
        <section className="fx-rise mt-4 flex flex-col items-center gap-4 text-center md:mt-10">
          <h1 className="bg-gradient-to-b from-white via-indigo-100 to-indigo-300 bg-clip-text text-4xl leading-tight font-black text-transparent md:text-6xl">
            사진 한 장으로
            <br />
            별자리를 찾아요
          </h1>
          <p className="max-w-xl opacity-75 md:text-lg">
            밤하늘 사진을 올리면, 컴퓨터가 별들의 배치만 보고 하늘 어디를
            찍었는지 찾아 별자리와 별 이름을 그려 줘요.
          </p>
          <Link href="/plate-solver" className="btn btn-primary btn-lg mt-2">
            내 사진으로 찾기
          </Link>
        </section>

        <figure
          className="fx-rise rounded-box overflow-hidden shadow-2xl ring-1 shadow-indigo-900/40 ring-white/10"
          style={{ animationDelay: "150ms" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 정적 내보내기라 next/image 최적화를 쓰지 않는다 */}
          <img
            src="/home/solved-milky-way.webp"
            alt="석촌호수 위 여름 은하수 사진에 궁수자리·전갈자리·독수리자리 선과 별 이름이 그려진 모습"
            width={1200}
            height={800}
            className="block h-auto w-full"
          />
          <figcaption className="bg-base-200/80 px-4 py-2 text-xs opacity-80">
            서울 석촌호수에서 찍은 여름 은하수. 건물 사이로 궁수자리·전갈자리가
            보여요.
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

        <Link
          href="/games"
          className="fx-rise fx-card rounded-box flex flex-col items-center gap-4 bg-gradient-to-br from-indigo-500/25 to-fuchsia-500/10 p-6 text-center ring-1 ring-white/10 md:flex-row md:text-left"
          style={{ animationDelay: "350ms" }}
        >
          <span className="flex gap-1 text-3xl">
            {games.map((g) => (
              <span key={g.href}>{g.icon}</span>
            ))}
          </span>
          <span className="flex flex-1 flex-col gap-1">
            <span className="text-xl font-black">별 놀이터</span>
            <span className="text-sm opacity-75">
              하늘 맞추기, SkyGuessr, 생일 별자리… 게임 {games.length}개로
              놀면서 별자리와 하늘의 움직임을 배워요.
            </span>
          </span>
          <span className="btn btn-sm">놀러 가기 →</span>
        </Link>

        <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs opacity-50">
          <span>
            만든 사람{" "}
            <a
              className="link link-hover"
              href="https://github.com/ybbarng"
              target="_blank"
              rel="noopener noreferrer"
            >
              ybbarng
            </a>
          </span>
          <a className="link link-hover" href="/presentation/v3.html">
            발표 자료 V3
          </a>
          <a className="link link-hover" href="/presentation/index.html">
            V2
          </a>
          <span>
            별 자료:{" "}
            <a
              className="link link-hover"
              href="https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50"
              target="_blank"
              rel="noopener noreferrer"
            >
              예일 밝은 별 목록(BSC5)
            </a>
            {" · "}
            <a
              className="link link-hover"
              href="https://github.com/ofrohn/d3-celestial"
              target="_blank"
              rel="noopener noreferrer"
            >
              별자리선·경계(IAU, d3-celestial, BSD)
            </a>
          </span>
        </footer>
      </div>
    </SiteShell>
  );
}
