"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setMuted, sfx, useMuted } from "@/game/fx/sound";
import GameBasicsLinks from "@/game/GameBasicsLinks";
import { cn } from "@/utils/cn";

// 별 놀이터 공용 효과: 점수 팝업·파티클·고리, 흔들기, 색종이, 숫자 올라가기, 별점, 라운드 배너,
// 시작 화면, 결과 카드, 최고 기록. 모양은 fx.css에 있다.

// ---------- 캔버스 위 효과 (팝업·파티클·고리) ----------

type FxItem =
  | {
      id: number;
      kind: "popup";
      x: number;
      y: number;
      text: string;
      color: string;
      size: number;
    }
  | {
      id: number;
      kind: "burst";
      x: number;
      y: number;
      color: string;
      n: number;
    }
  | { id: number; kind: "ring"; x: number; y: number; color: string };

let nextId = 1;

// 효과 위치는 겹쳐 놓은 요소 너비·높이 대비 비율(0~1)
export const useFx = () => {
  const [items, setItems] = useState<FxItem[]>([]);
  const add = useCallback((item: FxItem, ms: number) => {
    setItems((list) => [...list, item]);
    setTimeout(
      () => setItems((list) => list.filter((i) => i.id !== item.id)),
      ms,
    );
  }, []);

  const popup = useCallback(
    (x: number, y: number, text: string, color = "#ffe27a", size = 28) =>
      add({ id: nextId++, kind: "popup", x, y, text, color, size }, 1200),
    [add],
  );
  const burst = useCallback(
    (x: number, y: number, color = "#ffe27a", n = 16) =>
      add({ id: nextId++, kind: "burst", x, y, color, n }, 900),
    [add],
  );
  const ring = useCallback(
    (x: number, y: number, color = "#ffe27a") =>
      add({ id: nextId++, kind: "ring", x, y, color }, 800),
    [add],
  );

  return useMemo(
    () => ({ items, popup, burst, ring }),
    [items, popup, burst, ring],
  );
};

export type Fx = ReturnType<typeof useFx>;

const pct = (v: number) => `${v * 100}%`;

export function FxLayer({ fx }: { fx: Fx }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {fx.items.map((it) =>
        it.kind === "popup" ? (
          <div
            key={it.id}
            className="fx-popup"
            style={{
              left: pct(it.x),
              top: pct(it.y),
              color: it.color,
              fontSize: it.size,
            }}
          >
            {it.text}
          </div>
        ) : it.kind === "ring" ? (
          <div
            key={it.id}
            className="fx-ring"
            style={{ left: pct(it.x), top: pct(it.y), color: it.color }}
          />
        ) : (
          Array.from({ length: it.n }, (_, k) => {
            const a = (k / it.n) * Math.PI * 2 + (it.id % 7);
            const r = 50 + ((k * 37) % 50);

            return (
              <div
                key={`${it.id}-${k}`}
                className="fx-particle"
                style={
                  {
                    left: pct(it.x),
                    top: pct(it.y),
                    background: it.color,
                    boxShadow: `0 0 8px ${it.color}`,
                    "--dx": `${Math.cos(a) * r}px`,
                    "--dy": `${Math.sin(a) * r}px`,
                  } as CSSProperties
                }
              />
            );
          })
        ),
      )}
    </div>
  );
}

// ---------- 흔들기 ----------

// 틀렸을 때 요소를 흔든다: ref를 붙이고 shake()를 부른다 (연달아 불러도 처음부터 다시 흔든다)
export const useShake = <T extends HTMLElement = HTMLDivElement>() => {
  const ref = useRef<T>(null);

  return {
    ref,
    shake: useCallback(() => {
      const el = ref.current;

      if (el) {
        el.classList.remove("fx-shake");
        void el.offsetWidth;
        el.classList.add("fx-shake");
      }
    }, []),
  };
};

// ---------- 색종이 ----------

const CONFETTI_COLORS = ["#ffd166", "#ef476f", "#06d6a0", "#4cc9f0", "#c77dff"];

