import type { Observer } from "@/search/utils/ephemeris";
import type { PhotoExif } from "@/services/exif";

// 촬영 시각(과 알면 장소). 해·달·행성은 이것이 있어야 사진 위 위치가 정해진다.
export interface ShotTime {
  local: string; // 현지 시각 "2022-03-27T04:30"
  offset: string; // 시간대 "+09:00"
  observer?: Observer;
  source: "exif" | "record" | "manual";
  note?: string;
  // 시간대를 몰라 이 브라우저의 시간대로 둔 시각 (현지 시각은 맞아도 UTC 순간은 몇 시간 틀릴 수 있다)
  offsetGuessed?: boolean;
}

// "언제 찍었을까?"에서 고른 시각의 설명. 이 장소는 하늘에서 추정한 값이다.
export const ESTIMATED_SHOT_NOTE = "사진에서 추정";

export const shotDate = (s: ShotTime) => new Date(`${s.local}${s.offset}`);

// 시간대까지 믿을 수 있는 촬영 순간(UTC). 경도처럼 순간이 정확해야 하는 계산에만 쓴다.
// 시간대를 추정한 시각, 하늘에서 거꾸로 찾은 시각(장소를 추정해 넣었다)은 null.
export const exactShotUtc = (s: ShotTime | null): Date | null => {
  if (!s || s.offsetGuessed || s.note === ESTIMATED_SHOT_NOTE) {
    return null;
  }

  const date = shotDate(s);

  return Number.isNaN(date.getTime()) ? null : date;
};

// 이 브라우저의 시간대 ("+09:00")
export const browserOffset = (at = new Date()) => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);

  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
};

// 촬영 기록을 아는 샘플. 키는 샘플 파일명.
const SAMPLE_SHOTS: Record<string, ShotTime> = {
  // 출처 https://naver.me/5xgcLXzT — 서울 송파구 석촌호수
  "20220328-brice-Milky Way over Buzzvil.jpg": {
    local: "2022-03-27T04:30",
    offset: "+09:00",
    observer: { latDeg: 37.509, lonDeg: 127.1 },
    source: "record",
    note: "촬영 기록 (석촌호수)",
  },
  // 2022 발표 "이과생의 별 헤는 밤": 본인 답 "10월 3일 오전 4~5시". 장소는 모르지만 서울 근처 산
  "20220607-berry-seoul.jpg": {
    local: "2021-10-03T04:30",
    offset: "+09:00",
    observer: { latDeg: 37.5, lonDeg: 127 },
    source: "record",
    note: "본인 기억 (10월 3일 4~5시, 서울 근처)",
  },
  // 2019 사이판 워크숍. 슬랙에 올라온 시각 22:36 (사이판). 발표 자료의 슬랙 캡처는 한국에서 찍어
  // 한국 시각 21:36으로 보였다 (2026-10-22 사용자 확인). 실제 촬영은 이보다 앞이라 시각·장소 풀이가
  // 앞 3시간~뒤 1시간 30분을 함께 찾는다 (journey 25장).
  "20190617-jarrod-saipan.jpg": {
    local: "2019-06-17T22:36",
    offset: "+10:00",
    observer: { latDeg: 15.18, lonDeg: 145.75 },
    source: "record",
    note: "슬랙에 올린 시각 (사이판)",
  },
};

export const getSampleShot = (src?: string): ShotTime | null => {
  if (!src) {
    return null;
  }

  return SAMPLE_SHOTS[decodeURIComponent(src.split("/").pop() ?? "")] ?? null;
};

export const shotFromExif = (exif: PhotoExif | null): ShotTime | null => {
  if (!exif?.localDateTime) {
    return null;
  }

  const local = exif.localDateTime.slice(0, 16);

  return {
    local,
    // 시간대가 없으면 이 브라우저의 시간대로 본다 (카메라 시계는 보통 현지 시각)
    offset: exif.offset ?? browserOffset(new Date(local)),
    observer:
      exif.latDeg !== null && exif.lonDeg !== null
        ? { latDeg: exif.latDeg, lonDeg: exif.lonDeg }
        : undefined,
    source: "exif",
    note: exif.offset ? "사진 정보(EXIF)" : "사진 정보(EXIF), 시간대는 추정",
    ...(!exif.offset && { offsetGuessed: true }),
  };
};
