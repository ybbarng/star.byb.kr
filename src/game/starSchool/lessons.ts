import type { Hemisphere } from "@/game/starSchool/asterisms";
import type { LocalTime, SkyPlace } from "@/game/starSchool/skyMath";
import {
  SEOUL_PLACE,
  SYDNEY_PLACE,
  YEONGYANG_PLACE,
} from "@/game/starSchool/skyMath";

// 하늘 길잡이 수업: 실제 하늘(그 장소·시각에 정말 떠 있는 하늘)에서 밝은 별을 징검다리 삼아 길을 찾는다.
// 수업마다 고른 시각에는 다룰 별들이 모두 지평선 위 15° 넘게 떠 있고, 해는 −12° 아래다 (테스트로 확인한다).
// 계절 수업 네 개(북반구)를 마치면 남반구 수업이 열린다.

// 하늘에 겹쳐 그릴 것
export type Mark =
  | { kind: "asterism"; id: string }
  | { kind: "constellation"; label: string }
  | { kind: "star"; hr: string }
  | { kind: "deepSky"; id: string }
  // from에서 to를 지나, to 너머로 from–to 거리의 times배만큼 더 늘인 화살표 (별 징검다리). lands는 화살표가 닿는 곳
  | { kind: "hop"; from: string; to: string; times: number; lands?: TapTarget }
  // 별들을 차례로 잇는 점선 화살표 (휘어진 길)
  | { kind: "path"; hrs: string[] }
  | { kind: "pole"; south: boolean }
  | { kind: "ecliptic" }
  | { kind: "milkyWay" };

// 하늘에서 눌러 찾기
export type TapTarget =
  | { hr: string }
  | { deepSky: string }
  | { pole: "north" | "south" };

export interface LessonStep {
  say: string;
  marks: Mark[];
  time?: LocalTime; // 이 단계만 다른 시각
  sky?: { magLimit?: number; lightPollution?: number };
  // 정해 둔 카메라 (방위·높이·시야각 °). 없으면 표시들이 다 들어오게 맞춘다
  view?: { az: number; alt: number; fov: number };
  tap?: { target: TapTarget; tolDeg: number; prompt: string; found: string };
  // 다룰 별이 낮게 있어도 되는 단계 (가을 저녁 낮은 북두칠성처럼, 낮은 것 자체를 보여 줄 때)
  allowLow?: boolean;
}

export interface QuizQuestion {
  q: string;
  choices: string[];
  answer: number;
  why: string;
}

export type StampId =
  | "polaris"
  | "spring"
  | "summer"
  | "autumn"
  | "winter"
  | "south"
  | "milkyway"
  | "ecliptic";

export interface Lesson {
  id: string;
  title: string;
  icon: string;
  summary: string;
  stamp: StampId;
  hemisphere: Hemisphere;
  place: SkyPlace;
  time: LocalTime;
  magLimit: number;
  lightPollution: number;
  steps: LessonStep[];
  quiz: QuizQuestion[];
  fact: string; // 수업 끝에 들려줄 한마디
  links?: { href: string; label: string }[];
  basics: string[]; // 더 알아볼 하늘 읽기 기초 페이지 (src/learn/basics/topics.ts의 slug)
  learns: string[]; // 마치면 도감에서 열리는 것 (dex id)
}

// 단계마다 곁들일 하늘 읽기 기초: 별 징검다리·손 각도는 별 건너뛰기, 은하수는 은하수, 황도는 지구의 기울기
export const stepBasics = (step: LessonStep): string[] => {
  const kinds = new Set(step.marks.map((m) => m.kind));
  const slugs: string[] = [];

  if (
    kinds.has("hop") ||
    kinds.has("path") ||
    /주먹|손가락|한 뼘/.test(step.say)
  ) {
    slugs.push("star-hopping");
  }

  if (kinds.has("milkyWay")) {
    slugs.push("milky-way");
  }

  if (kinds.has("ecliptic")) {
    slugs.push("earth-tilt");
  }

  return slugs;
};

export const SEASON_LESSONS = ["spring", "summer", "autumn", "winter"];

