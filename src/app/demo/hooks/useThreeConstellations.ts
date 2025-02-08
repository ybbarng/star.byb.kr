import { useEffect, useState } from "react";
import * as THREE from "three";
import { Point3D } from "@/scripts/hash/types";
import _constellations from "@build/database/vectors-constellations.json";

interface Constellation {
  label: string;
  stars: Point3D[];
}

const constellationsData = _constellations as Constellation[];

export const useThreeConstellations = () => {
  const [constellations, setConstellations] = useState<THREE.Line[]>([]);

  useEffect(() => {
    const createThreeConstellations = async () => {
      const constellations: THREE.Line[] = [];
      constellationsData.forEach((constellation) => {
        const points: THREE.Vector3[] = [];
        constellation.stars.forEach((star) => {
          points.push(
            new THREE.Vector3(star[0] * 100, star[2] * 100, star[1] * 100),
          );
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
