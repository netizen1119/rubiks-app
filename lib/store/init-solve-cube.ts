import { IStoreFn } from "./store";
import { LBLStage, solveLBL, applyMove, applyMoves } from "../solver/lbl-solver";

// 풀이 적용 후 모든 면이 자기 센터색인지(완전 복원) 검사.
const isFullySolved = (cube: string): boolean => {
  for (let f = 0; f < 54; f += 9) {
    const c = cube[f + 4];
    for (let i = 0; i < 9; i++) if (cube[f + i] !== c) return false;
  }
  return true;
};

// 센터 정규화: 슬라이스(M/E/S) 무브로 회전된 센터를 표준 배치로 되돌리는 큐브 회전.
// 큐브 회전은 솔루션 출력에 포함하지 않고, 솔버 출력 무브의 면 라벨을 원본 좌표계로 재매핑한다.
type FaceLetter = "U" | "R" | "F" | "D" | "L" | "B";
const FACES: FaceLetter[] = ["U", "R", "F", "D", "L", "B"];
const FACE_IDX: Record<FaceLetter, number> = { U: 4, R: 13, F: 22, D: 31, L: 40, B: 49 };
const SOLVED_STANDARD =
  "UUUUUUUUU" + "RRRRRRRRR" + "FFFFFFFFF" + "DDDDDDDDD" + "LLLLLLLLL" + "BBBBBBBBB";

const findCenterFace = (state: string, label: string): FaceLetter => {
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

const normalizeCenters = (cube: string): { normalized: string; rotations: string[] } => {
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
const buildRelabel = (rotations: string[]): Record<FaceLetter, FaceLetter> => {
  const afterR = applyMoves(SOLVED_STANDARD, rotations);
  const map: Partial<Record<FaceLetter, FaceLetter>> = {};
  for (const f of FACES) map[f] = afterR[FACE_IDX[f]] as FaceLetter;
  return map as Record<FaceLetter, FaceLetter>;
};

const transformMoves = (
  moves: string[],
  relabel: Record<FaceLetter, FaceLetter>
): string[] =>
  moves.map((m) => {
    const face = m[0] as FaceLetter;
    return (relabel[face] ?? face) + m.slice(1);
  });

const initSolveCube = ({ get, set }: IStoreFn) => {
  const cube = get().cube;

  // 슬라이스 무브로 인해 센터가 회전됐을 수 있으므로 정규화 후 풀고 결과를 원본 좌표계로 매핑.
  const { normalized, rotations } = normalizeCenters(cube);
  const relabel = buildRelabel(rotations);

  const rawStages = solveLBL(normalized);
  const stages: LBLStage[] = rawStages.map((s) => ({
    ...s,
    moves: transformMoves(s.moves, relabel),
  }));
  const solution = stages.flatMap((s) => s.moves).filter((s) => s !== "");

  if (!solution || !solution.length) {
    set({ cubeSolution: [], cubeSolutionStep: null });
    throw new Error("Unsolveable cube");
  }

  // 색상 카운트는 맞지만 parity 위반 등으로 풀리지 않는 입력 차단.
  if (!isFullySolved(applyMoves(cube, solution))) {
    set({ cubeSolution: [], cubeSolutionStep: null });
    throw new Error("Unsolveable cube");
  }

  // 단계 자동 인식: 입력 큐브가 이미 일부 단계까지 푼 상태면 그 단계 도트는
  // 완료로 표시하고 다음 비빈 단계부터 진입. (예: 십자만 푼 상태로 들어오면
  // 도트 ●○○○○○○○ 가 아니라 ●●○○○○○○ 부터 시작)
  const firstNonEmptyIdx = stages.findIndex((s) => s.moves.length > 0);
  const initialStageIndex = firstNonEmptyIdx === -1 ? 0 : firstNonEmptyIdx;

  set({
    cubeSolution: solution,
    solveStages: stages,
    cubeSolutionStep: 0,
    currentStageIndex: initialStageIndex,
  });
  get().nextCubeSolveStep();
};

export default initSolveCube;
