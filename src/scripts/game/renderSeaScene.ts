import type { Point3D } from "@/scripts/hash/types";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import {
  SEA_SCENE,
  seaSceneShotAt,
  seaSceneTP,
} from "@/game/humanVsComputer/seaScene";
import { horizontalFrameJ2000, julianDay } from "@/search/utils/ephemeris";
import { mat3Inv, projectVecToPhoto } from "@/search/utils/wcs";
import { createRng, gaussian } from "@/utils/rng";

// 사람 계산원 vs 컴퓨터의 반전 판 사진을 그린다 (src/game/humanVsComputer/seaScene.ts).
// 여름밤 제주 서귀포 바닷가에서 남쪽 바다 위의 전갈자리를 휴대폰으로 찍은 듯한 장면:
// 습한 여름 하늘의 대기 소광·옅은 구름, 수평선 쪽 광해와 낮은 구름, 수평선의 고깃배 불빛(집어등)과
// 바다에 비친 빛, 앞쪽 바위, 비네팅, 휴대폰의 잡음과 잡음 줄이기 번짐.
// 별은 실제 카탈로그(build/database/vectors-database.json)를 그 시각·장소의 하늘로 투영해 그린다.
// 시드가 고정이라 다시 돌려도 같은 그림이 나온다.
//
//   npx tsx src/scripts/game/renderSeaScene.ts
//   NR_CUTOFF=3.6 npx tsx src/scripts/game/renderSeaScene.ts   # 지우는 등급을 바꿔 보기 (눈금은 docs/game-plans.md 3절)
//
// 바꾸면 src/test/real/humanVsComputerScene.test.ts로 "별만으로는 모름, 단서로는 확신"이 그대로인지 확인한다.

const D = Math.PI / 180;
const { width: W, height: H, seed } = SEA_SCENE;
const OUT = resolve(process.cwd(), "public/samples", SEA_SCENE.file);

type RGB = [number, number, number];

// ---------- 잡음 (시드 고정 값 잡음 + 여러 겹) ----------

const hash2 = (ix: number, iy: number, s: number) => {
  let h =
    Math.imul(ix, 374761393) +
    Math.imul(iy, 668265263) +
    Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;

  return (h >>> 0) / 4294967296;
};

const smooth = (t: number) => t * t * (3 - 2 * t);

const valueNoise = (x: number, y: number, s: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy, s);
  const b = hash2(ix + 1, iy, s);
  const c = hash2(ix, iy + 1, s);
  const d = hash2(ix + 1, iy + 1, s);

  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

const fbm = (x: number, y: number, s: number, octaves = 5) => {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;

  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * 2 ** i, y * 2 ** i, s + i * 17);
    norm += amp;
    amp *= 0.5;
  }

  return sum / norm;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoothstep = (a: number, b: number, v: number) =>
  smooth(clamp01((v - a) / (b - a)));

// 별의 색: 표면 온도(K) → RGB (흑체 근사), 휴대폰처럼 채도를 낮춘다
const kelvinRgb = (k: number): RGB => {
  const t = k / 100;
  const r = t <= 66 ? 1 : clamp01((329.7 * (t - 60) ** -0.1332) / 255);
  const g =
    t <= 66
      ? clamp01((99.47 * Math.log(t) - 161.12) / 255)
      : clamp01((288.12 * (t - 60) ** -0.0755) / 255);
  const b =
    t >= 66
      ? 1
      : t <= 19
        ? 0
        : clamp01((138.52 * Math.log(t - 10) - 305.04) / 255);
  const mean = (r + g + b) / 3;
  const keep = 0.8;

  return [
    mean + (r - mean) * keep,
    mean + (g - mean) * keep,
    mean + (b - mean) * keep,
  ];
};

// ---------- 장면 ----------

