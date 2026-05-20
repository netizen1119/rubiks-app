// 큐브 센터 정규화 + 풀이 라벨 재매핑 유틸. init-solve-cube 와 분리하여
// 순수 함수로 유지 → 단위 테스트 가능.

import { applyMove, applyMoves } from "./lbl-solver.ts";

export type FaceLetter = "U" | "R" | "F" | "D" | "L" | "B";
export const FACES: FaceLetter[] = ["U", "R", "F", "D", "L", "B"];
export const FACE_IDX: Record<FaceLetter, number> = {
  U: 4,
  R: 13,
  F: 22,
  D: 31,
  L: 40,
  B: 49,
};
export const SOLVED_STANDARD =
  "UUUUUUUUU" + "RRRRRRRRR" + "FFFFFFFFF" + "DDDDDDDDD" + "LLLLLLLLL" + "BBBBBBBBB";

// 완전 복원 검사: 각 면이 자기 센터색으로 통일됐는지.
export const isFullySolved = (cube: string): boolean => {
  for (let f = 0; f < 54; f += 9) {
    const c = cube[f + 4];
    for (let i = 0; i < 9; i++) if (cube[f + i] !== c) return false;
  }
  return true;
};

export const findCenterFace = (state: string, label: string): FaceLetter => {
  for (const f of FACES) if (state[FACE_IDX[f]] === label) return f;
  throw new Error(`label ${label} missing in centers`);
};

// 1단계: 'U' 라벨을 U-pos 로 (x/y 합성으로 z 회전까지 커버)
const STEP1_UROT: Record<FaceLetter, string[]> = {
  U: [],
  F: ["x"],
  D: ["x2"],
  B: ["x'"],
  R: ["y", "x"],
  L: ["y'", "x"],
};
// 2단계: 'R' 라벨을 R-pos 로 (이제 y 회전만). U/D 위치엔 도달하지 않음.
const STEP2_RROT: Partial<Record<FaceLetter, string[]>> = {
  R: [],
  F: ["y'"],
  L: ["y2"],
  B: ["y"],
};

// 슬라이스 무브로 회전된 센터를 표준 배치로 되돌리는 큐브 회전 시퀀스 계산.
export const normalizeCenters = (
  cube: string
): { normalized: string; rotations: string[] } => {
  let state = cube;
  const rotations: string[] = [];
  const uAt = findCenterFace(state, "U");
  for (const m of STEP1_UROT[uAt]) {
    state = applyMove(state, m);
    rotations.push(m);
  }
  const rAt = findCenterFace(state, "R");
  const rRot = STEP2_RROT[rAt];
  if (!rRot) {
    throw new Error("Inconsistent centers");
  }
  for (const m of rRot) {
    state = applyMove(state, m);
    rotations.push(m);
  }
  return { normalized: state, rotations };
};

// 회전 R 을 표준 SOLVED 에 적용했을 때, 각 표준 면-pos 에 놓이는 라벨.
// 솔버의 면 무브 "X" 는 원본 좌표계에서 라벨 relabel[X] 의 면을 돌리는 것과 같다.
export const buildRelabel = (
  rotations: string[]
): Record<FaceLetter, FaceLetter> => {
  const afterR = applyMoves(SOLVED_STANDARD, rotations);
  const map: Partial<Record<FaceLetter, FaceLetter>> = {};
  for (const f of FACES) map[f] = afterR[FACE_IDX[f]] as FaceLetter;
  return map as Record<FaceLetter, FaceLetter>;
};

export const transformMoves = (
  moves: string[],
  relabel: Record<FaceLetter, FaceLetter>
): string[] =>
  moves.map((m) => {
    const face = m[0] as FaceLetter;
    return (relabel[face] ?? face) + m.slice(1);
  });
