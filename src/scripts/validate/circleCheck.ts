import { listPhotos, loadDetected } from "@/scripts/validate/common";

// 확인용: 검출 99.5%가 들어가는 반지름 / 반대각선 (원형 어안 판정 0.85)
const [set] = process.argv.slice(2);

for (const f of listPhotos(set)) {
  const d = loadDetected(set, f)!;
  const pts = d.stars.filter((s) => !s.trail);
  const ds = pts
    .map((s) => Math.hypot(s.x - d.width / 2, s.y - d.height / 2))
    .sort((a, b) => a - b);
  const hd = Math.hypot(d.width, d.height) / 2;
  console.log(
    f,
    pts.length,
    (ds[Math.floor(ds.length * 0.995)] / hd).toFixed(2),
    (ds[Math.floor(ds.length * 0.9)] / hd).toFixed(2),
  );
}
