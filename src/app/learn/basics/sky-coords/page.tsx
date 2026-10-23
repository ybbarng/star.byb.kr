import BasicsArticle from "@/learn/basics/BasicsArticle";
import SkyCoordsDemo from "@/learn/basics/SkyCoordsDemo";
import { basicsMetadata } from "@/learn/basics/topics";
import { Figure, LearnSection } from "@/learn/LearnArticle";
import { Callout, DataTable } from "@/learn/parts";

export const metadata = basicsMetadata("sky-coords");

export default function Page() {
  return (
    <BasicsArticle
      slug="sky-coords"
      lead="별의 위치를 말하는 방법은 두 가지예요. 별마다 정해진 주소(적경·적위)와, 지금 여기서 고개를 어디로 돌려야 하는지(고도·방위). 둘 사이를 잇는 것이 하늘의 시계, 항성시예요."
    >
      <Figure caption="별·장소·날짜를 고르고 시각을 옮겨 보세요. 둥근 그림은 머리 위가 가운데, 가장자리가 지평선이에요 (북이 위, 동이 왼쪽 — 누워서 올려다본 모습).">
        <SkyCoordsDemo />
      </Figure>

      <LearnSection title="별의 주소: 적경과 적위">
        <p>
          지구의 위도·경도를 하늘에 그대로 비춘 것이 <b>천구 적도 좌표</b>예요.
          지구 적도를 하늘로 넓힌 원이 천구 적도, 북극 위쪽이 천구의 북극이에요.
        </p>
        <ul className="list-disc pl-5">
          <li>
            <b>적위</b>는 위도와 같아요. 천구 적도에서 북쪽으로 +, 남쪽으로 −,
            천구의 북극이 +90°예요.
          </li>
          <li>
            <b>적경</b>은 경도와 같지만, 기준이 그리니치가 아니라 봄에 해가 천구
            적도를 지나는 점(춘분점)이고, 도 대신 시간(0h~24h, 1h = 15°)으로
            세요. 하늘이 한 시간에 15°씩 도니 시간으로 세는 편이 편하거든요.
          </li>
        </ul>
        <p>
          별은 아주 멀어서 적경·적위가 거의 바뀌지 않아요. 그래서 별 지도에
          별마다 주소 하나를 적어 둘 수 있어요. 플레이트 솔버의 별 지도도 이
          주소를 화살표(3차원 단위 벡터)로 바꿔 담아요.
        </p>
      </LearnSection>

      <LearnSection title="지금 여기서: 고도와 방위">
        <p>
          밤하늘에서 실제로 별을 찾을 때는 <b>지평 좌표</b>를 써요. <b>고도</b>
          는 지평선에서 몇 도 올라갔는지(머리 위 천정이 90°), <b>방위</b>는
          북쪽에서 시계 방향으로 몇 도 돌았는지(동 90°, 남 180°, 서 270°)예요.
          같은 별이라도 장소와 시각에 따라 고도·방위가 계속 바뀌어요.
        </p>
        <DataTable
          head={["", "천구 적도 좌표", "지평 좌표"]}
          rows={[
            ["두 값", "적경·적위", "방위·고도"],
            ["기준", "천구 적도, 춘분점", "지평선, 북쪽"],
            ["바뀌나", "거의 그대로", "시각·장소마다"],
            ["쓰는 곳", "별 지도, 카탈로그", "망원경 겨누기, 별 찾기"],
          ]}
        />
      </LearnSection>

      <LearnSection title="둘을 잇는 하늘 시계: 항성시">
        <p>
          지구가 돌면 하늘 전체가 천구의 극을 축으로 돌아요. 그 순간 남북을 잇는
          선(자오선)을 지나는 적경을 <b>지방 항성시</b>라고 해요. 항성시가 5h
          55m이면 지금 베텔게우스(적경 5h 55m)가 자오선 위, 즉 그날 가장 높은
          자리에 있어요.
        </p>
        <ul className="list-disc pl-5">
          <li>
            <b>시간각 = 항성시 − 적경</b>: 별이 남중하고 몇 시간 지났는지예요.
            0이면 남중, +면 서쪽으로 기우는 중이에요.
          </li>
          <li>
            <b>가장 높이 뜰 때 고도 = 90° − |위도 − 적위|</b>: 서울(37.6°N)에서
            직녀성(+38.8°)은 거의 머리 위(89°)까지, 시리우스(−16.7°)는 36°까지
            떠요.
          </li>
          <li>
            적위가 90° − 위도보다 크면 지지 않고, 위도 − 90°보다 작으면 뜨지
            않아요. 서울에서는 적위 +52.4°보다 북쪽이 지지 않는 별이에요.
          </li>
        </ul>
        <Callout kind="found" title="플레이트 솔버가 쓰는 곳">
          <p>
            사진 속 지평선으로 머리 위(천정)가 하늘의 어디인지 찾으면, 천정의
            적위가 위도이고 천정의 적경이 그 순간의 지방 항성시예요. 촬영 시각을
            거꾸로 찾는 방법과 &lsquo;어디서 찍었을까?&rsquo;가 모두 이 관계를
            써요.
          </p>
        </Callout>
        <p className="text-xs opacity-60">
          별 지도의 적경·적위는 2000년 기준이에요. 세차 운동으로 춘분점이 1년에
          약 50″씩 움직이니 지금(2026년)과는 0.4°쯤 달라요. 그림에서는 이만큼을
          되돌려 계산했어요.
        </p>
      </LearnSection>
    </BasicsArticle>
  );
}
