"use client";

import { useAppStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";

const TOTAL_STAGES = 8;

const StageProgress = () => {
  const { solveStages, currentStageIndex } = useAppStore();

  const stageName = solveStages[currentStageIndex]?.stageName ?? "";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        {Array.from({ length: TOTAL_STAGES }).map((_, i) => {
          const done = i < currentStageIndex;
          const current = i === currentStageIndex;
          return (
            <span
              key={`stage-dot-${i}`}
              className={cn(
                "rounded-full transition-all",
                done && "h-2 w-2 bg-foreground",
                current && "h-2.5 w-2.5 bg-primary ring-2 ring-primary/30",
                !done && !current && "h-2 w-2 bg-muted"
              )}
            />
          );
        })}
      </div>
      {stageName && (
        <p className="text-sm font-medium text-foreground text-center leading-none">
          {stageName}
        </p>
      )}
    </div>
  );
};

export default StageProgress;
