import type { Hemisphere } from "@/game/starSchool/asterisms";

// 맨눈으로 보이는 딥스카이(별 말고 성단·성운·은하): 위치는 J2000 적경·적위(°), 거리는 널리 쓰는 값으로 어림해 적는다.
// 위치는 SIMBAD·NASA/IPAC 목록과 같은 값이다 (테스트에서 표준값과 1° 안으로 맞는지 확인한다).

export type DeepSkyKind =
  | "은하"
  | "산개성단"
  | "구상성단"
  | "성운"
  | "암흑 성운"
  | "은하 중심";

export interface DeepSky {
  id: string;
  name: string;
  raDeg: number;
  decDeg: number;
  kind: DeepSkyKind;
  constellation: string;
  distance: string;
  season: string;
  hemisphere: Hemisphere;
  howTo: string;
  fact: string;
  sizeDeg: number; // 하늘에서 보이는 대략의 크기 (표시 고리)
}

export const DEEP_SKY: DeepSky[] = [
  {
    id: "m31",
    name: "안드로메다은하 (M31)",
    raDeg: 10.6847,
    decDeg: 41.2687,
    kind: "은하",
    constellation: "안드로메다자리",
    distance: "약 250만 광년",
    season: "가을",
    hemisphere: "north",
    howTo:
      "페가수스 대사각형의 알페라츠에서 동쪽으로 미라크까지 간 뒤, 북쪽(위)으로 희미한 별 두 개를 건너뛰면 뿌연 타원이 보여요.",
    fact: "지금 보는 빛은 약 250만 년 전, 지구에 최초의 사람 속(호모)이 나타날 무렵 출발했어요. 맨눈으로 보이는 가장 먼 천체예요.",
    sizeDeg: 3,
  },
  {
    id: "m33",
    name: "삼각형자리은하 (M33)",
    raDeg: 23.4621,
    decDeg: 30.6599,
    kind: "은하",
    constellation: "삼각형자리",
    distance: "약 270만 광년",
    season: "가을",
    hemisphere: "north",
    howTo:
      "미라크를 사이에 두고 안드로메다은하 반대쪽(남동쪽)에 있어요. 아주 어두운 곳에서 곁눈으로 겨우 보여요.",
    fact: "맨눈 시험의 끝판왕. 보인다면 하늘이 정말 어두운 곳이에요.",
    sizeDeg: 1.2,
  },
  {
    id: "m45",
    name: "플레이아데스 성단 (좀생이별, M45)",
    raDeg: 56.75,
    decDeg: 24.1167,
    kind: "산개성단",
    constellation: "황소자리",
    distance: "약 440광년",
    season: "늦가을·겨울",
    hemisphere: "north",
    howTo:
      "오리온 허리띠를 오른쪽 위로 이어 붉은 알데바란을 지나, 같은 만큼 더 가면 작은 국자처럼 모인 별 무리가 있어요.",
    fact: "맨눈으로 6~7개가 보이지만 실제로는 천 개가 넘는 젊은 별(나이 약 1억 년)이 모여 있어요. 일본 이름은 '스바루'예요.",
    sizeDeg: 1.8,
  },
  {
    id: "hyades",
    name: "히아데스 성단",
    raDeg: 66.75,
    decDeg: 15.87,
    kind: "산개성단",
    constellation: "황소자리",
    distance: "약 150광년",
    season: "겨울",
    hemisphere: "north",
    howTo:
      "황소의 얼굴인 V자 별 무리예요. V의 한쪽 끝에 붉은 알데바란이 붙어 있어요.",
    fact: "해에서 가장 가까운 산개성단이에요. 알데바란(약 65광년)은 그보다 훨씬 앞에 있는, 성단과 상관없는 별이에요.",
    sizeDeg: 5.5,
  },
  {
    id: "m42",
    name: "오리온 대성운 (M42)",
    raDeg: 83.8221,
    decDeg: -5.3911,
    kind: "성운",
    constellation: "오리온자리",
    distance: "약 1,300광년",
    season: "겨울",
    hemisphere: "north",
    howTo:
      "오리온 허리띠 아래로 늘어진 작은 별 세 개(오리온의 칼, 소삼태성)의 가운데 별이 뿌옇게 번져 보여요.",
    fact: "지금도 별이 태어나고 있는, 맨눈으로 보이는 가장 밝은 별 공장이에요.",
    sizeDeg: 1.4,
  },
  {
    id: "m44",
    name: "벌집 성단 (프레세페, M44)",
    raDeg: 130.1,
    decDeg: 19.67,
    kind: "산개성단",
    constellation: "게자리",
    distance: "약 600광년",
    season: "초봄",
    hemisphere: "north",
    howTo:
      "쌍둥이자리 폴룩스와 사자자리 레굴루스를 이은 선의 가운데쯤, 어두운 게자리 한복판의 뿌연 얼룩이에요.",
    fact: "갈릴레이가 망원경으로 처음 들여다보고 별 40개 넘게 셌어요. 맨눈으로는 구름 한 조각처럼 보여요.",
    sizeDeg: 1.6,
  },
  {
    id: "m13",
    name: "헤르쿨레스자리 구상성단 (M13)",
    raDeg: 250.4235,
    decDeg: 36.4613,
    kind: "구상성단",
    constellation: "헤르쿨레스자리",
    distance: "약 2만 2천 광년",
    season: "여름",
    hemisphere: "north",
    howTo:
      "헤르쿨레스자리 몸통의 찌그러진 네모(키스톤)에서 서쪽 변의 3분의 1쯤에 있어요. 어두운 곳에서만 희미한 점으로 보여요.",
    fact: "별 수십만 개가 공처럼 모여 있어요. 1974년 아레시보 전파 망원경이 이쪽으로 외계인에게 보내는 메시지를 쏘았어요.",
    sizeDeg: 0.5,
  },
  {
    id: "m7",
    name: "프톨레마이오스 성단 (M7)",
    raDeg: 268.4625,
    decDeg: -34.7928,
    kind: "산개성단",
    constellation: "전갈자리",
    distance: "약 1,000광년",
    season: "여름 (남쪽 지평선 가까이)",
    hemisphere: "north",
    howTo: "전갈의 꼬리 끝 독침(샤울라) 왼쪽 위(북동쪽)의 별 무리예요.",
    fact: "약 1,900년 전 프톨레마이오스가 '전갈 꼬리 뒤의 안개'라고 적어 둔 성단이에요.",
    sizeDeg: 1.3,
  },
  {
    id: "m8",
    name: "석호 성운 (M8)",
    raDeg: 270.9042,
    decDeg: -24.3867,
    kind: "성운",
    constellation: "궁수자리",
    distance: "약 4,100광년",
    season: "여름",
    hemisphere: "north",
    howTo:
      "궁수자리 찻주전자 주둥이 위로 피어오르는 '김' 속의 밝은 덩어리예요.",
    fact: "어두운 곳에서는 맨눈으로도 은하수 속 작은 구름처럼 보여요.",
    sizeDeg: 1.5,
  },
  {
    id: "double-cluster",
    name: "페르세우스 이중성단",
    raDeg: 35.0,
    decDeg: 57.13,
    kind: "산개성단",
    constellation: "페르세우스자리",
    distance: "약 7,500광년",
    season: "가을·겨울",
    hemisphere: "north",
    howTo:
      "카시오페이아 W와 페르세우스자리 사이, 은하수 속에 나란히 붙은 두 뿌연 얼룩이에요.",
    fact: "쌍안경으로 보면 보석 상자처럼 별이 쏟아져요. 두 성단은 서로 수백 광년 떨어져 있어요.",
    sizeDeg: 1,
  },
  {
    id: "galactic-center",
    name: "우리은하 중심 방향 (궁수자리 A*)",
    raDeg: 266.4168,
    decDeg: -29.0078,
    kind: "은하 중심",
    constellation: "궁수자리",
    distance: "약 2만 6천 광년",
    season: "여름 (남쪽 낮은 하늘)",
    hemisphere: "north",
    howTo:
      "궁수자리 찻주전자 주둥이에서 조금 오른쪽(서쪽), 전갈 꼬리 사이예요. 은하수가 가장 굵고 밝게 부푼 곳이에요.",
    fact: "그 한가운데에 해 질량의 약 400만 배인 블랙홀이 있어요. 2022년 사건 지평선 망원경이 그 그림자를 찍었어요.",
    sizeDeg: 4,
  },
  {
    id: "lmc",
    name: "대마젤란은하",
    raDeg: 80.8938,
    decDeg: -69.7561,
    kind: "은하",
    constellation: "황새치자리",
    distance: "약 16만 광년",
    season: "남반구 여름 (12~3월 저녁)",
    hemisphere: "south",
    howTo:
      "카노푸스와 하늘의 남극 사이, 떨어져 나온 은하수 조각처럼 보이는 큰 구름이에요. 길이가 보름달 20개를 나란히 놓은 만큼이에요.",
    fact: "우리은하를 도는 이웃 은하예요. 1987년 이곳에서 터진 초신성(SN 1987A)은 400년 만에 맨눈으로 보인 초신성이었어요.",
    sizeDeg: 10,
  },
  {
    id: "smc",
    name: "소마젤란은하",
    raDeg: 13.1867,
    decDeg: -72.8286,
    kind: "은하",
    constellation: "큰부리새자리",
    distance: "약 20만 광년",
    season: "남반구 봄·여름 (10~1월 저녁)",
    hemisphere: "south",
    howTo:
      "아케르나르와 하늘의 남극 사이의 작은 구름이에요. 바로 곁에 구상성단 큰부리새자리 47이 붙어 보여요.",
    fact: "1519~1522년 마젤란 원정대가 기록을 남겨 이름이 붙었지만, 남반구 사람들은 그보다 훨씬 오래전부터 알았어요.",
    sizeDeg: 5,
  },
  {
    id: "47tuc",
    name: "큰부리새자리 47 (47 Tuc)",
    raDeg: 6.0236,
    decDeg: -72.0813,
    kind: "구상성단",
    constellation: "큰부리새자리",
    distance: "약 1만 3천~1만 5천 광년",
    season: "남반구 봄·여름",
    hemisphere: "south",
    howTo:
      "소마젤란은하 서쪽 바로 곁의 별처럼 보이는 뿌연 점이에요. 그래서 처음엔 별 이름(47번)이 붙었어요.",
    fact: "오메가 센타우리 다음으로 밝은 구상성단이에요. 은하수 너머 소마젤란은하보다 열 배 넘게 가까워요.",
    sizeDeg: 0.6,
  },
  {
    id: "omega-cen",
    name: "오메가 센타우리",
    raDeg: 201.6968,
    decDeg: -47.4795,
    kind: "구상성단",
    constellation: "센타우루스자리",
    distance: "약 1만 7천 광년",
    season: "남반구 가을·겨울 (4~7월 저녁)",
    hemisphere: "south",
    howTo:
      "지시별 하다르에서 북쪽으로 주먹 한 개 반쯤, 센타우루스자리 몸통 한가운데의 뿌연 별이에요.",
    fact: "우리은하에서 가장 큰 구상성단으로 별이 약 1천만 개예요. 작은 은하가 먹히고 남은 심장이라는 생각도 있어요.",
    sizeDeg: 0.6,
  },
  {
    id: "coalsack",
    name: "석탄자루",
    raDeg: 192.5,
    decDeg: -62.5,
    kind: "암흑 성운",
    constellation: "남십자자리",
    distance: "약 600광년",
    season: "남반구 가을·겨울",
    hemisphere: "south",
    howTo:
      "남십자 왼쪽 아래(아크룩스와 미모사 곁)의 은하수가 까맣게 뚫린 자리예요.",
    fact: "구멍이 아니라 먼지 구름이 뒤쪽 은하수 별빛을 가린 것이에요. 오스트레일리아 원주민은 이것을 하늘 에뮤의 머리로 봤어요.",
    sizeDeg: 5,
  },
  {
    id: "carina-nebula",
    name: "용골자리 성운",
    raDeg: 161.2646,
    decDeg: -59.8667,
    kind: "성운",
    constellation: "용골자리",
    distance: "약 7,500~8,500광년",
    season: "남반구 가을 (3~5월 저녁)",
    hemisphere: "south",
    howTo:
      "남십자와 가짜 십자가 사이, 은하수 속에서 오리온 대성운보다 크고 밝게 빛나는 구름이에요.",
    fact: "그 속의 별 에타 카리나이는 1843년 갑자기 밝아져 한때 하늘에서 두 번째로 밝은 별이 됐어요.",
    sizeDeg: 2,
  },
];

export const deepSkyById = (id: string) => {
  const d = DEEP_SKY.find((x) => x.id === id);

  if (!d) {
    throw new Error(`없는 딥스카이 ${id}`);
  }

  return d;
};
