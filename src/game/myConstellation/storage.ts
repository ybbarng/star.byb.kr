import {
  cleanName,
  decodeStrokes,
  encodeStrokes,
} from "@/game/myConstellation/shape";

// 나만의 별자리 보관함: 이 브라우저(localStorage)에만 남긴다. 어디에도 보내지 않는다.
// 저장이 막힌 브라우저(사생활 보호 창 등)에서도 화면은 그대로 쓸 수 있게 모두 try/catch로 감싼다.

export const STORAGE_KEY = "star-games-my-constellation";
export const MAX_SAVED = 12;

export interface SavedConstellation {
  name: string;
  lines: string; // encodeStrokes 모양
  savedAt: number;
}

const isSaved = (v: unknown): v is SavedConstellation =>
  !!v &&
  typeof (v as SavedConstellation).name === "string" &&
  typeof (v as SavedConstellation).lines === "string" &&
  typeof (v as SavedConstellation).savedAt === "number";

export const readSaved = (): SavedConstellation[] => {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");

    return Array.isArray(v)
      ? v
          .filter(isSaved)
          .filter((s) => decodeStrokes(s.lines).strokes.length > 0)
      : [];
  } catch {
    return [];
  }
};

const write = (list: SavedConstellation[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    return true;
  } catch {
    return false;
  }
};

// 같은 선 모양이면 이름만 바꿔 맨 앞으로, 아니면 새로 맨 앞에. 오래된 것부터 밀려난다
export const upsertSaved = (
  list: SavedConstellation[],
  name: string,
  lines: string,
  now: number,
): SavedConstellation[] =>
  [
    { name: cleanName(name) || "이름 없는 별자리", lines, savedAt: now },
    ...list.filter((s) => s.lines !== lines),
  ].slice(0, MAX_SAVED);

export const saveConstellation = (
  name: string,
  strokes: string[][],
): SavedConstellation[] | null => {
  const lines = encodeStrokes({ strokes });

  if (!lines) {
    return null;
  }

  const next = upsertSaved(readSaved(), name, lines, Date.now());

  return write(next) ? next : null;
};

export const removeSaved = (lines: string): SavedConstellation[] => {
  const next = readSaved().filter((s) => s.lines !== lines);
  write(next);

  return next;
};
