import { useEffect, useRef } from "react";
import {
  GraphType,
  useThreeData,
} from "@/app/hash/feasibility/hooks/useThreeData";
import { useThreeScene } from "@/app/hash/feasibility/hooks/useThreeScene";

interface Props {
  graphType: GraphType;
}

export default function Graph({ graphType }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { scene } = useThreeScene(mountRef);
  const { databaseData, databaseFullData, photoData } = useThreeData(graphType);

  useEffect(() => {
    if (!scene || !databaseData || !databaseFullData || !photoData) {
      return;
    }

    scene.add(databaseFullData);
    scene.add(databaseData);
    scene.add(photoData);
  }, [scene, databaseData, databaseFullData, photoData]);

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <h1 className="text-4xl font-bold">{graphType} 그래프</h1>
      <div className="h-[500px] w-[500px]" ref={mountRef} />
    </div>
  );
}
