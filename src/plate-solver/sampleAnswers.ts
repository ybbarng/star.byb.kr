import type { Point3D } from "@/scripts/hash/types";

// 정제된 별 라벨(data/search)로 검증한 "알려진 정답" 포즈. 샘플을 plate solving 할 때
// 후보 중 어느 것이 정답인지 표시해 헷갈리지 않게 한다.
// 중심(광축)은 정확하고, FOV는 8개 별로 추정한 근사값이라 "약"으로 본다.
export interface SampleAnswer {
  centerRaDeg: number;
  centerDecDeg: number;
  fovDeg: number;
  name: string; // 사람이 읽을 별자리/하늘 영역 이름
  // 정제 라벨로 검증한 정확한 포즈가 아니라, 사진 설명으로 추정한 대략 위치일 때 true.
  // 이 경우 후보에 ✓ 정답 배지를 달지 않고 "예상 영역"으로만 안내한다.
  approximate?: boolean;
}

// 키는 샘플 파일명(samples.ts의 src 마지막 조각).
const byFilename: Record<string, SampleAnswer> = {
  "big-dipper.jpg": {
    centerRaDeg: 184,
    centerDecDeg: 56,
    fovDeg: 36,
    name: "큰곰자리 (북두칠성)",
  },
  "20190617-jarrod-saipan.jpg": {
    centerRaDeg: 225.5,
    centerDecDeg: -66,
    fovDeg: 51,
    name: "센타우루스·남십자 (남반구)",
  },
  // 여름 은하수(은하 중심부). 처음엔 어안으로 봤지만, 건물을 세운 원근 보정 사진이었다.
  // 촬영 기록(출처 https://naver.me/5xgcLXzT): 2022-03-27 04:30 서울 송파구 석촌호수, 24mm,
  // 소니 A7s 근적외선 개조 + IR720 필터, ISO1000 15초 1장. 파일 이름의 날짜(28일)는 촬영일이 아니다.
  // 자동 풀이(밝은 별 삼각형 + 원근 정밀화)가 log-odds 18.5로 확신한 중심이 이 값과 0.5° 이내.
  "20220328-brice-Milky Way over Buzzvil.jpg": {
    centerRaDeg: 277,
    centerDecDeg: -12,
    fovDeg: 73,
    name: "여름 은하수 (방패·궁수·전갈·독수리)",
  },
  // 브라우저 풀이가 유의도 37.7로 확신한 해. 중심 별이 북두칠성 7별(Megrez·Alioth·
  // Phecda·Mizar·Dubhe·Merak·Alkaid)임을 카탈로그로 확인.
  "20230904-nike-jeungseun-02.png": {
    centerRaDeg: 184.7,
    centerDecDeg: 58.5,
    fovDeg: 55.5,
    name: "큰곰자리 (북두칠성)",
  },
  // 브라우저 풀이가 유의도 75.0으로 확신한 해. 중심 별이 오리온 삼태성(Mintaka·Alnilam·
  // Alnitak) + Betelgeuse·Rigel·Bellatrix임을 카탈로그로 확인.
  // 자동 풀이가 log-odds 17로 확신한 해. 예측 위치에 남십자(Acrux·Mimosa·Gacrux)·
  // 리길 켄타우루스·하다르·Atria·Miaplacidus가 사진 속 밝은 별과 겹침을 눈으로 확인.
  "20231012-nike-aust-01.jpg": {
    centerRaDeg: 202.2,
    centerDecDeg: -66.1,
    fovDeg: 59.1,
    name: "남십자·켄타우루스 (남반구)",
  },
  // 아래 여섯은 지면을 뺀 위쪽 영역으로 자동으로 확신한 해. 예측 위치에 겹친 별을 눈으로 확인.
  // 카시오페이아 W(Navi·Schedar·Caph)·북극성·Alderamin (데네브는 산 너머 자리)
  "20220607-berry-seoul.jpg": {
    centerRaDeg: 320.7,
    centerDecDeg: 61,
    fovDeg: 56.1,
    name: "카시오페이아·케페우스·북극성",
  },
  // 오로라 속 북두칠성(Dubhe·Merak·Phecda·Alioth·Mizar·Alkaid)
  "20250117-carl-aurora-02.jpg": {
    centerRaDeg: 191.3,
    centerDecDeg: 33,
    fovDeg: 52.7,
    name: "큰곰자리 (북두칠성)",
  },
  // 북두칠성 7별·북극성·Kochab (구름 낀 초저녁 하늘)
  "20230904-nike-jeungseun-01.png": {
    centerRaDeg: 182.7,
    centerDecDeg: 57.8,
    fovDeg: 55.2,
    name: "큰곰자리 (북두칠성)·북극성",
  },
  // 오로라 너머 페르세우스(Mirfak·Algol)·안드로메다(Almach·Mirach)·플레이아데스
  "20250117-carl-aurora-01.jpg": {
    centerRaDeg: 41.1,
    centerDecDeg: 22.5,
    fovDeg: 52.3,
    name: "페르세우스·안드로메다·플레이아데스",
  },
  // 오로라 너머 카시오페이아 W·북극성·데네브
  "20250117-carl-aurora-03.jpg": {
    centerRaDeg: 340.6,
    centerDecDeg: 61.8,
    fovDeg: 52.6,
    name: "카시오페이아·북극성",
  },
  // 오로라 아래 직녀성·데네브·Sadr (견우성은 지면 아래 자리)
  "20250117-carl-aurora-04.jpg": {
    centerRaDeg: 278.1,
    centerDecDeg: 41.6,
    fovDeg: 52.7,
    name: "거문고·백조 (여름의 대삼각형)",
  },
  // 아래 셋은 개선 quad solver가 자동으로 확신한 해. 예측 위치에 겹친 별을 눈으로 확인.
  // 카시오페이아 W(Caph·Schedar·Navi·Ruchbah)·북극성·Kochab
  "20230904-nike-jeungseun-03.png": {
    centerRaDeg: 350.7,
    centerDecDeg: 65.8,
    fovDeg: 55,
    name: "카시오페이아·북극성",
  },
  // 여름의 대삼각형(직녀성·데네브·견우성)·백조자리 Sadr. 어두운 사진이라 log-odds 9.7로 기준을 간신히 넘음
  "20230904-nike-jeungseun-04.png": {
    centerRaDeg: 289.5,
    centerDecDeg: 29,
    fovDeg: 54.8,
    name: "여름의 대삼각형 (거문고·백조·독수리)",
  },
  // 안타레스·전갈 꼬리(Shaula·Sargas)·리길 켄타우루스·하다르
  "20231012-nike-aust-02.jpg": {
    centerRaDeg: 241.5,
    centerDecDeg: -33.9,
    fovDeg: 58.2,
    name: "전갈·켄타우루스 (남반구)",
  },
  "cafe-orion.jpg": {
    centerRaDeg: 83.1,
    centerDecDeg: 1.2,
    fovDeg: 16.8,
    name: "오리온자리",
  },
  // 옐로나이프 오로라: 카시오페이아·세페우스·안드로메다(M31)·백조(데네브·사드르), 가운데 도마뱀자리.
  // 앱과 같은 풀이(8초)로 0.2초에 확신 (log-odds 44, 2026-10-27)
  "20240401-brice-yellowknife-aurora.jpg": {
    centerRaDeg: 335.3,
    centerDecDeg: 47.2,
    fovDeg: 37.6,
    name: "카시오페이아·안드로메다·백조자리",
  },
  // 아래 열둘은 위키미디어 공용의 자유 이용 샘플(samples.ts의 credit). 앱과 같은 풀이(8초)로
  // 확신한 해(log-odds 17~80)이고, 겹친 별 이름이 사진 속 별자리와 맞는지 눈으로 확인했다.
  // 오리온 삼태성·베텔게우스·리겔, 토끼자리 (망루와 논)
  "iau-watchtower-orion.jpg": {
    centerRaDeg: 84.1,
    centerDecDeg: -14,
    fovDeg: 46.9,
    name: "오리온자리",
  },
  // 북두칠성 7별 (달빛 아래 보트 창고)
  "wikimedia-holma-big-dipper.jpg": {
    centerRaDeg: 180.8,
    centerDecDeg: 42.5,
    fovDeg: 45.8,
    name: "큰곰자리 (북두칠성)",
  },
  // 안타레스·전갈 꼬리, 리길 켄타우루스·하다르, 이리자리
  "iau-nindiri-scorpius.jpg": {
    centerRaDeg: 228,
    centerDecDeg: -47.4,
    fovDeg: 51.4,
    name: "전갈·센타우루스·이리",
  },
  // 데네브·직녀성·견우성 (해 진 뒤 서쪽으로 지는 여름의 대삼각형)
  "iau-snow-tree-summer-triangle.jpg": {
    centerRaDeg: 292.4,
    centerDecDeg: 26.9,
    fovDeg: 51.5,
    name: "여름의 대삼각형 (백조·거문고·독수리)",
  },
  // 남십자(아크룩스·미모사·가크룩스)·용골자리 성운·켄타우루스
  "eso-southern-cross.jpg": {
    centerRaDeg: 178.7,
    centerDecDeg: -45.9,
    fovDeg: 36.8,
    name: "남십자·켄타우루스 (남반구)",
  },
  // 카시오페이아 W·페르세우스 (번개 치는 마을)
  "wikimedia-lightning-cassiopeia.jpg": {
    centerRaDeg: 28.1,
    centerDecDeg: 60.9,
    fovDeg: 33.8,
    name: "카시오페이아·페르세우스",
  },
  // 오리온·바너드 고리 (에트나 화산 위)
  "iau-etna-orion.jpg": {
    centerRaDeg: 86.7,
    centerDecDeg: 5.8,
    fovDeg: 28.6,
    name: "오리온자리",
  },
  // 은하수 중심: 궁수 주전자·전갈 꼬리·석호 성운 (모래 언덕)
  "nps-medano-milky-way.jpg": {
    centerRaDeg: 262.9,
    centerDecDeg: -32.3,
    fovDeg: 45.9,
    name: "은하수 중심 (궁수·전갈)",
  },
  // 북두칠성 7별 (풍력 발전기 불빛)
  "wikimedia-windfarm-big-dipper.jpg": {
    centerRaDeg: 172.8,
    centerDecDeg: 64.5,
    fovDeg: 36.2,
    name: "큰곰자리 (북두칠성)",
  },
  // 오리온·에리다누스·리겔 (교회 폐허)
  "iau-baigorri-orion.jpg": {
    centerRaDeg: 71.8,
    centerDecDeg: -14,
    fovDeg: 59,
    name: "오리온·에리다누스",
  },
  // 여름 은하수: 방패·뱀·독수리·궁수 (섬마을 집, 넓은 화각이라 2~3초)
  "nps-manitou-milky-way.jpg": {
    centerRaDeg: 275.6,
    centerDecDeg: -1.3,
    fovDeg: 65.4,
    name: "여름 은하수 (방패·독수리·궁수)",
  },
  // 전갈 꼬리·M6·M7·석호 성운·제단자리 (바위 옆 텐트)
  "wikimedia-tents-sagittarius.jpg": {
    centerRaDeg: 249.5,
    centerDecDeg: -53.5,
    fovDeg: 48.6,
    name: "전갈·제단 (남쪽 은하수)",
  },
};

// image.src(URL)에서 파일명을 뽑아 알려진 정답을 찾는다. 업로드 사진은 정답이 없다.
export const getSampleAnswer = (src?: string): SampleAnswer | null => {
  if (!src) {
    return null;
  }

  const file = decodeURIComponent(src.split("/").pop() ?? "");

  return byFilename[file] ?? null;
};

// RA/Dec(도) → 천구 단위 벡터
export const answerVector = (a: SampleAnswer): Point3D => {
  const ra = (a.centerRaDeg * Math.PI) / 180;
  const dec = (a.centerDecDeg * Math.PI) / 180;

  return [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ];
};

// 후보 중심이 정답 방향에서 maxDeg 이내인가
export const matchesAnswer = (
  center: Point3D,
  a: SampleAnswer,
  maxDeg = 6,
): boolean => {
  const v = answerVector(a);
  const dot = Math.max(
    -1,
    Math.min(1, center[0] * v[0] + center[1] * v[1] + center[2] * v[2]),
  );

  return (Math.acos(dot) * 180) / Math.PI <= maxDeg;
};
