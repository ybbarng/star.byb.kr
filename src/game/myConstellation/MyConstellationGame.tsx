"use client";

import type { MapStar, MapView } from "@/game/myConstellation/drawStarMap";
import type { Shape } from "@/game/myConstellation/shape";
import type { SavedConstellation } from "@/game/myConstellation/storage";
import type { Place } from "@/game/tonight/places";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { GameIntro } from "@/game/fx/Fx";
import { sfx } from "@/game/fx/sound";
import {
  saveCard,
  SKY_H,
  SKY_W,
  drawRealSky,
} from "@/game/myConstellation/drawRealSky";
import {
  drawStarMap,
  MAP_H,
  MAP_W,
  panView,
  pickMapStar,
  viewToward,
  zoomView,
} from "@/game/myConstellation/drawStarMap";
import {
  cleanName,
  decodeStrokes,
  EMPTY_SHAPE,
  edgesOf,
  encodeStrokes,
  isComplete,
  liftPen,
  MAX_NAME,
  MAX_STARS,
  STAR_BY_HR,
  starsOf,
  tapStar,
  vectorsOf,
} from "@/game/myConstellation/shape";
import {
  readSaved,
  removeSaved,
  saveConstellation,
} from "@/game/myConstellation/storage";
import {
  bestOnNight,
  culmination,
  DARKNESS,
  darknessOf,
  decOf,
  defaultDarkness,
  findingTips,
  guideStar,
  heightWord,
  homeConstellations,
  moonlessNight,
  pickBestMonth,
  poseAt,
  shapeGeometry,
  yearlyBest,
} from "@/game/myConstellation/visibility";
import {
  CONSTELLATIONS,
  constellationCenter,
  constellationParts,
} from "@/game/sky/catalog";
import { CITIES, CITY_GROUPS, SEOUL } from "@/game/tonight/places";
import { directionName, fistsLabel, frameAt } from "@/game/tonight/report";
import {
  dateLabel,
  friendlyTime,
  isoDate,
  localParts,
  localToUtc,
} from "@/game/tonight/time";
import { fromAltAzJ2000 } from "@/search/utils/ephemeris";
import { cn } from "@/utils/cn";

// 나만의 별자리 (docs/game-plans.md 둘러보기): 실제 별(5등급까지)을 눌러 이어 내 별자리를 만들고 이름을 붙인 뒤,
// 그 별자리가 고른 장소·날짜·시각의 진짜 하늘에 뜬 모습을 본다. 가장 잘 보이는 달·시각, 찾아가는 길잡이,
// 도시 불빛 속에서 몇 개나 보일지까지 알려 주고, 이름표를 붙인 하늘 그림을 내려받는다.
// 지어낸 별이 아니라 진짜 별을 이은 것이라 실제 밤하늘에서 찾아볼 수 있다는 게 이 놀이의 핵심이다.
// 만든 별자리는 이 브라우저에만 남기고(localStorage), 주소(쿼리)에 별 번호를 담아 공유한다.

const MapPicker = dynamic(() => import("@/game/tonight/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 items-center justify-center text-sm opacity-60">
      지도를 펼치는 중…
    </div>
  ),
});

type Step = 0 | 1 | 2;

const STEPS = ["별 잇기", "이름 붙이기", "하늘에서 보기"];

const NAME_IDEAS = [
  "우리 고양이자리",
  "첫 출근자리",
  "떡볶이자리",
  "종이비행기자리",
  "할머니 우산자리",
  "작은 기타자리",
];

// 밤 시각: 저녁 5시부터 다음 날 아침 7시까지를 분으로 (0 = 17:00)
const NIGHT_MINUTES = 14 * 60;
const pad = (n: number) => String(n).padStart(2, "0");

const minutesOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);

  return ((h < 12 ? h + 24 : h) - 17) * 60 + m;
};

const timeOf = (minutes: number) => {
  const total = 17 * 60 + minutes;

  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};

