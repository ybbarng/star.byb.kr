import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { photoDir } from "@/scripts/validate/common";

// Wikimedia Commons에서 밤하늘 사진 후보를 모으고(candidates), 축소 모음 그림을 만들어 눈으로 고른 뒤(sheets),
// 고른 것만 1,920px 썸네일로 받는다(download). 출처표(sources.csv)를 같이 쓴다.
//   npx tsx src/scripts/validate/collect.ts candidates <작업 폴더>
//   npx tsx src/scripts/validate/collect.ts sheets <작업 폴더>
//   npx tsx src/scripts/validate/collect.ts download <작업 폴더> <묶음 이름> <첫 번호> <고른 목록 txt>

const API = "https://commons.wikimedia.org/w/api.php";
const UA =
  "star-byb-kr-validation/1.0 (https://star.byb.kr; plate solver test)";

// node의 fetch는 이 기계에서 Commons에 닿지 않아(ETIMEDOUT) curl로 받는다
const get = (url: string): Promise<Buffer> =>
  new Promise((ok, fail) =>
    execFile(
      "curl",
      ["-sfL", "--retry", "3", "-A", UA, url],
      { encoding: "buffer", maxBuffer: 64 << 20 },
      (err, out) => (err ? fail(err) : ok(out)),
    ),
  );

const QUERIES = (process.env.QUERIES ?? "").split("|").filter(Boolean);

const api = async (params: Record<string, string>) => {
  const url = `${API}?${new URLSearchParams({ format: "json", ...params })}`;

  return JSON.parse((await get(url)).toString("utf-8"));
};

interface Candidate {
  title: string;
  page: string;
  thumb: string;
  small: string;
  width: number;
  height: number;
  author: string;
  license: string;
  date: string;
  lat?: number;
  lon?: number;
  query: string;
  camera?: string; // EXIF 카메라 (제조사 모델)
  exposure?: string; // EXIF 노출 시간
  iso?: string;
}

// 폰 카메라 (EXIF 제조사·모델)
const PHONE =
  /iphone|apple|galaxy|samsung|sm-|pixel|google|huawei|honor|xiaomi|redmi|poco|oneplus|oppo|vivo|realme|nokia|motorola|moto |lg-|sony xperia|xperia/i;

