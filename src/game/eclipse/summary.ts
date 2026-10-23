import type { Syzygy } from "@/game/eclipse/eclipse";
import type { EclipseRecord } from "@/game/eclipse/eclipseList";
import {
  dayOfIso,
  findSyzygies,
  moonAltFromSeoul,
  regionOfLon,
  subLunarLonDeg,
} from "@/game/eclipse/eclipse";
import { ECLIPSES, eclipsesOf } from "@/game/eclipse/eclipseList";

// 결과 화면에 보여 줄 식 하나하나의 풀이: 목록(정답)과 우리 계산(그때 달의 황위, 월식이 보이는 쪽)을 붙인다.

export interface EclipseDetail {
  record: EclipseRecord;
  syzygy: Syzygy | null;
  where: string | null; // 개기·금환이 지나는 곳(목록) 또는 월식이 보이는 쪽(계산)
  korea: string | null;
}

// 그 식에 해당하는 삭(일식)·망(월식): 세계시 날짜 앞뒤 하루 안
export const syzygyOf = (
  record: EclipseRecord,
  syzygies: Syzygy[],
): Syzygy | null => {
  const want = record.kind === "solar" ? "new" : "full";
  const day = dayOfIso(record.date);

  return (
    syzygies.find((s) => s.kind === want && Math.abs(s.day - day) <= 1) ?? null
  );
};

// 월식이 한국에서 보이나: 그 순간(식 한가운데 무렵) 서울에서 달 높이로 어림한다
export const lunarKoreaText = (jd: number) => {
  const alt = moonAltFromSeoul(jd);

  return alt > 3
    ? "한국에서 보여요"
    : alt > -3
      ? "한국에서는 달이 지평선 근처"
      : "한국은 낮이라 안 보여요";
};

export const detailOf = (
  record: EclipseRecord,
  syzygies: Syzygy[],
): EclipseDetail => {
  const syzygy = syzygyOf(record, syzygies);

  if (record.kind === "solar") {
    return {
      record,
      syzygy,
      where: record.region ?? null,
      korea: record.korea ? "한국에서 부분일식" : null,
    };
  }

  return {
    record,
    syzygy,
    where: syzygy
      ? `${regionOfLon(subLunarLonDeg(syzygy.jd))} 쪽 밤하늘`
      : null,
    korea: syzygy ? lunarKoreaText(syzygy.jd) : null,
  };
};

export const yearDetails = (year: number, syzygies: Syzygy[]) =>
  eclipsesOf(year).map((e) => detailOf(e, syzygies));

// 오늘(세계시 날짜) 뒤로 한국에서 보이는 식: 일식은 목록에 한국 표시가 있는 것, 월식은 계산으로 달이 떠 있는 것
export const nextInKorea = (todayIso: string, count = 5): EclipseDetail[] => {
  const cache = new Map<number, Syzygy[]>();

  const syzygiesOf = (year: number) => {
    if (!cache.has(year)) {
      cache.set(year, findSyzygies(year));
    }

    return cache.get(year)!;
  };

  const out: EclipseDetail[] = [];

  for (const e of [...ECLIPSES].sort((a, b) => a.date.localeCompare(b.date))) {
    if (e.date <= todayIso || out.length >= count) {
      continue;
    }

    const d = detailOf(e, syzygiesOf(Number(e.date.slice(0, 4))));

    if (
      (e.kind === "solar" && e.korea) ||
      (e.kind === "lunar" && d.korea === "한국에서 보여요")
    ) {
      out.push(d);
    }
  }

  return out;
};
