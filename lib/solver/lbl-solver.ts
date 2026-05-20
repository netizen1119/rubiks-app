import { Vector3 } from "three";

/**
 * LBL (Layer-By-Layer) 솔버.
 *
 * 큐브 표현: 54자 문자열, 순서 U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53),
 * 각 면 좌상→우하 행 우선. 색상 라벨은 면 문자(U/R/F/D/L/B)로 표현되며
 * 센터 인덱스가 각 면의 목표 라벨을 정의한다.
 *
 * 정확성 전략:
 *  - 1단계(십자): 검증된 이동 엔진 위에서 전체 HTM IDDFS 탐색 → 구조적으로 정확.
 *  - 3·4단계(1·2층): 표준 트리거 결정론 루프.
 *  - 5~8단계(윗면/PLL): 표준 비기너 알고리즘 결정론 루프.
 * 이동 순열은 solve-thistlethwaite.ts 와 동일한 검증된 3D 기하 엔진으로 생성한다.
 */

export type LBLStage = {
  stageIndex: number;
  stageName: string;
  stageNameEn: string;
  moves: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// 이동 순열 엔진 (solve-thistlethwaite.ts 의 fmove 생성 로직 포팅 — 검증됨)
// ─────────────────────────────────────────────────────────────────────────────

type Predicate = (pos: Vector3) => boolean;
interface Sticker {
  pos: Vector3;
  dst: Vector3;
}
interface GMove {
  name: string;
  axis: Vector3;
  angle: number;
  predicate: Predicate;
}

const create_sticker = (pos: Vector3, dst?: Vector3): Sticker => ({ pos, dst: dst || pos });

const apply_sticker = (move: GMove, sticker: Sticker): Sticker =>
  move.predicate(sticker.pos)
    ? {
        ...sticker,
        pos: new Vector3()
          .copy(sticker.pos)
          .applyAxisAngle(move.axis, (-move.angle / 180) * Math.PI)
          .round(),
      }
    : sticker;

const create_gmove = (name: string, axis: Vector3, angle: number, predicate: Predicate): GMove => ({
  name,
  axis,
  angle,
  predicate,
});

type GCube = Sticker[];

const solved_gcube = (): GCube => {
  const stickers: GCube = [];
  for (const face of [3, -3]) {
    for (const coord1 of [-2, 0, 2]) {
      for (const coord2 of [-2, 0, 2]) {
        stickers.push(
          create_sticker(new Vector3(face, coord1, coord2)),
          create_sticker(new Vector3(coord1, face, coord2)),
          create_sticker(new Vector3(coord1, coord2, face))
        );
      }
    }
  }
  return stickers;
};

const apply_gmove = (cube: GCube, move: GMove) => cube.map((s) => apply_sticker(move, s));

const gmoves: Record<string, GMove> = (() => {
  const set = (n: string, axis: Vector3, p: Predicate) => [
    create_gmove(n, axis, 90, p),
    create_gmove(n + "2", axis, 180, p),
    create_gmove(n + "'", axis, 270, p),
  ];
  const U = set("U", new Vector3(0, 1, 0), (p) => p.y > 0);
  const D = set("D", new Vector3(0, -1, 0), (p) => p.y < 0);
  const y = set("y", new Vector3(0, 1, 0), () => true);
  const L = set("L", new Vector3(-1, 0, 0), (p) => p.x < 0);
  const R = set("R", new Vector3(1, 0, 0), (p) => p.x > 0);
  const M = set("M", new Vector3(-1, 0, 0), (p) => p.x === 0);
  const E = set("E", new Vector3(0, -1, 0), (p) => p.y === 0);
  const x = set("x", new Vector3(1, 0, 0), () => true);
  const F = set("F", new Vector3(0, 0, 1), (p) => p.z > 0);
  const B = set("B", new Vector3(0, 0, -1), (p) => p.z < 0);
  const S = set("S", new Vector3(0, 0, 1), (p) => p.z === 0);

  const out: Record<string, GMove> = {};
  [U, D, y, L, R, M, E, x, F, B, S].flat().forEach((m) => (out[m.name] = m));
  return out;
})();

const apply_gmoves = (gcube: GCube, moves: string) =>
  moves
    .trim()
    .split(/ +/)
    .filter(Boolean)
    .map((m) => gmoves[m])
    .reduce(apply_gmove, gcube);

const gcube_to_fcube_idx = (() => {
  const map: Record<string, number> = {};
  const repr = (v: Vector3) => v.x + "," + v.y + "," + v.z;
  const work = (rot: string, idx: number) => {
    for (const z of [-2, 0, 2]) {
      for (const x of [-2, 0, 2]) {
        const pos = apply_gmoves([create_sticker(new Vector3(x, 3, z))], rot)[0].pos;
        map[repr(pos)] = idx++;
      }
    }
    return idx;
  };
  const face_rotations = ["", "x' y'", "x'", "x2", "x' y", "x' y2"];
  face_rotations.forEach((rot, i) => work(rot, i * 9));
  return (vec: Vector3): number => map[repr(vec)];
})();

const convert_gmove_to_fmove = (gmove: GMove): [number, number][] =>
  apply_gmove(solved_gcube(), gmove)
    .map((s) => [gcube_to_fcube_idx(s.dst), gcube_to_fcube_idx(s.pos)] as [number, number])
    .filter(([a, b]) => a !== b);

const fmoves: Record<string, [number, number][]> = Object.fromEntries(
  Object.entries(gmoves).map(([k, v]) => [k, convert_gmove_to_fmove(v)])
);

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

// 이동별 사전계산 순열: src[t] = 결과 위치 t 가 가져올 원본 인덱스.
const PERM_SRC: Record<string, Uint8Array> = (() => {
  const out: Record<string, Uint8Array> = {};
  for (const [m, pairs] of Object.entries(fmoves)) {
    const arr = new Uint8Array(54);
    for (let i = 0; i < 54; i++) arr[i] = i;
    for (const [from, to] of pairs) arr[to] = from;
    out[m] = arr;
  }
  return out;
})();

/** 단일 이동 적용. 지원: U D F B L R M (+ ' / 2). */
export const applyMove = (cube: string, move: string): string => {
  const src = PERM_SRC[move];
  if (!src) throw new Error(`Unsupported move: ${move}`);
  const r = new Array<string>(54);
  for (let i = 0; i < 54; i++) r[i] = cube[src[i]];
  return r.join("");
};

/** 이동 수열 적용. */
export const applyMoves = (cube: string, moves: string[] | string): string => {
  const list = Array.isArray(moves) ? moves : moves.trim().split(/ +/).filter(Boolean);
  return list.reduce((c, m) => applyMove(c, m), cube);
};

/** 인덱스(0~53)의 색상 라벨 조회. */
export const getColor = (cube: string, idx: number): string => cube[idx];

const FACE_OFFSET: Record<string, number> = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };
type FaceLetter = keyof typeof FACE_OFFSET;