const strip = (html?: string) =>
  (html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const SKIP =
  /map|chart|diagram|drawing|illustration|painting|logo|plan|nebula|galaxy|M\d{1,3}\b|NGC|IC ?\d|telescope view|eclipse|sun\b|solar|moon surface|lunar crater|jupiter|saturn rings|stellarium|render|simulation|svg/i;

const existingTitles = (): Set<string> => {
  const out = new Set<string>();

  for (const set of ["web-2026-10", "web-2026-10b"]) {
    const path = resolve(photoDir(set), "sources.csv");

    if (existsSync(path)) {
      for (const m of readFileSync(path, "utf-8").matchAll(/File:[^,"]+/g)) {
        out.add(m[0].replace(/_/g, " "));
      }
    }
  }

  return out;
};

const candidates = async (work: string) => {
  mkdirSync(work, { recursive: true });
  const seen = existingTitles();
  const out: Candidate[] = [];

  for (const query of QUERIES) {
    const search = await api({
      action: "query",
      generator: "search",
      gsrsearch: `${query} filetype:bitmap`,
      gsrnamespace: "6",
      gsrlimit: "50",
      prop: "imageinfo|coordinates",
      iiprop: "url|size|mime|extmetadata|commonmetadata",
      iiurlwidth: "1920",
    });
    const pages = Object.values(search.query?.pages ?? {}) as {
      title: string;
      imageinfo?: {
        thumburl: string;
        width: number;
        height: number;
        mime: string;
        descriptionurl: string;
        extmetadata?: Record<string, { value: string }>;
        commonmetadata?: { name: string; value: unknown }[];
      }[];
      coordinates?: { lat: number; lon: number }[];
    }[];

    for (const p of pages) {
      const ii = p.imageinfo?.[0];

      if (
        !ii ||
        seen.has(p.title) ||
        ii.mime !== "image/jpeg" ||
        Math.min(ii.width, ii.height) < 900 ||
        SKIP.test(p.title)
      ) {
        continue;
      }

      // EXIF 카메라 모델 (PHONE_ONLY=1이면 폰으로 찍은 사진만)
      const exif = (key: string) =>
        String(ii.commonmetadata?.find((m) => m.name === key)?.value ?? "");
      const camera = `${exif("Make")} ${exif("Model")}`.trim();

      if (process.env.PHONE_ONLY && !PHONE.test(camera)) {
        continue;
      }

      seen.add(p.title);
      const meta = ii.extmetadata ?? {};
      out.push({
        title: p.title,
        page: ii.descriptionurl,
        thumb: ii.thumburl,
        small: ii.thumburl.replace(/\/1920px-/, "/330px-"),
        width: ii.width,
        height: ii.height,
        author: strip(meta.Artist?.value),
        license: strip(meta.LicenseShortName?.value),
        date: strip(meta.DateTimeOriginal?.value),
        lat: p.coordinates?.[0]?.lat,
        lon: p.coordinates?.[0]?.lon,
        query,
        camera,
        exposure: exif("ExposureTime"),
        iso: exif("ISOSpeedRatings"),
      });
    }

    console.log(`${query}: 누적 ${out.length}`);
  }

  const path = resolve(work, "candidates.json");
  const prev: Candidate[] = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf-8"))
    : [];
  writeFileSync(path, JSON.stringify([...prev, ...out], null, 1));
};

// 후보를 40장씩 번호를 붙여 한 장의 모음 그림으로 (번호는 candidates.json의 순서)
const sheets = async (work: string) => {
  const list: Candidate[] = JSON.parse(
    readFileSync(resolve(work, "candidates.json"), "utf-8"),
  );
  const cell = 240;
  const cols = 8;
  const per = 40;
  mkdirSync(resolve(work, "sheets"), { recursive: true });

  for (let s = 0; s * per < list.length; s++) {
    const items = list.slice(s * per, (s + 1) * per);
    const tiles = await Promise.all(
      items.map(async (c, i) => {
        const n = s * per + i;
        let img: Buffer;

        try {
          img = await sharp(await get(c.small))
            .resize(cell, cell - 20, { fit: "contain", background: "#222" })
            .toBuffer();
        } catch {
          img = await sharp({
            create: {
              width: cell,
              height: cell - 20,
              channels: 3,
              background: "#600",
            },
          })
            .png()
            .toBuffer();
        }

        const label = Buffer.from(
          `<svg width="${cell}" height="20"><rect width="100%" height="100%" fill="#000"/><text x="4" y="15" font-size="14" fill="#ff0" font-family="sans-serif">${n}</text></svg>`,
        );

        return [
          {
            input: img,
            left: (i % cols) * cell,
            top: Math.floor(i / cols) * cell + 20,
          },
          {
            input: label,
            left: (i % cols) * cell,
            top: Math.floor(i / cols) * cell,
          },
        ];
      }),
    );
    await sharp({
      create: {
        width: cols * cell,
        height: Math.ceil(items.length / cols) * cell,
        channels: 3,
        background: "#000",
      },
    })
      .composite(tiles.flat())
      .jpeg({ quality: 70 })
      .toFile(
        resolve(work, "sheets", `sheet-${String(s).padStart(2, "0")}.jpg`),
      );
  }
};

const csv = (v: unknown) => {
  const s = v === undefined ? "" : String(v);

  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// 고른 목록: 한 줄에 "번호 분류" (예: "12 은하수/지상물체")
const download = async (
  work: string,
  set: string,
  first: number,
  picksPath: string,
) => {
  const list: Candidate[] = JSON.parse(
    readFileSync(resolve(work, "candidates.json"), "utf-8"),
  );
  const picks = readFileSync(picksPath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [n, ...rest] = l.split(/\s+/);

      return { c: list[Number(n)], cls: rest.join(" ") };
    });
  const dir = photoDir(set);
  mkdirSync(dir, { recursive: true });
  const rows = [
    "file,commons_page_url,title,author,license,width,height,orig_width,orig_height,category,class,memo,date_time_original,gps_lat,gps_lon",
  ];
  let n = first;

  for (const { c, cls } of picks) {
    const file = `web-${String(n).padStart(3, "0")}.jpg`;
    const path = resolve(dir, file);

    if (!existsSync(path)) {
      writeFileSync(path, await get(c.thumb));
      await new Promise((r) => setTimeout(r, 300));
    }

    const meta = await sharp(path).metadata();
    rows.push(
      [
        file,
        c.page,
        c.title,
        c.author,
        c.license,
        meta.width,
        meta.height,
        c.width,
        c.height,
        `search:${c.query}`,
        cls,
        "",
        c.date,
        c.lat,
        c.lon,
      ]
        .map(csv)
        .join(","),
    );
    n++;
  }

  writeFileSync(resolve(dir, "sources.csv"), `${rows.join("\n")}\n`);
};

const [cmd, work, ...rest] = process.argv.slice(2);

if (cmd === "candidates") {
  candidates(work);
} else if (cmd === "sheets") {
  sheets(work);
} else if (cmd === "download") {
  download(work, rest[0], Number(rest[1]), rest[2]);
}