const rng = createRng(seed);
const TP = seaSceneTP();
const inv = mat3Inv(TP);
const jd = julianDay(seaSceneShotAt());
const frame = horizontalFrameJ2000(jd, SEA_SCENE.clue.observer);
const dot = (a: Point3D, b: Point3D) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// 화소마다 하늘의 고도·방위(°)
const altOf = new Float32Array(W * H);
const azOf = new Float32Array(W * H);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d: Point3D = [
      inv[0][0] * x + inv[0][1] * y + inv[0][2],
      inv[1][0] * x + inv[1][1] * y + inv[1][2],
      inv[2][0] * x + inv[2][1] * y + inv[2][2],
    ];
    const n = Math.hypot(d[0], d[1], d[2]);
    const i = y * W + x;
    altOf[i] = Math.asin(dot(d, frame.zenith) / n) / D;
    azOf[i] =
      (Math.atan2(dot(d, frame.east), dot(d, frame.north)) / D + 360) % 360;
  }
}

// 빛의 양 (선형). 마지막에 감마를 씌운다
const img = new Float32Array(W * H * 3);

const addAt = (x: number, y: number, c: RGB, v: number) => {
  if (x < 0 || x >= W || y < 0 || y >= H) {
    return;
  }

  const i = (y * W + x) * 3;
  img[i] += c[0] * v;
  img[i + 1] += c[1] * v;
  img[i + 2] += c[2] * v;
};

// 앞쪽 바위가 차지하는 화소 (사진 아래 왼쪽·오른쪽 귀퉁이)
const rockTop = new Float32Array(W);

for (let x = 0; x < W; x++) {
  const u = x / W;
  const left = (1 - smoothstep(0, 0.42, u)) * 0.13;
  const right = smoothstep(0.78, 1, u) * 0.07;
  const bumps = (fbm(u * 9, 0.5, seed + 900, 4) - 0.5) * 0.035;
  rockTop[x] =
    H *
    (1 - Math.max(0, left + right + bumps * (left + right > 0.005 ? 1 : 0)));
}

// 구름: 수평선 위 낮은 뭉게구름 띠 + 하늘 군데군데 옅은 구름 (별을 가린다)
const cloudAlpha = new Float32Array(W * H);

const cloudAt = (alt: number, az: number) => {
  // 낮은 뭉게구름 띠의 윗선: 왼쪽(동쪽)에 높이 솟은 구름 기둥, 오른쪽에 낮은 구름 무더기
  const bump = (c: number, w: number) => Math.exp(-(((az - c) / w) ** 2));
  const top =
    1.5 +
    19 * bump(170, 7) +
    9 * bump(207, 6) +
    4 * fbm(az / 6, 0.3, seed + 11, 4);
  const puff = fbm(az / 1.8, alt / 1.4, seed + 12, 5);
  const edge = top + (puff - 0.5) * 6;
  const low = smoothstep(edge + 0.6, edge - 1.2, alt);
  // 높은 곳의 옅은 구름 조각
  const patch = fbm(az / 11, alt / 6, seed + 13, 5);
  const high = smoothstep(0.6, 0.85, patch) * 0.6 * smoothstep(8, 16, alt);

  return clamp01(Math.max(low * (0.7 + 0.3 * puff), high));
};

// 하늘 배경
const SKY_TOP: RGB = [0.0011, 0.0026, 0.0048];
const SKY_GLOW: RGB = [0.009, 0.024, 0.026];
const TOWN_GLOW: RGB = [0.05, 0.024, 0.011];
const CLOUD: RGB = [0.026, 0.024, 0.027];
const CLOUD_WARM: RGB = [0.07, 0.04, 0.03];
const SEA: RGB = [0.0008, 0.0014, 0.0024];

