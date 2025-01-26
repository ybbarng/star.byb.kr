"use client";

import { useEffect } from "react";
import PageBody from "@/plate-solver/PageBody";
import PageHeader from "@/plate-solver/PageHeader";
import cv from "@/services/cv";

export default function PlateSolverPage() {
  useEffect(() => {
    const init = async () => {
      await cv.load();
    };

    init();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader />
      <PageBody />
    </div>
  );
}
