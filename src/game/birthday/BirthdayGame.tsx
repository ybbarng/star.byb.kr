"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { drawBirthdayChart } from "@/game/birthday/drawChart";
import { birthdaySky, ZODIAC, zodiacWidthDeg } from "@/game/birthday/zodiac";

// 생일 별자리 (docs/game-plans.md): 생일에 해가 실제로 있던 별자리와 점성술의 별자리를 천문도로 비교하고,
// 왜 다른지(세차 운동, 별자리마다 다른 폭, 뱀주인자리) 설명한다.

const W = 1280;
const H = 640;

export default function BirthdayGame() {
  const [birth, setBirth] = useState({ year: 1995, month: 3, day: 1 });
  const sky = useMemo(
    () => birthdaySky(birth.year, birth.month, birth.day),
    [birth],
  );
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (ctx) {
      drawBirthdayChart(ctx, W, H, birth, sky);
    }
  }, [birth, sky]);

  const same = sky.constellation.label === sky.sign;
  const width = zodiacWidthDeg(sky.constellation);
  const bestMonth = ((birth.month + 5) % 12) + 1;

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="text-2xl font-bold">생일 별자리</h1>
        <label className="flex flex-col gap-1 text-sm">
          생일
          <input
            type="date"
            className="input input-sm w-44"
            value={`${birth.year}-${String(birth.month).padStart(2, "0")}-${String(birth.day).padStart(2, "0")}`}
            onChange={(e) => {
              const [y, m, d] = e.target.value.split("-").map(Number);

              if (y && m && d) {
                setBirth({ year: y, month: m, day: d });
              }
            }}
          />
        </label>
        <div className="grow" />
      </div>

      <div className="bg-base-200 rounded-box grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <div>
          <div className="text-sm opacity-70">점성술(운세)의 별자리</div>
          <div className="text-3xl font-bold text-pink-300">{sky.sign}</div>
          <div className="text-xs opacity-60">
            춘분점부터 30°씩 나눈 열두 칸 중 생일의 해가 있는 칸
          </div>
        </div>
        <div>
          <div className="text-sm opacity-70">그날 해가 실제로 있던 별자리</div>
          <div className="text-3xl font-bold text-amber-300">
            {sky.constellation.label}
          </div>
          <div className="text-xs opacity-60">
            국제천문연맹(IAU)이 정한 별자리 경계 기준
          </div>
        </div>
      </div>

      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="rounded-box w-full"
      />

      <div className="bg-base-200 rounded-box flex flex-col gap-3 p-4 text-sm">
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
