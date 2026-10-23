import BasicsArticle from "@/learn/basics/BasicsArticle";
import LongitudeErrorDemo from "@/learn/basics/LongitudeErrorDemo";
import { moonHourlyMotionDeg } from "@/learn/basics/skyMath";
import { basicsMetadata } from "@/learn/basics/topics";
import { Figure, LearnSection, Stat } from "@/learn/LearnArticle";
import { Callout } from "@/learn/parts";
import PoleHeightDemo from "@/learn/PoleHeightDemo";

export const metadata = basicsMetadata("navigation");

// 2026년 한 해 평균 (하루 간격)
const MOON_PER_HOUR =
  Array.from({ length: 365 }, (_, d) =>
    moonHourlyMotionDeg(new Date(Date.UTC(2026, 0, 1 + d))),
  ).reduce((a, b) => a + b, 0) / 365;

export default function Page() {
  return (
    <BasicsArticle
      slug="navigation"
      lead="망망대해에서 내 위치를 아는 방법은 하늘뿐이었어요. 위도는 별과 해의 높이로 비교적 쉽게 쟀지만, 경도는 18세기 후반까지 풀리지 않은 큰 문제였어요. 답은 '정확한 시계'였고, 이 사이트의 '어디서 찍었을까?'도 같은 방법을 써요."
    >
      <LearnSection title="위도: 북극성의 높이">
        <p>
          천구의 북극은 지평선에서 위도만큼 떠 있어요. 북극성은 천구의 북극에서
          1°도 안 떨어져 있어서(지금 약 0.6°), 북극성의 높이가 곧 그곳의
          위도예요. 북반구 선원들은 밤마다 북극성 높이를 재서 위도를 알았어요.
        </p>
        <Figure caption="위도를 바꿔 보세요. 천구의 북극이 지평선에서 위도만큼 떠 있어요.">
          <PoleHeightDemo />
        </Figure>
      </LearnSection>

      <LearnSection title="위도: 한낮의 해">
        <p>
          낮에는 해를 써요. 해가 가장 높이 오는 정오에 해의 높이 h를 재고, 그날
          해의 적위 δ(항해력에 날짜별로 적혀 있어요)를 찾아{" "}
          <b>위도 = 90° − h + δ</b>로 계산해요(해가 남쪽에 있을 때). 18세기에
          나온 육분의(섹스턴트)는 흔들리는 배 위에서도 수평선과 해 사이의 각을
          1′(60분의 1도) 가까이 잴 수 있었어요.
        </p>
        <p>
          그림자 시계 놀이의 &ldquo;정오 그림자 길이 → 해 높이 → 위도&rdquo;가
          바로 이 방법이에요.
        </p>
      </LearnSection>

      <LearnSection title="경도: 시계가 문제였다">
        <p>
          하늘은 한 시간에 15°씩 돌아요. 그래서 &ldquo;여기서 해가 남중한 순간,
          출발한 항구(기준 경도)는 몇 시인가&rdquo;를 알면 경도를 알 수 있어요.
          한 시간 차이면 15°, 4분 차이면 1°예요. 문제는 몇 주씩 흔들리고 덥고
          추운 바다 위에서 기준 시각을 지켜 줄 시계가 없었다는 거예요.
        </p>
        <Figure caption="기준 시계가 틀린 만큼 경도가 틀려요.">
          <LongitudeErrorDemo />
        </Figure>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            value="1714년"
            label="영국 경도법: 경도를 0.5° 안으로 재는 방법에 최대 상금 2만 파운드"
          />
          <Stat
            value="2분"
            label="0.5°에 해당하는 시계 오차. 몇 주 항해 내내 지켜야 했어요"
          />
        </div>
      </LearnSection>

      <LearnSection title="두 가지 답">
        <ul className="flex list-disc flex-col gap-3 pl-5">
          <li>
            <b>항해용 시계(크로노미터)</b>: 목수 출신 시계공 존 해리슨은 평생에
            걸쳐 시계를 만들었어요. 네 번째 시계 H4는 1761~62년 자메이카까지
            가는 시험 항해에서 81일 동안 5초 남짓만 틀렸다고 전해져요.
          </li>
          <li>
            <b>달 거리법</b>: 달은 별 사이를 한 시간에 약{" "}
            {MOON_PER_HOUR.toFixed(2)}°(제 지름쯤)씩 옮겨 가요. 하늘에 걸린 시계
            바늘인 셈이에요. 달과 밝은 별 사이의 각을 육분의로 재서, 미리 계산된
            표(1767년부터 나온 영국 항해력)와 맞추면 그리니치 시각을 알 수
            있었어요. 계산이 길고, 각을 1′만 틀려도 경도가 0.5°쯤 틀렸어요.
          </li>
        </ul>
        <p>
          크로노미터가 값싸지면서 19세기에는 시계 쪽이 표준이 됐고, 지금은 GPS
          위성이 아주 정확한 원자시계로 같은 일을 해요. 위치를 아는 일은 결국
          정확한 시각을 아는 일이에요.
        </p>
      </LearnSection>

      <LearnSection title="이 사이트에서는">
        <Callout kind="found" title="어디서 찍었을까?">
          <p>
            플레이트 솔버가 사진을 풀고 지평선이 보이면, 사진 속 하늘에서 머리
            위(천정)가 어디인지 알아요. 천정의 적위가 위도예요. 북극성의 높이를
            재던 선원과 같은 일이에요.
          </p>
          <p>
            시간대까지 아는 촬영 시각이 있으면 경도도 구해요. 천정의 적경(그곳의
            항성시)에서 그 순간 그리니치의 항성시를 빼면 경도예요. 크로노미터
            대신 사진의 촬영 시각이 기준 시계 노릇을 해요. 그래서 촬영 시각이
            4분 틀리면 경도가 1° 틀려요.
          </p>
        </Callout>
        <p>
          SkyGuessr도 같은 원리예요. 별이 도는 중심의 높이로 위도를, 하늘 시계와
          세계 시계의 차이로 경도를 맞혀요.
        </p>
      </LearnSection>
    </BasicsArticle>
  );
}
