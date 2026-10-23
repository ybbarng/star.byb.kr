import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GAMES, gameForPath } from "@/game/hub";
import { LESSONS, lessonById, stepBasics } from "@/game/starSchool/lessons";
import { fingersLabel } from "@/game/tonight/report";
import { fistsLabel } from "@/learn/basics/skyMath";
import { BASICS_TOPICS, basicsTopic } from "@/learn/basics/topics";

// 세 갈래(찾는 원리·하늘 읽기 기초·별 놀이터)를 잇는 링크가 실제 있는 곳을 가리키는지,
// 놀이터 → 기초로 건너간 사람이 기초 페이지의 "이 개념을 쓰는 곳"에서 그 게임을 다시 만나는지 확인한다

// 앱 주소 → 그 주소를 그리는 page.tsx가 있는지 (정적 내보내기라 page.tsx가 곧 주소다)
const pageExists = (href: string) => {
  const path = href.split("#")[0].replace(/\/+$/, "");

  return existsSync(`src/app${path}/page.tsx`);
};

describe("놀이터 → 하늘 읽기 기초", () => {
  it("게임이 가리키는 기초 페이지는 목차에 있다", () => {
    for (const g of GAMES) {
      for (const slug of g.basics ?? []) {
        expect(basicsTopic(slug), `${g.href}: ${slug}`).toBeDefined();
      }
    }
  });

  it("하늘 계산을 쓰는 게임은 모두 기초 페이지를 하나 이상 가리킨다", () => {
    // 플레이트 솔버 자체를 다루는 게임(모양 지문·사람 대 컴퓨터·점 찍기)은 찾는 원리 쪽이라 뺀다
    const solverGames = [
      "/games/draw-constellation",
      "/games/human-vs-computer",
      "/games/quad-fingerprint",
    ];

    for (const g of GAMES) {
      if (!solverGames.includes(g.href)) {
        expect(g.basics?.length ?? 0, g.href).toBeGreaterThan(0);
      }
    }
  });

  it("기초 페이지의 '이 개념을 쓰는 곳'에도 그 게임이 있다", () => {
    for (const g of GAMES) {
      for (const slug of g.basics ?? []) {
        const back = basicsTopic(slug)!.links.some(
          (l) => gameForPath(l.href)?.href === g.href,
        );
        expect(back, `${slug} → ${g.href}`).toBe(true);
      }
    }
  });
});

describe("하늘 읽기 기초 → 이 개념을 쓰는 곳", () => {
  it("링크마다 그 주소의 페이지가 있다", () => {
    for (const t of BASICS_TOPICS) {
      for (const l of t.links) {
        expect(pageExists(l.href), `${t.slug}: ${l.href}`).toBe(true);
      }
    }
  });
});

describe("별자리 익히기 수업 → 하늘 읽기 기초", () => {
  it("수업마다 가리키는 기초 페이지가 목차에 있다", () => {
    for (const l of LESSONS) {
      expect(l.basics.length, l.id).toBeGreaterThan(0);

      for (const slug of [...l.basics, ...l.steps.flatMap(stepBasics)]) {
        expect(basicsTopic(slug), `${l.id}: ${slug}`).toBeDefined();
      }
    }
  });

  it("별 징검다리 단계는 별 건너뛰기, 은하수·황도 수업은 그 기초 페이지로 간다", () => {
    const steps = LESSONS.flatMap((l) => l.steps);
    const hops = steps.filter((s) => s.marks.some((m) => m.kind === "hop"));

    expect(hops.length).toBeGreaterThan(0);

    for (const s of hops) {
      expect(stepBasics(s)).toContain("star-hopping");
    }

    const lessonSlugs = (id: string) =>
      lessonById(id)!.steps.flatMap(stepBasics);

    expect(lessonSlugs("milky-way")).toContain("milky-way");
    expect(lessonSlugs("ecliptic")).toContain("earth-tilt");
  });

  it("기초 페이지의 '이 개념을 쓰는 곳'에 수업 목록이 있다", () => {
    for (const l of LESSONS) {
      for (const slug of l.basics) {
        const back = basicsTopic(slug)!.links.some(
          (x) => x.href === "/games/star-school/lessons",
        );
        expect(back, `${l.id} → ${slug}`).toBe(true);
      }
    }
  });
});

describe("같은 개념은 같은 값으로", () => {
  it("놀이터의 손 각도는 하늘 읽기 기초와 같다 (새끼손가락 1°, 손가락 세 개 5°, 주먹 10°)", () => {
    expect(fingersLabel(1.5)).toBe("새끼손가락 2개 너비");
    expect(fistsLabel(1.5)).toBe("새끼손가락 2개 폭쯤");
    expect(fingersLabel(5)).toBe("손가락 세 개 너비");
    expect(fistsLabel(5)).toBe("손가락 세 개 폭쯤");
    expect(fingersLabel(10)).toBe("주먹 하나 너비");
    expect(fistsLabel(10)).toBe("주먹 1개쯤");
  });
});

describe("주소 → 게임", () => {
  it("하위 주소와 끝의 /도 같은 게임으로 본다", () => {
    expect(gameForPath("/games/star-school/lessons")?.title).toBe(
      "별자리 익히기",
    );
    expect(gameForPath("/games/sky-match/")?.href).toBe("/games/sky-match");
    expect(gameForPath("/games")).toBeUndefined();
    // 이름이 앞부분만 같은 다른 주소는 아니다
    expect(gameForPath("/games/star-schoolx")).toBeUndefined();
  });
});
