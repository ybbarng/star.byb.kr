import {useEffect, useRef} from "react";
import {useThreeScene} from "@/app/hash/feasibility/hooks/useThreeScene";
import {GraphType, useThreeData} from "@/app/hash/feasibility/hooks/useThreeData";

interface Props {
  graphType: GraphType;
}
export default function Graph({graphType}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { scene } = useThreeScene(mountRef);
  const { databaseData, database30Data, photoData } = useThreeData(graphType);

  useEffect(() => {
    if (!scene || !databaseData || !database30Data || !photoData) {
      return;
    }
    scene.add(database30Data);
    scene.add(databaseData);
    scene.add(photoData);
  }, [scene, databaseData, database30Data, photoData]);

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <h1 className="text-4xl font-bold">{graphType} 그래프</h1>
      <div className="w-[500px] h-[500px]" ref={mountRef}/>
    </div>
  );
}
