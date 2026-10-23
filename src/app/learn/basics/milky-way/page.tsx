import BasicsArticle from "@/learn/basics/BasicsArticle";
import MilkyWayDemo from "@/learn/basics/MilkyWayDemo";
import {
  GALACTIC_CENTER,
  GALACTIC_NORTH_POLE,
  GALACTIC_TILT_DEG,
  maxAltitudeDeg,
  SEOUL,
} from "@/learn/basics/skyMath";
import { basicsMetadata } from "@/learn/basics/topics";
import { Figure, LearnSection, Stat } from "@/learn/LearnArticle";
import { Callout, DataTable } from "@/learn/parts";

export const metadata = basicsMetadata("milky-way");

export default function Page() {
  return (
    <BasicsArticle
      slug="milky-way"
      lead="은하수는 우리가 사는 은하(우리은하)의 원반을 안에서 옆으로 본 모습이에요. 그 원반은 지구의 적도와도, 해가 지나는 황도와도 크게 기울어 있어서, 은하수는 계절마다 하늘의 전혀 다른 자리를 지나요."
    >
      <div className="grid grid-cols-2 gap-3">
        <Stat
          value={`${GALACTIC_TILT_DEG.toFixed(1)}°`}
          label="은하면과 천구 적도가 이루는 각"
        />
        <Stat value="약 60.2°" label="은하면과 황도가 이루는 각" />
      </div>

      <Figure caption="계절과 시각을 바꿔 보세요. 은하수(보라색 띠)가 하늘을 가로지르는 자리가 크게 바뀌어요.">
        <MilkyWayDemo />
      </Figure>

      <LearnSection title="원반 안에서 본 원반">
        <p>
          우리은하는 별 수천억 개가 납작한 원반 모양으로 모여 있고, 해는
          중심에서 약 2만 6천 광년 떨어진 원반 안쪽에 있어요. 원반 안에서 보면
          원반 방향으로는 별이 겹겹이 쌓여 뿌연 띠로 보이고, 원반 위아래로는
          별이 드물어요. 그 띠의 한가운데 선을 <b>은하 적도</b>라 하고, 은하
          적도를 기준으로 잰 좌표가 은하 좌표예요.
        </p>
        <p>
          지구의 자전축과 공전면은 은하와 아무 상관 없이 정해졌어요. 그래서
          은하면은 천구 적도와 {GALACTIC_TILT_DEG.toFixed(1)}°, 황도와 약 60°나
          기울어 있어요.
        </p>
      </LearnSection>

      <LearnSection title="세 개의 이정표">
        <DataTable
          head={["", "적경·적위 (2000년)", "별자리"]}
          rows={[
            [
              "은하 중심",
              `${(GALACTIC_CENTER.raDeg / 15).toFixed(2)}h, ${GALACTIC_CENTER.decDeg.toFixed(1)}°`,
              "궁수자리",
            ],
            [
              "은하 중심의 반대쪽",
              `${((GALACTIC_CENTER.raDeg - 180) / 15).toFixed(2)}h, +${(-GALACTIC_CENTER.decDeg).toFixed(1)}°`,
              "마차부자리 (황소자리 뿔 끝 엘나트 근처)",
            ],
            [
              "은하 북극",
              `${(GALACTIC_NORTH_POLE.raDeg / 15).toFixed(2)}h, +${GALACTIC_NORTH_POLE.decDeg.toFixed(1)}°`,
              "머리털자리",
            ],
          ]}
        />
        <p className="text-xs opacity-60">
          별자리는 IAU 별자리 경계로 계산했어요. 은하 중심의 반대쪽은 마차부자리
          안이지만 황소자리와의 경계에 가까워요.
        </p>
      </LearnSection>

      <LearnSection title="계절마다 다른 은하수 (서울 저녁 9시)">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <b>여름(8월)</b>: 은하 중심이 정남쪽에 떠요. 하지만 적위가 −29°라
            서울에서는 가장 높아도 약{" "}
            {maxAltitudeDeg(SEOUL.latDeg, GALACTIC_CENTER.decDeg).toFixed(0)}°
            예요. 남쪽 낮은 궁수자리에서 독수리자리를 지나 머리 위 백조자리까지
            은하수가 남북으로 솟아요. 은하수가 가장 밝고 굵은 계절이에요.
          </li>
          <li>
            <b>가을(10월)</b>: 은하수가 남서에서 머리 위 백조·카시오페이아를
            지나 북동으로 하늘을 가로질러요.
          </li>
          <li>
            <b>겨울(1월)</b>: 은하 중심의 반대쪽이 동쪽 높이(약 68°) 떠요.
            카시오페이아·페르세우스·마차부에서 오리온 동쪽을 지나 큰개자리로
            은하수가 흐르지만, 은하 바깥쪽을 보는 방향이라 여름보다 훨씬 흐려요.
          </li>
          <li>
            <b>봄(4월)</b>: 은하 북극이 높이(약 53°) 떠요. 은하수는 지평선을
            따라 낮게 깔려 거의 보이지 않아요. 대신 원반 밖을 내다보는 방향이라
            처녀자리·머리털자리 쪽에 먼 은하들이 많이 모여 있어요.
          </li>
        </ul>
        <Callout kind="found" title="은하 중심은 먼지 뒤에">
          <p>
            은하 중심 쪽에는 별이 가장 많지만, 원반에 깔린 먼지가 그 빛을 거의
            가려요. 맨눈으로 보는 여름 은하수의 밝은 덩어리(궁수·방패자리
            별구름)는 먼지가 엷은 틈으로 비쳐 보이는 별 무리이고, 백조자리에서
            궁수자리까지 은하수를 둘로 가르는 검은 줄도 먼지예요. 은하 중심
            자체는 적외선·전파로 봐야 보여요.
          </p>
        </Callout>
      </LearnSection>
    </BasicsArticle>
  );
}
