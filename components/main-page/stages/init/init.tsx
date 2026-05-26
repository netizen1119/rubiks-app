"use client";

import React, { useState } from "react";
import MainPageHeading from "./heading";
import { AnimatePresence, motion } from "framer-motion";
import { DeviceSelect } from "./device-select";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store/store";
import { CubePosAnchor } from "@/components/cube-visualization/cube-pos-anchor";
import ScanInstructionsInfo from "./intructions-info";
import { useTranslations } from "next-intl";

const informationButtonLockDuration = 5000;

const InitStage = () => {
  const { currentAppStage, updateStore, deviceId, toggleCubeRotating, hideCubeStickers } = useAppStore();
  const [seconds, setSeconds] = useState(informationButtonLockDuration / 1000);
  const t = useTranslations();

  // 홈에서 풀이 모드(learn/fast)를 고르고 deviceselect 로 진행.
  const chooseMode = (mode: "learn" | "fast") => {
    updateStore({ solveMode: mode, trackedSolve: false, currentAppStage: "deviceselect" });

    // Set the countdown for information/deviceselet screen
    const interval = setInterval(() => setSeconds((seconds) => seconds - 1), 1000);
    setTimeout(() => clearInterval(interval), informationButtonLockDuration + 200);
  };

  // 카메라 트래킹 모드: 알고리즘은 learn 그대로, scan/manual-input 종료 시 tracked-solve 로 분기.
  const chooseTrackedMode = () => {
    updateStore({ solveMode: "learn", trackedSolve: true, currentAppStage: "deviceselect" });
    const interval = setInterval(() => setSeconds((seconds) => seconds - 1), 1000);
    setTimeout(() => clearInterval(interval), informationButtonLockDuration + 200);
  };

  const mainBtnClick = () => {
    if (currentAppStage === "deviceselect" && deviceId) {
      updateStore({ currentAppStage: "scan" });
      toggleCubeRotating();
      setTimeout(() => {
        hideCubeStickers();
      }, 500);
    }
  };

  const getMainBtnText = () => {
    if (seconds > 0) return t("deviceSelect.scanCount", { seconds });
    return t("deviceSelect.scan");
  };

  return (
    <motion.div className="mt-[-10vh] flex flex-col">
      <div className="mx-4 flex justify-between items-center">
        <AnimatePresence mode="wait">
          {currentAppStage === "deviceselect" ? (
            <ScanInstructionsInfo key="instructions" />
          ) : (
            <MainPageHeading key="main-heading" />
          )}
        </AnimatePresence>
        <CubePosAnchor className="mr-16 -mt-2" />
      </div>
      <motion.div
        className="self-center mt-[5rem] relative flex gap-4"
        exit={{
          y: 40,
          opacity: 0,
          transition: {
            duration: 0.6,
            delay: 0.3,
          },
        }}
      >
        {currentAppStage === "homepage" ? (
          // 홈: 풀이 모드 선택. 대다수가 입문자이므로 "차근차근 배우기"를 기본 강조.
          <>
            <Button asChild>
              <motion.button
                onClick={() => chooseMode("learn")}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 1.6 } }}
              >
                {t("home.modeLearn")}
              </motion.button>
            </Button>
            <Button asChild variant="secondary">
              <motion.button
                onClick={() => chooseMode("fast")}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 1.7 } }}
              >
                {t("home.modeFast")}
              </motion.button>
            </Button>
            <Button asChild variant="outline">
              <motion.button
                onClick={chooseTrackedMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 1.8 } }}
              >
                {t("home.modeTracked")}
              </motion.button>
            </Button>
          </>
        ) : (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <DeviceSelect />
            </motion.div>
            <Button asChild>
              <motion.button
                onClick={mainBtnClick}
                layout={seconds > 0}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 1.6 } }}
                disabled={currentAppStage === "deviceselect" && !deviceId && seconds > 0}
              >
                {getMainBtnText()}
              </motion.button>
            </Button>
            <Button asChild variant="secondary">
              <motion.button
                onClick={() => updateStore({ currentAppStage: "manual-input" })}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 1.7 } }}
              >
                {t("deviceSelect.manualInput")}
              </motion.button>
            </Button>
            <Button asChild variant="ghost">
              <motion.button
                onClick={() => updateStore({ currentAppStage: "homepage" })}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 1.8 } }}
              >
                {t("common.back")}
              </motion.button>
            </Button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

export default InitStage;
