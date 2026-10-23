import type { AltAz } from "@/game/latitudeTrip/trip";
import type { Point2D } from "@/scripts/hash/types";
import { altAzAt, equatorialOf } from "@/game/latitudeTrip/trip";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";

// 극지방·적도 하늘 여행의 하늘 그리기. 두 가지 보기:
// - 둥근 하늘: 누워서 올려다본 하늘 (가운데 천정, 테두리 지평선, 위가 북, 왼쪽이 동) — 하늘 전체가 도는 모습
// - 한 방향 보기: 지평선을 보고 선 모습 (스테레오 투영, 가로 약 140°) — 별이 뜨고 지는 기울기
// 궤적은 지난 시각부터 지금까지 시간각을 잘게 나눠 이은 호 (장노출 사진처럼).

export const TRIP_WIDTH = 1200;
export const TRIP_HEIGHT = 800;

// 'dome' 또는 바라보는 방위(°)
export type TripView = "dome" | 0 | 90 | 180 | 270;

export interface TripFrame {
  latDeg: number;
  lstDeg: number; // 지금의 지방 항성시 (°)
  trailFromLstDeg: number | null; // 궤적을 이 항성시부터 (null이면 안 그림)
  view: TripView;
  guides: boolean; // 지평선·천구의 극·천구의 적도
  lines: boolean; // 별자리선
}

const D = Math.PI / 180;
const MAG_LIMIT = 4.6;
const TRAIL_MAG = 3.2;
const DOME_R = TRIP_HEIGHT / 2 - 34;
// 한 방향 보기: 광축 고도, 가로 반폭
const VIEW_ALT = 28;
const VIEW_HALF_DEG = 70;

// 별 목록의 적경·적위는 한 번만 구한다
let cache: {
  stars: { ra: number; dec: number; mag: number; rgb: string }[];
  lines: { ra: number; dec: number }[][];
  polaris: { ra: number; dec: number } | null;
} | null = null;

const starColor = (kelvin: number) =>
  kelvin < 3600
    ? "255,180,130"
    : kelvin < 5000
      ? "255,215,170"
      : kelvin < 6500
        ? "255,244,228"
        : kelvin < 9000
          ? "225,233,255"
          : "190,208,255";

export const tripCatalog = () => {
  if (!cache) {
    const eq = (v: [number, number, number]) => {
      const e = equatorialOf(v);

      return { ra: e.raDeg, dec: e.decDeg };
    };

    const polaris = STARS.find((s) => s.latinName === "Polaris");

    cache = {
      stars: STARS.filter((s) => s.mag <= MAG_LIMIT).map((s) => ({
        ...eq(s.vector),
        mag: s.mag,
        rgb: starColor(s.kelvin),
      })),
      lines: CONSTELLATIONS.map((c) =>
        c.stars.map((v) => eq(v as [number, number, number])),
      ),
      polaris: polaris ? eq(polaris.vector) : null,
    };
  }

  return cache;
};

// 고도·방위 → 화면 점 (보이지 않으면 null)
const projector = (view: TripView) => {
  if (view === "dome") {
    const c: Point2D = [TRIP_WIDTH / 2, TRIP_HEIGHT / 2];

    return (p: AltAz): Point2D | null => {
      if (p.altDeg < -0.5) {
        return null;
      }

      const r = ((90 - p.altDeg) / 90) * DOME_R;

      return [
        c[0] - r * Math.sin(p.azDeg * D),
        c[1] - r * Math.cos(p.azDeg * D),
      ];
    };
  }

  // 수평 좌표 (북, 동, 위) 단위 벡터
  const u = (alt: number, az: number) => [
    Math.cos(alt * D) * Math.cos(az * D),
    Math.cos(alt * D) * Math.sin(az * D),
    Math.sin(alt * D),
  ];
  const dot = (a: number[], b: number[]) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const center = u(VIEW_ALT, view);
  const right = u(0, view + 90);
  const up = [
    center[1] * right[2] - center[2] * right[1],
    center[2] * right[0] - center[0] * right[2],
    center[0] * right[1] - center[1] * right[0],
  ];
  const scale = TRIP_WIDTH / 2 / (2 * Math.tan((VIEW_HALF_DEG * D) / 2));

  return (p: AltAz): Point2D | null => {
    const v = u(p.altDeg, p.azDeg);
    const c = dot(v, center);

    if (c < -0.2) {
      return null;
    }

    const k = 2 / (1 + c);

    return [
      TRIP_WIDTH / 2 + k * dot(v, right) * scale,
      TRIP_HEIGHT / 2 - k * dot(v, up) * scale,
    ];
  };
};

