import type { MapGuides, MapPin } from "@/game/geo/drawMap";
import type { WhereShot } from "@/search/whereShot";
import { useMemo } from "react";
import WorldMap from "@/game/geo/WorldMap";
import { BasicsTerm } from "@/learn/basics/BasicsLinks";
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
  starsTime: "사진 속 별들과 시간대까지 아는 촬영 시각에서",
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
  const lonRange = where.region?.lonRange;
  const lon =
    where.lonDeg !== null
      ? ` · ${lonText(where.lonDeg, where.estimated ? 0 : 1)}`
      : where.region
        ? lonRange
          ? ` · ${lonText(lonRange[0])} ~ ${lonText(lonRange[1])}`
          : " · 경도 전체"
        : "";

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
      // 영역이 있으면 위도 띠 대신 그 칸들만 칠한다
      latBands: where.latRange && !where.region ? [where.latRange] : [],
      lonLines: lon !== null ? [lon] : [],
      ...(where.region && {
        cells: { stepDeg: where.region.stepDeg, centers: where.region.cells },
      }),
    };
    const pins: MapPin[] = known
      ? [{ latDeg: lat, lonDeg: lon, color: `rgb(${COLOR})` }]
      : [];

    return {
      pins,
      guides,
      focus: known ? { latDeg: lat, lonDeg: lon } : where.region?.center,
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
          {where.source === "starsTime" &&
            "이 순간 이 별들이 모두 떠 있던 곳: "}
          {whereSummary(where)}
        </div>
        <div className="text-xs opacity-60">
          {where.source === "record" && recordNote
            ? recordNote
            : where.lonFromTime
              ? "지평선과 촬영 시각으로"
              : SOURCE_LABELS[where.source]}
        </div>
      </div>
      {(where.source === "stars" || where.source === "starsTime") && (
        <button className="btn btn-xs self-start" onClick={onPickHorizon}>
          지평선 찍으러 가기
        </button>
      )}
      <div className="bg-base-300/40 rounded-box flex flex-col gap-1 p-2 text-xs">
        <div className="font-bold opacity-80">📘 이건 어떻게 알아요?</div>
        <HowWeKnow where={where} />
        <p className="opacity-70">
          자세한 내용은{" "}
          <BasicsTerm slug="earth-coords">지구 위의 좌표</BasicsTerm>에서
          확인하세요.
        </p>
      </div>
    </div>
  );
}

// 위도·경도를 어떻게 알았는지 (모르면 왜 모르는지)
function HowWeKnow({ where }: { where: WhereShot }) {
  const lines: { title: string; text: string }[] = [];

  if (where.source === "exif") {
    lines.push({
      title: "위도·경도",
      text: "사진 파일에 휴대폰·카메라가 남긴 GPS 위치를 그대로 썼어요. 하늘에서 구한 값이 아니라 가장 정확해요.",
    });
  } else if (where.source === "record" || where.source === "manual") {
    lines.push({
      title: "위도·경도",
      text: `${where.source === "record" ? "샘플을 찍을 때 남긴 기록" : "입력한 장소"}을 그대로 썼어요. 사진만으로 구하려면 지평선을 찍어 보세요. 하늘의 기울기에서 위도를 잴 수 있어요.`,
    });
  } else if (where.source === "horizon") {
    lines.push({
      title: "위도",
      text: "지평선 두 점으로 머리 바로 위(천정)가 하늘의 어디인지 구했어요. 천정의 적위가 곧 그곳의 위도예요. 북극성이 지평선에서 뜬 높이가 위도와 같은 것과 같은 원리예요.",
    });
    lines.push(
      where.lonFromTime
        ? {
            title: "경도",
            text: "하늘은 하루에 한 바퀴 도니, 천정에 어느 별자리가 오는지는 시각과 경도에 따라 달라요. 촬영 순간 천정의 적경(지방 항성시)과 같은 순간 그리니치 천정의 적경(그리니치 항성시)의 차이가 경도예요. 촬영 시각이 4분 틀리면 경도가 1° 틀려요.",
          }
        : {
            title: "경도",
            text: "아직 몰라요. 같은 하늘이 경도마다 다른 시각에 와서, 시간대까지 아는 촬영 시각이 있어야 경도를 구할 수 있어요.",
          },
    );
  } else if (where.source === "starsTime") {
    lines.push({
      title: "위도·경도",
      text: "촬영 순간을 아니, 지구의 곳곳에서 그 순간 하늘이 어땠는지 계산할 수 있어요. 사진 속 별들이 모두 지평선 위에 있고 해가 충분히 진(지평선 아래 12°) 곳만 칠했어요. 지평선을 찍으면 한 곳으로 좁혀요.",
    });
  } else {
    lines.push({
      title: "위도",
      text: "북쪽 하늘의 별은 남쪽으로 갈수록, 남쪽 하늘의 별은 북쪽으로 갈수록 지평선 아래로 내려가요. 사진 속 별들이 모두 지평선 위에 있으려면 이 위도 사이여야 해요. 지평선을 찍으면 하나로 좁혀요.",
    });
    lines.push({
      title: "경도",
      text: "아직 몰라요. 같은 하늘이 경도마다 다른 시각에 와서, 시간대까지 아는 촬영 시각이 있어야 경도를 구할 수 있어요.",
    });
  }

  return (
    <>
      {lines.map((l) => (
        <p key={l.title} className="opacity-70">
          <span className="font-bold">{l.title}</span> · {l.text}
        </p>
      ))}
    </>
  );
}
