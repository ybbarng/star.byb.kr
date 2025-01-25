"use client";

import { useStepsStore } from "@/plate-solver/store/steps";
import { cn } from "@/utils/cn";

export default function Steps() {
  const steps = useStepsStore((state) => state.steps);
  const current = useStepsStore((state) => state.current);

  return (
    <ul className="steps w-full">
      {steps.map((step, i) => {
        return (
          <li
            key={step}
            className={cn(
              "step",
              current >= i && "step-primary",
              current === i && "font-bold",
              current !== i && "text-neutral-300",
            )}
          >
            {step}
          </li>
        );
      })}
    </ul>
  );
}