export const drawTrip = (ctx: CanvasRenderingContext2D, f: TripFrame) => {
  const W = TRIP_WIDTH;
  const H = TRIP_HEIGHT;
  const project = projector(f.view);
  const at = (ra: number, dec: number, lst = f.lstDeg) =>
    altAzAt(dec, lst - ra, f.latDeg);
  const { stars, lines, polaris } = tripCatalog();
  const onScreen = (p: Point2D | null): p is Point2D =>
    !!p && p[0] > -40 && p[0] < W + 40 && p[1] > -40 && p[1] < H + 40;

  // 1) 배경: 바깥(땅·우주)은 아주 어둡고, 하늘은 남색
  ctx.fillStyle = "#04060d";
  ctx.fillRect(0, 0, W, H);

  if (f.view === "dome") {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, DOME_R);
    g.addColorStop(0, "#070d24");
    g.addColorStop(1, "#13204a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, DOME_R, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#050a1c");
    g.addColorStop(1, "#18275a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.save();

  if (f.view === "dome") {
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, DOME_R, 0, Math.PI * 2);
    ctx.clip();
  }

  // 2) 궤적: 지난 항성시부터 지금까지의 호
  if (f.trailFromLstDeg !== null) {
    const span = Math.min(360, f.lstDeg - f.trailFromLstDeg);

    if (span > 0.2) {
      const steps = Math.max(2, Math.ceil(span / 1.5));
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";

      for (const s of stars) {
        if (s.mag > TRAIL_MAG) {
          continue;
        }

        ctx.strokeStyle = `rgba(${s.rgb},${Math.min(0.85, 0.95 - s.mag * 0.18)})`;
        ctx.beginPath();
        let pen = false;

        for (let k = 0; k <= steps; k++) {
          const lst = f.lstDeg - span + (span * k) / steps;
          const p = at(s.ra, s.dec, lst);
          const q = p.altDeg > 0 ? project(p) : null;

          if (!q) {
            pen = false;
            continue;
          }

          if (pen) {
            ctx.lineTo(q[0], q[1]);
          } else {
            ctx.moveTo(q[0], q[1]);
          }

          pen = true;
        }

        ctx.stroke();
      }
    }
  }

  // 3) 길잡이: 천구의 적도, 고도 눈금
  const curve = (pts: (Point2D | null)[], maxJump = W / 2) => {
    ctx.beginPath();
    let prev: Point2D | null = null;

    for (const q of pts) {
      if (q && prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) < maxJump) {
        ctx.lineTo(q[0], q[1]);
      } else if (q) {
        ctx.moveTo(q[0], q[1]);
      }

      prev = q;
    }

    ctx.stroke();
  };

  if (f.guides) {
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "rgba(120,200,255,0.75)";
    ctx.lineWidth = 2;
    const eq: (Point2D | null)[] = [];

    for (let h = 0; h <= 360; h += 2) {
      const p = altAzAt(0, h, f.latDeg);
      eq.push(p.altDeg > -0.5 ? project(p) : null);
    }

    curve(eq);
    ctx.setLineDash([]);
  }

  // 4) 별자리선
  if (f.lines) {
    ctx.strokeStyle = "rgba(160,190,255,0.3)";
    ctx.lineWidth = 1.2;

    for (const line of lines) {
      curve(
        line.map((s) => {
          const p = at(s.ra, s.dec);

          return p.altDeg > 0 ? project(p) : null;
        }),
        W / 4,
      );
    }
  }

  // 5) 별
  for (const s of stars) {
    const p = at(s.ra, s.dec);

    if (p.altDeg <= 0) {
      continue;
    }

    const q = project(p);

    if (!onScreen(q)) {
      continue;
    }

    const r = Math.max(0.8, 3.6 - s.mag * 0.62);
    const alpha = Math.min(1, 1.15 - s.mag * 0.15);

    if (s.mag < 1.5) {
      const glow = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 4);
      glow.addColorStop(0, `rgba(${s.rgb},0.45)`);
      glow.addColorStop(1, `rgba(${s.rgb},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(q[0] - r * 4, q[1] - r * 4, r * 8, r * 8);
    }

    ctx.beginPath();
    ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${s.rgb},${alpha})`;
    ctx.fill();
  }

  // 6) 천구의 극과 북극성
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";

  if (f.guides) {
    for (const [dec, label] of [
      [90, "천구의 북극"],
      [-90, "천구의 남극"],
    ] as const) {
      const p = altAzAt(dec, 0, f.latDeg);
      const q = p.altDeg > -0.5 ? project(p) : null;

      if (!onScreen(q)) {
        continue;
      }

      ctx.strokeStyle = "rgba(255,210,90,0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(q[0] - 12, q[1]);
      ctx.lineTo(q[0] + 12, q[1]);
      ctx.moveTo(q[0], q[1] - 12);
      ctx.lineTo(q[0], q[1] + 12);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,215,110,0.95)";
      ctx.fillText(
        label,
        Math.min(W - 70, Math.max(70, q[0])),
        q[1] > H - 60 ? q[1] - 22 : q[1] + 34,
      );
    }

    if (polaris) {
      const p = at(polaris.ra, polaris.dec);
      const q = p.altDeg > 0 ? project(p) : null;

      if (onScreen(q)) {
        ctx.font = "16px Arial";
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.textAlign = "left";
        ctx.fillText("북극성", q[0] + 14, q[1] - 10);
        ctx.textAlign = "center";
      }
    }
  }

  ctx.restore();

  // 7) 땅과 지평선
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "center";

  if (f.view === "dome") {
    ctx.strokeStyle = f.guides
      ? "rgba(140,230,160,0.9)"
      : "rgba(255,255,255,0.25)";
    ctx.lineWidth = f.guides ? 3 : 1.5;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, DOME_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.85)";

    for (const [label, az] of [
      ["북", 0],
      ["동", 90],
      ["남", 180],
      ["서", 270],
    ] as const) {
      const r = DOME_R + 18;
      ctx.fillText(
        label,
        W / 2 - r * Math.sin(az * D),
        H / 2 - r * Math.cos(az * D) + 8,
      );
    }

    ctx.font = "14px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "left";
    ctx.fillText("누워서 올려다본 하늘 · 가운데가 머리 위(천정)", 16, H - 16);
    ctx.textAlign = "center";
  } else {
    const ground: Point2D[] = [];

    for (let az = f.view - 100; az <= f.view + 100; az += 1) {
      const q = project({ altDeg: 0, azDeg: az });

      if (q) {
        ground.push(q);
      }
    }

    ctx.beginPath();
    ctx.moveTo(ground[0][0], H + 10);

    for (const q of ground) {
      ctx.lineTo(q[0], q[1]);
    }

    ctx.lineTo(ground[ground.length - 1][0], H + 10);
    ctx.closePath();
    ctx.fillStyle = "#07090c";
    ctx.fill();

    if (f.guides) {
      ctx.strokeStyle = "rgba(140,230,160,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ground.forEach((q, i) =>
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]),
      );
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.85)";

    for (const [label, az] of [
      ["북", 0],
      ["북동", 45],
      ["동", 90],
      ["남동", 135],
      ["남", 180],
      ["남서", 225],
      ["서", 270],
      ["북서", 315],
    ] as const) {
      for (const turn of [-360, 0, 360]) {
        const a = az + turn;

        if (Math.abs(a - f.view) > 75) {
          continue;
        }

        const q = project({ altDeg: 0, azDeg: a });

        if (q) {
          ctx.font = az % 90 ? "16px Arial" : "bold 22px Arial";
          ctx.fillText(label, q[0], Math.min(H - 12, q[1] + 30));
        }
      }
    }
  }

  // 길잡이 이름표
  if (f.guides) {
    ctx.font = "14px Arial";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(140,230,160,0.9)";
    ctx.fillText("— 지평선", W - 16, 26);
    ctx.fillStyle = "rgba(120,200,255,0.9)";
    ctx.fillText("- - 천구의 적도", W - 16, 48);
    ctx.fillStyle = "rgba(255,215,110,0.95)";
    ctx.fillText("+ 천구의 극", W - 16, 70);
  }

  ctx.textAlign = "start";
};
