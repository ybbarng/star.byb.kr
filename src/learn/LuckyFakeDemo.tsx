"use client";

import { useState } from "react";
import { ACCEPT } from "@/search/solvers/candidates";
import { poissonTailNegLog10 } from "@/search/utils/stats";

// 여러 번 뒤지면 우연이 쌓인다: 후보 N개를 확인할 때, 가장 운 좋은 가짜는 몇 개나 겹칠까.
// 가짜 하나가 k개 넘게 겹칠 확률 p(k)에 N을 곱한 값이 1쯤 되는 k가 "N개 중 가장 운 좋은 가짜"의 겹침 수다.

const TRIES = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000];

export default function LuckyFakeDemo() {
  const [tryIndex, setTryIndex] = useState(4);
  const [expected, setExpected] = useState(1);
  const tries = TRIES[tryIndex];
  // N·p(k) < 1이 되는 가장 작은 k
  let lucky = 0;

  while (poissonTailNegLog10(lucky + 1, expected) < Math.log10(tries)) {
    lucky++;
  }

  const ratio = lucky / expected;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          확인하는 후보 {tries.toLocaleString("ko-KR")}개
          <input
            type="range"
            className="range range-xs"
            min={0}
            max={TRIES.length - 1}
            value={tryIndex}
            onChange={(e) => setTryIndex(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          가짜 하나가 우연히 겹칠 기대치 {expected.toFixed(1)}개
          <input
            type="range"
            className="range range-xs"
            min={0.5}
            max={4}
            step={0.1}
            value={expected}
            onChange={(e) => setExpected(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-base-300/60 rounded-box p-3">
          <div className="text-xs opacity-60">
            가장 운 좋은 가짜가 겹치는 별
          </div>
          <div className="text-xl font-black">약 {lucky}개</div>
          <div className="text-xs opacity-60">
            기대치의 {ratio.toFixed(0)}배
          </div>
        </div>
        <div className="bg-base-300/60 rounded-box p-3">
          <div className="text-xs opacity-60">그 가짜 하나의 우연 확률</div>
          <div className="text-xl font-black">
            10<sup>-{Math.log10(tries).toFixed(0)}</sup>
          </div>
          <div className="text-xs opacity-60">
            기준 10<sup>-{ACCEPT.minLogOdds}</sup>과 비교
          </div>
        </div>
      </div>
      <p className="text-xs opacity-70">
        후보를 많이 볼수록 &ldquo;가장 운 좋은 가짜&rdquo;는 기대치의 몇 배를
        맞춰요. 예전 기준(기대치의 몇 배인가)은 이 가짜를 정답으로 착각했어요.
        우연일 확률로 보면, 후보 N개 중 가장 운 좋은 가짜의 확률은 대략
        1/N이에요. 풀이가 보는 후보는 사진 한 장에 수만 개라 10<sup>-9</sup>{" "}
        기준은 그보다 넉넉히 엄격해요.
      </p>
    </div>
  );
}
