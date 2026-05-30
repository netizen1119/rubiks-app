import type { IStoreFn } from "../store/store";
import type { MoveCandidate } from "./move-detector";
import { applyMove } from "../solver/lbl-solver";

// 확정된 무브 후보를 store 에 dispatch (move-detector → 3D + forward-model 상태).
//
// 두 갱신을 같이 한다:
// - 3D 시각화: `store.rotateCube(move)` — rotation-utils gsap 애니메이션(0.4s).
// - forward-model 상태 S: `rotateCubeAction` 은 3D 큐비 *배열*만 재정렬하고 `store.cube`
//   54자 문자열은 건드리지 않으므로, 여기서 `applyMove` 로 직접 동기 갱신 → detector 의 다음
//   가설 검색이 최신 S 를 본다.
//
// 애니메이션 진행 중(isDuringRotation)이면 둘 다 건너뛴다 — rotateCube 가 어차피 early-return
// 하므로 cube 만 갱신하면 3D/S 가 desync 된다. gating 임계(score)는 호출자(detector loop) 책임.

export const commitDetectedMove = (
  storeFn: IStoreFn,
  candidate: MoveCandidate,
): void => {
  const { get, set } = storeFn;
  if (get().isDuringRotation) return;
  set({ cube: applyMove(get().cube, candidate.move) });
  get().rotateCube(candidate.move);
};
