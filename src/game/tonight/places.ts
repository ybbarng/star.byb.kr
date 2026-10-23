import { zoneFromLongitude } from "@/game/tonight/time";

// 오늘 밤 내 하늘: 고를 수 있는 장소. 시간대는 IANA 이름 (서머타임까지 브라우저가 맞춰 준다)

export interface Place {
  name: string;
  latDeg: number;
  lonDeg: number; // 동경 +
  tz: string;
}

export const SEOUL: Place = {
  name: "서울",
  latDeg: 37.57,
  lonDeg: 126.98,
  tz: "Asia/Seoul",
};

export const CITY_GROUPS: { title: string; cities: Place[] }[] = [
  {
    title: "우리나라",
    cities: [
      SEOUL,
      { name: "인천", latDeg: 37.46, lonDeg: 126.71, tz: "Asia/Seoul" },
      { name: "춘천", latDeg: 37.88, lonDeg: 127.73, tz: "Asia/Seoul" },
      { name: "강릉", latDeg: 37.75, lonDeg: 128.88, tz: "Asia/Seoul" },
      { name: "대전", latDeg: 36.35, lonDeg: 127.38, tz: "Asia/Seoul" },
      { name: "대구", latDeg: 35.87, lonDeg: 128.6, tz: "Asia/Seoul" },
      { name: "광주", latDeg: 35.16, lonDeg: 126.85, tz: "Asia/Seoul" },
      { name: "부산", latDeg: 35.18, lonDeg: 129.08, tz: "Asia/Seoul" },
      { name: "제주", latDeg: 33.5, lonDeg: 126.53, tz: "Asia/Seoul" },
      {
        name: "영양 (반딧불이 밤하늘)",
        latDeg: 36.67,
        lonDeg: 129.12,
        tz: "Asia/Seoul",
      },
    ],
  },
  {
    title: "아시아",
    cities: [
      { name: "도쿄", latDeg: 35.68, lonDeg: 139.69, tz: "Asia/Tokyo" },
      { name: "베이징", latDeg: 39.9, lonDeg: 116.4, tz: "Asia/Shanghai" },
      { name: "타이베이", latDeg: 25.03, lonDeg: 121.57, tz: "Asia/Taipei" },
      { name: "방콕", latDeg: 13.76, lonDeg: 100.5, tz: "Asia/Bangkok" },
      { name: "싱가포르", latDeg: 1.35, lonDeg: 103.82, tz: "Asia/Singapore" },
      { name: "사이판", latDeg: 15.18, lonDeg: 145.75, tz: "Pacific/Saipan" },
      { name: "델리", latDeg: 28.61, lonDeg: 77.21, tz: "Asia/Kolkata" },
      {
        name: "울란바토르",
        latDeg: 47.89,
        lonDeg: 106.91,
        tz: "Asia/Ulaanbaatar",
      },
      { name: "두바이", latDeg: 25.2, lonDeg: 55.27, tz: "Asia/Dubai" },
    ],
  },
  {
    title: "유럽·아프리카",
    cities: [
      { name: "런던", latDeg: 51.51, lonDeg: -0.13, tz: "Europe/London" },
      { name: "파리", latDeg: 48.86, lonDeg: 2.35, tz: "Europe/Paris" },
      { name: "로마", latDeg: 41.9, lonDeg: 12.5, tz: "Europe/Rome" },
      {
        name: "레이캬비크",
        latDeg: 64.15,
        lonDeg: -21.94,
        tz: "Atlantic/Reykjavik",
      },
      {
        name: "트롬쇠 (오로라)",
        latDeg: 69.65,
        lonDeg: 18.96,
        tz: "Europe/Oslo",
      },
      { name: "카이로", latDeg: 30.04, lonDeg: 31.24, tz: "Africa/Cairo" },
      { name: "나이로비", latDeg: -1.29, lonDeg: 36.82, tz: "Africa/Nairobi" },
      {
        name: "케이프타운",
        latDeg: -33.92,
        lonDeg: 18.42,
        tz: "Africa/Johannesburg",
      },
    ],
  },
  {
    title: "아메리카",
    cities: [
      { name: "뉴욕", latDeg: 40.71, lonDeg: -74.01, tz: "America/New_York" },
      {
        name: "로스앤젤레스",
        latDeg: 34.05,
        lonDeg: -118.24,
        tz: "America/Los_Angeles",
      },
      {
        name: "밴쿠버",
        latDeg: 49.28,
        lonDeg: -123.12,
        tz: "America/Vancouver",
      },
      {
        name: "하와이 마우나케아",
        latDeg: 19.82,
        lonDeg: -155.47,
        tz: "Pacific/Honolulu",
      },
      {
        name: "멕시코시티",
        latDeg: 19.43,
        lonDeg: -99.13,
        tz: "America/Mexico_City",
      },
      {
        name: "아타카마 사막",
        latDeg: -23.02,
        lonDeg: -67.75,
        tz: "America/Santiago",
      },
      {
        name: "부에노스아이레스",
        latDeg: -34.6,
        lonDeg: -58.38,
        tz: "America/Argentina/Buenos_Aires",
      },
    ],
  },
  {
    title: "오세아니아",
    cities: [
      {
        name: "시드니",
        latDeg: -33.87,
        lonDeg: 151.21,
        tz: "Australia/Sydney",
      },
      {
        name: "울루루",
        latDeg: -25.34,
        lonDeg: 131.04,
        tz: "Australia/Darwin",
      },
      {
        name: "오클랜드",
        latDeg: -36.85,
        lonDeg: 174.76,
        tz: "Pacific/Auckland",
      },
      {
        name: "테카포 호수",
        latDeg: -44.0,
        lonDeg: 170.48,
        tz: "Pacific/Auckland",
      },
    ],
  },
];

export const CITIES = CITY_GROUPS.flatMap((g) => g.cities);

const D = Math.PI / 180;

// 두 곳 사이 거리 (km, 큰원)
export const distanceKm = (
  a: { latDeg: number; lonDeg: number },
  b: { latDeg: number; lonDeg: number },
) => {
  const c =
    Math.sin(a.latDeg * D) * Math.sin(b.latDeg * D) +
    Math.cos(a.latDeg * D) *
      Math.cos(b.latDeg * D) *
      Math.cos((a.lonDeg - b.lonDeg) * D);

  return 6371 * Math.acos(Math.max(-1, Math.min(1, c)));
};

// 지도에서 고른 곳: 가까운 도시(1,000km 안)의 시간대를 빌리고, 없으면 경도로 어림한다
// (한국은 경도로 어림하면 UTC+8이 되지만 실제로는 +9라서, 가까운 도시를 먼저 본다)
export const placeAt = (latDeg: number, lonDeg: number): Place => {
  const here = { latDeg, lonDeg };
  const nearest = CITIES.map((c) => ({ c, d: distanceKm(c, here) })).sort(
    (a, b) => a.d - b.d,
  )[0];
  const name = `${Math.abs(latDeg).toFixed(1)}°${latDeg >= 0 ? "N" : "S"} ${Math.abs(lonDeg).toFixed(1)}°${lonDeg >= 0 ? "E" : "W"}`;

  return {
    name: nearest.d < 60 ? `${nearest.c.name} 근처` : name,
    latDeg,
    lonDeg,
    tz: nearest.d < 1000 ? nearest.c.tz : zoneFromLongitude(lonDeg),
  };
};
