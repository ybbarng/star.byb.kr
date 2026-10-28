import { afterEach, describe, expect, it, vi } from "vitest";
import { currentGame, secondsBucket, track } from "@/ui/track";

// 방문 통계 이벤트: 통계 스크립트가 있으면 그대로 넘기고, 없거나 실패해도 화면을 멈추지 않는다

const g = globalThis as { umami?: unknown; location?: unknown };

afterEach(() => {
  delete g.umami;
  vi.unstubAllGlobals();
});

describe("track", () => {
  it("Umami가 있으면 이름과 값을 그대로 넘긴다", () => {
    const calls: unknown[][] = [];
    g.umami = { track: (...a: unknown[]) => calls.push(a) };

    track("game-start", { game: "sky-guessr" });

    expect(calls).toEqual([["game-start", { game: "sky-guessr" }]]);
  });

  it("Umami가 없거나(개발 서버·차단) 실패해도 던지지 않는다", () => {
    expect(() => track("photo-open", { source: "upload" })).not.toThrow();

    g.umami = {
      track: () => {
        throw new Error("blocked");
      },
    };
    expect(() =>
      track("lesson-finish", { lesson: "spring", first: true }),
    ).not.toThrow();
  });
});

describe("secondsBucket", () => {
  it("풀이 시간을 구간으로만 나눈다", () => {
    expect(
      [0, 1999, 2000, 4999, 5000, 9999, 10_000, 60_000].map(secondsBucket),
    ).toEqual(["0-2", "0-2", "2-5", "2-5", "5-10", "5-10", "10+", "10+"]);
  });
});

describe("currentGame", () => {
  it("게임 주소에서 게임 이름을 뽑는다 (하위 주소도)", () => {
    vi.stubGlobal("location", { pathname: "/games/sky-guessr/" });
    expect(currentGame()).toBe("sky-guessr");

    vi.stubGlobal("location", { pathname: "/games/star-school/lessons" });
    expect(currentGame()).toBe("star-school");
  });

  it("게임 밖이면 주소를 그대로 돌려준다", () => {
    vi.stubGlobal("location", { pathname: "/plate-solver" });
    expect(currentGame()).toBe("/plate-solver");
  });
});
