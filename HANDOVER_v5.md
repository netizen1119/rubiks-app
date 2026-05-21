# HANDOVER v5

작성일: **2026-05-20**
대상 브랜치: `main` (커밋 `1290340`, `d5a79b4`, `8de0481` — `4b4ab24` 이후)
범위: 2차 작업 — 학습 흐름 완성, 패시브 학습, 기반 정비, 매뉴얼 입력 UX 확장,
solve 단계 시점 회전 추가.

이전 상태: `HANDOVER_v4.md` (1차 완성, `4b4ab24`) 참고.
작업 계획: `CLAUDE_CODE_PLAN_v2.md` 참고.

---

## 1. 한눈에 보기

1차 (LBL 솔버 + 매뉴얼 입력) 위에 학습 가치와 사용성을 끌어올렸다.
- **슬라이스 회전 + 시점 회전 활성화** — 매뉴얼 입력에서 더 이상 제약 없음
- **Solve 단계 Undo** — 실수 복구 가능
- **단계 자동 인식** — 이미 일부 푼 상태로 와도 적절한 단계부터 시작
- **단계별 알고리즘 설명 카드** — 단순 따라하기가 아닌 이해 학습
- **자동 재생 + 속도 조절** — 패시브 관찰 학습
- **통계 / 진행률** — 진행 step, 단계별 이동수, 경과 시간
- **테스트 자동화** — `npm test` 로 28 케이스 회귀 검증
- **무브 히스토리** — 실물 큐브에서 동일 스크램블 재현 가능
- **튜토리얼 오버레이** — 첫 진입 시 사용법 안내
- **시점 회전 + 자동 복귀** — 매뉴얼 입력/solve 양쪽에서 빈 영역 드래그로 뒷면 보고 release 시 부드럽게 복귀

---

## 2. 커밋 시리즈 (2차)

| 해시 | 메시지 | 변경 |
|---|---|---|
| `1290340` | add slice rotation, view orbit, undo, autoplay, stats, stage info | 12 files, +457/-31 |
| `d5a79b4` | add reset, outline polish, render skip, and pipeline tests | 7 files, +297/-99 |
| `8de0481` | add tutorial, history, hover hints, and view orbit with snap-back | 4 files, +232/-4 |

---

## 3. 작업 항목별 요약

### 🔴 Bundle A — 학습 흐름 완성

#### 1-1. 슬라이스 회전 + 시점 회전
- `lib/moves/moves.ts`: E/E'/E2/S/S'/S2 활성화 (주석 해제)
- `lib/moves/rotation-utils.ts`: `rotateCubeAction` 의 큐비 선택 루프에 M/E/S 인라인 매핑 + `getRotation` 의 E/S 케이스
- `components/main-page/stages/manual-input/scramble-cube.tsx`:
  - 가운데 슬라이스 허용 (resolveAxisSlice 의 slice === 0 null 반환 제거)
  - MOVE_TABLE 에 `x|0/M`, `y|0/E`, `z|0/S'/S` 추가
  - pointerdown 캡처 단계 등록 + 큐비 hit 시 stopImmediatePropagation → OrbitControls 차단
  - 빈 영역 드래그는 propagation 통과 → OrbitControls 가 시점 회전
- `lib/maps/move-descriptions.ts`: M/E/S 한글 설명 추가

#### 1-2. Solve Undo
- `lib/store/prev-solve-step.ts` (신규):
  - `inverseMove(m)`: U→U', U'→U, U2→U2
  - 진행 중이면 (currentStep-1) 무브의 역무브 시각 회전 + step 감소
  - 완료 상태면 마지막 무브 되돌리기
- `lib/store/store.ts`: `prevCubeSolveStep` 액션 추가
- `components/main-page/stages/solve/solve.tsx`: "← 이전" 버튼

#### 1-3. 단계 자동 인식 (Smart Start)
- `lib/store/init-solve-cube.ts`: `stages.findIndex(s => s.moves.length > 0)` 로 `currentStageIndex` 초기값 결정. 이미 일부 푼 상태면 도트가 ● 로 채워진 채 시작.

#### 2-1. 단계별 알고리즘 설명 카드
- `lib/maps/stage-descriptions.ts` (신규): 8단계 각각 goal/approach/representativeAlgo/tip
- `components/main-page/stages/solve/stage-info.tsx` (신규): 토글 가능 풀이 원리 카드. **absolute 포지셔닝**으로 펼쳐도 큐브 위치 안 흔들림. `bg-zinc-900/95 backdrop-blur-sm` 로 검정 배경과 구분.

---

### 🟡 Bundle B — 패시브 학습

#### 2-2. 자동 재생 + 속도 조절
- `solve.tsx`: `[isPlaying, speed]` state, 0.5x/1x/1.5x/2x/3x 선택, 인터벌 `450 / speed` ms 로 `nextCubeSolveStep` 호출. `cubeSolutionStep === null` 도달 시 자동 정지.

#### 2-3. 통계 / 진행률
- `components/main-page/stages/solve/stats.tsx` (신규): 진행 step/total + %, 현재 단계 이동 수, 경과 시간 (mm:ss). 컴포넌트 mount 시점부터 측정.