/** 면의 9칸 반환. */
export const getFace = (cube: string, face: FaceLetter): string[] =>
  cube.slice(FACE_OFFSET[face], FACE_OFFSET[face] + 9).split("");

/** 면 센터 라벨(목표색). */
const center = (cube: string, face: FaceLetter): string => cube[FACE_OFFSET[face] + 4];

// fcube-to-ifcube.ts 와 동일한 정본 facelet 기하.
type EdgeDef = { idx: [number, number]; faces: [FaceLetter, FaceLetter] };
const EDGES: EdgeDef[] = [
  { idx: [5, 10], faces: ["U", "R"] },
  { idx: [7, 19], faces: ["U", "F"] },
  { idx: [3, 37], faces: ["U", "L"] },
  { idx: [1, 46], faces: ["U", "B"] },
  { idx: [32, 16], faces: ["D", "R"] },
  { idx: [28, 25], faces: ["D", "F"] },
  { idx: [30, 43], faces: ["D", "L"] },
  { idx: [34, 52], faces: ["D", "B"] },
  { idx: [23, 12], faces: ["F", "R"] },
  { idx: [21, 41], faces: ["F", "L"] },
  { idx: [50, 39], faces: ["B", "L"] },
  { idx: [48, 14], faces: ["B", "R"] },
];

