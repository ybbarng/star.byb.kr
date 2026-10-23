import { describe, expect, it } from "vitest";
import { exactShotUtc, shotFromFileName } from "@/plate-solver/shotTime";

// 시간대는 이름에 없으니 이 브라우저의 시간대로 둔다. 테스트는 브라우저와 상관없게 정해 넣는다.
const seoulOffset = () => "+09:00";
const read = (name: string) => shotFromFileName(name, seoulOffset);

describe("휴대폰·메신저가 붙이는 이름에서 촬영 시각을 읽는다", () => {
  it.each([
    ["20240401_232411.jpg", "2024-04-01T23:24"], // 삼성 기본 카메라
    ["IMG_20240401_232411.jpg", "2024-04-01T23:24"], // 여러 안드로이드
    ["IMG_20240401_232411_1.jpg", "2024-04-01T23:24"], // 연속 촬영
    ["KakaoTalk_20240401_232411123.jpg", "2024-04-01T23:24"], // 카카오톡 (밀리초)
    ["Screenshot_20240401-232411.png", "2024-04-01T23:24"],
    ["Screenshot_20240401-232411_Gallery.jpg", "2024-04-01T23:24"],
    ["Screenshot_2024-04-01-23-24-11-123_com.android.png", "2024-04-01T23:24"],
    ["Photo 2024-04-01 23.24.11.jpg", "2024-04-01T23:24"],
    ["VID_20231231_235959.mp4.jpg", "2023-12-31T23:59"],
  ])("%s → %s (시간대는 추정)", (name, local) => {
    expect(read(name)).toEqual({
      local,
      offset: "+09:00",
      source: "fileName",
      note: "파일 이름에서 (시간대는 추정)",
      offsetGuessed: true,
    });
  });

  it("Pixel(PXL_)은 이름에 UTC를 쓴다: 시간대를 알므로 경도 계산에도 쓴다", () => {
    const shot = read("PXL_20240402_052411123.jpg")!;

    expect(shot).toEqual({
      local: "2024-04-02T05:24",
      offset: "+00:00",
      source: "fileName",
      note: "파일 이름에서 (UTC)",
    });
    expect(exactShotUtc(shot)?.toISOString()).toBe("2024-04-02T05:24:00.000Z");
  });

  it("시간대를 추정한 이름은 경도 계산에 쓰지 않는다", () => {
    expect(exactShotUtc(read("20240401_232411.jpg"))).toBeNull();
  });

  it("시간대 기본값은 그 날짜의 브라우저 시간대다", () => {
    const shot = shotFromFileName("20240401_232411.jpg")!;

    expect(shot.offset).toMatch(/^[+-]\d{2}:\d{2}$/);
  });
});

describe("시각이 없거나 있을 수 없는 이름은 읽지 않는다", () => {
  it.each([
    ["DSC_0123.JPG"], // 카메라 번호
    ["IMG_4521.HEIC.jpg"],
    ["IMG-20240401-WA0001.jpg"], // WhatsApp: 날짜만 있고 시각이 없다
    ["milkyway.jpg"],
    ["1712035455123.jpg"], // 밀리초 타임스탬프
    ["20240401.jpg"], // 날짜만
    ["320240401_232411.jpg"], // 앞에 숫자가 더 붙어 날짜가 아니다
    [""],
  ])("%s", (name) => {
    expect(read(name)).toBeNull();
  });

  it.each([
    ["20240230_232411.jpg"], // 2월 30일
    ["20230229_120000.jpg"], // 윤년이 아닌 해의 2월 29일
    ["20241301_120000.jpg"], // 13월
    ["20240401_246000.jpg"], // 24시
    ["20240401_236011.jpg"], // 60분
    ["20240401_232461.jpg"], // 61초
    ["18990401_232411.jpg"], // 사진이 없던 해
  ])("있을 수 없는 날짜·시각: %s", (name) => {
    expect(read(name)).toBeNull();
  });

  it("윤년의 2월 29일은 읽는다", () => {
    expect(read("20240229_120000.jpg")?.local).toBe("2024-02-29T12:00");
  });

  it("이름이 없으면 (샘플) 읽지 않는다", () => {
    expect(shotFromFileName(undefined)).toBeNull();
  });
});
