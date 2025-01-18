import {useEffect, useRef} from "react";
import {useThreeScene} from "@/app/hash/feasibility/hooks/useThreeScene";
import {GraphType, useThreeData} from "@/app/hash/feasibility/hooks/useThreeData";

interface Props {
  graphType: GraphType;
}
export default function Graph({graphType}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { scene } = useThreeScene(mountRef);
  const { databaseData, photoData } = useThreeData(graphType);

  useEffect(() => {
    if (!scene || !databaseData || !photoData) {
      return;
    }
    scene.add(databaseData);
    scene.add(photoData);
  }, [scene, databaseData, photoData]);

  return <div className="w-[500px] h-[500px]" ref={mountRef}/>;
}
