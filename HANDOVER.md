# 인계 문서 — Rubik's Cube 학습 앱

**작성일:** 2026-05-19  
**레포:** https://github.com/netizen1119/rubiks-app  
**로컬 경로:** `~/Rubiks app`

---

## 현재 진행 상태

| Step | 파일 | 상태 |
|------|------|------|
| 1 | `lib/maps/move-descriptions.ts` | ✅ 완료 |
| 2 | `lib/solver/lbl-solver.ts` | ✅ 완료 (기본 검증 통과) |
| 2-보정 | 스크램블 견고성 테스트 | 🔄 진행 중 or 미완 |
| 3 | `lib/store/store.ts` 확장 | ⏳ 대기 |
| 4 | `lib/store/init-solve-cube.ts` 수정 | ⏳ 대기 |
| 5 | `stage-progress.tsx` 생성 | ⏳ 대기 |
| 6 | `move-guide.tsx` 생성 | ⏳ 대기 |
| 7 | `solve.tsx` 전면 교체 | ⏳ 대기 |

---

## 완료된 작업 내용

### Step 1 — move-descriptions.ts
- 18개 이동(U/D/F/B/L/R × 시계·반시계·180°) 한글 설명 맵
- L/L'은 시계/반시계 방향이 R과 반대로 매핑됨 (큐브 방향 기준)

### Step 2 — lbl-solver.ts
- `applyMove` / `applyMoves` / `getColor` / `getFace` 헬퍼 구현
- 이동 순열은 `solve-thistlethwaite.ts`의 기하 로직 포팅 (좌표계 일치)
- 8단계 솔버 함수 + `solveLBL()` 진입점
- M 이동은 엔진 내부에서만 사용, 수열 출력 시 R 기반 대체 알고리즘 사용
- **검증 통과 항목:**
  - `solveLBL(solved_cube)` → 전 단계 빈 배열
  - 각 이동 ×4 = 항등
  - X2==XX, X'==XXX
  - sexy move(R U R' U') ×6 = 항등
  - 랜덤 30수 스크램블 + 역수 = solved
- **미검증:** 무작위 스크램블 20회 완전 해결 (스크램블 견고성)

---

## 다음 세션 시작 방법

### 1. Claude Code 실행

```bash
cd ~/Rubiks\ app
claude
```

### 2. 첫 프롬프트 (스크램블 테스트 결과에 따라 분기)

**A. 스크램블 테스트가 아직 안 됐으면:**
```
무작위 스크램블 20수 × 20회 테스트로 lbl-solver.ts 견고성 확인하고,
실패 케이스 있으면 보정 후 Step 3으로 넘어가줘
```

**B. 스크램블 테스트 통과했으면:**
```
CLAUDE_CODE_PLAN.md 읽고 Step 3부터 시작해줘.
Step 3: lib/store/store.ts에 solveStages, currentStageIndex 상태 추가
```

---

## 핵심 주의사항 (Claude Code에게 매번 상기)

- **M 이동**: `rotation-utils.ts`의 `rotateCubeAction`이 M을 미지원 (`throw Error`).
  lbl-solver.ts 출력 수열에 M이 포함되지 않도록 유지할 것
- **TypeScript strict**: 타입 누락 시 빌드 오류
- **Zustand 패턴**: `IStoreFn` (`get`, `set`) 패턴 유지
- **`"use client"`**: Three.js/GSAP 관련 컴포넌트 필수
- **pnpm-lock.yaml**: 대규모 변경(+3730/−2586)이 있음. 작업과 무관하니 커밋 시 제외하거나 별도 처리

---

## 전체 목표 recap

학습자가 자신의 큐브를 카메라로 스캔 → 3D 매핑 → Vincent 8단계 커리큘럼으로
단계별 안내받는 학습 앱.

기존 Thistlethwaite 최적 솔버 → LBL 솔버로 교체.
solve.tsx UI를 단계명 + 이동 설명 + 진행 도트로 전면 교체.

상세 명세: `CLAUDE_CODE_PLAN.md` 참조.
