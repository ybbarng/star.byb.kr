import Link from "next/link";
import { Stat } from "@/learn/LearnArticle";
import { LEARN_STEPS, learnHref } from "@/learn/steps";

// 찾는 원리(플레이트 솔빙) 첫 페이지: 전체 흐름과 각 단계로 가는 길
export default function Page() {
  const [prepare, ...rest] = LEARN_STEPS;
  const core = rest.filter((s) => s.core);
  const extra = rest.filter((s) => !s.core);

  return (
    <div className="flex w-full max-w-4xl flex-col gap-12 pb-16">
      <header className="fx-rise mt-4 flex flex-col items-center gap-3 text-center">
        <h1 className="bg-gradient-to-b from-white via-indigo-100 to-indigo-300 bg-clip-text text-4xl leading-tight font-black text-transparent md:text-5xl">
          컴퓨터는 사진 속 하늘을
          <br />
          어떻게 찾을까요?
        </h1>
        <p className="max-w-2xl opacity-75 md:text-lg">
          사진의 점 하나하나가 하늘의 어느 방향인지 알아내는 일을{" "}
          <b>플레이트 솔빙</b>(plate solving)이라고 해요. 사람이 별자리 모양을
          보고 &ldquo;아, 북두칠성!&rdquo; 하는 일을, 컴퓨터는 별들이 이루는
          모양을 숫자로 바꿔 별 지도와 맞춰 보는 방법으로 해요.
        </p>
      </header>

      <section
        className="fx-rise flex flex-col gap-4"
        style={{ animationDelay: "100ms" }}
      >
        <h2 className="text-sm font-bold opacity-70">미리 한 번</h2>
        <StepCard step={prepare} label="0단계" />
        <h2 className="mt-2 text-sm font-bold opacity-70">사진마다</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {core.map((s, i) => (
            <StepCard key={s.slug} step={s} label={`${i + 1}단계`} />
          ))}
        </div>
        <p className="text-center text-sm opacity-60">
          ↓ 찾은 방향으로 별 지도를 사진 위에 겹쳐 별자리·별 이름·행성을 그려요.
        </p>
        <h2 className="mt-2 text-sm font-bold opacity-70">더 깊이</h2>
        {extra.map((s) => (
          <StepCard key={s.slug} step={s} label="덧붙여" />
        ))}
      </section>

      <section
        className="fx-rise flex flex-col gap-4"
        style={{ animationDelay: "200ms" }}
      >
        <h2 className="text-2xl font-black">숫자로 보면</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat value="1,625개" label="별 지도에 담은 별 (5등급까지)" />
          <Stat
            value="약 0.7MB"
            label="처음 받는 양 (압축). 별 모양 색인은 받지 않고 브라우저가 만들어요"
          />
          <Stat
            value="8초"
            label="풀이 시간 상한. 샘플은 대부분 1~2초 안에 끝나요"
          />
          <Stat value="14 / 16" label="사람 손 없이 풀리는 실제 샘플 사진" />
          <Stat
            value="108 / 112"
            label="재압축·축소·WebP로 바꾼 사진도 풀리는 경우"
          />
          <Stat value="0번" label="틀린 답을 확신한 횟수 (위 시험 전체)" />
        </div>
        <p className="text-sm opacity-70">
          모든 계산은 브라우저에서 해요. 사진은 서버로 가지 않고, 서버는 정적
          파일만 내려줘요.
        </p>
      </section>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href={learnHref(prepare.slug)} className="btn btn-primary">
          처음부터 읽기
        </Link>
        <Link href="/plate-solver" className="btn btn-ghost">
          직접 해 보기
        </Link>
      </div>
    </div>
  );
}

function StepCard({
  step,
  label,
}: {
  step: (typeof LEARN_STEPS)[number];
  label: string;
}) {
  return (
    <Link
      href={learnHref(step.slug)}
      className="fx-card bg-base-200/70 rounded-box flex gap-4 p-5 backdrop-blur"
    >
      <span className="text-3xl text-indigo-300">{step.icon}</span>
      <span className="flex flex-col gap-1">
        <span className="text-xs opacity-60">{label}</span>
        <span className="font-bold">{step.title}</span>
        <span className="text-sm opacity-70">{step.summary}</span>
      </span>
    </Link>
  );
}
