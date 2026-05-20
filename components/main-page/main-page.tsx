"use client";

import React from "react";
import { useAppStore } from "@/lib/store/store";
import { CubeDevTools } from "../devtools/devtools";
import CubeVisualization from "../cube-visualization/cube-visualization";

import useInitApp from "@/lib/use-init";
import InitStage from "./stages/init/init";
import ScanCubeStage from "./stages/scan/scan";
import SolveCubeStage from "./stages/solve/solve";
import ManualInputStage from "./stages/manual-input/scramble-cube";

const MainPage = () => {
  const currentAppStage = useAppStore((state) => state.currentAppStage);

  useInitApp();

  // AnimatePresence 제거: mode="wait" + init.tsx 의 inner motion.div exit 애니메이션이
  // 결합되어 stage 전환 시 다음 stage 마운트가 지연/차단되는 이슈로 단순 조건 렌더링.
  return (
    <div className="min-h-screen flex flex-col justify-center">
      {(currentAppStage === "homepage" || currentAppStage === "deviceselect") && <InitStage key="init-stage" />}
      {currentAppStage === "scan" && <ScanCubeStage key="scan-stage" />}
      {currentAppStage === "manual-input" && <ManualInputStage key="manual-input-stage" />}
      {currentAppStage === "solve" && <SolveCubeStage key="solve-stage" />}
      <CubeVisualization />
      {process.env.NEXT_PUBLIC_DEV_MODE === "true" && <CubeDevTools />}
    </div>
  );
};

export default MainPage;
