import { gameForPath } from "@/game/hub";

// 방문 통계 이벤트 (Umami, ui/Analytics). 이름과 값은 여기서만 정한다 — 통계 화면(stats.byb.kr)에서 이 이름으로 찾는다.
// 사진·올린 파일 이름·위치·입력값은 보내지 않는다. 시간은 구간으로만 보낸다.
// 페이지별 방문 수는 Umami가 스스로 세므로 여기에는 행동만 둔다.
export interface TrackEvents {
  // 사진으로 찾기: 사진을 열었다. sample은 샘플 파일 이름 (공개된 샘플이라 보내도 된다)
  "photo-open": { source: "sample" | "upload"; sample?: string };
  // 사진 풀이 한 번의 결과: 찾음(확신) / 후보만 / 못 찾음 / 오류
  "photo-solve": {
    source: "sample" | "upload";
    result: "found" | "candidates" | "none" | "error";
    seconds?: SecondsBucket;
  };
  // 게임: 시작 화면에서 시작을 눌렀다 / 끝까지 해서 기록이 나왔다 (record는 최고 기록 칸 이름, 난이도가 들어 있다)
  "game-start": { game: string };
  "game-finish": { game: string; record: string };
  // 별자리 익히기 수업을 마쳤다 (first: 처음 마쳤나)
  "lesson-finish": { lesson: string; first: boolean };
}

export type SecondsBucket = "0-2" | "2-5" | "5-10" | "10+";

export const secondsBucket = (ms: number): SecondsBucket =>
  ms < 2000 ? "0-2" : ms < 5000 ? "2-5" : ms < 10_000 ? "5-10" : "10+";

interface Umami {
  track: (name: string, data?: object) => void;
}

// 통계 스크립트가 없거나(개발 서버·차단) 실패해도 화면은 그대로 둔다
export const track = <K extends keyof TrackEvents>(
  name: K,
  data: TrackEvents[K],
) => {
  try {
    (globalThis as { umami?: Umami }).umami?.track(name, data);
  } catch {
    // 통계는 못 남겨도 된다
  }
};

// 지금 주소의 게임 (/games/sky-guessr → sky-guessr). 게임 밖이면 주소 그대로
export const currentGame = () => {
  const path = globalThis.location?.pathname ?? "";

  return gameForPath(path)?.href.replace("/games/", "") ?? path;
};
