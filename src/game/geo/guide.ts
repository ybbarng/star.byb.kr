import type { GeoProblem } from "@/game/geo/problem";
import type { Point3D } from "@/scripts/hash/types";
import { explain } from "@/game/geo/problem";
import { constellationParts, STARS, uniqueStars } from "@/game/sky/catalog";
import { horizontalFrameJ2000, julianDay } from "@/search/utils/ephemeris";

// SkyGuessr 입문의 길잡이: 정답을 바로 알려 주지 않고, 질문을 하나씩 던져 사람이 하늘에서 단서를 직접 찾게 한다.
// 위도(반구 → 천구의 극 → 극의 높이) 다음 경도(저녁·한밤·새벽 → 한가운데 별자리) 순서로, 찾은 단서는 수첩에 모은다.
// 문제마다 그 하늘에서 실제로 보이는 별자리만 고른다 (지평선 위 8° 이상).

const D = Math.PI / 180;
const MIN_ALT_DEG = 8;

export interface GuideChoice {
  label: string;
  correct: boolean;
  reply: string; // 고른 뒤 길잡이의 말
}

export interface GuideTarget {
  vectors: Point3D[]; // 이 중 하나 근처를 누르면 찾은 것
  toleranceDeg: number;
  lines?: string; // 찾은 뒤 하늘에 그릴 별자리 (catalog 라벨)
}

export interface GuideStep {
  say: string;
  choices?: GuideChoice[]; // 고르는 질문 (맞는 걸 고를 때까지)
  target?: GuideTarget; // 하늘에서 찾아 누르기
  found?: string; // 찾았을 때의 말
  help?: string; // "못 찾겠어요"를 누르면: 그쪽으로 하늘을 돌리고 이 말을 보인다
  clue?: string; // 이 단계를 마치면 수첩에 적는 단서
}

const DIPPER_HRS = ["4301", "4295", "4554", "4660", "4905", "5054", "5191"];
const CASSIOPEIA_HRS = ["21", "168", "264", "403", "542"];
const CRUX_HRS = ["4730", "4853", "4763", "4656"];
const POLARIS_HR = "424";
const CENTAURUS_HRS = ["5459", "5267"];
const CANOPUS_HR = "2326";
const ACHERNAR_HR = "472";

// 받침에 따라 조사를 고른다 (을/를, 이/가)
const josa = (word: string, withB: string, withoutB: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;

  return word + (code >= 0 && code < 11172 && code % 28 > 0 ? withB : withoutB);
};

const vectorsOf = (hrs: string[]) =>
  hrs
    .map((hr) => STARS.find((s) => s.hr === hr)?.vector as Point3D | undefined)
    .filter((v): v is Point3D => !!v);

// 이 문제의 하늘에서 고도·방위 (J2000 기준)
const altAzIn = (p: GeoProblem) => {
  const f = horizontalFrameJ2000(julianDay(p.date), p.observer);
  const dot = (a: Point3D, b: Point3D) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  return (v: Point3D) => ({
    altDeg: Math.asin(Math.max(-1, Math.min(1, dot(f.zenith, v)))) / D,
    azDeg: (Math.atan2(dot(f.east, v), dot(f.north, v)) / D + 360) % 360,
  });
};

const visible = (p: GeoProblem, vs: Point3D[]) => {
  const at = altAzIn(p);

  return vs.length > 0 && vs.every((v) => at(v).altDeg >= MIN_ALT_DEG);
};

const DIRECTION = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
export const directionOf = (azDeg: number) =>
  DIRECTION[Math.round(azDeg / 45) % 8];

export const altAzOfTarget = (p: GeoProblem, v: Point3D) => altAzIn(p)(v);