type CornerDef = { idx: [number, number, number]; faces: [FaceLetter, FaceLetter, FaceLetter] };
const CORNERS: CornerDef[] = [
  { idx: [8, 9, 20], faces: ["U", "R", "F"] },
  { idx: [6, 18, 38], faces: ["U", "F", "L"] },
  { idx: [0, 36, 47], faces: ["U", "L", "B"] },
  { idx: [2, 45, 11], faces: ["U", "B", "R"] },
  { idx: [29, 26, 15], faces: ["D", "F", "R"] },
  { idx: [27, 44, 24], faces: ["D", "L", "F"] },
  { idx: [33, 53, 42], faces: ["D", "B", "L"] },
  { idx: [35, 17, 51], faces: ["D", "R", "B"] },
];

const toMoves = (s: string): string[] => s.trim().split(/ +/).filter(Boolean);

// U 위에서 본 측면 인접(시계: F→R→B→L).
const RIGHT_OF: Record<string, FaceLetter> = { F: "R", R: "B", B: "L", L: "F" };
const LEFT_OF: Record<string, FaceLetter> = { F: "L", L: "B", B: "R", R: "F" };

const U_TIMES = (n: number): string[] => {
  const k = ((n % 4) + 4) % 4;
  return k === 0 ? [] : k === 1 ? ["U"] : k === 2 ? ["U2"] : ["U'"];
};

// ─────────────────────────────────────────────────────────────────────────────
// 단계 목표 판정 (누적 invariant)
// ─────────────────────────────────────────────────────────────────────────────

const crossSlots = EDGES.filter((e) => e.faces.includes("D"));
const isCrossSolved = (c: string): boolean =>
  crossSlots.every((e) =>
    e.idx.every((ix, k) => c[ix] === center(c, e.faces[k]))
  );

const dCorners = CORNERS.filter((cn) => cn.faces.includes("D"));
const isFirstLayer = (c: string): boolean =>
  isCrossSolved(c) &&
  dCorners.every((cn) => cn.idx.every((ix, k) => c[ix] === center(c, cn.faces[k])));

const eEdges = EDGES.filter((e) => !e.faces.includes("U") && !e.faces.includes("D"));
const isSecondLayer = (c: string): boolean =>
  isFirstLayer(c) &&
  eEdges.every((e) => e.idx.every((ix, k) => c[ix] === center(c, e.faces[k])));

const isYellowCross = (c: string): boolean =>
  isSecondLayer(c) && [1, 3, 5, 7].every((i) => c[i] === center(c, "U"));

const isYellowFace = (c: string): boolean =>
  isSecondLayer(c) && getFace(c, "U").every((x) => x === center(c, "U"));

const uCorners = CORNERS.filter((cn) => cn.faces.includes("U"));
const isCornersPermuted = (c: string): boolean =>
  isYellowFace(c) &&
  uCorners.every((cn) => cn.idx.every((ix, k) => c[ix] === center(c, cn.faces[k])));

const isCubeSolved = (c: string): boolean =>
  (Object.keys(FACE_OFFSET) as FaceLetter[]).every((f) =>
    getFace(c, f).every((x) => x === center(c, f))
  );

/** 외부(테스트) 진단용: 각 단계 완료 후 만족해야 할 누적 invariant. */
export const STAGE_GOALS: ((c: string) => boolean)[] = [
  isCrossSolved,
  isCrossSolved,
  isFirstLayer,
  isSecondLayer,
  isYellowCross,
  isYellowFace,
  isCornersPermuted,
  isCubeSolved,
];

// ─────────────────────────────────────────────────────────────────────────────
// 1단계: 십자 — 전체 HTM IDDFS 탐색 (구조적으로 정확)
// ─────────────────────────────────────────────────────────────────────────────

const HTM = [
  "U",
  "U'",
  "U2",
  "D",
  "D'",
  "D2",
  "F",
  "F'",
  "F2",
  "B",
  "B'",
  "B2",
  "L",
  "L'",
  "L2",
  "R",
  "R'",
  "R2",
];