#### 4-1. 단계 전환 부드러운 페이드
- `app/globals.css`: `@keyframes fade-in`
- `scramble-cube.tsx`, `solve.tsx` root: `style={{ animation: "fade-in 0.4s ease-out" }}`
- AnimatePresence 의존 없음 (1차에서 제거함).

---

### 🟢 Bundle C 부분 — 매뉴얼 입력 UX

#### 3-4. 무브 히스토리
- `scramble-cube.tsx`: `moveHistory` state. 회전 시 push, Reset 시 clear. 하단에 시퀀스 표시 + 📋 복사 버튼 (`navigator.clipboard.writeText`).

#### 3-1. 첫 진입 튜토리얼 오버레이
- `components/main-page/stages/manual-input/tutorial-overlay.tsx` (신규): localStorage `manualInputTutorialSeen.v1` 키로 1회 표시. 드래그/시점/Reset/풀기 안내.

#### 3-2. 호버 시각 보조 (텍스트 힌트)
- `scramble-cube.tsx`: `hoverHint` state. 호버 시 슬라이스의 두 방향 무브(pos/neg) 표시 — 드래그 전에 어떤 무브가 적용될지 미리 안다. 화살표 스프라이트 대신 텍스트로 간소화 구현.

---

### 🔵 Bundle D — 기반 정비

#### 3-3. Reset 버튼 복원
- `scramble-cube.tsx`: `resetCubeToInitial()` 함수로 reset 로직 추출 (mount + 버튼 양쪽 사용). 큐비 누적 회전을 `orgIdx` 기반으로 초기화 + 색상 solved 페인트 + 히스토리 클리어.

