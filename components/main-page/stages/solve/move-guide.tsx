"use client";

import { moveDescriptions } from "@/lib/maps/move-descriptions";
import { useAppStore } from "@/lib/store/store";

const describe = (face: string, direction: string): string =>
  direction === "180°" ? `${face} 180° 회전` : `${face}을 ${direction}으로`;

const MoveGuide = () => {
  const { cubeSolution, cubeSolutionStep } = useAppStore();

  const inRange =
    cubeSolutionStep !== null &&
    cubeSolutionStep >= 0 &&
    cubeSolutionStep < cubeSolution.length;

  if (!inRange) {
    return (
      <div className="flex h-[4.5rem] items-center justify-center">
        <p className="text-sm text-muted-foreground">모든 이동을 완료했습니다 🎉</p>
      </div>
    );
  }

  const step = cubeSolutionStep as number;
  const move = cubeSolution[step];
  const desc = moveDescriptions[move];

  return (
    <div className="flex h-[4.5rem] items-center gap-4">
      <span className="min-w-[3.5rem] text-center text-4xl font-bold leading-none text-foreground">
        {move}
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-base text-foreground leading-tight">
          {desc ? describe(desc.face, desc.direction) : move}
        </span>
        <span className="text-xs text-muted-foreground leading-none">
          이동 {step + 1} / {cubeSolution.length}
        </span>
      </div>
    </div>
  );
};

export default MoveGuide;
