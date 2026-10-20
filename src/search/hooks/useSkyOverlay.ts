import type { Point2D, Point3D } from "@/scripts/hash/types";
import type { SkyObject, SkyObjectKind } from "@/search/skyObjects";
import type { FisheyeCamera } from "@/search/utils/fisheye";
import type { Mat3 } from "@/search/utils/similarity";
import { useCallback, useState } from "react";
import {
  boundaryEdges,
  constellationAt,
} from "@/search/utils/constellationBounds";
import { projectFisheye } from "@/search/utils/fisheye";
import { koreanStarName } from "@/search/utils/starNames";
import { photoToSky, projectVecToPhoto } from "@/search/utils/wcs";
import constellationData from "@build/database/vectors-constellations.json";
import catalogData from "@build/database/vectors-database.json";

// 카탈로그 별/별자리를 사진 좌표에 투영하는 hook. 투영 방식(직선/어안)에 무관하게,
// "방향 → 픽셀(뒤쪽이면 null)" 투영 함수만 받으면 오버레이를 만든다.

export interface SkyStar {
  name: string | null; // 고유 이름이 있는 별만 글자로 표시한다 (나머지는 HR 번호뿐이라 사진을 덮는다)
  x: number;
  y: number;
}

export interface SkyConstellation {
  label: string;
  // 폴리라인 정점. 카메라 뒤쪽이거나 화면에서 너무 먼 정점은 null(그 선분은 안 그림).
  lines: (Point2D | null)[];
}

// 별자리 구역(IAU 경계). 사진의 얼마만큼을 차지하는지와, 사진 안에서 그 구역의 가운데(이름 쓸 자리)
export interface SkyRegion {
  label: string;
  share: number; // 사진 넓이 중 이 구역의 몫 (0~1)
  x: number;
  y: number;
}

// 별이 아닌 천체(딥스카이·해·달·행성)의 사진 위치. radiusPx는 겉보기 크기(0이면 점).
export interface SkyObjectMark {
  name: string;
  kind: SkyObjectKind;
  x: number;
  y: number;
  radiusPx: number;
}

interface VectorStar {
  HR: string;
  N?: string;
  V: string; // 시등급 (작을수록 밝다)
  x: number;
  y: number;
  z: number;
}

// 이 거리(px) 안에 겹친 별(쌍성·중복 항목)은 밝은 하나만 그린다
const OVERLAP_PX = 3;

// 밝은 별부터 그려지도록 미리 정렬해 둔다
const catalogByBrightness = [...(catalogData as VectorStar[])].sort(
  (a, b) => parseFloat(a.V) - parseFloat(b.V),
);

interface ConstellationData {
  label: string;
  stars: number[][];
}

type Projector = (vec: Point3D) => Point2D | null;

interface Overlay {
  stars: SkyStar[];
  constellations: SkyConstellation[];
  objects: SkyObjectMark[];
  boundaries: (Point2D | null)[][]; // 사진에 걸친 구역 경계 변 (뒤쪽·먼 점은 null)
  regions: SkyRegion[]; // 사진에 담긴 구역, 넓은 순
}

const EMPTY: Overlay = {
  stars: [],
  constellations: [],
  objects: [],
  boundaries: [],
  regions: [],
};

// 사진을 이 칸 수로 나눠 칸마다 어느 구역인지 본다
const REGION_GRID = 12;

const regionsOf = (
  unproject: (p: Point2D) => Point3D,
  width: number,
  height: number,
): SkyRegion[] => {
  const acc = new Map<string, { n: number; x: number; y: number }>();

  for (let i = 0; i < REGION_GRID; i++) {
    for (let j = 0; j < REGION_GRID; j++) {
      const x = ((i + 0.5) / REGION_GRID) * width;
      const y = ((j + 0.5) / REGION_GRID) * height;
      const label = constellationAt(unproject([x, y]));

      if (!label) continue;

      const a = acc.get(label) ?? { n: 0, x: 0, y: 0 };
      acc.set(label, { n: a.n + 1, x: a.x + x, y: a.y + y });
    }
  }

  return [...acc.entries()]
    .map(([label, a]) => ({
      label,
      share: a.n / (REGION_GRID * REGION_GRID),
      x: a.x / a.n,
      y: a.y / a.n,
    }))
    .sort((a, b) => b.share - a.share);
};

