import FindStarsDemo from "@/learn/FindStarsDemo";
import LearnArticle, { Figure, LearnSection } from "@/learn/LearnArticle";
import { learnMetadata } from "@/learn/steps";

export const metadata = learnMetadata("find-stars");

export default function Page() {
  return (
    <LearnArticle
      slug="find-stars"
      lead="사진은 수백만 개의 밝기 값일 뿐이에요. 그 안에서 '별'이라고 부를 만한 점을 골라 위치를 적는 것이 첫 단계예요. 어려운 건 별처럼 보이는 가짜를 걸러 내는 일이에요."
    >
      <Figure caption="실제 샘플 사진으로 이 기기에서 바로 찾은 결과예요. 두 순서를 번갈아 눌러 보세요.">
        <FindStarsDemo />
      </Figure>

      <LearnSection title="1. 배경을 빼고 솟은 점 찾기">
        <ol className="list-decimal space-y-2 pl-5">
          <li>사진을 흑백(밝기)으로 바꿔요. 색은 쓰지 않아요.</li>
          <li>
            사진을 크게 흐리게 만든 것을 &ldquo;배경&rdquo;으로 보고 원래
            사진에서 빼요. 하늘이 도시 불빛으로 한쪽만 밝아도, 별은 주변보다
            밝은 부분만 남아요. (흐림은 상자 흐림을 세 번 겹쳐 가우스 흐림에
            가깝게 해서 빠르게 해요.)
          </li>
          <li>
            남은 사진에서 <b>주변 어느 점보다도 밝은 꼭대기</b>를 찾아요. 그중
            평균보다 표준편차의 3배 넘게 밝은 것만 남겨요. 사진마다 밝기가
            달라서 문턱값도 사진에 맞춰 정해요.
          </li>
          <li>너무 가까이 붙은 두 점은 같은 별로 보고 밝은 하나만 남겨요.</li>
        </ol>
      </LearnSection>

      <LearnSection title="2. 별다운 점부터">
        <p>
          밤하늘 사진에는 별보다 밝은 가짜가 많아요. 창문 불빛, 가로등, 나무
          사이로 새는 빛, 물결에 비친 빛이요. 밝은 순으로만 고르면 이런 가짜가
          앞자리를 차지해서, 다음 단계가 엉뚱한 모양을 맞춰 보게 돼요.
        </p>
        <p>
          그래서 점마다 <b>별다움</b>을 재요. 점을 둘러싼 고리 모양의 띠가
          고르게 어두운 하늘이면 별이고, 한쪽은 건물이고 한쪽은 하늘처럼 고르지
          않으면 가짜일 가능성이 커요. 별다운 점을 먼저, 그 안에서 밝은 순으로
          줄 세워요.
        </p>
        <p>
          또 <b>한 줄로 같은 간격을 두고 늘어선 점들</b>(아파트 창문 줄, 비행기
          불빛)은 별이 그렇게 늘어설 일이 거의 없어서 뒤로 미뤄요.
        </p>
      </LearnSection>

      <LearnSection title="3. 사람이 고칠 수 있게">
        <p>
          상위 100개를 사진 위에 보여 주고, 풀이가 잘 안 되면 사람이 &ldquo;별
          고치기&rdquo;에서 가짜를 지우거나 빠진 별을 더할 수 있어요. 처음에는
          이 일을 늘 사람이 했지만, 별다움 덕분에 지금은 대부분 사람 손 없이
          넘어가요.
        </p>
        <p className="text-sm opacity-70">
          이 계산은 화면이 멈추지 않도록 따로 도는 일꾼(Web Worker)이 해요.
          처음에는 OpenCV(3.9MB)를 썼지만, 필요한 부분만 직접 짜서 내려받을 것을
          없앴어요.
        </p>
      </LearnSection>
    </LearnArticle>
  );
}
