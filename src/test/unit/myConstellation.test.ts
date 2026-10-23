import type { SkyPose } from "@/game/myConstellation/visibility";
import { describe, expect, it } from "vitest";
import {
  mapProjector,
  MAP_H,
  MAP_W,
  panView,
  pickMapStar,
  vectorOf,
} from "@/game/myConstellation/drawStarMap";
import {
  decodeStrokes,
  edgesOf,
  EMPTY_SHAPE,
  encodeStrokes,
  liftPen,
  MAX_STARS,
  STAR_BY_HR,
  starsOf,
  tapStar,
  vectorsOf,
} from "@/game/myConstellation/shape";
import {
  altitudeContour,
  bottomAltitude,
  contourLabel,
  domePoint,
  edgeDirections,
  horizonMarks,
  projectAltAz,
  viewFor,
} from "@/game/myConstellation/skyGuide";
import { upsertSaved } from "@/game/myConstellation/storage";
import {
  bestOnNight,
  culmination,
  defaultDarkness,
  effectiveLimit,
  findingTips,
  guideStar,
  hoursFromEvening,
  moonGlowAt,
  moonlessNight,
  pickBestMonth,
  poseAt,
  relativeDirection,
  shapeGeometry,
  yearlyBest,
} from "@/game/myConstellation/visibility";
import { STARS } from "@/game/sky/catalog";
import { CITIES, SEOUL } from "@/game/tonight/places";
import { separationDeg } from "@/game/tonight/report";
import { localParts, localToUtc } from "@/game/tonight/time";
import { horizonCameraTP } from "@/search/horizonSolve";
import {
  fromAltAzJ2000,
  horizontalFrameJ2000,
  julianDay,
} from "@/search/utils/ephemeris";
import { projectVecToPhoto } from "@/search/utils/wcs";

// 나만의 별자리: 별 잇기(획·되돌리기·주소), 보관함, 실제 하늘에서의 높이·가장 잘 보이는 달, 찾는 길잡이, 별 지도 투영.
// 기준은 널리 알려진 사실: 오리온은 서울의 겨울 저녁 남쪽 하늘, 남십자는 서울에서 뜨지 않고 시드니에선 지지 않는다.

const tap = (...hrs: string[]) => hrs.reduce(tapStar, EMPTY_SHAPE);

// 오리온: 베텔게우스·벨라트릭스·민타카·알닐람·알니탁·사이프·리겔
const BETELGEUSE = "2061";
const BELLATRIX = "1790";
const MINTAKA = "1852";
const ALNILAM = "1903";
const ALNITAK = "1948";
const SAIPH = "2004";
const RIGEL = "1713";
const ORION = tap(
  BETELGEUSE,
  ALNITAK,
  ALNILAM,
  MINTAKA,
  BELLATRIX,
  BETELGEUSE,
  BETELGEUSE, // 펜 떼기
  ALNITAK,
  SAIPH,
  SAIPH,
  MINTAKA,
  RIGEL,
);
// 남십자: 아크룩스·미모사·가크룩스·델타
const CRUX = tap("4730", "4763", "4763", "4853", "4656");
const SYDNEY = CITIES.find((c) => c.name === "시드니")!;