// 고른 날짜(그날 밤)·시각 → UTC. 정오 전 시각은 다음 날 새벽으로 본다
const instantOf = (date: string, time: string, tz: string) => {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);

  return localToUtc(y, mo, d + (h < 12 ? 1 : 0), h, m, tz);
};

const hashOf = (text: string) =>
  [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const UNIQUE_LABELS = [...new Set(CONSTELLATIONS.map((c) => c.label))].sort(
  (a, b) => a.localeCompare(b, "ko"),
);

// 별자리가 화면에 알맞게 들어오는 지도 배율
const fitScale = (radiusDeg: number) =>
  Math.max(
    360,
    Math.min(1600, (MAP_H * 0.36) / Math.max(4, radiusDeg) / (Math.PI / 180)),
  );

interface Shared {
  shape: Shape;
  name: string;
}

const readShared = (): Shared | null => {
  const q = new URLSearchParams(window.location.search);
  const shape = decodeStrokes(q.get("l") ?? "");

  return isComplete(shape)
    ? { shape, name: cleanName(q.get("n") ?? "") || "이름 없는 별자리" }
    : null;
};

export default function MyConstellationGame() {
  const [started, setStarted] = useState(false);
  const [shared, setShared] = useState<Shared | null>(null);

  useEffect(() => setShared(readShared()), []);

  return started ? (
    <Studio shared={shared} />
  ) : (
    <GameIntro
      title="나만의 별자리"
      tagline="진짜 별을 이어 내 별자리를 만들고, 그 별자리가 진짜 하늘 어디에 뜨는지 찾아봐요."
      howTo={[
        "별 지도에서 별을 하나씩 눌러 이어요. 지도는 끌어서 돌리고, 확대할 수 있어요.",
        "이름을 붙여요. 고양이, 떡볶이, 첫 출근… 무엇이든 좋아요.",
        "장소·날짜·시각을 바꿔 가며, 내 별자리가 그 하늘에 뜬 모습과 가장 잘 보이는 때를 봐요.",
        "이름표 붙은 하늘 그림을 저장하고, 실제 밤하늘에서 찾아보세요!",
      ]}
      startLabel={shared ? `“${shared.name}” 보러 가기` : "별 잇기 시작"}
      onStart={() => setStarted(true)}
    >
      <p className="bg-base-200/60 rounded-box p-4 text-left text-sm leading-relaxed opacity-85">
        ✦ 지어낸 별자리가 아니에요. 지도의 별은 모두 실제로 하늘에 있는
        별(5등급까지 1,625개)이고, 내가 고른 별들은 정말 그 자리에서 빛나고
        있어요. 이름만 내가 붙인, 진짜 하늘에서 찾아볼 수 있는 나만의
        별자리예요.
        {shared && (
          <span className="mt-2 block font-bold text-amber-200">
            친구가 보낸 별자리가 있어요: “{shared.name}”
          </span>
        )}
      </p>
    </GameIntro>
  );
}

function Studio({ shared }: { shared: Shared | null }) {
  const [step, setStep] = useState<Step>(shared ? 2 : 0);
  const [shape, setShape] = useState<Shape>(shared?.shape ?? EMPTY_SHAPE);
  const [history, setHistory] = useState<Shape[]>([]);
  const [name, setName] = useState(shared?.name ?? "");
  const [saved, setSaved] = useState<SavedConstellation[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => setSaved(readSaved()), []);

  const say = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2400);
  };

  const change = (next: Shape) => {
    if (next !== shape) {
      setHistory((h) => [...h.slice(-80), shape]);
      setShape(next);
    }
  };

  const complete = isComplete(shape);
  const finalName = cleanName(name) || "이름 없는 별자리";

  // 주소에 별자리를 담아 둔다 (링크 복사로 공유)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);

    if (complete) {
      q.set("l", encodeStrokes(shape));
      q.set("n", finalName);
    } else {
      q.delete("l");
      q.delete("n");
    }

    const s = q.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${s ? `?${s}` : ""}`,
    );
  }, [shape, finalName, complete]);

  const keep = () => {
    const next = saveConstellation(finalName, shape.strokes);

    if (next) {
      setSaved(next);
    }
  };

  const go = (s: Step) => {
    if (s > 0 && !complete) {
      return;
    }

    sfx.whoosh();

    if (shape.open) {
      setShape(liftPen(shape));
    }

    if (s === 2) {
      keep();
    }

    setStep(s);
  };

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 pb-16">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-2xl font-black">나만의 별자리</h1>
        <span className="text-sm opacity-65">
          진짜 별들로, 진짜 하늘에서 찾아볼 수 있는 나만의 이름
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            className={cn(
              "btn btn-sm h-auto min-h-10 flex-col gap-0 py-1 sm:flex-row sm:gap-2",
              step === i ? "btn-primary" : "btn-ghost bg-base-200/50",
            )}
            disabled={i > 0 && !complete}
            onClick={() => go(i as Step)}
          >
            <span className="text-xs opacity-70">{i + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <DrawStep
          shape={shape}
          onChange={change}
          onUndo={() => {
            const prev = history[history.length - 1];

            if (prev) {
              sfx.tap();
              setShape(prev);
              setHistory((h) => h.slice(0, -1));
            }
          }}
          canUndo={history.length > 0}
          onClear={() => {
            sfx.tap();
            change(EMPTY_SHAPE);
          }}
          saved={saved}
          onLoad={(s) => {
            sfx.twinkle(2);
            change(decodeStrokes(s.lines));
            setName(s.name);
            say(`불러왔어요: “${s.name}”`);
          }}
          onRemove={(s) => setSaved(removeSaved(s.lines))}
          onNext={() => go(1)}
        />
      )}

      {step === 1 && (
        <NameStep
          shape={shape}
          name={name}
          onName={setName}
          onBack={() => go(0)}
          onNext={() => go(2)}
        />
      )}

      {step === 2 && complete && (
        <SkyStep
          shape={shape}
          name={finalName}
          onToast={say}
          onEdit={() => go(0)}
        />
      )}

      {toast && (
        <div className="toast toast-center toast-bottom z-50">
          <div className="alert alert-info text-sm">{toast}</div>
        </div>
      )}
    </div>
  );
}

// ── ① 별 잇기 ────────────────────────────────────────────────────

function DrawStep({
  shape,
  onChange,
  onUndo,
  canUndo,
  onClear,
  saved,
  onLoad,
  onRemove,
  onNext,
}: {
  shape: Shape;
  onChange: (s: Shape) => void;
  onUndo: () => void;
  canUndo: boolean;
  onClear: () => void;
  saved: SavedConstellation[];
  onLoad: (s: SavedConstellation) => void;
  onRemove: (s: SavedConstellation) => void;
  onNext: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shown = useRef<MapStar[]>([]);
  const drag = useRef<{
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const [view, setView] = useState<MapView | null>(null);
  const [showReal, setShowReal] = useState(true);

  // 처음 보는 곳: 만든 별자리가 있으면 그 별자리, 없으면 오늘 밤 9시 서울의 남쪽 하늘 높이
  useEffect(() => {
    if (view) {
      return;
    }

    const vectors = vectorsOf(shape);

    if (vectors.length) {
      const g = shapeGeometry(vectors);
      setView(viewToward(g.center, fitScale(g.radiusDeg)));

      return;
    }

    const [y, m, d] = isoDate(Date.now(), SEOUL.tz).split("-").map(Number);
    const t = localToUtc(y, m, d, 21, 0, SEOUL.tz);
    setView(viewToward(fromAltAzJ2000(frameAt(t, SEOUL), 55, 180), 600));
  }, [view, shape]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (ctx && view) {
      shown.current = drawStarMap(ctx, view, { shape, showReal });
    }
  }, [view, shape, showReal]);

  // 휠로 확대·축소 (페이지가 같이 굴러가지 않게 passive를 끈다)
  useEffect(() => {
    const el = canvas.current;

    if (!el) {
      return;
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => (v ? zoomView(v, e.deltaY < 0 ? 1.15 : 1 / 1.15) : v));
    };

    el.addEventListener("wheel", onWheel, { passive: false });

    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();

    return {
      x: ((e.clientX - r.left) / r.width) * MAP_W,
      y: ((e.clientY - r.top) / r.height) * MAP_H,
      ratio: MAP_W / r.width,
    };
  };

  const stars = starsOf(shape);
  const edges = edgesOf(shape);
  const last = shape.strokes[shape.strokes.length - 1];
  const penStar =
    shape.open && last ? STAR_BY_HR.get(last[last.length - 1]) : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm opacity-80">
        별을 눌러 이어요. 이어 그리는 중인 별(분홍 고리)을 한 번 더 누르거나 빈
        하늘을 누르면 펜을 떼고, 다른 별에서 새 선을 시작할 수 있어요. 지도는
        북이 위, 동이 왼쪽 — 실제로 올려다본 모습이에요.
      </p>

      <div className="relative">
        <canvas
          ref={canvas}
          width={MAP_W}
          height={MAP_H}
          className="rounded-box block aspect-[4/3] w-full cursor-pointer touch-none bg-black select-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              lastX: e.clientX,
              lastY: e.clientY,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            const d = drag.current;

            if (!d || !view) {
              return;
            }

            if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) {
              d.moved = true;
            }

            if (d.moved) {
              const { ratio } = toCanvas(e);
              setView((v) =>
                v
                  ? panView(
                      v,
                      (e.clientX - d.lastX) * ratio,
                      (e.clientY - d.lastY) * ratio,
                    )
                  : v,
              );
              d.lastX = e.clientX;
              d.lastY = e.clientY;
            }
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;

            if (!d || d.moved) {
              return;
            }

            const { x, y, ratio } = toCanvas(e);
            const hr = pickMapStar(shown.current, x, y, 22 * ratio);

            if (hr) {
              const next = tapStar(shape, hr);

              if (next === shape) {
                return;
              }

              if (next.open) {
                sfx.twinkle(starsOf(next).length);
              } else {
                sfx.tap();
              }

              onChange(next);
            } else if (shape.open) {
              sfx.tap();
              onChange(liftPen(shape));
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        />
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            className="btn btn-sm btn-circle bg-base-200/80"
            aria-label="확대"
            onClick={() => setView((v) => (v ? zoomView(v, 1.35) : v))}
          >
            ＋
          </button>
          <button
            className="btn btn-sm btn-circle bg-base-200/80"
            aria-label="축소"
            onClick={() => setView((v) => (v ? zoomView(v, 1 / 1.35) : v))}
          >
            －
          </button>
        </div>
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/60 px-3 py-1 text-xs">
          별 {stars.length}/{MAX_STARS} · 선 {edges.length}
          {penStar && ` · ${penStar.name ?? "이름 없는 별"}에서 잇는 중`}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-sm" onClick={onUndo} disabled={!canUndo}>
          ↶ 되돌리기
        </button>
        <button
          className="btn btn-sm"
          onClick={() => onChange(liftPen(shape))}
          disabled={!shape.open}
        >
          ✋ 펜 떼기
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={onClear}
          disabled={!stars.length}
        >
          모두 지우기
        </button>
        <label className="label cursor-pointer gap-2 text-sm">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={showReal}
            onChange={(e) => setShowReal(e.target.checked)}
          />
          진짜 별자리선
        </label>
        <select
          className="select select-sm w-40"
          value=""
          aria-label="가 볼 별자리"
          onChange={(e) => {
            const parts = constellationParts(e.target.value);

            if (parts.length) {
              sfx.whoosh();
              setView((v) =>
                viewToward(constellationCenter(parts), v?.scale ?? 600),
              );
            }
          }}
        >
          <option value="">별자리로 가기…</option>
          {UNIQUE_LABELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <button
          className="btn btn-primary btn-sm ml-auto"
          disabled={!isComplete(shape)}
          onClick={onNext}
        >
          이름 붙이기 →
        </button>
      </div>

      {saved.length > 0 && (
        <div className="bg-base-200/60 rounded-box flex flex-col gap-2 p-3 text-sm">
          <div className="font-bold">
            내 별자리 보관함 (이 브라우저에만 있어요)
          </div>
          <div className="flex flex-wrap gap-2">
            {saved.map((s) => (
              <span key={s.lines} className="join">
                <button
                  className="btn btn-xs join-item"
                  onClick={() => onLoad(s)}
                >
                  ✦ {s.name}
                </button>
                <button
                  className="btn btn-xs btn-ghost join-item"
                  aria-label={`${s.name} 지우기`}
                  onClick={() => onRemove(s)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ② 이름 붙이기 ─────────────────────────────────────────────────

function NameStep({
  shape,
  name,
  onName,
  onBack,
  onNext,
}: {
  shape: Shape;
  name: string;
  onName: (n: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const hrs = starsOf(shape);
  const homes = useMemo(() => homeConstellations(vectorsOf(shape)), [shape]);
  const { spanDeg } = useMemo(() => shapeGeometry(vectorsOf(shape)), [shape]);
  const brightest = hrs
    .map((hr) => STAR_BY_HR.get(hr)!)
    .sort((a, b) => a.mag - b.mag);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-base-200/70 rounded-box flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-2">
          <span className="font-bold">내 별자리의 이름</span>
          <input
            className="input input-lg w-full"
            value={name}
            maxLength={MAX_NAME}
            placeholder="예: 우리 고양이자리"
            onChange={(e) => onName(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {NAME_IDEAS.map((idea) => (
            <button
              key={idea}
              className="btn btn-xs btn-ghost bg-base-100/40"
              onClick={() => {
                sfx.tap();
                onName(idea);
              }}
            >
              {idea}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-base-200/70 rounded-box flex flex-col gap-2 p-4 text-sm">
        <div className="font-bold">
          진짜 별 {hrs.length}개 · 끝에서 끝까지 약 {Math.round(spanDeg)}°
        </div>
        <p className="opacity-80">
          이 별들은 진짜 하늘의{" "}
          {homes.map((h) => `${h.label} ${h.n}개`).join(" · ")}에 걸쳐 있어요.
          별자리 이름은 사람이 붙인 것이고, 별은 그대로예요.
        </p>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {brightest.map((s) => (
            <li key={s.hr} className="flex justify-between gap-2 opacity-85">
              <span>{s.name ?? `이름 없는 별 (HR ${s.hr})`}</span>
              <span className="tabular-nums opacity-70">
                {s.mag.toFixed(1)}등급
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-between gap-2">
        <button className="btn btn-sm" onClick={onBack}>
          ← 별 더 잇기
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          진짜 하늘에서 보기 →
        </button>
      </div>
    </div>
  );
}

// ── ③ 하늘에서 보기 ───────────────────────────────────────────────

function SkyStep({
  shape,
  name,
  onToast,
  onEdit,
}: {
  shape: Shape;
  name: string;
  onToast: (t: string) => void;
  onEdit: () => void;
}) {
  const [place, setPlace] = useState<Place>(SEOUL);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("21:00");
  const [limitOverride, setLimitOverride] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  // 장소·날짜·시각도 주소에서 읽고, 바뀌면 주소에 남긴다
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const city = CITIES.find((c) => c.name === q.get("place"));
    const p = city ?? SEOUL;
    setPlace(p);
    setDate(
      /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "")
        ? q.get("date")!
        : isoDate(Date.now(), p.tz),
    );

    if (/^\d{2}:\d{2}$/.test(q.get("time") ?? "")) {
      setTime(q.get("time")!);
    }
  }, []);

  useEffect(() => {
    if (!date) {
      return;
    }

    const q = new URLSearchParams(window.location.search);

    if (CITIES.some((c) => c.name === place.name)) {
      q.set("place", place.name);
    } else {
      q.delete("place");
    }

    q.set("date", date);
    q.set("time", time);
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }, [place, date, time]);

  const hrs = useMemo(() => starsOf(shape), [shape]);
  const edges = useMemo(() => edgesOf(shape), [shape]);
  const geometry = useMemo(() => shapeGeometry(vectorsOf(shape)), [shape]);
  const observer = useMemo(
    () => ({ latDeg: place.latDeg, lonDeg: place.lonDeg }),
    [place],
  );
  const limit = limitOverride ?? defaultDarkness(place);
  const darkness = darknessOf(limit);
  const t = date ? instantOf(date, time, place.tz) : null;
  const pose = useMemo(
    () => (t === null ? null : poseAt(hrs, t, observer, limit)),
    [hrs, t, observer, limit],
  );
  const guide = useMemo(
    () => (t === null ? null : guideStar(hrs, t, observer)),
    [hrs, t, observer],
  );
  const [year, month, day] = (date || "2000-01-01").split("-").map(Number);
  const months = useMemo(
    () => (date ? yearlyBest(geometry.center, place, year, month) : []),
    [geometry.center, place, year, month, date],
  );
  const bestMonth = pickBestMonth(months, place.tz);
  const night = useMemo(
    () => (date ? bestOnNight(geometry.center, place, year, month, day) : null),
    [geometry.center, place, year, month, day, date],
  );
  const reach = culmination(geometry.center, place.latDeg);
  const bestLabel = bestMonth?.best
    ? `${bestMonth.month}월 중순 ${friendlyTime(bestMonth.best.t, place.tz)} 무렵`
    : null;
  const seed = hashOf(encodeStrokes(shape));

  const skyInput =
    pose && t !== null
      ? {
          hrs,
          edges,
          name,
          t,
          observer,
          darkness,
          pose,
          radiusDeg: geometry.radiusDeg,
          seed,
        }
      : null;

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (ctx && skyInput) {
      drawRealSky(ctx, skyInput);
    }
    // skyInput은 아래 값들로 정해진다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose, darkness, name, seed]);

  const tips = pose
    ? findingTips({
        pose,
        guide,
        spanDeg: geometry.spanDeg,
        limit,
        placeName: place.name,
        bestLabel,
      })
    : [];

  const when =
    t === null ? "" : `${dateLabel(t, place.tz)} ${friendlyTime(t, place.tz)}`;
  const where = !pose
    ? ""
    : pose.centerAlt > 0
      ? `${directionName(pose.centerAz)} 하늘, 지평선에서 ${fistsLabel(pose.centerAlt)}`
      : "이 시각엔 지평선 아래에 있어요";

  const jumpTo = (bt: number) => {
    const p = localParts(bt, place.tz);
    // 새벽이면 전날 밤으로 적는다 (밤 기준 날짜)
    const evening = p.hour < 12 ? bt - 86400000 : bt;
    sfx.whoosh();
    setDate(isoDate(evening, place.tz));
    setTime(`${pad(p.hour)}:${pad(p.minute)}`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 어디서 · 언제 */}
      <div className="bg-base-200/70 rounded-box flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-36 grow flex-col gap-1 text-sm">
            <span className="font-bold opacity-80">어디서</span>
            <select
              className="select select-sm w-full"
              value={
                CITIES.some((c) => c.name === place.name) ? place.name : ""
              }
              onChange={(e) => {
                const c = CITIES.find((x) => x.name === e.target.value);

                if (c) {
                  sfx.tap();
                  setPlace(c);
                  setLimitOverride(null);
                }
              }}
            >
              {!CITIES.some((c) => c.name === place.name) && (
                <option value="">{place.name}</option>
              )}
              {CITY_GROUPS.map((g) => (
                <optgroup key={g.title} label={g.title}>
                  {g.cities.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold opacity-80">날짜 (그날 밤)</span>
            <input
              type="date"
              className="input input-sm"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold opacity-80">시각</span>
            <input
              type="time"
              className="input input-sm"
              value={time}
              onChange={(e) => e.target.value && setTime(e.target.value)}
            />
          </label>
          <label className="flex min-w-44 flex-col gap-1 text-sm">
            <span className="font-bold opacity-80">하늘 밝기</span>
            <select
              className="select select-sm w-full"
              value={limit}
              onChange={(e) => setLimitOverride(Number(e.target.value))}
            >
              {DARKNESS.map((d) => (
                <option key={d.limit} value={d.limit}>
                  {d.title} ({d.limit}등급까지)
                </option>
              ))}
            </select>
          </label>
        </div>
        <input
          type="range"
          className="range range-xs range-info"
          min={0}
          max={NIGHT_MINUTES}
          step={10}
          value={Math.max(0, Math.min(NIGHT_MINUTES, minutesOf(time)))}
          onChange={(e) => setTime(timeOf(Number(e.target.value)))}
          aria-label="밤 시각"
        />
        <div className="flex justify-between text-xs opacity-60">
          <span>저녁 5시</span>
          <span>자정</span>
          <span>다음 날 아침 7시</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={cn("btn btn-sm btn-ghost", showMap && "btn-active")}
            onClick={() => setShowMap((v) => !v)}
          >
            🗺️ 지도에서 고르기
          </button>
          {night && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => jumpTo(night.t)}
            >
              🌙 그날 밤 가장 높을 때 ({friendlyTime(night.t, place.tz)})
            </button>
          )}
          {bestMonth?.best && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() =>
                jumpTo(
                  moonlessNight(
                    geometry.center,
                    place,
                    bestMonth.year,
                    bestMonth.month,
                  )?.t ?? bestMonth.best!.t,
                )
              }
            >
              ⭐ 가장 잘 보이는 때로
            </button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={onEdit}>
            ✏️ 별자리 고치기
          </button>
        </div>
        {showMap && (
          <MapPicker
            value={place}
            onPick={(p) => {
              sfx.tap();
              setPlace(p);
              setLimitOverride(null);
            }}
          />
        )}
        <div className="text-xs opacity-55">
          {place.name} · {place.latDeg >= 0 ? "북위" : "남위"}{" "}
          {Math.abs(place.latDeg).toFixed(1)}° · {darkness.note}
        </div>
      </div>

      {/* 그 하늘 */}
      <div className="flex flex-col gap-2">
        <canvas
          ref={canvas}
          width={SKY_W}
          height={SKY_H}
          className="rounded-box block aspect-[4/3] w-full bg-black"
        />
        {pose && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <b className="text-amber-200">{name}</b> · {when} · {where}
            </span>
            <span className="opacity-70">
              떠 있는 별 {pose.above}/{hrs.length} · 보일 만한 별 {pose.visible}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 실제로 찾아보세요 */}
        <div className="bg-base-200/70 rounded-box flex flex-col gap-3 p-4">
          <h2 className="text-lg font-black">실제로 찾아보세요!</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {tips.map((tip) => (
              <li key={tip.text} className="flex gap-2">
                <span aria-hidden>{tip.icon}</span>
                <span>{tip.text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-2">
            <button
              className="btn btn-primary btn-sm"
              disabled={saving || !skyInput}
              onClick={async () => {
                if (!skyInput || t === null) {
                  return;
                }

                setSaving(true);
                sfx.whoosh();

                try {
                  await saveCard(
                    skyInput,
                    {
                      place: place.name,
                      when,
                      where,
                      best: bestLabel
                        ? `가장 잘 보이는 때: ${bestLabel}`
                        : null,
                      starCount: hrs.length,
                    },
                    `my-constellation-${date}.png`,
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "그리는 중…" : "🖼️ 이미지로 저장"}
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  sfx.tap();
                  onToast(
                    "링크를 복사했어요. 친구에게 내 별자리를 보내 보세요!",
                  );
                } catch {
                  onToast("복사하지 못했어요. 주소창의 주소를 복사해 주세요");
                }
              }}
            >
              🔗 링크 복사
            </button>
          </div>
        </div>

        {/* 언제 잘 보일까 */}
        <div className="bg-base-200/70 rounded-box flex flex-col gap-3 p-4 text-sm">
          <h2 className="text-lg font-black">언제 가장 잘 보일까</h2>
          {reach.neverRises ? (
            <p>
              {place.name}에서는 이 별자리가 지평선 위로 올라오지 않아요 (적위{" "}
              {Math.round(decOf(geometry.center))}°). 남반구나 적도 가까이로
              가야 볼 수 있어요.
            </p>
          ) : (
            <>
              <p className="opacity-85">
                {reach.neverSets
                  ? "이 별자리는 여기서 지지 않고 밤새 북극(남극) 둘레를 돌아요. "
                  : ""}
                가장 높이 뜰 때 지평선에서 약 {Math.round(reach.maxAlt)}°까지
                올라와요.{" "}
                {bestMonth?.best &&
                  `${bestMonth.month}월 중순 ${friendlyTime(bestMonth.best.t, place.tz)} 무렵, ${directionName(bestMonth.best.azDeg)} 하늘 ${heightWord(bestMonth.best.altDeg)} 떠요.`}
              </p>
              <MonthBars
                months={months}
                best={bestMonth?.month ?? null}
                tz={place.tz}
                onPick={jumpTo}
              />
              <p className="text-xs opacity-60">
                막대는 달마다 15일 밤, 하늘이 충분히 어두운(해가 12° 아래) 동안
                가장 높이 뜬 높이예요. 누르면 그때로 가요.
              </p>
            </>
          )}
        </div>
      </div>

      <p className="text-xs leading-relaxed opacity-55">
        ✎ 적어 둘 것: 별 위치는 실제 카탈로그(밝은 별 목록 BSC5)를, 해·달은
        간단한 공식(해 0.01°, 달 0.3° 안팎)을 썼어요. 산·건물은 없다고 보고,
        대기 굴절은 뺐어요. &ldquo;몇 등급까지 보인다&rdquo;는 도시 불빛을 대략
        어림한 값이라 날씨·습도·눈의 적응에 따라 1등급쯤 달라질 수 있어요.
        별자리선과 이름은 내가 붙인 것이지만, 별들은 정말 그 자리에 있어요.
      </p>
    </div>
  );
}

function MonthBars({
  months,
  best,
  tz,
  onPick,
}: {
  months: ReturnType<typeof yearlyBest>;
  best: number | null;
  tz: string;
  onPick: (t: number) => void;
}) {
  return (
    <div className="grid grid-cols-12 items-end gap-1">
      {months.map((m) => {
        const alt = m.best?.altDeg ?? 0;

        return (
          <button
            key={`${m.year}-${m.month}`}
            className="flex flex-col items-center gap-1 disabled:opacity-40"
            disabled={!m.best}
            title={
              m.best
                ? `${m.month}월 15일 ${friendlyTime(m.best.t, tz)} · ${Math.round(alt)}°`
                : `${m.month}월: 어두운 동안 떠오르지 않아요`
            }
            onClick={() => m.best && onPick(m.best.t)}
          >
            <span className="flex h-24 w-full items-end">
              <span
                className={cn(
                  "w-full rounded-t",
                  m.month === best ? "bg-amber-300" : "bg-sky-400/50",
                )}
                style={{ height: `${Math.max(3, (alt / 90) * 100)}%` }}
              />
            </span>
            <span
              className={cn(
                "text-[10px] tabular-nums",
                m.month === best && "font-black text-amber-200",
              )}
            >
              {m.month}월
            </span>
          </button>
        );
      })}
    </div>
  );
}
