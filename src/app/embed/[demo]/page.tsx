import { notFound } from "next/navigation";
import AnswerCheckDemo from "@/learn/AnswerCheckDemo";
import CandidateScatterDemo from "@/learn/CandidateScatterDemo";
import ChanceDemo from "@/learn/ChanceDemo";
import DetectPipelineDemo from "@/learn/DetectPipelineDemo";
import FindStarsDemo from "@/learn/FindStarsDemo";
import LuckyFakeDemo from "@/learn/LuckyFakeDemo";
import PoleHeightDemo from "@/learn/PoleHeightDemo";
import ProjectionDemo from "@/learn/ProjectionDemo";
import QuadHashDemo from "@/learn/QuadHashDemo";
import QuadReachDemo from "@/learn/QuadReachDemo";
import RefineStepsDemo from "@/learn/RefineStepsDemo";
import SameSkyDemo from "@/learn/SameSkyDemo";
import SameSkyOrbitDemo from "@/learn/SameSkyOrbitDemo";
import ShapeDemo from "@/learn/ShapeDemo";
import SkySphere from "@/learn/SkySphere";
import TriangleSearchDemo from "@/learn/TriangleSearchDemo";
import TriangleSizeDemo from "@/learn/TriangleSizeDemo";
import VerifyOverlayDemo from "@/learn/VerifyOverlayDemo";
import ZenithClockDemo from "@/learn/ZenithClockDemo";

// 찾는 원리(/learn)의 데모를 발표 화면에 하나씩 띄운다: /embed/<이름>
const DEMOS = {
  "sky-sphere": SkySphere,
  "detect-pipeline": DetectPipelineDemo,
  "find-stars": FindStarsDemo,
  shape: ShapeDemo,
  "triangle-search": TriangleSearchDemo,
  "triangle-size": TriangleSizeDemo,
  "quad-hash": QuadHashDemo,
  "quad-reach": QuadReachDemo,
  "verify-overlay": VerifyOverlayDemo,
  "answer-check": AnswerCheckDemo,
  "candidate-scatter": CandidateScatterDemo,
  "refine-steps": RefineStepsDemo,
  chance: ChanceDemo,
  "lucky-fake": LuckyFakeDemo,
  projection: ProjectionDemo,
  "pole-height": PoleHeightDemo,
  "same-sky": SameSkyDemo,
  "same-sky-orbit": SameSkyOrbitDemo,
  "zenith-clock": ZenithClockDemo,
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
