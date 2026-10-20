import { LAND_POLYGONS } from "@/game/geo/world";
import { gmstDeg, julianDay, sunVector } from "@/search/utils/ephemeris";

// 세계 지도: 정거원통 투영(경도·위도를 그대로 가로·세로로). 그 순간(UTC)의 낮밤 음영과 박명,
// 현지 시각 띠(쉬움), 핀을 그린다. 경도는 끝없이 이어진다 (한 바퀴 넘어가면 옆에 다시 그린다).

const D = Math.PI / 180;
// 낮밤은 작게 계산해 늘린다
const SHADE_SCALE = 4;

export interface MapView {
  centerLon: number;
  centerLat: number;
  pxPerDeg: number;
}

export interface MapPin {
  latDeg: number;
  lonDeg: number;
  color: string;
  label?: string;
}

export const mapProjection = (W: number, H: number, v: MapView) => ({
  x: (lon: number) => W / 2 + (lon - v.centerLon) * v.pxPerDeg,
  y: (lat: number) => H / 2 - (lat - v.centerLat) * v.pxPerDeg,
  lon: (x: number) => v.centerLon + (x - W / 2) / v.pxPerDeg,
  lat: (y: number) => v.centerLat - (y - H / 2) / v.pxPerDeg,
});

// 그 순간 해의 고도(°)를 위도·경도에서 구하는 함수
export const sunAltitudeAt = (date: Date) => {
  const jd = julianDay(date);
  const s = sunVector(jd);
  const dec = Math.asin(s[2]);
  const ra = Math.atan2(s[1], s[0]) / D;
  const gmst = gmstDeg(jd);

  return (latDeg: number, lonDeg: number) => {
    const ha = (gmst + lonDeg - ra) * D;
    const lat = latDeg * D;

    return (
      Math.asin(
        Math.sin(lat) * Math.sin(dec) +
          Math.cos(lat) * Math.cos(dec) * Math.cos(ha),
      ) / D
    );
  };
};

let shadeCanvas: HTMLCanvasElement | null = null;

export const drawWorldMap = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  view: MapView,
  utc: Date,
  opts: { timeBands: boolean; pins: MapPin[]; line?: [MapPin, MapPin] },
) => {
  const P = mapProjection(W, H, view);
  const offsets = [-360, 0, 360];

  // 바다
  ctx.fillStyle = "#0d2238";
  ctx.fillRect(0, 0, W, H);

  // 경위선
  ctx.strokeStyle = "rgba(160,190,230,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.moveTo(0, P.y(lat));
    ctx.lineTo(W, P.y(lat));
  }

  for (let lon = -540; lon <= 540; lon += 30) {
    ctx.moveTo(P.x(lon), 0);
    ctx.lineTo(P.x(lon), H);
  }

  ctx.stroke();

  // 땅
  ctx.fillStyle = "#3d5a3a";
  ctx.strokeStyle = "rgba(200,220,180,0.35)";

  for (const o of offsets) {
    ctx.beginPath();

    for (const poly of LAND_POLYGONS) {
      for (const ring of poly) {
        ring.forEach(([lon, lat], i) =>
          i
            ? ctx.lineTo(P.x(lon + o), P.y(lat))
            : ctx.moveTo(P.x(lon + o), P.y(lat)),
        );
        ctx.closePath();
      }
    }

    ctx.fill("evenodd");
    ctx.stroke();
  }

  // 낮밤: 해가 지평선 아래면 어둡게, 박명(0~-18°)은 그 사이
  const sunAlt = sunAltitudeAt(utc);
  const w = Math.ceil(W / SHADE_SCALE);
  const h = Math.ceil(H / SHADE_SCALE);
  shadeCanvas ??= document.createElement("canvas");
  shadeCanvas.width = w;
  shadeCanvas.height = h;
  const small = shadeCanvas.getContext("2d")!;
  const image = small.createImageData(w, h);

  for (let j = 0; j < h; j++) {
    const lat = Math.max(-90, Math.min(90, P.lat((j + 0.5) * SHADE_SCALE)));

    for (let i = 0; i < w; i++) {
      const alt = sunAlt(lat, P.lon((i + 0.5) * SHADE_SCALE));
      const night = Math.max(0, Math.min(1, -alt / 18));
      const k = (j * w + i) * 4;
      image.data[k] = 2;
      image.data[k + 1] = 6;
      image.data[k + 2] = 22;
      image.data[k + 3] = Math.round(night * 175);
    }
  }

  small.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(shadeCanvas, 0, 0, w * SHADE_SCALE, h * SHADE_SCALE);

  // 현지 시각 띠 (쉬움): 경도 15°마다 1시간, 밤 시간대만
  if (opts.timeBands) {
    const utcHours = utc.getUTCHours() + utc.getUTCMinutes() / 60;
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";

    for (const local of [18, 20, 22, 0, 2, 4, 6]) {
      const lon0 = (((local - utcHours) * 15 + 540) % 360) - 180;

      for (const o of offsets) {
        const x = P.x(lon0 + o);

        if (x < -20 || x > W + 20) {
          continue;
        }

        ctx.strokeStyle = "rgba(255,220,120,0.35)";
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,225,140,0.95)";
        ctx.fillText(`${String(local).padStart(2, "0")}시`, x, 16);
      }
    }
  }

  // 정답과 내 핀을 잇는 선
  if (opts.line) {
    const [a, b] = opts.line;
    // 가까운 쪽으로 잇는다 (날짜 변경선 너머)
    const bl = a.lonDeg + ((((b.lonDeg - a.lonDeg) % 360) + 540) % 360) - 180;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;

    for (const o of offsets) {
      ctx.beginPath();
      ctx.moveTo(P.x(a.lonDeg + o), P.y(a.latDeg));
      ctx.lineTo(P.x(bl + o), P.y(b.latDeg));
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  // 핀
  for (const pin of opts.pins) {
    for (const o of offsets) {
      const x = P.x(pin.lonDeg + o);
      const y = P.y(pin.latDeg);

      if (x < -30 || x > W + 30) {
        continue;
      }

      ctx.fillStyle = pin.color;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - 10, y - 14, x - 10, y - 26, x, y - 26);
      ctx.bezierCurveTo(x + 10, y - 26, x + 10, y - 14, x, y);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - 18, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill();

      if (pin.label) {
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 4;
        ctx.fillText(pin.label, x, y - 32);
        ctx.shadowBlur = 0;
      }
    }
  }

  ctx.textAlign = "start";
};
