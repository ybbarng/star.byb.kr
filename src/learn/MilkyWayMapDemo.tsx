"use client";

import type { Point3D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadImage } from "@/learn/demoAssets";
import { makeGlow, planeResidual, skyMask } from "@/learn/milkyWayBand";
import { MILKY_WAY_PHOTOS } from "@/learn/milkyWayPhotos";
import { detectPhotoStars } from "@/plate-solver/detectPhotoStars";
import { toGray } from "@/search/detectImage";
import { galacticToEquatorial } from "@/search/hooks/useSkyOverlay";
import { solveInWorker } from "@/search/solverClient";
import { photoToSky } from "@/search/utils/wcs";
import { cn } from "@/utils/cn";

// 은하수 지도 대조 (journey 51장): 자세마다 사진 칸의 은경·은위에서 은하수 지도를 읽어 "이 자리라면 보여야 할 은하수"를 만들고,
// 사진의 흐린 밝기와 닮은 정도(상관)를 잰다. 사진을 먼저 풀어 정답 자세를 얻고, 하늘을 은하 북극 둘레로 돌리며
// 닮은 정도가 정답 자리(0°)에서 가장 큰지 본다. 지도: ESO/S. Brunier (eso0932a), CC BY 4.0. 이 페이지에서만 받는다

const MAP_SRC = "/learn/milky-way-eso0932a-960.jpg";
const MAP_W = 360;
const MAP_H = 180;
const COLS = 48;
const CURVE_STEP = 3;

const NGP = galacticToEquatorial(0, 90);
const GL0 = galacticToEquatorial(0, 0);
const GL90 = galacticToEquatorial(90, 0);
const LMC = galacticToEquatorial(280.47, -32.89);
const SMC = galacticToEquatorial(302.81, -44.33);

const dot = (a: number[], b: number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// 은하 북극 둘레로 각도만큼 돌린 방향 (로드리게스)
const rotate = (v: Point3D, deg: number): Point3D => {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const k = NGP;
  const kv = dot(k, v);
  const cross: Point3D = [
    k[1] * v[2] - k[2] * v[1],
    k[2] * v[0] - k[0] * v[2],
    k[0] * v[1] - k[1] * v[0],
  ];

  return [0, 1, 2].map(
    (i) => v[i] * c + cross[i] * s + k[i] * kv * (1 - c),
  ) as Point3D;
};

// 적도 방향 → 지도 좌표(0~1). 은하 중심이 가운데, 은경은 왼쪽으로 커진다
const mapXY = (v: Point3D): [number, number] => {
  const l = Math.atan2(dot(v, GL90), dot(v, GL0));
  const b = Math.asin(Math.max(-1, Math.min(1, dot(v, NGP))));
  const x = 0.5 - l / (2 * Math.PI);

  return [x - Math.floor(x), 0.5 - b / Math.PI];
};

// 지도를 360×180 회색조로 줄이고 상자 흐림 세 번(약 2칸)
const mapGray = (img: HTMLImageElement) => {
  const c = document.createElement("canvas");
  c.width = MAP_W;
  c.height = MAP_H;
  const context = c.getContext("2d")!;
  context.drawImage(img, 0, 0, MAP_W, MAP_H);
  let a = Float32Array.from(
    toGray(context.getImageData(0, 0, MAP_W, MAP_H).data, MAP_W, MAP_H),
  );

  for (let pass = 0; pass < 3; pass++) {
    const out = new Float32Array(a.length);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        let s = 0;
        let n = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy;

            if (yy < 0 || yy >= MAP_H) continue;

            s += a[yy * MAP_W + ((x + dx + MAP_W) % MAP_W)];
            n++;
          }
        }

        out[y * MAP_W + x] = s / n;
      }
    }

    a = out;
  }

  return a;
};