export function Confetti({ fire }: { fire: number }) {
  const [pieces, setPieces] = useState<CSSProperties[]>([]);

  useEffect(() => {
    if (!fire) {
      return;
    }

    setPieces(
      Array.from(
        { length: 90 },
        (_, i) =>
          ({
            "--x": `${Math.random() * 100}vw`,
            "--drift": `${(Math.random() - 0.5) * 240}px`,
            "--spin": `${(Math.random() - 0.5) * 1440}deg`,
            "--t": `${1.8 + Math.random() * 1.6}s`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${Math.random() * 0.4}s`,
          }) as CSSProperties,
      ),
    );
    const t = setTimeout(() => setPieces([]), 4000);

    return () => clearTimeout(t);
  }, [fire]);

  return (
    <>
      {pieces.map((style, i) => (
        <div key={`${fire}-${i}`} className="fx-confetti" style={style} />
      ))}
    </>
  );
}

// ---------- 숫자 올라가기 ----------

export function CountUp({
  value,
  from: start = 0,
  duration = 900,
  onTick,
  format = (n) => n.toLocaleString(),
}: {
  value: number;
  from?: number; // 처음 나타날 때 이 숫자부터 센다
  duration?: number;
  onTick?: () => void;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(start);
  const from = useRef(start);

  useEffect(() => {
    const t0 = performance.now();
    const base = from.current;
    let raf = 0;
    let lastTick = 0;

    const frame = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      const v = Math.round(base + (value - base) * (1 - (1 - k) ** 3));
      from.current = v;
      setShown(v);

      if (onTick && now - lastTick > 60 && k < 1) {
        lastTick = now;
        onTick();
      }

      if (k < 1) {
        raf = requestAnimationFrame(frame);
      }
    };

    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
  }, [value, duration, onTick]);

  return <>{format(shown)}</>;
}

// ---------- 별점 ----------

export function StarRating({
  stars,
  max = 3,
  delay = 300,
}: {
  stars: number;
  max?: number;
  delay?: number;
}) {
  useEffect(() => {
    const timers = Array.from({ length: stars }, (_, i) =>
      setTimeout(() => sfx.twinkle(i * 2), delay + i * 250),
    );

    return () => timers.forEach(clearTimeout);
  }, [stars, delay]);

  return (
    <div className="flex gap-2 text-5xl">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={cn("fx-pop", i < stars ? "text-amber-300" : "opacity-20")}
          style={{
            animationDelay: `${delay + i * 250}ms`,
            textShadow: i < stars ? "0 0 18px rgba(255,200,60,0.8)" : "none",
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ---------- 라운드 배너 ----------

// key가 바뀔 때마다 캔버스 위에 크게 떴다가 사라진다
export function RoundBanner({ text, sub }: { text: string; sub?: string }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    sfx.whoosh();
    const t = setTimeout(() => setShow(false), 1400);

    return () => clearTimeout(t);
  }, []);

  return show ? (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="fx-banner rounded-box bg-black/55 px-10 py-5 text-center shadow-2xl backdrop-blur-sm">
        <div className="text-4xl font-black text-white md:text-6xl">{text}</div>
        {sub && <div className="mt-1 text-lg text-amber-200">{sub}</div>}
      </div>
    </div>
  ) : null;
}

// ---------- 최고 기록 ----------

const BEST_PREFIX = "star-games-best:";

export const readBest = (game: string): number | null => {
  try {
    const v = localStorage.getItem(BEST_PREFIX + game);

    return v === null ? null : Number(v);
  } catch {
    return null;
  }
};

// 새 기록이면 저장하고 true (lowerIsBetter: 움직인 횟수처럼 작을수록 좋은 기록)
export const saveBest = (
  game: string,
  value: number,
  lowerIsBetter = false,
): boolean => {
  const best = readBest(game);
  const better = best === null || (lowerIsBetter ? value < best : value > best);

  if (better) {
    try {
      localStorage.setItem(BEST_PREFIX + game, String(value));
    } catch {
      // 저장이 막혀 있으면 기록만 못 남긴다
    }
  }

  return better;
};

// ---------- 시작 화면 ----------

export function GameIntro({
  title,
  tagline,
  howTo,
  children,
  startLabel = "시작",
  onStart,
  canStart = true,
}: {
  title: string;
  tagline: string;
  howTo: string[];
  children?: ReactNode;
  startLabel?: string;
  onStart: () => void;
  canStart?: boolean;
}) {
  const [leaving, setLeaving] = useState(false);

  return (
    <div
      className={cn(
        "mt-[4vh] flex w-full max-w-xl flex-col items-center gap-6 text-center",
        leaving ? "fx-leave" : "fx-rise",
      )}
    >
      <h1 className="bg-gradient-to-b from-white to-indigo-200 bg-clip-text text-4xl font-black text-transparent md:text-5xl">
        {title}
      </h1>
      <p className="opacity-80">{tagline}</p>
      <ol className="bg-base-200/70 rounded-box flex w-full flex-col gap-2 p-5 text-left text-sm backdrop-blur">
        {howTo.map((h, i) => (
          <li key={h} className="flex gap-3">
            <span className="bg-primary text-primary-content flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              {i + 1}
            </span>
            <span>{h}</span>
          </li>
        ))}
      </ol>
      {children}
      <button
        className="btn btn-primary btn-lg w-56 text-lg shadow-lg shadow-indigo-500/30"
        disabled={!canStart || leaving}
        onClick={() => {
          sfx.whoosh();
          setLeaving(true);
          setTimeout(onStart, 450);
        }}
      >
        {startLabel}
      </button>
      <GameBasicsLinks className="justify-center" />
    </div>
  );
}

// 시작 화면의 난이도 고르기 (큰 버튼 세 개)
export function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; title: string; note: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string; // 고르는 줄이 여럿일 때 무엇을 고르는 줄인지
}) {
  const cards = (
    <div
      className={cn(
        "grid w-full gap-2",
        // 넷이면 넓은 화면에서 한 줄, 좁은 화면에서 두 줄. 둘이면 두 칸 (세 칸에 두 장을 두면 폭의 2/3만 썼다)
        options.length === 4
          ? "grid-cols-2 sm:grid-cols-4"
          : options.length === 2
            ? "grid-cols-2"
            : "grid-cols-3",
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          className={cn(
            "rounded-box border-2 p-3 text-sm transition",
            value === o.value
              ? "border-amber-300 bg-amber-300/10"
              : "bg-base-200/60 border-transparent opacity-70 hover:opacity-100",
          )}
          onClick={() => {
            sfx.tap();
            onChange(o.value);
          }}
        >
          <div className="text-base font-bold">{o.title}</div>
          <div className="text-xs opacity-70">{o.note}</div>
        </button>
      ))}
    </div>
  );

  if (!label) {
    return cards;
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="text-left text-xs font-bold opacity-70">{label}</div>
      {cards}
    </div>
  );
}

// ---------- 결과 카드 ----------

export function ResultCard({
  title,
  score,
  unit = "점",
  stars,
  best,
  newBest,
  children,
  actions,
}: {
  title: string;
  score: number;
  unit?: string;
  stars: number;
  best: number | null;
  newBest: boolean;
  children?: ReactNode;
  actions: ReactNode;
}) {
  const [fire, setFire] = useState(0);

  useEffect(() => {
    if (stars >= 2) {
      sfx.win();
      setFire(Date.now());
    } else {
      sfx.lose();
    }
  }, [stars]);

  return (
    <div className="bg-base-200/80 rounded-box fx-rise flex w-full max-w-xl flex-col items-center gap-4 p-8 text-center shadow-2xl backdrop-blur">
      <Confetti fire={fire} />
      <h1 className="text-2xl font-bold">{title}</h1>
      <StarRating stars={stars} />
      <div className="text-6xl font-black text-amber-200">
        <CountUp value={score} duration={1200} />
        <span className="ml-1 text-2xl">{unit}</span>
      </div>
      {newBest ? (
        <div
          className="badge badge-warning fx-pop gap-1 p-3 font-bold"
          style={{ animationDelay: "1.3s" }}
        >
          새 최고 기록!
        </div>
      ) : (
        best !== null && (
          <div className="text-sm opacity-60">
            최고 기록 {best.toLocaleString()}
            {unit}
          </div>
        )
      )}
      {children}
      <div className="flex flex-wrap justify-center gap-2">{actions}</div>
      <GameBasicsLinks className="justify-center" />
    </div>
  );
}

// ---------- 소리 켜고 끄기 ----------

export function MuteButton() {
  const muted = useMuted();

  return (
    <button
      className="btn btn-ghost btn-sm"
      aria-label={muted ? "소리 켜기" : "소리 끄기"}
      onClick={() => {
        setMuted(!muted);

        if (muted) {
          sfx.tap();
        }
      }}
    >
      {muted ? "🔇 소리 꺼짐" : "🔊 소리 켜짐"}
    </button>
  );
}
