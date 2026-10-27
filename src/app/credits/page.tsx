import type { Metadata } from "next";
import Link from "next/link";
import { License } from "@/plate-solver/SampleCredits";
import samples from "@/services/samples";
import SiteShell from "@/ui/SiteShell";

export const metadata: Metadata = {
  title: "출처와 참고 자료",
  description:
    "star.byb.kr이 참고한 논문, 별 목록·별자리 데이터, 해·달·행성 계산 자료, 샘플 사진의 출처",
};

// 출처와 참고 자료: 흩어져 있던 출처(첫 화면 꼬리말, 샘플 사진 출처 목록, README)와 테크 블로그 글의
// 참고 자료를 한곳에. 위키미디어 샘플 목록은 samples.ts에서 바로 만들어 샘플이 바뀌면 함께 바뀐다.

interface Ref {
  text: React.ReactNode;
  note?: string;
}

const link = (href: string, label: React.ReactNode) => (
  <a
    className="link link-hover"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
  >
    {label}
  </a>
);

const PAPERS: Ref[] = [
  {
    text: (
      <>
        Lang, D., Hogg, D. W., Mierle, K., Blanton, M., & Roweis, S. (2010).
        Astrometry.net: Blind astrometric calibration of arbitrary astronomical
        images. <i>The Astronomical Journal</i>, 139(5), 1782–1800.{" "}
        {link("https://arxiv.org/abs/0910.2233", "arXiv:0910.2233")}
      </>
    ),
    note: "별 넷의 모양으로 만든 지문(quad), 우연일 확률로 판정하기",
  },
  {
    text: (
      <>
        Górski, K. M., et al. (2005). HEALPix: A Framework for High-Resolution
        Discretization and Fast Analysis of Data Distributed on the Sphere.{" "}
        <i>The Astrophysical Journal</i>, 622(2), 759–771.{" "}
        {link(
          "https://arxiv.org/abs/astro-ph/0409513",
          "arXiv:astro-ph/0409513",
        )}
      </>
    ),
    note: "하늘을 같은 넓이의 칸으로 나누기",
  },
  {
    text: (
      <>
        Bentley, J. L. (1975). Multidimensional binary search trees used for
        associative searching. <i>Communications of the ACM</i>, 18(9), 509–517.
      </>
    ),
    note: "지문을 빠르게 찾는 KD-tree",
  },
];

const DATA: Ref[] = [
  {
    text: (
      <>
        Hoffleit, D., & Warren, W. H. Jr. (1991). The Bright Star Catalogue, 5th
        Revised Edition.{" "}
        {link("https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50", "VizieR V/50")}
      </>
    ),
    note: "별 목록 (맨눈에 보이는 5등급까지 1,624개)",
  },
  {
    text: (
      <>
        Olaf Frohn,{" "}
        {link("https://github.com/ofrohn/d3-celestial", "d3-celestial")} (BSD
        라이선스)
      </>
    ),
    note: "별자리선과 별자리 경계 (IAU)",
  },
];

const EPHEMERIS: Ref[] = [
  {
    text: (
      <>
        Meeus, J. (1998). <i>Astronomical Algorithms</i> (2nd ed.).
        Willmann-Bell.
      </>
    ),
    note: "항성시 등 계산 확인",
  },
  { text: "The Astronomical Almanac의 해·달 저정밀 공식" },
  {
    text: (
      <>
        Standish, E. M.{" "}
        {link(
          "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
          "Keplerian Elements for Approximate Positions of the Major Planets",
        )}
        . JPL.
      </>
    ),
    note: "행성 위치",
  },
  {
    text: link("https://ssd.jpl.nasa.gov/horizons/", "JPL Horizons"),
    note: "계산 결과 확인",
  },
];

function RefList({ items }: { items: Ref[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((r, i) => (
        <li key={i} className="flex flex-col gap-0.5">
          <span className="text-sm leading-relaxed">{r.text}</span>
          {r.note && <span className="text-xs opacity-60">— {r.note}</span>}
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-base-200/70 rounded-box flex flex-col gap-4 p-5 backdrop-blur md:p-6">
      <h2 className="text-xl font-black">{title}</h2>
      {children}
    </section>
  );
}

export default function Page() {
  const credited = samples.filter((s) => s.credit);

  return (
    <SiteShell>
      <div className="flex w-full max-w-3xl flex-col gap-6 pb-16">
        <header className="fx-rise mt-4 flex flex-col items-center gap-3 text-center">
          <h1 className="bg-gradient-to-b from-white via-indigo-100 to-indigo-300 bg-clip-text text-4xl leading-tight font-black text-transparent md:text-5xl">
            출처와 참고 자료
          </h1>
          <p className="max-w-2xl opacity-75">
            star.byb.kr을 만들며 참고한 논문과 자료, 샘플 사진의 출처예요.
            풀이의 아이디어는 {link("https://astrometry.net", "Astrometry.net")}
            에서 왔어요.
          </p>
        </header>

        <Section title="논문">
          <RefList items={PAPERS} />
        </Section>

        <Section title="별 목록과 별자리">
          <RefList items={DATA} />
        </Section>

        <Section title="해·달·행성 계산">
          <RefList items={EPHEMERIS} />
        </Section>

        <Section title="샘플 사진">
          <p className="text-sm leading-relaxed">
            만든 사람(옐로나이프 오로라)과 버즈빌 동료들(사이판 Jarrod, 서울
            근처 산 Berry, 오로라 Carl, 호주·여름 여행 Nike)이 찍은 사진, 그리고
            위키미디어 공용의 자유 이용 사진 {credited.length}장이에요.
            위키미디어 사진은 모두 크기를 줄여 실었어요.
          </p>
          <ul className="flex flex-col gap-1.5 text-sm break-words">
            {credited.map((s) => (
              <li key={s.src}>
                <span className="font-bold">{s.title}</span> ·{" "}
                {link(s.credit!.sourceUrl, s.credit!.author)} ·{" "}
                <License credit={s.credit!} />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="만든 사람">
          <p className="text-sm leading-relaxed">
            {link("https://github.com/ybbarng", "ybbarng")}이{" "}
            {link("https://www.claude.com/product/claude-code", "Claude Code")}
            와 함께 만들었어요. 코드는{" "}
            {link(
              "https://github.com/ybbarng/star.byb.kr",
              "github.com/ybbarng/star.byb.kr",
            )}
            에 있어요.
          </p>
        </Section>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/learn" className="btn btn-ghost">
            찾는 원리 보기
          </Link>
          <Link href="/plate-solver" className="btn btn-primary">
            사진으로 찾기
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
