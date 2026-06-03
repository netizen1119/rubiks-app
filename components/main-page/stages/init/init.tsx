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

  const startCountdown = () => {
    const interval = setInterval(() => setSeconds((seconds) => seconds - 1), 1000);
    setTimeout(() => clearInterval(interval), informationButtonLockDuration + 200);
  };

  // 카메라 트래킹 모드: 알고리즘은 learn 그대로, scan/manual-input 종료 시 tracked-solve 로 분기.
  const chooseTrackedMode = () => {
    updateStore({ solveMode: "learn", trackedSolve: true, learnMode: false, currentAppStage: "deviceselect" });
    startCountdown();
  };

  // 배우기(연습) 모드: 내 큐브를 스캔/입력 후 단계별로 직접 따라하며 학습.
  const chooseLearnMode = () => {
    updateStore({ solveMode: "learn", trackedSolve: false, learnMode: true, currentAppStage: "deviceselect" });
    startCountdown();
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
          // 홈: 두 가지 학습 흐름만 노출 — ① 내 큐브 스캔→단계별 따라하기 ② 카메라로 따라가며.
          // (차근차근/빠르게/데모는 코드엔 남기되 홈에서는 숨김.)
          <>
            <Button asChild>
              <motion.button
                onClick={chooseLearnMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 1.6 } }}
              >
                {t("home.modeStudyScan")}
              </motion.button>
            </Button>
            <Button asChild variant="secondary">
              <motion.button
                onClick={chooseTrackedMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 1.7 } }}
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
