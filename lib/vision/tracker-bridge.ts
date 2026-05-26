import type { IStoreFn } from "../store/store";
import type { MoveCandidate } from "./move-detector";

// 확정된 무브 후보를 store 에 dispatch.
// 시각화 애니메이션은 기존 rotation-utils 파이프라인을 그대로 탄다.
// 풀이 흐름과의 합류(제안과 다른 무브 시 재풀이 등)는 Phase 3 에서 구현.

/**
 * 확정된 무브를 큐브 상태에 반영한다. score 임계 등의 gating 은 호출자(detector loop)가 책임.
 */
export const commitDetectedMove = (
  _storeFn: IStoreFn,
  _candidate: MoveCandidate,
): void => {
  // Phase 1+ 에서 storeFn.get().rotateCube(candidate.move) 호출.
};
