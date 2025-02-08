"use client";
import { useEffect, useRef } from "react";
import { useThreeConstellations } from "@/app/database/hooks/useThreeConstellations";
import { useThreeScene } from "@/app/database/hooks/useThreeScene";
import { useThreeStars } from "@/app/database/hooks/useThreeStars";

export default function Page() {
  const mountRef = useRef<HTMLDivElement>(null);
  const { scene } = useThreeScene(mountRef);
  const { stars } = useThreeStars();
  const { constellations } = useThreeConstellations();

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

  return (
    <div className="relative">
      <div ref={mountRef} />
    </div>
  );
}
