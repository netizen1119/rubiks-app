"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

// solve 화면 통계: 현재 진행 step / 전체, 경과 시간, 단계별 이동 수.
// 컴포넌트 마운트 시점부터 시간 측정 (initSolveCube 후 직후).
const SolveStats = () => {
  const { cubeSolution, cubeSolutionStep, solveStages, currentStageIndex } =
    useAppStore();
  const t = useTranslations("solve");

  const [elapsedSec, setElapsedSec] = useState(0);
  const [startTime] = useState<number>(() => Date.now());

  const finished = cubeSolutionStep === null;

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTime) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [finished, startTime]);

  const total = cubeSolution.length;
  const current = finished ? total : cubeSolutionStep ?? 0;
  const progressPct = total === 0 ? 0 : Math.round((current / total) * 100);

  const stage = solveStages[currentStageIndex];
  const stageMoves = stage?.moves.length ?? 0;

  const fmtTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between text-[0.7rem] text-muted-foreground",
        "w-full max-w-[22rem] gap-3 px-1"
      )}
    >
      <span>
        {t("progress")} <span className="text-foreground font-medium">{current} / {total}</span>
        <span className="opacity-60"> ({progressPct}%)</span>
      </span>
      <span className="opacity-60">|</span>
      <span>
        {t("stage")} <span className="text-foreground font-medium">{stageMoves}</span>{t("stageMovesUnit")}
      </span>
      <span className="opacity-60">|</span>
      <span>
        {t("time")} <span className="text-foreground font-medium font-mono">{fmtTime(elapsedSec)}</span>
      </span>
    </div>
  );
};

export default SolveStats;
