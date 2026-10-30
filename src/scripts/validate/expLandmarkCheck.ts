import type { Mat3 } from "@/search/utils/similarity";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { skyVec } from "@/scripts/validate/landmarkPose";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 이정표 실험 6 (journey 57장): 정답지가 없는 사진에서 답을 눈으로 확인한다. 저장한 변환(TP)으로 이름 있는 천체를 투영해
// 사진에 이름표를 붙인다. 실제 그 자리에 그 천체가 보이면 맞는 답이다.
//   npx tsx src/scripts/validate/expLandmarkCheck.ts <변환 json> <묶음/파일> <출력 png>
const NAMED: [string, number, number][] = [
  ["카노푸스", 95.99, -52.7],
  ["시리우스", 101.29, -16.72],
  ["아케르나르", 24.43, -57.24],
  ["알파 센타우리", 219.9, -60.83],
  ["하다르", 210.96, -60.37],
  ["아크룩스", 186.65, -63.1],
  ["가크룩스", 187.79, -57.11],
  ["미아플라키두스", 138.3, -69.72],
  ["아비오르", 125.63, -59.51],
  ["돛 감마", 122.38, -47.34],
  ["용골자리 성운", 161.26, -59.87],
  ["오메가 센타우리", 201.7, -47.48],
  ["큰부리새 47", 6.02, -72.08],
  ["대마젤란", 80.89, -69.76],
  ["소마젤란", 13.19, -72.83],
  ["석탄자루", 190.5, -62.5],
];

const [tpPath, photo, out] = process.argv.slice(2);
const TP = JSON.parse(readFileSync(tpPath, "utf8")) as Mat3;
const src = resolve(process.cwd(), "public/samples-external", photo);

const main = async () => {
  const meta = await sharp(src).metadata();
  const W = meta.width!;
  const H = meta.height!;
  const S = 1400 / Math.max(W, H);
  const marks = NAMED.flatMap(([name, ra, dec]) => {
    const p = projectVecToPhoto(TP, skyVec(ra, dec));

    if (!p || p[0] < -50 || p[1] < -50 || p[0] > W + 50 || p[1] > H + 50) {
      return [];
    }

    const x = p[0] * S;
    const y = p[1] * S;

    return [
      `<circle cx="${x}" cy="${y}" r="16" fill="none" stroke="yellow" stroke-width="1.5"/>`,
      `<text x="${x + 19}" y="${y + 5}" fill="yellow" font-size="15" font-family="sans-serif">${name}</text>`,
    ];
  });
  const ow = Math.round(W * S);
  const oh = Math.round(H * S);

  await sharp(src)
    .resize(ow, oh)
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${ow}" height="${oh}">${marks.join("")}</svg>`,
        ),
      },
    ])
    .png()
    .toFile(out);
};

void main();
