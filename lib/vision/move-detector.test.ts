import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyMove, applyMoves, getFace } from "../solver/lbl-solver.ts";
import { SOLVED_STANDARD } from "../solver/normalize.ts";
import {
  rotateFace,
  detectableMoves,
  lockOrientation,
  searchMove,
  detectMove,
} from "./move-detector.ts";
import type { ICubeMoves } from "../moves/moves.ts";

// 카메라 없이 forward-model 코어 검증: known S + (face, orient) 에서 무브를 *합성*해
// "예측 9칸"을 만들고, detector 가 그 무브를 복원하는지 본다 (round-trip).

const FACES = ["U", "R", "F", "D", "L", "B"] as const;
// 6면이 고루 섞이는 비대칭 스크램블 — 면 9칸이 단색이면 무브 구분이 퇴화(여러 무브가 동일 9칸)
// 하므로, 충분히 섞인 S 로 테스트해 일치가 유일해지게 한다.
const SCRAMBLE = "R U R' U' F2 B L' D R2 U' L B2 D' F R'".split(" ");
const S = applyMoves(SOLVED_STANDARD, SCRAMBLE);

describe("rotateFace", () => {
  test("k=0 은 항등", () => {
    const f = getFace(S, "F");
    assert.deepEqual(rotateFace(f, 0), f);
  });

  test("4회전 = 항등", () => {
    const f = getFace(S, "F");
    assert.deepEqual(rotateFace(f, 4), f);
  });

  test("CW 90° 인덱스 매핑", () => {
    // 0..8 라벨이면 CW 결과는 [6,3,0,7,4,1,8,5,2].
    const f = ["0", "1", "2", "3", "4", "5", "6", "7", "8"];
    assert.deepEqual(rotateFace(f, 1), ["6", "3", "0", "7", "4", "1", "8", "5", "2"]);
  });

  test("음수 회전 = mod 4", () => {
    const f = getFace(S, "F");
    assert.deepEqual(rotateFace(f, -1), rotateFace(f, 3));
  });
});

describe("detectableMoves", () => {
  test("front 면당 15무브 (반대면 그룹 제외)", () => {
    for (const front of FACES) {
      const moves = detectableMoves(front);
      assert.equal(moves.length, 15, `front=${front}`);
    }
  });

  test("front=F → B 그룹 제외", () => {
    const moves = detectableMoves("F");
    assert.ok(!moves.some((m) => m[0] === "B"));
    assert.ok(moves.includes("F"));
    assert.ok(moves.includes("U2"));
  });
});

describe("lockOrientation", () => {
  test("각 orient 로 회전한 관측을 정확히 복원", () => {
    for (const front of FACES) {
      for (let o = 0; o < 4; o++) {
        const observed = rotateFace(getFace(S, front), o);
        const lock = lockOrientation(S, front, observed, 0);
        assert.ok(lock, `front=${front} o=${o} lock 실패`);
        assert.equal(lock.orient, o, `front=${front} o=${o}`);
        assert.equal(lock.hamming, 0);
      }
    }
  });

  test("색 1칸 오분류 허용(maxHamming=1)", () => {
    const observed = rotateFace(getFace(S, "F"), 0).slice();
    observed[0] = observed[0] === "U" ? "D" : "U"; // 한 칸 변조
    const lock = lockOrientation(S, "F", observed, 1);
    assert.ok(lock);
    assert.equal(lock.orient, 0);
    assert.equal(lock.hamming, 1);
  });
});

describe("searchMove round-trip", () => {
  test("모든 front·orient·감지가능무브 복원 (hamming 0)", () => {
    let checked = 0;
    for (const front of FACES) {
      for (let o = 0; o < 4; o++) {
        for (const m of detectableMoves(front)) {
          const S2 = applyMove(S, m);
          const observed = rotateFace(getFace(S2, front), o);
          const cand = searchMove(S, front, o, observed, 0);
          assert.ok(cand, `front=${front} o=${o} m=${m} 미검출`);
          // 일치가 유일하지 않을 수 있으나(퇴화), 복원 무브는 관측을 hamming 0 로 재현해야 함.
          const reproduced = rotateFace(getFace(applyMove(S, cand.move), front), o);
          assert.deepEqual(reproduced, observed, `front=${front} o=${o} m=${m}`);
          assert.equal(cand.score, 1);
          checked++;
        }
      }
    }
    assert.equal(checked, 6 * 4 * 15);
  });

  test("반대면 무브(보이지 않음)는 front 9칸 불변 → 무브 합성해도 관측 동일", () => {
    const front = "F";
    const observedBefore = rotateFace(getFace(S, front), 0);
    for (const m of ["B", "B'", "B2"] as ICubeMoves[]) {
      const observedAfter = rotateFace(getFace(applyMove(S, m), front), 0);
      assert.deepEqual(observedAfter, observedBefore, `${m} 가 front 를 바꿈(불가)`);
    }
  });
});

describe("detectMove (모션 게이트)", () => {
  test("변화 없으면 null (idle)", () => {
    const tuple = rotateFace(getFace(S, "F"), 1);
    assert.equal(detectMove(tuple, tuple, S, "F", 1), null);
  });

  test("무브 발생 → 해당 무브 후보 반환", () => {
    const front = "F";
    const orient = 2;
    const prev = rotateFace(getFace(S, front), orient);
    const m: ICubeMoves = "R'";
    const curr = rotateFace(getFace(applyMove(S, m), front), orient);
    const cand = detectMove(prev, curr, S, front, orient);
    assert.ok(cand);
    const reproduced = rotateFace(getFace(applyMove(S, cand.move), front), orient);
    assert.deepEqual(reproduced, curr);
  });

  test("커밋 후 다음 무브도 새 S 에서 복원 (체인)", () => {
    const front = "U";
    const orient = 1;
    let cur = S;
    for (const m of ["R", "F'", "L2"] as ICubeMoves[]) {
      const prev = rotateFace(getFace(cur, front), orient);
      const next = applyMove(cur, m);
      const curr = rotateFace(getFace(next, front), orient);
      const cand = detectMove(prev, curr, cur, front, orient);
      assert.ok(cand, `m=${m} 미검출`);
      const reproduced = rotateFace(getFace(applyMove(cur, cand.move), front), orient);
      assert.deepEqual(reproduced, curr, `m=${m}`);
      cur = next; // 커밋 = S 갱신 (tracker-bridge 의 rotateCube 에 해당).
    }
  });
});
