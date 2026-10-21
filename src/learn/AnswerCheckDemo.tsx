"use client";

import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useMemo, useRef, useState } from "react";
import { STARS } from "@/game/sky/catalog";
import { mat3Mul, projectVecToPhoto, recoverCenter } from "@/search/utils/wcs";

// 답 확인 데모: 서울 누각 사진에서 풀이가 실제로 검증한 후보 둘(옛 점수 1등 가짜, 진짜 답)을 골라
// 그 답대로 별 지도를 사진에 겹친다. 짝지은 별(파랑)은 답을 만들 때 쓴 별이라 당연히 겹치고,
// 그 밖에 더 겹친 별(초록)이 답이 맞는지 알려 준다. "아무렇게나 놓기"는 같은 자리 근처에서 하늘을
// 무작위로 돌려 우연히 몇 개나 겹치는지 보여 준다 — 그 평균이 우연 기대치와 비슷하다.
// 자료: public/learn/candidates-seoul.json (scripts/learn/buildDemoData.ts)

const SRC = "/samples/20220607-berry-seoul.jpg";

interface Answer {
  TP: Mat3;
  photo: Point2D[];
  seeds: number[];
  matched: number[];
  count: number;
  expected: number;
  score: number;
  logOdds: number;
}

interface Data {
  W: number;
  H: number;
  tol: number;
  fake: Answer;
  real: Answer;
}

type Mode = "fake" | "real" | "random";

// 축 u(단위 벡터) 둘레로 t만큼 돌리는 행렬
const rotation = (u: Point3D, t: number): Mat3 => {
  const [x, y, z] = u;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const C = 1 - c;

  return [
    [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
  ];
};

// 같은 자리 근처에서 아무렇게나: 광축 둘레로 아무 각도 + 옆으로 8° 안. 하늘 전체에서 놓으면
// 별이 드문 곳이 섞여 평균이 기대치보다 작게 나온다 (기대치는 그 자리의 별 밀도로 계산한다).
const randomNearby = (center: Point3D): Mat3 => {
  const spin = rotation(center, Math.random() * 2 * Math.PI);
  const r = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5];
  const along = r[0] * center[0] + r[1] * center[1] + r[2] * center[2];
  const side = r.map((v, i) => v - along * center[i]);
  const n = Math.hypot(side[0], side[1], side[2]);
  const tilt = rotation(
    [side[0] / n, side[1] / n, side[2] / n],
    (Math.random() * 8 * Math.PI) / 180,
  );

  return mat3Mul(tilt, spin);
};

const mapStarsOf = (TP: Mat3, W: number, H: number) =>
  STARS.map((s) => ({ s, p: projectVecToPhoto(TP, s.vector as Point3D) }))
    .filter(
      (m): m is { s: (typeof STARS)[number]; p: Point2D } =>
        m.p !== null && m.p[0] >= 0 && m.p[0] < W && m.p[1] >= 0 && m.p[1] < H,
    )
    .map(({ s, p }) => ({ p, mag: s.mag }));

// 사진 별마다 허용 반경 안에 지도 별이 있으면 겹친 것으로 센다
const overlapsOf = (photo: Point2D[], map: Point2D[], tol: number) =>
  photo
    .map((q, i) =>
      map.some((m) => Math.hypot(m[0] - q[0], m[1] - q[1]) <= tol) ? i : -1,
    )
    .filter((i) => i >= 0);

