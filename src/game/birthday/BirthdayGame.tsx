"use client";

import type { Birth } from "@/game/birthday/BirthdayPicker";
import { useEffect, useMemo, useState } from "react";
import BirthdayChart from "@/game/birthday/BirthdayChart";
import {
  BirthdayCalendar,
  BirthdayField,
  birthLabel,
} from "@/game/birthday/BirthdayPicker";
import { BIRTH_COLOR, SIGN_COLOR } from "@/game/birthday/drawChart";
import { birthdaySky, ZODIAC, zodiacWidthDeg } from "@/game/birthday/zodiac";
import { sfx } from "@/game/fx/sound";
import { cn } from "@/utils/cn";

// 생일 별자리 (docs/game-plans.md): 생일에 해가 실제로 있던 별자리와 점성술의 별자리를 천문도로 비교하고,
// 왜 다른지(세차 운동, 별자리마다 다른 폭, 뱀주인자리) 설명한다.
// 첫 화면에서 생일을 받고, 찾기를 누르면 결과 화면으로 넘어간다. 결과 화면에서도 날짜를 바꿔 볼 수 있다.

// 첫 화면이 사라지는 시간 (ms)
const LEAVE_MS = 450;

const SAVED_KEY = "birthday-last";

const readSavedBirth = (): Birth | null => {
  try {
    const v = localStorage.getItem(SAVED_KEY);

    return v ? (JSON.parse(v) as Birth) : null;
  } catch {
    return null;
  }
};

const saveBirth = (b: Birth) => {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(b));
  } catch {
    // 저장이 막힌 브라우저면 다음에 다시 고르면 된다
  }
};

// 결과 화면의 덩어리들이 차례로 떠오르게
const rise = (order: number) => ({ animationDelay: `${order * 120}ms` });

export default function BirthdayGame() {
  const [phase, setPhase] = useState<"intro" | "leaving" | "result">("intro");
  const [draft, setDraft] = useState<Birth | null>(null);
  const [birth, setBirth] = useState<Birth | null>(null);

  // 지난번에 넣은 생일이 있으면 미리 골라 둔다 (이 브라우저에만 남는다)
  // 달력은 처음 그릴 때의 달을 보여 주므로, 불러온 뒤 한 번 다시 그린다
  const [calendarKey, setCalendarKey] = useState("empty");

  useEffect(() => {
    const saved = readSavedBirth();

    if (saved) {
      setDraft(saved);
      setCalendarKey("saved");
    }
  }, []);

  const start = (b: Birth) => {
    sfx.whoosh();
    saveBirth(b);
    setBirth(b);
    setPhase("leaving");
    setTimeout(() => setPhase("result"), LEAVE_MS);
  };

  if (phase !== "result" || !birth) {
    return (
      <div
        className={cn(
          "mt-[6vh] flex w-full max-w-md flex-col items-center gap-6 text-center transition-all duration-[450ms] ease-in",
          phase === "leaving" && "-translate-y-10 scale-95 opacity-0",
        )}
      >
        <h1 className="text-4xl font-bold">생일 별자리</h1>
        <p className="opacity-80">
          내 생일에 해는 정말 어느 별자리에 있었을까요?
          <br />
          점성술의 별자리와 비교하고, 왜 다른지 천문도에서 확인해 봐요.
        </p>
        <div className="bg-base-200 rounded-box p-3 shadow-lg">
          <BirthdayCalendar
            key={calendarKey}
            value={draft}
            onChange={setDraft}
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            className="btn btn-primary btn-lg min-w-48"
            disabled={!draft || phase === "leaving"}
            onClick={() => draft && start(draft)}
          >
            {draft
              ? `${birthLabel(draft)}로 찾기`
              : "달력에서 생일을 골라 주세요"}
          </button>
          <button
            className="link link-hover text-sm opacity-70"
            disabled={phase === "leaving"}
            onClick={() => {
              const now = new Date();

              start({
                year: now.getFullYear(),
                month: now.getMonth() + 1,
                day: now.getDate(),
              });
            }}
          >
            생일 대신 오늘로 해 보기
          </button>
        </div>
      </div>
    );
  }

  return <BirthdayResult birth={birth} onChange={setBirth} />;
}

