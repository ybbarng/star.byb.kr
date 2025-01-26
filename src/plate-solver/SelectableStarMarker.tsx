import Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Ring, Transformer } from "react-konva";

interface Props {
  key: string;
  id: string;
  x: number;
  y: number;
  isSelected: boolean;
  onPositionUpdate: (id: string, x: number, y: number) => void;
  select(id: string): void;
  remove(id: string): void;
}

export default function SelectableStarMarker(props: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const shapeRef = useRef<Konva.Ring>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setIsDragging(false);
    props.onPositionUpdate(props.id, e.target.x(), e.target.y());
  };

  const handleSelect = () => {
    props.select(props.id);
  };

  const handleDoubleClickRing = (e: Konva.KonvaEventObject<DragEvent>) => {
    const id = e.target.id();
    props.remove(id);
  };

  useEffect(() => {
    if (!trRef.current || !shapeRef.current) {
      return;
    }

    if (props.isSelected) {
      // we need to attach transformer manually
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [props.isSelected]);

  return (
    <>
      <Ring
        ref={shapeRef}
        key={props.id}
        id={props.id}
        x={props.x}
        y={props.y}
        name="star"
        innerRadius={12}
        outerRadius={25}
        fill="oklch(0.704 0.191 22.216)"
        opacity={0.5}
        draggable
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.6}
        shadowOffsetX={isDragging ? 10 : 5}
        shadowOffsetY={isDragging ? 10 : 5}
        scaleX={isDragging ? 1.2 : 1}
        scaleY={isDragging ? 1.2 : 1}
        onClick={handleSelect}
        onTap={handleSelect}
        onDblClick={handleDoubleClickRing}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      />
      {props.isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            // limit resize
            if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
              return oldBox;
            }

            return newBox;
          }}
          rotateEnabled={false}
          resizeEnabled={false}
        />
      )}
    </>
  );
}