// 그 고도·방위의 하늘빛 (구름 포함)과 구름이 가린 정도
const skyAt = (alt: number, az: number): { c: RGB; a: number } => {
  const glow = Math.exp(-alt / 9);
  // 왼쪽(동쪽) 해안 마을 불빛이 낮은 하늘을 데운다
  const town = Math.exp(-alt / 5) * Math.exp(-(((az - 168) / 14) ** 2));
  const a = cloudAt(alt, az);
  // 구름은 아래에서 마을 불빛을 받아 아랫부분이 따뜻하고 밝다. 결은 잔 잡음으로
  const warm =
    Math.exp(-alt / 6) * (0.4 + 0.6 * Math.exp(-(((az - 168) / 18) ** 2)));
  const texture = 0.6 + 0.8 * fbm(az / 1.1, alt / 0.8, seed + 14, 4);
  const c = [0, 1, 2].map(
    (k) =>
      (SKY_TOP[k] + SKY_GLOW[k] * glow + TOWN_GLOW[k] * town) * (1 - a) +
      (CLOUD[k] * (0.6 + 0.5 * Math.exp(-alt / 5)) + CLOUD_WARM[k] * warm) *
        texture *
        a,
  ) as RGB;

  return { c, a };
};

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const alt = altOf[i];
    const az = azOf[i];
    let c: RGB;

    if (alt >= 0) {
      const sky = skyAt(alt, az);
      c = sky.c;
      cloudAlpha[i] = sky.a;
    } else {
      // 바다는 하늘을 거울처럼 비춘다: 수평선에 가까울수록 반사가 세고(경계가 부드럽다),
      // 가까운 바다일수록 어둡다. 물결이 가로 결을 내고 멀수록 촘촘하다
      const depth = 1 / Math.tan(Math.max(0.05, -alt) * D);
      const wave = fbm(az / 0.5, depth / 6, seed + 20, 4);
      const reflect = 0.12 + 0.55 * Math.exp(alt / 1.8);
      const mirror = skyAt(-alt, az + (wave - 0.5) * 0.6).c;
      c = [0, 1, 2].map(
        (k) => SEA[k] + mirror[k] * reflect * (0.6 + 0.8 * wave),
      ) as RGB;
    }

    if (y >= rockTop[x]) {
      // 젖은 현무암: 거의 검다
      const r = 0.0007 + 0.0015 * fbm(x / 30, y / 30, seed + 30, 3);
      c = [r, r * 1.05, r * 1.2];
    }

    img[i * 3] = c[0];
    img[i * 3 + 1] = c[1];
    img[i * 3 + 2] = c[2];
  }
}

// ---------- 별 ----------

interface CatalogRow {
  HR: string;
  V: string;
  K?: string;
  x: number;
  y: number;
  z: number;
}

const catalog = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "build/database/vectors-database.json"),
    "utf-8",
  ),
) as CatalogRow[];

// 습한 여름 바닷가의 대기 소광 (등급/대기질량)
const EXTINCTION = 0.25;
// 이 겉보기 등급의 별이 빛의 양 1을 받는다
const M_REF = 4.4;
// 휴대폰의 잡음 줄이기는 희미한 별을 지운다: 소광 뒤 이 등급보다 어두운 별은 사라진다
const NR_CUTOFF = Number(process.env.NR_CUTOFF ?? 3.55);
const PSF_SIGMA = 1.5;

let drawn = 0;

const blob = (cx: number, cy: number, c: RGB, flux: number, sigma: number) => {
  const r = Math.ceil(sigma * 4);
  const peak = flux / (2 * Math.PI * sigma * sigma);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = Math.round(cx) + dx;
      const y = Math.round(cy) + dy;
      const ex = x - cx;
      const ey = y - cy;
      addAt(
        x,
        y,
        c,
        peak * Math.exp(-(ex * ex + ey * ey) / (2 * sigma * sigma)),
      );
    }
  }
};

for (const s of catalog) {
  const v: Point3D = [s.x, s.y, s.z];
  const p = projectVecToPhoto(TP, v);

  if (!p || p[0] < 2 || p[0] >= W - 2 || p[1] < 2 || p[1] >= H - 2) {
    continue;
  }

  const i = Math.floor(p[1]) * W + Math.floor(p[0]);
  const alt = altOf[i];

  if (alt < 0.3 || p[1] >= rockTop[Math.floor(p[0])]) {
    continue;
  }

  const airmass =
    1 / (Math.sin(alt * D) + 0.50572 * (alt + 6.07995) ** -1.6364);
  const mag = parseFloat(s.V) + EXTINCTION * airmass;
  // 구름에 가린 만큼도 등급으로 (가리면 어두워진다)
  const seen = mag - 2.5 * Math.log10(Math.max(1e-3, 1 - cloudAlpha[i]));
  const flux =
    10 ** (-0.4 * (mag - M_REF)) *
    (1 - cloudAlpha[i]) *
    smoothstep(NR_CUTOFF + 0.3, NR_CUTOFF - 0.3, seen) *
    (0.9 + 0.2 * rng());

  if (flux < 0.002) {
    continue;
  }

  const color = kelvinRgb(s.K ? parseFloat(s.K) : 6000);
  // 휴대폰 사진은 손떨림·잡음 줄이기로 별이 조금씩 번진다. 밝은 별은 둘레에 옅은 빛무리
  const sigma = PSF_SIGMA * (0.9 + 0.25 * rng());
  blob(p[0], p[1], color, flux * 0.92, sigma);
  blob(p[0], p[1], color, flux * 0.08, sigma * 4);
  drawn++;
}

