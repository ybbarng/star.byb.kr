import { useState } from "react";
import { SampleCreditList } from "@/plate-solver/SampleCredits";
import { useContextStore } from "@/plate-solver/store/context";
import samples from "@/services/samples";
import { cn } from "@/utils/cn";

// 사진 고르기: 내 사진을 올리거나 샘플을 누르면 바로 별자리를 찾는다.
export default function SelectPhotoStep() {
  const setImage = useContextStore((state) => state.setImage);
  const goTo = useContextStore((state) => state.goTo);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // 다음 화면(검출)은 사진의 실제 크기가 필요해, 사진을 다 불러온 뒤에 넘어간다.
  const open = async (src: string, key: string, fileName?: string) => {
    setLoading(key);
    setError(null);

    try {
      const image = new Image();
      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () =>
          reject(
            new Error("사진을 불러오지 못했어요. 다른 사진으로 해 보세요."),
          );
      });

      image.src = src;
      await loaded;
      setImage(image, fileName);
      goTo("solve");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(null);
    }
  };

  const openFile = (file?: File) => {
    if (!file) {
      return;
    }

    // 업로드한 사진은 이 페이지에서만 쓰는 주소로 연다 (서버로 보내지 않는다)
    // 파일 이름도 넘긴다 (휴대폰은 이름에 촬영 시각을 쓴다)
    open(URL.createObjectURL(file), "upload", file.name);
  };

  return (
    <div className="flex w-full max-w-5xl flex-col gap-8 pb-12">
      <div className="fx-rise mt-2 flex flex-col items-center gap-2 text-center">
        <h1 className="bg-gradient-to-b from-white via-indigo-100 to-indigo-300 bg-clip-text text-4xl font-black text-transparent md:text-5xl">
          사진 속 별자리 찾기
        </h1>
        <p className="max-w-xl opacity-70">
          밤하늘 사진을 올리면 컴퓨터가 별의 배치만 보고 어느 하늘인지 찾아
          별자리를 그려 줘요.
        </p>
      </div>

      <label
        className={cn(
          "fx-rise rounded-box flex cursor-pointer flex-col items-center gap-3 border-2 border-dashed p-8 text-center transition-colors md:p-12",
          dragOver
            ? "border-primary bg-primary/15"
            : "hover:border-primary/70 border-white/25 bg-white/5",
        )}
        style={{ animationDelay: "100ms" }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          openFile(e.dataTransfer.files?.[0]);
        }}
      >
        <span className="text-5xl">🌌</span>
        <span className="text-xl font-bold">
          {loading === "upload" ? "사진을 여는 중…" : "내 밤하늘 사진 올리기"}
        </span>
        <span className="text-sm opacity-70">
          눌러서 고르거나 여기로 끌어다 놓으세요 · JPEG·PNG·WebP
        </span>
        <span className="text-xs opacity-60">
          🔒 사진은 서버로 보내지 않아요. 모든 계산을 이 기기에서 해요.
        </span>
        <input
          type="file"
          className="hidden"
          accept="image/*"
          onChange={(e) => openFile(e.target.files?.[0])}
        />
      </label>

      {error && <div className="text-error text-center text-sm">{error}</div>}

      <div className="flex flex-col gap-3">
        <h2 className="text-center text-sm font-bold opacity-70">
          또는 샘플 사진으로 해 보기
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {samples.map((s, i) => (
            <button
              key={s.src}
              className="fx-card fx-rise rounded-box group bg-base-200/80 overflow-hidden text-left disabled:opacity-60"
              style={{ animationDelay: `${150 + i * 30}ms` }}
              disabled={loading !== null}
              onClick={() => open(s.src, s.src)}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element -- 정적 내보내기라 next/image 최적화를 쓰지 않는다 */}
                <img
                  src={s.thumb}
                  alt={s.title}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {loading === s.src && (
                  <div className="absolute inset-0 grid place-items-center bg-black/50">
                    <span className="loading loading-spinner" />
                  </div>
                )}
              </div>
              <div className="px-3 py-2">
                <div className="truncate text-sm font-bold">{s.title}</div>
                <div className="truncate text-xs opacity-60">{s.caption}</div>
              </div>
            </button>
          ))}
        </div>
        <SampleCreditList />
      </div>
    </div>
  );
}
