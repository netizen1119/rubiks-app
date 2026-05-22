import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyMoves } from "./lbl-solver.ts";
import { SOLVED_STANDARD } from "./normalize.ts";
import { autoOrientCube, isSolvableState, faceGridOf, _internals } from "./auto-orient.ts";
import type { ICubeSide } from "../../types/types.ts";

const SIDES: ICubeSide[] = ["U", "R", "F", "D", "L", "B"];
const MOVES = ["U", "U'", "U2", "D", "D'", "D2", "R", "R'", "R2", "L", "L'", "L2", "F", "F'", "F2", "B", "B'", "B2"];

// 결정적 PRNG (재현 가능)
const mkRng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const scramble = (rng: () => number, n = 25): string => {
  const seq: string[] = [];
  for (let i = 0; i < n; i++) seq.push(MOVES[Math.floor(rng() * MOVES.length)]);
  return applyMoves(SOLVED_STANDARD, seq);
};

describe("isSolvableState", () => {
  test("solved is solvable", () => {
    assert.equal(isSolvableState(SOLVED_STANDARD), true);
  });

  test("200 random valid scrambles are all solvable", () => {
    const rng = mkRng(1);
    for (let i = 0; i < 200; i++) {
      const cube = scramble(rng, 20 + (i % 15));
      assert.equal(isSolvableState(cube), true, `scramble ${i} should be solvable`);
    }
  });

  test("single edge flip is rejected (EO parity)", () => {
    // U면-F면 사이 엣지 한 개의 두 facelet 색을 맞바꿔 방향만 뒤집음.
    const c = SOLVED_STANDARD.split("");
    // UF 엣지: U면 하단중앙(인덱스 7) ↔ F면 상단중앙(인덱스 18+1=19)
    [c[7], c[19]] = [c[19], c[7]];
    assert.equal(isSolvableState(c.join("")), false);
  });

  test("single corner twist is rejected (CO parity)", () => {
    const rng = mkRng(7);
    const cube = scramble(rng, 20).split("");
    // 첫 코너의 3 facelet 색을 순환(비틀기) → CO 합이 0이 아니게 됨.
    const { buildPieceModel } = _internals;
    const m = buildPieceModel();
    const [a, b, d] = m.corners[0].idxs;
    const t = cube[a];
    cube[a] = cube[b];
    cube[b] = cube[d];
    cube[d] = t;
    assert.equal(isSolvableState(cube.join("")), false);
  });
});

describe("autoOrientCube round-trip", () => {
  test("recovers original cube from randomly rotated faces (no mirror)", () => {
    const rng = mkRng(42);
    for (let i = 0; i < 100; i++) {
      const cube = scramble(rng, 20 + (i % 12));
      const faces: Partial<Record<ICubeSide, string[]>> = {};
      for (const s of SIDES) faces[s] = _internals.rotN(faceGridOf(cube, s), Math.floor(rng() * 4));
      const out = autoOrientCube(faces);
      assert.equal(out, cube, `case ${i}: should recover original`);
    }
  });

  test("recovered cube is always a valid solvable state", () => {
    const rng = mkRng(99);
    for (let i = 0; i < 80; i++) {
      const cube = scramble(rng, 18 + (i % 10));
      const faces: Partial<Record<ICubeSide, string[]>> = {};
      for (const s of SIDES) faces[s] = _internals.rotN(faceGridOf(cube, s), Math.floor(rng() * 4));
      const out = autoOrientCube(faces);
      assert.ok(out && isSolvableState(out), `case ${i}: recovered must be solvable`);
    }
  });

  test("returns null when a face center is wrong", () => {
    const cube = scramble(mkRng(5), 20);
    const faces: Partial<Record<ICubeSide, string[]>> = {};
    for (const s of SIDES) faces[s] = faceGridOf(cube, s);
    faces.U![4] = "R"; // 센터 손상
    assert.equal(autoOrientCube(faces), null);
  });
});
