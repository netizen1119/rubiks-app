# Rubik's Cube 학습 앱 — Claude Code 작업 계획 (v2)

> **상태**: 본 문서는 1차 작업 (LBL 솔버 도입) 계획. **완료됨** — 커밋 `4b4ab24`.
> 결과 정리: `HANDOVER_v4.md`. 이후 2차 계획은 `CLAUDE_CODE_PLAN_v2.md` 참고.

## 목표 요약

기존 `dejwi/rubiks-app` 포크에서 Thistlethwaite 최적 솔버를 제거하고,
Vincent 8단계 커리큘럼과 1:1 매핑되는 **LBL(Layer-By-Layer) 솔버**로 교체.
학습자가 자신의 큐브 상태에서 출발해 단계별 안내를 받는 앱으로 변환.

---

## 현재 코드베이스 구조 (변경 전)

```
lib/
  solver/
    solver.ts                  → solveCube() 진입점  [교체]
    solve-thistlethwaite.ts    → 4-phase 최적 솔버   [삭제 or 보존]
    fcube-to-ifcube.ts         → 큐브 인덱스 변환    [보존]
  store/
    store.ts                   → Zustand 상태        [확장]
    init-solve-cube.ts         → 풀이 초기화         [수정]
    next-solve-step.ts         → step 진행           [수정]
    rotate-cube.ts             → 회전 + 하이라이트   [보존]

components/main-page/stages/solve/
  solve.tsx                    → UI                  [전면 교체]
```

---

## 큐브 상태 표현 (기존 포맷 유지)

```
문자열 54자: "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"
순서: U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53)
각 면: 좌상→우하, 행 우선

색상 매핑:
  U = Yellow  (노랑)
  R = Green   (초록)
  F = Red     (빨강)
  D = White   (흰색)
  L = Blue    (파랑)
  B = Orange  (주황)

센터 인덱스: U=4, R=13, F=22, D=31, L=40, B=49
```

---

## 핵심 변경: LBL 솔버 구현

### 새 파일: `lib/solver/lbl-solver.ts`

8단계를 각각 독립 함수로 구현. 각 함수는 현재 큐브 상태를 받아
해당 단계를 완료하는 move 수열을 반환.

```ts
export type LBLStage = {
  stageIndex: number;    // 1~8
  stageName: string;
  stageNameEn: string;
  moves: string[];       // 이 단계의 move 수열
};

export const solveLBL = (cube: string): LBLStage[] => {
  let state = cube;
  const stages: LBLStage[] = [];

  const run = (fn: (s: string) => string[], idx: number, name: string, nameEn: string) => {
    const moves = fn(state);
    stages.push({ stageIndex: idx, stageName: name, stageNameEn: nameEn, moves });
    state = applyMoves(state, moves);
  };

  run(solveWhiteCross,        1, "1단계: 십자를 맞춘다",          "White Cross");
  run(alignCrossEdges,        2, "2단계: 십자 모서리를 정렬한다",  "Align Cross");
  run(solveFirstLayerCorners, 3, "3단계: 1층 코너를 맞춘다",      "First Layer");
  run(solveSecondLayer,       4, "4단계: 2층을 맞춘다",           "Second Layer");
  run(solveYellowCross,       5, "5단계: 윗면 십자를 맞춘다",     "Yellow Cross");
  run(solveYellowFace,        6, "6단계: 윗면을 맞춘다",         "Yellow Face");
  run(permuteYellowCorners,   7, "7단계: 3층 코너를 맞춘다",      "Corner Perm");
  run(permuteYellowEdges,     8, "8단계: 3층 엣지를 맞춘다",      "Edge Perm");

  return stages;
};
```

---

## LBL 솔버 각 단계 알고리즘 명세

### 헬퍼 함수 (먼저 구현)

```ts
// 큐브 문자열에 이동 수열 적용
applyMoves(cube: string, moves: string[]): string

// 단일 이동 적용
// 지원: U U' U2 / D D' D2 / F F' F2 / B B' B2 / R R' R2 / L L' L2 / M M' M2
applyMove(cube: string, move: string): string

// 특정 인덱스의 색상 조회 (0~53)
getColor(cube: string, idx: number): string

// 특정 면의 9칸 반환 (면 인덱스 기반)
getFace(cube: string, face: 'U'|'R'|'F'|'D'|'L'|'B'): string[]
```