function BirthdayResult({
  birth,
  onChange,
}: {
  birth: Birth;
  onChange: (b: Birth) => void;
}) {
  const sky = useMemo(
    () => birthdaySky(birth.year, birth.month, birth.day),
    [birth],
  );
  const same = sky.constellation.label === sky.sign;
  const width = zodiacWidthDeg(sky.constellation);
  const bestMonth = ((birth.month + 5) % 12) + 1;

  // 결과가 나오거나 날짜가 바뀔 때 반짝
  useEffect(() => sfx.twinkle(birth.month), [birth]);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        style={rise(0)}
        className={cn(
          "animate-rise",
          "flex w-full max-w-[1280px] flex-wrap items-center gap-4",
        )}
      >
        <h1 className="text-2xl font-bold">생일 별자리</h1>
        <div className="grow" />
        <BirthdayField value={birth} onChange={onChange} />
      </div>

      <div
        style={rise(1)}
        className={cn(
          "animate-rise",
          "bg-base-200 rounded-box grid w-full max-w-[1280px] grid-cols-1 gap-4 p-4 md:grid-cols-2",
        )}
      >
        <div>
          <div className="text-sm opacity-70">점성술(운세)의 별자리</div>
          <div className="text-3xl font-bold" style={{ color: SIGN_COLOR }}>
            {sky.sign}
          </div>
          <div className="text-xs opacity-60">
            춘분점부터 30°씩 나눈 열두 칸 중 생일의 해가 있는 칸
          </div>
        </div>
        <div>
          <div className="text-sm opacity-70">그날 해가 실제로 있던 별자리</div>
          <div className="text-3xl font-bold" style={{ color: BIRTH_COLOR }}>
            {sky.constellation.label}
          </div>
          <div className="text-xs opacity-60">
            국제천문연맹(IAU)이 정한 별자리 경계 기준
          </div>
        </div>
      </div>

      {/* 천문도는 화면 좌우 끝까지 (게임 틀의 여백 바깥까지) */}
      <div
        style={rise(2)}
        className={cn("animate-rise", "-mx-8 flex flex-col self-stretch")}
      >
        <BirthdayChart birth={birth} sky={sky} />
        <div className="mt-1 text-center text-xs opacity-60 md:hidden">
          ← 천문도를 옆으로 밀어 보세요 →
        </div>
      </div>

      <div
        style={rise(3)}
        className={cn(
          "animate-rise",
          "bg-base-200 rounded-box flex w-full max-w-[1280px] flex-col gap-3 p-4 text-sm",
        )}
      >
        <div className="font-bold">
          {same
            ? "두 별자리가 같아요! 하지만 늘 그렇지는 않아요."
            : "왜 두 별자리가 다를까요?"}
        </div>
        <div>
          <b>1. 지구의 팽이 운동(세차 운동)</b>: 점성술의 열두 칸은 약 2천 년
          전, 춘분점(봄에 해가 있는 자리)이 양자리에 있을 때 정해졌어요. 그런데
          지구 자전축이 팽이처럼 천천히 돌아서, 춘분점은 1년에 약 50″(72년에
          1°)씩 서쪽으로 밀려났어요. 그동안 약 {Math.round(sky.precessionDeg)}°
          — 거의 한 별자리만큼 어긋났어요. 천문도에서 분홍 괄호(점성술 칸)와
          금색 띠(실제 별자리)가 어긋난 만큼이에요.
        </div>
        <div>
          <b>2. 별자리마다 크기가 달라요</b>: 점성술 칸은 모두 30°지만, 실제
          별자리는 제각각이에요. {sky.constellation.label}는 황도에서 약{" "}
          {Math.round(width)}°예요. (가장 좁은 전갈자리는 약 7°, 가장 넓은
          처녀자리는 약 44°)
        </div>
        <div>
          <b>3. 13번째 별자리, 뱀주인자리</b>: 해는 11월 29일 무렵부터 12월 17일
          무렵까지 뱀주인자리를 지나요. 하지만 점성술의 열두 칸에는 없어요.
        </div>
        <div>
          <b>4. 생일 별자리는 생일 밤에 볼 수 없어요</b>: 그때 해가 그 별자리에
          있으니, 별자리는 낮에 해와 함께 떠 있거든요. 내{" "}
          {sky.constellation.label}는 반년 뒤인 {bestMonth}월 무렵 자정에 남쪽
          하늘 높이 떠서 가장 잘 보여요.
        </div>
        <div className="text-xs opacity-60">
          황도 별자리 경계(해가 들어오는 황경):{" "}
          {ZODIAC.map((z) => `${z.label} ${z.startLonDeg.toFixed(0)}°`).join(
            " · ",
          )}
        </div>
      </div>
    </div>
  );
}
