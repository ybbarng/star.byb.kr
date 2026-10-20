import type { ShotTime } from "@/plate-solver/shotTime";
import { useEffect, useState } from "react";
import { browserOffset } from "@/plate-solver/shotTime";

// 촬영 시각 입력. 알면 달·행성이 사진 위에 표시된다.
export default function ShotTimeControl({
  shot,
  onChange,
}: {
  shot: ShotTime | null;
  onChange: (shot: ShotTime | null) => void;
}) {
  const [local, setLocal] = useState(shot?.local ?? "");
  const [offset, setOffset] = useState(shot?.offset ?? browserOffset());
  const [lat, setLat] = useState(shot?.observer?.latDeg.toString() ?? "");
  const [lon, setLon] = useState(shot?.observer?.lonDeg.toString() ?? "");

  useEffect(() => {
    setLocal(shot?.local ?? "");
    setOffset(shot?.offset ?? browserOffset());
    setLat(shot?.observer?.latDeg.toString() ?? "");
    setLon(shot?.observer?.lonDeg.toString() ?? "");
  }, [shot]);

  const apply = () => {
    if (!local) {
      onChange(null);

      return;
    }

    // 장소는 위도·경도를 둘 다 넣었을 때만 쓴다
    const latDeg = parseFloat(lat);
    const lonDeg = parseFloat(lon);

    onChange({
      local,
      offset,
      observer:
        Number.isFinite(latDeg) && Number.isFinite(lonDeg)
          ? { latDeg, lonDeg }
          : undefined,
      source: "manual",
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          className="input input-sm w-auto"
          aria-label="촬영 시각"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
        />
        <select
          className="select select-sm w-auto"
          aria-label="시간대"
          value={offset}
          onChange={(e) => setOffset(e.target.value)}
        >
          {OFFSETS.includes(offset) ? null : (
            <option value={offset}>{offset}</option>
          )}
          {OFFSETS.map((o) => (
            <option key={o} value={o}>
              UTC{o}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input input-sm w-24"
          placeholder="위도 (예 37.5)"
          aria-label="위도"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
        />
        <input
          className="input input-sm w-24"
          placeholder="경도 (예 127)"
          aria-label="경도"
          value={lon}
          onChange={(e) => setLon(e.target.value)}
        />
        <button className="btn btn-sm" onClick={apply}>
          적용
        </button>
      </div>
      <span className="text-xs opacity-60">
        {shot
          ? `${shot.note ?? "직접 입력"}${shot.observer ? "" : " · 장소를 넣으면 달 위치가 더 정확해져요"}`
          : "시각을 넣으면 해·달·행성도 사진 위에 그려요."}
      </span>
    </div>
  );
}

const OFFSETS = Array.from({ length: 27 }, (_, i) => i - 12).map((h) => {
  const sign = h >= 0 ? "+" : "-";

  return `${sign}${String(Math.abs(h)).padStart(2, "0")}:00`;
});
