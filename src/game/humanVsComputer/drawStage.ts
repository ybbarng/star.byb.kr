import type { MatchedStar, PhotoStar } from "@/game/humanVsComputer/rounds";
import type { Point2D } from "@/scripts/hash/types";
import type { Mat3 } from "@/search/utils/similarity";
import { CONSTELLATIONS } from "@/game/sky/catalog";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 사진 위에 컴퓨터의 풀이 단계를 겹쳐 그린다. 단계마다 무엇을 그릴지는 StageView가 정한다.

export type StageView =
  | { kind: "photo" }
  // ① 별 찾기: 사진에서 찾은 별 (앞쪽이 풀이에 먼저 쓰는 별)
  | { kind: "detect"; stars: PhotoStar[] }
  // ② 모양 맞추기: 밝은 별 셋의 삼각형
  | { kind: "triangle"; stars: PhotoStar[]; triangle: MatchedStar[] }
  // ③ 확인하기: 답대로 겹친 별 지도와 만난 별
  | {
      kind: "verify";
      TP: Mat3;
      map: Point2D[];
      pairs: MatchedStar[];
      // 수평선(두 점)이 있으면 그 아래 땅에는 별 지도를 그리지 않는다
      horizon?: Point2D[];
    }
  // 반전 판의 수평선 단서 (점선: 컴퓨터가 찾은 제안, 실선: 사람이 정한 것)
  | {
      kind: "horizon";
      stars: PhotoStar[];
      line: Point2D[];
      confirmed: boolean;
    };

const circle = (ctx: CanvasRenderingContext2D, [x, y]: Point2D, r: number) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
};

export const drawStage = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  view: StageView,
) => {
  const W = image.width;
  const H = image.height;
  // 사진 크기와 상관없이 비슷한 굵기로 보이게
  const unit = Math.hypot(W, H) / 1400;
  ctx.drawImage(image, 0, 0);

  if (view.kind === "photo") {
    return;
  }

  if (view.kind === "detect" || view.kind === "horizon") {
    ctx.lineWidth = 1.6 * unit;
    view.stars.forEach((s, i) => {
      ctx.strokeStyle =
        i < 15 ? "rgba(252,165,165,0.95)" : "rgba(252,165,165,0.45)";
      circle(ctx, [s.x, s.y], (i < 15 ? 9 : 6) * unit);
    });
  }

  if (view.kind === "horizon" && view.line.length > 0) {
    ctx.strokeStyle = view.confirmed ? "#4ade80" : "rgba(125,211,252,0.95)";
    ctx.lineWidth = 3 * unit;
    ctx.setLineDash(view.confirmed ? [] : [14 * unit, 10 * unit]);

    if (view.line.length === 2) {
      // 두 점을 지나는 직선을 사진 끝까지
      const [[x0, y0], [x1, y1]] = view.line;
      const slope = (y1 - y0) / (x1 - x0 || 1e-6);
      ctx.beginPath();
      ctx.moveTo(0, y0 - slope * x0);
      ctx.lineTo(W, y0 + slope * (W - x0));
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.fillStyle = ctx.strokeStyle;

    for (const [x, y] of view.line) {
      ctx.beginPath();
      ctx.arc(x, y, 8 * unit, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (view.kind === "triangle") {
    ctx.lineWidth = 1.4 * unit;
    ctx.strokeStyle = "rgba(252,165,165,0.4)";
    view.stars.slice(0, 10).forEach((s) => circle(ctx, [s.x, s.y], 8 * unit));

    const t = view.triangle.map((m) => m.photo);
    ctx.strokeStyle = "rgba(253,224,71,0.95)";
    ctx.fillStyle = "rgba(253,224,71,0.12)";
    ctx.lineWidth = 3 * unit;
    ctx.beginPath();
    t.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    t.forEach((p) => circle(ctx, p, 12 * unit));
  }

  if (view.kind === "verify") {
    ctx.save();

    if (view.horizon?.length === 2) {
      const [[x0, y0], [x1, y1]] = view.horizon;
      const slope = (y1 - y0) / (x1 - x0 || 1e-6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, y0 + slope * (W - x0));
      ctx.lineTo(0, y0 - slope * x0);
      ctx.closePath();
      ctx.clip();
    }

    // 별자리선 전체를 흐리게 (답의 별자리는 위에서 LineReveal로 따로 그린다)
    ctx.strokeStyle = "rgba(253,230,138,0.35)";
    ctx.lineWidth = 1.4 * unit;

    for (const c of CONSTELLATIONS) {
      const pts = c.stars.map((v) => projectVecToPhoto(view.TP, v));

      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];

        if (a && b) {
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
      }
    }

    ctx.strokeStyle = "rgba(196,181,253,0.8)";
    ctx.lineWidth = 1.5 * unit;
    view.map.forEach((p) => circle(ctx, p, 7 * unit));
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 3 * unit;
    view.pairs.forEach((p) => circle(ctx, p.photo, 12 * unit));
    ctx.restore();
  }
};
