"use client";

import { useState } from "react";
import { ACCEPT } from "@/search/solvers/candidates";
import { poissonTailNegLog10 } from "@/search/utils/stats";

// 우연 확률 데모: 풀이(solveCore)와 같은 식으로, 답이 틀렸는데도 이만큼 맞을 확률을 계산한다.
//   우연히 맞을 기대 개수 λ = 사진 별 수 × 화면에 들어온 지도 별 수 × (허용 원 넓이 ÷ 사진 넓이)
//   실제로 맞은 개수가 k 이상일 확률 = 푸아송 꼬리. 짝을 지어 넣은 별 3개는 빼고 센다.

const W = 1200;
const H = 800;
const SEED = 3;

export default function ChanceDemo() {
  const [photoStars, setPhotoStars] = useState(60);
  const [mapStars, setMapStars] = useState(150);
  const [matched, setMatched] = useState(20);
  const tolerancePx = 8;
  const expected =
    (photoStars * mapStars * Math.PI * tolerancePx * tolerancePx) / (W * H);
  const logOdds = poissonTailNegLog10(matched - SEED, expected);
  const confident = logOdds >= ACCEPT.minLogOdds;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Slider
          label={`사진에서 찾은 별 ${photoStars}개`}
          min={10}
          max={100}
          value={photoStars}
          onChange={setPhotoStars}
        />
        <Slider
          label={`사진 안에 들어온 지도 별 ${mapStars}개`}
          min={20}
          max={400}
          value={mapStars}
          onChange={setMapStars}
        />
        <Slider
          label={`실제로 겹친 별 ${matched}개`}
          min={3}
          max={50}
          value={matched}
          onChange={setMatched}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-base-300/60 rounded-box p-3">
          <div className="text-xs opacity-60">
            틀린 답이어도 우연히 겹칠 개수
          </div>
          <div className="text-xl font-black">약 {expected.toFixed(1)}개</div>
        </div>
        <div className="bg-base-300/60 rounded-box p-3">
          <div className="text-xs opacity-60">우연히 이만큼 겹칠 확률</div>
          <div className="text-xl font-black">
            {logOdds < 0.5 ? (
              "흔한 일"
            ) : (
              <>
                10<sup>-{Math.min(99, logOdds).toFixed(0)}</sup>
              </>
            )}
          </div>
        </div>
      </div>
      <div
        className={
          confident
            ? "text-success text-center font-bold"
            : "text-warning text-center font-bold"
        }
      >
        {confident
          ? "✓ 10억 분의 1보다 작아요. 답이라고 확신해요."
          : "아직 우연일 수도 있어요. 후보로만 보여 줘요."}
      </div>
      <p className="text-xs opacity-60">
        {W}×{H} 사진, 허용 반경 {tolerancePx}px로 계산했어요. 짝을 지어 넣은 별{" "}
        {SEED}개는 우연 비교에서 빼요. 풀이와 같은 식(푸아송 분포의 꼬리)이에요.
      </p>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type="range"
        className="range range-xs"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
