import { IStoreFn } from "./store";
import { LBLStage, solveLBL, applyMoves } from "../solver/lbl-solver";
import { solveFast } from "../solver/fast-solve";
import {
  isFullySolved,
  normalizeCenters,
  buildRelabel,
  transformMoves,
} from "../solver/normalize";

const initSolveCube = ({ get, set }: IStoreFn, opts?: { autoAdvance?: boolean }) => {
  const cube = get().cube;
  const mode = get().solveMode;

  // 슬라이스 무브로 인해 센터가 회전됐을 수 있으므로 정규화 후 풀고 결과를 원본 좌표계로 매핑.
  const { normalized, rotations } = normalizeCenters(cube);
  const relabel = buildRelabel(rotations);

  // 모드별 솔버로 단계 산출 후 원본 좌표계로 무브 재매핑.
  const buildStages = (m: "learn" | "fast"): LBLStage[] =>
    (m === "fast" ? solveFast(normalized) : solveLBL(normalized)).map((s) => ({
      ...s,
      moves: transformMoves(s.moves, relabel),
    }));

  const flatten = (st: LBLStage[]) => st.flatMap((s) => s.moves).filter((s) => s !== "");
  const isValid = (sol: string[]) => sol.length > 0 && isFullySolved(applyMoves(cube, sol));

  let stages = buildStages(mode);
  let solution = flatten(stages);

  // fast 모드는 parity/미완성 등으로 실패할 수 있으므로 학습 모드로 안전 폴백.
  if (mode === "fast" && !isValid(solution)) {
    stages = buildStages("learn");
    solution = flatten(stages);
  }

  if (!solution.length) {
    set({ cubeSolution: [], cubeSolutionStep: null });
    throw new Error("Unsolveable cube");
  }

  // 색상 카운트는 맞지만 parity 위반 등으로 풀리지 않는 입력 차단.
  if (!isFullySolved(applyMoves(cube, solution))) {
    set({ cubeSolution: [], cubeSolutionStep: null });
    throw new Error("Unsolveable cube");
  }

  // 단계 자동 인식: 입력 큐브가 이미 일부 단계까지 푼 상태면 그 단계 도트는
  // 완료로 표시하고 다음 비빈 단계부터 진입.
  const firstNonEmptyIdx = stages.findIndex((s) => s.moves.length > 0);
  const initialStageIndex = firstNonEmptyIdx === -1 ? 0 : firstNonEmptyIdx;

  set({
    cubeSolution: solution,
    solveStages: stages,
    cubeSolutionStep: 0,
    currentStageIndex: initialStageIndex,
  });
  // 학습(연습) 진입은 첫 무브 미리보기 없이 step 0 에서 시작해야 드래그 입력과 어긋나지 않는다.
  if (opts?.autoAdvance !== false) get().nextCubeSolveStep();
};

export default initSolveCube;
