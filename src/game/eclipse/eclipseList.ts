// 실제 일식·월식 목록 (2000~2035년). 출처: NASA 일식·월식 목록 — Fred Espenak, "Five Millennium Canon of
// Solar Eclipses"·"Five Millennium Canon of Lunar Eclipses" (NASA, 퍼블릭 도메인), eclipse.gsfc.nasa.gov.
// 날짜는 식이 가장 깊은 때의 세계시(UT) 날짜다. 한국 날짜와 하루 다를 수 있다.
// 손으로 옮긴 것이라 단위 테스트(src/test/unit/eclipse.test.ts)가 우리 계산으로 하나하나 확인한다:
// 그날이 삭(일식)·망(월식)인지, 달이 교점 근처(황위가 식이 날 수 있는 범위)인지, 반대로 황위가 아주 작은
// 삭·망이 목록에서 빠지지 않았는지. 2036년 이후는 기억이 덜 확실해서 넣지 않았다.
// region은 확실히 아는 것만 적었다 (개기·금환식이 지나는 곳). 월식이 보이는 곳은 화면에서 계산한다.

export type SolarType = "total" | "annular" | "hybrid" | "partial";
export type LunarType = "total" | "partial" | "penumbral";

export type EclipseRecord =
  | {
      kind: "solar";
      date: string;
      type: SolarType;
      region?: string;
      korea?: "partial"; // 한국에서 부분식으로 보였거나 보일 일식 (테스트가 서울에서 본 해·달 거리로 확인)
    }
  | { kind: "lunar"; date: string; type: LunarType };

const S = (
  date: string,
  type: SolarType,
  region?: string,
  korea?: "partial",
): EclipseRecord => ({ kind: "solar", date, type, region, korea });

const L = (date: string, type: LunarType): EclipseRecord => ({
  kind: "lunar",
  date,
  type,
});

export const FIRST_YEAR = 2000;
export const LAST_YEAR = 2035;

