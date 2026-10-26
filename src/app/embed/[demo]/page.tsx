import { notFound } from "next/navigation";
import AnswerCheckDemo from "@/learn/AnswerCheckDemo";
import CandidateScatterDemo from "@/learn/CandidateScatterDemo";
import ChanceRatioDemo from "@/learn/ChanceRatioDemo";
import DetectPipelineDemo from "@/learn/DetectPipelineDemo";
import FindStarsDemo from "@/learn/FindStarsDemo";
import MoonDateDemo from "@/learn/MoonDateDemo";
import { NorthSkyFlowDemo, OrionSkyFlowDemo } from "@/learn/NightSkyFlowDemo";
import PoleHeightDemo from "@/learn/PoleHeightDemo";
import ProjectionDemo from "@/learn/ProjectionDemo";
import QuadHashDemo from "@/learn/QuadHashDemo";
import QuadReachDemo from "@/learn/QuadReachDemo";
import RefineStepsDemo from "@/learn/RefineStepsDemo";
import SameSkyOrbitDemo from "@/learn/SameSkyOrbitDemo";
import ShapeDemo from "@/learn/ShapeDemo";
import SkySphere from "@/learn/SkySphere";
import TriangleSearchDemo from "@/learn/TriangleSearchDemo";
import TriangleSizeDemo from "@/learn/TriangleSizeDemo";
import VerifyOverlayDemo from "@/learn/VerifyOverlayDemo";
import ZenithClockDemo from "@/learn/ZenithClockDemo";

// 찾는 원리(/learn)의 데모를 발표 화면에 하나씩 띄운다: /embed/<이름>

// 발표에서는 발표자가 직접 움직여 보이니 "움직여 보세요" 안내를 끈다
const QuadHashForDeck = () => <QuadHashDemo hint={false} />;
// 발표에서는 별다움을 클수록 별다운 점수(88점 이상이면 별)로 설명한다
const FindStarsForDeck = () => <FindStarsDemo score />;
const DEMOS = {
  "sky-sphere": SkySphere,
  "detect-pipeline": DetectPipelineDemo,
  "find-stars": FindStarsForDeck,
  shape: ShapeDemo,
  "triangle-search": TriangleSearchDemo,
  "triangle-size": TriangleSizeDemo,
  "quad-hash": QuadHashForDeck,
  "quad-reach": QuadReachDemo,
  "verify-overlay": VerifyOverlayDemo,
  "answer-check": AnswerCheckDemo,
  "chance-ratio": ChanceRatioDemo,
  "candidate-scatter": CandidateScatterDemo,
  "refine-steps": RefineStepsDemo,
  projection: ProjectionDemo,
  "pole-height": PoleHeightDemo,
  "same-sky-orbit": SameSkyOrbitDemo,
  "zenith-clock": ZenithClockDemo,
  "moon-date": MoonDateDemo,
  // 테크 블로그 도입부: 거제에서 본 밤하늘이 저절로 흘러간다
  "north-sky-flow": NorthSkyFlowDemo,
  "orion-sky-flow": OrionSkyFlowDemo,
};

export const dynamicParams = false;

export const generateStaticParams = () =>
  Object.keys(DEMOS).map((demo) => ({ demo }));

export default async function Page({
  params,
}: {
  params: Promise<{ demo: string }>;
}) {
  const { demo } = await params;
  const Demo = DEMOS[demo as keyof typeof DEMOS];

  if (!Demo) notFound();

  return <Demo />;
}