// 크로스 4엣지 상태키: 측면 F,R,B,L 각각의 (D-X 엣지 위치*2 + 방향).
const crossKey = (c: string): string => {
  const parts: number[] = [];
  for (const X of ["F", "R", "B", "L"]) {
    let loc = -1;
    let ori = 0;
    for (let i = 0; i < EDGES.length; i++) {
      const [i0, i1] = EDGES[i].idx;
      const a = c[i0];
      const b = c[i1];
      if ((a === "D" && b === X) || (a === X && b === "D")) {
        loc = i;
        ori = a === "D" ? 0 : 1;
        break;
      }
    }
    parts.push(loc * 2 + ori);
  }
  return parts.join(",");
};

// 모듈 로드 시 1회: SOLVED 에서 BFS 로 모든 크로스 상태의 최단 거리 테이블 구축.
const crossDist: Map<string, number> = (() => {
  const SOLVED =
    "UUUUUUUUU" + "RRRRRRRRR" + "FFFFFFFFF" + "DDDDDDDDD" + "LLLLLLLLL" + "BBBBBBBBB";
  const dist = new Map<string, number>();
  let frontier = [SOLVED];
  dist.set(crossKey(SOLVED), 0);
  let d = 0;
  while (frontier.length) {
    const next: string[] = [];
    for (const cube of frontier) {
      for (const m of HTM) {
        const nc = applyMove(cube, m);
        const k = crossKey(nc);
        if (!dist.has(k)) {
          dist.set(k, d + 1);
          next.push(nc);
        }
      }
    }
    frontier = next;
    d++;
  }
  return dist;
})();

// 거리 테이블을 따라 한 칸씩 내려가 최적 크로스 해법 산출.
const solveCross = (start: string): string[] => {
  let cube = start;
  const out: string[] = [];
  let guard = 0;
  while (!isCrossSolved(cube) && guard++ < 30 && !timeUp()) {
    const cur = crossDist.get(crossKey(cube)) ?? Infinity;
    let picked: string | null = null;
    for (const m of HTM) {
      const nc = applyMove(cube, m);
      if ((crossDist.get(crossKey(nc)) ?? Infinity) < cur) {
        picked = m;
        cube = nc;
        break;
      }
    }
    if (!picked) break;
    out.push(picked);
  }
  return out;
};

// ─────────────────────────────────────────────────────────────────────────────
// 결정론 루프 공통
// ─────────────────────────────────────────────────────────────────────────────

// 데드라인 가드: parity 위반 등 풀 수 없는 입력에서 탐색이 깊이 한계까지
// 전수 탐색하며 사실상 멈추는 것을 방지(무한루프/행 방지). solveLBL 진입 시 설정.
let SOLVE_DEADLINE = Infinity;
const timeUp = (): boolean => Date.now() > SOLVE_DEADLINE;

// 제한 이동집합 한정 IDDFS (목표 술어 충족 수열 탐색). 같은 면 연속 금지.
const searchRestricted = (
  start: string,
  isGoal: (c: string) => boolean,
  moveSet: string[],
  maxDepth: number
): string[] | null => {
  if (isGoal(start)) return [];
  const path: string[] = [];
  const dfs = (cube: string, depth: number, prevFace: string): boolean => {
    if (isGoal(cube)) return true;
    if (depth === 0 || timeUp()) return false;
    for (const m of moveSet) {
      if (m[0] === prevFace) continue;
      path.push(m);
      if (dfs(applyMove(cube, m), depth - 1, m[0])) return true;
      path.pop();
    }
    return false;
  };
  for (let d = 1; d <= maxDepth; d++) {
    if (timeUp()) break;
    if (dfs(start, d, "")) return [...path];
  }
  return null;
};

const moveSetOf = (...faces: string[]): string[] =>
  faces.flatMap((f) => [f, f + "'", f + "2"]);

