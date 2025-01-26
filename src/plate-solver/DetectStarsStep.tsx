import { useContextStore } from "@/plate-solver/store/context";

export default function DetectStarStep() {
  const image = useContextStore((state) => state.image);

  if (!image) {
    return <div>이미지가 선택되지 않았습니다.</div>;
  }

  return (
    <div className="flex justify-center">
      <img src={image.src} className="max-h-[800px]" />
    </div>
  );
}