describe("별 잇기", () => {
  it("카탈로그에 오리온·남십자 별이 있다", () => {
    for (const hr of [...starsOf(ORION), ...starsOf(CRUX)]) {
      expect(STAR_BY_HR.has(hr)).toBe(true);
    }

    expect(STAR_BY_HR.get(RIGEL)!.name).toBe("리겔");
  });

  it("펜이 닿아 있으면 잇고, 같은 별을 다시 누르면 펜을 뗀다", () => {
    let s = tapStar(EMPTY_SHAPE, "1");
    s = tapStar(s, "2");
    expect(s).toEqual({ strokes: [["1", "2"]], open: true });
    s = tapStar(s, "2");
    expect(s.open).toBe(false);
    s = tapStar(s, "3");
    expect(s.strokes).toEqual([["1", "2"], ["3"]]);
    expect(s.open).toBe(true);
  });

  it("펜을 떼면 별 하나뿐인 획은 사라진다", () => {
    const s = liftPen(tap("1", "2", "2", "3"));
    expect(s).toEqual({ strokes: [["1", "2"]], open: false });
  });

  it("같은 선은 한 번만 센다 (거꾸로 되짚어도)", () => {
    const s = tap("1", "2", "1", "3");
    expect(edgesOf(s)).toEqual([
      ["1", "2"],
      ["1", "3"],
    ]);
    expect(starsOf(s)).toEqual(["1", "2", "3"]);
  });

  it("오리온은 별 7개, 선 7개", () => {
    expect(starsOf(ORION)).toHaveLength(7);
    expect(edgesOf(ORION)).toHaveLength(7);
  });

  it(`별은 ${MAX_STARS}개까지만 이을 수 있다`, () => {
    const hrs = STARS.slice(0, MAX_STARS + 5).map((s) => s.hr);
    const s = hrs.reduce(tapStar, EMPTY_SHAPE);
    expect(starsOf(s)).toHaveLength(MAX_STARS);
  });

  it("주소로 옮겼다 되돌려도 같은 선", () => {
    const text = encodeStrokes(ORION);
    expect(text).toMatch(/^[\d_-]+$/);
    const back = decodeStrokes(text);
    expect(edgesOf(back)).toEqual(edgesOf(ORION));
    expect(back.open).toBe(false);
  });

  it("모르는 별 번호는 건너뛰고 그 자리에서 획을 나눈다", () => {
    const s = decodeStrokes(
      `${RIGEL}-${SAIPH}-99999-abc-${BETELGEUSE}-${BELLATRIX}`,
    );
    expect(s.strokes).toEqual([
      [RIGEL, SAIPH],
      [BETELGEUSE, BELLATRIX],
    ]);
    expect(decodeStrokes("").strokes).toEqual([]);
    expect(decodeStrokes("x_y").strokes).toEqual([]);
  });
});

describe("보관함", () => {
  it("같은 모양은 이름만 바꿔 맨 앞으로, 12개를 넘으면 오래된 것부터 밀린다", () => {
    let list = upsertSaved([], "가", "1-2", 1);
    list = upsertSaved(list, "나", "3-4", 2);
    list = upsertSaved(list, "  다  ", "1-2", 3);
    expect(list.map((s) => s.name)).toEqual(["다", "나"]);

    for (let i = 0; i < 20; i++) {
      list = upsertSaved(list, `${i}`, `${i}-${i + 100}`, 10 + i);
    }

    expect(list).toHaveLength(12);
    expect(list[0].name).toBe("19");
    expect(upsertSaved([], "   ", "1-2", 0)[0].name).toBe("이름 없는 별자리");
  });
});

describe("하늘 밝기", () => {
  it("큰 도시는 3등급, 별 보기 명소는 6등급, 그 밖은 4등급", () => {
    expect(defaultDarkness(SEOUL)).toBe(3);
    expect(defaultDarkness({ name: "영양 (반딧불이 밤하늘)" })).toBe(6);
    expect(defaultDarkness({ name: "춘천" })).toBe(4);
    expect(defaultDarkness({ name: "37.5°N 127.0°E" })).toBe(4);
  });

  it("머리 위에선 그대로, 고도 10°에선 1등급쯤 흐려진다", () => {
    expect(effectiveLimit(5, 90)).toBeCloseTo(5, 6);
    expect(effectiveLimit(5, 10)).toBeGreaterThan(3.6);
    expect(effectiveLimit(5, 10)).toBeLessThan(4);
  });
});

