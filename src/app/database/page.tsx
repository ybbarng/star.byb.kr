"use client";
import {useEffect, useRef } from "react";
import {useThreeScene} from "@/app/database/hooks/useThreeScene";
import {useThreeStars} from "@/app/database/hooks/useThreeStars";

export default function Page() {
  const mountRef = useRef<HTMLDivElement>(null);
  const { scene } = useThreeScene(mountRef);
  const { stars } = useThreeStars();

  useEffect(() => {
    if (!scene || !stars) {
      return;
    }
    scene.add(stars);
  }, [scene, stars]);

  return <div ref={ mountRef } />
}
