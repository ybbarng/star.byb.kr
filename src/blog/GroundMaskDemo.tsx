"use client";

import { useState } from "react";

// 테크 블로그 전용 (사이트에는 쓰지 않는다). "사람은 땅을 가리고 하늘만 본다": 누각 사진을 전체로 풀면 모름,
// 위쪽 75%·55%만 남겨도 모름, 45%에서 성공하는 것을 버튼으로 넘겨 본다.
// 그림은 V3 발표 자료의 같은 장면(public/presentation/resources/ground-*.svg)을 그대로 쓴다. 블로그 묶음이 HTML 옆에 복사한다.

const STEPS = [
  { key: "full", label: "사진 전체" },
  { key: "75", label: "위쪽 75%" },
  { key: "55", label: "위쪽 55%" },
  { key: "45", label: "위쪽 45%" },
] as const;

const LEGEND = [
  { mark: "○", color: "#fb923c", text: "풀이에 처음 넣은 밝은 별 15개" },
  { mark: "▲", color: "#f472b6", text: "후보의 출발점 (별 3~4개 묶음)" },
  {
    mark: "┄",
    color: "#fde047",
    text: "모름: 가장 그럴듯했던 후보의 별자리선",
  },
  { mark: "━", color: "#4ade80", text: "성공: 찾은 별자리선" },
  { mark: "┄", color: "#7dd3fc", text: "가린 경계" },
];

export default function GroundMaskDemo() {
  const [step, setStep] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            className={`btn btn-sm ${i === step ? "btn-primary" : ""}`}
            onClick={() => setStep(i)}
          >
            {s.label}
          </button>
        ))}
        <span className="text-sm opacity-70">
          {step < 3 ? "← 땅을 더 가려 보세요" : "하늘만 남기니 풀렸어요"}
        </span>
      </div>
      <div className="relative">
        {STEPS.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- 블로그 정적 묶음이라 next/image를 쓰지 않는다
          <img
            key={s.key}
            src={`presentation/resources/ground-${s.key}.svg`}
            alt={`누각 사진을 ${s.label}만 남기고 푼 결과`}
            className={`rounded-box w-full ${i === step ? "" : "absolute inset-0 opacity-0"}`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-80">
        {LEGEND.map((l) => (
          <li key={l.text}>
            <span style={{ color: l.color }}>{l.mark}</span> {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