export const ECLIPSES: EclipseRecord[] = [
  // 2000
  S("2000-02-05", "partial"),
  S("2000-07-01", "partial"),
  S("2000-07-31", "partial"),
  S("2000-12-25", "partial"),
  L("2000-01-21", "total"),
  L("2000-07-16", "total"),
  // 2001
  S("2001-06-21", "total", "남부 아프리카"),
  S("2001-12-14", "annular", "태평양·중앙아메리카"),
  L("2001-01-09", "total"),
  L("2001-07-05", "partial"),
  L("2001-12-30", "penumbral"),
  // 2002
  S("2002-06-10", "annular", "태평양"),
  S("2002-12-04", "total", "남부 아프리카·호주 남부"),
  L("2002-05-26", "penumbral"),
  L("2002-06-24", "penumbral"),
  L("2002-11-20", "penumbral"),
  // 2003
  S("2003-05-31", "annular", "아이슬란드·스코틀랜드 북쪽"),
  S("2003-11-23", "total", "남극"),
  L("2003-05-16", "total"),
  L("2003-11-09", "total"),
  // 2004
  S("2004-04-19", "partial"),
  S("2004-10-14", "partial"),
  L("2004-05-04", "total"),
  L("2004-10-28", "total"),
  // 2005
  S("2005-04-08", "hybrid", "남태평양·파나마·콜롬비아"),
  S("2005-10-03", "annular", "스페인·북아프리카"),
  L("2005-04-24", "penumbral"),
  L("2005-10-17", "partial"),
  // 2006
  S("2006-03-29", "total", "아프리카·튀르키예·중앙아시아"),
  S("2006-09-22", "annular", "남아메리카 북부·남대서양"),
  L("2006-03-14", "penumbral"),
  L("2006-09-07", "partial"),
  // 2007
  S("2007-03-19", "partial"),
  S("2007-09-11", "partial"),
  L("2007-03-03", "total"),
  L("2007-08-28", "total"),
  // 2008
  S("2008-02-07", "annular", "남극"),
  S("2008-08-01", "total", "캐나다 북부·시베리아·중국 서부"),
  L("2008-02-21", "total"),
  L("2008-08-16", "partial"),
  // 2009
  S("2009-01-26", "annular", "남인도양·인도네시아"),
  S("2009-07-22", "total", "인도·중국·일본 남쪽 섬", "partial"),
  L("2009-02-09", "penumbral"),
  L("2009-07-07", "penumbral"),
  L("2009-08-06", "penumbral"),
  L("2009-12-31", "partial"),
  // 2010
  S("2010-01-15", "annular", "아프리카·인도양·인도·중국"),
  S("2010-07-11", "total", "남태평양·이스터섬"),
  L("2010-06-26", "partial"),
  L("2010-12-21", "total"),
  // 2011
  S("2011-01-04", "partial"),
  S("2011-06-01", "partial"),
  S("2011-07-01", "partial"),
  S("2011-11-25", "partial"),
  L("2011-06-15", "total"),
  L("2011-12-10", "total"),
  // 2012
  S("2012-05-20", "annular", "중국 남부·일본·미국 서부", "partial"),
  S("2012-11-13", "total", "호주 북부"),
  L("2012-06-04", "partial"),
  L("2012-11-28", "penumbral"),
  // 2013
  S("2013-05-10", "annular", "호주 북부·태평양"),
  S("2013-11-03", "hybrid", "대서양·중앙아프리카"),
  L("2013-04-25", "partial"),
  L("2013-05-25", "penumbral"),
  L("2013-10-18", "penumbral"),
  // 2014
  S("2014-04-29", "annular", "남극"),
  S("2014-10-23", "partial"),
  L("2014-04-15", "total"),
  L("2014-10-08", "total"),
  // 2015
  S("2015-03-20", "total", "북대서양·페로 제도·스발바르"),
  S("2015-09-13", "partial"),
  L("2015-04-04", "total"),
  L("2015-09-28", "total"),
  // 2016
  S("2016-03-09", "total", "인도네시아·태평양", "partial"),
  S("2016-09-01", "annular", "중앙아프리카·마다가스카르"),
  L("2016-03-23", "penumbral"),
  L("2016-08-18", "penumbral"),
  L("2016-09-16", "penumbral"),
  // 2017
  S("2017-02-26", "annular", "칠레·아르헨티나·앙골라"),
  S("2017-08-21", "total", "미국"),
  L("2017-02-11", "penumbral"),
  L("2017-08-07", "partial"),
  // 2018
  S("2018-02-15", "partial"),
  S("2018-07-13", "partial"),
  S("2018-08-11", "partial"),
  L("2018-01-31", "total"),
  L("2018-07-27", "total"),
  // 2019
  S("2019-01-06", "partial", undefined, "partial"),
  S("2019-07-02", "total", "남태평양·칠레·아르헨티나"),
  S("2019-12-26", "annular", "사우디·인도 남부·싱가포르·인도네시아", "partial"),
  L("2019-01-21", "total"),
  L("2019-07-16", "partial"),
  // 2020
  S("2020-06-21", "annular", "아프리카·인도 북부·중국 남부·대만", "partial"),
  S("2020-12-14", "total", "칠레·아르헨티나"),
  L("2020-01-10", "penumbral"),
  L("2020-06-05", "penumbral"),
  L("2020-07-05", "penumbral"),
  L("2020-11-30", "penumbral"),
  // 2021
  S("2021-06-10", "annular", "캐나다·그린란드·러시아 북부"),
  S("2021-12-04", "total", "남극"),
  L("2021-05-26", "total"),
  L("2021-11-19", "partial"),
  // 2022
  S("2022-04-30", "partial"),
  S("2022-10-25", "partial"),
  L("2022-05-16", "total"),
  L("2022-11-08", "total"),
  // 2023
  S("2023-04-20", "hybrid", "호주 서부·동티모르·인도네시아"),
  S("2023-10-14", "annular", "미국 서부·중앙·남아메리카"),
  L("2023-05-05", "penumbral"),
  L("2023-10-28", "partial"),
  // 2024
  S("2024-04-08", "total", "멕시코·미국·캐나다"),
  S("2024-10-02", "annular", "남태평양·칠레·아르헨티나"),
  L("2024-03-25", "penumbral"),
  L("2024-09-18", "partial"),
  // 2025
  S("2025-03-29", "partial"),
  S("2025-09-21", "partial"),
  L("2025-03-14", "total"),
  L("2025-09-07", "total"),
  // 2026
  S("2026-02-17", "annular", "남극"),
  S("2026-08-12", "total", "그린란드·아이슬란드·스페인"),
  L("2026-03-03", "total"),
  L("2026-08-28", "partial"),
  // 2027
  S("2027-02-06", "annular", "남아메리카·대서양·서아프리카"),
  S("2027-08-02", "total", "스페인 남부·북아프리카·이집트·아라비아"),
  L("2027-02-20", "penumbral"),
  L("2027-07-18", "penumbral"),
  L("2027-08-17", "penumbral"),
  // 2028
  S("2028-01-26", "annular", "남아메리카·스페인·포르투갈"),
  S("2028-07-22", "total", "호주·뉴질랜드"),
  L("2028-01-12", "partial"),
  L("2028-07-06", "partial"),
  L("2028-12-31", "total"),
  // 2029
  S("2029-01-14", "partial"),
  S("2029-06-12", "partial"),
  S("2029-07-11", "partial"),
  S("2029-12-05", "partial"),
  L("2029-06-26", "total"),
  L("2029-12-20", "total"),
  // 2030
  S(
    "2030-06-01",
    "annular",
    "북아프리카·그리스·튀르키예·러시아·홋카이도",
    "partial",
  ),
  S("2030-11-25", "total", "남부 아프리카·호주"),
  L("2030-06-15", "partial"),
  L("2030-12-09", "penumbral"),
  // 2031
  S("2031-05-21", "annular"),
  S("2031-11-14", "hybrid"),
  L("2031-05-07", "penumbral"),
  L("2031-06-05", "penumbral"),
  L("2031-10-30", "penumbral"),
  // 2032
  S("2032-05-09", "annular"),
  S("2032-11-03", "partial"),
  L("2032-04-25", "total"),
  L("2032-10-18", "total"),
  // 2033
  S("2033-03-30", "total", "알래스카"),
  S("2033-09-23", "partial"),
  L("2033-04-14", "total"),
  L("2033-10-08", "total"),
  // 2034
  S("2034-03-20", "total", "아프리카·중동·중앙아시아"),
  S("2034-09-12", "annular"),
  L("2034-04-03", "penumbral"),
  L("2034-09-28", "partial"),
  // 2035
  S("2035-03-09", "annular"),
  S("2035-09-02", "total", "중국·북한·일본", "partial"),
  L("2035-02-22", "penumbral"),
  L("2035-08-19", "partial"),
];

export const SOLAR_TYPE_LABEL: Record<SolarType, string> = {
  total: "개기일식",
  annular: "금환일식",
  hybrid: "혼성일식(금환·개기)",
  partial: "부분일식",
};

export const LUNAR_TYPE_LABEL: Record<LunarType, string> = {
  total: "개기월식",
  partial: "부분월식",
  penumbral: "반영월식(희미함)",
};

export const typeLabel = (e: EclipseRecord) =>
  e.kind === "solar" ? SOLAR_TYPE_LABEL[e.type] : LUNAR_TYPE_LABEL[e.type];

export const eclipsesOf = (year: number) =>
  ECLIPSES.filter((e) => e.date.startsWith(`${year}-`)).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

export const YEARS = Array.from(
  { length: LAST_YEAR - FIRST_YEAR + 1 },
  (_, i) => FIRST_YEAR + i,
);
