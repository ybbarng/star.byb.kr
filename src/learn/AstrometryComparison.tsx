import { Stat } from "@/learn/LearnArticle";

// 처음 보는 인터넷 사진으로 우리 풀이와 Astrometry.net을 견준 결과 (찾는 원리 첫 페이지).
// 숫자는 docs/validation/astrometry-comparison-2026-10-29.md (사진별: results-2026-10-29.csv).
// 사진은 싣지 않는다 (외부 사진은 저장소에 두지 않는다).

// 분류별 [둘 다, 우리만, Astrometry만, 둘 다 못 풂]
const BY_KIND: [string, number, number, number, number][] = [
  ["은하수", 36, 66, 8, 53],
  ["별자리", 48, 12, 3, 11],
  ["별밭", 35, 6, 1, 2],
  ["박명", 21, 9, 1, 17],
  ["오로라", 19, 12, 0, 9],
  ["별 궤적", 1, 10, 2, 19],
  ["어안·전천", 0, 15, 0, 10],
  ["도시 불빛", 7, 11, 0, 8],
  ["구름", 12, 5, 1, 4],
];

const SEGMENTS = [
  { label: "둘 다 풂", className: "bg-indigo-400/70" },
  { label: "우리만 풂", className: "bg-amber-300" },
  { label: "Astrometry.net만 풂", className: "bg-sky-300" },
  { label: "둘 다 못 풂", className: "bg-white/10" },
];

export default function AstrometryComparison() {
  return (
    <div className="flex flex-col gap-4">
      <p className="opacity-80">
        인터넷(위키미디어 공용)에서 모은 밤하늘 사진 526장과 이 사이트의 샘플
        29장을, 이 사이트의 풀이와 천문학자들이 쓰는 <b>Astrometry.net</b>으로
        각각 풀어 봤어요. 일반인이 찍는 사진처럼 넓은 화각·은하수·오로라·지상
        불빛이 섞인 사진이 대부분이에요.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat value="388장 (70%)" label="이 사이트가 푼 사진 (555장 중)" />
        <Stat value="243장 (44%)" label="Astrometry.net이 푼 사진" />
        <Stat
          value="0.07초 · 5.9초"
          label="한 장 푸는 데 걸린 시간 (이 사이트 · Astrometry.net, 중앙값)"
        />
        <Stat value="0.11°" label="둘 다 푼 사진에서 두 답의 차이 (중앙값)" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-80">
          {SEGMENTS.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span
                className={`inline-block size-3 rounded-sm ${s.className}`}
              />
              {s.label}
            </span>
          ))}
        </div>
        {BY_KIND.map(([kind, ...counts]) => {
          const total = counts.reduce((a, b) => a + b, 0);

          return (
            <div key={kind} className="flex items-center gap-3 text-sm">
              <span className="w-20 shrink-0 opacity-80">{kind}</span>
              <div className="flex h-5 flex-1 overflow-hidden rounded">
                {counts.map((n, i) =>
                  n > 0 ? (
                    <div
                      key={SEGMENTS[i].label}
                      className={`${SEGMENTS[i].className} flex items-center justify-center text-[11px] font-bold text-black/70`}
                      style={{ width: `${(n / total) * 100}%` }}
                      title={`${SEGMENTS[i].label} ${n}장`}
                    >
                      {n / total >= 0.08 ? n : ""}
                    </div>
                  ) : null,
                )}
              </div>
              <span className="w-10 shrink-0 text-right text-xs opacity-60">
                {total}장
              </span>
            </div>
          );
        })}
      </div>

      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm opacity-75">
        <li>
          은하수·어안·별 궤적처럼 일반인 사진에 흔한 사진에서 차이가 커요.
          Astrometry.net은 원형 어안 사진을 하나도 풀지 못했어요.
        </li>
        <li>
          Astrometry.net이 푼 243장 중 226장을 이 사이트도 풀었어요.
          Astrometry.net만 푼 17장은 은하수 띠 속 밝은 별을 별로 보지 못했거나,
          시야가 좁아 밝은 별이 몇 개 없는 사진이 많았어요. 다음에 고칠
          곳이에요.
        </li>
        <li>
          별 동호회 카페에 올라온 휴대폰 사진 37장에서는 이 사이트가 29장,
          Astrometry.net이 23장을 풀었어요.
        </li>
        <li>
          두 답이 크게 다른 사진이 1장 있었는데, 별을 겹쳐 보니 Astrometry.net의
          답이 틀렸어요.
        </li>
      </ul>
      <p className="text-xs opacity-55">
        조건: 이 사이트는 브라우저와 같은 풀이에 8초 상한, Astrometry.net은 내
        컴퓨터에 설치한 판(0.97)에 넓은 화각용 별 색인(4110~4119)과 사진 한 장에
        2분을 줬어요. 웹 서비스(nova.astrometry.net)는 색인이 더 많아 좁은 화각
        사진은 더 잘 풀 수 있어요. 사진은 가로 1,920px로 줄인 것이에요
        (2026-10-29).
      </p>
    </div>
  );
}
