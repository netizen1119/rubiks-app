// "빠르게 풀이 보기" 모드 솔버.
// 기존 Thistlethwaite 4단계 솔버(solve_thistlethwaite)를 학습 흐름의 LBLStage[]
// 형태로 래핑한다. 출력은 전부 면 무브(U/D/F/B/L/R + ' / 2)라 rotation-utils
// 시각화와 그대로 호환된다(슬라이스/큐브회전 출력 없음).
//
// 입력은 센터가 표준 배치인 큐브(normalizeCenters 결과)를 받아 fcube_to_ifcube 로
// 변환 후 푼다. 출력 무브는 normalized 좌표계 기준 → 호출부에서 transformMoves 로
// 원본 좌표계에 재매핑한다(LBL 경로와 동일).

import type { LBLStage } from "./lbl-solver.ts";
import { fcube_to_ifcube } from "./fcube-to-ifcube.ts";
import { solve_thistlethwaite } from "./solve-thistlethwaite.ts";

export const solveFast = (normalized: string): LBLStage[] => {
  const ifcube = fcube_to_ifcube(normalized);
  // phase 별 무브 문자열 배열. 풀 수 없으면 일부만 반환될 수 있어 호출부에서 검증.
  const phases = solve_thistlethwaite(ifcube) as string[];

  return phases.map((phase, i) => ({
    stageIndex: i + 1,
    moves: phase.trim().split(/ +/).filter(Boolean),
  }));
};
