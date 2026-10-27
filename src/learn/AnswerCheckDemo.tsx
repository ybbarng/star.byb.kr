"use client";

import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useRef, useState } from "react";
import { STARS } from "@/game/sky/catalog";
import { fetchJson, LOAD_FAILED, loadImage } from "@/learn/demoAssets";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 답 확인 데모: 서울 누각 사진의 진짜 별만 남기고(V2에서 사람이 별을 고친 것처럼) V2 방식으로 quad를 찾는다.
// 오른쪽 그래프는 지문 거리 순 앞쪽 후보 20개: 점 하나가 사진 quad 하나와 그 짝 지도 quad이고, 가운데(+)에서의 거리가
// 두 지문의 차이다 (가운데 = 지문이 똑같음).
// 점을 누르면 그 후보대로 별 지도를 사진에 겹친다. 짝지은 별(빨강)은 당연히 겹치고, 그 밖에 겹친 별(초록)이
// 답이 맞는지 알려 준다 — 지문이 가장 가까운 1등(주황)보다 15등인 정답(보라)이 훨씬 많이 겹친다.
// 자료: public/learn/candidates-seoul.json (scripts/learn/buildDemoData.ts)

const SRC = "/samples/20220607-berry-seoul.jpg";

interface QuadCandidate {
  rank: number; // 지문 거리 순위
  TP: Mat3;
  seeds: number[];
  matched: number[];
  count: number;
  distance: number; // 사진 quad와 지도 quad의 지문 거리 (네 숫자 사이의 거리)
  stars: string[];
  real: boolean;
}

interface Data {
  W: number;
  H: number;
  tol: number;
  v2: {
    photo: Point2D[];
    quads: number; // 사진 별 15개로 만든 quad 수
    right: number; // 정답 quad의 순위
    list: QuadCandidate[];
  };
}

const PLOT = 280;
const CENTER = PLOT / 2;
const RADIUS = 118;
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // 점이 겹치지 않게 순위마다 황금각만큼 돌린다 (방향은 의미 없다)

const mapStarsOf = (TP: Mat3, W: number, H: number) =>
  STARS.map((s) => projectVecToPhoto(TP, s.vector as Point3D)).filter(
    (p): p is Point2D =>
      p !== null && p[0] >= 0 && p[0] < W && p[1] >= 0 && p[1] < H,
  );

