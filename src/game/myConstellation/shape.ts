import type { Point3D } from "@/scripts/hash/types";
import { STARS } from "@/game/sky/catalog";

// 나만의 별자리: 별을 눌러 이은 선(획)들. 별은 카탈로그 번호(HR)로 적는다 — 주소·저장에 그대로 쓴다.
// 획 하나는 이어 그린 별 순서다 ([a, b, c]면 a-b, b-c 두 선). 펜을 떼면 다음 별부터 새 획이 된다.

export interface Shape {
  strokes: string[][];
  open: boolean; // 마지막 획에 펜이 아직 닿아 있는지 (다음 별을 누르면 이어진다)
}

export const EMPTY_SHAPE: Shape = { strokes: [], open: false };

// 너무 큰 별자리는 그리기·주소가 버거워서 별 수를 묶어 둔다
export const MAX_STARS = 40;
export const MAX_NAME = 20;

export const STAR_BY_HR = new Map(STARS.map((s) => [s.hr, s]));

// 별 하나를 눌렀을 때: 펜이 닿아 있으면 잇고, 방금 그 별을 다시 누르면 펜을 뗀다. 펜이 떨어져 있으면 새 획을 시작한다
export const tapStar = (shape: Shape, hr: string): Shape => {
  const last = shape.strokes[shape.strokes.length - 1];

  if (shape.open && last) {
    if (last[last.length - 1] === hr) {
      return { strokes: shape.strokes, open: false };
    }

    // 바로 앞 선을 거꾸로 되짚는 건 같은 선이라 펜만 옮긴다
    if (last.length >= 2 && last[last.length - 2] === hr) {
      return {
        strokes: [...shape.strokes.slice(0, -1), [...last, hr]],
        open: true,
      };
    }

    if (!starsOf(shape).includes(hr) && starsOf(shape).length >= MAX_STARS) {
      return shape;
    }

    return {
      strokes: [...shape.strokes.slice(0, -1), [...last, hr]],
      open: true,
    };
  }

  if (!starsOf(shape).includes(hr) && starsOf(shape).length >= MAX_STARS) {
    return shape;
  }

  return { strokes: [...shape.strokes, [hr]], open: true };
};

// 펜 떼기: 별 하나만 찍힌 획은 선이 없으니 지운다 (그 별이 다른 선에 쓰였으면 그대로 남는다)
export const liftPen = (shape: Shape): Shape => ({
  strokes: shape.strokes.filter(
    (s, i) => s.length > 1 || i !== shape.strokes.length - 1,
  ),
  open: false,
});

// 서로 다른 별들 (처음 나온 순서)
export const starsOf = (shape: Pick<Shape, "strokes">): string[] => [
  ...new Set(shape.strokes.flat()),
];

// 서로 다른 선들 (a-b와 b-a는 같은 선)
export const edgesOf = (shape: Pick<Shape, "strokes">): [string, string][] => {
  const seen = new Set<string>();
  const out: [string, string][] = [];

  for (const s of shape.strokes) {
    for (let i = 0; i + 1 < s.length; i++) {
      const [a, b] = [s[i], s[i + 1]];

      if (a === b) {
        continue;
      }

      const key = a < b ? `${a}|${b}` : `${b}|${a}`;

      if (!seen.has(key)) {
        seen.add(key);
        out.push([a, b]);
      }
    }
  }

  return out;
};

// 별자리로 칠 만한지: 선이 하나 이상
export const isComplete = (shape: Pick<Shape, "strokes">) =>
  edgesOf(shape).length > 0;

export const vectorsOf = (shape: Pick<Shape, "strokes">): Point3D[] =>
  starsOf(shape)
    .map((hr) => STAR_BY_HR.get(hr)?.vector)
    .filter((v): v is Point3D => !!v);

// ── 주소(쿼리)에 담기: 획은 "_", 별은 "-"로 잇는다 (예: 1713-1790-2061_1903-1948) ──

export const encodeStrokes = (shape: Pick<Shape, "strokes">) =>
  shape.strokes
    .filter((s) => s.length > 1)
    .map((s) => s.join("-"))
    .join("_");

// 모르는 별 번호는 건너뛰고, 그래서 끊긴 곳은 획을 나눈다
export const decodeStrokes = (text: string): Shape => {
  const strokes: string[][] = [];
  let count = 0;

  for (const part of text.split("_")) {
    let cur: string[] = [];

    for (const hr of part.split("-")) {
      const known = /^\d{1,4}$/.test(hr) && STAR_BY_HR.has(hr);

      if (known && count < MAX_STARS * 3) {
        cur.push(hr);
        count++;
      } else if (cur.length) {
        strokes.push(cur);
        cur = [];
      }
    }

    if (cur.length) {
      strokes.push(cur);
    }
  }

  const shape = { strokes: strokes.filter((s) => s.length > 1), open: false };

  // 별 수 제한을 넘는 주소는 앞쪽 획만 받는다
  while (starsOf(shape).length > MAX_STARS) {
    shape.strokes.pop();
  }

  return shape;
};

// 이름 다듬기: 앞뒤 공백·줄바꿈을 지우고 길이를 자른다
export const cleanName = (name: string) =>
  name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
