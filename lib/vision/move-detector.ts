import type { CubePose } from "./pose-lock";
import type { ICubeMoves } from "../moves/moves";

// 모션 게이트 상태머신: idle → moving → settled.
// settled 진입 시 18개 면 무브 후보 중 apply(m, S) 가 관측 가시영역과 가장 잘 맞는 m 선택.
// 매핑된 상태 S 가 있으므로 색 분류 자체는 6 reference 와의 nearest 만 수행.
// PoC-2 에서 실제 모션 감지 + 가설 검색을 구현. 현 시점은 타입 스텁.

export type DetectorState = "idle" | "moving" | "settled";

export type MoveCandidate = {
  move: ICubeMoves;
  /** 0..1; 클수록 확정도 ↑. tracker-bridge 에서 임계값으로 commit 결정. */
  score: number;
};

/**
 * 가설 검색: 현 상태 S 에 18 무브를 가해 본 뒤 관측 프레임과 가장 일치하는 후보를 반환.
 * @returns 일치 후보가 없거나 점수가 임계 미만이면 null.
 */
export const detectMove = (
  _pose: CubePose,
  _currentState: string,
  _frame: ImageData,
): MoveCandidate | null => {
  return null;
};
