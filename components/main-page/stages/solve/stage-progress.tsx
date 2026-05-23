"use client";

import { useAppStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const TOTAL_STAGES = 8;

const StageProgress = () => {
  const { solveStages, currentStageIndex, solveMode } = useAppStore();
  const t = useTranslations();

  // 솔버는 단계 번호(1-based)를 stageIndex 로 들고 있다.
  // 번역 키는 stages.lbl.{n} / stages.fast.{n} (1-based).
  const stage = solveStages[currentStageIndex];
  const stageNum = stage ? stage.stageIndex : 0;
  const bucket = solveMode === "fast" ? "fast" : "lbl";
  const stageName = stageNum ? t(`stages.${bucket}.${stageNum}` as any) : "";

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
