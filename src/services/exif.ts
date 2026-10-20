// JPEG의 EXIF에서 촬영 시각과 GPS 위치만 읽는다. 해·달·행성 위치를 정하는 데 쓴다.
// 메신저·카페를 거친 사진은 EXIF가 지워져 있는 경우가 많아 없으면 null이다.

export interface PhotoExif {
  // 카메라 시계의 현지 시각 그대로 ("2019-09-17T00:05:26"). 시간대는 offset이 있을 때만 안다.
  localDateTime: string | null;
  offset: string | null; // "+09:00" 꼴
  latDeg: number | null;
  lonDeg: number | null;
}

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;
const GPS_LAT_REF = 0x0001;
const GPS_LAT = 0x0002;
const GPS_LON_REF = 0x0003;
const GPS_LON = 0x0004;

type Reader = {
  u16: (o: number) => number;
  u32: (o: number) => number;
};

interface Entry {
  type: number;
  count: number;
  valueOffset: number; // 값 자체가 4바이트 이하면 이 위치에 들어 있다
}

const readIfd = (view: DataView, r: Reader, tiff: number, offset: number) => {
  const entries = new Map<number, Entry>();
  const start = tiff + offset;

  if (start + 2 > view.byteLength) {
    return entries;
  }

  const n = r.u16(start);

  for (let i = 0; i < n; i++) {
    const e = start + 2 + i * 12;

    if (e + 12 > view.byteLength) {
      break;
    }

    const type = r.u16(e + 2);
    const count = r.u32(e + 4);
    const size =
      ({ 2: 1, 3: 2, 4: 4, 5: 8 } as Record<number, number>)[type] ?? 1;
    entries.set(r.u16(e), {
      type,
      count,
      valueOffset: size * count <= 4 ? e + 8 : tiff + r.u32(e + 8),
    });
  }

  return entries;
};

const ascii = (view: DataView, e?: Entry) => {
  if (!e || e.type !== 2 || e.valueOffset + e.count > view.byteLength) {
    return null;
  }

  let s = "";

  for (let i = 0; i < e.count; i++) {
    const c = view.getUint8(e.valueOffset + i);

    if (c === 0) {
      break;
    }

    s += String.fromCharCode(c);
  }

  return s.trim() || null;
};

// 도·분·초 유리수 3개 → 도
const degrees = (view: DataView, r: Reader, e?: Entry) => {
  if (!e || e.type !== 5 || e.count < 3) {
    return null;
  }

  let deg = 0;

  for (let i = 0; i < 3; i++) {
    const den = r.u32(e.valueOffset + i * 8 + 4);
    deg += (den ? r.u32(e.valueOffset + i * 8) / den : 0) / 60 ** i;
  }

  return deg;
};

export const readExif = (buffer: ArrayBuffer): PhotoExif | null => {
  const view = new DataView(buffer);

  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
    return null; // JPEG가 아니다
  }

  // APP1 "Exif\0\0" 조각 찾기
  let p = 2;

  while (p + 4 <= view.byteLength) {
    const marker = view.getUint16(p);
    const length = view.getUint16(p + 2);

    if (marker === 0xffe1 && view.getUint32(p + 4) === 0x45786966) {
      break;
    }

    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) {
      return null; // 영상 데이터가 시작됐는데 EXIF가 없었다
    }

    p += 2 + length;
  }

  const tiff = p + 10;

  if (tiff + 8 > view.byteLength) {
    return null;
  }

  const little = view.getUint16(tiff) === 0x4949; // "II"
  const r: Reader = {
    u16: (o) => view.getUint16(o, little),
    u32: (o) => view.getUint32(o, little),
  };
  const ifd0 = readIfd(view, r, tiff, r.u32(tiff + 4));
  const exifPtr = ifd0.get(TAG_EXIF_IFD);
  const gpsPtr = ifd0.get(TAG_GPS_IFD);
  const exif = exifPtr
    ? readIfd(view, r, tiff, r.u32(exifPtr.valueOffset))
    : new Map<number, Entry>();
  const gps = gpsPtr
    ? readIfd(view, r, tiff, r.u32(gpsPtr.valueOffset))
    : new Map<number, Entry>();

  // "2019:09:17 00:05:26" → "2019-09-17T00:05:26"
  const raw = ascii(view, exif.get(TAG_DATE_TIME_ORIGINAL));
  const m = raw?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  const lat = degrees(view, r, gps.get(GPS_LAT));
  const lon = degrees(view, r, gps.get(GPS_LON));

  return {
    localDateTime: m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null,
    offset: ascii(view, exif.get(TAG_OFFSET_TIME_ORIGINAL)),
    latDeg:
      lat === null
        ? null
        : ascii(view, gps.get(GPS_LAT_REF)) === "S"
          ? -lat
          : lat,
    lonDeg:
      lon === null
        ? null
        : ascii(view, gps.get(GPS_LON_REF)) === "W"
          ? -lon
          : lon,
  };
};
