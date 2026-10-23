import type { WanderProblem } from "@/game/wanderers/wanderers";
import type { Point2D } from "@/scripts/hash/types";
import { CONSTELLATIONS, STARS } from "@/game/sky/catalog";
import { projectField } from "@/game/wanderers/wanderers";

// 떠돌이별 찾기의 별 지도 한 장: 별(등급에 따라 크기, 표면 온도에 따라 색)과 그날의 행성·혜성.
// 위가 북쪽, 왼쪽이 동쪽 (하늘을 올려다본 모습). 풀이 화면에서는 자취·별자리선을 겹쳐 그린다.

export interface DrawFieldOptions {
  problem: WanderProblem;
  frameIndex: number;
  reveal: boolean; // 풀이: 자취·별자리선·이름
  hint?: { x: number; y: number; r: number }; // 이 둘레 어딘가에 있다
  misses: Point2D[]; // 틀리게 누른 자리
}

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

// 밝기 여유(보이는 한계보다 몇 등급 밝은지)에 따라 크기·빛번짐이 커지는 점
const drawPoint = (
  ctx: CanvasRenderingContext2D,
  [x, y]: Point2D,
  headroom: number,
  rgb: string,
) => {
  const h = Math.min(7, Math.max(0, headroom));
  const core = 0.8 + h * 0.5;
  const alpha = Math.min(1, 0.35 + h * 0.35);

  if (h > 2) {
    const r = core * 4;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, `rgba(${rgb},${alpha * 0.5})`);
    glow.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  ctx.beginPath();
  ctx.arc(x, y, core, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb},${alpha})`;
  ctx.fill();
};

const inside = (p: Point2D | null, W: number, H: number, pad = 20) =>
  p !== null && p[0] > -pad && p[0] < W + pad && p[1] > -pad && p[1] < H + pad;

export const drawField = (
  ctx: CanvasRenderingContext2D,
  o: DrawFieldOptions,
) => {
  const { problem, frameIndex } = o;
  const { view } = problem;
  const W = view.width;
  const H = view.height;
  const project = (v: [number, number, number]) => projectField(view, v);

  // 1) 하늘
  const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.75);
  bg.addColorStop(0, "rgb(10,14,32)");
  bg.addColorStop(1, "rgb(3,5,14)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 2) 별자리선 (풀이)
  if (o.reveal) {
    ctx.strokeStyle = "rgba(250,220,80,0.35)";
    ctx.lineWidth = 1.2;
    const labels = new Map<string, { n: number; x: number; y: number }>();

    for (const c of CONSTELLATIONS) {
      const pts = c.stars.map((v) => project(v as [number, number, number]));

      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];

        if (!a || !b || !inside(a, W, H, W) || !inside(b, W, H, W)) {
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }

      for (const p of pts) {
        if (p && inside(p, W, H, -30)) {
          const l = labels.get(c.label) ?? { n: 0, x: 0, y: 0 };
          labels.set(c.label, { n: l.n + 1, x: l.x + p[0], y: l.y + p[1] });
        }
      }
    }

    ctx.fillStyle = "rgba(250,220,80,0.7)";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";

    for (const [text, { n, x, y }] of labels) {
      ctx.fillText(text, x / n, y / n + 24);
    }

    ctx.textAlign = "start";
  }

  // 3) 별
  for (const s of STARS) {
    if (s.mag > problem.magLimit) {
      continue;
    }

    const p = project(s.vector);

    if (inside(p, W, H)) {
      drawPoint(ctx, p!, problem.magLimit - s.mag + 0.4, starColor(s.kelvin));
    }
  }

  // 4) 자취 (풀이): 하루 간격 선 + 장마다 번호
  if (o.reveal) {
    ctx.strokeStyle = "rgba(120,220,255,0.75)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    let started = false;

    for (const v of problem.path) {
      const p = project(v);

      if (!p) {
        started = false;
        continue;
      }

      if (started) {
        ctx.lineTo(p[0], p[1]);
      } else {
        ctx.moveTo(p[0], p[1]);
        started = true;
      }
    }

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "bold 15px sans-serif";

    problem.frames.forEach((f, k) => {
      const p = project(f.target);

      if (!p) {
        return;
      }

      ctx.beginPath();
      ctx.arc(p[0], p[1], 9, 0, Math.PI * 2);
      ctx.strokeStyle =
        k === frameIndex ? "rgba(255,230,120,1)" : "rgba(120,220,255,0.8)";
      ctx.lineWidth = k === frameIndex ? 2.5 : 1.5;
      ctx.stroke();
      ctx.fillStyle = "rgba(160,230,255,0.95)";
      ctx.fillText(String(k + 1), p[0] + 11, p[1] - 9);
    });
  }

  // 5) 이 장의 떠돌이별
  const frame = problem.frames[frameIndex];
  const head = project(frame.target);

  if (head && problem.kind === "comet" && frame.tail) {
    const end = project(frame.tail);

    if (end) {
      // 꼬리: 머리에서 해 반대쪽으로 점점 흐려지는 부채꼴
      let dx = end[0] - head[0];
      let dy = end[1] - head[1];
      const len = Math.hypot(dx, dy);
      const maxLen = W * 0.3;

      if (len > maxLen) {
        dx *= maxLen / len;
        dy *= maxLen / len;
      }

      const L = Math.max(12, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(head[0], head[1]);
      ctx.rotate(ang);
      const tail = ctx.createLinearGradient(0, 0, L, 0);
      tail.addColorStop(0, `rgba(${problem.color},0.55)`);
      tail.addColorStop(1, `rgba(${problem.color},0)`);
      ctx.fillStyle = tail;
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(L, -L * 0.12);
      ctx.lineTo(L, L * 0.12);
      ctx.lineTo(0, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const coma = ctx.createRadialGradient(
      head[0],
      head[1],
      0,
      head[0],
      head[1],
      7,
    );
    coma.addColorStop(0, `rgba(${problem.color},0.95)`);
    coma.addColorStop(1, `rgba(${problem.color},0)`);
    ctx.fillStyle = coma;
    ctx.fillRect(head[0] - 7, head[1] - 7, 14, 14);
  } else if (head) {
    // 아주 어두운 행성(천왕성)도 가장 어두운 별만큼은 보이게
    drawPoint(
      ctx,
      head,
      Math.max(0.4, problem.magLimit - problem.targetMag + 0.4),
      problem.color,
    );
  }

  if (o.reveal && head) {
    ctx.fillStyle = "rgba(255,230,120,1)";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(problem.name, head[0] + 14, head[1] + 22);
  }

  // 6) 힌트·틀린 자리
  if (o.hint) {
    ctx.beginPath();
    ctx.arc(o.hint.x, o.hint.y, o.hint.r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,210,90,0.6)";
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = "rgba(255,90,90,0.85)";
  ctx.lineWidth = 2.5;

  for (const [x, y] of o.misses) {
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 7);
    ctx.lineTo(x + 7, y + 7);
    ctx.moveTo(x + 7, y - 7);
    ctx.lineTo(x - 7, y + 7);
    ctx.stroke();
  }

  // 7) 방향·시야
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("북 ↑", W / 2, 26);
  ctx.fillText("남 ↓", W / 2, H - 12);
  ctx.textAlign = "left";
  ctx.fillText("← 동", 10, H / 2);
  ctx.textAlign = "right";
  ctx.fillText("서 →", W - 10, H / 2);
  ctx.textAlign = "left";
  ctx.font = "14px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(`시야 ${Math.round(view.fovDeg)}°`, 10, H - 12);
  ctx.textAlign = "start";
};
