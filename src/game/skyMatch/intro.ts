import type { SkyScene } from "@/game/sky/scene";
import type {
  Dials,
  Hint,
  HintDial,
  HintStage,
} from "@/game/skyMatch/solveSteps";
import type { Point3D } from "@/scripts/hash/types";
import { makeSkyScene } from "@/game/sky/scene";
import { answerDials } from "@/game/skyMatch/match";
import {
  hintFor,
  skyClues,
  skyError,
  storyClues,
} from "@/game/skyMatch/solveSteps";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 하늘 맞추기 입문: 다이얼을 하나씩 풀어 주며 기본 개념을 익힌다.
// ① 위도 = 천구의 극 높이(하늘이 기운다) ② 시각 = 극을 중심으로 도는 하늘 ③ 날짜 = 같은 시각의 하늘이 한 달에 2시간씩 일찍 온다
// ④ 위도+시각 ⑤ 셋 다. 막히면 정답 대신 "보는 법 → 하늘 단서 → 가야 할 쪽 → 다이얼 구간" 순서로 힌트를 준다.

export type DialKey = "lat" | "day" | "minutes";

export interface Lesson {
  title: string;
  free: DialKey[]; // 이 라운드에서 돌릴 수 있는 다이얼 (나머지는 정답으로 맞춰 둔다)
  concept: string; // 라운드를 시작할 때 보여 줄 안내
  look: string; // 힌트 1: 어디를 보면 되는지
}

export const LESSONS: Lesson[] = [
  {
    title: "위도는 하늘을 기울여요",
    free: ["lat"],
    concept:
      "천구의 북극(북극성 근처)은 지평선에서 꼭 위도만큼 떠 있어요. 위도 다이얼만 돌려 하늘의 기울기를 맞춰 보세요.",
    look: "북극성 높이를 보세요. 위도를 올리면 북극성(하늘 전체 뷰의 ★)이 높아지고, 내리면 낮아져요.",
  },
  {
    title: "시각은 하늘을 돌려요",
    free: ["minutes"],
    concept:
      "시간이 흐르면 하늘 전체가 북극성을 중심으로 돌아요. 한 시간에 15°, 하루에 한 바퀴예요. 시각 다이얼만 돌려 보세요.",
    look: "밝은 별 하나를 골라 그 별의 고리를 보세요. 시각을 돌리면 별이 북극성 둘레로 원을 그리며 움직여요.",
  },
  {
    title: "날짜는 계절 별자리를 바꿔요",
    free: ["day"],
    concept:
      "같은 시각에 보면 하늘이 하루에 4분, 한 달에 2시간씩 일찍 와요. 그래서 계절마다 저녁 별자리가 달라요. 날짜 다이얼만 돌려 보세요.",
    look: "날짜를 한 달 옮기면 시각 다이얼을 2시간 돌린 만큼 하늘이 돌아요. 크게 옮긴 다음 조금씩 맞춰 보세요.",
  },
  {
    title: "기울이고 돌리기",
    free: ["lat", "minutes"],
    concept:
      "이제 두 다이얼을 함께 써요. 먼저 위도로 북극성 높이를 맞추고, 그다음 시각으로 하늘을 돌려 보세요.",
    look: "위도부터 맞춰요. 하늘 전체 뷰의 ★ 높이가 맞으면 그다음은 시각만 돌리면 돼요.",
  },
  {
    title: "셋 다",
    free: ["lat", "day", "minutes"],
    concept:
      "마지막이에요. 날짜와 시각은 서로 바꿔 쓸 수 있어서 정답이 여러 개예요. 날짜는 아무 날로 두고 위도와 시각만 맞춰도 돼요.",
    look: "날짜는 그대로 두세요. 위도로 북극성 높이를 맞추고, 시각으로 하늘을 돌리면 돼요.",
  },
];

// 잠긴 다이얼을 기존 힌트·끌기 함수의 말로 ("time"은 날짜·시각 둘 다 잠김)
export const lockedFor = (free: DialKey[]): HintDial | null =>
  !free.includes("lat")
    ? free.includes("minutes")
      ? "lat"
      : "time"
    : free.includes("minutes")
      ? null
      : "time";

// 입문 문제: 개념이 잘 보이는 하늘만 고른다 — 북반구 중위도(북극성이 지평선 위),
// 첫 라운드는 북극성이 사진 안에 보이게 북쪽을 바라본 하늘
const fits = (scene: SkyScene, lesson: number) => {
  const lat = scene.observer.latDeg;

  if (lat < 20 || lat > 55) {
    return false;
  }

  if (lesson !== 0) {
    return true;
  }

  const pole = projectVecToPhoto(scene.TP, [0, 0, 1]);

  return (
    pole !== null &&
    pole[0] > scene.width * 0.15 &&
    pole[0] < scene.width * 0.85 &&
    pole[1] > scene.height * 0.1
  );
};