describe("실제 하늘에서", () => {
  const orionHrs = starsOf(ORION);
  const orion = shapeGeometry(vectorsOf(ORION));
  const crux = shapeGeometry(vectorsOf(CRUX));

  it("오리온의 크기는 약 20°", () => {
    expect(orion.spanDeg).toBeGreaterThan(17);
    expect(orion.spanDeg).toBeLessThan(23);
    expect(orion.radiusDeg).toBeLessThan(orion.spanDeg);
  });

  it("남중 높이: 서울에서 오리온 약 52°, 남십자는 뜨지 않고 시드니에선 지지 않는다", () => {
    const o = culmination(orion.center, SEOUL.latDeg);
    expect(o.maxAlt).toBeGreaterThan(50);
    expect(o.maxAlt).toBeLessThan(55);
    expect(o.neverRises).toBe(false);
    expect(culmination(crux.center, SEOUL.latDeg).neverRises).toBe(true);
    expect(culmination(crux.center, SYDNEY.latDeg).neverSets).toBe(true);
  });

  it("1월 20일 밤 9시 서울: 오리온은 남동~남쪽 하늘 높이, 밝은 별은 도심에서도 보인다", () => {
    const t = localToUtc(2026, 1, 20, 21, 0, SEOUL.tz);
    const pose = poseAt(orionHrs, t, SEOUL, 3);
    expect(pose.sunAlt).toBeLessThan(-18);
    expect(pose.centerAlt).toBeGreaterThan(30);
    expect(pose.centerAz).toBeGreaterThan(120);
    expect(pose.centerAz).toBeLessThan(200);
    expect(pose.above).toBe(7);

    const rigel = pose.stars.find((s) => s.hr === RIGEL)!;
    expect(rigel.visible).toBe(true);
  });

  it("도심 하늘에선 어두운 별이 안 보이고, 어두운 곳에선 보인다", () => {
    const faint = STARS.find(
      (s) =>
        s.mag > 4.3 &&
        separationDeg(s.vector, STAR_BY_HR.get(BETELGEUSE)!.vector) < 8,
    )!;
    const hrs = [BETELGEUSE, faint.hr];
    // 달이 없는 밤 (2026-01-18 그믐 무렵)
    const t = localToUtc(2026, 1, 18, 22, 0, SEOUL.tz);
    const city = poseAt(hrs, t, SEOUL, 3);
    const dark = poseAt(hrs, t, SEOUL, 6);
    expect(city.stars[1].visible).toBe(false);
    expect(dark.stars[1].visible).toBe(true);
    expect(city.moonGlow).toBeLessThan(0.1);
  });

  it("한낮에는 아무 별도 안 보인다", () => {
    const t = localToUtc(2026, 1, 20, 13, 0, SEOUL.tz);
    const pose = poseAt(orionHrs, t, SEOUL, 6);
    expect(pose.sunAlt).toBeGreaterThan(0);
    expect(pose.visible).toBe(0);
  });

  it("서울에서 오리온이 가장 잘 보이는 달은 한겨울(12~2월)", () => {
    const months = yearlyBest(orion.center, SEOUL, 2026, 1);
    expect(months).toHaveLength(12);
    expect(months[11]).toMatchObject({ year: 2026, month: 12 });
    const best = pickBestMonth(months, SEOUL.tz)!;
    expect([12, 1, 2]).toContain(best.month);
    expect(best.best!.altDeg).toBeGreaterThan(45);
    // 7월 한밤엔 해 근처라 어두운 동안 떠오르지 않는다
    expect(months[6].best).toBeNull();
  });

  it("가장 잘 보이는 때의 시각은 그날 밤(저녁 5시 ~ 아침 7시) 안", () => {
    const best = bestOnNight(orion.center, SEOUL, 2026, 1, 15)!;
    const p = localParts(best.t, SEOUL.tz);
    expect(p.hour >= 17 || p.hour < 7).toBe(true);
    expect(hoursFromEvening(best.t, SEOUL.tz)).toBeLessThan(10);
  });

  it("가장 잘 보이는 때로 갈 땐 그달에서 달빛이 적은 밤을 고른다 (15일이 보름 무렵이어도)", () => {
    const seoul = { latDeg: SEOUL.latDeg, lonDeg: SEOUL.lonDeg };
    // 2027년 9월 16일이 보름이라 15일 밤은 달빛이 세다
    const mid = bestOnNight(orion.center, SEOUL, 2027, 9, 15)!;
    const dark = moonlessNight(orion.center, SEOUL, 2027, 9)!;
    expect(moonGlowAt(mid.t, seoul)).toBeGreaterThan(0.3);
    expect(moonGlowAt(dark.t, seoul)).toBeLessThan(0.1);
    expect(localParts(dark.t, SEOUL.tz).month).toBe(9);
  });

  it("서울에서 남십자는 어느 밤에도 뜨지 않는다", () => {
    expect(bestOnNight(crux.center, SEOUL, 2026, 4, 15)).toBeNull();
    expect(
      pickBestMonth(yearlyBest(crux.center, SEOUL, 2026, 1), SEOUL.tz),
    ).toBeNull();
    expect(bestOnNight(crux.center, SYDNEY, 2026, 4, 15)).not.toBeNull();
  });

  it("길잡이: 오리온엔 밝은 별(리겔)이 있으니 그 별부터", () => {
    const t = localToUtc(2026, 1, 20, 21, 0, SEOUL.tz);
    const g = guideStar(orionHrs, t, SEOUL)!;
    expect(g.member).toBe(true);
    expect(g.name).toBe("리겔");
  });

  it("길잡이: 어두운 별만 이으면 가까운 밝은 별을 알려 준다", () => {
    const betel = STAR_BY_HR.get(BETELGEUSE)!.vector;
    const faint = STARS.filter(
      (s) => s.mag > 3.5 && separationDeg(s.vector, betel) < 10,
    )
      .slice(0, 3)
      .map((s) => s.hr);
    const t = localToUtc(2026, 1, 20, 21, 0, SEOUL.tz);
    const g = guideStar(faint, t, SEOUL)!;
    expect(g.member).toBe(false);
    expect(g.mag).toBeLessThanOrEqual(2);
    expect(g.sepDeg).toBeLessThan(45);
    expect(g.direction).not.toBe("");
  });

  it("상대 방향: 방위가 크면 오른쪽, 높으면 위", () => {
    expect(
      relativeDirection({ altDeg: 30, azDeg: 180 }, { altDeg: 30, azDeg: 200 }),
    ).toBe("오른쪽");
    expect(
      relativeDirection({ altDeg: 30, azDeg: 350 }, { altDeg: 30, azDeg: 10 }),
    ).toBe("오른쪽");
    expect(
      relativeDirection({ altDeg: 20, azDeg: 90 }, { altDeg: 40, azDeg: 90 }),
    ).toBe("위");
    expect(
      relativeDirection({ altDeg: 40, azDeg: 90 }, { altDeg: 30, azDeg: 80 }),
    ).toBe("왼쪽 아래");
  });

  it("찾는 안내: 지평선 아래면 가장 잘 보이는 때를, 떠 있으면 방향과 보이는 별 수를", () => {
    const below = poseAt(
      orionHrs,
      localToUtc(2026, 7, 15, 21, 0, SEOUL.tz),
      SEOUL,
      3,
    );
    const tipsBelow = findingTips({
      pose: below,
      guide: null,
      spanDeg: orion.spanDeg,
      limit: 3,
      placeName: "서울",
      bestLabel: "1월 중순 밤 9시 무렵",
    });
    expect(tipsBelow[0].text).toMatch(/지평선 아래|해가 떠/);
    expect(tipsBelow[0].text).toContain("1월 중순");

    const t = localToUtc(2026, 1, 20, 21, 0, SEOUL.tz);
    const up = poseAt(orionHrs, t, SEOUL, 3);
    const tips = findingTips({
      pose: up,
      guide: guideStar(orionHrs, t, SEOUL),
      spanDeg: orion.spanDeg,
      limit: 3,
      placeName: "서울",
      bestLabel: null,
    });
    expect(tips[0].text).toMatch(/쪽 하늘을 보세요/);
    expect(tips.some((x) => x.text.includes("리겔"))).toBe(true);
    expect(tips.some((x) => x.text.includes("주먹 2개"))).toBe(true);
  });

  it("하늘 그림은 별자리 쪽을 보고, 지평선 아래면 지평선을 본다", () => {
    const t = localToUtc(2026, 1, 20, 21, 0, SEOUL.tz);
    const up = poseAt(orionHrs, t, SEOUL, 3);
    const v = viewFor(up, orion.radiusDeg, W, H);
    expect(v.azimuthDeg).toBeCloseTo(up.centerAz, 6);
    expect(v.fovDeg).toBeGreaterThanOrEqual(50);

    const low = viewFor({ ...up, centerAlt: -20 }, orion.radiusDeg, W, H);
    expect(low.altitudeDeg).toBeCloseTo(low.fovDeg * 0.32, 6);
  });
});

