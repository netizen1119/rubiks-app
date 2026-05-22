// 자동 방향 인식: 사용자가 각 면을 아무 방향으로 비춰도, 면별 회전(4)과 전역 미러(2)를
// 전수 탐색해 "풀 수 있는 유일한 배치"를 찾아 표준 URFDLB 문자열을 만든다.
// 솔버를 돌리지 않고 조합론적 유효성(피스 집합 + 순열 패리티)으로 안전하게 검증한다.

import type { ICubeSide } from "../../types/types.ts";

const SIDES: ICubeSide[] = ["U", "R", "F", "D", "L", "B"]; // 문자열 슬롯 순서
const SOLVED = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

// getCubePosBySide(cube-pos-by-side.ts) 의 순수 복제 — THREE 의존 없이 테스트 가능.
// facePos(문자열 좌상→우하) → 큐비 위치(x,y,z ∈ {0,1,2}).
const REV = [2, 1, 0];
const cubePos = (side: ICubeSide, fx: number, fy: number): { x: number; y: number; z: number } => {
  switch (side) {
    case "F":
      return { x: fx, y: REV[fy], z: 2 };
    case "B":
      return { x: REV[fx], y: REV[fy], z: 0 };
    case "D":
      return { x: fx, y: 0, z: REV[fy] };
    case "R":
      return { x: 2, y: REV[fy], z: REV[fx] };
    case "L":
      return { x: 0, y: REV[fy], z: fx };
    case "U":
      return { x: fx, y: 2, z: fy };
    default:
      return { x: 0, y: 0, z: 0 };
  }
};

// ── 3x3 그리드(9칸, 행 우선) 변환 ──
const rot90 = (g: string[]): string[] => {
  // 시계방향: new(r,c) = old(2-c, r)
  const n = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) n[r * 3 + c] = g[(2 - c) * 3 + r];
  return n;
};
const rotN = (g: string[], times: number): string[] => {
  let r = g.slice();
  for (let t = 0; t < (times % 4); t++) r = rot90(r);
  return r;
};
const mirrorCols = (g: string[]): string[] => {
  const n = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) n[r * 3 + c] = g[r * 3 + (2 - c)];
  return n;
};

// ── 피스(엣지/코너) facelet 모델: 기하학적으로 도출 (문자열 규약과 일치) ──
const faceAxis = (s: ICubeSide): "x" | "y" | "z" => (s === "U" || s === "D" ? "y" : s === "R" || s === "L" ? "x" : "z");
const sideOfIdx = (idx: number): ICubeSide => SIDES[Math.floor(idx / 9)];

type EdgeSlot = { idxs: number[]; ref: number }; // ref: 기준 위치(U/D 면, 없으면 F/B 면)
type CornerSlot = { idxs: number[]; cyc: number[] }; // cyc: CW 순서, cyc[0]=U/D facelet

type PieceModel = { edges: EdgeSlot[]; corners: CornerSlot[] };

const buildPieceModel = (): PieceModel => {
  const byPos = new Map<string, { idx: number; p: { x: number; y: number; z: number } }[]>();
  SIDES.forEach((side, si) => {
    for (let j = 0; j < 9; j++) {
      if (j === 4) continue; // 센터 제외
      const p = cubePos(side, j % 3, Math.floor(j / 3));
      const key = `${p.x},${p.y},${p.z}`;
      const arr = byPos.get(key) || [];
      arr.push({ idx: si * 9 + j, p });
      byPos.set(key, arr);
    }
  });

  const edges: EdgeSlot[] = [];
  const corners: CornerSlot[] = [];
  byPos.forEach((cells) => {
    if (cells.length === 2) {
      // 기준 위치: U/D 면이 있으면 그것, 없으면(E슬라이스) F/B 면.
      const ud = cells.find((c) => faceAxis(sideOfIdx(c.idx)) === "y");
      const ref = ud ?? cells.find((c) => faceAxis(sideOfIdx(c.idx)) === "z")!;
      edges.push({ idxs: cells.map((c) => c.idx), ref: ref.idx });
    } else if (cells.length === 3) {
      const p = cells[0].p; // 코너 위치 (모두 동일)
      const sx = p.x === 2 ? 1 : -1;
      const sy = p.y === 2 ? 1 : -1;
      const sz = p.z === 2 ? 1 : -1;
      const byAxis = (ax: "x" | "y" | "z") => cells.find((c) => faceAxis(sideOfIdx(c.idx)) === ax)!.idx;
      const yF = byAxis("y");
      const xF = byAxis("x");
      const zF = byAxis("z");
      // 외부에서 본 CW 순서. 부호 s 로 방향 결정(테스트로 검증).
      const cyc = sx * sy * sz > 0 ? [yF, xF, zF] : [yF, zF, xF];
      corners.push({ idxs: cells.map((c) => c.idx), cyc });
    }
  });
  return { edges, corners };
};

const pieceKey = (cube: string, idxs: number[]): string =>
  idxs
    .map((i) => cube[i])
    .sort()
    .join("");

const model = buildPieceModel();
// 표준(solved) 기준 피스 색조합 → 캐논 인덱스. 후보 큐브의 각 슬롯이 어떤 피스인지 식별.
const canonCorner = new Map<string, number>();
model.corners.forEach((c, i) => canonCorner.set(pieceKey(SOLVED, c.idxs), i));
const canonEdge = new Map<string, number>();
model.edges.forEach((e, i) => canonEdge.set(pieceKey(SOLVED, e.idxs), i));

