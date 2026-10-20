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
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="opacity-70">촬영 시각</span>
      <input
        type="datetime-local"
        className="input input-sm w-auto"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
      />
      <select
        className="select select-sm w-auto"
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
      <span className="opacity-70">장소</span>
      <input
        className="input input-sm w-20"
        placeholder="위도"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
      />
      <input
        className="input input-sm w-20"
        placeholder="경도"
        value={lon}
        onChange={(e) => setLon(e.target.value)}
      />
      <button className="btn btn-sm" onClick={apply}>
        적용
      </button>
      <span className="text-xs opacity-60">
        {shot ? (shot.note ?? "직접 입력") : "넣으면 달·행성도 표시합니다"}
      </span>
    </div>
  );
}

const OFFSETS = Array.from({ length: 27 }, (_, i) => i - 12).map((h) => {
  const sign = h >= 0 ? "+" : "-";

  return `${sign}${String(Math.abs(h)).padStart(2, "0")}:00`;
});
