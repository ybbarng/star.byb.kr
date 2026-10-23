import type { LineLevel } from "@/game/starSchool/leitner";
import type { Mark, TapTarget } from "@/game/starSchool/lessons";
import type { LocalTime, SkyPlace } from "@/game/starSchool/skyMath";
import type { Point3D } from "@/scripts/hash/types";
import { ZODIAC } from "@/game/birthday/zodiac";
import { findTargets } from "@/game/findConstellation/targets";
import { constellationCenter, constellationParts } from "@/game/sky/catalog";
import { ASTERISMS, asterismById } from "@/game/starSchool/asterisms";
import { markVectors, tapVector } from "@/game/starSchool/lessonGeometry";
import { CASSIOPEIA_SIDES } from "@/game/starSchool/lessons";
import {
  altAzAt,
  dateAt,
  observerOf,
  SEOUL_PLACE,
  sunAltAt,
  SYDNEY_PLACE,
  timeLabel,
} from "@/game/starSchool/skyMath";
import { createRng } from "@/utils/rng";

// 문제 만들기: 카드 연습(모양 ↔ 이름, 점 잇기)과 관계 맞히기(하늘에서 꼭짓점 누르기, 사이 별자리, 황도 순서,
// 계절의 길잡이 모양, 징검다리). 관계 문제의 하늘은 다룰 것이 모두 높이 떠 있는 밤 시각을 계산해서 고른다.

