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

  useEffect(() => {
    setLocal(shot?.local ?? "");
    setOffset(shot?.offset ?? browserOffset());
  }, [shot]);

  const apply = () => {
    if (!local) {
      onChange(null);

      return;
    }

    // 사람이 고친 시각이면 장소는 그대로 두고 출처만 바꾼다
    onChange({
      local,
      offset,
      observer: shot?.observer,
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
