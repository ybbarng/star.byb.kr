import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readExif } from "@/services/exif";

const sample = (file: string) => {
  const b = readFileSync(resolve(process.cwd(), "public/samples", file));

  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

// 휴대폰 사진처럼 GPS IFD만 있는 최소 JPEG (빅엔디언 "MM", 아이폰과 같은 바이트 순서)
const jpegWithGps = (
  lat: [number, number, number],
  latRef: "N" | "S",
  lon: [number, number, number],
  lonRef: "E" | "W",
) => {
  const tiff: number[] = [];
  const u16 = (v: number) => tiff.push((v >> 8) & 0xff, v & 0xff);
  const u32 = (v: number) =>
    tiff.push((v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);

  // TIFF 머리 + IFD0(항목 1개: GPS 포인터)
  tiff.push(0x4d, 0x4d);
  u16(42);
  u32(8);
  u16(1);
  u16(0x8825);
  u16(4);
  u32(1);
  u32(26); // GPS IFD 위치
  u32(0);
  // GPS IFD(항목 4개) — 유리수 값은 IFD 뒤(26 + 2 + 48 + 4 = 80)에 둔다
  u16(4);

  const ref = (tag: number, c: string) => {
    u16(tag);
    u16(2);
    u32(2);
    tiff.push(c.charCodeAt(0), 0, 0, 0);
  };

  const rational = (tag: number, at: number) => {
    u16(tag);
    u16(5);
    u32(3);
    u32(at);
  };

  ref(1, latRef);
  rational(2, 80);
  ref(3, lonRef);
  rational(4, 104);
  u32(0);

  for (const v of [...lat, ...lon]) {
    u32(Math.round(v * 100));
    u32(100);
  }

  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const length = app1.length + 2;

  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    length >> 8,
    length & 0xff,
    ...app1,
    0xff,
    0xd9,
  ]).buffer;
};

describe("readExif", () => {
  it("캐논 원본(big-dipper)의 촬영 시각과 시간대를 읽는다", () => {
    const exif = readExif(sample("big-dipper.jpg"))!;

    expect(exif.localDateTime).toBe("2019-09-17T00:05:26");
    expect(exif.offset).toBe("-05:00");
    expect(exif.latDeg).toBeNull();
  });

  it("메신저를 거쳐 EXIF가 지워진 사진은 시각이 없다", () => {
    expect(
      readExif(sample("20220607-berry-seoul.jpg"))?.localDateTime ?? null,
    ).toBeNull();
  });

  it("GPS 도·분·초를 도로 바꾸고 남·서는 음수로 둔다", () => {
    const exif = readExif(jpegWithGps([37, 30, 32.4], "N", [127, 6, 0], "E"))!;

    expect(exif.latDeg).toBeCloseTo(37.509, 3);
    expect(exif.lonDeg).toBeCloseTo(127.1, 3);

    const south = readExif(jpegWithGps([33, 51, 0], "S", [151, 12, 0], "W"))!;
    expect(south.latDeg).toBeCloseTo(-33.85, 3);
    expect(south.lonDeg).toBeCloseTo(-151.2, 3);
  });

  it("JPEG가 아니면 null", () => {
    expect(readExif(sample("20230904-nike-jeungseun-01.png"))).toBeNull();
  });
});
