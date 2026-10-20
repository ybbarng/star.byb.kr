import type { GuessrScene } from "@/game/starGuessr/scene";
import { localMeanTime } from "@/game/starGuessr/scene";
import { julianDay, localSiderealDeg } from "@/search/utils/ephemeris";

// 별하늘 지오게서 채점. 만점 5000 = 위도 2000 + 하늘 시각 2000 + 날짜 1000.
//
// "하늘 시각"은 지방 항성시다. 같은 하늘은 하루 4분·한 달 2시간씩 일찍 오므로, 사진만으로는 날짜와 시각을
// 따로 알 수 없고 그 조합(항성시)만 알 수 있다 (발표 "이과생의 별 헤는 밤"). 그래서 날짜가 틀려도 같은 하늘을
// 맞혔으면 하늘 점수를 다 받는다. 날짜 점수는 달·계절 단서로 더 좁힌 사람에게 주는 덤이다.

export interface GuessrAnswer {
  latDeg: number;
  month: number; // 1~12
  day: number; // 1~31
  hour: number; // 현지 시각
  minute: number;
}

export interface GuessrScore {
  latErrorDeg: number;
  skyErrorHours: number; // 항성시 차이 (0~12)
  dateErrorDays: number; // 1년을 돌아 가까운 쪽 (0~183)
  points: { lat: number; sky: number; date: number; total: number };
}

const POINTS = { lat: 2000, sky: 2000, date: 1000 };
// 이만큼 틀리면 점수가 1/e (GeoGuessr처럼 오차가 클수록 빠르게 준다)
const SCALE = { latDeg: 8, skyHours: 1, dateDays: 20 };

// 답(현지 시각)을 그 해의 UTC 순간으로
export const answerDate = (scene: GuessrScene, a: GuessrAnswer): Date => {
  const year = localMeanTime(
    scene.date,
    scene.observer.lonDeg,
  ).getUTCFullYear();
  const local = Date.UTC(year, a.month - 1, a.day, a.hour, a.minute);

  return new Date(local - (scene.observer.lonDeg / 15) * 3600000);
};

const dayOfYear = (d: Date) =>
  (d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000;

export const scoreGuess = (
  scene: GuessrScene,
  answer: GuessrAnswer,
): GuessrScore => {
  const guess = answerDate(scene, answer);
  const lon = scene.observer.lonDeg;
  const lstTruth = localSiderealDeg(julianDay(scene.date), scene.observer);
  const lstGuess = localSiderealDeg(julianDay(guess), {
    latDeg: answer.latDeg,
    lonDeg: lon,
  });
  const dLst = Math.abs(((((lstGuess - lstTruth) % 360) + 540) % 360) - 180);
  const dDay = Math.abs(
    dayOfYear(localMeanTime(guess, lon)) -
      dayOfYear(localMeanTime(scene.date, lon)),
  );

  const latErrorDeg = Math.abs(answer.latDeg - scene.observer.latDeg);
  const skyErrorHours = dLst / 15;
  const dateErrorDays = Math.min(dDay, 365.25 - dDay);
  const lat = Math.round(POINTS.lat * Math.exp(-latErrorDeg / SCALE.latDeg));
  const sky = Math.round(
    POINTS.sky * Math.exp(-skyErrorHours / SCALE.skyHours),
  );
  const date = Math.round(
    POINTS.date * Math.exp(-dateErrorDays / SCALE.dateDays),
  );

  return {
    latErrorDeg,
    skyErrorHours,
    dateErrorDays,
    points: { lat, sky, date, total: lat + sky + date },
  };
};
