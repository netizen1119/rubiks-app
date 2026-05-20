import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyMove, applyMoves, solveLBL } from "./lbl-solver.ts";
import {
  normalizeCenters,
  buildRelabel,
  transformMoves,
  isFullySolved,
  SOLVED_STANDARD,
} from "./normalize.ts";

describe("applyMove / applyMoves", () => {
  test("solved cube stays solved on no-op", () => {
    assert.equal(applyMoves(SOLVED_STANDARD, []), SOLVED_STANDARD);
  });

  test("R then R' returns to solved", () => {
    const after = applyMoves(SOLVED_STANDARD, ["R", "R'"]);
    assert.equal(after, SOLVED_STANDARD);
  });

  test("R2 then R2 returns to solved", () => {
    const after = applyMoves(SOLVED_STANDARD, ["R2", "R2"]);
    assert.equal(after, SOLVED_STANDARD);
  });

  test("U4 = identity", () => {
    const after = applyMoves(SOLVED_STANDARD, ["U", "U", "U", "U"]);
    assert.equal(after, SOLVED_STANDARD);
  });

  test("supports slice moves M, E, S", () => {
    // M M' = identity
    assert.equal(applyMoves(SOLVED_STANDARD, ["M", "M'"]), SOLVED_STANDARD);
    // E E' = identity
    assert.equal(applyMoves(SOLVED_STANDARD, ["E", "E'"]), SOLVED_STANDARD);
    // S S' = identity
    assert.equal(applyMoves(SOLVED_STANDARD, ["S", "S'"]), SOLVED_STANDARD);
  });
});

describe("solveLBL", () => {
  test("returns empty stages for solved cube", () => {
    const stages = solveLBL(SOLVED_STANDARD);
    const totalMoves = stages.flatMap((s) => s.moves).filter((s) => s !== "");
    assert.equal(totalMoves.length, 0);
  });

  test("solves simple R", () => {
    const scrambled = applyMove(SOLVED_STANDARD, "R");
    const stages = solveLBL(scrambled);
    const solution = stages.flatMap((s) => s.moves).filter((s) => s !== "");
    const final = applyMoves(scrambled, solution);
    assert.equal(isFullySolved(final), true);
  });

  test("solves Sune", () => {
    const sune = ["R", "U", "R'", "U", "R", "U2", "R'"];
    const scrambled = applyMoves(SOLVED_STANDARD, sune);
    const stages = solveLBL(scrambled);
    const solution = stages.flatMap((s) => s.moves).filter((s) => s !== "");
    const final = applyMoves(scrambled, solution);
    assert.equal(isFullySolved(final), true);
  });

  test("solves T-perm", () => {
    const tperm = [
      "R", "U", "R'", "U'", "R'", "F", "R2", "U'", "R'", "U'", "R", "U", "R'", "F'",
    ];
    const scrambled = applyMoves(SOLVED_STANDARD, tperm);
    const stages = solveLBL(scrambled);
    const solution = stages.flatMap((s) => s.moves).filter((s) => s !== "");
    const final = applyMoves(scrambled, solution);
    assert.equal(isFullySolved(final), true);
  });

  test("each stage's moves are face moves only (U/D/F/B/L/R)", () => {
    const scrambled = applyMoves(SOLVED_STANDARD, [
      "R", "U", "R'", "U'", "F2", "B", "L", "D",
    ]);
    const stages = solveLBL(scrambled);
    for (const s of stages) {
      for (const m of s.moves) {
        if (m === "") continue;
        assert.ok(
          ["U", "D", "F", "B", "L", "R"].includes(m[0]),
          `unexpected move face: ${m}`
        );
      }
    }
  });
});

describe("normalize pipeline (slice scrambles)", () => {
  const verify = (label: string, moves: string[]) => {
    const cube = applyMoves(SOLVED_STANDARD, moves);
    const { normalized, rotations } = normalizeCenters(cube);
    const relabel = buildRelabel(rotations);
    const rawStages = solveLBL(normalized);
    const sol = rawStages.flatMap((s) => s.moves).filter((s) => s !== "");
    const transformed = transformMoves(sol, relabel);
    const final = applyMoves(cube, transformed);
    assert.equal(isFullySolved(final), true, `${label} failed`);
  };

  test("M", () => verify("M", ["M"]));
  test("E", () => verify("E", ["E"]));
  test("S", () => verify("S", ["S"]));
  test("M2", () => verify("M2", ["M2"]));
  test("E2", () => verify("E2", ["E2"]));
  test("S2", () => verify("S2", ["S2"]));
  test("M'", () => verify("M'", ["M'"]));
  test("E'", () => verify("E'", ["E'"]));
  test("S'", () => verify("S'", ["S'"]));
  test("R M", () => verify("R M", ["R", "M"]));
  test("U M' D", () => verify("U M' D", ["U", "M'", "D"]));
  test("M E S", () => verify("M E S", ["M", "E", "S"]));
  test("R U M E F", () => verify("R U M E F", ["R", "U", "M", "E", "F"]));
});

describe("random 25-move scrambles", () => {
  const ALL_MOVES = [
    "U", "U'", "U2", "D", "D'", "D2",
    "F", "F'", "F2", "B", "B'", "B2",
    "L", "L'", "L2", "R", "R'", "R2",
    "M", "M'", "M2", "E", "E'", "E2",
    "S", "S'", "S2",
  ];
  const rng = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s;
    };
  };

  for (let trial = 0; trial < 5; trial++) {
    test(`random scramble #${trial}`, () => {
      const rand = rng(2000 + trial);
      const moves: string[] = [];
      for (let i = 0; i < 25; i++) moves.push(ALL_MOVES[rand() % ALL_MOVES.length]);
      const cube = applyMoves(SOLVED_STANDARD, moves);
      const { normalized, rotations } = normalizeCenters(cube);
      const relabel = buildRelabel(rotations);
      const rawStages = solveLBL(normalized);
      const sol = rawStages.flatMap((s) => s.moves).filter((s) => s !== "");
      const transformed = transformMoves(sol, relabel);
      const final = applyMoves(cube, transformed);
      assert.equal(isFullySolved(final), true);
      // 출력 무브는 면 무브로만 구성 (rotation-utils 호환)
      const allFaceMoves = transformed.every((m) =>
        ["U", "D", "F", "B", "L", "R"].includes(m[0])
      );
      assert.equal(allFaceMoves, true);
    });
  }
});