// 순열 부호(짝/홀): 짝수길이 사이클 → 부호 반전.
const permSign = (arr: number[]): number => {
  const seen = new Array(arr.length).fill(false);
  let sign = 1;
  for (let i = 0; i < arr.length; i++) {
    if (seen[i]) continue;
    let j = i;
    let len = 0;
    while (!seen[j]) {
      seen[j] = true;
      j = arr[j];
      len++;
    }
    if (len % 2 === 0) sign = -sign;
  }
  return sign;
};

/**
 * 조합론적 풀이 가능성 검사.
 * 1) 6색 각 9개  2) 12엣지/8코너가 캐논 집합과 일대일  3) 코너 순열 패리티 == 엣지 순열 패리티
 * 4) 코너 방향합 ≡ 0 (mod 3)  5) 엣지 방향합 ≡ 0 (mod 2).
 */
export const isSolvableState = (cube: string): boolean => {
  if (cube.length !== 54) return false;

  // 1) 색 개수
  const cnt: Record<string, number> = {};
  for (const ch of cube) cnt[ch] = (cnt[ch] || 0) + 1;
  for (const s of SIDES) if (cnt[s] !== 9) return false;

  // 2) 코너 일대일 + 4) 코너 방향합
  const cornerPerm: number[] = new Array(8);
  const cSeen = new Array(8).fill(false);
  let coSum = 0;
  for (let k = 0; k < model.corners.length; k++) {
    const c = model.corners[k];
    const ci = canonCorner.get(pieceKey(cube, c.idxs));
    if (ci === undefined || cSeen[ci]) return false;
    cSeen[ci] = true;
    cornerPerm[k] = ci;
    // CO: U/D 색 스티커가 cyc 상 어느 위치(0=U/D슬롯)에 있는지.
    const co = c.cyc.findIndex((i) => cube[i] === "U" || cube[i] === "D");
    if (co < 0) return false;
    coSum += co;
  }
  if (coSum % 3 !== 0) return false;

  // 3) 엣지 일대일 + 5) 엣지 방향합
  const edgePerm: number[] = new Array(12);
  const eSeen = new Array(12).fill(false);
  let eoSum = 0;
  for (let k = 0; k < model.edges.length; k++) {
    const e = model.edges[k];
    const ei = canonEdge.get(pieceKey(cube, e.idxs));
    if (ei === undefined || eSeen[ei]) return false;
    eSeen[ei] = true;
    edgePerm[k] = ei;
    // EO: 이 엣지의 주색(UD색 있으면 그것, 없으면 FB색)이 기준 위치에 있으면 0.
    const [c0, c1] = [cube[e.idxs[0]], cube[e.idxs[1]]];
    const primary = c0 === "U" || c0 === "D" || c1 === "U" || c1 === "D"
      ? (c0 === "U" || c0 === "D" ? c0 : c1)
      : (c0 === "F" || c0 === "B" ? c0 : c1);
    if (cube[e.ref] !== primary) eoSum += 1;
  }
  if (eoSum % 2 !== 0) return false;

  // 순열 패리티 일치
  return permSign(cornerPerm) === permSign(edgePerm);
};

// 한 면 9칸 그리드를 문자열 슬롯에 써넣기.
const writeFace = (out: string[], side: ICubeSide, grid: string[]) => {
  const base = SIDES.indexOf(side) * 9;
  for (let j = 0; j < 9; j++) out[base + j] = grid[j];
};

export type ScannedFaces = Partial<Record<ICubeSide, string[]>>;

/**
 * 캡처된 6면(각 9칸, 센터=면 색)을 받아 면별 회전(4^6)을 전수 탐색해
 * 풀 수 있는 표준 문자열을 반환. 못 찾으면 null.
 *
 * 주의: 전역 미러(좌우 반전)는 탐색하지 않는다 — 거울상 큐브도 "풀 수 있는" 유효
 * 상태라 색만으로는 구분 불가하기 때문(엉뚱한 거울상을 고를 위험). 미러는 캡처
 * 파이프라인(use-get-scanned-colors 의 MIRROR_SAMPLE_COLUMNS)에서 한 번 고정한다.
 */
export const autoOrientCube = (faces: ScannedFaces): string | null => {
  // 6면이 모두 있고 각 센터가 자기 면 색인지 확인.
  for (const s of SIDES) {
    const g = faces[s];
    if (!g || g.length !== 9 || g[4] !== s) return null;
  }

  const out = new Array(54);
  for (let a = 0; a < 4; a++) {
    const gU = rotN(faces.U!, a);
    for (let b = 0; b < 4; b++) {
      const gR = rotN(faces.R!, b);
      for (let c = 0; c < 4; c++) {
        const gF = rotN(faces.F!, c);
        for (let d = 0; d < 4; d++) {
          const gD = rotN(faces.D!, d);
          for (let e = 0; e < 4; e++) {
            const gL = rotN(faces.L!, e);
            for (let f = 0; f < 4; f++) {
              const gB = rotN(faces.B!, f);
              writeFace(out, "U", gU);
              writeFace(out, "R", gR);
              writeFace(out, "F", gF);
              writeFace(out, "D", gD);
              writeFace(out, "L", gL);
              writeFace(out, "B", gB);
              const cube = out.join("");
              if (isSolvableState(cube)) return cube;
            }
          }
        }
      }
    }
  }
  return null;
};

// 테스트/유틸: 표준 문자열에서 한 면의 9칸 그리드 추출.
export const faceGridOf = (cube: string, side: ICubeSide): string[] => {
  const base = SIDES.indexOf(side) * 9;
  return cube.slice(base, base + 9).split("");
};

export const _internals = { rot90, rotN, mirrorCols, buildPieceModel, permSign };
