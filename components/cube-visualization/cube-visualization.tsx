"use client";

import React from "react";
import CubeThree from "./cube-three";
import { Variants, motion } from "framer-motion";
import { useAppStore } from "@/lib/store/store";

const CubeVisualization = () => {
  const { currentAppStage, cubeTop, cubeScale, cubeLeft } = useAppStore();

  const variants: Variants = {
    initAnim: {
      scale: [cubeScale],
      x: [cubeLeft], // Define the x-axis animation values
      // y: [0, 0], // Define the y-axis animation values
      y: [cubeTop + 20, cubeTop, cubeTop + 20], // Define the y-axis animation values
      transition: {
        repeat: Infinity, // Repeat the animation infinitely
        duration: 3, // Duration of each animation cycle
        ease: "easeInOut", // Use linear easing for smoother animation
        delay: 3,
      },
    },
    default: {
      y: cubeTop,
      x: cubeLeft,
      scale: cubeScale,
      transition: {
        ease: "easeOut",
        duration: 0.8,
      },
    },
  };

  const getVariant = () => {
    if (currentAppStage === "homepage" || currentAppStage === "deviceselect") {
      return "initAnim";
    }
    return "default";
  };

  return (
    // inset-0(top-0 left-0) 필수: offset 없는 fixed 는 정적 흐름 위치 기준이라
    // 긴 스크롤 스테이지(math-learn)에서 오버레이가 문서 아래로 밀려 내부 absolute 큐브가
    // 화면 밖으로 사라진다. inset-0 으로 viewport 좌상단에 고정한다.
    <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none">
      <motion.div className="absolute left-0 top-0 origin-top-left" variants={variants} animate={getVariant()}>
        <CubeThree />
      </motion.div>
    </div>
  );
};

export default CubeVisualization;
