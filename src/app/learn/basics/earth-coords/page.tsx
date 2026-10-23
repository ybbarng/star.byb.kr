import BasicsArticle from "@/learn/basics/BasicsArticle";
import EarthCoordsDemo from "@/learn/basics/EarthCoordsDemo";
import {
  clockLabel,
  KM_PER_DEG_LAT,
  kmPerDegLon,
  meanSolarNoonMinutes,
  SEOUL,
} from "@/learn/basics/skyMath";
import { basicsMetadata } from "@/learn/basics/topics";
import { Figure, LearnSection, Stat } from "@/learn/LearnArticle";
import { Callout } from "@/learn/parts";

export const metadata = basicsMetadata("earth-coords");

export default function Page() {
  const seoulNoon = meanSolarNoonMinutes(SEOUL.lonDeg, 9);

  return (
    <BasicsArticle
      slug="earth-coords"
      lead="지구 위 한 점은 숫자 두 개로 정해져요. 적도에서 몇 도 올라왔나(위도), 기준선에서 동서로 몇 도 돌아왔나(경도). 하늘의 좌표도, 사진을 찍은 곳 찾기도 모두 이 두 숫자에서 시작해요."
    >
      <Figure caption="지도를 눌러 보세요. 끌어서 옮기고 +·−로 확대해요.">
        <EarthCoordsDemo />
      </Figure>

      <LearnSection title="위도: 적도에서 잰 각도">
        <p>
          지구 중심에서 볼 때 그곳이 적도면에서 몇 도 위(북위) 또는 아래(남위)에
          있는지가 위도예요. 적도가 0°, 북극이 90°N, 남극이 90°S예요. 지구가
          거의 공 모양이라 위도 1°는 어디서나 약{" "}
          <b>{KM_PER_DEG_LAT.toFixed(0)}km</b>예요.
        </p>
        <p>
          위도에는 하늘과 바로 이어지는 성질이 있어요.{" "}
          <b>천구의 북극(북극성 근처)은 지평선에서 위도만큼 떠 있어요.</b>{" "}
          서울(북위 {SEOUL.latDeg.toFixed(1)}°)에서는 북극성이 약 38° 높이에
          보여요. 옛 선원들이 위도를 잰 방법이고, 플레이트 솔버가 지평선으로
          위도를 구하는 방법이기도 해요.
        </p>
      </LearnSection>

      <LearnSection title="경도: 정해서 쓰는 기준선">
        <p>
          경도는 북극과 남극을 잇는 반원(자오선)이 기준선에서 동서로 몇 도
          떨어졌는지예요. 적도와 달리 경도에는 자연스러운 0°가 없어서, 1884년
          국제 회의에서 영국 그리니치 천문대를 지나는 자오선을 0°로 정했어요.
          동쪽으로 180°(동경), 서쪽으로 180°(서경)까지 가요.
        </p>
        <p>
          자오선은 극에서 모이니 경도 1°의 길이는 위도에 따라 달라요. 적도에서는
          약 {kmPerDegLon(0).toFixed(0)}km, 서울에서는 약{" "}
          {kmPerDegLon(SEOUL.latDeg).toFixed(0)}km, 극에서는 0이에요.
        </p>
      </LearnSection>

      <LearnSection title="경도는 곧 시각">
        <p>
          지구는 한 시간에 15°씩 서쪽에서 동쪽으로 돌아요. 그래서 경도가 15°
          다르면 해가 남쪽 하늘 가장 높이 오는 때(남중)가 한 시간 달라요. 경도
          1°는 4분이에요.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Stat value="15° = 1시간" label="지구가 도는 빠르기" />
          <Stat value="1° = 4분" label="경도 1°만큼의 시각 차이" />
        </div>
        <p>
          한국 표준시는 동경 135°를 기준으로 하지만 서울은 동경{" "}
          {SEOUL.lonDeg.toFixed(0)}°라 8°쯤 서쪽이에요. 그래서 서울의 평균 해는
          정오가 아니라 약 <b>{clockLabel(seoulNoon)}</b>에 남중해요 (날마다
          해가 앞서고 늦는 균시차, 최대 약 16분은 뺐어요).
        </p>
        <Callout kind="found" title="하늘에서 경도를 읽으려면 시계가 필요해요">
          <p>
            위도는 하늘만 보고도 알 수 있지만, 경도는 &ldquo;지금 그리니치는 몇
            시인가&rdquo;를 알아야 구할 수 있어요. 같은 하늘이 경도마다 다른
            시각에 오기 때문이에요. 이 이야기는 「선원들은 어떻게 위치를
            찾았나」에서 이어져요.
          </p>
        </Callout>
      </LearnSection>
    </BasicsArticle>
  );
}
