import type { MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { feature } from "topojson-client";
import landTopology from "world-atlas/land-110m.json";

// 세계 지도의 육지 (Natural Earth 1:1억1천만 육지, world-atlas로 TopoJSON 55KB). 공개 영역 데이터.
// 지도 그리기와, 문제를 땅 위에서만 내는 데(isLand) 쓴다.

type Ring = [number, number][]; // [경도, 위도]

const topology = landTopology as unknown as Topology<{
  land: GeometryCollection;
}>;
const land = feature(topology, topology.objects.land);
// land는 GeometryCollection이라 FeatureCollection으로 나온다
const geometries = land.features.map((f) => f.geometry) as (
  | Polygon
  | MultiPolygon
)[];

// 다각형마다 바깥 고리와 구멍들
export const LAND_POLYGONS: Ring[][] = geometries.flatMap((g) =>
  g.type === "Polygon"
    ? [g.coordinates as Ring[]]
    : (g.coordinates as Ring[][]),
);

interface Box {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

const BOXES: Box[] = LAND_POLYGONS.map((poly) => {
  const outer = poly[0];

  return {
    minLon: Math.min(...outer.map((p) => p[0])),
    maxLon: Math.max(...outer.map((p) => p[0])),
    minLat: Math.min(...outer.map((p) => p[1])),
    maxLat: Math.max(...outer.map((p) => p[1])),
  };
});

// 점이 고리 안에 있는지 (반직선 교차 수)
const inRing = (lon: number, lat: number, ring: Ring) => {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
};

export const isLand = (latDeg: number, lonDeg: number): boolean =>
  LAND_POLYGONS.some((poly, k) => {
    const b = BOXES[k];

    return (
      lonDeg >= b.minLon &&
      lonDeg <= b.maxLon &&
      latDeg >= b.minLat &&
      latDeg <= b.maxLat &&
      inRing(lonDeg, latDeg, poly[0]) &&
      !poly.slice(1).some((hole) => inRing(lonDeg, latDeg, hole))
    );
  });
