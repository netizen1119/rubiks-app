"use client";

import { moveDescriptionKey } from "@/lib/maps/move-descriptions";
import { useAppStore } from "@/lib/store/store";
import { useTranslations } from "next-intl";

const MoveGuide = () => {
  const { cubeSolution, cubeSolutionStep } = useAppStore();
  const t = useTranslations();

  const inRange =
    cubeSolutionStep !== null &&
    cubeSolutionStep >= 0 &&
    cubeSolutionStep < cubeSolution.length;

  if (cubeSolution.length === 0) {
    return (
      <div className="flex h-[4.5rem] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!inRange) {
    return (
      <div className="flex h-[4.5rem] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("solve.allDone")}</p>
      </div>
    );
  }

  const step = cubeSolutionStep as number;
  const move = cubeSolution[step];
  const desc = moveDescriptionKey(move);
  const faceLabel = desc ? t(`move.face.${desc.faceKey}` as any) : move;
  const dirLabel = desc ? t(`move.dir.${desc.dirKey}` as any) : "";
  const describeText = desc
    ? desc.dirKey === "double"
      ? t("move.describeDouble", { face: faceLabel })
      : t("move.describe", { face: faceLabel, direction: dirLabel })
    : move;

  return (
    <div className="flex h-[4.5rem] items-center gap-4">
      <span className="min-w-[3.5rem] text-center text-4xl font-bold leading-none text-foreground">
        {move}
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-base text-foreground leading-tight">{describeText}</span>
        <span className="text-xs text-muted-foreground leading-none">
          {t("solve.moveCounter", { current: step + 1, total: cubeSolution.length })}
        </span>
      </div>
    </div>
  );
};

export default MoveGuide;
