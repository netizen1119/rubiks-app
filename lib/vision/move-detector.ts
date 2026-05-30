import type { ICubeMoves } from "../moves/moves.ts";
import type { ICubeSide } from "../../types/types.ts";
import { applyMove, getFace } from "../solver/lbl-solver.ts";

// 무브 감지 = forward-model 매칭 (HANDOVER_v14 §4).
//
// tracked-solve 진입 시 풀 큐브 상태 S(54자)를 이미 안다(scan/manual-input). 카메라는 한 면만
// 본다. 따라서 "blind 복원"이 아니라: 감지가능 무브 후보 각각을 S 에 적용 → 보이는 면 9칸을
// 예측 → 관측 9-tuple 과 해밍 비교 → 최선 일치 = 일어난 무브.
//
// 좌표계: S 도 관측 tuple 도 *면 라벨 공간*(U/R/F/D/L/B). 카메라 색(ScanColor)→면 라벨 변환은
// 호출자(tracked-solve, SCAN_TO_FACE) 책임. 여기 들어오는 tuple 은 이미 면 라벨 9칸.
//
// 이 파일의 코어(rotateFace/lockOrientation/searchMove)는 전부 순수 함수 → 카메라 없이
// "알려진 무브 → 예측 9칸 → detector 복원" round-trip 으로 단위 테스트 (Phase 2b 안전판).
// idle/moving/settled 프레임 디바운스(타이밍)는 호출 루프(tracked-solve) 책임 — 여기선
// 모션 게이트(prev≠curr)만 본다.

export type DetectorState = "idle" | "moving" | "settled";

export type MoveCandidate = {
  move: ICubeMoves;
  /** 0..1; 클수록 확정도 ↑. 1 = 9칸 완전 일치. tracker-bridge 에서 임계값으로 commit 결정. */
  score: number;
};

// 면 라벨 9칸(row-major)을 향한 카메라 ↔ S 사이 회전. 사용자가 큐브를 어떻게 들었는지에 따라
// 카메라 row-major 가 S row-major 대비 0/90/180/270 회전돼 있을 수 있다 → orient lock 으로 해소.
/** 면 라벨(센터 색에서 파생). "X"(미분류) 제외 — 추적 front 면은 항상 6색 중 하나. */
export type FaceLabel = Exclude<ICubeSide, "X">;

// 마주 보는 면 — front 면을 카메라로 볼 때 그 반대면(+반대면 무브)은 보이지 않는다.
const OPPOSITE: Record<FaceLabel, FaceLabel> = {
  U: "D",
  D: "U",
  R: "L",
  L: "R",
  F: "B",
  B: "F",
};

// 18 면 무브 (슬라이스 M/E/S 제외 — 면 무브만 감지 대상). rotation-utils/applyMove 호환 표기.
const FACE_MOVES: ICubeMoves[] = [
  "U", "U'", "U2",
  "D", "D'", "D2",
  "L", "L'", "L2",
  "R", "R'", "R2",
  "F", "F'", "F2",
  "B", "B'", "B2",
];

// row-major 3×3 를 90° CW 회전했을 때 새 인덱스가 가져올 옛 인덱스.
//   0 1 2          6 3 0
//   3 4 5   --CW-> 7 4 1
//   6 7 8          8 5 2
const ROT_CW = [6, 3, 0, 7, 4, 1, 8, 5, 2];

/** 면 9칸(row-major)을 90° CW 로 k 번 회전. k 는 0..3 (음수/초과 허용, mod 4). */
export const rotateFace = (face: string[], k: number): string[] => {
  const times = ((k % 4) + 4) % 4;
  let out = face;
  for (let t = 0; t < times; t++) out = ROT_CW.map((i) => out[i]);
  return out;
};

const hamming = (a: string[], b: string[]): number => {
  let d = 0;
  for (let i = 0; i < 9; i++) if (a[i] !== b[i]) d++;
  return d;
};

/**
 * front 면을 카메라로 볼 때 감지 가능한 무브(보이는 면 9칸을 바꾸는 것) 목록.
 * 반대면 그룹(예: front=F → B/B'/B2)은 front 9칸을 건드리지 않아 카메라로 구분 불가 → 제외.
 * 결과 15 무브.
 */
export const detectableMoves = (front: FaceLabel): ICubeMoves[] => {
  const hidden = OPPOSITE[front];
  return FACE_MOVES.filter((m) => m[0] !== hidden);
};

/**
 * 첫 settled 에서 방향 lock: known S 의 front 면 9칸을 4회전시켜 관측 tuple 과 가장 잘 맞는
 * orient(0/90/180/270) 를 확정. maxHamming 이하로 못 맞추면 null(lock 실패 → 재시도).
 */
export const lockOrientation = (
  S: string,
  faceLabel: FaceLabel,
  observed: string[],
  maxHamming = 1,
): { orient: number; hamming: number } | null => {
  const slice = getFace(S, faceLabel);
  let best = -1;
  let bestH = Infinity;
  for (let k = 0; k < 4; k++) {
    const h = hamming(rotateFace(slice, k), observed);
    if (h < bestH) {
      bestH = h;
      best = k;
    }
  }
  return bestH <= maxHamming ? { orient: best, hamming: bestH } : null;
};

/**
 * 가설 검색: known S + lock 된 (faceLabel, orient) 에서 감지가능 15무브 각각을 S 에 적용해
 * 보이는 면 9칸을 예측 → 관측 tuple 과 해밍 비교 → 최선 일치 후보 반환.
 * @param threshold 허용 해밍(기본 1 = 색 1칸 오분류 허용). 초과 시 null(미매칭 → 호출자 안내).
 */
export const searchMove = (
  S: string,
  faceLabel: FaceLabel,
  orient: number,
  observed: string[],
  threshold = 1,
): MoveCandidate | null => {
  let best: ICubeMoves | null = null;
  let bestH = Infinity;
  for (const m of detectableMoves(faceLabel)) {
    const predicted = rotateFace(getFace(applyMove(S, m), faceLabel), orient);
    const h = hamming(predicted, observed);
    if (h < bestH) {
      bestH = h;
      best = m;
    }
  }
  if (best === null || bestH > threshold) return null;
  return { move: best, score: 1 - bestH / 9 };
};

/**
 * 모션 게이트 + 가설 검색. 호출자가 매 settled tick 마다 prev/curr 면 tuple 을 넘긴다.
 * prev==curr (변화 없음) → null(idle). 변화 있으면 searchMove 로 무브 후보 산출.
 * 타이밍 기반 idle/moving/settled 디바운스는 호출 루프 책임 (이 함수는 순수).
 *
 * @param prevTuple 직전 안정 관측 면 9칸(면 라벨).
 * @param currTuple 현재 관측 면 9칸(면 라벨).
 * @param S         known 풀 큐브 상태(54자, 면 라벨).
 * @param faceLabel 카메라가 보는 front 면.
 * @param orient    lockOrientation 으로 확정한 회전(0..3).
 */
export const detectMove = (
  prevTuple: string[],
  currTuple: string[],
  S: string,
  faceLabel: FaceLabel,
  orient: number,
  opts?: { threshold?: number },
): MoveCandidate | null => {
  if (hamming(prevTuple, currTuple) === 0) return null;
  return searchMove(S, faceLabel, orient, currTuple, opts?.threshold);
};
