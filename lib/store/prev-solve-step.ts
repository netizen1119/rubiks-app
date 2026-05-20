import { ICubeMoves } from "../moves/moves";
import { LBLStage } from "../solver/lbl-solver";
import { IStoreFn } from "./store";

// 무브의 역방향. U→U', U'→U, U2→U2.
const inverseMove = (m: string): string => {
  if (m.endsWith("2")) return m;
  if (m.endsWith("'")) return m[0];
  return m + "'";
};

// step(0-based 이동 인덱스)이 속한 단계 인덱스. 누적 이동수 기준, 마지막으로 캡.
const stageIndexForStep = (stages: LBLStage[], step: number): number => {
  let cum = 0;
  for (let i = 0; i < stages.length; i++) {
    cum += stages[i].moves.length;
    if (step < cum) return i;
  }
  return stages.length ? stages.length - 1 : 0;
};

// 직전 이동을 역무브로 되돌린다. 다음 이동(nextCubeSolveStep)과 거울 구조.
// 2-phase 회전(rotateCube2Part) 사용해 preview + commit 시퀀스 유지.
const prevCubeSolveStep = ({ get, set }: IStoreFn) => {
  if (get().isDuringRotation) return;
  const solution = get().cubeSolution;
  const stages = get().solveStages;
  const currentStep = get().cubeSolutionStep;

  // 완료 상태(cubeSolutionStep === null) 면 마지막 이동의 역무브 적용으로 복귀.
  // 진행 중이면 (currentStep - 1) 무브의 역무브.
  let undoTargetStep: number;
  if (currentStep === null) {
    // 완료 상태 — 마지막 이동을 되돌림.
    if (solution.length === 0) return;
    undoTargetStep = solution.length - 1;
  } else {
    if (currentStep <= 0) return; // 더 되돌릴 수 없음
    undoTargetStep = currentStep - 1;
  }

  const undoMove = inverseMove(solution[undoTargetStep]);
  const isIn2Part = get().nextCubeRotation !== null;

  get().rotateCube2Part(undoMove as ICubeMoves);

  if (isIn2Part) {
    // commit 단계 완료: step 을 undoTargetStep 로 설정 (다음에 누르면 그 이동을 재실행).
    set({
      cubeSolutionStep: undoTargetStep,
      currentStageIndex: stageIndexForStep(stages, undoTargetStep),
    });
  }
};

export default prevCubeSolveStep;
