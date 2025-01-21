"use client";
import { useEffect, useRef, useState } from "react";
import { useThreeConstellations } from "@/app/database/hooks/useThreeConstellations";
import { useThreeHealpix } from "@/app/database/hooks/useThreeHealpix";
import { useThreeScene } from "@/app/database/hooks/useThreeScene";
import { useThreeStars } from "@/app/database/hooks/useThreeStars";

export default function Page() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [showConstellations, setShowConstellations] = useState(false);
  const [showHealpix, setShowHealpix] = useState(false);
  const { scene } = useThreeScene(mountRef);
  const { stars } = useThreeStars();
  const { constellations } = useThreeConstellations();
  const {
    centers: healpixCenters,
    borders: healpixBorders,
    circles: healpixCircles,
  } = useThreeHealpix();

  useEffect(() => {
    if (!scene || !stars) {
      return;
    }

    scene.add(stars);
  }, [scene, stars]);

  useEffect(() => {
    if (!scene || !constellations) {
      return;
    }

    if (showConstellations) {
      constellations.forEach((constellation) => {
        scene.add(constellation);
      });

      return;
    }

    constellations.forEach((constellation) => {
      scene.remove(constellation);
    });
  }, [scene, constellations, showConstellations]);

  useEffect(() => {
    if (!scene || !healpixCenters || !healpixBorders || !healpixCircles) {
      return;
    }

    if (showHealpix) {
      scene.add(healpixCenters);
      healpixBorders.forEach((border) => {
        scene.add(border);
      });
      healpixCircles.forEach((border) => {
        scene.add(border);
      });

      return;
    }

    scene.remove(healpixCenters);
    healpixBorders.forEach((border) => {
      scene.remove(border);
    });
    healpixCircles.forEach((border) => {
      scene.remove(border);
    });
  }, [scene, healpixCenters, healpixBorders, healpixCircles, showHealpix]);

  return (
    <div className="relative">
      <div ref={mountRef} />

      <div className="absolute left-4 top-4 flex flex-row gap-4">
        <div className="mb-4 flex items-center">
          <input
            id="show-constellations"
            type="checkbox"
            checked={showConstellations}
            onChange={(event) => setShowConstellations(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
          />
          <label
            htmlFor="show-constellations"
            className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
          >
            별자리 그리기
          </label>
        </div>
        <div className="mb-4 flex items-center">
          <input
            id="show-healpix"
            type="checkbox"
            checked={showHealpix}
            onChange={(event) => setShowHealpix(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
          />
          <label
            htmlFor="show-healpix"
            className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
          >
            Healpix 그리기
          </label>
        </div>
      </div>
    </div>
  );
}