### applyMove 순열 테이블

각 이동은 (from → to) 쌍의 배열. 기존 solve-thistlethwaite.ts의
`fmoves` 순열 참고 가능하나, 문자열 기반으로 재구현.

```ts
// 예시: U 이동 순열 (54칸 중 변화하는 칸만)
const U_PERM = [
  [0,2],[2,8],[8,6],[6,0],   // U면 코너
  [1,5],[5,7],[7,3],[3,1],   // U면 엣지
  [9,18],[18,36],[36,45],[45,9],   // 상단 행 엣지
  [10,19],[19,37],[37,46],[46,10],
  [11,20],[20,38],[38,47],[47,11],
];
```

---

### 1단계: 흰 십자 (solveWhiteCross)

**목표:** D면(흰색)의 4개 엣지를 D면으로 이동 (색상 정렬 무관).

**D면 엣지 위치 (인덱스):**
- D-F: D[7]=34, F[7]=25
- D-R: D[5]=32, R[7]=16
- D-B: D[1]=28, B[7]=52
- D-L: D[3]=30, L[7]=43

**완료 조건:** 위 8칸이 D='D'(white), 측면=해당 면 색상

**알고리즘 접근:**
1. 흰색 엣지 4개 위치 파악
2. 각 엣지를 D면으로 이동:
   - U면에 있음 → U면 회전으로 목표 면 위에 정렬 → F2/R2/B2/L2 로 내리기
   - 측면 중간층에 있음 → D' + 면회전 + D 으로 U면으로 올리기
   - D면에 있지만 잘못된 방향 → F2 등으로 U면으로 올린 뒤 재삽입

---

### 2단계: 십자 정렬 (alignCrossEdges)

**목표:** D면 4개 엣지의 측면 색상을 해당 센터 색상에 맞추기.

**완료 조건:**
- D-F 엣지의 F쪽 색상 = F 센터 색상 (Red)
- D-R 엣지의 R쪽 색상 = R 센터 색상 (Green)
- D-B 엣지의 B쪽 색상 = B 센터 색상 (Orange)
- D-L 엣지의 L쪽 색상 = L 센터 색상 (Blue)

**알고리즘:**
- 측면 미정렬 엣지를 D2 → U면으로 올린 뒤 U 회전으로 정렬 → 재삽입
- 이미 맞는 엣지는 건드리지 않음

> 1단계와 통합 구현 권장: 처음부터 색상 맞춰 D면 삽입

---

### 3단계: 1층 코너 (solveFirstLayerCorners)

**목표:** D면 4개 코너를 올바른 위치와 방향으로 삽입.

**D면 코너 인덱스:**
- DFR: D[8]=35, F[8]=26, R[6]=15
- DFL: D[6]=33, F[6]=24, L[8]=44
- DBR: D[2]=29, B[6]=51, R[8]=17
- DBL: D[0]=27, B[8]=53, L[6]=42

**완료 조건:** 각 코너 3칸 = D=white + 측면=해당 센터 색상

**트위스트 알고리즘:**
```
오른쪽 삽입 (RUR'U' 반복 최대 6회):  R U R' U'
왼쪽 삽입  (L'U'LU  반복 최대 6회):  L' U' L U
```

**절차:**
1. 각 코너를 U면으로 꺼내기 (D면에 있으면: 해당 방향 트위스트로 꺼내기)
2. U 회전으로 목표 위치 위에 코너 정렬
3. 코너 방향(흰색 면) 확인 후 적절한 알고리즘 적용

---

### 4단계: 2층 엣지 (solveSecondLayer)

**목표:** E층(중간 레이어) 4개 엣지 삽입. 노란색 포함 엣지 제외.

**E층 엣지 인덱스:**
- FR: F[5]=23, R[3]=12
- FL: F[3]=21, L[5]=41
- BR: B[5]=50, R[5]=14
- BL: B[3]=48, L[3]=39