// 하늘에서 보기의 길잡이: 별자리가 작아도 지평선·방위·높이가 같이 보여야 실제 하늘에서 찾을 수 있다
const W = 1200;
const H = 900;
const inFrame = (p: [number, number] | null) =>
  p !== null && p[0] > 0 && p[0] < W && p[1] > 0 && p[1] < H;

// 가운데 (alt, az)에 반지름 r°쯤 퍼진 작은 별자리 (별 네 개)
const smallPose = (alt: number, az: number, r: number): SkyPose => ({
  t: 0,
  centerAlt: alt,
  centerAz: az,
  sunAlt: -30,
  moonGlow: 0,
  stars: [
    [alt + r, az],
    [alt - r, az],
    [alt, az + r / Math.cos((alt * Math.PI) / 180)],
    [alt, az - r / Math.cos((alt * Math.PI) / 180)],
  ].map(([altDeg, azDeg], i) => ({
    hr: String(i),
    mag: 2,
    altDeg,
    azDeg,
    visible: true,
  })),
  above: 4,
  visible: 4,
});

describe("하늘에서 보기 길잡이", () => {
  it("화면 투영은 사진 변환(horizonCameraTP)과 같다", () => {
    const t = localToUtc(2026, 1, 20, 21, 0, SEOUL.tz);
    const date = new Date(t);
    const frame = horizontalFrameJ2000(julianDay(date), SEOUL);
    const view = { azimuthDeg: 160, altitudeDeg: 25, rollDeg: 0, fovDeg: 70 };
    const TP = horizonCameraTP(date, SEOUL, view, W, H);

    for (const [alt, az] of [
      [0, 160],
      [30, 140],
      [55, 200],
      [5, 110],
    ]) {
      const a = projectAltAz(view, alt, az, W, H)!;
      const b = projectVecToPhoto(TP, fromAltAzJ2000(frame, alt, az))!;
      expect(a[0]).toBeCloseTo(b[0], 3);
      expect(a[1]).toBeCloseTo(b[1], 3);
    }
  });

  it("작은 별자리라도 그 아래 지평선과 별자리 전체가 한 화면에 들어온다", () => {
    for (const [alt, az] of [
      [8, 120],
      [25, 180],
      [45, 250],
      [62, 30],
    ]) {
      const pose = smallPose(alt, az, 2);
      const v = viewFor(pose, 2, W, H);

      // 별자리 바로 아래 지평선 점이 화면 안, 아래쪽에 있다
      const foot = projectAltAz(v, 0, az, W, H);
      expect(inFrame(foot)).toBe(true);
      expect(foot![1]).toBeGreaterThan(H * 0.7);

      for (const s of pose.stars) {
        expect(inFrame(projectAltAz(v, s.altDeg, s.azDeg, W, H))).toBe(true);
      }

      expect(bottomAltitude(v)).toBe(0);
    }
  });

  it("실제 오리온(서울 1월 저녁)도 지평선과 함께 보인다", () => {
    const orionHrs = starsOf(ORION);
    const orion = shapeGeometry(vectorsOf(ORION));
    const t = localToUtc(2026, 1, 20, 21, 0, SEOUL.tz);
    const pose = poseAt(orionHrs, t, SEOUL, 3);
    const v = viewFor(pose, orion.radiusDeg, W, H);

    expect(inFrame(projectAltAz(v, 0, pose.centerAz, W, H))).toBe(true);

    for (const s of pose.stars) {
      expect(inFrame(projectAltAz(v, s.altDeg, s.azDeg, W, H))).toBe(true);
    }
  });

  it("머리 위 가까이의 별자리는 별자리 쪽을 보고, 지평선이 얼마나 아래인지 알려 준다", () => {
    const v = viewFor(smallPose(86, 180, 3), 3, W, H);
    expect(v.altitudeDeg).toBeGreaterThan(60);
    expect(bottomAltitude(v)).toBeGreaterThan(10);
  });

  it("남쪽을 보면 '남'이 가운데, '남동'은 왼쪽, '남서'는 오른쪽, 지평선은 한 줄", () => {
    const view = { azimuthDeg: 180, altitudeDeg: 25, rollDeg: 0, fovDeg: 90 };
    const marks = horizonMarks(view, W, H);
    const byLabel = (l: string) => marks.find((m) => m.label === l)!;

    expect(byLabel("남").x).toBeCloseTo(W / 2, 6);
    expect(byLabel("남동").x).toBeLessThan(W / 2);
    expect(byLabel("남서").x).toBeGreaterThan(W / 2);
    expect(marks.some((m) => m.label === "북")).toBe(false);

    // 롤 0이면 지평선은 수평선: 모든 눈금이 같은 높이 (광축보다 25° 아래)
    const f = H / 2 / Math.tan((45 * Math.PI) / 180);
    const y = H / 2 + f * Math.tan((25 * Math.PI) / 180);

    for (const m of marks) {
      expect(m.y).toBeCloseTo(y, 3);
    }

    // 10°마다 눈금
    expect(marks.filter((m) => m.label === null).length).toBeGreaterThan(5);
  });

  it("시야가 좁아도 화면 양 끝 너머의 방위를 알려 준다", () => {
    // 남쪽을 좁게 보면 '남'만 화면에 있고, 왼쪽 너머는 남동, 오른쪽 너머는 남서
    const narrow = { azimuthDeg: 180, altitudeDeg: 20, rollDeg: 0, fovDeg: 60 };
    expect(
      horizonMarks(narrow, W, H)
        .filter((m) => m.label)
        .map((m) => m.label),
    ).toEqual(["남"]);
    expect(edgeDirections(narrow, W, H)).toEqual({
      left: "남동",
      right: "남서",
    });

    // 북쪽(0°)을 보면 화면에 '북'이 있고, 왼쪽 너머는 북서, 오른쪽 너머는 북동 (북 0°를 지나도 이름이 맞다)
    const n = { azimuthDeg: 0, altitudeDeg: 20, rollDeg: 0, fovDeg: 60 };
    expect(
      horizonMarks(n, W, H)
        .filter((m) => m.label)
        .map((m) => m.label),
    ).toEqual(["북"]);
    expect(edgeDirections(n, W, H)).toEqual({ left: "북서", right: "북동" });
  });

  it("고도 등고선은 지평선보다 위, 높을수록 더 위에 그려진다", () => {
    const view = { azimuthDeg: 180, altitudeDeg: 30, rollDeg: 0, fovDeg: 80 };

    const yAtCenter = (alt: number) => {
      const pts = altitudeContour(view, alt, W, H).flat();

      return pts.reduce((a, b) =>
        Math.abs(b[0] - W / 2) < Math.abs(a[0] - W / 2) ? b : a,
      )[1];
    };

    const horizonY = projectAltAz(view, 0, 180, W, H)![1];

    expect(yAtCenter(10)).toBeLessThan(horizonY);
    expect(yAtCenter(30)).toBeLessThan(yAtCenter(10));
    expect(yAtCenter(30)).toBeCloseTo(H / 2, 0);
    expect(yAtCenter(60)).toBeLessThan(yAtCenter(30));
    expect(contourLabel(30)).toBe("30° · 주먹 3개");
  });

  it("둥근 하늘 지도: 가운데가 머리 위, 바라보는 쪽이 아래, 그 오른쪽이 오른쪽", () => {
    const [cx, cy, R] = [100, 100, 50];
    // 남쪽을 보면: 남이 아래, 서가 오른쪽, 동이 왼쪽, 북이 위
    const s = domePoint(0, 180, 180, cx, cy, R);
    expect(s[0]).toBeCloseTo(cx, 6);
    expect(s[1]).toBeCloseTo(cy + R, 6);
    expect(domePoint(0, 270, 180, cx, cy, R)[0]).toBeCloseTo(cx + R, 6);
    expect(domePoint(0, 90, 180, cx, cy, R)[0]).toBeCloseTo(cx - R, 6);
    expect(domePoint(0, 0, 180, cx, cy, R)[1]).toBeCloseTo(cy - R, 6);
    // 머리 위는 가운데, 고도 45°는 반지름의 절반
    const z = domePoint(90, 123, 180, cx, cy, R);
    expect(z[0]).toBeCloseTo(cx, 6);
    expect(z[1]).toBeCloseTo(cy, 6);
    expect(domePoint(45, 180, 180, cx, cy, R)[1]).toBeCloseTo(cy + R / 2, 6);
  });
});