// 매크로 탐색: (U^r 사전회전 + 고정 알고리즘) 조합으로 목표 도달.
// 알고리즘들이 F2L/이전 단계를 보존하면 결과 전체도 보존(구조적 정확).
const macroSearch = (
  start: string,
  isGoal: (c: string) => boolean,
  algs: string[][],
  maxMacros: number
): string[] | null => {
  const rec = (cube: string, depth: number): string[] | null => {
    if (isGoal(cube)) return [];
    if (depth === 0 || timeUp()) return null;
    for (let r = 0; r < 4; r++) {
      const pre = U_TIMES(r);
      for (const alg of algs) {
        const seq = [...pre, ...alg];
        if (seq.length === 0) continue;
        const rest = rec(applyMoves(cube, seq), depth - 1);
        if (rest !== null) return [...seq, ...rest];
      }
    }
    return null;
  };
  for (let d = 0; d <= maxMacros; d++) {
    const r = rec(start, d);
    if (r !== null) return r;
  }
  return null;
};

const drive = (
  start: string,
  isDone: (c: string) => boolean,
  step: (c: string) => string[] | null,
  maxIter: number
): string[] => {
  let cube = start;
  const out: string[] = [];
  let it = 0;
  while (!isDone(cube) && it < maxIter && !timeUp()) {
    const mv = step(cube);
    if (!mv || mv.length === 0) break;
    out.push(...mv);
    cube = applyMoves(cube, mv);
    it++;
  }
  return out;
};

// 특정 색쌍의 엣지가 현재 어느 EdgeDef 위치에 있는지.
const findEdge = (c: string, a: string, b: string): { def: EdgeDef; aAt: number } | null => {
  for (const e of EDGES) {
    const c0 = c[e.idx[0]];
    const c1 = c[e.idx[1]];
    if ((c0 === a && c1 === b) || (c0 === b && c1 === a)) {
      return { def: e, aAt: c0 === a ? e.idx[0] : e.idx[1] };
    }
  }
  return null;
};