// 방향 v에서 각거리 r(°)만큼 떨어진 방향 (겉보기 크기를 픽셀로 바꿀 때 쓴다)
const offsetBy = (v: Point3D, rDeg: number): Point3D => {
  const axis: Point3D = Math.abs(v[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u: Point3D = [
    v[1] * axis[2] - v[2] * axis[1],
    v[2] * axis[0] - v[0] * axis[2],
    v[0] * axis[1] - v[1] * axis[0],
  ];
  const n = Math.hypot(u[0], u[1], u[2]);
  const r = (rDeg * Math.PI) / 180;

  return v.map((c, i) => c * Math.cos(r) + (u[i] / n) * Math.sin(r)) as Point3D;
};

const projectObjects = (
  project: Projector,
  objects: SkyObject[],
  width: number,
  height: number,
): SkyObjectMark[] => {
  const marks: SkyObjectMark[] = [];

  for (const o of objects) {
    const p = project(o.vector);

    if (!p) {
      continue;
    }

    const edge = o.radiusDeg > 0 ? project(offsetBy(o.vector, o.radiusDeg)) : p;
    const radiusPx = edge ? Math.hypot(edge[0] - p[0], edge[1] - p[1]) : 0;

    // 가장자리라도 사진에 걸치면 그린다
    if (
      p[0] + radiusPx < 0 ||
      p[0] - radiusPx > width ||
      p[1] + radiusPx < 0 ||
      p[1] - radiusPx > height
    ) {
      continue;
    }

    marks.push({ name: o.name, kind: o.kind, x: p[0], y: p[1], radiusPx });
  }

  return marks;
};

// 투영 함수로 화면에 들어오는 별/별자리를 만든다.
const buildOverlay = (
  project: Projector,
  width: number,
  height: number,
  objects: SkyObject[],
  unproject?: (p: Point2D) => Point3D, // 있으면 구역 몫을 잰다 (직선투영)
): Overlay => {
  const sk: SkyStar[] = [];

  for (const s of catalogByBrightness) {
    const p = project([s.x, s.y, s.z]);

    if (
      !p ||
      p[0] < -50 ||
      p[0] > width + 50 ||
      p[1] < -50 ||
      p[1] > height + 50
    ) {
      continue;
    }

    const overlapped = sk.some(
      (o) =>
        Math.abs(o.x - p[0]) < OVERLAP_PX && Math.abs(o.y - p[1]) < OVERLAP_PX,
    );

    if (!overlapped) {
      sk.push({
        name: s.N ? koreanStarName(s.N) : null,
        x: p[0],
        y: p[1],
      });
    }
  }

  // 정점이 화면에서 이만큼 벗어나면 선이 사진 밖으로 길게 뻗으므로 끊는다
  const marginX = width;
  const marginY = height;
  const cons: SkyConstellation[] = [];

  for (const c of constellationData as ConstellationData[]) {
    const lines: (Point2D | null)[] = c.stars.map((st) => {
      const p = project([st[0], st[1], st[2]]);

      if (
        !p ||
        p[0] < -marginX ||
        p[0] > width + marginX ||
        p[1] < -marginY ||
        p[1] > height + marginY
      ) {
        return null;
      }

      return p;
    });

    const anyVisible = lines.some(
      (p) =>
        p !== null && p[0] >= 0 && p[0] < width && p[1] >= 0 && p[1] < height,
    );

    if (anyVisible) {
      cons.push({ label: c.label, lines });
    }
  }

  // 구역 경계: 사진에 한 점이라도 걸치는 변만
  const boundaries: (Point2D | null)[][] = [];

  for (const edge of boundaryEdges()) {
    const pts = edge.map((v) => {
      const p = project(v);

      return p &&
        p[0] > -marginX &&
        p[0] < width + marginX &&
        p[1] > -marginY &&
        p[1] < height + marginY
        ? p
        : null;
    });

    if (
      pts.some(
        (p) =>
          p !== null && p[0] >= 0 && p[0] < width && p[1] >= 0 && p[1] < height,
      )
    ) {
      boundaries.push(pts);
    }
  }

  return {
    stars: sk,
    constellations: cons,
    objects: projectObjects(project, objects, width, height),
    boundaries,
    regions: unproject ? regionsOf(unproject, width, height) : [],
  };
};

export default function useSkyOverlay() {
  const [overlay, setOverlay] = useState<Overlay>(EMPTY);

  // 직선투영(핀홀) 변환행렬로 그린다.
  const update = useCallback(
    (
      transform: Mat3,
      width: number,
      height: number,
      objects: SkyObject[] = [],
    ) => {
      setOverlay(
        buildOverlay(
          (v) => projectVecToPhoto(transform, v),
          width,
          height,
          objects,
          (p) => photoToSky(transform, p),
        ),
      );
    },
    [],
  );

  // 어안 카메라로 그린다(초광각 은하수 등).
  const updateFisheye = useCallback(
    (
      camera: FisheyeCamera,
      width: number,
      height: number,
      objects: SkyObject[] = [],
    ) => {
      setOverlay(
        buildOverlay((v) => projectFisheye(camera, v), width, height, objects),
      );
    },
    [],
  );

  const clear = useCallback(() => {
    setOverlay(EMPTY);
  }, []);

  return { ...overlay, update, updateFisheye, clear };
}
