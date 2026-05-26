"use client";

import React from "react";
import { useAppStore } from "@/lib/store/store";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

const TrackedSolveStage = () => {
  const { updateStore } = useAppStore();
  const t = useTranslations();

  const onExit = () => {
    updateStore({ currentAppStage: "homepage", trackedSolve: false });
  };

  return (
    <div className="mt-[-10vh] flex flex-col items-center gap-6 px-6">
      <h2 className="text-2xl font-semibold">{t("trackedSolve.title")}</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {t("trackedSolve.placeholder")}
      </p>
      <Button onClick={onExit} variant="ghost">
        {t("common.back")}
      </Button>
    </div>
  );
};

export default TrackedSolveStage;
