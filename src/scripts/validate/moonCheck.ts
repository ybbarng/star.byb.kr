import { loadRun } from "@/scripts/validate/report";
import {
  j2000ToOfDate,
  julianDay,
  moonPosition,
  ofDateToJ2000,
} from "@/search/utils/ephemeris";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 확인용: 촬영 날짜(시간대 모름)의 하루 동안 달을 변환으로 사진에 투영한다. 사진 속 달 자리와 비교한다.
//   npx tsx src/scripts/validate/moonCheck.ts <묶음> <이름> <파일> <날짜 YYYY-MM-DD>
const [set, name, file, day] = process.argv.slice(2);
const r = loadRun(set, name).find((x) => x.file === file)!;
void j2000ToOfDate;

for (let h = -12; h <= 36; h += 3) {
  const t = new Date(`${day}T00:00:00Z`).getTime() + h * 3600e3;
  const jd = julianDay(new Date(t));
  const v = ofDateToJ2000(moonPosition(jd).vector, jd);
  const p = projectVecToPhoto(r.transform!, v);
  console.log(
    new Date(t).toISOString().slice(0, 13),
    p ? p.map(Math.round).join(",") : "뒤",
  );
}
