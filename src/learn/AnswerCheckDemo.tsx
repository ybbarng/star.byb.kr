"use client";

import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useMemo, useRef, useState } from "react";
import { STARS } from "@/game/sky/catalog";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 답 확인 데모: 서울 누각 사진의 진짜 별만 남기고(V2에서 사람이 별을 고친 것처럼) V2 방식으로 quad를 찾아,
// 지문이 가장 가까운 quad(V2가 고른 답)와 지문 순위에서 처음 나오는 정답 quad를 각각 겹친다.
// 식별에 쓴 별(빨강)은 답을 만들 때 쓴 별이라 당연히 겹치고, 그 밖에 겹친 별(초록)이 답이 맞는지 알려 준다
// — 지문이 가장 가까워도 정답은 아니다.
// 자료: public/learn/candidates-seoul.json (scripts/learn/buildDemoData.ts)

const SRC = "/samples/20220607-berry-seoul.jpg";

interface QuadAnswer {
  TP: Mat3;
  photo: Point2D[];
  seeds: number[];
  matched: number[];
  count: number;
  distance: number; // 지문 거리 (풀이 단위)
  rank: number; // 지문 거리 순위
  quads: number; // 사진 별 15개로 만든 quad 수
}

interface Data {
  W: number;
  H: number;
  tol: number;
  v2: QuadAnswer;
  v2Right: QuadAnswer;
}

type Mode = "v2" | "v2Right";

const mapStarsOf = (TP: Mat3, W: number, H: number) =>
  STARS.map((s) => ({ s, p: projectVecToPhoto(TP, s.vector as Point3D) }))
    .filter(
      (m): m is { s: (typeof STARS)[number]; p: Point2D } =>
        m.p !== null && m.p[0] >= 0 && m.p[0] < W && m.p[1] >= 0 && m.p[1] < H,
    )
    .map(({ s, p }) => ({ p, mag: s.mag }));

export default function AnswerCheckDemo() {
  const [data, setData] = useState<Data | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<Mode>("v2");
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

  const view = useMemo(() => {
    if (!data) return null;

    const a = data[mode];

    return {
      photo: a.photo,
      map: mapStarsOf(a.TP, data.W, data.H),
      seeds: a.seeds,
      matched: a.matched,
    };
  }, [data, mode]);

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

    // 발표 화면에서도 또렷하게: 사진 별은 노란 점, 답대로 놓은 별 지도는 파란 원, 식별에 쓴 별은 빨간 원.
    // 노란 점이 파란 원 안에 들면 겹친 것이다. 사진 별은 어느 답이든 같다.
    context.lineWidth = 3;
    context.strokeStyle = "#60a5fa";

    for (const { p } of view.map) {
      context.beginPath();
      context.arc(p[0] * k, p[1] * k, 11, 0, 2 * Math.PI);
      context.stroke();
    }

    context.fillStyle = "#fde047";

    for (const [x, y] of view.photo) {
      context.beginPath();
      context.arc(x * k, y * k, 4.5, 0, 2 * Math.PI);
      context.fill();
    }

    // 식별에 쓴 별을 잇는 다각형 외곽선 (얇은 빨간 점선). 무게중심 둘레 각도 순으로 이어 선이 엇갈리지 않게
    const corners = view.seeds.map((i) => view.photo[i]);

    if (corners.length >= 3) {
      const cx = corners.reduce((sum, p) => sum + p[0], 0) / corners.length;
      const cy = corners.reduce((sum, p) => sum + p[1], 0) / corners.length;
      corners.sort(
        (p, q) =>
          Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx),
      );
      context.lineWidth = 1.5;
      context.strokeStyle = "#ef4444";
      context.setLineDash([5, 5]);
      context.beginPath();
      corners.forEach(([x, y], n) =>
        n ? context.lineTo(x * k, y * k) : context.moveTo(x * k, y * k),
      );
      context.closePath();
      context.stroke();
      context.setLineDash([]);
    }

    // 겹친 별: 초록 원 (식별에 쓴 별은 빨간 원). 노란 점·파란 원·초록 원이 과녁처럼 보인다
    context.lineWidth = 4;
    context.strokeStyle = "#4ade80";

    for (const i of view.matched) {
      if (view.seeds.includes(i)) continue;

      const [x, y] = view.photo[i];
      context.beginPath();
      context.arc(x * k, y * k, 19, 0, 2 * Math.PI);
      context.stroke();
    }

    context.strokeStyle = "#ef4444";

    for (const i of view.seeds) {
      const [x, y] = view.photo[i];
      context.beginPath();
      context.arc(x * k, y * k, 19, 0, 2 * Math.PI);
      context.stroke();
    }
  }, [data, image, view]);

  if (!data) {
    return <div className="text-sm opacity-60">자료를 불러오는 중…</div>;
  }

  const a = data[mode];
  const seedsHit = a.seeds.length;
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
          {button("v2", "V2가 고른 답")}
          {button("v2Right", "정답 quad")}
        </div>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            <span className="text-yellow-300">●</span> 사진에서 찾은 별
          </li>
          <li>
            <span className="text-blue-400">◯</span> 답대로 놓은 별 지도
          </li>
          <li>
            <span className="text-red-500">◯</span> 식별에 쓴 별
          </li>
          <li>
            <span className="text-green-400">◯</span> 그 밖에 겹친 별
          </li>
        </ul>
        <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3">
          <div>
            겹친 별 <b className="text-lg">{a.count}개</b>
          </div>
          <div className="text-sm opacity-80">
            = 식별에 쓴 별 <span className="text-red-400">{seedsHit}</span> + 그
            밖에 <b className="text-green-400">{a.count - seedsHit}</b>
          </div>
          <div className="border-base-content/10 mt-1 border-t pt-2 text-sm opacity-80">
            지문 거리 <b>{a.distance.toFixed(3)}</b> ·{" "}
            <b>
              {a.quads.toLocaleString()}개 중 {a.rank}등
            </b>
          </div>
        </div>
      </div>
    </div>
  );
}
