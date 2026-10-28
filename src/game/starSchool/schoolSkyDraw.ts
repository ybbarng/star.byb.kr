import type { Mark } from "@/game/starSchool/lessons";
import type { SkyPlace } from "@/game/starSchool/skyMath";
import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { Observer } from "@/search/utils/ephemeris";
import { constellationParts, STARS } from "@/game/sky/catalog";
import { drawSky } from "@/game/sky/drawSky";
import { asterismById } from "@/game/starSchool/asterisms";
import { deepSkyById } from "@/game/starSchool/deepSky";
import {
  hopPath,
  hopStart,
  hopTip,
  poleVector,
} from "@/game/starSchool/lessonGeometry";
import { eclipticPoints, milkyWayPatches } from "@/game/starSchool/milkyWay";
import {
  centerOf,
  hrVector,
  normalize,
  observerOf,
  raDecVector,
  separationDeg,
  STAR_BY_HR,
} from "@/game/starSchool/skyMath";
import { horizonCameraTP } from "@/search/horizonSolve";
import { horizontalFrameJ2000, julianDay } from "@/search/utils/ephemeris";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 별자리 익히기 하늘 그리기 (화면과 떼어 둔 순수 그리기): 그 장소·시각의 실제 하늘(drawSky) 위에
// 길잡이 모양·징검다리 화살표·딥스카이·하늘의 극·황도·은하수·고리를 겹쳐 그린다. 테스트는 가짜 캔버스로 부른다.

const D = Math.PI / 180;
export const FOV_MIN = 30;
export const FOV_MAX = 120;
const MILKY_WAY = milkyWayPatches(2);
const ECLIPTIC = eclipticPoints(2);

export interface SkyRing {
  vector: Point3D;
  color: string;
  label?: string;
}

const COLORS = {
  asterism: "rgba(110,220,255,0.95)",
  hop: "rgba(255,165,90,0.95)",
  deepSky: "rgba(200,170,255,0.95)",
  star: "rgba(255,255,255,0.95)",
  pole: "rgba(140,255,170,0.95)",
  ecliptic: "rgba(255,200,80,0.8)",
  constellation: "rgba(250,220,80,0.95)", // drawSky의 별자리선 색
};

// 다룰 방향들이 다 들어오는 카메라 (가운데 방향과 시야각)
export const aimView = (
  aim: Point3D[],
  date: Date,
  place: SkyPlace,
): { az: number; alt: number; fov: number } => {
  const frame = horizontalFrameJ2000(julianDay(date), observerOf(place));
  const dot = (a: Point3D, b: Point3D) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  if (aim.length === 0) {
    return { az: place.latDeg >= 0 ? 180 : 0, alt: 35, fov: 90 };
  }

  // 가운데: 방향들을 다 덮는 가장 작은 원의 중심 (Bădoiu–Clarkson: 가장 먼 점 쪽으로 1/(i+1)씩).
  // 평균을 쓰면 별이 많은 쪽(북두칠성 일곱 별)으로 쏠려 반대쪽 끝(스피카)이 화면 밖으로 나간다
  const radiusFrom = (c: Point3D) =>
    Math.max(...aim.map((v) => separationDeg(v, c)));
  let c = centerOf(aim);
  let best = { c, r: radiusFrom(c) };

  for (let i = 1; i <= 60; i++) {
    const far = aim.reduce((a, v) =>
      separationDeg(v, c) > separationDeg(a, c) ? v : a,
    );
    c = normalize(c.map((x, k) => x + (far[k] - x) / (i + 1)));
    const r = radiusFrom(c);

    if (r < best.r) best = { c, r };
  }

  c = best.c;
  const radius = best.r;
  const fov = Math.max(50, Math.min(FOV_MAX - 5, radius * 2.4 + 14));
  const alt = Math.asin(Math.max(-1, Math.min(1, dot(c, frame.zenith)))) / D;
  const az =
    (((Math.atan2(dot(c, frame.east), dot(c, frame.north)) / D) % 360) + 360) %
    360;

  return {
    az,
    alt: Math.max(fov * 0.28, Math.min(85, alt)),
    fov,
  };
};

