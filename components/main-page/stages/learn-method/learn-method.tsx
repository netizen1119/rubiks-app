"use client";

import { useAppStore } from "@/lib/store/store";
import LearnDemo from "./learn-demo";
import LearnPractice from "./learn-practice";

// 학습 stage 디스패처.
// - learnMode=false (홈 "데모 보기"): solved 큐브에 알고리즘 시연(LearnDemo).
// - learnMode=true  (홈 "내 큐브로 배우기" → 스캔/입력): 실제 큐브 단계별 따라하기(LearnPractice).
const LearnMethodStage = () => {
  const learnMode = useAppStore((s) => s.learnMode);
  return learnMode ? <LearnPractice /> : <LearnDemo />;
};

export default LearnMethodStage;
