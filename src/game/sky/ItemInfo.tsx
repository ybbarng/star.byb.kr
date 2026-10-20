import type { SkyItem } from "@/game/sky/drawSky";

// "이건 뭐예요?": 사진을 누른 자리의 천체를 알려 주는 작은 상자 (캔버스 위에 띄운다)
export default function ItemInfo({
  item,
  left,
  top,
  onClose,
}: {
  item: SkyItem | null;
  left: number; // 캔버스 너비 대비 비율 (0~1)
  top: number;
  onClose: () => void;
}) {
  return (
    <div
      className="bg-base-300/90 rounded-box absolute z-10 max-w-72 p-3 text-sm shadow-lg"
      style={{
        left: `${Math.min(left, 0.75) * 100}%`,
        top: `${Math.min(top, 0.8) * 100}%`,
      }}
      onClick={onClose}
    >
      {item ? (
        <>
          <div className="font-bold">{item.label}</div>
          <div className="text-xs opacity-80">{item.detail}</div>
        </>
      ) : (
        <div className="text-xs opacity-80">
          여기엔 눈에 띄는 천체가 없어요. 별이나 밝은 점을 눌러 보세요.
        </div>
      )}
    </div>
  );
}

// 캔버스 클릭 위치 → 캔버스 좌표와 화면 비율
export const canvasPoint = (
  e: React.MouseEvent<HTMLCanvasElement>,
): { x: number; y: number; fx: number; fy: number } => {
  const rect = e.currentTarget.getBoundingClientRect();
  const fx = (e.clientX - rect.left) / rect.width;
  const fy = (e.clientY - rect.top) / rect.height;

  return {
    x: fx * e.currentTarget.width,
    y: fy * e.currentTarget.height,
    fx,
    fy,
  };
};