const findCorner = (c: string, cols: string[]): { def: CornerDef } | null => {
  const want = [...cols].sort().join("");
  for (const cn of CORNERS) {
    const have = cn.idx
      .map((ix) => c[ix])
      .sort()
      .join("");
    if (have === want) return { def: cn };
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3단계: 1층 코너 — 슬롯별 트리거 반복
// ─────────────────────────────────────────────────────────────────────────────

const cornerSolved = (c: string, cn: CornerDef): boolean =>
  cn.idx.every((ix, k) => c[ix] === center(c, cn.faces[k]));

const solvedCornerSet = (c: string): CornerDef[] => dCorners.filter((cn) => cornerSolved(c, cn));

// 2층과 동일한 슬롯 한정 IDDFS — 케이스별 최단 삽입(구조적 정확).
const solveFirstLayerCorners = (start: string): string[] => {
  return drive(
    start,
    isFirstLayer,
    (cube) => {
      const locked = solvedCornerSet(cube);
      const preserved = (c: string) =>
        isCrossSolved(c) && locked.every((cn) => cornerSolved(c, cn));

      // 1) U층에 있는 대상 코너를 슬롯 면집합 한정 탐색으로 삽입.
      for (const slot of dCorners) {
        if (cornerSolved(cube, slot)) continue;
        const want = slot.faces.map((f) => center(cube, f));
        const found = findCorner(cube, want);
        if (!found || !found.def.faces.includes("U")) continue;
        const [fx, fy] = slot.faces.filter((f) => f !== "D") as FaceLetter[];
        const set = moveSetOf("U", fx, fy);
        const goal = (c: string) => preserved(c) && cornerSolved(c, slot);
        const sol = searchRestricted(cube, goal, set, 10);
        if (sol && sol.length) return sol;
      }

      // 2) 대상 코너가 모두 잘못된 하단 슬롯에 끼어 있으면 한정 탐색으로 추출.
      for (const slot of dCorners) {
        if (cornerSolved(cube, slot)) continue;
        const want = slot.faces.map((f) => center(cube, f));
        const found = findCorner(cube, want);
        if (!found || found.def.faces.includes("U")) continue;
        const [gx, gy] = found.def.faces.filter((f) => f !== "D") as FaceLetter[];
        const set = moveSetOf("U", gx, gy);
        const goal = (c: string) => {
          if (!isCrossSolved(c) || !locked.every((cn) => cornerSolved(c, cn))) return false;
          const fc = findCorner(c, want);
          return !!fc && fc.def.faces.includes("U");
        };
        const sol = searchRestricted(cube, goal, set, 7);
        if (sol && sol.length) return sol;
      }
      return null;
    },
    24
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 4단계: 2층 엣지
// ─────────────────────────────────────────────────────────────────────────────

const edgeSolved = (c: string, e: EdgeDef): boolean =>
  e.idx.every((ix, k) => c[ix] === center(c, e.faces[k]));

const solvedEdgeSet = (c: string): EdgeDef[] => eEdges.filter((e) => edgeSolved(c, e));

const solveSecondLayer = (start: string): string[] => {
  const Uc = center(start, "U");
  return drive(
    start,
    isSecondLayer,
    (cube) => {
      const locked = solvedEdgeSet(cube);
      const preserved = (c: string) =>
        isFirstLayer(c) && locked.every((e) => edgeSolved(c, e));

      // 1) U층에 떠 있는(U색 없는) E 엣지를 그 슬롯 면집합으로 한정 탐색해 삽입.
      const uSlots = EDGES.filter((e) => e.faces.includes("U"));
      for (const e of uSlots) {
        const c0 = cube[e.idx[0]];
        const c1 = cube[e.idx[1]];
        if (c0 === Uc || c1 === Uc) continue;
        const target = eEdges.find(
          (t) => [c0, c1].every((col) => t.faces.some((f) => center(cube, f) === col))
        );
        if (!target || edgeSolved(cube, target)) continue;
        const [fx, fy] = target.faces;
        const set = moveSetOf("U", fx, fy);
        const goal = (c: string) => preserved(c) && edgeSolved(c, target);
        const sol = searchRestricted(cube, goal, set, 9);
        if (sol && sol.length) return sol;
      }

      // 2) U층에 후보가 없으면 잘못 낀 E 엣지를 한정 탐색으로 U층에 추출.
      for (const e of eEdges) {
        if (edgeSolved(cube, e)) continue;
        const [fx, fy] = e.faces;
        const set = moveSetOf("U", fx, fy);
        const goal = (c: string) => {
          if (!isFirstLayer(c)) return false;
          if (!locked.every((le) => edgeSolved(c, le))) return false;
          // e 위치의 엣지가 U층으로 빠졌는지: 해당 슬롯에 U색이 등장.
          return c[e.idx[0]] === Uc || c[e.idx[1]] === Uc;
        };
        const sol = searchRestricted(cube, goal, set, 8);
        if (sol && sol.length) return sol;
      }
      return null;
    },
    24
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 5단계: 노란 십자 (F R U R' U' F')
// ─────────────────────────────────────────────────────────────────────────────

const FRURUF = toMoves("F R U R' U' F'");

const solveYellowCross = (start: string): string[] =>
  macroSearch(start, isYellowCross, [FRURUF], 6) ?? [];

// ─────────────────────────────────────────────────────────────────────────────
// 6단계: 노란 면 (Sune / Antisune)
// ─────────────────────────────────────────────────────────────────────────────

const SUNE = toMoves("R U R' U R U2 R'");
const ANTISUNE = toMoves("R U2 R' U' R U' R'");

const solveYellowFace = (start: string): string[] =>
  macroSearch(start, isYellowFace, [SUNE, ANTISUNE], 8) ?? [];

// ─────────────────────────────────────────────────────────────────────────────
// 7단계: 3층 코너 배치 (F2L·방향 보존 3-cycle)
// ─────────────────────────────────────────────────────────────────────────────

// 이 엔진은 표기 핸드니스가 표준과 다를 수 있으므로, 표준 알고리즘 문자열이
// "방향·F2L 보존 순수 3-cycle"로 실제 동작하는지 SOLVED 에서 검증해 선별한다.
const SOLVED_STR =
  "UUUUUUUUU" + "RRRRRRRRR" + "FFFFFFFFF" + "DDDDDDDDD" + "LLLLLLLLL" + "BBBBBBBBB";

// U층 코너 측면 sticker 집합 / U층 엣지 측면 sticker 집합.
const U_CORNER_SIDE = new Set([9, 20, 18, 38, 36, 47, 45, 11]);
const U_EDGE_SIDE = new Set([10, 19, 37, 46]);

const isPureCornerPerm = (alg: string[]): boolean => {
  const c = applyMoves(SOLVED_STR, alg);
  for (let i = 0; i < 54; i++) {
    if (c[i] === SOLVED_STR[i]) continue;
    if (!U_CORNER_SIDE.has(i)) return false; // U면/F2L/엣지 변화 → 불순
  }
  // U면 9칸 모두 U (방향 보존), 최소 6칸(3코너) 순환.
  return c.slice(0, 9) === "UUUUUUUUU" && c !== SOLVED_STR;
};

const isPureEdgePerm = (alg: string[]): boolean => {
  const c = applyMoves(SOLVED_STR, alg);
  for (let i = 0; i < 54; i++) {
    if (c[i] === SOLVED_STR[i]) continue;
    if (!U_EDGE_SIDE.has(i)) return false;
  }
  return c.slice(0, 9) === "UUUUUUUUU" && c !== SOLVED_STR;
};

// 후보 A-perm(코너 3-cycle) — 정·역·거울 변형 다수.
const CORNER_CANDS = [
  "R' F R' B2 R F' R' B2 R2",
  "R2 B2 R' F R' B2 R F' R'",
  "L F' L B2 L' F L B2 L2",
  "L2 B2 L F' L B2 L' F L",
  "F R' F L2 F' R F L2 F2",
  "R B' R' F2 R B R' F2 R2",
].map(toMoves);
// 후보 U-perm(엣지 3-cycle).
const EDGE_CANDS = [
  "R2 U R U R' U' R' U' R' U R'",
  "R U' R U R U R U' R' U' R2",
  "R2 U' R' U' R U R U R U' R",
  "L2 U' L' U' L U L U L U' L",
].map(toMoves);

const CORNER_3CYCLES = CORNER_CANDS.filter(isPureCornerPerm);
const EDGE_3CYCLES = EDGE_CANDS.filter(isPureEdgePerm);

const solveCornerPerm = (start: string): string[] =>
  macroSearch(
    start,
    (c) => isCornersPermuted(c) || isCubeSolved(c),
    CORNER_3CYCLES.length ? CORNER_3CYCLES : CORNER_CANDS,
    6
  ) ?? [];

// ─────────────────────────────────────────────────────────────────────────────
// 8단계: 3층 엣지 배치 (M 미사용 — U-perm)
// ─────────────────────────────────────────────────────────────────────────────

const solveEdgePerm = (start: string): string[] =>
  macroSearch(start, isCubeSolved, EDGE_3CYCLES.length ? EDGE_3CYCLES : EDGE_CANDS, 6) ?? [];

// ─────────────────────────────────────────────────────────────────────────────
// 진입점
// ─────────────────────────────────────────────────────────────────────────────

export const solveLBL = (cube: string): LBLStage[] => {
  SOLVE_DEADLINE = Date.now() + 7000;
  try {
    let state = cube;
    const stages: LBLStage[] = [];
    const run = (fn: (s: string) => string[], idx: number, name: string, nameEn: string) => {
      const moves = fn(state);
      stages.push({ stageIndex: idx, stageName: name, stageNameEn: nameEn, moves });
      state = applyMoves(state, moves);
    };

    run(solveCross, 1, "1단계: 십자를 맞춘다", "White Cross");
    run(() => [], 2, "2단계: 십자 모서리를 정렬한다", "Align Cross");
    run(solveFirstLayerCorners, 3, "3단계: 1층 코너를 맞춘다", "First Layer");
    run(solveSecondLayer, 4, "4단계: 2층을 맞춘다", "Second Layer");
    run(solveYellowCross, 5, "5단계: 윗면 십자를 맞춘다", "Yellow Cross");
    run(solveYellowFace, 6, "6단계: 윗면을 맞춘다", "Yellow Face");
    run(solveCornerPerm, 7, "7단계: 3층 코너를 맞춘다", "Corner Perm");
    run(solveEdgePerm, 8, "8단계: 3층 엣지를 맞춘다", "Edge Perm");

    return stages;
  } finally {
    SOLVE_DEADLINE = Infinity;
  }
};