describe("별 지도", () => {
  it("가운데 방향은 지도 가운데, 동쪽(적경이 큰 쪽)은 왼쪽, 북쪽은 위", () => {
    const view = { raDeg: 80, decDeg: 10, scale: 600 };
    const p = mapProjector(view);
    const c = p(vectorOf(80, 10))!;
    expect(c.x).toBeCloseTo(MAP_W / 2, 6);
    expect(c.y).toBeCloseTo(MAP_H / 2, 6);
    expect(p(vectorOf(85, 10))!.x).toBeLessThan(MAP_W / 2);
    expect(p(vectorOf(80, 15))!.y).toBeLessThan(MAP_H / 2);
    // 가운데 근처 1° ≈ scale·π/180 px
    expect(MAP_H / 2 - p(vectorOf(80, 11))!.y).toBeCloseTo(
      (600 * Math.PI) / 180,
      0,
    );
    expect(p(vectorOf(260, -10))).toBeNull();
  });

  it("끌면 끈 만큼 하늘이 따라온다", () => {
    const view = { raDeg: 80, decDeg: 10, scale: 600 };
    const moved = panView(view, 50, 30);
    const before = mapProjector(view)(vectorOf(80, 10))!;
    const after = mapProjector(moved)(vectorOf(80, 10))!;
    expect(after.x - before.x).toBeCloseTo(50, -1);
    expect(after.y - before.y).toBeCloseTo(30, -1);
    expect(panView(view, 0, 1e6).decDeg).toBe(89);
  });

  it("누른 자리에서 가까운 별, 비슷하면 밝은 별", () => {
    const stars = [
      { hr: "a", x: 100, y: 100, mag: 4.5 },
      { hr: "b", x: 104, y: 100, mag: 1 },
      { hr: "c", x: 300, y: 300, mag: 0 },
    ];
    expect(pickMapStar(stars, 101, 100, 20)).toBe("b");
    expect(pickMapStar(stars, 200, 200, 20)).toBeNull();
  });
});
