import Link from "next/link";
import { LEARN_STEPS, learnHref } from "@/learn/steps";

// 원리 하위 페이지 공용 틀: 위에 단계 표시, 본문, 아래에 이전·다음 단계
export default function LearnArticle({
  slug,
  lead,
  children,
}: {
  slug: string;
  lead: React.ReactNode;
  children: React.ReactNode;
}) {
  const index = LEARN_STEPS.findIndex((s) => s.slug === slug);
  const step = LEARN_STEPS[index];
  const prev = LEARN_STEPS[index - 1];
  const next = LEARN_STEPS[index + 1];

  return (
    <article className="flex w-full max-w-3xl flex-col gap-8 pb-16">
      <header className="fx-rise flex flex-col gap-3">
        <nav className="flex flex-wrap items-center gap-1 text-xs">
          <Link href="/learn" className="link link-hover opacity-70">
            찾는 원리
          </Link>
          {LEARN_STEPS.map((s, i) => (
            <span key={s.slug} className="flex items-center gap-1">
              <span className="opacity-40">›</span>
              <Link
                href={learnHref(s.slug)}
                className={
                  s.slug === slug ? "font-bold" : "link link-hover opacity-60"
                }
              >
                {i}. {s.title}
              </Link>
            </span>
          ))}
        </nav>
        <h1 className="flex items-center gap-3 text-3xl font-black md:text-4xl">
          <span className="text-indigo-300">{step.icon}</span>
          {step.title}
        </h1>
        <p className="text-lg opacity-80">{lead}</p>
      </header>

      <div className="learn-body fx-rise flex flex-col gap-6">{children}</div>

      <footer className="grid grid-cols-2 gap-3">
        {prev ? (
          <Link
            href={learnHref(prev.slug)}
            className="fx-card bg-base-200/70 rounded-box p-4 backdrop-blur"
          >
            <div className="text-xs opacity-60">← 이전</div>
            <div className="font-bold">{prev.title}</div>
          </Link>
        ) : (
          <Link
            href="/learn"
            className="fx-card bg-base-200/70 rounded-box p-4 backdrop-blur"
          >
            <div className="text-xs opacity-60">← 처음으로</div>
            <div className="font-bold">찾는 원리</div>
          </Link>
        )}
        {next ? (
          <Link
            href={learnHref(next.slug)}
            className="fx-card bg-base-200/70 rounded-box p-4 text-right backdrop-blur"
          >
            <div className="text-xs opacity-60">다음 →</div>
            <div className="font-bold">{next.title}</div>
          </Link>
        ) : (
          <Link
            href="/plate-solver"
            className="fx-card bg-primary/30 rounded-box p-4 text-right backdrop-blur"
          >
            <div className="text-xs opacity-60">직접 해 보기 →</div>
            <div className="font-bold">사진 속 별자리 찾기</div>
          </Link>
        )}
      </footer>
    </article>
  );
}

// 본문 한 칸 (제목 + 내용)
export function LearnSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="flex flex-col gap-3 leading-relaxed opacity-85">
        {children}
      </div>
    </section>
  );
}

// 숫자 하나를 크게 보여 주는 칸
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-base-200/70 rounded-box flex flex-col gap-1 p-4 backdrop-blur">
      <div className="text-2xl font-black text-indigo-200">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}

// 데모·그림을 담는 틀
export function Figure({
  caption,
  children,
}: {
  caption?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <figure className="bg-base-200/70 rounded-box flex flex-col gap-3 p-4 backdrop-blur">
      {children}
      {caption && (
        <figcaption className="text-xs opacity-70">{caption}</figcaption>
      )}
    </figure>
  );
}