const shuffle = <T>(xs: T[], rng: () => number) =>
  xs
    .map((x) => ({ x, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map(({ x }) => x);

// ── 카드 연습 ──────────────────────────────────────────────────

export type Deck = "famous" | "nakedEye" | "all" | "asterisms";

export const DECKS: { value: Deck; title: string; note: string }[] = [
  { value: "famous", title: "유명한 별자리", note: "15개" },
  { value: "nakedEye", title: "맨눈 별자리", note: "30개" },
  { value: "all", title: "88개 전부", note: "남쪽 별자리까지" },
  { value: "asterisms", title: "길잡이 모양", note: `${ASTERISMS.length}개` },
];

export const deckIds = (deck: Deck): string[] =>
  deck === "asterisms"
    ? ASTERISMS.map((a) => `a:${a.id}`)
    : findTargets(
        deck === "famous" ? "easy" : deck === "nakedEye" ? "normal" : "hard",
      ).map((t) => `c:${t.label}`);

export type CardQuestion =
  | {
      kind: "shapeToName";
      id: string;
      choices: string[]; // 보기 (dex id)
      level: LineLevel;
    }
  | { kind: "nameToShape"; id: string; choices: string[]; level: LineLevel }
  | { kind: "draw"; id: string };

// 선을 이을 수 있을 만큼 별이 적당한 것만 점 잇기로 (너무 크거나 작으면 고르기로)
const drawable = (id: string) => {
  if (!id.startsWith("c:")) return false;

  const n = new Set(
    constellationParts(id.slice(2)).flatMap((p) =>
      p.stars.map((v) => v.map((c) => c.toFixed(4)).join()),
    ),
  ).size;

  return n >= 3 && n <= 10;
};

// 칸이 낮으면 모양 → 이름, 오르면 이름 → 모양, 잘 알면 점 잇기
export const cardQuestion = (
  id: string,
  box: number,
  pool: string[],
  rng: () => number,
): CardQuestion => {
  const level: LineLevel = box <= 2 ? "lines" : box === 3 ? "faint" : "stars";
  const others = shuffle(
    pool.filter((p) => p !== id && p.slice(0, 2) === id.slice(0, 2)),
    rng,
  ).slice(0, 3);
  const choices = shuffle([id, ...others], rng);

  if (box >= 4 && drawable(id) && rng() < 0.5) {
    return { kind: "draw", id };
  }

  return box % 2 === 1
    ? { kind: "shapeToName", id, choices, level }
    : { kind: "nameToShape", id, choices, level };
};

// ── 하늘 장면 ──────────────────────────────────────────────────

export interface SkyScene {
  place: SkyPlace;
  time: LocalTime;
}

const HOURS = [20, 21, 22, 23, 24, 25, 26, 27];

// 이 방향들이 모두 가장 높이 뜨는 밤 (매달 15일, 저녁 8시 ~ 새벽 3시). 저녁 9~10시에 가까울수록 낫다
export const sceneFor = (
  vectors: Point3D[],
  place: SkyPlace,
  year = 2026,
): SkyScene => {
  const observer = observerOf(place);
  let best: { score: number; time: LocalTime } | null = null;

  for (let m = 1; m <= 12; m++) {
    for (const h of HOURS) {
      const time: LocalTime = {
        y: year,
        m,
        d: h >= 24 ? 16 : 15,
        h: h % 24,
        min: 0,
      };
      const date = dateAt(place, time);

      if (sunAltAt(date, observer) > -15) continue;

      const minAlt = Math.min(
        ...vectors.map((v) => altAzAt(v, date, observer).altDeg),
      );
      const score = minAlt - 2.5 * Math.abs(h - 21.5);

      if (!best || score > best.score) best = { score, time };
    }
  }

  return { place, time: best!.time };
};

// ── 관계 맞히기 ────────────────────────────────────────────────

export type RelationQuestion =
  | {
      kind: "vertices"; // 길잡이 모양의 꼭짓점을 모두 눌러요
      key: string;
      prompt: string;
      asterism: string;
      scene: SkyScene;
      marks: Mark[];
      south: boolean;
    }
  | {
      kind: "tap"; // 하늘에서 한 자리를 찾아 눌러요
      key: string;
      prompt: string;
      targets: TapTarget[]; // 이 중 하나 근처면 정답
      tolDeg: number;
      scene: SkyScene;
      marks: Mark[]; // 문제와 함께 보여 줄 것
      reveal: Mark[]; // 맞힌 뒤 보여 줄 것
      explain: string;
      south: boolean;
    }
  | {
      kind: "choice"; // 하늘을 보고 보기에서 골라요
      key: string;
      prompt: string;
      choices: string[];
      answer: number;
      scene: SkyScene;
      marks: Mark[];
      reveal: Mark[];
      explain: string;
      south: boolean;
    }
  | {
      kind: "order"; // 순서대로 눌러요 (하늘 없이)
      key: string;
      prompt: string;
      items: string[]; // 정답 순서
      explain: string;
      south: boolean;
    };

const constellationMark = (label: string): Mark => ({
  kind: "constellation",
  label,
});

const sceneOfMarks = (marks: Mark[], place = SEOUL_PLACE) =>
  sceneFor(marks.flatMap(markVectors), place);

// 꼭짓점 누르기
const VERTEX_QUESTIONS: [string, string][] = [
  ["summer-triangle", "여름철 대삼각형의 세 별을 모두 눌러요"],
  ["winter-triangle", "겨울철 대삼각형의 세 별을 모두 눌러요"],
  ["spring-triangle", "봄철 대삼각형의 세 별을 모두 눌러요"],
  ["great-square", "페가수스 대사각형의 네 별을 모두 눌러요"],
  ["winter-hexagon", "겨울철 대육각형의 1등성 여섯을 모두 눌러요"],
  ["big-dipper", "북두칠성의 일곱 별을 모두 눌러요"],
  ["orion-belt", "오리온의 허리띠 세 별을 눌러요"],
  ["southern-cross", "남십자의 네 별을 모두 눌러요 (가짜 십자가 말고!)"],
];

const vertexQuestions = (): RelationQuestion[] =>
  VERTEX_QUESTIONS.map(([id, prompt]) => {
    const a = asterismById(id);
    const south = a.hemisphere === "south";
    const extra: Mark[] =
      id === "southern-cross" ? [{ kind: "asterism", id: "false-cross" }] : [];

    return {
      kind: "vertices",
      key: `v:${id}`,
      prompt,
      asterism: id,
      scene: sceneOfMarks(
        [{ kind: "asterism", id }, ...extra],
        south ? SYDNEY_PLACE : SEOUL_PLACE,
      ),
      marks: [],
      south,
    };
  });

// 사이 별자리: [한쪽, 다른 쪽, 사이, 설명]
const BETWEEN: [string, string, string, string][] = [
  [
    "쌍둥이자리",
    "사자자리",
    "게자리",
    "황도를 따라 쌍둥이 → 게 → 사자. 게자리 한가운데 벌집 성단이 있어요.",
  ],
  [
    "처녀자리",
    "전갈자리",
    "천칭자리",
    "옛날엔 전갈의 집게발이던 저울이 처녀와 전갈 사이에 있어요.",
  ],
  [
    "페가수스자리",
    "페르세우스자리",
    "안드로메다자리",
    "공주 안드로메다를 사이에 두고 날개 달린 말과 영웅 페르세우스가 있어요.",
  ],
  [
    "카시오페이아자리",
    "마차부자리",
    "페르세우스자리",
    "카시오페이아 W와 카펠라 사이가 페르세우스예요.",
  ],
  [
    "목동자리",
    "헤르쿨레스자리",
    "북쪽왕관자리",
    "아크투루스 동쪽, 헤르쿨레스 서쪽에 반원 모양 왕관이 있어요.",
  ],
  [
    "큰개자리",
    "작은개자리",
    "외뿔소자리",
    "시리우스와 프로키온 사이, 겨울철 대삼각형 안쪽의 어두운 일각수예요.",
  ],
  [
    "염소자리",
    "물고기자리",
    "물병자리",
    "황도를 따라 염소 → 물병 → 물고기 순서예요.",
  ],
  [
    "양자리",
    "쌍둥이자리",
    "황소자리",
    "황도를 따라 양 → 황소 → 쌍둥이. 황소엔 좀생이별과 알데바란이 있어요.",
  ],
  [
    "큰곰자리",
    "작은곰자리",
    "용자리",
    "용이 두 곰 사이를 굽이쳐 감싸고 있어요.",
  ],
  [
    "거문고자리",
    "헤르쿨레스자리",
    "용자리",
    "용의 머리는 직녀성 바로 곁이에요.",
  ],
];

const betweenQuestions = (rng: () => number): RelationQuestion[] => {
  const pool = findTargets("normal").map((t) => t.label);

  return BETWEEN.map(([a, b, answer, explain]) => {
    const wrong = shuffle(
      pool.filter((l) => l !== a && l !== b && l !== answer),
      rng,
    ).slice(0, 3);
    const choices = shuffle([answer, ...wrong], rng);

    return {
      kind: "choice",
      key: `b:${a}-${b}`,
      prompt: `선으로 이은 ${a}와 ${b}, 그 사이에 있는 별자리는?`,
      choices,
      answer: choices.indexOf(answer),
      scene: sceneOfMarks([a, b, answer].map(constellationMark)),
      marks: [constellationMark(a), constellationMark(b)],
      reveal: [constellationMark(answer)],
      explain,
      south: false,
    };
  });
};

// 계절의 길잡이 모양: 그 하늘을 보고 고른다
const SEASON_SHAPES: [string, string][] = [
  ["spring-triangle", "봄"],
  ["summer-triangle", "여름"],
  ["great-square", "가을"],
  ["winter-triangle", "겨울"],
];

const seasonQuestions = (rng: () => number): RelationQuestion[] =>
  SEASON_SHAPES.map(([id]) => {
    const scene = sceneOfMarks([{ kind: "asterism", id }]);
    const ids = shuffle(
      SEASON_SHAPES.map(([x]) => x),
      rng,
    );
    const answer = ids.indexOf(id);

    return {
      kind: "choice",
      key: `s:${id}`,
      prompt: `${timeLabel(scene.time)}, 서울 하늘. 지금 높이 뜬 커다란 길잡이 모양은? (밝은 별을 이어 보세요)`,
      choices: ids.map((x) => asterismById(x).name),
      answer,
      scene,
      marks: [],
      reveal: [{ kind: "asterism", id }],
      explain: `${asterismById(id).name}: ${asterismById(id).season}의 길잡이예요.`,
      south: false,
    };
  });

// 징검다리: 보여 준 길잡이에서 출발해 목표를 찾아 누른다
const HOPS: {
  key: string;
  prompt: string;
  marks: Mark[];
  target: TapTarget;
  tolDeg: number;
  reveal: Mark[];
  explain: string;
  south?: boolean;
}[] = [
  {
    key: "h:polaris-dipper",
    prompt: "북두칠성 국자 끝 두 별을 이어 북극성을 찾아 눌러요",
    marks: [{ kind: "asterism", id: "big-dipper" }],
    target: { hr: "424" },
    tolDeg: 3,
    reveal: [{ kind: "hop", from: "4295", to: "4301", times: 5.3 }],
    explain: "메라크 → 두베를 다섯 배쯤 늘이면 북극성이에요.",
  },
  {
    key: "h:polaris-cas",
    prompt: "카시오페이아 W로 북극성을 찾아 눌러요",
    marks: [{ kind: "asterism", id: "cassiopeia-w" }],
    target: { hr: "424" },
    tolDeg: 3,
    reveal: [
      {
        kind: "hop",
        from: { meet: CASSIOPEIA_SIDES },
        to: "264",
        times: 5,
      },
      { kind: "star", hr: "424" },
    ],
    explain:
      "W의 바깥 두 변을 늘여 만나는 점에서 가운데 별까지 잇고, 그 거리의 다섯 배쯤 더 가면 북극성이에요.",
  },
  {
    key: "h:m31",
    prompt: "페가수스 대사각형에서 출발해 안드로메다은하를 찾아 눌러요",
    marks: [{ kind: "asterism", id: "great-square" }],
    target: { deepSky: "m31" },
    tolDeg: 3.5,
    reveal: [
      { kind: "constellation", label: "안드로메다자리" },
      { kind: "hop", from: "337", to: "269", times: 1 },
      { kind: "deepSky", id: "m31" },
    ],
    explain:
      "알페라츠 → 동쪽 미라크 → 북쪽으로 희미한 두 별 → 안드로메다은하예요.",
  },
  {
    key: "h:sirius",
    prompt: "오리온의 허리띠를 따라가 시리우스를 눌러요",
    marks: [{ kind: "constellation", label: "오리온자리" }],
    target: { hr: "2491" },
    tolDeg: 3,
    reveal: [{ kind: "hop", from: "1852", to: "1948", times: 7.9 }],
    explain:
      "허리띠를 왼쪽 아래(남동쪽)로 여덟 배쯤 이으면 가장 밝은 별 시리우스예요.",
  },
  {
    key: "h:pleiades",
    prompt: "오리온의 허리띠를 반대로 따라가 좀생이별(플레이아데스)을 눌러요",
    marks: [{ kind: "constellation", label: "오리온자리" }],
    target: { deepSky: "m45" },
    tolDeg: 3,
    reveal: [
      { kind: "hop", from: "1948", to: "1852", times: 7.7 },
      { kind: "deepSky", id: "m45" },
    ],
    explain: "허리띠를 오른쪽 위로 이으면 알데바란, 더 가면 좀생이별이에요.",
  },
  {
    key: "h:spica",
    prompt: "북두칠성 손잡이의 곡선을 따라가 스피카를 눌러요",
    marks: [{ kind: "asterism", id: "big-dipper" }],
    target: { hr: "5056" },
    tolDeg: 3,
    reveal: [{ kind: "asterism", id: "spring-arc" }],
    explain: "손잡이 곡선 → 아크투루스 → 스피카, 봄철 대곡선이에요.",
  },
  {
    key: "h:vega",
    prompt: "견우성에서 은하수 건너 마주 본 직녀성을 눌러요",
    marks: [{ kind: "star", hr: "7557" }, { kind: "milkyWay" }],
    target: { hr: "7001" },
    tolDeg: 3,
    reveal: [{ kind: "asterism", id: "summer-triangle" }],
    explain:
      "견우와 직녀 사이로 은하수가 흘러요. 데네브와 함께 여름철 대삼각형이에요.",
  },
  {
    key: "h:galactic-center",
    prompt: "궁수자리 찻주전자에서 우리은하 중심 방향을 눌러요",
    marks: [{ kind: "asterism", id: "teapot" }, { kind: "milkyWay" }],
    target: { deepSky: "galactic-center" },
    tolDeg: 6,
    reveal: [{ kind: "deepSky", id: "galactic-center" }],
    explain:
      "찻주전자 주둥이 위로 피어오르는 은하수의 김 속, 약 2만 6천 광년 너머가 은하 중심이에요.",
  },
  {
    key: "h:south-pole",
    prompt: "남십자의 긴 막대로 하늘의 남극을 찾아 눌러요",
    marks: [{ kind: "asterism", id: "southern-cross" }],
    target: { pole: "south" },
    tolDeg: 6,
    reveal: [
      { kind: "hop", from: "4763", to: "4730", times: 4.5 },
      { kind: "pole", south: true },
    ],
    explain: "가크룩스 → 아크룩스를 네 배 반쯤 늘이면 하늘의 남극이에요.",
    south: true,
  },
  {
    key: "h:real-cross",
    prompt: "진짜 남십자를 찾아 그 별 하나를 눌러요 (가짜 십자가 말고!)",
    marks: [],
    target: { hr: "4730" },
    tolDeg: 4,
    reveal: [
      { kind: "asterism", id: "southern-cross" },
      { kind: "asterism", id: "pointers" },
      { kind: "asterism", id: "false-cross" },
    ],
    explain:
      "밝은 지시별 두 개(알파 센타우리·하다르)가 가리키는 작은 십자가가 진짜예요.",
    south: true,
  },
  {
    key: "h:lmc",
    prompt: "카노푸스와 하늘의 남극 사이의 대마젤란은하를 눌러요",
    marks: [
      { kind: "star", hr: "2326" },
      { kind: "pole", south: true },
    ],
    target: { deepSky: "lmc" },
    tolDeg: 6,
    reveal: [{ kind: "deepSky", id: "lmc" }],
    explain: "대마젤란은하는 약 16만 광년 떨어진 이웃 은하예요.",
    south: true,
  },
];

const hopQuestions = (): RelationQuestion[] =>
  HOPS.map((h) => {
    const targets =
      h.key === "h:real-cross"
        ? asterismById("southern-cross").vertices.map((hr) => ({ hr }))
        : [h.target];
    const place = h.south ? SYDNEY_PLACE : SEOUL_PLACE;
    const vectors = [
      ...[...h.marks, ...h.reveal].flatMap(markVectors),
      tapVector(h.target),
    ];

    return {
      kind: "tap",
      key: h.key,
      prompt: h.prompt,
      targets,
      tolDeg: h.tolDeg,
      scene: sceneFor(vectors, place),
      marks: h.marks,
      reveal: h.reveal,
      explain: h.explain,
      south: !!h.south,
    };
  });

// 황도 순서: 해가 지나는 차례로 연달아 있는 넷을 섞어 낸다
export const zodiacOrderQuestion = (rng: () => number): RelationQuestion => {
  const labels = ZODIAC.map((z) => z.label);
  const start = Math.floor(rng() * labels.length);
  const items = [0, 1, 2, 3].map((k) => labels[(start + k) % labels.length]);

  return {
    kind: "order",
    key: `o:${items[0]}`,
    prompt: "해가 별자리 사이를 지나는 순서대로 눌러요",
    items,
    explain: `해는 황도를 따라 서쪽에서 동쪽으로 ${items.join(" → ")} 순서로 지나요${items.includes("뱀주인자리") ? ". 뱀주인자리도 빠뜨리지 마세요" : ""}.`,
    south: false,
  };
};

let bankCache: RelationQuestion[] | null = null;

// 관계 문제 전부 (보기 순서는 고정된 난수로 섞어 둔다)
export const relationBank = (): RelationQuestion[] => {
  if (bankCache) return bankCache;

  const rng = createRng(20261023);

  bankCache = [
    ...vertexQuestions(),
    ...betweenQuestions(rng),
    ...seasonQuestions(rng),
    ...hopQuestions(),
  ];

  return bankCache;
};

// 한 판: 남반구가 열렸는지에 따라 고르고, 황도 순서 문제를 하나 섞는다
export const relationRound = (
  seed: number,
  count: number,
  southOpen: boolean,
): RelationQuestion[] => {
  const rng = createRng(seed);
  const pool = relationBank().filter((q) => southOpen || !q.south);
  const picked = shuffle(pool, rng).slice(0, count - 1);
  const at = Math.floor(rng() * count);

  picked.splice(at, 0, zodiacOrderQuestion(rng));

  return picked;
};

// ── 오늘의 하늘 문제 ────────────────────────────────────────────

const hashKey = (key: string) => {
  let h = 2166136261;

  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  }

  return h >>> 0;
};

// 같은 날이면 누구에게나 같은 문제 (남반구 문제는 내지 않는다)
export const dailyQuestion = (dateKey: string): RelationQuestion => {
  const rng = createRng(hashKey(dateKey));
  const pool = relationBank().filter((q) => !q.south);
  const k = Math.floor(rng() * (pool.length + 2));

  return k >= pool.length ? zodiacOrderQuestion(rng) : pool[k];
};

// 문제가 다루는 하늘 방향 (테스트·카메라용)
export const relationVectors = (q: RelationQuestion): Point3D[] => {
  switch (q.kind) {
    case "vertices":
      return asterismById(q.asterism).vertices.map((hr) => tapVector({ hr }));
    case "tap":
      return [...q.marks.flatMap(markVectors), ...q.targets.map(tapVector)];
    case "choice":
      return [...q.marks, ...q.reveal].flatMap(markVectors);
    default:
      return [];
  }
};

// 별자리 가운데 (보기 이름 → 하늘 방향)
export const constellationVector = (label: string) =>
  constellationCenter(constellationParts(label));
