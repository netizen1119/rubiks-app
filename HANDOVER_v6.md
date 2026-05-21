# HANDOVER v6

작성일: **2026-05-21**
대상 브랜치: `main` (커밋 `c27e9b1` 이후 — 3차 작업)
범위: **풀이 수준 선택 기능** — 홈에서 "차근차근 배우기 / 빠르게 풀이 보기" 선택 →
모드별 솔버 분기 (5-2 솔루션 단축을 학습 UX로 재구성).

이전 상태: `HANDOVER_v5.md` (2차 완성). 작업 계획: `CLAUDE_CODE_PLAN_v2.md` §5-2.

---

## 1. 한눈에 보기

2차까지는 LBL 단일 솔버(평균 ~100수)만 있었다. 3차에서 **사용자 목적에 따라
풀이 자체가 분기**하도록 만들었다.

- **차근차근 배우기 (learn)** — 기존 LBL 8단계 + 풀 설명 (이해 학습). 입문자 대상, 기본 강조.
- **빠르게 풀이 보기 (fast)** — Thistlethwaite 4단계, **평균 ~31수**. 큐브를 아는 사용자 대상.

명칭은 "유경험/무경험" 같은 수준 표현 대신 **목적 기반**으로(시험 보는 느낌 회피),
대다수가 입문자라는 가정 하에 learn 을 기본 강조했다.

---

## 2. 작업 항목별 요약

### 2-1. 진입 모드 선택 (홈)
- `components/main-page/stages/init/init.tsx`:
  - homepage 의 단일 "Continue" → **「차근차근 배우기」 / 「빠르게 풀이 보기」** 두 버튼.
  - `chooseMode(mode)` 가 `solveMode` 저장 + `deviceselect` 전환 + 카운트다운 시작.
  - deviceselect 분기는 기존 DeviceSelect + Scan + Manual Input 그대로.
- 앱 스테이지 머신(appStages)은 변경 없음 — 홈 화면 렌더만 분기해 리스크 최소화.

### 2-2. 솔버 분기
- `lib/solver/fast-solve.ts` (신규):
  - 기존 `solve_thistlethwaite` 을 학습 흐름의 `LBLStage[]`(4 phase) 형태로 래핑.
  - 출력은 **전부 면 무브(U/D/F/B/L/R + '/2)** → rotation-utils 시각화 그대로 호환
    (슬라이스/큐브회전 출력 없음 — 옵션 C 최대 리스크 해소).
  - 입력은 `normalizeCenters` 결과 → `fcube_to_ifcube` → 솔버 → (호출부에서) `transformMoves`.
- `lib/store/init-solve-cube.ts`:
  - `solveMode` 로 `buildStages("learn" | "fast")` 분기.
  - **안전 폴백**: fast 결과가 parity/미완성으로 invalid 면 자동으로 learn 으로 재산출.
  - 검증(`isFullySolved`) 후 cubeSolution/solveStages 설정 — 기존 로직 재사용.

### 2-3. UI 적응
- `lib/store/store.ts`: `solveMode: "learn" | "fast"` 상태 추가 (기본 "learn", `updateStore` 로 변경).
- `lib/maps/stage-descriptions.ts`: `fastStageDescriptions`(4단계 G1~G4 설명) 추가.
  `getStageDescription(idx, mode)` 로 모드별 조회.
- `components/main-page/stages/solve/stage-info.tsx`: `solveMode` 반영해 설명 카드 분기.
- `components/main-page/stages/solve/solve.tsx`:
  - 모드 배지(⚡ 빠른 풀이 N수 / 📚 차근차근 N수) 표시.
  - fast 모드 기본 자동재생 속도 2x.

### 2-4. 빌드/테스트 호환
- `lib/solver/solve-thistlethwaite.ts`: 상대 import `./fcube-to-ifcube` → `.ts` (normalize.ts 와 동일 규칙, node --test 호환).
- `lib/solver/fast-solve.ts`: 상대 import `.ts` 확장자 + `import type` 로 LBLStage.

---

## 3. 신규/변경 파일 (3차)

### 신규
- `lib/solver/fast-solve.ts` — Thistlethwaite → LBLStage[] 래퍼

### 수정
- `lib/store/store.ts` — `solveMode` 상태
- `lib/store/init-solve-cube.ts` — 모드 분기 + 폴백
- `lib/solver/solve-thistlethwaite.ts` — `.ts` import
- `lib/maps/stage-descriptions.ts` — fast 4단계 설명 + 모드 인자
- `components/main-page/stages/init/init.tsx` — 모드 선택 버튼
- `components/main-page/stages/solve/stage-info.tsx` — 모드 반영
- `components/main-page/stages/solve/solve.tsx` — 배지 + fast 기본 속도

---

## 4. 검증 현황

| 항목 | 결과 |
|---|---|
| fast 솔버 정확성 (랜덤 25-move 스크램블 20개) | **0 실패** |
| 평균 풀이 길이 | **fast 30.9수 / LBL 98.0수** (5-2 목표 ~70 초과 달성) |
| `tsc --noEmit` | PASS |
| `npm test` (LBL 28 케이스 회귀) | 28/28 PASS |
| dev 서버 컴파일 | ✓ (HTTP 200) |

> fast 검증은 임시 스크립트(`node --experimental-transform-types`)로 수행 후 삭제.
> fcube-to-ifcube 의 `enum` 때문에 strip-only 모드 불가 → transform-types 사용.

---

## 5. 남은 작업

### 5-1. (다음 진행 예정) Solve 도중 모드 전환 토글
- **목표**: solve 화면에서 learn ↔ fast 즉시 전환 (한 번의 홈 선택이 막다른 길이 안 되게).
- **난점**: 회전이 큐비 **지오메트리에 누적**되는 구조(`rotate-cube.ts`/rotation-utils).
  전환하려면 현재 시각 상태를 **스크램블로 복원**해야 하는데, 스크램블 지오메트리
  스냅샷이 없고 `cube` 문자열만 보존됨(`updateCube` 는 스티커 색만 페인트).
- **구현 방향(검토안)**: 실행된 무브의 **역무브 되감기**로 step 0(스크램블)까지 복원 후
  `solveMode` 변경 + `initSolveCube` 재실행. 기존 `prevCubeSolveStep` 역무브 로직 재사용.
  - 트레이드오프: 되감기 애니메이션 비용(많이 진행된 상태면 다수 무브).
  - 대안: 역무브를 무애니메이션(instant)으로 적용하는 경로 추가 검토.
- **영향 범위**: `solve.tsx`(토글 UI + 재초기화 흐름), 필요 시 `prev-solve-step.ts`/rotation-utils(instant 옵션).

### 5-2. 기타 (CLAUDE_CODE_PLAN_v2 잔여)
- 2-4 연습/힌트 모드 (능동 학습) — 미진행
- 4-3 모바일 최적화 — 미진행
- 카메라 스캔 단계 복원 — 물리 큐브 필요, 보류

---

## 6. 재현 / 검증 방법

```bash
npx tsc --noEmit          # 타입체크
npm test                  # LBL 28 케이스
npm run dev               # http://localhost:3000
#   홈 → "차근차근 배우기" 또는 "빠르게 풀이 보기" 선택
#   → Manual Input → 큐브 섞기 → "이 상태로 풀기 →"
#   → solve: 배지로 모드/총 수 확인, 단계 도트(learn 8 / fast 4), 풀이 원리 카드
```

fast 솔버 단독 검증(임시):
```bash
# node --experimental-transform-types <스크립트>
#   solveFast(scramble) → flat moves → isFullySolved(applyMoves(scramble, moves)) 확인
```
