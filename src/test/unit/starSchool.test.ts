import { describe, expect, it } from "vitest";
import { toEcliptic, ZODIAC } from "@/game/birthday/zodiac";
import { birthdaySky } from "@/game/birthday/zodiac";
import { constellationParts, uniqueStars } from "@/game/sky/catalog";
import { ASTERISMS, asterismById } from "@/game/starSchool/asterisms";
import { DEEP_SKY, deepSkyById } from "@/game/starSchool/deepSky";
import {
  dexEntries,
  dexEntry,
  eveningBest,
  tonightSky,
} from "@/game/starSchool/dex";
import { asterismFigure, constellationFigure } from "@/game/starSchool/figure";
import {
  aimFallback,
  hopTip,
  stepDate,
  stepVectors,
  tapVector,
} from "@/game/starSchool/lessonGeometry";
import { LESSONS, SEASON_LESSONS } from "@/game/starSchool/lessons";
import { galacticVector, milkyWayPatches } from "@/game/starSchool/milkyWay";
import {
  altAzAt,
  hrVector,
  observerOf,
  raDecVector,
  separationDeg,
  STAR_BY_HR,
  sunAltAt,
} from "@/game/starSchool/skyMath";
import { DEEP_SKY_OBJECTS } from "@/search/skyObjects";
import { constellationAt } from "@/search/utils/constellationBounds";
import {
  julianDay,
  moonVectorFrom,
  ofDateToJ2000,
  sunVector,
} from "@/search/utils/ephemeris";

// 별자리 익히기: 길잡이 모양·딥스카이·수업 시각·황도 순서가 실제 하늘과 맞는지.

const latinOf = (hr: string) => STAR_BY_HR.get(hr)?.latinName;