interface Scene {
  cols: number;
  rows: number;
  mask: Uint8Array;
  photoRes: Float32Array;
  dirs: (Point3D | null)[]; // 정답 자세에서 칸마다의 하늘 방향 (하늘 칸만)
  map: Float32Array;
}

const templateAt = (scene: Scene, deg: number) => {
  const tmpl = new Float32Array(scene.cols * scene.rows);

  scene.dirs.forEach((d, k) => {
    if (!d) return;

    const [x, y] = mapXY(rotate(d, deg));
    tmpl[k] =
      scene.map[
        Math.min(MAP_H - 1, Math.floor(y * MAP_H)) * MAP_W +
          Math.min(MAP_W - 1, Math.floor(x * MAP_W))
      ];
  });

  return planeResidual(tmpl, scene.cols, scene.rows, scene.mask);
};

const correlation = (scene: Scene, tmpl: Float32Array) => {
  let ma = 0;
  let mb = 0;
  let n = 0;

  for (let k = 0; k < tmpl.length; k++) {
    if (scene.mask[k]) {
      ma += scene.photoRes[k];
      mb += tmpl[k];
      n++;
    }
  }

  ma /= n;
  mb /= n;

  let cov = 0;
  let va = 0;
  let vb = 0;

  for (let k = 0; k < tmpl.length; k++) {
    if (scene.mask[k]) {
      cov += (scene.photoRes[k] - ma) * (tmpl[k] - mb);
      va += (scene.photoRes[k] - ma) ** 2;
      vb += (tmpl[k] - mb) ** 2;
    }
  }

  return va > 1e-9 && vb > 1e-9 ? cov / Math.sqrt(va * vb) : 0;
};

const drawHeat = (
  canvas: HTMLCanvasElement | null,
  vals: Float32Array,
  mask: Uint8Array,
  cols: number,
  rows: number,
) => {
  const context = canvas?.getContext("2d");

  if (!context) return;

  let lo = Infinity;
  let hi = -Infinity;

  vals.forEach((v, k) => {
    if (mask[k]) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  });

  const img = context.createImageData(cols, rows);

  for (let k = 0; k < vals.length; k++) {
    const t = mask[k] ? (vals[k] - lo) / Math.max(1e-6, hi - lo) : 0;
    img.data[k * 4] = mask[k] ? 40 + 215 * t : 20;
    img.data[k * 4 + 1] = mask[k] ? 30 + 190 * t * t : 20;
    img.data[k * 4 + 2] = mask[k] ? 20 + 90 * (1 - t) : 30;
    img.data[k * 4 + 3] = 255;
  }

  context.putImageData(img, 0, 0);
};

