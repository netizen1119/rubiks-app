"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { useTranslations, useMessages } from "next-intl";

const StageInfo = () => {
  const { currentStageIndex, solveMode } = useAppStore();
  const [open, setOpen] = useState(false);
  const t = useTranslations();
  const messages = useMessages() as any;

  const bucket = solveMode === "fast" ? "fastDesc" : "lblDesc";
  const desc = messages?.stages?.[bucket]?.[String(currentStageIndex)];
  if (!desc) return null;

  return (
    <div className="w-full max-w-[22rem] text-xs relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full text-left px-3 py-1.5 rounded-md border border-border",
          "text-muted-foreground hover:text-foreground transition-colors",
          "flex items-center justify-between gap-2",
          "bg-background"
        )}
      >
        <span>{t("solve.showPrinciple")}</span>
        <span className="opacity-60">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        // absolute 로 띄워 레이아웃 시프트를 만들지 않음 (시프트 시 큐브 위치가
        // mount 시 계산된 anchor 와 어긋나 화면 위에서 떠 보임).
        // max-height + 스크롤 로 viewport 아래로 잘리는 것 방지.
        <div
          className={cn(
            "absolute left-0 right-0 top-full mt-1.5 z-30",
            "px-3 py-2 rounded-md border border-border/80",
            "shadow-xl space-y-2 leading-relaxed",
            "max-h-[40vh] overflow-y-auto",
            // 페이지 배경(검정)과 구분되도록 살짝 밝은 회색.
            "bg-zinc-900/95 backdrop-blur-sm"
          )}
        >
          <div>
            <span className="text-foreground font-medium">{t("solve.goal")}</span>
            <span className="text-muted-foreground">{desc.goal}</span>
          </div>
          <div>
            <span className="text-foreground font-medium">{t("solve.approach")}</span>
            <span className="text-muted-foreground">{desc.approach}</span>
          </div>
          {desc.representativeAlgo && (
            <div>
              <span className="text-foreground font-medium">{t("solve.algo")}</span>
              <pre className="inline whitespace-pre-wrap font-mono text-[0.7rem] text-foreground/90">
                {desc.representativeAlgo}
              </pre>
            </div>
          )}
          {desc.tip && (
            <div>
              <span className="text-foreground font-medium">{t("solve.tip")}</span>
              <span className="text-muted-foreground">{desc.tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StageInfo;
