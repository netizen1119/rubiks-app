import { ICubeMoves } from "@/lib/moves/moves";

// 학습 세션 페이지의 7개 단계 카드.
// 텍스트(goal/approach/tip/shortTitle)는 기존 messages.stages.lblDesc[lblDescIdx] 를 재사용한다.
// easiestsolve.com 친근 별칭(funnyName)은 messages.learnMethod.steps[id] 에서 가져온다.
// demoMoves 는 해당 단계의 대표 알고리즘 — 라이브 3D 데모에서 애니메이션으로 재생된다.
// 데모는 SOLVED 에 invert(demoMoves) 를 칠해 "케이스"를 만든 뒤 demoMoves 를 재생 →
// 큐브가 다시 풀리는 모습으로 알고리즘 작동을 시연한다. (scramble = invert 라 항상 루프 가능)

export type LearnStep = {
  id: string;
  // messages.stages.lblDesc 의 인덱스 (텍스트 재사용). idx 1 은 1단계에 통합되어 제외.
  lblDescIdx: number;
  demoMoves: ICubeMoves[];
};

export const LEARN_STEPS: LearnStep[] = [
  // 1. 흰 십자 — 단일 알고리즘이 없어 시연용 4-무브 시퀀스(루프 복귀).
  { id: "cross", lblDescIdx: 0, demoMoves: ["R2", "F2", "R2", "F2"] },
  // 2. 1층 코너 (Lost Dogs) — 오른손 트리거.
  { id: "firstLayer", lblDescIdx: 2, demoMoves: ["R", "U", "R'", "U'"] },
  // 3. 2층 엣지 (ABC) — 오른쪽 삽입.
  { id: "secondLayer", lblDescIdx: 3, demoMoves: ["U", "R", "U'", "R'", "U'", "F'", "U", "F"] },
  // 4. 노란 십자 (Furry Yellow Plus, FUR/URF).
  { id: "yellowCross", lblDescIdx: 4, demoMoves: ["F", "R", "U", "R'", "U'", "F'"] },
  // 5. 노란 면 (Yellow Fish) — Sune.
  { id: "yellowFace", lblDescIdx: 5, demoMoves: ["R", "U", "R'", "U", "R", "U2", "R'"] },
  // 6. 3층 코너 (Thumbs Up) — 코너 순환.
  { id: "cornerPerm", lblDescIdx: 6, demoMoves: ["U", "R", "U'", "L'", "U", "R'", "U'", "L"] },
  // 7. 3층 엣지 (Finish Him!) — U-perm.
  {
    id: "edgePerm",
    lblDescIdx: 7,
    demoMoves: ["R2", "U", "R", "U", "R'", "U'", "R'", "U'", "R'", "U", "R'"],
  },
];

// 무브 1개의 역방향. U→U', U'→U, U2→U2. (prev-solve-step 의 inverseMove 와 동일 규칙)
const inverseMove = (m: ICubeMoves): ICubeMoves => {
  if (m.endsWith("2")) return m;
  if (m.endsWith("'")) return m[0] as ICubeMoves;
  return (m + "'") as ICubeMoves;
};

// 무브 수열의 역수열. 순서 뒤집고 각 무브 반전.
export const invertMoves = (moves: ICubeMoves[]): ICubeMoves[] =>
  [...moves].reverse().map(inverseMove);
