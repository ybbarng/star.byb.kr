import { resolve } from "node:path";
import sharp from "sharp";
import { loadClasses, outDir, photoDir } from "@/scripts/validate/common";

// 분류 하나의 사진을 한 장에 모아 본다.
//   npx tsx src/scripts/validate/montage.ts <분류> <묶음>...
const run = async () => {
  const [cls, ...sets] = process.argv.slice(2);
  const cell = 320;
  const items = sets.flatMap((set) =>
    [...loadClasses(set).entries()]
      .filter(([, c]) => c === cls)
      .map(([file]) => ({ set, file })),
  );
  const tiles = await Promise.all(
    items.map(async ({ set, file }, i) => [
      {
        input: await sharp(resolve(photoDir(set), file))
          .resize(cell, cell - 20, { fit: "contain", background: "#222" })
          .toBuffer(),
        left: (i % 6) * cell,
        top: Math.floor(i / 6) * cell + 20,
      },
      {
        input: Buffer.from(
          `<svg width="${cell}" height="20"><text x="4" y="15" font-size="14" fill="#ff0">${file}</text></svg>`,
        ),
        left: (i % 6) * cell,
        top: Math.floor(i / 6) * cell,
      },
    ]),
  );
  await sharp({
    create: {
      width: 6 * cell,
      height: Math.ceil(items.length / 6) * cell,
      channels: 3,
      background: "#000",
    },
  })
    .composite(tiles.flat())
    .jpeg({ quality: 70 })
    .toFile(resolve(outDir(sets[0]), `montage-${cls}.jpg`));
};

run();
