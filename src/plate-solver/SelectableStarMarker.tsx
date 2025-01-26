import Konva from "konva";
import { useState } from "react";
import { Ring } from "react-konva";

interface Props {
  key: string;
  id: string;
  x: number;
  y: number;
  onPositionUpdate: (id: string, x: number, y: number) => void;
  remove(id: string): void;
}

export default function SelectableStarMarker(props: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setIsDragging(false);
    props.onPositionUpdate(props.id, e.target.x(), e.target.y());
  };

  const handleDoubleClickRing = (e: Konva.KonvaEventObject<DragEvent>) => {
    const id = e.target.id();
    props.remove(id);
  };

  return (
    <>
      <Ring
        key={props.id}
        id={props.id}
        x={props.x}
        y={props.y}
        innerRadius={12}
        outerRadius={25}
        fill="oklch(0.704 0.191 22.216)"
        opacity={0.5}
        draggable
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.6}
        on
        shadowOffsetX={isDragging ? 10 : 5}
        shadowOffsetY={isDragging ? 10 : 5}
        scaleX={isDragging ? 1.2 : 1}
        scaleY={isDragging ? 1.2 : 1}
        onDblClick={handleDoubleClickRing}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      />
    </>
  );
}
