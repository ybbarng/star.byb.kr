import type { Point3D } from "@/scripts/hash/types";
import { ofDateToJ2000, sunVector } from "@/search/utils/ephemeris";

// 역사 속 실제 혜성의 궤도와 그날 하늘 위치.
//
// 궤도 요소 출처: NASA/JPL Horizons 시스템(https://ssd.jpl.nasa.gov/horizons/, JPL Small-Body Database의 궤도 해)에서
// 2026-10-23에 조회한 해 중심 접촉(osculating) 궤도 요소. 기준면은 J2000 황도, 시각은 TDB 율리우스일.
// 기억으로 적은 값이 아니라 조회 결과를 그대로 옮겼고, 같은 곳에서 받은 지구 중심 위치(적경·적위·별자리)와
// 맞는지 단위 테스트(src/test/unit/wanderers.test.ts)로 확인한다.
//
// 계산: 기준 시각의 궤도 그대로 케플러 운동(타원·쌍곡선)을 풀어 해 중심 위치를 구하고, 지구 위치를 빼서 지구에서 본
// 방향을 얻는다(빛이 오는 시간만큼 앞선 위치). 행성이 당기는 힘(섭동)은 무시해서 기준 시각에서 몇 달 안에서만 맞다.
// 지구 위치는 해 위치 공식(ephemeris.ts, 약 0.01°)을 뒤집어 쓴다. 지구에 아주 가까이 온 혜성(햐쿠타케)은
// 그 오차가 커 보여 0.1°쯤 어긋날 수 있다.

export interface Comet {
  id: string;
  name: string; // 화면에 보일 이름
  designation: string; // 공식 이름
  // 접촉 궤도 요소 (JPL Horizons)
  epochJd: number; // 요소의 기준 시각 (TDB)
  q: number; // 근일점 거리 (au)
  e: number; // 이심률 (1보다 크면 쌍곡선)
  iDeg: number; // 궤도 경사
  nodeDeg: number; // 승교점 경도 Ω
  periDeg: number; // 근일점 인수 ω
  tpJd: number; // 근일점 통과 시각 (TDB)
  // 게임에 쓰는 기간 (UTC, 이 사이에서만 위치를 믿는다)
  from: string;
  to: string;
  perihelionDate: string; // 알려진 근일점 날짜 (테스트로 확인)
  story: string; // 짧은 이야기
}

export const COMETS: Comet[] = [
  {
    id: "halley-1986",
    name: "핼리 혜성",
    designation: "1P/Halley",
    epochJd: 2446470.5, // 1986-02-09
    q: 0.5871034488173393,
    e: 0.9672792271749998,
    iDeg: 162.2422242700916,
    nodeDeg: 58.85993640671803,
    periDeg: 111.8655480539208,
    tpJd: 2446470.958961020689,
    from: "1985-11-20",
    to: "1986-05-15",
    perihelionDate: "1986-02-09",
    story:
      "약 76년마다 돌아오는 혜성이에요. 1986년에는 지구와 먼 쪽에서 해를 돌아 그리 밝지 않았지만, 4월에 남쪽 하늘에서 지구에 가장 가까이 왔어요. 다음엔 2061년에 돌아와요.",
  },
  {
    id: "hyakutake-1996",
    name: "햐쿠타케 혜성",
    designation: "C/1996 B2 (Hyakutake)",
    epochJd: 2450174.5, // 1996-04-01
    q: 0.2302104800871166,
    e: 0.9998830850324421,
    iDeg: 124.92329675632,
    nodeDeg: 188.0452608320556,
    periDeg: 130.1774004296311,
    tpJd: 2450204.894057772588,
    from: "1996-03-05",
    to: "1996-04-30",
    perihelionDate: "1996-05-01",
    story:
      "일본의 아마추어 천문가 햐쿠타케 유지가 찾았어요. 1996년 3월 25일 무렵 지구에 아주 가까이(약 0.1au) 다가와, 며칠 사이에 하늘을 크게 가로질렀어요.",
  },
  {
    id: "hale-bopp-1997",
    name: "헤일-밥 혜성",
    designation: "C/1995 O1 (Hale-Bopp)",
    epochJd: 2450539.5, // 1997-04-01
    q: 0.9141695067003724,
    e: 0.9951314746156615,
    iDeg: 89.43017155012492,
    nodeDeg: 282.470602866853,
    periDeg: 130.5872524854533,
    tpJd: 2450539.633099367842,
    from: "1997-01-15",
    to: "1997-05-15",
    perihelionDate: "1997-04-01",
    story:
      "핵이 아주 큰 혜성이라 지구에서 멀리 있는데도 밝았어요. 1997년 봄 북쪽 하늘에서 아주 오랫동안 맨눈으로 보여 많은 사람이 보았어요.",
  },
  {
    id: "mcnaught-2007",
    name: "맥노트 혜성",
    designation: "C/2006 P1 (McNaught)",
    epochJd: 2454112.5, // 2007-01-12
    q: 0.1707325614080681,
    e: 1.00001811603225,
    iDeg: 77.83726446452654,
    nodeDeg: 267.4149080498975,
    periDeg: 155.9756130642756,
    tpJd: 2454113.298753579147,
    from: "2007-01-17",
    to: "2007-02-10",
    perihelionDate: "2007-01-12",
    story:
      "해에 아주 가까이(0.17au) 다가갔다 나온 혜성이에요. 근일점을 지난 뒤 남반구 저녁 하늘에 부채처럼 펼쳐진 꼬리를 보였어요.",
  },
  {
    id: "neowise-2020",
    name: "네오와이즈 혜성",
    designation: "C/2020 F3 (NEOWISE)",
    epochJd: 2459040.5, // 2020-07-10
    q: 0.2946512802442493,
    e: 0.9991781277745129,
    iDeg: 128.937503500787,
    nodeDeg: 61.01043276159086,
    periDeg: 37.27868070940993,
    tpJd: 2459034.178900179453,
    from: "2020-07-06",
    to: "2020-08-10",
    perihelionDate: "2020-07-03",
    story:
      "2020년 3월 우주 망원경 NEOWISE가 찾았어요. 7월 북쪽 하늘에서 큰곰자리 아래로 지나가며 맨눈으로도 보였어요.",
  },
  {
    id: "tsuchinshan-atlas-2024",
    name: "쯔진산-아틀라스 혜성",
    designation: "C/2023 A3 (Tsuchinshan-ATLAS)",
    epochJd: 2460588.5, // 2024-10-05
    q: 0.3914206297339811,
    e: 1.000040306948041,
    iDeg: 139.1105308568978,
    nodeDeg: 21.55947258094615,
    periDeg: 308.4891489400875,
    tpJd: 2460581.241739932448,
    from: "2024-10-10",
    to: "2024-11-10",
    perihelionDate: "2024-09-27",
    story:
      "중국 쯔진산 천문대와 소행성 감시망 ATLAS가 찾았어요. 2024년 10월 해가 진 서쪽 하늘에 긴 꼬리를 드리웠어요.",
  },
];

