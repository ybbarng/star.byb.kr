import BasicsArticle from "@/learn/basics/BasicsArticle";
import {
  ALL_HISTOGRAM,
  HOT_HISTOGRAM,
  HOT_MAG_LIMIT,
  HEXAGON,
  HOT_MIN_KELVIN,
  MAG_LIMITS,
  MIN_ALT_DEG,
  MONTHLY,
  REGIONS,
  SEASON_AVERAGES,
  VISIBLE,
} from "@/learn/basics/brightSeasons";
import {
  dayLengthHours,
  galacticToVector,
  OBLIQUITY_J2000_DEG,
  SEOUL,
} from "@/learn/basics/skyMath";
import { basicsMetadata } from "@/learn/basics/topics";
import { Figure, LearnSection } from "@/learn/LearnArticle";
import { BarChart, Callout, DataTable } from "@/learn/parts";
import { constellationAt } from "@/search/utils/constellationBounds";

export const metadata = basicsMetadata("winter-stars");

const [M1, M2] = MAG_LIMITS;

const hm = (h: number) => {
  const m = Math.round(h * 60);

  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
};

const BIN = 360 / HOT_HISTOGRAM.length;

export default function Page() {
  const winterRegion = REGIONS.find((r) => r.season === "겨울")!;

  return (
    <BasicsArticle
      slug="winter-stars"
      lead="&ldquo;겨울 하늘은 별이 유난히 밝다&rdquo;는 말, 정말일까요? 이 사이트의 별 지도로 서울 하늘의 밝은 별을 직접 세어 봤어요. 결론부터: 밝은 별이 겨울 별자리 자리에 몰려 있는 건 맞아요. 다만 '저녁에 떠 있는 수'로 세면 봄도 겨울만큼 많아요."
    >
      <LearnSection title="① 저녁 9시에 떠 있는 밝은 별 수">
        <p>
          달마다 15일 저녁 9시(한국 시각), 서울에서 고도 {MIN_ALT_DEG}° 위에 떠
          있는 별을 셌어요. 쌍성처럼 맨눈에 하나로 보이는 별은 하나로 셌어요.
        </p>
        <Figure
          caption={`계절 평균 (석 달 평균). 위: ${M1}등급보다 밝은 별, 아래: ${M2}등급보다 밝은 별`}
        >
          <BarChart
            items={SEASON_AVERAGES.map((s) => ({
              label: s.label,
              value: s.averages[0],
              highlight: s.key === "winter",
            }))}
            format={(v) => `${v.toFixed(1)}개`}
          />
          <BarChart
            items={SEASON_AVERAGES.map((s) => ({
              label: s.label,
              value: s.averages[1],
              highlight: s.key === "winter",
            }))}
            format={(v) => `${v.toFixed(1)}개`}
          />
        </Figure>
        <DataTable
          head={["달", `${M1}등급까지`, `${M2}등급까지`]}
          rows={MONTHLY.map((m) => [`${m.month}월`, ...m.counts.map(String)])}
        />
        <p>
          겨울(12·1·2월)과 봄(3·4·5월) 저녁이 비슷하게 많고, 여름·가을 저녁은 그
          절반쯤이에요. 봄 저녁에 많은 건 서쪽 하늘에 아직 겨울 별들이 남아
          있고, 동쪽에서 봄의 아크투루스·스피카·레굴루스가 올라오기 때문이에요.
        </p>
      </LearnSection>

      <LearnSection title="② 그 계절 별자리 자리에 있는 밝은 별">
        <p>
          그래서 이번에는 &ldquo;그 계절 별자리&rdquo;의 자리만 셌어요. 계절
          가운데 달(1·4·7·10월) 15일 저녁 9시에 남쪽 자오선을 지나는 적경에서
          동서로 3시간(45°) 안에 있고, 서울에서 {MIN_ALT_DEG}° 넘게 뜰 수 있는
          별이에요.
        </p>
        <DataTable
          head={["계절", `${M1}등급까지`, `${M2}등급까지`]}
          rows={REGIONS.map((r) => [
            r.season,
            `${r.stars[0].length}개 (${r.stars[0].map((s) => s.name).join(", ")})`,
            `${r.stars[1].length}개`,
          ])}
          highlight={[0]}
        />
        <p>
          이렇게 세면 겨울이 뚜렷하게 많아요. 서울에서 보이는 {M1}등급보다 밝은
          별 {VISIBLE.length}개 가운데 {HEXAGON.length}개가 오리온자리 둘레(적경
          4.5h~8h)에 있어요. 시리우스·카펠라·리겔·베텔게우스·알데바란·아다라에,
          조금 동쪽의 프로키온·폴룩스까지예요. 이 중 일곱이 &lsquo;겨울의
          대육각형&rsquo;을 이뤄요. {M2}등급까지 넓히면 겨울 자리에{" "}
          {winterRegion.stars[1].length}개로, 다른 계절의 두 배 남짓이에요.
        </p>
      </LearnSection>

      <LearnSection title="③ 왜 겨울 쪽에 밝은 별이 몰렸을까">
        <p>
          서울의 겨울 저녁 하늘은 우리은하 중심의 반대쪽, 원반 바깥을 보는
          방향이에요. 여름 저녁 하늘은 은하 중심 쪽을 봐요. 그런데 밝은 별은
          오히려 겨울 쪽에 많아요. 두 가지 이유가 겹쳐요.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <b>가까이 있는 젊고 뜨거운 별 무리(굴드대)</b>: 해 둘레 수백~천여
            광년 안에는 젊고 뜨거운 별들이 은하면에서 약 20° 기운 띠를 이루어
            모여 있어요. 이 띠는 한쪽에서 오리온·황소·큰개자리를, 반대쪽에서
            전갈·센타우루스자리를 지나요. 리겔·베텔게우스·오리온 허리띠 같은
            겨울 별들이 이 무리에 속해요.
          </li>
          <li>
            <b>원래 가까운 밝은 별</b>: 시리우스(8.7광년)와 프로키온(11.3광년)은
            해와 아주 가까운 별이라 밝게 보여요. 겨울 하늘에 둘이 다 있어요.
          </li>
        </ul>
        <Figure
          caption={`온 하늘의 뜨거운 별(표면 ${HOT_MIN_KELVIN.toLocaleString("ko-KR")}K 이상, ${HOT_MAG_LIMIT}등급까지)을 은하 경도 ${BIN}°마다 센 수. 괄호 안은 그 칸 가운데의 은하 적도가 지나는 별자리예요. 남반구 하늘도 포함해요.`}
        >
          <BarChart
            items={HOT_HISTOGRAM.map((n, i) => ({
              label: `${i * BIN}~${(i + 1) * BIN}° (${constellationAt(galacticToVector((i + 0.5) * BIN, 0))})`,
              value: n,
              note: `3등급까지 전체 ${ALL_HISTOGRAM[i]}개`,
              highlight: i * BIN === 180 || i * BIN >= 300,
            }))}
            format={(v) => `${v}개`}
          />
        </Figure>
        <p>
          뜨거운 별은 은하 경도 180~210°(오리온·황소 쪽)와 300~360°(센타우루스·
          전갈 쪽)에 몰려 있어요. 굴드대가 지나는 두 곳이에요. 그중 오리온 쪽이
          서울의 겨울 하늘이에요. 전갈·센타우루스 쪽 상당수는 남쪽 하늘 낮은
          곳이라 서울에서는 잘 보이지 않아요.
        </p>
        <Callout
          kind="found"
          title="여름은 별 &lsquo;수&rsquo;, 겨울은 밝은 별"
        >
          <p>
            은하 중심 쪽을 보는 여름 하늘에는 별이 훨씬 많아서 은하수가 굵고
            밝아요. 하지만 중심 쪽 별빛 대부분은 원반의 먼지에 가려 우리에게
            어둡게 와요. 그래서 은하수의 뿌연 빛은 여름이 풍성하고, 하나하나
            눈에 띄는 밝은 별은 겨울에 몰려 있어요.
          </p>
        </Callout>
      </LearnSection>

      <LearnSection title="④ 공기의 몫은 따로">
        <p>
          위 숫자는 별 지도만으로 센 것이라 날씨와 상관없어요. 실제로 보이는
          밝기에는 공기도 끼어들어요.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            우리나라의 겨울은 대륙에서 오는 차고 마른 공기 덕분에 수증기와 뿌연
            기운이 적어 맑은 밤이 많은 편이고, 여름은 장마와 높은 습도로 흐린
            밤이 많은 편이에요. 지역과 해마다 다르지만, 겨울 별이 &lsquo;더
            또렷해 보인다&rsquo;는 느낌에는 이 차이가 보태져요.
          </li>
          <li>
            겨울에는 위쪽 공기의 흐름이 거세서 별이 더 많이 반짝이기도 해요.
            반짝임은 별을 더 밝게 만들지는 않아요.
          </li>
          <li>
            밤도 길어요. 서울에서 해가 진 동안이 동지에는 약{" "}
            {hm(24 - dayLengthHours(SEOUL.latDeg, -OBLIQUITY_J2000_DEG))},
            하지에는 약{" "}
            {hm(24 - dayLengthHours(SEOUL.latDeg, OBLIQUITY_J2000_DEG))}이에요.
          </li>
        </ul>
        <p className="text-xs opacity-60">
          별 지도는 예일 밝은 별 목록(BSC5)의 5등급까지 별이에요. 북쪽왕관자리
          T(HR 5958)는 폭발했을 때의 밝기(2등급)로 실려 있지만 평소에는 10등급
          남짓이라 별 지도에서 뺐어요. 표면 온도는 그 목록 자료에 실린 색온도
          어림값이에요.
        </p>
      </LearnSection>
    </BasicsArticle>
  );
}
