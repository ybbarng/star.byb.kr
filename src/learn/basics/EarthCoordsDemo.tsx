"use client";

import type { MapGuides, MapPin } from "@/game/geo/drawMap";
import { useMemo, useState } from "react";
import WorldMap from "@/game/geo/WorldMap";
import {
  clockLabel,
  KM_PER_DEG_LAT,
  kmPerDegLon,
  meanSolarNoonMinutes,
  SEOUL,
} from "@/learn/basics/skyMath";

// 지도를 누르면 그곳의 위도·경도와, 그것이 뜻하는 거리·시각을 보여 준다
const GUIDES: MapGuides = {
  latLines: [0, 23.44, -23.44, 66.56, -66.56],
  lonLines: [0, 135],
  color: "253,230,138",
};

const UTC = new Date(Date.UTC(2026, 2, 20, 3));

export default function EarthCoordsDemo() {
  const [place, setPlace] = useState({
    latDeg: SEOUL.latDeg,
    lonDeg: SEOUL.lonDeg,
  });
  const pins = useMemo<MapPin[]>(
    () => [{ ...place, color: "#fde68a", label: "고른 곳" }],
    [place],
  );
  const ns = place.latDeg >= 0 ? "북위" : "남위";
  const ew = place.lonDeg >= 0 ? "동경" : "서경";
  // 그리니치 기준 평균 해의 남중 (UTC). 경도 15°마다 1시간
  const noonUtc = meanSolarNoonMinutes(place.lonDeg, 0);

  return (
    <div className="flex flex-col gap-3">
      <WorldMap
        utc={UTC}
        timeBands={false}
        hoverTime={false}
        shade={false}
        pins={pins}
        guides={GUIDES}
        onPick={(latDeg, lonDeg) => setPlace({ latDeg, lonDeg })}
      />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-base-300/50 rounded-box p-3">
          <div className="text-xs opacity-60">위도</div>
          <div className="text-lg font-black">
            {ns} {Math.abs(place.latDeg).toFixed(1)}°
          </div>
          <div className="text-xs opacity-70">
            적도에서 {ns === "북위" ? "북" : "남"}쪽으로 약{" "}
            {Math.round(Math.abs(place.latDeg) * KM_PER_DEG_LAT).toLocaleString(
              "ko-KR",
            )}
            km
          </div>
        </div>
        <div className="bg-base-300/50 rounded-box p-3">
          <div className="text-xs opacity-60">경도</div>
          <div className="text-lg font-black">
            {ew} {Math.abs(place.lonDeg).toFixed(1)}°
          </div>
          <div className="text-xs opacity-70">
            여기서 경도 1°는 약 {Math.round(kmPerDegLon(place.latDeg))}km
          </div>
        </div>
      </div>
      <p className="text-xs opacity-70">
        평균 해가 이곳 하늘 가장 높이(남중) 오는 때는 세계시(UTC)로 약{" "}
        <b>{clockLabel(noonUtc)}</b>예요. 그리니치(경도 0°)는 12:00, 동쪽으로
        15° 갈 때마다 한 시간씩 빨라요. 노란 선은 적도·회귀선·극권과 경도
        0°·135°(한국 표준시의 기준 경도)예요.
      </p>
    </div>
  );
}
