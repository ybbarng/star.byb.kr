"use client";
import {useEffect, useRef, useState} from "react";
import {useThreeScene} from "@/app/database/hooks/useThreeScene";
import {useThreeStars} from "@/app/database/hooks/useThreeStars";
import {useThreeConstellations} from "@/app/database/hooks/useThreeConstellations";

export default function Page() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [showConstellations, setShowConstellations] = useState(false);
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
    if (showConstellations) {
      constellations.forEach((constellation) => {
        scene.add(constellation);
      })
      return;
    }
    constellations.forEach((constellation) => {
      scene.remove(constellation);
    })
  }, [scene, constellations, showConstellations]);

  return <div className="relative">
    <div ref={ mountRef } />

    <div className="absolute top-4 left-4 flex flex-row gap-1">
      <div className="flex items-center mb-4">
        <input id="default-checkbox"
               type="checkbox"
               checked={showConstellations}
               onChange={(event) => setShowConstellations(event.target.checked)}
               className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"/>
        <label htmlFor="default-checkbox" className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300">
          별자리 그리기
        </label>
      </div>
    </div>
  </div>
}
