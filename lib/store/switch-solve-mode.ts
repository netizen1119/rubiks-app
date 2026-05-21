import { IStoreFn } from "./store";
import { applyMoves } from "../solver/lbl-solver";
import { isFullySolved } from "../solver/normalize";

// solve 도중 풀이 모드(learn ↔ fast) 전환.
// 스크램블로 되감지 않고 "현재 진행 위치에서 새 모드로 이어 풀기".
// 현재 시각 큐브의 논리 상태 = applyMoves(스크램블, 지금까지 commit 된 무브)이며,
// 이를 새 모드 솔버로 재풀이하면 결과가 현재 지오메트리에 그대로 적용된다(되감기 불필요).
//
// 호출 전 제약(호출부 보장): nextCubeRotation === null && !isDuringRotation (clean boundary).
// 그래야 committed 무브 수 = cubeSolutionStep 로 정확히 계산된다.
const switchSolveMode = ({ get, set }: IStoreFn, mode: "learn" | "fast") => {
  const st = get();
  if (st.solveMode === mode) return;

  const committedCount =
    st.cubeSolutionStep === null ? st.cubeSolution.length : st.cubeSolutionStep;
  const currentCube = applyMoves(st.cube, st.cubeSolution.slice(0, committedCount));

  // 새 모드 + 현재 상태를 풀이 시작점으로 설정.
  set({ solveMode: mode, cube: currentCube });

  // 이미 완성된 상태에서 전환하면 재풀이 없이 완료 상태로 둔다(빈 풀이는 throw 됨).
  if (isFullySolved(currentCube)) {
    set({ cubeSolution: [], solveStages: [], cubeSolutionStep: null, currentStageIndex: 0 });
    return;
  }

  // currentCube 를 새 모드로 재풀이 → cubeSolution/solveStages/step 갱신 + step 0 preview.
  get().initSolveCube();
};

export default switchSolveMode;
