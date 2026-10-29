import { resolve } from "node:path";
import sharp from "sharp";
import {
  loadClasses,
  loadDetected,
  outDir,
  photoDir,
} from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { rankForSolving } from "@/search/utils/selectStars";

// 분류 하나의 풀린/못 푼 사진을 모아, 풀이가 앞에서 고르는 검출(우선순위 상위 30, 빨강)을 표시한다
//   npx tsx src/scripts/validate/detMontage.ts <묶음> <풀이 이름> <분류> <found|miss>
const run = async () => {
  const [set, name, cls, which] = process.argv.slice(2);
  const classes = loadClasses(set);
  const rows = loadRun(set, name).filter(
    (r) =>
      (cls === "전체" || classes.get(r.file) === cls) &&
      (which === "found" ? r.found : !r.found),
  );
  const cell = 360;
  const tiles = await Promise.all(
    rows.map(async (r, i) => {
      const det = loadDetected(set, r.file)!;
      const k = cell / Math.max(det.width, det.height);
      const top = rankForSolving(
        det.stars.filter((s) => !s.trail),
        det.width,
        det.height,
      ).slice(0, 30);
      const svg = `<svg width="${cell}" height="${cell}">${top
        .map(
          (s) =>
            `<circle cx="${s.x * k}" cy="${s.y * k}" r="4" fill="none" stroke="#f33" stroke-width="1.5"/>`,
        )
        .join(
          "",
        )}<text x="3" y="14" font-size="13" fill="#ff0">${r.file} ${det.stars.length}</text></svg>`;
      const img = await sharp(resolve(photoDir(set), r.file))
        .resize(Math.round(det.width * k), Math.round(det.height * k))
        .extend({
          right: cell - Math.round(det.width * k),
          bottom: cell - Math.round(det.height * k),
          background: "#111",
        })
        .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
        .png()
        .toBuffer();

      return {
        input: img,
        left: (i % 5) * cell,
        top: Math.floor(i / 5) * cell,
      };
    }),
  );
  await sharp({
    create: {
      width: 5 * cell,
      height: Math.ceil(rows.length / 5) * cell,
      channels: 3,
      background: "#000",
    },
  })
    .composite(tiles)
    .jpeg({ quality: 72 })
    .toFile(resolve(outDir(set), `det-${cls}-${which}.jpg`));
  console.log(rows.length, "장");
};

run();