// ---------- 수평선의 불빛과 바다에 비친 빛 ----------

// 수평선(고도 0°)의 사진 속 y
const horizonY = (x: number) => {
  for (let y = 1; y < H; y++) {
    if (altOf[y * W + x] < 0) {
      return y;
    }
  }

  return H;
};

const LAMP: RGB = [0.85, 1, 0.82]; // 집어등 (푸르스름한 흰빛)
const WARM: RGB = [1, 0.75, 0.45];
const lights: { x: number; color: RGB; flux: number }[] = [];

// 고깃배 몇 척이 무리 지어 있다
for (const [cx, n] of [
  [0.62, 3],
  [0.3, 2],
  [0.86, 1],
] as const) {
  for (let k = 0; k < n; k++) {
    lights.push({
      x: W * (cx + (rng() - 0.5) * 0.06),
      color: LAMP,
      flux: 5 + rng() * 9,
    });
  }
}

// 왼쪽 해안의 마을 불빛 (작고 따뜻하다)
for (let k = 0; k < 5; k++) {
  lights.push({
    x: W * (0.02 + rng() * 0.1),
    color: WARM,
    flux: 1.5 + rng() * 3,
  });
}

for (const l of lights) {
  const hy = horizonY(Math.round(l.x));
  // 고깃배는 수평선보다 가까워 불빛이 수평선에 살짝 걸친다
  const y = hy + 1.5;
  blob(l.x, y, l.color, l.flux, 1.4);
  blob(l.x, y, l.color, l.flux * 0.25, 6);

  // 물결에 부서진 반사 기둥
  for (let dy = 4; dy < H * 0.22; dy += 2) {
    const fade = Math.exp(-dy / (H * 0.07));
    const breakUp = fbm(l.x / 7, (hy + dy) / 5, seed + 40, 3);

    if (breakUp < 0.45) {
      continue;
    }

    const wobble = gaussian(rng) * (1 + dy * 0.02);
    blob(
      l.x + wobble,
      hy + dy,
      l.color,
      l.flux * 0.06 * fade * (breakUp - 0.3),
      1.5 + dy * 0.01,
    );
  }
}

// ---------- 비네팅, 감마, 휴대폰 잡음 ----------

const out = new Uint8Array(W * H * 3);
const GAIN = 1.0;

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const rx = (x - W / 2) / (W / 2);
    const ry = (y - H / 2) / (H / 2);
    const r2 = (rx * rx * 0.8 + ry * ry) / 1.8;
    const vignette = 1 - 0.45 * r2 ** 1.2;
    // 어두운 곳일수록 잡음이 도드라진다 (밝기 잡음 + 색 잡음)
    const lum = gaussian(rng);

    for (let k = 0; k < 3; k++) {
      const lin = Math.max(0, img[i * 3 + k] * vignette * GAIN);
      const srgb = lin ** (1 / 2.2);
      const noisy = srgb + (lum * 0.012 + gaussian(rng) * 0.006);
      out[i * 3 + k] = Math.round(clamp01(noisy) * 255);
    }
  }
}

mkdirSync(dirname(OUT), { recursive: true });
sharp(Buffer.from(out), { raw: { width: W, height: H, channels: 3 } })
  // 휴대폰의 잡음 줄이기처럼 아주 살짝 뭉갠다
  .blur(0.6)
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(OUT)
  .then(() => console.log(`그린 별 ${drawn}개 → ${OUT}`));
