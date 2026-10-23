import BasicsArticle from "@/learn/basics/BasicsArticle";
import SeasonSunDemo from "@/learn/basics/SeasonSunDemo";
import {
  dayLengthHours,
  noonSunAltitudeDeg,
  OBLIQUITY_J2000_DEG,
  SEOUL,
} from "@/learn/basics/skyMath";
import { basicsMetadata } from "@/learn/basics/topics";
import { Figure, LearnSection } from "@/learn/LearnArticle";
import { Callout, DataTable } from "@/learn/parts";

export const metadata = basicsMetadata("earth-tilt");

const hm = (h: number) => {
  const m = Math.round(h * 60);

  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
};

const ROWS = [
  { label: "하지 (6월 21일 무렵)", dec: OBLIQUITY_J2000_DEG },
  { label: "춘분·추분 (3월 20일, 9월 23일 무렵)", dec: 0 },
  { label: "동지 (12월 22일 무렵)", dec: -OBLIQUITY_J2000_DEG },
];

export default function Page() {
  return (
    <BasicsArticle
      slug="earth-tilt"
      lead="지구의 자전축은 공전 궤도면에 대해 23.4° 기울어 있어요. 그래서 해가 하늘에서 지나는 길(황도)이 천구 적도와 23.4° 어긋나고, 해의 높이와 낮의 길이가 계절마다 달라져요."
    >
      <Figure caption="장소를 고르고 날짜를 옮겨 보세요. 노란 곡선이 한 해 동안 해의 적위예요.">
        <SeasonSunDemo />
      </Figure>

      <LearnSection title="황도: 해가 별 사이를 지나는 길">
        <p>
          지구가 공전하면 지구에서 본 해는 별들 사이를 하루 약 1°씩 동쪽으로
          옮겨 가 1년에 한 바퀴를 돌아요. 이 길이 <b>황도</b>예요. 지구의
          적도면과 공전면이 23.4° 기울어 있으니, 황도도 천구 적도와 23.4° 기울어
          있어요.
        </p>
        <p>
          그래서 해의 적위는 한 해 동안 +23.4°(하지)와 −23.4°(동지) 사이를
          오가요. 황도와 천구 적도가 만나는 두 점이 춘분점·추분점이고, 춘분점은
          적경을 세는 기준이에요.
        </p>
      </LearnSection>

      <LearnSection title="계절은 해의 높이 때문">
        <p>
          해의 적위가 바뀌면 같은 장소에서도 정오의 해 높이와 낮의 길이가
          바뀌어요. 해가 높을수록 같은 햇빛이 좁은 땅에 몰려 땅이 더 데워지고,
          낮이 길수록 오래 데워져요. 서울에서 계산해 보면 이래요.
        </p>
        <DataTable
          head={["날", "정오의 해 높이", "낮의 길이"]}
          rows={ROWS.map((r) => [
            r.label,
            `${noonSunAltitudeDeg(SEOUL.latDeg, r.dec).toFixed(0)}°`,
            hm(dayLengthHours(SEOUL.latDeg, r.dec)),
          ])}
        />
        <Callout kind="lesson" title="거리 때문이 아니에요">
          <p>
            지구가 해에 가장 가까운 때(근일점)는 1월 초예요. 북반구가 한겨울일
            때 해에 가장 가까워요. 가장 멀 때와의 거리 차이는 3% 남짓이라 계절을
            만들 만큼 크지 않아요. 남반구와 북반구의 계절이 반대인 것도 기울기
            때문이에요.
          </p>
        </Callout>
      </LearnSection>

      <LearnSection title="달과 행성도 황도 가까이">
        <p>
          행성들의 공전면은 지구 공전면과 몇 도밖에 기울지 않아서, 행성은 늘
          황도 근처에서 보여요. 달의 궤도는 황도와 약 5° 기울어 있어서, 삭·망이
          달이 황도를 지나는 자리(교점) 근처에서 일어날 때만 일식·월식이 생겨요.
          플레이트 솔버가 사진에 해·달·행성을 그릴 때도 이 궤도를 계산해요.
        </p>
      </LearnSection>

      <LearnSection title="기울어진 축이 도는 세차 운동">
        <p>
          지구 자전축은 기울기는 거의 그대로인 채, 팽이처럼 약 2만 6천 년에 한
          바퀴 원을 그리며 돌아요(세차 운동). 그래서 천구의 북극이 별 사이를
          천천히 옮겨 가요.
        </p>
        <ul className="list-disc pl-5">
          <li>
            지금은 북극성 근처지만, 피라미드를 쌓던 무렵에는 용자리 투반이, 1만
            2천 년쯤 뒤에는 직녀성이 북극 가까이 와요.
          </li>
          <li>
            춘분점도 황도를 따라 1년에 약 50″(72년에 1°)씩 움직여요. 그래서
            2천여 년 전에 정한 점성술의 별자리 날짜와, 지금 생일에 해가 실제로
            있는 별자리가 한 칸쯤 어긋나요.
          </li>
          <li>
            기울기 자체도 약 4만 1천 년 주기로 22.1°~24.5° 사이를 천천히 오가요.
            지금 값은 약 {OBLIQUITY_J2000_DEG.toFixed(2)}°예요.
          </li>
        </ul>
      </LearnSection>
    </BasicsArticle>
  );
}
