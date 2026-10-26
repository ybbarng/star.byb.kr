import { createRoot } from "react-dom/client";
import FitToFrame from "@/app/embed/FitToFrame";
import { NorthSkyFlowDemo, OrionSkyFlowDemo } from "@/blog/NightSkyFlowDemo";
import QuadHashDemo from "@/blog/QuadHashDemo";
import AnswerCheckDemo from "@/learn/AnswerCheckDemo";
import ChanceRatioDemo from "@/learn/ChanceRatioDemo";
import FindStarsDemo from "@/learn/FindStarsDemo";
import SameSkyOrbitDemo from "@/learn/SameSkyOrbitDemo";

// 테크 블로그 글에 넣는 데모 묶음의 입구. HTML의 <div id="root" data-demo="이름">을 보고 그 데모 하나를 띄운다.
// 화면은 /embed/<이름>과 같다 (app/embed/layout.tsx의 틀과 FitToFrame).

export const BLOG_DEMOS = {
  "north-sky-flow": NorthSkyFlowDemo,
  "orion-sky-flow": OrionSkyFlowDemo,
  "quad-hash": QuadHashDemo,
  "same-sky-orbit": SameSkyOrbitDemo,
  "answer-check": AnswerCheckDemo,
  "chance-ratio": ChanceRatioDemo,
  "find-stars": () => <FindStarsDemo score />,
};

const root = document.getElementById("root");
const Demo = root && BLOG_DEMOS[root.dataset.demo as keyof typeof BLOG_DEMOS];

if (root && Demo) {
  createRoot(root).render(
    <div className="embed flex min-h-screen w-full items-start justify-center bg-[#0a0a0a] p-4">
      <style>{`.embed canvas.h-auto { max-height: 62vh; width: auto !important; max-width: 100%; margin: 0 auto; }`}</style>
      <FitToFrame>
        <Demo />
      </FitToFrame>
    </div>,
  );
}