export default function MilkyWayMapDemo() {
  const [photo, setPhoto] = useState(MILKY_WAY_PHOTOS[0]);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [status, setStatus] = useState<
    "loading" | "solving" | "ready" | "unsolved" | "failed"
  >("loading");
  const [deg, setDeg] = useState(0);
  const mapCanvas = useRef<HTMLCanvasElement>(null);
  const photoHeat = useRef<HTMLCanvasElement>(null);
  const tmplHeat = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadImage(MAP_SRC)
      .then(setMapImage)
      .catch(() => setStatus("failed"));
  }, []);

  // 사진을 불러와 별을 찾고 풀어서 정답 자세를 얻은 뒤, 칸마다의 하늘 방향과 사진의 흐린 밝기를 준비한다
  useEffect(() => {
    if (!mapImage) return;

    let alive = true;

    setScene(null);
    setDeg(0);
    setStatus("loading");

    (async () => {
      const img = await loadImage(photo.src);
      const stars = await detectPhotoStars(img);

      if (!alive) return;

      setStatus("solving");

      const out = await solveInWorker(
        stars.map((s) => ({
          x: s.x,
          y: s.y,
          brightness: s.brightness,
          ringContrast: s.ringContrast,
          trail: s.trail,
          chord: s.chord,
        })),
        img.width,
        img.height,
      );

      if (!alive) return;

      if (!out.found || !out.transform) {
        setStatus("unsolved");

        return;
      }

      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const context = c.getContext("2d")!;
      context.drawImage(img, 0, 0);
      const glow = makeGlow(
        toGray(
          context.getImageData(0, 0, img.width, img.height).data,
          img.width,
          img.height,
        ),
        img.width,
        img.height,
        COLS,
      );
      const mask = skyMask(stars, img.width, img.height, glow.cols, glow.rows);
      const TP = out.transform as Mat3;
      const dirs = Array.from({ length: glow.cols * glow.rows }, (_, k) =>
        mask[k]
          ? photoToSky(TP, [
              (((k % glow.cols) + 0.5) * img.width) / glow.cols,
              ((Math.floor(k / glow.cols) + 0.5) * img.height) / glow.rows,
            ])
          : null,
      );

      setScene({
        cols: glow.cols,
        rows: glow.rows,
        mask,
        photoRes: planeResidual(glow.data, glow.cols, glow.rows, mask),
        dirs,
        map: mapGray(mapImage),
      });
      setStatus("ready");
    })().catch(() => alive && setStatus("failed"));

    return () => {
      alive = false;
    };
  }, [photo, mapImage]);

  // 돌린 각도마다의 닮은 정도 (그래프)
  const curve = useMemo(() => {
    if (!scene) return null;

    const pts: { deg: number; r: number }[] = [];

    for (let d = -180; d <= 180; d += CURVE_STEP) {
      pts.push({ deg: d, r: correlation(scene, templateAt(scene, d)) });
    }

    return pts;
  }, [scene]);

  const tmpl = useMemo(
    () => (scene ? templateAt(scene, deg) : null),
    [scene, deg],
  );
  const r = scene && tmpl ? correlation(scene, tmpl) : null;

  useEffect(() => {
    if (!scene || !tmpl) return;

    drawHeat(
      photoHeat.current,
      scene.photoRes,
      scene.mask,
      scene.cols,
      scene.rows,
    );
    drawHeat(tmplHeat.current, tmpl, scene.mask, scene.cols, scene.rows);
  }, [scene, tmpl]);

  // 지도 위에 지금 각도의 사진 자리(칸마다 점)와 마젤란 은하
  useEffect(() => {
    const context = mapCanvas.current?.getContext("2d");

    if (!context || !mapImage) return;

    const W = context.canvas.width;
    const H = context.canvas.height;

    context.drawImage(mapImage, 0, 0, W, H);

    if (scene) {
      context.fillStyle = "rgba(253,230,138,0.85)";

      for (const d of scene.dirs) {
        if (!d) continue;

        const [x, y] = mapXY(rotate(d, deg));
        context.fillRect(x * W - 1, y * H - 1, 2.5, 2.5);
      }
    }

    context.strokeStyle = "rgba(147,197,253,0.95)";
    context.fillStyle = "rgba(147,197,253,0.95)";
    context.lineWidth = 1.5;
    context.font = "12px sans-serif";

    for (const [v, name] of [
      [LMC, "대마젤란"],
      [SMC, "소마젤란"],
    ] as const) {
      const [x, y] = mapXY(v);
      context.beginPath();
      context.arc(x * W, y * H, 7, 0, 2 * Math.PI);
      context.stroke();
      context.fillText(name, x * W + 9, y * H + 4);
    }
  }, [mapImage, scene, deg]);

  const best = curve?.reduce((a, b) => (b.r > a.r ? b : a));
  const lo = curve ? Math.min(...curve.map((p) => p.r)) : -1;
  const hi = curve ? Math.max(...curve.map((p) => p.r)) : 1;
  const px = (d: number) => ((d + 180) / 360) * 300;
  const py = (v: number) => 70 - ((v - lo) / Math.max(1e-6, hi - lo)) * 60;

  return (
    <div className="flex flex-col gap-3">
      <div className="join flex-wrap">
        {MILKY_WAY_PHOTOS.map((p) => (
          <button
            key={p.src}
            disabled={status === "loading" || status === "solving"}
            className={cn(
              "btn join-item btn-sm",
              photo.src === p.src && "btn-active",
            )}
            onClick={() => setPhoto(p)}
          >
            {p.title}
          </button>
        ))}
      </div>
      <div className="rounded-box relative overflow-hidden bg-black">
        <canvas
          ref={mapCanvas}
          width={960}
          height={480}
          className="block w-full"
        />
        {(status === "loading" || status === "solving") && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm">
            <span className="flex items-center gap-2">
              <span className="loading loading-spinner loading-sm" />
              {status === "loading"
                ? "사진을 불러와 별을 찾는 중…"
                : "사진을 풀어 정답 자리를 찾는 중… (최대 8초)"}
            </span>
          </div>
        )}
        {(status === "unsolved" || status === "failed") && (
          <div
            role="alert"
            className="absolute inset-0 grid place-items-center bg-black/60 p-4 text-center text-sm"
          >
            {status === "unsolved"
              ? "이 사진은 이 기기에서 풀지 못해 정답 자리를 몰라요. 다른 사진을 골라 보세요."
              : "자료를 불러오지 못했어요. 새로고침해 보세요."}
          </div>
        )}
      </div>
      <p className="text-xs opacity-60">
        전천 은하수 지도: ESO/S. Brunier (eso0932a), CC BY 4.0. 가운데가 은하
        중심이에요. 노란 점이 지금 각도에서 사진이 덮는 하늘이에요.
      </p>
      <label className="flex items-center gap-3 text-sm">
        <span className="whitespace-nowrap">하늘 돌리기</span>
        <input
          type="range"
          min={-180}
          max={180}
          step={CURVE_STEP}
          value={deg}
          disabled={!scene}
          className="range range-sm range-primary flex-1"
          onChange={(e) => setDeg(Number(e.target.value))}
        />
        <span className="w-12 text-right tabular-nums">{deg}°</span>
      </label>
      <div className="grid items-center gap-3 md:grid-cols-[auto_auto_1fr]">
        <div className="flex flex-col items-center gap-1 text-xs opacity-80">
          <canvas
            ref={photoHeat}
            width={scene?.cols ?? COLS}
            height={scene?.rows ?? 32}
            className="rounded-box w-40 bg-black [image-rendering:pixelated]"
          />
          사진의 흐린 밝기
        </div>
        <div className="flex flex-col items-center gap-1 text-xs opacity-80">
          <canvas
            ref={tmplHeat}
            width={scene?.cols ?? COLS}
            height={scene?.rows ?? 32}
            className="rounded-box w-40 bg-black [image-rendering:pixelated]"
          />
          이 자리라면 보여야 할 은하수
        </div>
        <div className="flex flex-col gap-1">
          <svg viewBox="0 0 300 80" className="w-full">
            <line
              x1={px(0)}
              x2={px(0)}
              y1={4}
              y2={76}
              stroke="rgba(134,239,172,0.6)"
              strokeDasharray="3 3"
            />
            {curve && (
              <polyline
                fill="none"
                stroke="rgba(199,210,254,0.9)"
                strokeWidth={1.5}
                points={curve.map((p) => `${px(p.deg)},${py(p.r)}`).join(" ")}
              />
            )}
            {r !== null && (
              <circle cx={px(deg)} cy={py(r)} r={4} fill="#fde68a" />
            )}
          </svg>
          <p className="text-xs opacity-70">
            {r !== null && best
              ? `닮은 정도 ${r.toFixed(2)} · 가장 닮은 각도 ${best.deg}° (초록 점선이 정답 자리)`
              : "막대를 움직이면 닮은 정도가 바뀌어요."}
          </p>
        </div>
      </div>
    </div>
  );
}