export const LESSONS: Lesson[] = [
  {
    id: "polaris",
    title: "북극성 찾기",
    icon: "⭐",
    summary: "북두칠성과 카시오페이아, 두 길잡이로 북극성에 가요",
    stamp: "polaris",
    hemisphere: "north",
    place: SEOUL_PLACE,
    time: { y: 2026, m: 2, d: 20, h: 21, min: 0 },
    magLimit: 4.5,
    lightPollution: 0.3,
    steps: [
      {
        say: "2월 말 저녁 9시, 서울의 북쪽 하늘이에요. 북극성은 가장 밝은 별이 아니에요(2등성). 그래서 밝은 길잡이부터 찾아요.",
        marks: [],
      },
      {
        say: "북동쪽에 국자 모양 일곱 별, 북두칠성이 서 있어요. 국자는 큰곰자리의 엉덩이와 꼬리예요.",
        marks: [{ kind: "asterism", id: "big-dipper" }],
      },
      {
        say: "국자 끝 두 별(메라크 → 두베)을 이어 다섯 배쯤 늘여 보세요. 그 끝에 홀로 있는 별이 북극성이에요.",
        marks: [
          { kind: "asterism", id: "big-dipper" },
          {
            kind: "hop",
            from: "4295",
            to: "4301",
            times: 5.3,
            lands: { hr: "424" },
          },
        ],
        tap: {
          target: { hr: "424" },
          tolDeg: 3,
          prompt: "화살표 끝의 북극성을 눌러 보세요",
          found:
            "찾았어요! 국자 끝 두 별을 '지극성(극을 가리키는 별)'이라고 불러요.",
        },
      },
      {
        say: "북두칠성이 낮을 때는 반대편의 카시오페이아 W를 써요. W의 바깥 두 변을 늘여 만나는 점과 가운데 별을 잇고 다섯 배쯤 늘이면 북극성이에요.",
        marks: [
          { kind: "asterism", id: "cassiopeia-w" },
          { kind: "star", hr: "424" },
        ],
      },
      {
        say: "북극성은 하늘의 북극 바로 곁(약 0.7°)에 있어서 밤새 거의 움직이지 않아요. 그리고 북극성의 높이는 그곳의 위도와 같아요. 서울은 북위 37.6°라서 북극성도 37.6° 높이에 떠요.",
        marks: [
          { kind: "pole", south: false },
          { kind: "asterism", id: "big-dipper" },
          { kind: "asterism", id: "cassiopeia-w" },
        ],
      },
    ],
    quiz: [
      {
        q: "북두칠성에서 북극성을 찾으려면 어느 두 별을 이을까요?",
        choices: [
          "국자 끝 두 별 (메라크 → 두베)",
          "손잡이 끝 두 별 (미자르 → 알카이드)",
          "국자 바닥 두 별 (페크다 → 메라크)",
        ],
        answer: 0,
        why: "국자 끝 두 별을 이어 다섯 배쯤 늘이면 북극성이에요.",
      },
      {
        q: "부산(북위 35°)에서 북극성은 얼마나 높이 떠 있을까요?",
        choices: ["약 15°", "약 35°", "약 55°", "머리 꼭대기 90°"],
        answer: 1,
        why: "북극성의 높이 = 위도. 북극에선 머리 꼭대기, 적도에선 지평선에 있어요.",
      },
    ],
    fact: "북극성은 영원하지 않아요. 지구 자전축이 약 2만 6천 년 주기로 돌아(세차 운동), 약 1만 2천 년 뒤에는 직녀성이 북극 근처에 와요.",
    links: [{ href: "/games/precession", label: "세차운동 타임머신" }],
    basics: ["star-hopping", "earth-coords"],
    learns: ["a:big-dipper", "a:cassiopeia-w", "c:작은곰자리"],
  },
  {
    id: "dipper-clock",
    title: "북두칠성 시계",
    icon: "🕰️",
    summary: "북두칠성이 북극성 둘레를 도는 모습으로 시각과 계절을 읽어요",
    stamp: "polaris",
    hemisphere: "north",
    place: SEOUL_PLACE,
    time: { y: 2026, m: 4, d: 15, h: 22, min: 0 },
    magLimit: 4.5,
    lightPollution: 0.3,
    steps: [
      {
        say: "4월 15일 밤 10시. 봄 저녁엔 북두칠성이 북극성 위 높이, 국자를 엎은 모양으로 떠 있어요.",
        marks: [
          { kind: "asterism", id: "big-dipper" },
          { kind: "pole", south: false },
        ],
      },
      {
        say: "다음 날 새벽 1시. 세 시간 만에 북극성을 중심으로 시곗바늘 반대 방향으로 45° 돌았어요. 한 시간에 15°씩, 하루에 한 바퀴예요.",
        time: { y: 2026, m: 4, d: 16, h: 1, min: 0 },
        marks: [
          { kind: "asterism", id: "big-dipper" },
          { kind: "pole", south: false },
        ],
      },
      {
        say: "7월 15일 밤 10시. 같은 시각인데 석 달 만에 90° 돌아 북서쪽에 있어요. 같은 시각이면 한 달에 30°씩 돌아요 (한 달에 2시간씩 일찍 같은 자리에 와요).",
        time: { y: 2026, m: 7, d: 15, h: 22, min: 0 },
        marks: [
          { kind: "asterism", id: "big-dipper" },
          { kind: "pole", south: false },
        ],
      },
      {
        say: "10월 15일 밤 10시. 북두칠성이 북쪽 지평선 가까이 낮게 깔려 일부는 산이나 건물에 가려요. 가을엔 높이 뜬 카시오페이아로 북극성을 찾아요.",
        time: { y: 2026, m: 10, d: 15, h: 22, min: 0 },
        marks: [
          { kind: "asterism", id: "big-dipper" },
          { kind: "asterism", id: "cassiopeia-w" },
          { kind: "pole", south: false },
        ],
        allowLow: true,
      },
      {
        say: "2월 15일 밤 10시. 북동쪽에서 손잡이를 아래로 늘어뜨리고 올라오고 있어요. 이렇게 국자의 방향만 봐도 대략 몇 월 몇 시인지 읽을 수 있어요.",
        time: { y: 2027, m: 2, d: 15, h: 22, min: 0 },
        marks: [
          { kind: "asterism", id: "big-dipper" },
          { kind: "pole", south: false },
        ],
      },
    ],
    quiz: [
      {
        q: "북두칠성은 북극성을 중심으로 한 시간에 몇 도씩 돌까요?",
        choices: ["1°", "15°", "30°", "45°"],
        answer: 1,
        why: "하루(24시간)에 한 바퀴(360°)라서 한 시간에 15°예요.",
      },
      {
        q: "북쪽 하늘을 보고 있을 때 북두칠성은 어느 쪽으로 돌까요?",
        choices: ["시곗바늘 방향", "시곗바늘 반대 방향", "돌지 않는다"],
        answer: 1,
        why: "북쪽 하늘의 별들은 북극성을 중심으로 시곗바늘 반대 방향으로 돌아요. 동쪽에서 떠서 서쪽으로 지는 것과 같은 움직임이에요.",
      },
      {
        q: "4월 16일 새벽 1시의 북두칠성과 같은 자리는 언제 다시 볼 수 있을까요?",
        choices: ["5월 15일 밤 11시", "5월 16일 새벽 3시", "4월 16일 밤 10시"],
        answer: 0,
        why: "같은 하늘은 한 달에 두 시간씩 일찍 와요. 한 달 뒤엔 두 시간 이른 밤 11시예요.",
      },
    ],
    fact: "옛사람들은 북두칠성 손잡이가 가리키는 방향으로 계절을 읽었어요. 저녁에 손잡이가 동쪽을 가리키면 봄, 남쪽이면 여름, 서쪽이면 가을, 북쪽이면 겨울이라고 했어요.",
    links: [{ href: "/games/star-trails", label: "별 궤적 풀기" }],
    basics: ["sidereal-day"],
    learns: ["a:big-dipper"],
  },
  {
    id: "spring",
    title: "봄 하늘 길잡이",
    icon: "🌸",
    summary: "북두칠성 손잡이에서 봄철 대곡선을 따라 아크투루스와 스피카로",
    stamp: "spring",
    hemisphere: "north",
    place: SEOUL_PLACE,
    time: { y: 2026, m: 5, d: 10, h: 21, min: 30 },
    magLimit: 4.5,
    lightPollution: 0.3,
    steps: [
      {
        say: "5월 10일 저녁 9시 반, 서울. 봄 저녁 북쪽 하늘 높이 북두칠성이 떠 있어요. 오늘의 출발점이에요.",
        marks: [{ kind: "asterism", id: "big-dipper" }],
      },
      {
        say: "국자 손잡이(알리오스 → 미자르 → 알카이드)가 휘어 있죠? 그 곡선을 그대로 이어 가 보세요. 주황빛 밝은 별이 나와요.",
        marks: [
          { kind: "asterism", id: "big-dipper" },
          { kind: "path", hrs: ["4905", "5054", "5191", "5340"] },
        ],
        tap: {
          target: { hr: "5340" },
          tolDeg: 3,
          prompt: "곡선 끝의 주황빛 별을 눌러 보세요",
          found:
            "아크투루스예요! 목동자리의 으뜸별, 북쪽 하늘에서 가장 밝은 별이에요.",
        },
      },
      {
        say: "같은 곡선을 한 번 더 미끄러지듯 이어 가면 하얀 1등성 스피카(처녀자리)예요. 이 큰 곡선이 봄철 대곡선이에요.",
        marks: [{ kind: "asterism", id: "spring-arc" }],
        tap: {
          target: { hr: "5056" },
          tolDeg: 3,
          prompt: "곡선을 더 이어 스피카를 눌러 보세요",
          found: "스피카! '곡식 이삭'이라는 뜻이에요.",
        },
      },
      {
        say: "아크투루스, 스피카와 정삼각형을 이루는 별이 서쪽에 있어요. 사자 꼬리 데네볼라예요. 셋이 봄철 대삼각형이에요.",
        marks: [
          { kind: "asterism", id: "spring-triangle" },
          { kind: "asterism", id: "spring-arc" },
        ],
      },
      {
        say: "데네볼라는 사자자리 꼬리 끝이에요. 사자 머리는 물음표를 뒤집은 낫 모양이고, 낫자루 끝에 1등성 레굴루스가 있어요.",
        marks: [
          { kind: "constellation", label: "사자자리" },
          { kind: "asterism", id: "leo-sickle" },
        ],
      },
    ],
    quiz: [
      {
        q: "봄철 대곡선은 어떤 순서로 이어질까요?",
        choices: [
          "북두칠성 손잡이 → 아크투루스 → 스피카",
          "북두칠성 국자 → 북극성 → 카시오페이아",
          "레굴루스 → 스피카 → 아크투루스",
        ],
        answer: 0,
        why: "손잡이의 휜 곡선을 따라 아크투루스, 한 번 더 가면 스피카예요.",
      },
      {
        q: "봄철 대삼각형의 세 별이 아닌 것은?",
        choices: ["아크투루스", "스피카", "데네볼라", "직녀성"],
        answer: 3,
        why: "직녀성은 여름철 대삼각형의 별이에요.",
      },
    ],
    fact: "아크투루스는 약 37광년 떨어져 있어요. 지금 보는 빛은 여러분이 태어나기 훨씬 전에 출발했을 수도 있어요. 빛의 타임캡슐에서 확인해 보세요.",
    links: [{ href: "/games/light-time-capsule", label: "빛의 타임캡슐" }],
    basics: ["star-hopping"],
    learns: [
      "a:spring-arc",
      "a:spring-triangle",
      "a:leo-sickle",
      "c:목동자리",
      "c:처녀자리",
      "c:사자자리",
    ],
  },
  {
    id: "summer",
    title: "여름 하늘 길잡이",
    icon: "🌌",
    summary:
      "여름철 대삼각형, 은하수 따라 백조 → 독수리 → 궁수, 그리고 붉은 안타레스",
    stamp: "summer",
    hemisphere: "north",
    place: SEOUL_PLACE,
    time: { y: 2026, m: 8, d: 12, h: 21, min: 30 },
    magLimit: 4.5,
    lightPollution: 0.3,
    steps: [
      {
        say: "8월 12일 저녁 9시 반, 서울. 그믐이라 달이 없는 밤이에요. 머리 위에서 가장 밝은 별을 찾아요. 직녀성(베가)이에요.",
        marks: [{ kind: "star", hr: "7001" }],
        tap: {
          target: { hr: "7001" },
          tolDeg: 3,
          prompt: "머리 위 가장 밝은 별, 직녀성을 눌러 보세요",
          found: "직녀성! 거문고자리의 으뜸별이에요.",
        },
      },
      {
        say: "직녀성에서 남동쪽으로 견우성(알타이르), 동쪽(왼쪽)으로 데네브. 세 별이 여름철 대삼각형이에요. 칠월칠석 이야기의 견우와 직녀 사이로 은하수가 흘러요.",
        marks: [{ kind: "asterism", id: "summer-triangle" }],
        tap: {
          target: { hr: "7557" },
          tolDeg: 3,
          prompt: "직녀성과 은하수를 사이에 둔 견우성을 눌러 보세요",
          found: "견우성! 양옆에 작은 별을 하나씩 거느리고 있어요.",
        },
      },
      {
        say: "데네브는 백조자리 꼬리예요. 백조는 은하수를 따라 남쪽으로 날아요. 백조의 몸이 북십자예요.",
        marks: [
          { kind: "asterism", id: "northern-cross" },
          { kind: "milkyWay" },
        ],
      },
      {
        say: "은하수를 따라 계속 남쪽으로 내려가면 견우성(독수리자리)을 지나, 남쪽 지평선 위 찻주전자 모양의 궁수자리에 닿아요.",
        marks: [
          { kind: "constellation", label: "백조자리" },
          { kind: "constellation", label: "독수리자리" },
          { kind: "asterism", id: "teapot" },
          { kind: "milkyWay" },
        ],
      },
      {
        say: "궁수자리 오른쪽(서쪽)에는 S자로 굽은 전갈자리, 심장 자리에 붉은 안타레스가 빛나요. '화성의 맞수'라는 뜻이에요.",
        marks: [
          { kind: "constellation", label: "전갈자리" },
          { kind: "asterism", id: "teapot" },
        ],
        tap: {
          target: { hr: "6134" },
          tolDeg: 3,
          prompt: "전갈의 붉은 심장, 안타레스를 눌러 보세요",
          found:
            "안타레스! 해 자리에 두면 화성 궤도를 훌쩍 넘을 만큼 큰 붉은 초거성이에요.",
        },
      },
    ],
    quiz: [
      {
        q: "여름철 대삼각형의 세 별은?",
        choices: [
          "직녀성·견우성·데네브",
          "직녀성·견우성·안타레스",
          "베텔게우스·시리우스·프로키온",
          "아크투루스·스피카·데네볼라",
        ],
        answer: 0,
        why: "거문고자리 직녀성, 독수리자리 견우성, 백조자리 데네브예요.",
      },
      {
        q: "은하수를 따라 백조자리에서 남쪽으로 가면 어떤 순서로 만날까요?",
        choices: [
          "백조 → 독수리 → 궁수",
          "백조 → 궁수 → 독수리",
          "독수리 → 백조 → 궁수",
        ],
        answer: 0,
        why: "데네브(백조) → 견우성(독수리) → 찻주전자(궁수) 순서로 은하수가 이어져요.",
      },
    ],
    fact: "데네브는 약 2,600광년이나 떨어져 있는데도 1등성으로 보여요. 해보다 수만 배 밝은 초거성이라서예요. 반면 직녀성은 25광년, 견우성은 17광년으로 가까워요.",
    basics: ["star-hopping", "milky-way"],
    learns: [
      "a:summer-triangle",
      "a:northern-cross",
      "a:teapot",
      "c:거문고자리",
      "c:독수리자리",
      "c:백조자리",
      "c:전갈자리",
      "c:궁수자리",
    ],
  },
  {
    id: "autumn",
    title: "가을 하늘 길잡이",
    icon: "🍂",
    summary: "페가수스 대사각형에서 안드로메다은하까지 별 징검다리",
    stamp: "autumn",
    hemisphere: "north",
    place: SEOUL_PLACE,
    time: { y: 2026, m: 11, d: 10, h: 21, min: 0 },
    magLimit: 4.8,
    lightPollution: 0.25,
    steps: [
      {
        say: "11월 10일 저녁 9시, 서울. 가을 하늘은 밝은 별이 적어요. 남쪽 하늘 높이 비슷한 밝기의 네 별이 만든 커다란 네모부터 찾아요.",
        marks: [{ kind: "asterism", id: "great-square" }],
      },
      {
        say: "페가수스 대사각형이에요. 북동쪽 모서리 별 알페라츠는 사실 안드로메다자리의 머리예요. 거기서 왼쪽(동쪽)으로 비슷한 밝기의 별 미라크까지 가요.",
        marks: [
          { kind: "asterism", id: "great-square" },
          { kind: "constellation", label: "안드로메다자리" },
        ],
      },
      {
        say: "미라크에서 북쪽(위)으로 희미한 별 두 개(뮤·뉴)를 건너 같은 간격만큼 더 가면, 뿌연 타원이 있어요. 맨눈으로 보이는 가장 먼 천체, 안드로메다은하예요.",
        marks: [
          { kind: "asterism", id: "great-square" },
          {
            kind: "hop",
            from: "337",
            to: "269",
            times: 1,
            lands: { deepSky: "m31" },
          },
          { kind: "deepSky", id: "m31" },
        ],
        tap: {
          target: { deepSky: "m31" },
          tolDeg: 3,
          prompt: "화살표 끝의 안드로메다은하를 눌러 보세요",
          found:
            "안드로메다은하! 우리은하와 비슷하거나 조금 더 큰 이웃 은하예요.",
        },
      },
      {
        say: "북쪽 하늘 높이엔 W 모양 카시오페이아. W에서 가장 밝은 셰다르에서 남쪽(대사각형 쪽)으로 주먹 한 개 반쯤 가도 안드로메다은하라서 두 번째 길잡이가 돼요.",
        marks: [
          { kind: "asterism", id: "cassiopeia-w" },
          { kind: "deepSky", id: "m31" },
          { kind: "constellation", label: "안드로메다자리" },
        ],
      },
      {
        say: "카시오페이아 아래(동쪽)엔 영웅 페르세우스. 메두사의 머리 자리에 있는 알골은 약 2.9일마다 몇 시간 동안 어두워져 '악마의 별'이라 불렸어요.",
        marks: [
          { kind: "constellation", label: "페르세우스자리" },
          { kind: "asterism", id: "cassiopeia-w" },
          { kind: "deepSky", id: "double-cluster" },
        ],
      },
    ],
    quiz: [
      {
        q: "페가수스 대사각형에서 안드로메다은하로 가려면?",
        choices: [
          "알페라츠에서 동쪽으로 미라크, 거기서 북쪽으로 두 별을 건너서",
          "마르카브에서 남쪽으로 쭉",
          "대사각형 한가운데",
        ],
        answer: 0,
        why: "알페라츠 → 미라크 → 북쪽 두 별(뮤·뉴) → 안드로메다은하. 별 징검다리(스타 호핑)예요.",
      },
      {
        q: "페가수스 대사각형의 네 별 중 안드로메다자리 별은?",
        choices: ["마르카브", "셰아트", "알게니브", "알페라츠"],
        answer: 3,
        why: "알페라츠는 페가수스와 안드로메다가 함께 쓰다 지금은 안드로메다자리 알파별이 됐어요.",
      },
    ],
    fact: "오늘 본 안드로메다은하의 빛은 약 250만 년 전에 출발했어요. 그 빛이 떠날 무렵 지구에는 최초의 사람 속(호모)이 막 나타나고 있었어요.",
    basics: ["star-hopping"],
    learns: [
      "a:great-square",
      "a:cassiopeia-w",
      "d:m31",
      "d:double-cluster",
      "c:페가수스자리",
      "c:안드로메다자리",
      "c:카시오페이아자리",
      "c:페르세우스자리",
    ],
  },
  {
    id: "winter",
    title: "겨울 하늘 길잡이",
    icon: "❄️",
    summary:
      "오리온에서 겨울철 대삼각형·대육각형, 좀생이별과 오리온 대성운까지",
    stamp: "winter",
    hemisphere: "north",
    place: SEOUL_PLACE,
    time: { y: 2027, m: 2, d: 6, h: 21, min: 0 },
    magLimit: 4.5,
    lightPollution: 0.3,
    steps: [
      {
        say: "2월 6일 저녁 9시, 서울. 남쪽 하늘에 나란히 늘어선 별 셋, 오리온의 허리띠(삼태성)부터 찾아요.",
        marks: [
          { kind: "asterism", id: "orion-belt" },
          { kind: "constellation", label: "오리온자리" },
        ],
      },
      {
        say: "허리띠를 왼쪽 아래(남동쪽)로 여덟 배쯤 이어 가면 밤하늘에서 가장 밝은 별, 시리우스예요.",
        marks: [
          { kind: "asterism", id: "orion-belt" },
          {
            kind: "hop",
            from: "1852",
            to: "1948",
            times: 7.9,
            lands: { hr: "2491" },
          },
        ],
        tap: {
          target: { hr: "2491" },
          tolDeg: 3,
          prompt: "화살표 끝의 시리우스를 눌러 보세요",
          found:
            "시리우스! 큰개자리의 코끝, 겨우 8.6광년 떨어진 가까운 별이에요.",
        },
      },
      {
        say: "오리온 왼쪽 어깨의 붉은 베텔게우스, 시리우스, 그리고 왼쪽 위의 프로키온. 세 별이 겨울철 대삼각형이에요.",
        marks: [{ kind: "asterism", id: "winter-triangle" }],
        tap: {
          target: { hr: "2943" },
          tolDeg: 3,
          prompt: "삼각형의 마지막 꼭짓점, 프로키온을 눌러 보세요",
          found: "프로키온! '개보다 먼저'라는 뜻, 시리우스보다 조금 먼저 떠요.",
        },
      },
      {
        say: "시리우스에서 시작해 프로키온 → 폴룩스 → 카펠라 → 알데바란 → 리겔을 이으면 1등성 여섯의 겨울철 대육각형이에요.",
        marks: [{ kind: "asterism", id: "winter-hexagon" }],
      },
      {
        say: "허리띠를 반대쪽(오른쪽 위)으로 이으면 황소의 붉은 눈 알데바란과 V자 히아데스 성단, 더 가면 작은 국자 모양 좀생이별(플레이아데스)이에요.",
        marks: [
          {
            kind: "hop",
            from: "1948",
            to: "1852",
            times: 7.7,
            lands: { hr: "1457" },
          },
          { kind: "deepSky", id: "hyades" },
          { kind: "deepSky", id: "m45" },
        ],
        tap: {
          target: { deepSky: "m45" },
          tolDeg: 3,
          prompt: "좀생이별(플레이아데스)을 눌러 보세요",
          found:
            "좀생이별! 맨눈으로 6~7개, 실제로는 천 개 넘는 별이 모여 있어요.",
        },
      },
      {
        say: "마지막으로 허리띠 아래 늘어진 작은 세 별(오리온의 칼). 가운데가 뿌옇게 번져 보이면 그게 오리온 대성운이에요. 지금도 별이 태어나는 곳이에요.",
        marks: [
          { kind: "constellation", label: "오리온자리" },
          { kind: "deepSky", id: "m42" },
        ],
      },
    ],
    quiz: [
      {
        q: "오리온 허리띠를 왼쪽 아래로 이으면 만나는 별은?",
        choices: ["시리우스", "알데바란", "카펠라", "폴룩스"],
        answer: 0,
        why: "왼쪽 아래(남동쪽)는 시리우스, 오른쪽 위(북서쪽)는 알데바란과 좀생이별이에요.",
      },
      {
        q: "겨울철 대육각형에 들지 않는 별은?",
        choices: ["리겔", "카펠라", "베텔게우스", "프로키온"],
        answer: 2,
        why: "베텔게우스는 대육각형 안쪽에 있어요. 대삼각형의 꼭짓점이에요.",
      },
      {
        q: "오리온 대성운은 어디에 있을까요?",
        choices: ["허리띠 아래 칼의 가운데", "베텔게우스 곁", "리겔 아래"],
        answer: 0,
        why: "허리띠 아래로 늘어진 칼(소삼태성)의 가운데 별이 성운이에요.",
      },
    ],
    fact: "오리온 대성운은 약 1,300광년 떨어져 있어요. 지금 보는 빛은 통일 신라 무렵인 7세기 말쯤 출발했어요.",
    basics: ["star-hopping"],
    learns: [
      "a:orion-belt",
      "a:winter-triangle",
      "a:winter-hexagon",
      "d:m45",
      "d:hyades",
      "d:m42",
      "c:오리온자리",
      "c:큰개자리",
      "c:작은개자리",
      "c:황소자리",
      "c:쌍둥이자리",
      "c:마차부자리",
    ],
  },
  {
    id: "south-cross",
    title: "남십자와 하늘의 남극",
    icon: "✝️",
    summary: "지시별로 진짜 남십자를 가리고, 하늘의 남극을 찾아요",
    stamp: "south",
    hemisphere: "south",
    place: SYDNEY_PLACE,
    time: { y: 2026, m: 5, d: 15, h: 20, min: 0 },
    magLimit: 4.8,
    lightPollution: 0.2,
    steps: [
      {
        say: "5월 15일 저녁 8시, 오스트레일리아 시드니(남위 34°). 남반구 가을 저녁, 남쪽 하늘 높이 은하수 속에 작은 십자가가 서 있어요.",
        marks: [{ kind: "asterism", id: "southern-cross" }],
      },
      {
        say: "십자가 왼쪽(동쪽)의 아주 밝은 두 별이 지시별이에요. 알파 센타우리와 하다르. 이 둘이 가리키는 쪽에 있는 게 진짜 남십자예요.",
        marks: [
          { kind: "asterism", id: "southern-cross" },
          { kind: "asterism", id: "pointers" },
        ],
        tap: {
          target: { hr: "5459" },
          tolDeg: 3,
          prompt: "더 밝은 지시별, 알파 센타우리를 눌러 보세요",
          found: "알파 센타우리! 해 다음으로 가까운 별(약 4.4광년)이에요.",
        },
      },
      {
        say: "오른쪽(서쪽)에 더 크고 조금 어두운 십자가가 하나 더 있어요. 가짜 십자가예요. 지시별이 없고, 가운데 다섯째 별도 없어요.",
        marks: [
          { kind: "asterism", id: "false-cross" },
          { kind: "asterism", id: "southern-cross" },
          { kind: "deepSky", id: "carina-nebula" },
        ],
      },
      {
        say: "남십자의 긴 막대(가크룩스 → 아크룩스)를 네 배 반쯤 늘이면 하늘의 남극이에요. 그곳엔 밝은 별이 없어요. 그 아래 지평선이 정남쪽이에요.",
        marks: [
          { kind: "asterism", id: "southern-cross" },
          {
            kind: "hop",
            from: "4763",
            to: "4730",
            times: 4.5,
            lands: { pole: "south" },
          },
          { kind: "pole", south: true },
        ],
        tap: {
          target: { pole: "south" },
          tolDeg: 5,
          prompt: "화살표 끝, 하늘의 남극 자리를 눌러 보세요",
          found:
            "맞아요! 남극의 높이도 위도와 같아요. 시드니는 남위 34°라서 남극이 34° 높이에 있어요.",
        },
      },
      {
        say: "남십자 왼쪽 아래 은하수가 까맣게 뚫린 곳이 석탄자루(먼지 구름)예요. 그리고 북쪽으로 센타우루스 몸통엔 뿌연 별, 오메가 센타우리가 있어요.",
        marks: [
          { kind: "asterism", id: "southern-cross" },
          { kind: "deepSky", id: "coalsack" },
          { kind: "deepSky", id: "omega-cen" },
          { kind: "milkyWay" },
        ],
      },
    ],
    quiz: [
      {
        q: "진짜 남십자와 가짜 십자가를 가르는 가장 좋은 방법은?",
        choices: [
          "곁에 아주 밝은 지시별 두 개가 있는지 본다",
          "더 큰 쪽이 진짜다",
          "더 높이 뜬 쪽이 진짜다",
        ],
        answer: 0,
        why: "알파 센타우리와 하다르가 진짜 남십자를 가리켜요. 가짜 십자가는 더 크고 지시별이 없어요.",
      },
      {
        q: "남십자의 긴 막대를 몇 배쯤 늘이면 하늘의 남극일까요?",
        choices: ["약 1배", "약 4.5배", "약 10배"],
        answer: 1,
        why: "가크룩스 → 아크룩스를 네 배 반쯤 늘이면 남극 근처예요.",
      },
    ],
    fact: "오메가 센타우리는 약 1만 7천 광년 떨어진, 별 약 1천만 개의 거대한 구상성단이에요. 오래된 작은 은하가 우리은하에 먹히고 남은 심장일지도 몰라요.",
    basics: ["star-hopping", "earth-coords"],
    learns: [
      "a:southern-cross",
      "a:pointers",
      "a:false-cross",
      "d:coalsack",
      "d:omega-cen",
      "d:carina-nebula",
      "c:남십자자리",
      "c:센타우루스자리",
      "c:용골자리",
      "c:돛자리",
    ],
  },
  {
    id: "south-clouds",
    title: "마젤란 구름과 거꾸로 선 오리온",
    icon: "☁️",
    summary: "남반구 여름 밤의 대·소마젤란은하, 47 Tuc, 물구나무 선 오리온",
    stamp: "south",
    hemisphere: "south",
    place: SYDNEY_PLACE,
    time: { y: 2027, m: 1, d: 10, h: 22, min: 0 },
    magLimit: 5,
    lightPollution: 0.15,
    steps: [
      {
        say: "1월 10일 밤 10시, 시드니. 남반구는 한여름이에요. 북쪽 하늘을 보면 낯익은 오리온이 있는데… 거꾸로 서 있어요!",
        marks: [
          { kind: "constellation", label: "오리온자리" },
          { kind: "asterism", id: "orion-belt" },
        ],
      },
      {
        say: "남반구에서는 북쪽을 보며 서니 우리와 위아래가 뒤집혀 보여요. 리겔이 위, 베텔게우스가 아래예요. 오스트레일리아에선 허리띠와 칼을 '냄비(The Saucepan)'라고 불러요.",
        marks: [
          { kind: "constellation", label: "오리온자리" },
          { kind: "star", hr: "1713" },
          { kind: "star", hr: "2061" },
        ],
        tap: {
          target: { hr: "1713" },
          tolDeg: 3,
          prompt: "지금 위쪽에 있는 푸른 별, 리겔을 눌러 보세요",
          found: "리겔! 우리나라에선 오리온의 발이지만 여기선 머리 위쪽이에요.",
        },
      },
      {
        say: "이제 남쪽 하늘. 두 번째로 밝은 별 카노푸스와 하늘의 남극 사이에 떨어져 나온 은하수 조각 같은 구름이 있어요. 대마젤란은하예요.",
        marks: [
          { kind: "deepSky", id: "lmc" },
          { kind: "star", hr: "2326" },
          { kind: "pole", south: true },
        ],
        tap: {
          target: { deepSky: "lmc" },
          tolDeg: 6,
          prompt: "대마젤란은하를 눌러 보세요",
          found:
            "대마젤란은하! 약 16만 광년 떨어진, 우리은하를 도는 이웃 은하예요.",
        },
      },
      {
        say: "남극을 사이에 두고 반대쪽엔 더 작은 소마젤란은하, 바로 곁엔 별처럼 보이는 구상성단 큰부리새자리 47이 있어요. 그 너머 밝은 별은 아케르나르예요.",
        marks: [
          { kind: "deepSky", id: "smc" },
          { kind: "deepSky", id: "47tuc" },
          { kind: "deepSky", id: "lmc" },
          { kind: "star", hr: "472" },
        ],
      },
    ],
    quiz: [
      {
        q: "남반구 여름 밤에 오리온은 어떻게 보일까요?",
        choices: [
          "북쪽 하늘에 거꾸로 (리겔이 위)",
          "남쪽 하늘에 똑바로",
          "아예 안 보인다",
        ],
        answer: 0,
        why: "적도 근처 별자리는 남반구에선 북쪽 하늘에 뜨고, 보는 방향이 반대라 위아래가 뒤집혀 보여요.",
      },
      {
        q: "마젤란은하는 무엇일까요?",
        choices: [
          "우리은하를 도는 이웃 은하",
          "우리은하 안의 구름",
          "가까운 성운",
        ],
        answer: 0,
        why: "대마젤란은하는 약 16만 광년, 소마젤란은하는 약 20만 광년 떨어진 작은 은하들이에요.",
      },
    ],
    fact: "1987년 대마젤란은하에서 초신성(SN 1987A)이 터져 약 400년 만에 맨눈으로 보였어요. 그 빛은 약 16만 년 전 출발한 것이었어요.",
    basics: ["milky-way"],
    learns: [
      "d:lmc",
      "d:smc",
      "d:47tuc",
      "c:황새치자리",
      "c:큰부리새자리",
      "c:에리다누스자리",
    ],
  },
  {
    id: "milky-way",
    title: "은하수 찾기",
    icon: "🌠",
    summary:
      "은하 중심 방향, 계절마다 다른 은하수, 그리고 은하수를 지우는 불빛과 달",
    stamp: "milkyway",
    hemisphere: "north",
    place: YEONGYANG_PLACE,
    time: { y: 2026, m: 8, d: 12, h: 21, min: 30 },
    magLimit: 5.5,
    lightPollution: 0.06,
    steps: [
      {
        say: "8월 12일 저녁 9시 반, 경북 영양의 반딧불이 밤하늘 보호공원. 그믐이라 달이 없어요. 남쪽 지평선에서 머리 위까지 희뿌연 띠가 솟아 있어요. 은하수예요.",
        marks: [{ kind: "milkyWay" }],
        view: { az: 185, alt: 42, fov: 100 },
      },
      {
        say: "은하수는 우리은하를 안에서 본 모습이에요. 원반 모양 은하 속에 있으니 원반이 하늘을 한 바퀴 두르는 띠로 보여요.",
        marks: [
          { kind: "milkyWay" },
          { kind: "asterism", id: "summer-triangle" },
        ],
      },
      {
        say: "은하수가 가장 굵고 밝은 곳은 궁수자리 찻주전자 위예요. 그 너머 약 2만 6천 광년에 우리은하의 중심이 있어요.",
        marks: [
          { kind: "milkyWay" },
          { kind: "asterism", id: "teapot" },
          { kind: "deepSky", id: "galactic-center" },
          { kind: "deepSky", id: "m8" },
        ],
        tap: {
          target: { deepSky: "galactic-center" },
          tolDeg: 6,
          prompt: "우리은하 중심 방향을 눌러 보세요 (찻주전자 주둥이 근처)",
          found:
            "맞아요! 여름 은하수가 화려한 건 은하 중심 쪽을 보기 때문이에요.",
        },
      },
      {
        say: "같은 자리, 같은 시각인데 서울 도심이라면? 광해(도시 불빛)가 하늘을 밝혀 3등급보다 어두운 별과 은하수가 모두 지워져요.",
        sky: { magLimit: 3, lightPollution: 0.85 },
        marks: [
          { kind: "milkyWay" },
          { kind: "asterism", id: "summer-triangle" },
        ],
        view: { az: 185, alt: 42, fov: 100 },
      },
      {
        say: "2주 뒤(8월 26일), 보름이 가까운 달이 뜬 밤이에요. 어두운 시골이어도 달빛이 하늘을 밝혀 은하수가 거의 안 보여요. 은하수는 그믐 무렵에 보러 가요.",
        time: { y: 2026, m: 8, d: 26, h: 21, min: 30 },
        marks: [
          { kind: "milkyWay" },
          { kind: "asterism", id: "summer-triangle" },
        ],
        view: { az: 175, alt: 42, fov: 100 },
      },
      {
        say: "겨울엔 반대쪽, 은하 바깥쪽을 봐요. 오리온 옆 겨울철 대삼각형 안을 지나는 은하수는 여름보다 훨씬 희미해요. 별이 적은 은하 가장자리 쪽이라서예요.",
        time: { y: 2027, m: 2, d: 6, h: 21, min: 0 },
        marks: [
          { kind: "milkyWay" },
          { kind: "asterism", id: "winter-triangle" },
        ],
      },
    ],
    quiz: [
      {
        q: "은하수가 가장 밝고 굵은 곳은 어느 별자리 쪽일까요?",
        choices: ["궁수자리", "오리온자리", "큰곰자리", "페가수스자리"],
        answer: 0,
        why: "궁수자리 쪽이 우리은하의 중심 방향이에요.",
      },
      {
        q: "은하수를 보기 가장 좋은 날은?",
        choices: [
          "어두운 시골, 그믐 무렵의 여름 밤",
          "도시, 보름달 밤",
          "어두운 시골, 보름달 밤",
        ],
        answer: 0,
        why: "광해도 달빛도 은하수를 지워요. 불빛 없는 곳, 달 없는 밤이 좋아요.",
      },
    ],
    fact: "우리은하에는 별이 1천억~4천억 개 있어요. 해는 은하 중심에서 약 2만 6천 광년 떨어져, 약 2억 3천만 년에 한 바퀴씩 은하를 돌아요.",
    links: [
      { href: "/games/tonight", label: "오늘 밤 내 하늘 (달·박명 보기)" },
    ],
    basics: ["milky-way"],
    learns: ["d:galactic-center", "d:m8", "a:teapot", "a:milk-dipper"],
  },
  {
    id: "ecliptic",
    title: "해의 길, 황도 별자리 13개",
    icon: "☀️",
    summary: "해가 1년 동안 지나는 별자리를 순서대로, 13번째 뱀주인자리까지",
    stamp: "ecliptic",
    hemisphere: "north",
    place: SEOUL_PLACE,
    time: { y: 2026, m: 8, d: 12, h: 21, min: 30 },
    magLimit: 4.5,
    lightPollution: 0.3,
    steps: [
      {
        say: "8월 12일 저녁 9시 반, 서울. 점선이 황도, 해가 1년 동안 별 사이를 지나는 길이에요. 낮에는 해가 너무 밝아 그 뒤 별자리가 안 보여요.",
        marks: [{ kind: "ecliptic" }],
      },
      {
        say: "황도를 따라 서쪽(오른쪽)부터 천칭 → 전갈 → 뱀주인 → 궁수 → 염소. 지금 밤하늘의 황도 별자리는 해가 몇 달 뒤(또는 전)에 지날 곳이에요.",
        marks: [
          { kind: "ecliptic" },
          { kind: "constellation", label: "천칭자리" },
          { kind: "constellation", label: "전갈자리" },
          { kind: "constellation", label: "뱀주인자리" },
          { kind: "constellation", label: "궁수자리" },
          { kind: "constellation", label: "염소자리" },
        ],
      },
      {
        say: "전갈과 궁수 사이, 황도가 뱀주인자리를 지나요. 해는 11월 30일 무렵부터 12월 17일 무렵까지 뱀주인자리에 머물러요. 그래서 실제로 해가 지나는 별자리는 13개예요.",
        marks: [
          { kind: "ecliptic" },
          { kind: "constellation", label: "뱀주인자리" },
        ],
        tap: {
          target: { hr: "6556" },
          tolDeg: 4,
          prompt: "뱀주인자리 머리 별 라스알하게를 눌러 보세요",
          found: "뱀주인자리! 점성술의 12궁에는 없지만 해는 이곳을 지나요.",
        },
      },
      {
        say: "11월 저녁엔 반대쪽 황도가 보여요. 염소 → 물병 → 물고기 → 양 → 황소. 해는 이 순서대로 1년에 한 바퀴, 하루에 약 1°씩 동쪽으로 옮겨 가요.",
        time: { y: 2026, m: 11, d: 10, h: 21, min: 0 },
        marks: [
          { kind: "ecliptic" },
          { kind: "constellation", label: "물병자리" },
          { kind: "constellation", label: "물고기자리" },
          { kind: "constellation", label: "양자리" },
          { kind: "constellation", label: "황소자리" },
        ],
      },
    ],
    quiz: [
      {
        q: "해가 지나는 순서로 바른 것은?",
        choices: [
          "전갈 → 뱀주인 → 궁수",
          "궁수 → 뱀주인 → 전갈",
          "전갈 → 궁수 → 뱀주인",
        ],
        answer: 0,
        why: "해는 황도를 따라 서쪽에서 동쪽으로, 전갈 → 뱀주인 → 궁수 순서로 지나요.",
      },
      {
        q: "8월 저녁 남쪽 하늘의 황도 별자리를 해가 지나는 때는?",
        choices: ["몇 달 뒤 겨울 무렵", "바로 오늘 낮", "한 해 내내"],
        answer: 0,
        why: "밤에 보이는 건 해의 반대쪽이에요. 8월 밤의 궁수자리에는 해가 12월 말에 가요.",
      },
    ],
    fact: "점성술의 별자리는 약 2천 년 전 하늘에 맞춰 정했어요. 그 뒤 세차 운동으로 춘분점이 약 30° 밀려, 지금은 생일에 해가 있는 실제 별자리가 대부분 한 칸 이전 별자리예요.",
    links: [{ href: "/games/birthday", label: "생일 별자리" }],
    basics: ["earth-tilt"],
    learns: [
      "c:뱀주인자리",
      "c:천칭자리",
      "c:염소자리",
      "c:물병자리",
      "c:물고기자리",
      "c:양자리",
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);

// 북반구 사계절 수업을 다 마치면 남반구 하늘이 열린다
export const southUnlocked = (done: (id: string) => boolean) =>
  SEASON_LESSONS.every(done);
