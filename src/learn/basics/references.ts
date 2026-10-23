import { STARS } from "@/game/sky/catalog";
import { angleBetweenDeg, parallaxToLightYears } from "@/learn/basics/skyMath";
import parallax from "@build/database/parallax.json";

// 손 각도를 맞춰 볼 기준 쌍: 별 지도(카탈로그)로 계산한 각거리
const v = (latin: string) => STARS.find((s) => s.latinName === latin)!.vector;
const sep = (a: string, b: string) => angleBetweenDeg(v(a), v(b));

export const REFERENCE_PAIRS = [
  {
    label: "북두칠성 국자 끝 두 지시별 (두베–메라크)",
    deg: sep("Dubhe", "Merak"),
  },
  {
    label: "오리온 허리띠 양 끝 (알니탁–민타카)",
    deg: sep("Alnitak", "Mintaka"),
  },
  { label: "쌍둥이자리 두 별 (카스토르–폴룩스)", deg: sep("Castor", "Pollux") },
  {
    label: "오리온의 어깨와 발 (베텔게우스–리겔)",
    deg: sep("Betelgeuse", "Rigel"),
  },
  { label: "북두칠성 전체 (두베–알카이드)", deg: sep("Dubhe", "Alkaid") },
  { label: "지시별 두베 → 북극성", deg: sep("Dubhe", "Polaris") },
];

// 거리: BSC5에 실린 연주 시차(각초)로. 시차가 작을수록(먼 별일수록) 오차가 커서, 0.04″(약 80광년)보다
// 가까운 밝은 별만 보여 준다. 최신 위성(히파르코스·가이아) 측정과는 몇 % 다를 수 있다.
export const MIN_RELIABLE_PARALLAX = 0.04;

export const NEAR_BRIGHT_STARS = STARS.filter(
  (s) =>
    s.mag <= 1.5 &&
    s.name &&
    ((parallax as Record<string, number>)[s.hr] ?? 0) >= MIN_RELIABLE_PARALLAX,
)
  .map((s) => {
    const p = (parallax as Record<string, number>)[s.hr];

    return {
      name: s.name!,
      mag: s.mag,
      parallaxArcsec: p,
      lightYears: parallaxToLightYears(p),
    };
  })
  .sort((a, b) => a.lightYears - b.lightYears);

// 등급을 비교해 볼 별 (밝은 순)
export const MAGNITUDE_LADDER = [
  "Sirius",
  "Vega",
  "Betelgeuse",
  "Spica",
  "Polaris",
  "Megrez",
  "Alcor",
].map((latin) => {
  const s = STARS.find((x) => x.latinName === latin)!;

  return { name: s.name ?? latin, mag: s.mag };
});
