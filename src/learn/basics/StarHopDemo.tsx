"use client";

import type { DomeLine, DomeMark } from "@/learn/basics/SkyDome";
import type { Point3D } from "@/scripts/hash/types";
import { useMemo, useState } from "react";
import { STARS } from "@/game/sky/catalog";
import SkyDome from "@/learn/basics/SkyDome";
import {
  angleBetweenDeg,
  arcPoints,
  fistsLabel,
  raDecToVector,
  SEOUL,
} from "@/learn/basics/skyMath";
import { cn } from "@/utils/cn";

// 스타 호핑: 아는 별에서 출발해 방향과 거리(손 각도)로 다음 대상을 찾아간다.
// 길마다 서울에서 잘 보이는 날 저녁의 둥근 하늘 위에 화살표(큰 원의 호)를 긋고, 걸음마다 각도를 적는다.

const star = (latin: string): Point3D => {
  const s = STARS.find((x) => x.latinName === latin || x.hr === latin);

  if (!s) {
    throw new Error(`카탈로그에 없는 별: ${latin}`);
  }

  return s.vector;
};

// 안드로메다은하(M31)는 별 목록에 없어 위치를 따로 둔다 (J2000)
const M31 = raDecToVector(10.6847, 41.269);

interface Hop {
  from: Point3D;
  to: Point3D;
  via?: Point3D; // from→via 방향으로 to까지 늘인다
  text: string;
}

interface Route {
  key: string;
  label: string;
  when: string;
  t: number;
  hops: Hop[];
  marks: { v: Point3D; label: string }[];
  note: string;
}

const kst = (m: number, d: number, h: number) =>
  Date.UTC(2026, m - 1, d, h - 9);

const ROUTES: Route[] = [
  {
    key: "polaris",
    label: "북두칠성 → 북극성",
    when: "4월 15일 21시",
    t: kst(4, 15, 21),
    hops: [
      {
        from: star("Merak"),
        via: star("Dubhe"),
        to: star("Polaris"),
        text: "국자 끝 두 별(메라크→두베)을 이은 방향으로, 두 별 사이의 약 5배",
      },
    ],
    marks: [
      { v: star("Merak"), label: "메라크" },
      { v: star("Dubhe"), label: "두베" },
      { v: star("Polaris"), label: "북극성" },
    ],
    note: "두 지시별을 이은 선에서 북극성은 2°쯤 비켜나 있지만, 그 근처에 그만큼 밝은 별이 없어 바로 알아봐요.",
  },
  {
    key: "arcturus",
    label: "손잡이 → 아크투루스 → 스피카",
    when: "5월 15일 21시",
    t: kst(5, 15, 21),
    hops: [
      {
        from: star("Mizar"),
        via: star("Alkaid"),
        to: star("Arcturus"),
        text: "국자 손잡이의 휜 곡선을 따라 이어 가면 주황빛 아크투루스",
      },
      {
        from: star("Alkaid"),
        via: star("Arcturus"),
        to: star("Spica"),
        text: "같은 곡선을 더 이어 가면(‘스피카로 쭉’) 하얀 스피카",
      },
    ],
    marks: [
      { v: star("Alkaid"), label: "알카이드" },
      { v: star("Arcturus"), label: "아크투루스" },
      { v: star("Spica"), label: "스피카" },
    ],
    note: "직선이 아니라 손잡이의 휜 곡선을 그대로 늘인다고 생각하면 돼요. 화살표는 걸음마다 곧게 그렸어요.",
  },
  {
    key: "m31",
    label: "페가수스 → 안드로메다은하",
    when: "11월 15일 21시",
    t: kst(11, 15, 21),
    hops: [
      {
        from: star("Alpheratz"),
        to: star("Mirach"),
        text: "페가수스 대사각형의 왼쪽 위 꼭짓점 알페라츠에서 안드로메다자리를 따라 미라크로",
      },
      {
        from: star("Mirach"),
        via: star("269"),
        to: M31,
        text: "미라크에서 북서쪽의 4등성(뮤)까지, 그 거리만큼 한 번 더 가면 뿌연 안드로메다은하",
      },
    ],
    marks: [
      { v: star("Alpheratz"), label: "알페라츠" },
      { v: star("Mirach"), label: "미라크" },
      { v: M31, label: "M31" },
    ],
    note: "미라크·뮤·안드로메다은하는 거의 한 줄에 같은 간격(약 3.9°)으로 놓여 있어요. 어두운 곳이면 맨눈에도 흐린 얼룩으로 보여요.",
  },
  {
    key: "orion",
    label: "오리온 허리띠 → 시리우스·알데바란",
    when: "1월 15일 21시",
    t: kst(1, 15, 21),
    hops: [
      {
        from: star("Mintaka"),
        via: star("Alnitak"),
        to: star("Sirius"),
        text: "허리띠 세 별을 왼쪽 아래(남동)로 이어 가면 가장 밝은 별 시리우스",
      },
      {
        from: star("Alnitak"),
        via: star("Mintaka"),
        to: star("Aldebaran"),
        text: "반대로 오른쪽 위(북서)로 이어 가면 붉은 알데바란, 조금 더 가면 플레이아데스(좀생이별)",
      },
    ],
    marks: [
      { v: star("Alnitak"), label: "허리띠" },
      { v: star("Sirius"), label: "시리우스" },
      { v: star("Aldebaran"), label: "알데바란" },
      { v: star("Alcyone"), label: "플레이아데스" },
    ],
    note: "허리띠를 이은 선에서 시리우스는 약 2.6°, 알데바란·플레이아데스는 약 5° 비켜나 있어요. 정확한 직선이 아니라 '그쪽 방향'으로 쓰는 길잡이예요.",
  },
];

export default function StarHopDemo() {
  const [key, setKey] = useState(ROUTES[0].key);
  const route = ROUTES.find((r) => r.key === key)!;
  const lines = useMemo<DomeLine[]>(
    () =>
      route.hops.map((h) => {
        const via = h.via ?? h.to;
        const extend =
          angleBetweenDeg(h.from, h.to) / angleBetweenDeg(h.from, via);

        return {
          points: arcPoints(h.from, via, extend, 48),
          color: "253,230,138",
          width: 2,
        };
      }),
    [route],
  );
  const marks = useMemo<DomeMark[]>(
    () =>
      route.marks.map((m) => ({
        vector: m.v,
        label: m.label,
        color: "#fde68a",
      })),
    [route],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {ROUTES.map((r) => (
          <button
            key={r.key}
            className={cn("btn btn-xs", r.key === key && "btn-primary")}
            onClick={() => setKey(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <SkyDome t={route.t} observer={SEOUL} lines={lines} marks={marks} />
      <div className="text-center text-xs opacity-60">
        서울, {route.when}의 하늘
      </div>
      <ol className="flex flex-col gap-2 text-sm">
        {route.hops.map((h, i) => {
          const deg = angleBetweenDeg(h.via ?? h.from, h.to);
          const total = angleBetweenDeg(h.from, h.to);

          return (
            <li key={i} className="bg-base-300/50 rounded-box p-3">
              <div>{h.text}</div>
              <div className="mt-1 text-xs text-amber-200">
                {h.via
                  ? `마지막 별에서 ${deg.toFixed(1)}° (${fistsLabel(deg)})`
                  : `${total.toFixed(1)}° (${fistsLabel(total)})`}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs opacity-70">{route.note}</p>
    </div>
  );
}