export default function AnswerCheckDemo() {
  const [data, setData] = useState<Data | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;

    // 받지 못하면 "불러오는 중"에 머물지 않고 실패를 알린다
    Promise.all([
      fetchJson<Data>("/learn/candidates-seoul.json"),
      loadImage(SRC),
    ])
      .then(([d, img]) => {
        if (!alive) return;

        setData(d);
        setImage(img);
      })
      .catch(() => alive && setFailed(true));

    return () => {
      alive = false;
    };
  }, []);

  const pick = data?.v2.list.find((q) => q.rank === selected) ?? null;

  useEffect(() => {
    const el = canvas.current;
    const context = el?.getContext("2d");

    if (!el || !context || !data || !image || !pick) return;

    const photo = data.v2.photo;
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

    // 발표 화면에서도 또렷하게: 사진 별은 노란 점, 답대로 놓은 별 지도는 파란 원, 짝지은 별은 빨간 원.
    // 노란 점이 파란 원 안에 들면 겹친 것이다.
    context.lineWidth = 3;
    context.strokeStyle = "#60a5fa";

    for (const p of mapStarsOf(pick.TP, data.W, data.H)) {
      context.beginPath();
      context.arc(p[0] * k, p[1] * k, 11, 0, 2 * Math.PI);
      context.stroke();
    }

    context.fillStyle = "#fde047";

    for (const [x, y] of photo) {
      context.beginPath();
      context.arc(x * k, y * k, 4.5, 0, 2 * Math.PI);
      context.fill();
    }

    // 짝지은 별을 잇는 다각형 외곽선 (얇은 빨간 점선). 무게중심 둘레 각도 순으로 이어 선이 엇갈리지 않게
    const corners = pick.seeds.map((i) => photo[i]);
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

    // 겹친 별: 초록 원 (짝지은 별은 빨간 원). 노란 점·파란 원·초록 원이 과녁처럼 보인다
    context.lineWidth = 4;
    context.strokeStyle = "#4ade80";

    for (const i of pick.matched) {
      if (pick.seeds.includes(i)) continue;

      const [x, y] = photo[i];
      context.beginPath();
      context.arc(x * k, y * k, 19, 0, 2 * Math.PI);
      context.stroke();
    }

    context.strokeStyle = "#ef4444";

    for (const i of pick.seeds) {
      const [x, y] = photo[i];
      context.beginPath();
      context.arc(x * k, y * k, 19, 0, 2 * Math.PI);
      context.stroke();
    }
  }, [data, image, pick]);

  if (!data || !pick) {
    return (
      <div className="text-sm opacity-60" role={failed ? "alert" : undefined}>
        {failed ? LOAD_FAILED : "자료를 불러오는 중…"}
      </div>
    );
  }

  const { list, right, quads } = data.v2;
  const maxDistance = Math.ceil(list[list.length - 1].distance * 200) / 200;

  const at = (q: QuadCandidate): Point2D => {
    const r = (q.distance / maxDistance) * RADIUS;
    const t = q.rank * GOLDEN;

    return [CENTER + r * Math.cos(t), CENTER + r * Math.sin(t)];
  };

  const colorOf = (q: QuadCandidate) =>
    q.rank === 1 ? "#fb923c" : q.rank === right ? "#c084fc" : "#94a3b8";
  const rings = Array.from(
    { length: Math.round(maxDistance / 0.005) },
    (_, i) => (i + 1) * 0.005,
  );

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_19rem]">
      <canvas
        ref={canvas}
        style={{ maxHeight: "80vh" }}
        className="rounded-box h-auto w-full"
      />
      <div className="flex flex-col gap-2 text-base">
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
          <li>
            <span className="text-yellow-300">●</span> 사진에서 찾은 별
          </li>
          <li>
            <span className="text-blue-400">◯</span> 답대로 놓은 별 지도
          </li>
          <li>
            <span className="text-red-500">◯</span> 짝지은 별
          </li>
          <li>
            <span className="text-green-400">◯</span> 그 밖에 겹친 별
          </li>
        </ul>
        <div className="text-sm opacity-70">
          V2의 후보 quad {list.length}개 (지문 거리 순, 전체 {quads}개 중)
        </div>
        <svg
          viewBox={`0 0 ${PLOT} ${PLOT}`}
          className="rounded-box w-full bg-[#0b0f22]"
        >
          {rings.map((d) => (
            <g key={d}>
              <circle
                cx={CENTER}
                cy={CENTER}
                r={(d / maxDistance) * RADIUS}
                fill="none"
                stroke="rgba(160,180,255,0.18)"
                strokeDasharray="3 4"
              />
              <text
                x={CENTER + 3}
                y={CENTER - (d / maxDistance) * RADIUS - 3}
                fontSize="11"
                fill="white"
                opacity="0.6"
              >
                {d.toFixed(3)}
              </text>
            </g>
          ))}
          <path
            d={`M ${CENTER - 7} ${CENTER} h 14 M ${CENTER} ${CENTER - 7} v 14`}
            stroke="white"
            strokeWidth="2"
          />
          {list.map((q) => {
            const [x, y] = at(q);
            const special = q.rank === 1 || q.rank === right;

            return (
              <g
                key={q.rank}
                className="cursor-pointer"
                onClick={() => setSelected(q.rank)}
              >
                {q.rank === selected && (
                  <circle
                    cx={x}
                    cy={y}
                    r={11}
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                  />
                )}
                <circle cx={x} cy={y} r={special ? 7 : 5} fill={colorOf(q)} />
                <circle cx={x} cy={y} r={13} fill="transparent" />
                <text
                  x={x + (q.rank === selected ? 14 : 9)}
                  y={y + 3}
                  fontSize="9"
                  fill={special ? colorOf(q) : "white"}
                  opacity={special ? 1 : 0.6}
                  fontWeight={special ? 700 : 400}
                >
                  {q.rank}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="text-sm opacity-70">
          점 하나 = 사진 quad와 그 짝 지도 quad · + 에서 멀수록 지문이 다르다
          <br />
          <span className="text-orange-400">●</span> 가장 가까운 후보{" "}
          <span className="text-purple-400">●</span> 정답 (방향은 의미 없음)
        </div>
        <div className="bg-base-300/60 rounded-box flex flex-col gap-1 p-3">
          <div>
            <b className="text-lg" style={{ color: colorOf(pick) }}>
              {pick.rank}등
            </b>{" "}
            · 지문 거리 <b>{pick.distance.toFixed(4)}</b>
            {pick.real && <span className="text-purple-300"> · 정답</span>}
          </div>
          <div className="text-sm opacity-80">
            겹친 별 <b>{pick.count}개</b> = 짝지은 별{" "}
            <span className="text-red-400">{pick.seeds.length}</span> + 그 밖에{" "}
            <b className="text-green-400">{pick.count - pick.seeds.length}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
