import { resolve } from "node:path";
import sharp from "sharp";

// 이정표 실험: 사진을 아주 작게 줄이면 마젤란 은하처럼 크게 퍼진 빛 덩어리가 드러나는지 본다.
// 왼쪽은 줄인 사진, 오른쪽은 넓은 배경 빛(큰 흐림)을 뺀 차영상
//   npx tsx src/scripts/validate/expLandmark.ts <출력 폴더> <묶음/파일>...
const LONG = 160;

const [out, ...photos] = process.argv.slice(2);

const main = async () => {
  for (const photo of photos) {
    const src = resolve(process.cwd(), "public/samples-external", photo);
    const small = await sharp(src)
      .resize(LONG, LONG, { fit: "inside", kernel: "cubic" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = small.info;
    const bg = await sharp(small.data, {
      raw: { width: w, height: h, channels: 1 },
    })
      .blur(12)
      .raw()
      .toBuffer();
    const diff = Buffer.alloc(w * h);

    for (let i = 0; i < w * h; i++) {
      diff[i] = Math.max(0, Math.min(255, (small.data[i] - bg[i]) * 4));
    }

    const both = Buffer.alloc(w * 2 * h);

    for (let y = 0; y < h; y++) {
      small.data.copy(both, y * w * 2, y * w, y * w + w);
      diff.copy(both, y * w * 2 + w, y * w, y * w + w);
    }

    const name = photo.replace(/\//g, "_").replace(/\.jpg$/, ".png");

    await sharp(both, { raw: { width: w * 2, height: h, channels: 1 } })
      .resize(w * 6, h * 3, { kernel: "nearest" })
      .png()
      .toFile(resolve(out, name));
    console.log(`${photo}\t${w}x${h}\t→ ${name}`);
  }
};

void main();