export const buildGuide = (p: GeoProblem): GuideStep[] => {
  const north = p.observer.latDeg >= 0;
  const lat = Math.abs(p.observer.latDeg);
  const ex = explain(p);
  const at = altAzIn(p);
  const steps: GuideStep[] = [];
  const hemi = north ? "북반구" : "남반구";

  steps.push({
    say: "먼저 위도부터 볼게요. 이 하늘은 북반구일까요, 남반구일까요? 감으로 골라 보세요. 바로 확인하러 갈 거예요.",
    choices: [
      {
        label: "북반구",
        correct: true,
        reply: north
          ? "좋아요. 정말 그런지 하늘에서 확인해 봐요."
          : "그럴 수도 있어요. 하늘에서 확인해 봐요.",
      },
      {
        label: "남반구",
        correct: true,
        reply: north
          ? "그럴 수도 있어요. 하늘에서 확인해 봐요."
          : "좋아요. 정말 그런지 하늘에서 확인해 봐요.",
      },
    ],
  });

  // 반구를 알려 주는 별자리: 북쪽은 북두칠성·카시오페이아, 남쪽은 남십자 (보이는 것 중 먼저)
  const marks = north
    ? [
        {
          name: "북두칠성",
          vs: vectorsOf(DIPPER_HRS),
          lines: "큰곰자리",
          how: "국자 모양 일곱 별",
        },
        {
          name: "카시오페이아",
          vs: vectorsOf(CASSIOPEIA_HRS),
          lines: "카시오페이아자리",
          how: "W 모양 다섯 별",
        },
        {
          name: "북극성",
          vs: vectorsOf([POLARIS_HR]),
          how: "북쪽 하늘에 홀로 있는 2등급 별",
        },
      ]
    : [
        {
          name: "남십자",
          vs: vectorsOf(CRUX_HRS),
          lines: "남십자자리",
          how: "작은 십자 모양 네 별",
        },
        {
          name: "켄타우루스의 두 별",
          vs: vectorsOf(CENTAURUS_HRS),
          lines: "켄타우루스자리",
          how: "나란히 붙은 아주 밝은 두 별",
        },
        {
          name: "카노푸스",
          vs: vectorsOf([CANOPUS_HR]),
          how: "하늘에서 두 번째로 밝은 별",
        },
        {
          name: "아케르나르",
          vs: vectorsOf([ACHERNAR_HR]),
          how: "주변에 홀로 밝은 별",
        },
      ];
  const mark = marks.find((m) => visible(p, m.vs));

  if (mark) {
    const dir = directionOf(at(mark.vs[0]).azDeg);

    steps.push({
      say: `${hemi}에서만 잘 보이는 별이 있어요. ${north ? "북쪽" : "남쪽"} 하늘을 둘러보며 ${mark.name}(${mark.how})${josa(mark.name, "을", "를").slice(mark.name.length)} 찾아 눌러 볼래요?`,
      target: { vectors: mark.vs, toleranceDeg: 3, lines: mark.lines },
      found: `찾았어요! ${josa(mark.name, "이", "가")} ${north ? "북쪽" : "남쪽"} 하늘에 보이니 ${hemi}예요.`,
      help: `${dir}쪽 하늘에 있어요. 하늘을 그쪽으로 돌려 둘게요.`,
      clue: `${hemi} — ${josa(mark.name, "이", "가")} 보여요`,
    });
  } else {
    steps.push({
      say: `이 하늘은 ${hemi}예요. 다만 ${hemi}를 알려 주는 별들이 지금은 지평선 가까이나 아래에 있어서, 이번엔 바로 알려 드릴게요.`,
      clue: hemi,
    });
  }

  // 천구의 극 찾기
  const pole: Point3D = north
    ? (vectorsOf([POLARIS_HR])[0] ?? [0, 0, 1])
    : [0, 0, -1];
  const poleAlt = at(pole).altDeg;

  if (poleAlt >= 3) {
    const howTo = north
      ? mark?.name === "카시오페이아"
        ? "카시오페이아 W의 가운데에서 W가 벌어진 반대쪽으로 W 폭의 두 배쯤 가면 북극성이 있어요."
        : mark?.name === "북극성"
          ? "방금 찾은 북극성 바로 곁이 천구의 북극이에요. 북극성을 한 번 더 눌러 보세요."
          : "북두칠성 국자 끝 두 별(메라크 → 두베)을 이어 다섯 배쯤 늘린 곳에 북극성이 있어요."
      : mark?.name === "남십자"
        ? "남십자의 긴 막대(가크룩스 → 아크룩스)를 네 배 반쯤 늘린 곳 근처가 천구의 남극이에요. 그 근처엔 밝은 별이 없어요."
        : "천구의 남극은 밝은 별이 없는 빈 자리예요. 남쪽 하늘에서 별들이 도는 원의 중심이라, 타임랩스 힌트를 켜면 궤적이 휘는 중심으로 보여요.";

    steps.push({
      say: `별들은 하룻밤 동안 천구의 ${north ? "북극" : "남극"}을 중심으로 돌아요. ${howTo} 그 자리를 눌러 보세요.`,
      target: { vectors: [pole], toleranceDeg: north ? 3 : 6 },
      found: north
        ? "맞아요, 북극성이에요. 천구의 북극은 바로 이 곁이에요."
        : "맞아요, 그 근처가 천구의 남극이에요.",
      help: `${directionOf(at(pole).azDeg)}쪽 하늘에 있어요. 하늘을 그쪽으로 돌려 둘게요.`,
      clue: `천구의 ${north ? "북극" : "남극"} 자리를 찾았어요`,
    });

    // 극의 높이 = 위도 (구간으로만)
    const bands = [
      { label: "지평선 가까이 (0~20°)", lo: 0, hi: 20 },
      { label: "중간쯤 (20~40°)", lo: 20, hi: 40 },
      { label: "꽤 높이 (40° 넘게)", lo: 40, hi: 90 },
    ];
    const band = bands.find((b) => lat < b.hi) ?? bands[2];
    const latWord = north ? "북위" : "남위";

    steps.push({
      say: "그 극은 지평선에서 얼마나 높이 떠 있나요? 극을 화면 가운데로 옮기면 오른쪽 위에 '화면 가운데 고도'가 보여요.",
      choices: bands.map((b) => ({
        label: b.label,
        correct: b === band,
        reply:
          b === band
            ? `맞아요. 극의 높이가 곧 위도라서, 이곳은 ${latWord} ${b.lo}~${b.hi === 90 ? 62 : b.hi}° 사이예요.`
            : "다시 볼까요? 극을 화면 가운데로 옮기고 고도 숫자를 읽어 보세요.",
      })),
      clue: `위도: ${latWord} ${band.lo}~${band.hi === 90 ? 62 : band.hi}° 사이`,
    });
  } else {
    steps.push({
      say: `천구의 ${north ? "북극" : "남극"}이 지평선에 거의 붙어 있어요. 극의 높이가 곧 위도라서, 이곳은 적도에 가까워요.`,
      clue: "위도: 적도 근처",
    });
  }

  // 경도: 현지 시각부터
  const timeClue =
    ex.skyTime === "dusk"
      ? "현지 시각: 해 진 지 얼마 안 된 저녁"
      : ex.skyTime === "dawn"
        ? "현지 시각: 동트기 전 새벽"
        : "현지 시각: 한밤";

  steps.push({
    say: "이제 경도예요. 경도는 그곳이 지금 몇 시인지로 찾아요. 서쪽과 동쪽 지평선을 둘러보세요. 그곳은 저녁일까요, 한밤일까요, 새벽일까요?",
    choices: (
      [
        ["저녁 (서쪽에 노을)", "dusk"],
        ["한밤 (사방이 어두움)", "night"],
        ["새벽 (동쪽이 밝아 옴)", "dawn"],
      ] as const
    ).map(([label, key]) => ({
      label,
      correct: key === ex.skyTime,
      reply:
        key === ex.skyTime
          ? key === "night"
            ? "맞아요, 한밤이에요. 한밤에는 하늘 한가운데 별자리로 시각을 읽어요."
            : `맞아요. ${key === "dusk" ? "해가 진 지 한두 시간쯤 된 저녁" : "해 뜨기 한두 시간쯤 전 새벽"}이에요.`
          : key === "dusk"
            ? "서쪽 지평선을 다시 보세요. 노을빛이 남아 있나요?"
            : key === "dawn"
              ? "동쪽 지평선을 다시 보세요. 밝아 오고 있나요?"
              : "지평선 한쪽이 밝지는 않은지 다시 둘러보세요.",
    })),
    clue: timeClue,
  });

  if (ex.skyTime === "night") {
    const parts = constellationParts(ex.meridian);
    const vs = uniqueStars(parts);
    const middle = north ? "정남" : "정북";

    steps.push({
      say: `한밤에는 ${middle} 쪽 하늘 한가운데 별자리가 시계예요. ${middle} 하늘 높이 있는 ${ex.meridian}를 찾아 눌러 보세요.`,
      target: { vectors: vs, toleranceDeg: 3, lines: ex.meridian },
      found: `찾았어요. 계절 별자리 카드에서 ${ex.meridian}가 자정에 한가운데 오는 달을 찾고, 한 달에 2시간씩 일찍 온다는 걸로 지금 몇 시쯤인지 어림해 보세요.`,
      help: `${middle}쪽 하늘이에요. 하늘을 그쪽으로 돌려 둘게요.`,
      clue: `하늘 한가운데: ${ex.meridian}`,
    });
  }

  steps.push({
    say: `마지막이에요. 지도에 커서를 올리면 그곳 현지 시각이 보여요. 모은 위도 단서의 띠 안에서, 현지 시각이 ${ex.skyTime === "night" ? "어림한 시각" : ex.skyTime === "dusk" ? "저녁 7~9시쯤" : "새벽 4~6시쯤"}인 곳을 찾아 핀을 찍어 보세요.`,
  });

  return steps;
};