#### 4-2. 큐브 시각 품질
- `cube-three.tsx`: OutlinePass `edgeStrength` 6→8, `edgeThickness` 2→3, `pulsePeriod` 0, 명시적 `visibleEdgeColor` 노란색(#ffeb3b) / `hiddenEdgeColor` 어두운 노랑(#664400).
- cube material `transparent: true` 는 그대로 유지 (fade-in 의존). 향후 fade 완료 후 false 전환 가능.

#### 5-3. 렌더 성능 최적화
- `cube-three.tsx`: `outlinedSelection` 이 비면 `composer.render` 대신 `renderer.render(scene, camera)` 직접 호출. OutlinePass(가장 무거운 단계) 건너뛰기.

#### 5-1. 테스트 자동화
- `lib/solver/normalize.ts` (신규): `init-solve-cube.ts` 의 순수 함수 (normalizeCenters, buildRelabel, transformMoves, isFullySolved) 분리 → 단위 테스트 가능.
- `lib/solver/lbl-solver.test.ts` (신규): node:test + node:assert. 4 suite, 28 test:
  - applyMove/applyMoves 가역성 (5)
  - solveLBL 기본 (4)
  - normalize pipeline 슬라이스 (13)
  - random 25-move 스크램블 (5)
- `tsconfig.json`: `allowImportingTsExtensions: true`
- `package.json`: `"test": "node --test --experimental-strip-types lib/solver/lbl-solver.test.ts"`
- 실행: `npm test` → **28/28 PASS** (~45s)

---

### ✨ 추가 — Solve 단계 시점 회전

사용자 요청으로 매뉴얼 입력의 카메라 자동 복귀 로직을 solve 에도 이식.

- `solve.tsx`: useEffect 두 개로 분리
  - **inited 가드 있는 effect**: `initSolveCube` 1회만 호출 (StrictMode 안전)
  - **가드 없는 effect**: canvas pointer-events override + OrbitControls 활성 + start/end 리스너 + gsap 카메라 복귀 (idempotent 한 setup → StrictMode 이중 호출에도 안전)
- 매뉴얼 입력도 동일 패턴. 진입 시점 카메라 위치를 캡처해 release 시 0.6초 `power2.inOut` 으로 복귀.
- 솔브에선 `updateCameraPos(F)` 의 gsap 트윈 완료(0.6s) 후 캡처 → 정확한 "원위치"
- `lib/store/store.ts`: `OrbitLike` 타입에 `addEventListener` / `removeEventListener` 추가.

---

## 4. 신규/변경 파일 (2차 전체)

### 신규
- `lib/solver/normalize.ts` — 정규화 순수 함수 모듈
- `lib/solver/lbl-solver.test.ts` — 28 케이스 단위 테스트
- `lib/store/prev-solve-step.ts` — Undo 액션
- `lib/maps/stage-descriptions.ts` — 8단계 설명 콘텐츠
- `components/main-page/stages/solve/stage-info.tsx` — 풀이 원리 카드
- `components/main-page/stages/solve/stats.tsx` — 통계 라인
- `components/main-page/stages/manual-input/tutorial-overlay.tsx` — 첫 진입 안내

### 수정
- `lib/moves/moves.ts` — E/S 무브 활성화
- `lib/moves/rotation-utils.ts` — M/E/S 케이스
- `lib/maps/move-descriptions.ts` — M/E/S 한글
- `lib/store/store.ts` — `prevCubeSolveStep` + OrbitLike 확장
- `lib/store/init-solve-cube.ts` — normalize 모듈 사용 + 단계 자동 인식
- `components/main-page/stages/manual-input/scramble-cube.tsx` — 슬라이스 허용, orbit 캡처, hover hint, history, reset, tutorial, camera return
- `components/main-page/stages/solve/solve.tsx` — Undo 버튼, 자동 재생, 통계, stage info, orbit + camera return, useEffect 분리
- `components/cube-visualization/cube-three.tsx` — OutlinePass 가시성 + 조건부 렌더
- `app/globals.css` — fade-in keyframe
- `package.json` — test 스크립트
- `tsconfig.json` — allowImportingTsExtensions

---

## 5. 검증 현황

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` (전체) | PASS |
| `npm test` (28 케이스) | PASS |
| 매뉴얼 입력 슬라이스 회전 | PASS (사용자 확인) |
| 매뉴얼 입력 시점 회전 + 복귀 | PASS |
| Solve Undo | PASS |
| Solve 자동 재생 + 속도 | PASS |
| Solve 통계 표시 | PASS |
| Solve 단계 설명 카드 (큐브 위치 안 흔들림) | PASS |
| Solve 시점 회전 + 복귀 | PASS |
| 매뉴얼 입력 무브 히스토리 + 복사 | PASS |
| 매뉴얼 입력 호버 힌트 | PASS |
| 매뉴얼 입력 Reset | PASS |
| 단계 전환 페이드 | PASS |
| 외곽선 가시성 향상 | PASS |
| 튜토리얼 오버레이 (localStorage) | PASS |

---

## 6. 남은 작업 (3차 후보)

`CLAUDE_CODE_PLAN_v2.md` 의 미진행 항목:

### 우선순위 중상
- **2-4 연습/힌트 모드** — 사용자가 직접 다음 무브 추측 → 정답이면 진행, 틀리면 힌트. 두 모드 통합 UI 필요. 능동 학습의 핵심 기능. **상 난이도**.

### 우선순위 중
- **4-3 모바일 최적화** — 반응형 cubeScale, 터치 제스처 검증. 데스크탑 외 환경 지원.
- **5-2 솔루션 단축** — 슬라이스 출력 허용 또는 LL 단계 매크로 최적화 → 평균 ~70수로 단축.

### 비개발 항목
- **카메라 스캔 단계 복원** — HANDOVER v3/v4 명시 미해결. 물리 큐브 필요해 본 라운드 제외. 추후 진행 시 별도 점검.

---

## 7. 알려진 제한

(v4 §7 에서 일부는 해소, 남은 것 또는 새로 발견된 것)

1. **2-4 연습 모드 미구현** — 현재 풀이 보기 모드만. 능동 학습 모드는 향후.
2. **모바일 미검증** — 데스크탑 화면 위주 개발. 모바일 viewport 에서 cube wrapper(400x400)가 화면 초과 가능.
3. **`requestAnimationFrame` 50~70ms violation** — composer.render 가 무거움. 호버 안 할 때 OutlinePass 우회로 개선됐지만 호버 중엔 그대로. 큰 문제 아님.
4. **cube material `transparent: true`** — fade-in 필요로 유지. 약간의 transparent 렌더 비용. 향후 fade 완료 후 false 전환 가능.
5. **솔루션 길이 평균 ~100수** — LBL 보수적. 슬라이스 출력 허용 시 단축 가능 (5-2).
6. **스크린샷 png 5개 + 워크플로 md 문서들** untracked — 본 작업 산출물 아니므로 그대로 둠.

---

## 8. 재현 / 검증 방법

```bash
# 타입체크
npx tsc --noEmit

# 단위 테스트
npm test

# 런타임
npm run dev   # http://localhost:3000
#   홈 → Continue → Manual Input → 큐비 드래그 (슬라이스 포함) / 빈 영역 드래그
#   → "이 상태로 풀기 →" → solve 화면
#   → 다음 이동/이전 이동/자동 재생/속도 변경/풀이 원리 보기/통계
#   → 큐브 빈 영역 드래그 → 시점 회전 → release → 복귀
```

첫 매뉴얼 입력 진입 시 튜토리얼 오버레이 1회 표시 (localStorage 클리어 시 다시).

---

## 9. 참고 문서

- `HANDOVER.md` ~ `HANDOVER_v3.md` — 이전 라운드 기록
- `HANDOVER_v4.md` — 1차 완성 (LBL 솔버 + 매뉴얼 입력)
- `CLAUDE_CODE_PLAN.md` — 1차 작업 계획
- `CLAUDE_CODE_PLAN_v2.md` — 2차 작업 계획 (체크박스 진행 표시)

---

## 10. 2차 완성 커밋

- `1290340` — Bundle A + B
- `d5a79b4` — Bundle D + 테스트
- `8de0481` — Bundle C 부분 + solve 시점 회전

origin/main 보다 4개 커밋 앞섬 (1차 `4b4ab24` 포함). `git push` 별도 요청.
