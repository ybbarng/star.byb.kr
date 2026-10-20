import { describe, expect, it } from "vitest";
import { STARS } from "@/game/sky/catalog";

// 게임에 보이는 별 이름은 모두 한글이어야 한다 (카탈로그에 새 이름이 생기면 starNames.ts에 더한다).
describe("별 한글 이름", () => {
  it("이름 있는 별은 모두 한글 이름이 있다", () => {
    const missing = STARS.filter(
      (s) => s.latinName && !/[가-힣]/.test(s.name ?? ""),
    ).map((s) => s.latinName);

    expect(missing).toEqual([]);
  });

  it("우리말 이름이 익숙한 별은 그 이름으로", () => {
    const byLatin = (n: string) => STARS.find((s) => s.latinName === n)?.name;

    expect(byLatin("Polaris")).toBe("북극성");
    expect(byLatin("Vega")).toBe("직녀성");
    expect(byLatin("Altair")).toBe("견우성");
    expect(byLatin("Sirius")).toBe("시리우스");
  });
});
