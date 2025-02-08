"use client";
import { useEffect, useRef, useState } from "react";
import { useThreeConstellations } from "@/app/demo/hooks/useThreeConstellations";
import { useThreeHealpix } from "@/app/demo/hooks/useThreeHealpix";
import { useThreeScene } from "@/app/demo/hooks/useThreeScene";
import { useThreeStars } from "@/app/demo/hooks/useThreeStars";

export default function Page() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [showHealpixBorder, setShowHealpixBorder] = useState(false);
  const [showHealpixCenter, setShowHealpixCenter] = useState(false);
  const [showHealpixCircle, setShowHealpixCircle] = useState(false);
  const { scene } = useThreeScene(mountRef);
  const { stars } = useThreeStars();
  const { constellations } = useThreeConstellations();
  const {
    centers: healpixCenters,
    borders: healpixBorders,
    circles: healpixCircles,
  } = useThreeHealpix();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "1") {
        setShowHealpixBorder(!showHealpixBorder);

        return;
      }

      if (event.key === "2") {
        setShowHealpixCenter(!showHealpixCenter);

        return;
      }

      if (event.key === "3") {
        setShowHealpixCircle(!showHealpixCircle);

        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showHealpixBorder, showHealpixCenter, showHealpixCircle]);

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

    constellations.forEach((constellation) => {
      scene.add(constellation);
    });
  }, [scene, constellations]);

  useEffect(() => {
    if (!scene || !healpixBorders) {
      return;
    }

    if (showHealpixBorder) {
      healpixBorders.forEach((border) => {
        scene.add(border);
      });

      return;
    }

    healpixBorders.forEach((border) => {
      scene.remove(border);
    });
  }, [scene, showHealpixBorder, healpixBorders]);

  useEffect(() => {
    if (!scene || !healpixCenters) {
      return;
    }

    if (showHealpixCenter) {
      scene.add(healpixCenters);

      return;
    }

    scene.remove(healpixCenters);
  }, [scene, showHealpixCenter, healpixCenters]);

  useEffect(() => {
    if (!scene || !healpixCircles) {
      return;
    }

    if (showHealpixCircle) {
      healpixCircles.forEach((border) => {
        scene.add(border);
      });

      return;
    }

    healpixCircles.forEach((border) => {
      scene.remove(border);
    });
  }, [scene, showHealpixCircle, showHealpixCircle]);

  return (
    <div className="relative">
      <div ref={mountRef} />
    </div>
  );
}