export default function AnswerCheckDemo() {
  const [data, setData] = useState<Data | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<Mode>("fake");
  const [throws, setThrows] = useState<{ R: Mat3; hits: number }[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;

    fetch("/learn/candidates-seoul.json")
      .then((r) => r.json())
      .then((d: Data) => alive && setData(d));
    const img = new Image();
    img.onload = () => alive && setImage(img);
    img.src = SRC;

    return () => {
      alive = false;
    };
  }, []);

  // 가짜 답의 사진 별로 하늘을 아무렇게나 돌려 놓아 본다
  const throwOnce = (n: number) => {
    if (!data) return;

    const base = data.fake;
    const next = Array.from({ length: n }, () => {
      const R = randomNearby(recoverCenter(base.TP, data.W, data.H));
      const map = mapStarsOf(mat3Mul(base.TP, R), data.W, data.H).map(
        (m) => m.p,
      );

      return { R, hits: overlapsOf(base.photo, map, data.tol).length };
    });

    setThrows((t) => [...t, ...next]);
    setMode("random");
  };

  const view = useMemo(() => {
    if (!data) return null;

    if (mode === "random") {
      const last = throws[throws.length - 1];
      const TP = last ? mat3Mul(data.fake.TP, last.R) : data.fake.TP;
      const map = mapStarsOf(TP, data.W, data.H);

      return {
        photo: data.fake.photo,
        map,
        seeds: [] as number[],
        matched: overlapsOf(
          data.fake.photo,
          map.map((m) => m.p),
          data.tol,
        ),
      };
    }

    const a = data[mode];

    return {
      photo: a.photo,
      map: mapStarsOf(a.TP, data.W, data.H),
      seeds: a.seeds,
      matched: a.matched,
    };
  }, [data, mode, throws]);

  useEffect(() => {
    const el = canvas.current;
    const context = el?.getContext("2d");

    if (!el || !context || !data || !image || !view) return;

    const W = 960;
    const k = W / data.W;
    const H = Math.round(data.H * k);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = W * dpr;
    el.height = H * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.drawImage(image, 0, 0, W, H);
    context.fillStyle = "rgba(5,8,20,0.45)";
    context.fillRect(0, 0, W, H);

    // 별 지도 (노랑, 밝을수록 크게)
    for (const { p, mag } of view.map) {
      context.fillStyle = "rgba(253,230,138,0.95)";
      context.beginPath();
      context.arc(p[0] * k, p[1] * k, Math.max(2.2, 6 - mag), 0, 2 * Math.PI);
      context.fill();
    }

    // 사진에서 찾은 별 (흰 테)
    context.lineWidth = 1.5;
    context.strokeStyle = "rgba(255,255,255,0.7)";

    for (const [x, y] of view.photo) {
      context.beginPath();
      context.arc(x * k, y * k, 7, 0, 2 * Math.PI);
      context.stroke();
    }

    // 겹친 별: 짝지은 별은 파랑, 더 겹친 별은 초록
    context.lineWidth = 4;

    for (const i of view.matched) {
      const [x, y] = view.photo[i];
      context.strokeStyle = view.seeds.includes(i) ? "#60a5fa" : "#4ade80";
      context.beginPath();
      context.arc(x * k, y * k, 16, 0, 2 * Math.PI);
      context.stroke();
    }
  }, [data, image, view]);

  if (!data) {
    return <div className="text-sm opacity-60">자료를 불러오는 중…</div>;
  }

  const a = mode === "random" ? null : data[mode];
  const seedsHit = a ? a.seeds.length : 0;
  const average =
    throws.length > 0
      ? throws.reduce((sum, t) => sum + t.hits, 0) / throws.length
      : null;
  const button = (m: Mode, label: string) => (
    <button
      className={`btn btn-sm ${mode === m ? "btn-primary" : ""}`}
      onClick={() => setMode(m)}
    >
      {label}
    </button>
  );

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_17rem]">
      <canvas
        ref={canvas}
        style={{ maxHeight: "80vh" }}
        className="rounded-box h-auto w-full"
      />
      <div className="flex flex-col gap-3 text-base">
        <div className="flex flex-wrap gap-2">
          {button("fake", "가짜 답")}
          {button("real", "진짜 답")}
          <button
            className={`btn btn-sm ${mode === "random" ? "btn-primary" : ""}`}
            onClick={() => throwOnce(1)}
          >
            아무렇게나 놓기
          </button>
        </div>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            <span className="text-amber-200">●</span> 그 답대로 놓은 별 지도
          </li>
          <li>
            <span className="opacity-60">○</span> 사진에서 찾은 별
          </li>
          <li>
            <span className="text-blue-400">◯</span> 짝지은 별 (답을 만들 때 쓴
            별)
          </li>
          <li>
            <span className="text-green-400">◯</span> 그 밖에 더 겹친 별
          </li>
        </ul>
        {a && (
          <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3">
            <div>
              겹친 별 <b className="text-lg">{a.count}개</b>
            </div>
            <div className="text-sm opacity-80">
              = 짝지은 별 <span className="text-blue-400">{seedsHit}</span> + 더
              겹친 별{" "}
              <span className="text-green-400">{a.count - seedsHit}</span>
            </div>
          </div>
        )}
        {mode === "random" && (
          <div className="bg-base-300/60 rounded-box flex flex-col gap-2 p-3">
            <div>
              이번에 우연히 겹친 별{" "}
              <b className="text-lg">
                {throws[throws.length - 1]?.hits ?? 0}개
              </b>
            </div>
            <div className="text-sm opacity-80">
              {throws.length}번 놓아 본 평균{" "}
              <b>{average?.toFixed(2) ?? "-"}개</b>
            </div>
            <button className="btn btn-xs" onClick={() => throwOnce(100)}>
              100번 더 놓기
            </button>
            <div className="text-sm opacity-60">
              풀이가 계산한 우연 기대치: 가짜 답 {data.fake.expected.toFixed(2)}
              개, 진짜 답 {data.real.expected.toFixed(2)}개
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