**삽입 알고리즘:**
```
오른쪽 삽입: U R U' R' U' F' U F
왼쪽 삽입:  U' L' U L U F U' F'
```

**절차:**
1. U면에서 노란색 없는 엣지 탐색
2. U 회전으로 목표 면 위로 정렬
3. 색상 방향에 따라 오른쪽/왼쪽 알고리즘 선택

---

### 5단계: 노란 십자 (solveYellowCross)

**목표:** U면 4개 엣지칸(U[1], U[3], U[5], U[7])을 노란색으로.

**패턴 감지:**
- 0개 노랑: 점(dot)
- 2개 노랑(인접): L자
- 2개 노랑(대면): 선
- 4개 노랑: 완료

**알고리즘:**
```
F R U R' U' F'
```
- 점 → 임의 방향으로 1회 → 선 또는 L자로 변함 → 추가 실행
- L자 → L의 꺾이는 방향을 왼앞으로 맞추고 1회
- 선 → 선이 좌우가 되도록 맞추고 1회

---

### 6단계: 노란 면 완성 (solveYellowFace)

**목표:** U면 9칸 모두 노란색 (코너 포함).

**Sune 알고리즘:**
```
R U R' U R U2 R'
```

**절차:**
1. U면 코너 중 노란색인 것 수 파악
2. 노란 코너가 0개: 임의 방향으로 Sune → 반복
3. 노란 코너가 1개: 해당 코너를 URF 위치에 맞추고 Sune
4. 노란 코너가 2개: 특정 패턴에 따라 Sune 방향 조정
5. U면 완성까지 최대 4회 반복

---

### 7단계: 3층 코너 배치 (permuteYellowCorners)

**목표:** U면 코너 4개를 올바른 위치로 이동.

**완료 조건:** 각 코너의 측면 색상 2개가 해당 면 센터 색상과 일치.

**알고리즘:**
```
U R U' L' U R' U' L
```
최대 3회 반복. 이미 맞는 코너를 URF 위치에 고정하고 나머지 순환.

---

### 8단계: 3층 엣지 배치 (permuteYellowEdges)

**목표:** U면 엣지 4개를 올바른 위치로 이동.

**알고리즘 (M 이동 사용 불가 시 대체):**
```
R2 U R U R' U' R' U' R' U R'   (시계방향 순환)
R U' R U R U R U' R' U' R2     (반시계방향 순환)
```

**절차:**
1. 이미 맞는 엣지(기준 엣지) 찾기
2. U 회전으로 기준 엣지를 F면 위로
3. 나머지 3개 방향(시계/반시계) 확인 후 알고리즘 적용

> M 이동이 필요한 경우: `rotation-utils.ts`에서 M 이동 지원 확인.
> 현재 코드에 M/M'/M2는 moves.ts에 정의되어 있으나 rotation-utils.ts의
> rotateCubeAction이 M을 throw Error로 처리 중 → 대체 알고리즘 사용 권장.

---

## 스토어 변경 사항

### `store.ts` 추가 상태

```ts
import { LBLStage } from '@/lib/solver/lbl-solver';

// 기존 유지
cubeSolution: string[]
cubeSolutionStep: number | null

// 추가
solveStages: LBLStage[]           // 8단계 정보
currentStageIndex: number          // 현재 단계 0~7
```

### `init-solve-cube.ts` 수정

```ts
import { solveLBL } from '../solver/lbl-solver';

const initSolveCube = ({ get, set }: IStoreFn) => {
  const cube = get().cube;
  const stages = solveLBL(cube);

  const solution = stages.flatMap(s => s.moves);

  if (!solution.length) {
    set({ cubeSolution: [], solveStages: stages, cubeSolutionStep: null });
    throw new Error("Cube already solved or unsolveable");
  }

  set({
    cubeSolution: solution,
    solveStages: stages,
    cubeSolutionStep: 0,
    currentStageIndex: 0,
  });

  get().nextCubeSolveStep();
};
```

---

## UI 명세: solve.tsx 전면 교체

### 레이아웃

