import { STARS } from "@/game/sky/catalog";
import { angleBetweenDeg } from "@/learn/basics/skyMath";

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
