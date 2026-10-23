// 오늘 밤 내 하늘: 장소의 시간대로 시각을 다룬다. 시간대 자료는 브라우저(Intl)에 들어 있는 것을 쓴다.
// 도시 목록은 IANA 이름(Asia/Seoul), 지도에서 고른 곳은 경도로 어림한 고정 시간대(Etc/GMT-9)다.

const MINUTE = 60000;

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatter = (tz: string) => {
  let f = formatters.get(tz);

  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    });
    formatters.set(tz, f);
  }

  return f;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

export interface LocalParts {
  year: number;
  month: number; // 1~12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 일요일
}

export const isValidTimeZone = (tz: string) => {
  try {
    formatter(tz);

    return true;
  } catch {
    return false;
  }
};

// 그 순간(UTC ms)의 장소 시각
export const localParts = (t: number, tz: string): LocalParts => {
  const parts = formatter(tz).formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const num = (type: string) => Number(get(type));

  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour") % 24,
    minute: num("minute"),
    second: num("second"),
    weekday: Math.max(0, WEEKDAYS.indexOf(get("weekday") ?? "Sun")),
  };
};

// 그 순간 장소 시각이 UTC보다 몇 분 앞서는지 (서울 +540)
export const offsetMinutes = (t: number, tz: string) => {
  const p = localParts(t, tz);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );

  return Math.round((asUtc - Math.floor(t / 1000) * 1000) / MINUTE);
};

// 장소 시각(년·월·일·시·분) → UTC ms. 서머타임이 바뀌는 순간 근처도 두 번 맞춰 본다
export const localToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
) => {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let t = guess - offsetMinutes(guess, tz) * MINUTE;
  t = guess - offsetMinutes(t, tz) * MINUTE;

  return t;
};

// 경도로 어림한 고정 시간대 (Etc/GMT는 부호가 반대다: UTC+9 → Etc/GMT-9)
export const zoneFromLongitude = (lonDeg: number) => {
  const h = Math.max(-12, Math.min(14, Math.round(lonDeg / 15)));

  return h === 0 ? "Etc/GMT" : `Etc/GMT${h > 0 ? "-" : "+"}${Math.abs(h)}`;
};

// "UTC+9", "UTC−3:30"
export const offsetLabel = (t: number, tz: string) => {
  const m = offsetMinutes(t, tz);
  const sign = m < 0 ? "−" : "+";
  const a = Math.abs(m);

  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, "0")}` : ""}`;
};

const pad = (n: number) => String(n).padStart(2, "0");

// "21:05"
export const clockLabel = (t: number, tz: string) => {
  const p = localParts(t, tz);

  return `${pad(p.hour)}:${pad(p.minute)}`;
};

// 하루 중 때 이름
const partOfDay = (hour: number) =>
  hour < 6
    ? "새벽"
    : hour < 12
      ? "오전"
      : hour < 18
        ? "오후"
        : hour < 21
          ? "저녁"
          : "밤";

// "저녁 6시 42분", "새벽 3시"
export const friendlyTime = (t: number, tz: string) => {
  const p = localParts(t, tz);
  const h12 = p.hour % 12 || 12;

  return `${partOfDay(p.hour)} ${h12}시${p.minute ? ` ${p.minute}분` : ""}`;
};

// "10월 23일 (목)"
export const dateLabel = (t: number, tz: string) => {
  const p = localParts(t, tz);

  return `${p.month}월 ${p.day}일 (${WEEKDAY_KO[p.weekday]})`;
};

// 날짜가 오늘 밤 기준일과 다르면 "내일 새벽 3시"처럼 앞에 붙인다
export const nightTime = (t: number, tz: string, baseDay: number) => {
  const p = localParts(t, tz);
  const prefix = p.day !== baseDay && p.hour < 12 ? "다음 날 " : "";

  return `${prefix}${friendlyTime(t, tz)}`;
};

// "2026-10-23"
export const isoDate = (t: number, tz: string) => {
  const p = localParts(t, tz);

  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};
