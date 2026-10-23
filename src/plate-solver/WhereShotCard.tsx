import type { MapGuides, MapPin } from "@/game/geo/drawMap";
import type { WhereShot } from "@/search/whereShot";
import { useMemo } from "react";
import WorldMap from "@/game/geo/WorldMap";
import { latText, lonText } from "@/search/whereShot";

// 어디서 찍었을까? 아는 만큼만 지도에 긋는다: 위도는 가로선(모르면 띠), 경도는 알 때만 세로선.
// 사진·사람이 준 장소가 아니면 "(추정)"을 붙인다.

const COLOR = "250,204,21"; // 노랑 (별자리선과 같은 계열)
// 낮밤 음영을 끄므로 시각은 쓰이지 않는다
const NO_TIME = new Date(0);

const SOURCE_LABELS = {
  exif: "사진의 위치 정보에서",
  record: "샘플의 촬영 기록",
  manual: "입력한 장소",
  horizon: "지평선으로 잰 하늘의 기울기에서",
  stars: "사진에 담긴 별들에서",
} as const;

// 범위 끝이 극이면 "북극"·"남극"
const edgeText = (latDeg: number) =>
  latDeg >= 89.5 ? "북극" : latDeg <= -89.5 ? "남극" : latText(latDeg);

export const whereSummary = (where: WhereShot) => {
  const lat =
    where.latDeg !== undefined
      ? latText(where.latDeg, where.estimated ? 0 : 1)
      : `${edgeText(where.latRange![0])} ~ ${edgeText(where.latRange![1])}`;
  const lon = where.lonDeg !== null ? ` · ${lonText(where.lonDeg, 1)}` : "";

  return `${where.estimated ? "약 " : ""}${lat}${lon}${where.estimated ? " (추정)" : ""}`;
};

export default function WhereShotCard({
  where,
  recordNote,
  onPickHorizon,
}: {
  where: WhereShot;
  recordNote?: string; // 샘플 기록이면 그 설명 ("촬영 기록 (석촌호수)")
  onPickHorizon: () => void;
}) {
  const { pins, guides, focus } = useMemo(() => {
    const lat = where.latDeg;
    const lon = where.lonDeg;
    const known = lat !== undefined && lon !== null;
    const guides: MapGuides = {
      color: COLOR,
      latLines: lat !== undefined ? [lat] : [],
      latBands: where.latRange ? [where.latRange] : [],
      lonLines: lon !== null ? [lon] : [],
    };
    const pins: MapPin[] = known
      ? [{ latDeg: lat, lonDeg: lon, color: `rgb(${COLOR})` }]
      : [];

    return {
      pins,
      guides,
      focus: known ? { latDeg: lat, lonDeg: lon } : undefined,
    };
  }, [where]);

  return (
    <div className="flex flex-col gap-2">
      <WorldMap
        utc={NO_TIME}
        timeBands={false}
        hoverTime={false}
        shade={false}
        pins={pins}
        guides={guides}
        focus={focus}
      />
      <div>
        <div className="font-bold">
          {where.source === "stars" && "이 하늘이 보이는 위도: "}
          {whereSummary(where)}
        </div>
        <div className="text-xs opacity-60">
          {where.source === "record" && recordNote
            ? recordNote
            : SOURCE_LABELS[where.source]}
        </div>
      </div>
      {where.source === "stars" && (
        <p className="text-xs opacity-70">
          사진 속 별들이 모두 지평선 위에 있으려면 이 위도 사이여야 해요.
          지평선을 찍으면 위도를 하나로 좁혀요.
        </p>
      )}
      {where.lonDeg === null && (
        <p className="text-xs opacity-70">
          경도는 정확한 촬영 시각이 있어야 알 수 있어요. 같은 하늘이 경도마다
          다른 시각에 오거든요.
        </p>
      )}
      {where.source === "stars" && (
        <button className="btn btn-xs self-start" onClick={onPickHorizon}>
          지평선 찍으러 가기
        </button>
      )}
    </div>
  );
}