const starLabel = (hr: string) => STAR_BY_HR.get(hr)?.name;

export interface SkyView {
  az: number;
  alt: number;
  fov: number;
}

export interface SchoolSkyInput {
  width: number;
  height: number;
  view: SkyView;
  date: Date;
  observer: Observer;
  magLimit: number;
  lightPollution: number;
  marks: Mark[];
  rings: SkyRing[];
  quiet: boolean;
}

// 그린 하늘의 카메라 변환(TP)을 돌려준다 (누른 자리 판정에 쓴다)
export const drawSchoolSky = (
  ctx: CanvasRenderingContext2D,
  {
    width: W,
    height: H,
    view,
    date,
    observer,
    magLimit,
    lightPollution,
    marks,
    rings,
    quiet,
  }: SchoolSkyInput,
) => {
  const TP = horizonCameraTP(
    date,
    observer,
    {
      azimuthDeg: view.az,
      altitudeDeg: view.alt,
      rollDeg: 0,
      fovDeg: view.fov,
    },
    W,
    H,
  );
  const frame = horizontalFrameJ2000(julianDay(date), observer);
  const up = (v: Point3D) =>
    v[0] * frame.zenith[0] + v[1] * frame.zenith[1] + v[2] * frame.zenith[2];
  const pxPerDeg = (Math.min(W, H) / 2 / Math.tan((view.fov / 2) * D)) * D;
  const project = (v: Point3D): Point2D | null => projectVecToPhoto(TP, v);
  const visible = (v: Point3D) => (up(v) > -0.02 ? project(v) : null);
  const lines = marks.flatMap((m) =>
    m.kind === "constellation" ? constellationParts(m.label) : [],
  );
  const showMilkyWay = marks.some((m) => m.kind === "milkyWay");

  drawSky(ctx, {
    width: W,
    height: H,
    TP,
    date,
    observer,
    azimuthDeg: view.az,
    magLimit,
    lightPollution,
    groundSeed: 7,
    stars: STARS,
    compass: true,
    // 별자리 이름은 아래 이름표와 함께 자리를 찾아 단다 (drawSky는 보이는 별 가운데에 그대로 써서 겹쳤다)
    constellations: lines.length
      ? lines.map((c) => ({ ...c, label: "" }))
      : undefined,
    underlay: showMilkyWay
      ? (c, proj, glow) => {
          c.save();
          c.globalCompositeOperation = "screen";

          // 광해·달빛이 하늘을 밝히면 어두운 띠부터 묻힌다 (밝은 중심부가 가장 늦게 사라진다)
          const fade = (1 - glow) ** 2;

          for (const p of MILKY_WAY) {
            if (up(p.vector) < -0.03) continue;

            const at = proj(p.vector);
            const r = p.widthDeg * pxPerDeg;

            if (
              !at ||
              at[0] < -r ||
              at[0] > W + r ||
              at[1] < -r ||
              at[1] > H + r
            ) {
              continue;
            }

            // 지평선 가까이는 공기층에 묻혀 흐려진다
            const low = Math.min(1, Math.max(0, up(p.vector) / 0.17));
            const a =
              0.085 * p.brightness * fade * (0.45 + 0.55 * low) - 0.012 * glow;

            if (a < 0.003) continue;

            const rgb = `${Math.round(185 + 35 * p.warm)},${Math.round(195 + 10 * p.warm)},${Math.round(235 - 45 * p.warm)}`;
            const g = c.createRadialGradient(at[0], at[1], 0, at[0], at[1], r);
            g.addColorStop(0, `rgba(${rgb},${a})`);
            g.addColorStop(0.45, `rgba(${rgb},${a * 0.45})`);
            g.addColorStop(1, `rgba(${rgb},0)`);
            c.fillStyle = g;
            c.fillRect(at[0] - r, at[1] - r, 2 * r, 2 * r);
          }

          c.restore();
        }
      : undefined,
  });

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.font = "600 13px system-ui, sans-serif";

  // 이름표끼리 겹치면("두베메라크") 위·아래·왼쪽 자리를 차례로 찾아 보고, 다 겹치면 그 이름표는 뺀다.
  // 두 모양이 같은 별을 쓰면(대곡선·대삼각형의 아크투루스) 이름은 한 번만 단다
  // 고리(찾은 별·정답 자리)는 맨 나중에 그리니, 그 자리를 먼저 비워 두어 이름표가 고리에 가리지 않게 한다
  const placed: [number, number, number, number][] = rings.flatMap((r) => {
    const p = project(r.vector);

    return p
      ? [[p[0] - 24, p[1] - 24, 48, 48] as [number, number, number, number]]
      : [];
  });
  const labeled = new Set<string>();

  const label = (
    p: Point2D,
    text: string,
    color: string,
    dy = -10,
    evenQuiet = false,
  ) => {
    if ((quiet && !evenQuiet) || !text || labeled.has(text)) return;

    const w = ctx.measureText(text).width + 6;
    const spots: [number, number][] = [
      [p[0] + 6, p[1] + dy - 11],
      [p[0] + 6, p[1] + 8],
      [p[0] - w - 6, p[1] + dy - 11],
      [p[0] - w - 6, p[1] + 8],
      [p[0] - w / 2, p[1] + dy - 28],
      [p[0] - w / 2, p[1] + 24],
    ];
    const free = spots.find(
      ([x, y]) =>
        !placed.some(
          ([bx, by, bw, bh]) =>
            x < bx + bw && bx < x + w && y < by + bh && by < y + 15,
        ),
    );

    if (!free) return;

    placed.push([free[0], free[1], w, 15]);
    labeled.add(text);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(free[0], free[1], w, 15);
    ctx.fillStyle = color;
    ctx.fillText(text, free[0] + 3, free[1] + 11);
  };

  const polyline = (
    vs: Point3D[],
    color: string,
    width: number,
    dash: number[] = [],
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    let pen = false;
    let last: Point2D | null = null;

    for (const v of vs) {
      const p = visible(v);

      if (!p || (last && Math.hypot(p[0] - last[0], p[1] - last[1]) > W)) {
        pen = false;
        last = null;
        continue;
      }

      if (pen) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);

      pen = true;
      last = p;
    }

    ctx.stroke();
    ctx.setLineDash([]);
  };

  const arrowHead = (from: Point3D, to: Point3D, color: string) => {
    const a = visible(from);
    const b = visible(to);

    if (!a || !b) return;

    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(
      b[0] - 12 * Math.cos(ang - 0.4),
      b[1] - 12 * Math.sin(ang - 0.4),
    );
    ctx.lineTo(
      b[0] - 12 * Math.cos(ang + 0.4),
      b[1] - 12 * Math.sin(ang + 0.4),
    );
    ctx.closePath();
    ctx.fill();
  };

  for (const m of marks) {
    switch (m.kind) {
      case "ecliptic": {
        polyline(ECLIPTIC, COLORS.ecliptic, 1.5, [6, 6]);
        const mid = ECLIPTIC.map(visible).find(
          (p) => p && p[0] > W * 0.1 && p[0] < W * 0.4 && p[1] > 20 && p[1] < H,
        );

        if (mid) label(mid, "황도 (해의 길)", COLORS.ecliptic);
        break;
      }

      case "asterism": {
        const a = asterismById(m.id);

        for (const line of a.path) {
          polyline(line.map(hrVector), COLORS.asterism, 2.5);
        }

        const named = a.vertices
          .map((hr) => ({ hr, p: visible(hrVector(hr)) }))
          .filter(
            (x) =>
              x.p && starLabel(x.hr) && (STAR_BY_HR.get(x.hr)?.mag ?? 9) < 2.7,
          );

        for (const { hr, p } of named) {
          label(p!, starLabel(hr)!, COLORS.asterism);
        }

        break;
      }

      case "hop": {
        const from = hopStart(m);
        const to = hrVector(m.to);

        // 두 선을 늘여 만나는 점에서 출발하면, 늘인 두 선을 가는 점선으로 먼저 그린다
        if (typeof m.from !== "string") {
          const [a, , c] = m.from.meet.map(hrVector);
          polyline(hopPath(a, from, 1, 16), COLORS.hop, 1.2, [3, 4]);
          polyline(hopPath(c, from, 1, 16), COLORS.hop, 1.2, [3, 4]);
        }

        const path = hopPath(from, to, 1 + m.times, 40);
        polyline(path, COLORS.hop, 2.5, [8, 6]);
        arrowHead(path[path.length - 2], hopTip(m), COLORS.hop);
        break;
      }

      case "path": {
        const vs = m.hrs.map(hrVector);
        const dense = vs.slice(1).flatMap((b, i) => hopPath(vs[i], b, 1, 12));
        polyline(dense, COLORS.hop, 2.5, [8, 6]);
        arrowHead(dense[dense.length - 2], dense[dense.length - 1], COLORS.hop);
        break;
      }

      case "star": {
        const p = visible(hrVector(m.hr));

        if (p) {
          ctx.strokeStyle = COLORS.star;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 10, 0, 2 * Math.PI);
          ctx.stroke();
          label(p, starLabel(m.hr) ?? "", COLORS.star, -14);
        }

        break;
      }

      case "deepSky": {
        const d = deepSkyById(m.id);
        const p = visible(raDecVector(d.raDeg, d.decDeg));

        if (p) {
          const r = Math.max(12, (d.sizeDeg / 2) * pxPerDeg);
          ctx.strokeStyle = COLORS.deepSky;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(p[0], p[1], r, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.setLineDash([]);

          if (d.kind !== "암흑 성운") {
            const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
            g.addColorStop(0, "rgba(220,215,255,0.35)");
            g.addColorStop(1, "rgba(220,215,255,0)");
            ctx.fillStyle = g;
            ctx.fillRect(p[0] - r, p[1] - r, 2 * r, 2 * r);
          }

          label(
            [p[0] + r * 0.7, p[1]],
            d.name.replace(/ \(.*\)$/, ""),
            COLORS.deepSky,
            -r * 0.7,
          );
        }

        break;
      }

      case "pole": {
        const p = visible(poleVector(m.south));

        if (p) {
          ctx.strokeStyle = COLORS.pole;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p[0] - 12, p[1]);
          ctx.lineTo(p[0] + 12, p[1]);
          ctx.moveTo(p[0], p[1] - 12);
          ctx.lineTo(p[0], p[1] + 12);
          ctx.stroke();
          label(p, m.south ? "하늘의 남극" : "하늘의 북극", COLORS.pole, 18);
        }

        break;
      }

      default:
        break;
    }
  }

  for (const r of rings) {
    const p = project(r.vector);

    if (!p) continue;

    ctx.strokeStyle = r.color;
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(p[0], p[1], 22, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    if (r.label) label(p, r.label, r.color, -26);
  }

  // 별자리 이름은 맨 나중에, 보이는 별들의 가운데 둘레 빈자리에 단다 (수업이 가리키는 별 이름이 먼저다).
  // "사자자리"가 "알기에바"를 덮던 일. 찾기 문제를 푸는 동안에도 보인다 (예전 drawSky처럼)
  for (const m of marks) {
    if (m.kind !== "constellation") continue;

    const pts = constellationParts(m.label)
      .flatMap((c) => c.stars)
      .filter((v) => up(v) > 0)
      .flatMap((v) => {
        const p = project(v);

        return p && p[0] >= 0 && p[0] < W && p[1] >= 0 && p[1] < H ? [p] : [];
      });

    if (!pts.length) continue;

    const mid: Point2D = [
      pts.reduce((s, p) => s + p[0], 0) / pts.length,
      pts.reduce((s, p) => s + p[1], 0) / pts.length,
    ];
    label(mid, m.label, COLORS.constellation, -10, true);
  }

  ctx.restore();

  return TP;
};
