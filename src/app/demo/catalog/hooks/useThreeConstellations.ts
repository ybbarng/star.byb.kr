import { useEffect, useState } from "react";
import * as THREE from "three";
import { convertTo3DCoordinates } from "@/app/database/utils/coordinates";

export const useThreeConstellations = () => {
  const [constellations, setConstellations] = useState<THREE.Line[]>([]);

  const loadStarCatalog = async () => {
    const response = await fetch("/catalogs/bsc5.dat");

    if (!response.ok) {
      throw new Error("별 정보를 로드하지 못했습니다.");
    }

    const bsc5dat = await response.text();
    const starData = bsc5dat.split("\n");
    const starCatalog: StarCatalog = {};
    starData.forEach((row: string) => {
      const vector = convertTo3DCoordinates(
        row.slice(83, 90),
        row.slice(75, 83),
      );
      const star = {
        id: Number(row.slice(0, 4)),
        name: row.slice(4, 14).trim(),
        mag: Number(row.slice(102, 107)),
        spectralClass: row.slice(129, 130),
        v: new THREE.Vector3(vector.x * 100, vector.z * 100, vector.y * 100),
      };
      starCatalog[star.id] = star;
    });

    return starCatalog;
  };

  const loadConstellationData = async () => {
    const response = await fetch("/catalogs/ConstellationLines.dat");

    if (!response.ok) {
      throw new Error("별자리 정보를 로드하지 못했습니다.");
    }

    const data = await response.text();

    const constellationLinesData = data.split("\n");
    const constellations: ConstellationLineData[] = [];
    constellationLinesData.forEach((row) => {
      if (!row.startsWith("#") && row.length > 1) {
        const rowData = row.split(/[ ,]+/);
        const starIds = [];

        for (let i = 0; i < rowData.length - 2; i++) {
          const starId = parseInt(rowData[i + 2].trim());
          starIds.push(starId);
        }

        constellations.push({
          starIds,
        });
      }
    });

    return constellations;
  };

  useEffect(() => {
    const createThreeConstellations = async () => {
      const starCatalog = await loadStarCatalog();
      const constellationData = await loadConstellationData();

      const constellations: THREE.Line[] = [];
      constellationData.forEach((constellation) => {
        const points: THREE.Vector3[] = [];
        constellation.starIds.forEach((starId: number) => {
          if (starId in starCatalog) {
            const star = starCatalog[starId];
            points.push(star.v);
          }
        });
        const constellationGeometry = new THREE.BufferGeometry().setFromPoints(
          points,
        );
        const constellationMaterial = new THREE.LineBasicMaterial({
          color: 0xffdf20,
        });
        const constellationLine = new THREE.Line(
          constellationGeometry,
          constellationMaterial,
        );
        constellationLine.userData.type = "constellationLine";
        constellations.push(constellationLine);
      });
      setConstellations(constellations);
    };

    createThreeConstellations();
  }, []);

  return {
    constellations,
  };
};

interface Star {
  id: number;
  name: string;
  mag: number;
  spectralClass: string;
  v: THREE.Vector3;
}

interface StarCatalog {
  [key: number]: Star;
}

interface ConstellationLineData {
  starIds: number[];
}