const D = Math.PI / 180;
const GAUSS_K = 0.01720209895; // 가우스 중력 상수 (au^1.5/일)
const OBLIQUITY_J2000 = 23.43928;

// 단조 증가 함수 f의 근을 [lo, hi]에서 이분법으로 (이심률이 1에 아주 가까워도 흔들리지 않는다)
const solveMonotone = (f: (x: number) => number, lo: number, hi: number) => {
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;

    if (f(mid) < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return (lo + hi) / 2;
};

// 해 중심 J2000 황도 좌표 (au)
export const cometHeliocentric = (
  c: Comet,
  jd: number,
): [number, number, number] => {
  const dt = jd - c.tpJd;
  let xp: number;
  let yp: number;

  if (c.e < 1) {
    const a = c.q / (1 - c.e);
    const n = GAUSS_K / a ** 1.5;
    const M =
      ((((n * dt) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    const E = solveMonotone(
      (x) => x - c.e * Math.sin(x) - M,
      -Math.PI,
      Math.PI,
    );
    xp = a * (Math.cos(E) - c.e);
    yp = a * Math.sqrt(1 - c.e * c.e) * Math.sin(E);
  } else {
    const a = c.q / (c.e - 1);
    const n = GAUSS_K / a ** 1.5;
    const M = n * dt;
    // e·sinh H − H = M. sinh H ≥ H라서 |H| ≤ asinh(|M|/(e−1))
    const bound = Math.asinh(Math.abs(M) / (c.e - 1)) + 1e-9;
    const H = solveMonotone((x) => c.e * Math.sinh(x) - x - M, -bound, bound);
    xp = a * (c.e - Math.cosh(H));
    yp = a * Math.sqrt(c.e * c.e - 1) * Math.sinh(H);
  }

  const omega = c.periDeg * D;
  const node = c.nodeDeg * D;
  const inc = c.iDeg * D;
  const [cw, sw] = [Math.cos(omega), Math.sin(omega)];
  const [cn, sn] = [Math.cos(node), Math.sin(node)];
  const [ci, si] = [Math.cos(inc), Math.sin(inc)];

  return [
    (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
};

// J2000 황도 → J2000 적도
export const eclipticToEquatorial = ([x, y, z]: number[]): Point3D => {
  const ce = Math.cos(OBLIQUITY_J2000 * D);
  const se = Math.sin(OBLIQUITY_J2000 * D);

  return [x, ce * y - se * z, se * y + ce * z];
};

// 지구 중심에서 본 해 (J2000 적도, au). 방향은 ephemeris.ts의 해 공식, 거리는 같은 천문연감 저정밀 공식
export const sunGeocentric = (jd: number): Point3D => {
  const g = (357.528 + 0.9856003 * (jd - 2451545)) * D;
  const R = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
  const v = ofDateToJ2000(sunVector(jd), jd);

  return [v[0] * R, v[1] * R, v[2] * R];
};

export interface CometPosition {
  vector: Point3D; // 지구에서 본 방향 (J2000 적도 단위 벡터)
  distanceAu: number; // 지구까지
  sunDistanceAu: number; // 해까지
  antiSun: Point3D; // 해에서 혜성 쪽 방향 (꼬리가 뻗는 방향, J2000 적도 단위 벡터)
}

export const cometPosition = (c: Comet, jd: number): CometPosition => {
  const sun = sunGeocentric(jd);
  let t = jd;
  let helio: Point3D = [0, 0, 0];
  let geo: number[] = [0, 0, 0];
  let r = 0;

  for (let i = 0; i < 3; i++) {
    helio = eclipticToEquatorial(cometHeliocentric(c, t));
    geo = helio.map((h, k) => h + sun[k]);
    r = Math.hypot(geo[0], geo[1], geo[2]);
    t = jd - r * 0.0057755; // 1au를 빛이 가는 시간(일)
  }

  const rs = Math.hypot(helio[0], helio[1], helio[2]);

  return {
    vector: [geo[0] / r, geo[1] / r, geo[2] / r],
    distanceAu: r,
    sunDistanceAu: rs,
    antiSun: [helio[0] / rs, helio[1] / rs, helio[2] / rs],
  };
};