export const introScene = (seed: number, lesson: number): SkyScene => {
  for (let s = seed; s < seed + 5000; s++) {
    const scene = makeSkyScene(s, "easy");

    if (fits(scene, lesson)) {
      return scene;
    }
  }

  return makeSkyScene(seed, "easy");
};

const wrapMinutes = (m: number) => ((m % 1440) + 1440) % 1440;

// 라운드를 시작할 때의 다이얼: 돌릴 다이얼만 정답에서 떼어 놓는다
export const introStartDials = (scene: SkyScene, lesson: number): Dials => {
  const a = answerDials(scene);
  const free = LESSONS[lesson].free;
  const latOff = 20 + (scene.seed % 11);
  const lat = Math.round(a.latDeg);
  const dayOff = 60 + (scene.seed % 31);
  const minOff = (3 + (scene.seed % 3)) * 60 * (scene.seed % 2 ? 1 : -1);

  return {
    latDeg: free.includes("lat")
      ? lat + latOff <= 70
        ? lat + latOff
        : lat - latOff
      : lat,
    dayOfYear: free.includes("day")
      ? a.dayOfYear + dayOff <= 364
        ? a.dayOfYear + dayOff
        : a.dayOfYear - dayOff
      : a.dayOfYear,
    minutes: free.includes("minutes")
      ? Math.round(wrapMinutes(a.minutes + minOff) / 5) * 5
      : a.minutes,
  };
};

export type IntroHint = Omit<Hint, "dial"> & { dial?: DialKey };

// 기존 힌트의 다이얼 이름을 입문 다이얼 이름으로
export const toIntroHint = (hint: Hint): IntroHint => ({
  ...hint,
  dial: hint.dial === "time" ? "minutes" : hint.dial,
});

// 입문 힌트: 1 보는 법 → 2 하늘 단서 → 3 별이 가야 할 쪽 → 4 다이얼 구간. 정답을 바로 주지 않는다
export const introHint = (
  scene: SkyScene,
  dials: Dials,
  lesson: number,
  stage: HintStage,
  landmark?: { name: string; vector: Point3D },
): IntroHint => {
  const { free, look } = LESSONS[lesson];
  const locked = lockedFor(free);
  const dayOnly = free.length === 1 && free[0] === "day";

  if (stage === 1) {
    return { stage, texts: [look], arrows: false };
  }

  if (stage === 2) {
    const sky = skyClues(scene, locked, landmark);

    return {
      stage,
      arrows: false,
      texts:
        lesson === 0
          ? [
              `북극성은 지평선에서 약 ${Math.round(scene.observer.latDeg / 5) * 5}° 높이에 있어요. 위도도 그만큼이에요.`,
            ]
          : dayOnly
            ? [
                `${storyClues(scene, "lat")[0]} 그 계절 근처의 날짜를 찾아보세요.`,
              ]
            : // 이름 있는 밝은 별이 없으면 계절·밤 시각 이야기로
              sky.length > 0
              ? sky
              : storyClues(scene, "lat"),
    };
  }

  if (!dayOnly) {
    // 위도와 시각을 함께 돌리는 라운드: 안내대로 위도부터 (위도가 거의 맞으면 그다음 시각)
    const order: HintDial | null =
      free.includes("lat") && free.includes("minutes")
        ? Math.abs(skyError(scene, dials).latDeg) >= 2
          ? "time"
          : "lat"
        : locked;

    return toIntroHint(hintFor(scene, dials, stage, order, landmark));
  }

  // 날짜만 돌리는 라운드: 시각이 정답에 맞춰져 있으니 정답 날짜가 하나다
  const target = answerDials(scene).dayOfYear;

  return stage === 3
    ? {
        stage,
        dial: "day",
        arrows: true,
        texts: [
          dials.dayOfYear < target
            ? "날짜를 더 뒤로(오른쪽으로) 옮겨 보세요."
            : "날짜를 더 앞으로(왼쪽으로) 옮겨 보세요.",
        ],
      }
    : {
        stage,
        dial: "day",
        arrows: true,
        texts: [
          "날짜는 반짝이는 구간 어딘가예요. − + 단추로 하루씩 옮겨 보세요.",
        ],
        target: { center: target, halfWidth: 12 },
      };
};

// 같은 시각에 날짜를 하루 옮기면 하늘이 도는 만큼 (분): 끌기로 얻은 시각 변화를 날짜로 바꿀 때 쓴다
export const MINUTES_PER_DAY_SHIFT = 1436.07 / 365.2422;

export const minutesToDays = (deltaMinutes: number) =>
  Math.round(
    (((((deltaMinutes + 720) % 1440) + 1440) % 1440) - 720) /
      MINUTES_PER_DAY_SHIFT,
  );
