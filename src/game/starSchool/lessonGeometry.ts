import type {
  Lesson,
  LessonStep,
  Mark,
  TapTarget,
} from "@/game/starSchool/lessons";
import type { Point3D } from "@/scripts/hash/types";
import { constellationCenter, constellationParts } from "@/game/sky/catalog";
import { asterismById } from "@/game/starSchool/asterisms";
import { deepSkyById } from "@/game/starSchool/deepSky";
import {
  dateAt,
  hrVector,
  normalize,
  raDecVector,
} from "@/game/starSchool/skyMath";

// 수업 하늘의 기하: 표시(mark)가 가리키는 하늘 방향들, 징검다리 화살표의 끝, 눌러 찾을 자리.

// a에서 b 쪽 큰 원을 따라, a–b 각거리의 times배만큼 간 점
export const hopEnd = (a: Point3D, b: Point3D, times: number): Point3D => {
  const cos = Math.max(
    -1,
    Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
  );
  const ang = Math.acos(cos);
  const perp = normalize(b.map((c, i) => c - cos * a[i]));
  const t = ang * times;

  return normalize(a.map((c, i) => Math.cos(t) * c + Math.sin(t) * perp[i]));
};

// 화살표를 그릴 점들 (큰 원 위를 잘게)
export const hopPath = (a: Point3D, b: Point3D, times: number, steps = 24) =>
  Array.from({ length: steps + 1 }, (_, i) =>
    hopEnd(a, b, (times * i) / steps),
  );

// 징검다리 화살표의 끝: from → to를 지나 to 너머로 times배 더
export const hopTip = (m: { from: string; to: string; times: number }) =>
  hopEnd(hrVector(m.from), hrVector(m.to), 1 + m.times);

export const poleVector = (south: boolean): Point3D => [0, 0, south ? -1 : 1];

export const tapVector = (t: TapTarget): Point3D =>
  "hr" in t
    ? hrVector(t.hr)
    : "deepSky" in t
      ? (() => {
          const d = deepSkyById(t.deepSky);

          return raDecVector(d.raDeg, d.decDeg);
        })()
      : poleVector(t.pole === "south");

// 이 표시가 하늘에서 차지하는 대표 방향들 (카메라를 맞추고, "떠 있나"를 확인하는 데 쓴다).
// 별자리는 전부 말고 가운데만 (전갈 꼬리처럼 우리나라에서 늘 낮은 별이 있어서)
export const markVectors = (m: Mark): Point3D[] => {
  switch (m.kind) {
    case "asterism":
      return asterismById(m.id).vertices.map(hrVector);
    case "constellation":
      return [constellationCenter(constellationParts(m.label))];
    case "star":
      return [hrVector(m.hr)];

    case "deepSky": {
      const d = deepSkyById(m.id);

      return [raDecVector(d.raDeg, d.decDeg)];
    }

    case "hop":
      return [hrVector(m.from), hopTip(m)];
    case "path":
      return m.hrs.map(hrVector);
    case "pole":
      return [poleVector(m.south)];
    default:
      return [];
  }
};

export const stepVectors = (step: LessonStep): Point3D[] => [
  ...step.marks.flatMap(markVectors),
  ...(step.tap ? [tapVector(step.tap.target)] : []),
];

// 표시가 없는 단계(여는 말 등)는 가장 가까운 뒤 단계(없으면 앞 단계)가 보는 쪽을 본다.
// 기본 방향(남쪽)을 보면 "북쪽 하늘이에요"라는 말과 화면이 어긋난다
export const aimFallback = (
  lesson: Lesson,
  idx: number,
): Point3D[] | undefined => {
  if (stepVectors(lesson.steps[idx]).length > 0) {
    return undefined;
  }

  const order = [
    ...lesson.steps.slice(idx + 1),
    ...lesson.steps.slice(0, idx).reverse(),
  ];
  const near = order.find((s) => stepVectors(s).length > 0);

  return near ? stepVectors(near) : undefined;
};

export const stepDate = (lesson: Lesson, step: LessonStep) =>
  dateAt(lesson.place, step.time ?? lesson.time);
