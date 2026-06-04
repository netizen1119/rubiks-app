"use client";

import React, { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAppStore } from "@/lib/store/store";
import { solved_cube } from "@/lib/helpers/helper";
import { CubeDevTools } from "../devtools/devtools";
import CubeVisualization from "../cube-visualization/cube-visualization";

import useInitApp from "@/lib/use-init";
import InitStage from "./stages/init/init";
import ScanCubeStage from "./stages/scan/scan";
import SolveCubeStage from "./stages/solve/solve";
import ManualInputStage from "./stages/manual-input/scramble-cube";
import TrackedSolveStage from "./stages/tracked-solve/tracked-solve";
import LearnMethodStage from "./stages/learn-method/learn-method";
import MathLearnStage from "./stages/math-learn/math-learn";
import { resetCubiesToSolved } from "./stages/learn-method/reset-cubies";

// 입력/풀이/학습을 마치고 홈(또는 deviceselect)으로 돌아오면 큐비를 풀린 상태로 복원.
// 그렇지 않으면 직전에 섞어둔 큐브가 홈 화면에 그대로 남는다.
const isEntryStage = (s: string) => s === "homepage" || s === "deviceselect";

const MainPage = () => {
  const currentAppStage = useAppStore((state) => state.currentAppStage);
  const t = useTranslations("math");

  useInitApp();

  // deep stage(scan/manual/solve/tracked/learn) → 홈 화면 복귀 시 1회 리셋.
  const prevStage = useRef(currentAppStage);
  useEffect(() => {
    const prev = prevStage.current;
    prevStage.current = currentAppStage;
    if (!isEntryStage(currentAppStage) || isEntryStage(prev)) return;

    const st = useAppStore.getState();
    if (st.objects.current.stickers.length !== 54) return; // vis 준비 전이면 스킵

    // 진행 중이던 자동 회전/레이어 회전 정리 후 풀린 상태로 복원, 홈 스핀 재시작.
    if (st.cubeSpinningTimeline.current) {
      st.cubeSpinningTimeline.current.kill();
      st.cubeSpinningTimeline.current = null;
    }
    resetCubiesToSolved();
    st.updateCube(solved_cube, true);
    useAppStore.setState({ isDuringRotation: false });
    st.toggleCubeRotating(); // timeline null → 스핀 시작
  }, [currentAppStage]);

  // AnimatePresence 제거: mode="wait" + init.tsx 의 inner motion.div exit 애니메이션이
  // 결합되어 stage 전환 시 다음 stage 마운트가 지연/차단되는 이슈로 단순 조건 렌더링.
  return (
    <div className="min-h-screen flex flex-col justify-center">
      {currentAppStage === "homepage" && (
        <button
          onClick={() => useAppStore.setState({ currentAppStage: "math-learn" })}
          className="fixed right-4 top-4 z-30 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
        >
          {t("entry")}
        </button>
      )}
      {(currentAppStage === "homepage" || currentAppStage === "deviceselect") && <InitStage key="init-stage" />}
      {currentAppStage === "scan" && <ScanCubeStage key="scan-stage" />}
      {currentAppStage === "manual-input" && <ManualInputStage key="manual-input-stage" />}
      {currentAppStage === "solve" && <SolveCubeStage key="solve-stage" />}
      {currentAppStage === "tracked-solve" && <TrackedSolveStage key="tracked-solve-stage" />}
      {currentAppStage === "learn-method" && <LearnMethodStage key="learn-method-stage" />}
      {currentAppStage === "math-learn" && <MathLearnStage key="math-learn-stage" />}
      <CubeVisualization />
      {process.env.NEXT_PUBLIC_DEV_MODE === "true" && <CubeDevTools />}
    </div>
  );
};

export default MainPage;
