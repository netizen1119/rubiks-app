import { ICubeMoves } from "../moves/moves";
import { LBLStage } from "../solver/lbl-solver";
import { IStoreFn } from "./store";

// step(0-based 이동 인덱스)이 속한 단계 인덱스. 누적 이동수 기준, 마지막으로 캡.
const stageIndexForStep = (stages: LBLStage[], step: number): number => {
  let cum = 0;
  for (let i = 0; i < stages.length; i++) {
    cum += stages[i].moves.length;
    if (step < cum) return i;
  }
  return stages.length ? stages.length - 1 : 0;
};

const nextCubeSolveStep = ({ get, set }: IStoreFn) => {
  const isIn2Part = get().nextCubeRotation !== null;
  const currentStep = get().cubeSolutionStep;
  const solution = get().cubeSolution;
  const stages = get().solveStages;

  if (currentStep === null || get().isDuringRotation) return;

  get().rotateCube2Part(solution[currentStep] as ICubeMoves);
  if (isIn2Part) {
    if (currentStep === solution.length - 1) {
      set({
        cubeSolutionStep: null,
        currentStageIndex: stages.length ? stages.length - 1 : 0,
      });
      // get().toggleCubeRotating();
    } else {
      const nextStep = currentStep + 1;
      set({
        cubeSolutionStep: nextStep,
        currentStageIndex: stageIndexForStep(stages, nextStep),
      });
    }

    return;
  }
};

export default nextCubeSolveStep;
