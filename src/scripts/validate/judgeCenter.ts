import { judge, loadDetected } from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";

// 확인용: 가장자리(렌즈 왜곡)를 빼고 사진 가운데 keep 비율 상자 안 검출만으로 겹친 별을 판정한다.
//   npx tsx src/scripts/validate/judgeCenter.ts <묶음> <이름> <keep 0~1> <파일>...
const [set, name, keep, ...files] = process.argv.slice(2);
const k = Number(keep);

for (const r of loadRun(set, name).filter((x) => files.includes(x.file))) {
  const det = loadDetected(set, r.file)!;
  const { width: W, height: H } = det;
  const inBox = (x: number, y: number) =>
    Math.abs(x - W / 2) < (W * k) / 2 && Math.abs(y - H / 2) < (H * k) / 2;
  // 가운데 상자를 하나의 작은 사진처럼: 검출과 변환을 상자 원점으로 옮긴다
  const x0 = (W * (1 - k)) / 2;
  const y0 = (H * (1 - k)) / 2;
  const T = r.transform!;
  const shifted = [
    [T[0][0] - x0 * T[2][0], T[0][1] - x0 * T[2][1], T[0][2] - x0 * T[2][2]],
    [T[1][0] - y0 * T[2][0], T[1][1] - y0 * T[2][1], T[1][2] - y0 * T[2][2]],
    T[2],
  ] as typeof T;
  const j = judge(
    {
      width: W * k,
      height: H * k,
      stars: det.stars
        .filter((s) => inBox(s.x, s.y))
        .map((s) => ({ ...s, x: s.x - x0, y: s.y - y0 })),
    },
    shifted,
  );
  console.log(
    r.file,
    `m ${j.m} e ${j.e.toFixed(1)} 꼬리 ${j.tail.toFixed(1)} 늦은 ${j.tailLate.toFixed(1)} ${j.verdict}`,
  );
}