```
┌──────────────────────────────────┐
│  ● ● ● ○ ○ ○ ○ ○               │  ← 8단계 진행 도트 (완료=●, 미완=○)
│  3단계: 1층 코너를 맞춘다        │  ← 단계명
├──────────────────────────────────┤
│                                  │
│         [3D 큐브]                │
│                                  │
├──────────────────────────────────┤
│  다음 동작                        │
│  ┌──────┐                        │
│  │  R   │  오른면을 시계방향으로  │
│  └──────┘  이동 12 / 31         │
├──────────────────────────────────┤
│         [ 다음 이동 → ]          │
└──────────────────────────────────┘
```

### 새 컴포넌트

```
components/main-page/stages/solve/
  solve.tsx           ← 전면 교체 (레이아웃 조합)
  stage-progress.tsx  ← 도트 + 단계명 표시
  move-guide.tsx      ← 이동 기호 + 설명 + 카운터
```

---

## 이동 설명 텍스트

### `lib/maps/move-descriptions.ts` 신규

```ts
export type MoveDescription = {
  face: string;
  direction: string;
};

export const moveDescriptions: Record<string, MoveDescription> = {
  "R":  { face: "오른면", direction: "시계방향" },
  "R'": { face: "오른면", direction: "반시계방향" },
  "R2": { face: "오른면", direction: "180°" },
  "L":  { face: "왼면",   direction: "반시계방향" },
  "L'": { face: "왼면",   direction: "시계방향" },
  "L2": { face: "왼면",   direction: "180°" },
  "U":  { face: "윗면",   direction: "시계방향" },
  "U'": { face: "윗면",   direction: "반시계방향" },
  "U2": { face: "윗면",   direction: "180°" },
  "D":  { face: "아랫면", direction: "시계방향" },
  "D'": { face: "아랫면", direction: "반시계방향" },
  "D2": { face: "아랫면", direction: "180°" },
  "F":  { face: "앞면",   direction: "시계방향" },
  "F'": { face: "앞면",   direction: "반시계방향" },
  "F2": { face: "앞면",   direction: "180°" },
  "B":  { face: "뒷면",   direction: "시계방향" },
  "B'": { face: "뒷면",   direction: "반시계방향" },
  "B2": { face: "뒷면",   direction: "180°" },
};
```

---

## 작업 순서 (Claude Code 실행 기준)

```
Step 1.  lib/maps/move-descriptions.ts              신규 생성
Step 2.  lib/solver/lbl-solver.ts                   신규 생성 (핵심)
         ├─ applyMove() + applyMoves() 헬퍼
         ├─ getColor() + getFace() 헬퍼
         ├─ solveWhiteCross()
         ├─ alignCrossEdges()
         ├─ solveFirstLayerCorners()
         ├─ solveSecondLayer()
         ├─ solveYellowCross()
         ├─ solveYellowFace()
         ├─ permuteYellowCorners()
         ├─ permuteYellowEdges()
         └─ solveLBL() 진입점
Step 3.  lib/store/store.ts                         상태 확장 (solveStages, currentStageIndex)
Step 4.  lib/store/init-solve-cube.ts               LBL 솔버 연동
Step 5.  components/.../solve/stage-progress.tsx    신규
Step 6.  components/.../solve/move-guide.tsx        신규
Step 7.  components/.../solve/solve.tsx             전면 교체
```

---

## 주의사항

- **TypeScript strict** 모드: 타입 누락 시 빌드 오류
- **`"use client"`**: Three.js/GSAP 사용 컴포넌트 필수
- **Zustand 패턴**: `IStoreFn` (`get`, `set`) 패턴 유지
- **M 이동**: `rotation-utils.ts`의 rotateCubeAction이 M을 미지원.
  8단계 알고리즘에서 M 이동 대신 R L' 조합 사용
- **테스트 기준**: `solveLBL(solved_cube)` → 전 단계 빈 배열 반환
- **솔버 정확성**: 무작위 스크램블 20회 이상 테스트 권장

---

## 참고

- 원본 레포: https://github.com/dejwi/rubiks-app
- 큐브 이동 표기법: https://ruwix.com/the-rubiks-cube/notation/
- LBL 레퍼런스: https://ruwix.com/the-rubiks-cube/how-to-solve-the-rubiks-cube-beginners-method/