describe("길잡이 모양", () => {
  it.each(ASTERISMS.map((a) => a.id))(
    "%s: 꼭짓점·선의 별이 모두 카탈로그에 있고, 적어 둔 별자리 안에 있다",
    (id) => {
      const a = asterismById(id);
      const hrs = [...new Set([...a.vertices, ...a.path.flat()])];

      for (const hr of hrs) {
        expect(STAR_BY_HR.has(hr), `HR ${hr}`).toBe(true);
        expect(a.constellations, `HR ${hr}`).toContain(
          constellationAt(hrVector(hr)),
        );
      }

      // 선은 꼭짓점만 잇는다 (꼭짓점 아닌 별로 새지 않게)
      for (const hr of a.path.flat()) {
        expect(a.vertices, `${id} 선의 HR ${hr}`).toContain(hr);
      }
    },
  );

  it.each([
    ["summer-triangle", ["Vega", "Altair", "Deneb"]],
    ["winter-triangle", ["Betelgeuse", "Sirius", "Procyon"]],
    ["spring-triangle", ["Arcturus", "Spica", "Denebola"]],
    [
      "winter-hexagon",
      ["Sirius", "Procyon", "Pollux", "Capella", "Aldebaran", "Rigel"],
    ],
    ["great-square", ["Markab", "Scheat", "Alpheratz", "Algenib"]],
    [
      "big-dipper",
      ["Dubhe", "Merak", "Phecda", "Megrez", "Alioth", "Mizar", "Alkaid"],
    ],
    ["cassiopeia-w", ["Caph", "Schedar", "Navi", "Ruchbah", "Segin"]],
    ["orion-belt", ["Alnitak", "Alnilam", "Mintaka"]],
    ["pointers", ["Rigil Kentaurus", "Hadar"]],
  ] as const)("%s의 별은 %j", (id, names) => {
    expect(asterismById(id).vertices.map(latinOf)).toEqual(names);
  });

  it("남십자는 아크룩스·미모사·가크룩스와 델타별(적경 12h15m, 적위 −58.7°)", () => {
    const a = asterismById("southern-cross");

    expect(a.vertices.slice(0, 3).map(latinOf).sort()).toEqual(
      ["Acrux", "Gacrux", "Mimosa"].sort(),
    );
    expect(
      separationDeg(hrVector(a.vertices[3]), raDecVector(183.786, -58.749)),
    ).toBeLessThan(0.1);
  });

  it("가짜 십자가는 용골자리 엡실론·이오타와 돛자리 델타·카파", () => {
    const expected = [
      [125.628, -59.51], // ε Car (아비오르)
      [139.273, -59.275], // ι Car
      [131.176, -54.708], // δ Vel
      [140.528, -55.011], // κ Vel
    ];

    asterismById("false-cross").vertices.forEach((hr, i) => {
      expect(
        separationDeg(
          hrVector(hr),
          raDecVector(expected[i][0], expected[i][1]),
        ),
      ).toBeLessThan(0.1);
    });
  });

  it("여름철 대삼각형의 변: 직녀–견우 약 34°, 견우–데네브 약 38°, 데네브–직녀 약 24°", () => {
    const [vega, altair, deneb] =
      asterismById("summer-triangle").vertices.map(hrVector);

    expect(separationDeg(vega, altair)).toBeCloseTo(34.2, 0);
    expect(separationDeg(altair, deneb)).toBeCloseTo(38, 0);
    expect(separationDeg(deneb, vega)).toBeCloseTo(23.9, 0);
  });

  it("겨울철 대삼각형은 거의 정삼각형 (세 변이 25~28°)", () => {
    const [a, b, c] = asterismById("winter-triangle").vertices.map(hrVector);

    for (const d of [
      separationDeg(a, b),
      separationDeg(b, c),
      separationDeg(c, a),
    ]) {
      expect(d).toBeGreaterThan(25);
      expect(d).toBeLessThan(28);
    }
  });

  it("모양 그림은 −1~1 상자에 들어가고 선분이 있다", () => {
    for (const a of ASTERISMS) {
      const f = asterismFigure(a.id);

      expect(f.edges.length).toBeGreaterThan(0);

      for (const s of f.stars) {
        expect(Math.abs(s.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(s.y)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("별자리 그림은 북쪽이 위, 동쪽이 왼쪽 (오리온: 베텔게우스가 리겔보다 위·왼쪽)", () => {
    const f = constellationFigure("오리온자리");
    const bet = f.stars.find((s) => s.key === "2061")!;
    const rig = f.stars.find((s) => s.key === "1713")!;

    expect(bet.y).toBeLessThan(rig.y);
    expect(bet.x).toBeLessThan(rig.x);
  });
});

// 표준값: SIMBAD·NASA/IPAC (J2000 적경°·적위°)
const STANDARD: Record<string, [number, number]> = {
  m31: [10.6847, 41.269],
  m45: [56.75, 24.1167],
  m42: [83.8221, -5.3911],
  lmc: [80.8939, -69.7561],
  smc: [13.1867, -72.8286],
  "omega-cen": [201.697, -47.4795],
  "47tuc": [6.0223, -72.0813],
  coalsack: [192.5, -62.5],
  "carina-nebula": [161.265, -59.8667],
  m33: [23.4621, 30.6599],
  hyades: [66.725, 15.87],
  m44: [130.1, 19.67],
  m13: [250.4235, 36.4613],
  m7: [268.4625, -34.7928],
  m8: [270.9042, -24.3867],
  "galactic-center": [266.4168, -29.0078],
};

describe("맨눈 딥스카이", () => {
  it.each(Object.keys(STANDARD))("%s: J2000 위치가 표준값과 1° 안", (id) => {
    const d = deepSkyById(id);
    const [ra, dec] = STANDARD[id];

    expect(
      separationDeg(raDecVector(d.raDeg, d.decDeg), raDecVector(ra, dec)),
    ).toBeLessThan(1);
  });

  it.each(DEEP_SKY.map((d) => d.id))(
    "%s: 적어 둔 별자리가 IAU 경계로 본 별자리와 같다",
    (id) => {
      const d = deepSkyById(id);

      expect(constellationAt(raDecVector(d.raDeg, d.decDeg))).toBe(
        d.constellation,
      );
    },
  );

  it("플레이트 솔버의 딥스카이 목록(skyObjects)과 위치가 0.5° 안으로 같다", () => {
    const pairs: [string, string][] = [
      ["m31", "안드로메다 은하 M31"],
      ["m45", "플레이아데스 성단 M45"],
      ["m42", "오리온 대성운 M42"],
      ["lmc", "대마젤란은하"],
      ["smc", "소마젤란은하"],
      ["omega-cen", "오메가 센타우리"],
      ["47tuc", "큰부리새자리 47"],
      ["carina-nebula", "용골자리 성운"],
    ];

    for (const [id, name] of pairs) {
      const d = deepSkyById(id);
      const o = DEEP_SKY_OBJECTS.find((x) => x.name === name)!;

      expect(
        separationDeg(raDecVector(d.raDeg, d.decDeg), o.vector),
        id,
      ).toBeLessThan(0.5);
    }
  });
});

describe("수업 시각·장소", () => {
  const MIN_ALT = 15;

  for (const lesson of LESSONS) {
    describe(lesson.title, () => {
      const observer = observerOf(lesson.place);

      it.each(lesson.steps.map((s, i) => [i + 1, s] as const))(
        "%i단계: 해는 −12° 아래, 다루는 별은 15° 넘게 떠 있다",
        (_, step) => {
          const date = stepDate(lesson, step);

          expect(sunAltAt(date, observer)).toBeLessThan(-12);

          if (!step.allowLow) {
            for (const v of stepVectors(step)) {
              expect(altAzAt(v, date, observer).altDeg).toBeGreaterThan(
                MIN_ALT,
              );
            }
          }

          if (step.tap) {
            expect(
              altAzAt(tapVector(step.tap.target), date, observer).altDeg,
            ).toBeGreaterThan(MIN_ALT);
          }
        },
      );

      it("징검다리 화살표가 닿는 곳 근처에 목표가 있다", () => {
        for (const step of lesson.steps) {
          for (const m of step.marks) {
            if (m.kind === "hop" && m.lands) {
              const length = separationDeg(hrVector(m.from), hopTip(m));

              expect(separationDeg(hopTip(m), tapVector(m.lands))).toBeLessThan(
                Math.max(3, length * 0.25),
              );
            }
          }
        }
      });

      it("퀴즈 정답 번호가 보기 안에 있고, 마치면 열 도감 항목이 있다", () => {
        for (const q of lesson.quiz) {
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.choices.length);
        }

        for (const id of lesson.learns) {
          expect(dexEntry(id), id).toBeDefined();
        }
      });
    });
  }

  it("계절 수업 네 개는 북반구, 남반구 수업은 남반구 장소", () => {
    for (const id of SEASON_LESSONS) {
      const l = LESSONS.find((x) => x.id === id)!;

      expect(l.place.latDeg).toBeGreaterThan(30);
    }

    for (const l of LESSONS.filter((x) => x.hemisphere === "south")) {
      expect(l.place.latDeg).toBeLessThan(-20);
    }
  });

  const moonAt = (lessonId: string, stepIndex: number) => {
    const l = LESSONS.find((x) => x.id === lessonId)!;
    const date = stepDate(l, l.steps[stepIndex]);
    const jd = julianDay(date);
    const observer = observerOf(l.place);
    const moon = ofDateToJ2000(moonVectorFrom(jd, observer), jd);
    const sun = ofDateToJ2000(sunVector(jd), jd);
    const lit =
      (1 - (moon[0] * sun[0] + moon[1] * sun[1] + moon[2] * sun[2])) / 2;

    return { alt: altAzAt(moon, date, observer).altDeg, lit };
  };

  it("은하수 수업: 첫 밤은 달이 없고(그믐), 달 단계는 밝은 달이 떠 있다", () => {
    const dark = moonAt("milky-way", 0);
    const bright = moonAt("milky-way", 4);

    expect(dark.alt < 0 || dark.lit < 0.05).toBe(true);
    expect(bright.alt).toBeGreaterThan(10);
    expect(bright.lit).toBeGreaterThan(0.8);
  });

  it("남반구 여름 오리온은 거꾸로: 리겔이 베텔게우스보다 높다 (서울 겨울엔 반대)", () => {
    const sydney = LESSONS.find((x) => x.id === "south-clouds")!;
    const seoul = LESSONS.find((x) => x.id === "winter")!;
    const altIn = (l: typeof sydney, hr: string) =>
      altAzAt(hrVector(hr), stepDate(l, l.steps[0]), observerOf(l.place))
        .altDeg;

    expect(altIn(sydney, "1713")).toBeGreaterThan(altIn(sydney, "2061"));
    expect(altIn(seoul, "1713")).toBeLessThan(altIn(seoul, "2061"));
  });
});

describe("황도 별자리 13개", () => {
  // 별자리 별 중 황도 가까운 별(황위 ±10°)의 평균 황경
  const meanLon = (label: string) => {
    const lons = uniqueStars(constellationParts(label))
      .map(toEcliptic)
      .filter((e) => Math.abs(e.latDeg) < 10)
      .map((e) => e.lonDeg);
    const x = lons.reduce((s, l) => s + Math.cos((l * Math.PI) / 180), 0);
    const y = lons.reduce((s, l) => s + Math.sin((l * Math.PI) / 180), 0);

    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  };

  it("해가 지나는 순서(양 → … → 물고기)대로 별자리 별들의 황경이 늘어난다, 뱀주인자리 포함", () => {
    const labels = ZODIAC.map((z) => z.label);

    expect(labels).toHaveLength(13);
    expect(labels.indexOf("뱀주인자리")).toBe(labels.indexOf("전갈자리") + 1);
    expect(labels.indexOf("궁수자리")).toBe(labels.indexOf("뱀주인자리") + 1);

    const lons = labels.map(meanLon);
    // 양자리에서 시작해 한 바퀴 돌며 계속 늘어난다
    const unwrapped = lons.map((l) => (l < lons[0] - 1 ? l + 360 : l));

    for (let i = 1; i < unwrapped.length; i++) {
      expect(unwrapped[i], labels[i]).toBeGreaterThan(unwrapped[i - 1]);
    }
  });

  it("2026년 해가 뱀주인자리에 머무는 때는 11월 29~30일부터 12월 17~18일", () => {
    const inOph = (m: number, d: number) =>
      birthdaySky(2026, m, d).constellation.label === "뱀주인자리";

    expect(inOph(11, 28)).toBe(false);
    expect(inOph(12, 1)).toBe(true);
    expect(inOph(12, 17)).toBe(true);
    expect(inOph(12, 19)).toBe(false);
  });
});

describe("은하수", () => {
  it("은하 좌표 (0°, 0°)는 궁수자리 A*와 0.1° 안", () => {
    expect(
      separationDeg(galacticVector(0, 0), raDecVector(266.4168, -29.0078)),
    ).toBeLessThan(0.1);
  });

  it("은하수 띠는 데네브·남십자·석탄자루 곁을 지나고, 북극성에선 멀다", () => {
    const patches = milkyWayPatches();
    const nearest = (v: ReturnType<typeof hrVector>) =>
      Math.min(...patches.map((p) => separationDeg(p.vector, v)));

    expect(nearest(hrVector("7924"))).toBeLessThan(6);
    expect(nearest(hrVector("4730"))).toBeLessThan(6);
    expect(nearest(raDecVector(192.5, -62.5))).toBeLessThan(6);
    expect(nearest(hrVector("424"))).toBeGreaterThan(20);
  });
});

describe("도감", () => {
  it("별자리 88개 전부, 길잡이 모양·딥스카이가 겹치지 않는 id로 들어 있다", () => {
    const entries = dexEntries();
    const ids = entries.map((e) => e.id);

    expect(entries.filter((e) => e.kind === "constellation")).toHaveLength(88);
    expect(entries.filter((e) => e.kind === "asterism")).toHaveLength(
      ASTERISMS.length,
    );
    expect(entries.filter((e) => e.kind === "deepSky")).toHaveLength(
      DEEP_SKY.length,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("서울 저녁 9시에 가장 높이 뜨는 달: 오리온 1~2월(남쪽), 거문고 8~9월, 페가수스 10~11월", () => {
    const orion = eveningBest(dexEntry("c:오리온자리")!.center);
    const lyra = eveningBest(dexEntry("c:거문고자리")!.center);
    const peg = eveningBest(dexEntry("c:페가수스자리")!.center);

    expect([1, 2]).toContain(orion.month);
    expect(orion.direction).toBe("남");
    expect([8, 9]).toContain(lyra.month);
    expect([10, 11]).toContain(peg.month);
  });

  it("남십자는 남반구 것으로, 시드니 저녁 9시에 4~6월에 가장 높다", () => {
    const crux = dexEntry("c:남십자자리")!;
    const best = eveningBest(crux.center);

    expect(crux.hemisphere).toBe("south");
    expect(best.place.name).toBe("시드니");
    expect([4, 5, 6]).toContain(best.month);
  });

  it("북쪽왕관자리에는 재발 신성 T의 이야기가 있고, 날짜를 단정하지 않는다", () => {
    const story = dexEntry("c:북쪽왕관자리")!.story;

    expect(story).toContain("1866");
    expect(story).toContain("1946");
    expect(story).not.toMatch(/20[2-9]\d년에? (폭발|터)/);
  });

  it("작은곰자리는 서울에서 지지 않는다", () => {
    expect(eveningBest(dexEntry("c:작은곰자리")!.center).allYear).toBe(true);
  });

  it("오늘 밤: 1월 15일 서울에서 오리온은 저녁에 떠 있다, 남십자는 뜨지 않는다", () => {
    const seoul = LESSONS[0].place;
    const orion = tonightSky(dexEntry("c:오리온자리")!.center, seoul, {
      y: 2026,
      m: 1,
      d: 15,
    });
    const crux = tonightSky(dexEntry("c:남십자자리")!.center, seoul, {
      y: 2026,
      m: 1,
      d: 15,
    });

    expect(orion.highest?.altDeg).toBeGreaterThan(45);
    expect(orion.highest?.direction).toBe("남");
    expect(crux.neverUp).toBe(true);
  });
});

describe("수업 화면이 보는 쪽", () => {
  it("표시가 없는 단계는 이웃 단계가 보는 쪽을 본다 — 북극성 찾기 첫 단계는 북쪽 하늘", () => {
    const lesson = LESSONS.find((l) => l.id === "polaris")!;
    const aim = aimFallback(lesson, 0)!;

    expect(aim.length).toBeGreaterThan(0);
    const date = stepDate(lesson, lesson.steps[0]);
    const az = altAzAt(aim[0], date, observerOf(lesson.place)).azDeg;
    // 북쪽(0°)에서 60° 안
    expect(Math.min(az, 360 - az)).toBeLessThan(60);
  });

  it("표시가 있는 단계는 따로 정하지 않는다 (그 단계의 표시를 본다)", () => {
    for (const lesson of LESSONS) {
      lesson.steps.forEach((step, i) => {
        if (stepVectors(step).length > 0) {
          expect(aimFallback(lesson, i)).toBeUndefined();
        }
      });
    }
  });
});
