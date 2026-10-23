import { STARS } from "@/game/sky/catalog";
import BasicsArticle from "@/learn/basics/BasicsArticle";
import {
  clockLabel,
  DAILY_EARLIER_SECONDS,
  hmsLabel,
  SEOUL,
  SIDEREAL_DAY_SECONDS,
  transitMinutes,
  vectorToRaDec,
} from "@/learn/basics/skyMath";
import { basicsMetadata } from "@/learn/basics/topics";
import { Figure, LearnSection, Stat } from "@/learn/LearnArticle";
import { Callout, DataTable } from "@/learn/parts";
import SameSkyOrbitDemo from "@/learn/SameSkyOrbitDemo";

export const metadata = basicsMetadata("sidereal-day");

// 베텔게우스(오리온자리 어깨)가 서울에서 남중하는 시각, 달마다 1일
const betelgeuseRa = vectorToRaDec(
  STARS.find((s) => s.latinName === "Betelgeuse")!.vector,
).raDeg;

const TRANSITS = Array.from({ length: 12 }, (_, i) => ({
  month: i + 1,
  minutes: transitMinutes(betelgeuseRa, 2026, i + 1, 1, SEOUL, 9),
}));

const NIGHT = (m: number) => m >= 19 * 60 || m <= 5 * 60;

export default function Page() {
  return (
    <BasicsArticle
      slug="sidereal-day"
      lead="시계의 하루는 24시간이지만, 별이 같은 자리로 돌아오는 데는 그보다 4분쯤 짧게 걸려요. 하루 4분이 한 달이면 2시간, 반년이면 12시간. 그래서 계절마다 저녁 하늘의 별자리가 바뀌어요."
    >
      <div className="grid grid-cols-2 gap-3">
        <Stat
          value={hmsLabel(SIDEREAL_DAY_SECONDS)}
          label="별 기준 하루 (항성일)"
        />
        <Stat
          value={hmsLabel(DAILY_EARLIER_SECONDS)}
          label="같은 별이 하루에 일찍 뜨는 시간"
        />
      </div>

      <LearnSection title="두 가지 하루">
        <p>
          <b>태양일</b>은 해가 남중했다가 다시 남중할 때까지, 우리가 쓰는
          24시간이에요. <b>항성일</b>은 먼 별이 남중했다가 다시 남중할
          때까지예요.
        </p>
        <p>
          지구는 자전하는 동안 해 둘레를 공전도 해요. 하루에 약 1°(360° ÷
          365.25일)씩 공전하니, 별 기준으로 한 바퀴(360°) 돈 뒤에도 해를 다시
          남쪽에 두려면 1°쯤 더 돌아야 해요. 지구가 1° 도는 데 4분쯤 걸리니
          태양일이 항성일보다 4분쯤 길어요. 시계는 태양일에 맞춰 두었으니,
          시계로 보면 별이 날마다 4분씩 일찍 떠요.
        </p>
      </LearnSection>

      <Figure caption="위에서 내려다본 공전과, 그때 서울에서 본 남쪽 하늘. 별은 아주 멀어서 같은 방향(평행한 화살표)을 봐야 같은 하늘이에요.">
        <SameSkyOrbitDemo />
      </Figure>

      <LearnSection title="한 달에 2시간, 계절마다 다른 별자리">
        <p>
          하루 4분이 30일 쌓이면 2시간이에요. 오리온자리 베텔게우스가 서울에서
          남중하는 시각을 달마다 1일로 계산해 보면 이래요.
        </p>
        <DataTable
          head={["날짜", "남중 시각 (한국 시각)", ""]}
          rows={TRANSITS.map((r) => [
            `${r.month}월 1일`,
            clockLabel(r.minutes),
            NIGHT(r.minutes) ? "밤에 남중" : "낮에 남중 (보이지 않아요)",
          ])}
          highlight={TRANSITS.flatMap((r, i) => (NIGHT(r.minutes) ? [i] : []))}
        />
        <p>
          그래서 오리온은 &ldquo;겨울 별자리&rdquo;예요. 겨울 저녁에 남쪽 하늘에
          높이 있고, 여름에는 해와 같은 쪽 하늘이라 낮에 떠서 보이지 않아요.
          새벽까지 기다리면 한 계절 뒤의 별자리를 미리 볼 수 있어요. 늦여름 새벽
          동쪽 하늘에 오리온이 떠오르는 것처럼요.
        </p>
        <Callout kind="found" title="같은 하늘은 날짜마다 다른 시각에 와요">
          <p>
            사진 한 장의 하늘이 어떤 별 배치인지 알아도, 그것만으로 날짜는 알 수
            없어요. 어느 날 23시에 온 하늘은 한 달 뒤에는 21시쯤, 두 달 뒤에는
            19시쯤 와요. 매일 4분씩 일찍 오기 때문이에요. 플레이트 솔버가 촬영
            시각을 거꾸로 찾을 때 &ldquo;날짜마다 시각 하나&rdquo;를 내놓는
            이유예요. 해가 떠 있는 날짜는 버리고요.
          </p>
        </Callout>
      </LearnSection>

      <LearnSection title="한 시간에 15°">
        <p>
          하늘은 항성일 한 번에 360° 돌아요. 한 시간에 약 15°예요. 별 궤적
          사진에서 궤적 호의 각도를 재면 노출 시간을 알 수 있어요. 2시간이면
          30°짜리 호가 그려져요.
        </p>
      </LearnSection>
    </BasicsArticle>
  );
}
