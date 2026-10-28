import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import {
  judge,
  loadDetected,
  outDir,
  photoDir,
} from "@/scripts/validate/common";
import { loadRun } from "@/scripts/validate/report";
import { projectFisheye } from "@/search/utils/fisheye";
import { rankForSolving } from "@/search/utils/selectStars";
import { projectVecToPhoto } from "@/search/utils/wcs";
import { loadCatalog } from "@/test/synthetic/loadCatalog";

// 풀이 결과를 사진 위에 그린다: 노란 원 = 투영한 카탈로그 별(4등급까지, 밝을수록 크게), 하늘색 네모 = 우선순위 상위 60 검출.
//   npx tsx src/scripts/validate/overlay.ts web-2026-10b base web-256.jpg [...]
// → build/validate/<묶음>/overlay/<이름>-<파일>

const run = async () => {
  const [set, name, ...files] = process.argv.slice(2);
  const rows = new Map(loadRun(set, name).map((r) => [r.file, r]));
  const catalog = loadCatalog().filter(
    (s) => s.v <= Number(process.env.MAG ?? 4),
  );
  const dir = resolve(outDir(set), "overlay");
  mkdirSync(dir, { recursive: true });

  for (const file of files) {
    const r = rows.get(file);
    const det = loadDetected(set, file);

    const pose = r?.fisheyeCamera ?? r?.transform;

    if (!pose || !det) {
      continue;
    }

    const { width: W, height: H } = det;
    const marks: string[] = [];

    for (const s of catalog) {
      const p =
        "ffish" in pose
          ? projectFisheye(pose, s.vector)
          : projectVecToPhoto(pose, s.vector);

      if (p && p[0] >= 0 && p[1] >= 0 && p[0] < W && p[1] < H) {
        marks.push(
          `<circle cx="${p[0]}" cy="${p[1]}" r="${(5 - s.v) * W * 0.004 + 4}" fill="none" stroke="#ff0" stroke-width="${W / 600}"/>`,
        );
      }
    }

    for (const d of rankForSolving(det.stars, W, H).slice(0, 60)) {
      const a = W * 0.006;
      marks.push(
        `<rect x="${d.x - a}" y="${d.y - a}" width="${2 * a}" height="${2 * a}" fill="none" stroke="#0ff" stroke-width="${W / 900}"/>`,
      );
    }

    const j = judge(det, pose);
    marks.push(
      `<text x="10" y="${H * 0.04}" font-size="${H * 0.035}" fill="#f0f" font-family="sans-serif">${file} ${r!.found ? "확신" : "후보"} lo ${r!.confidence.toFixed(1)} 꼬리 ${j.tail.toFixed(1)} ${j.verdict} fov ${r!.fovDeg?.toFixed(0)}</text>`,
    );
    const drawn = await sharp(resolve(photoDir(set), file))
      .composite([
        {
          input: Buffer.from(
            `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${marks.join("")}</svg>`,
          ),
        },
      ])
      .png()
      .toBuffer();
    await sharp(drawn)
      .resize(1000)
      .jpeg({ quality: 75 })
      .toFile(resolve(dir, `${name}-${file}`));
  }
};

run();
