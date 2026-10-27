import type { SampleCredit } from "@/services/samples";
import samples from "@/services/samples";

const linkClass = "link link-hover";

export function License({ credit }: { credit: SampleCredit }) {
  return credit.licenseUrl ? (
    <a
      className={linkClass}
      href={credit.licenseUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      {credit.license}
    </a>
  ) : (
    <>{credit.license}</>
  );
}

// 결과 화면 한 줄: CC BY 사진은 작가·라이선스를 밝혀야 한다
export function SampleCreditLine({ credit }: { credit: SampleCredit }) {
  return (
    <div className="text-xs opacity-60">
      사진:{" "}
      <a
        className={linkClass}
        href={credit.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {credit.author}
      </a>{" "}
      · <License credit={credit} /> · 크기를 줄여 실었어요
    </div>
  );
}

// 샘플 고르는 화면 아래: 바깥에서 가져온 샘플 사진의 출처 목록
export function SampleCreditList() {
  const credited = samples.filter((s) => s.credit);

  if (credited.length === 0) {
    return null;
  }

  return (
    <details className="text-xs opacity-70">
      <summary className="cursor-pointer text-center">
        샘플 사진 출처 ({credited.length}장, 위키미디어 공용)
      </summary>
      <ul className="mt-3 flex flex-col gap-1.5 break-words">
        {credited.map((s) => (
          <li key={s.src}>
            <span className="font-bold">{s.title}</span> ·{" "}
            <a
              className={linkClass}
              href={s.credit!.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {s.credit!.author}
            </a>{" "}
            · <License credit={s.credit!} />
          </li>
        ))}
        <li className="opacity-80">
          모두 크기를 줄여 실었어요. 나머지 샘플은 만든 사람과 버즈빌 동료들이
          찍은 사진이에요. 참고한 논문·자료까지 모은{" "}
          <a className={linkClass} href="/credits">
            출처와 참고 자료
          </a>
          도 있어요.
        </li>
      </ul>
    </details>
  );
}
