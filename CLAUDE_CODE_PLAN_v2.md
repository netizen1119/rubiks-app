# Rubik's Cube 학습 앱 — 2차 작업 계획

작성일: **2026-05-20**
이전 상태: `HANDOVER_v4.md` (커밋 `4b4ab24`) 참고
범위: 카메라 스캔 제외, 매뉴얼 입력 + 학습 UI 강화 중심

> **상태 (2026-05-20 마감)**: 묶음 A/B/D 완료 + 묶음 C 부분 완료 (3-1, 3-2, 3-4).
> 미진행: 2-4 (연습/힌트 모드), 4-3 (모바일), 5-2 (솔루션 단축).
> 결과 정리: `HANDOVER_v5.md` 참고. 커밋: `1290340`, `d5a79b4`, `8de0481`.

---

## 0. 컨텍스트

- 물리 큐브 없이 학습하는 사용자가 대상
- 입력 경로: **매뉴얼 입력 (메인 vis 직접 조작) → solve 단계 학습**
- 솔버: LBL 8단계, 슬라이스 무브 정규화 완료, 평균 ~100수
- 카메라 스캔은 본 라운드 제외

---

## 1. 작업 항목 (우선순위 정렬)

각 항목에 다음 형식 기재:
- **목표**: 사용자가 얻는 가치
- **현황**: 지금 어떤 상태인지
- **구현 방향**: 어떻게 만들지
- **영향 범위**: 어떤 파일에 닿는지
- **난이도 / 예상 작업량**

체크박스로 진행 추적: `[ ]` 미진행, `[x]` 완료

---

## 🔴 우선순위 1: 학습 사용성 직결

### [x] 1-1. 매뉴얼 입력 슬라이스 회전 + 시점 회전

**목표**: 가운데 큐비 호버해도 회전 가능, 뒷면 보기 가능. 매뉴얼 입력의 답답함 해소.

**현황**:
- 슬라이스 무브(M/E/S): `resolveAxisSlice` 에서 slice=0 → null 반환 (회전 안 됨)
- 시점 회전: 진입 시 `orbitControls.enabled = false`로 완전 비활성

**구현 방향**:
- 슬라이스: `lib/moves/rotation-utils.ts` 의 `rotateCubeAction` 에 M/E/S 케이스 추가
  - 현재 throw "M not implemented"
  - 가운데 슬라이스(예: gx=0) 의 9개 큐비를 회전 그룹에 attach
  - 정규화 파이프라인은 이미 슬라이스 지원하므로 시각화만 보강
- 시점: `scramble-cube.tsx` 의 `onDown` 에서 raycast 미스 시(빈 영역 클릭)
  - 그 경우엔 `orbitControls.enabled = true` 임시 활성 + 드래그 중 시점 회전
  - `pointerup` 시 다시 비활성

**영향 범위**:
- `lib/moves/rotation-utils.ts`
- `components/main-page/stages/manual-input/scramble-cube.tsx`
- `lib/maps/move-descriptions.ts` (M/E/S 한글 설명 추가)

**난이도**: 중. rotation-utils 의 큐비 인덱스 매핑 확장이 핵심.

---

### [x] 1-2. Solve 단계 "이전 이동" / Undo

**목표**: 실수해도 한 수씩 되돌릴 수 있어 학습 부담 ↓

**현황**:
- `nextCubeSolveStep` 만 존재. 일방향.
- 사용자 클릭 시 `cubeSolutionStep` 증가 + 시각 회전.

**구현 방향**:
- `lib/store/prev-solve-step.ts` (신규): 역무브 시각 회전 + `cubeSolutionStep` 감소
  - 역무브 매핑: U → U', U' → U, U2 → U2
  - `rotateCube2Part` 와 동일하게 2-phase 처리
- `solve.tsx`: "이전 이동" 버튼 추가 (step > 0 일 때만 활성)

**영향 범위**:
- `lib/store/store.ts` (`prevCubeSolveStep` 액션)
- `lib/store/prev-solve-step.ts` (신규)
- `components/main-page/stages/solve/solve.tsx`

**난이도**: 하. 기존 패턴 거울 구조.

---

### [x] 1-3. 단계 자동 인식 (Smart Start)

**목표**: 사용자가 일부 푼 상태에서 시작 시 해당 단계부터 안내.

**현황**:
- `initSolveCube` 가 항상 1단계부터 시작.
- `solveStages` 에 빈 무브 단계 있어도 도트는 채워지지만 진행은 처음부터.

**구현 방향**:
- `solveLBL` 결과의 `stages[i].moves.length` 가 0 인 초기 단계들을 자동 스킵
- `currentStageIndex` 와 `cubeSolutionStep` 을 첫 비빈 단계에 맞춰 초기화
- 또는 입력 상태에 대해 `STAGE_GOALS[i]` 만족 여부 검사 → 만족하는 마지막 단계까지 스킵

**영향 범위**:
- `lib/store/init-solve-cube.ts`
- `lib/store/next-solve-step.ts` (이미 누적 이동수 기준 동기화하므로 추가 변경 최소)

**난이도**: 하.

---

## 🟡 우선순위 2: 학습 가치 직접 향상

### [x] 2-1. 단계별 알고리즘 설명 카드

**목표**: 각 단계에서 사용되는 알고리즘과 패턴 설명. 단순 따라하기 → 이해 학습.

**현황**:
- `solveStages[i].stageName` 만 있음 (예: "5단계: 윗면 십자를 맞춘다")
- 어떻게/왜 푸는지는 설명 없음.

**구현 방향**:
- `lib/maps/stage-descriptions.ts` (신규): 단계별 설명 + 대표 알고리즘 + 패턴 이미지/SVG
- `components/main-page/stages/solve/stage-info.tsx` (신규): 단계 변경 시 카드 표시
- 또는 `StageProgress` 도트 클릭 시 해당 단계 설명 보이기

**영향 범위**:
- 신규 파일 2개
- `solve.tsx` 레이아웃 조정

**난이도**: 중. 알고리즘 콘텐츠 작성이 시간 소요.

---

### [x] 2-2. 자동 재생 / 속도 조절

**목표**: 손 안 대고도 풀이 관찰 가능. 학습자가 본인 큐브와 비교하면서 따라감.

**현황**: 매번 "다음 이동" 클릭 필요.

**구현 방향**:
- `solve.tsx` 에 Play/Pause 토글 + 속도 슬라이더(0.5x ~ 3x)
- `useEffect` 로 interval 기반 `nextCubeSolveStep` 호출 (isPlaying 일 때만)
- 속도 = `rotateCubeAction` 의 duration 조절 (현재 0.4s 고정)
  - rotation-utils 에 duration 옵션 추가 필요

**영향 범위**:
- `solve.tsx` (UI + 상태)
- `lib/moves/rotation-utils.ts` (duration 옵션)
- `lib/store/store.ts` (playSpeed)

**난이도**: 중.

---

### [x] 2-3. 통계 / 진행률

**목표**: 풀이 이동수, 시간, 단계별 분포 표시. 동기 부여.

**현황**: 표시 없음.

**구현 방향**:
- `solve.tsx` 에 통계 패널 추가
  - 총 이동 / 단계별 이동 수
  - 진행률 (현재 이동 / 전체 이동)
  - 경과 시간 (solve 진입부터)
- 완료 시 결과 화면

**영향 범위**:
- `solve.tsx`
- 신규 `components/main-page/stages/solve/stats.tsx`

**난이도**: 하.

---

### [ ] 2-4. 연습 모드 / 힌트 모드

**목표**: 사용자가 직접 다음 무브를 추측 → 정답이면 진행, 틀리면 힌트.

**현황**: 풀이 보기만 가능.

**구현 방향**:
- 모드 토글 ("풀이 보기" / "내가 풀기")
- "내가 풀기" 모드:
  - 사용자가 매뉴얼 입력 방식으로 큐브에 무브 적용
  - 시스템이 적용된 무브와 `solution[step]` 비교
  - 일치 → step 증가 / 불일치 → 토스트 힌트 ("다음 무브는 F 입니다")
- 단계별 집중 연습 옵션 (PLL 만 등)

**영향 범위**:
- `solve.tsx` (큰 변경)
- 매뉴얼 입력 로직 일부 재사용 (메인 vis 캔버스 핸들러)
- 새 store 상태 (mode, attempts)

**난이도**: 상. 두 모드 통합이 복잡.

---

## 🟢 우선순위 3: 매뉴얼 입력 UX 보강

### [x] 3-1. 첫 진입 튜토리얼 오버레이

**목표**: 매뉴얼 입력 방법(드래그, 시점, 풀기 버튼) 1회용 안내.

**현황**: 짧은 설명 텍스트만.

**구현 방향**:
- localStorage 로 1회 표시 (`manualInputTutorialSeen`)
- 화면 위에 단계별 오버레이 (드래그 → 시점 → 풀기 순)
- 또는 작은 GIF/애니메이션

**영향 범위**:
- `scramble-cube.tsx`
- 신규 `tutorial-overlay.tsx`

**난이도**: 하.

---

### [x] 3-2. 호버 시각 보조 강화 (텍스트 힌트로 구현)

**목표**: 어느 방향으로 드래그하면 어떻게 도는지 미리보기.

**현황**: 외곽선만 표시. 방향 표시 없음.

**구현 방향**:
- 호버 시 화살표 텍스처(스프라이트) 큐비 면에 오버레이
- 4방향 화살표 (↑↓←→)
- 또는 슬라이스 시각화 (Y축 = 가로 띠, X축 = 세로 띠)

**영향 범위**:
- `scramble-cube.tsx` (Three.js sprite 추가)

**난이도**: 중. Three.js sprite 다루기.

---

### [x] 3-3. Reset 버튼 복원

**목표**: 매뉴얼 입력에서 명시적으로 솔브드로 되돌리기.

**현황**: 제거됨. 뒤로 → Manual Input 재진입이 사실상의 reset.

**구현 방향**:
- "Reset" 버튼 추가
- 핸들러: 현재 useEffect 의 reset 로직(orgIdx 기반 재배열) 호출
- `updateCube(solved_cube, true)`

**영향 범위**:
- `scramble-cube.tsx` (UI + 핸들러)

**난이도**: 하.

---

### [x] 3-4. 매뉴얼 입력 무브 히스토리

**목표**: 사용자가 적용한 무브 시퀀스 표시. 실물 큐브에서 동일 스크램블 재현 가능.

**현황**: 표시 없음.

**구현 방향**:
- 회전 시 `moveHistory: string[]` 에 푸시
- 매뉴얼 입력 UI 하단에 무브 시퀀스 표시 (스크롤 가능)
- 복사 버튼 ("R U F2 R' U' ...")

**영향 범위**:
- `scramble-cube.tsx` (UI + 상태)

**난이도**: 하.

---

## 🔵 우선순위 4: 시각/디자인 폴리시

### [x] 4-1. 단계 전환 부드러운 페이드

**목표**: stage 전환 시 즉시 끊김 → 부드러운 페이드.

**현황**: `AnimatePresence` 제거로 즉시 전환.

**구현 방향**:
- 각 stage 컴포넌트 root 에 `motion.div initial={{opacity:0}} animate={{opacity:1}}` 만
- exit 의존 없음 (mount/unmount 시점에 fade in 만)

**영향 범위**:
- `init.tsx`, `scan.tsx`, `scramble-cube.tsx`, `solve.tsx` root element 변경

**난이도**: 하.

---

### [x] 4-2. 큐브 시각 품질

**목표**: 깊이 정렬 안정화, 외곽선/스티커 시각 다듬기.

**현황**:
- cube material `transparent: true, opacity: 0~1` (불필요한 transparent 경로)
- OutlinePass 외곽선 굵기 6/2

**구현 방향**:
- `gen-empty-cube.ts`: cube material `transparent: false`, 초기엔 opacity 1
  - useInitApp 의 hide-stickers 로직 영향 확인 필요
- OutlinePass 색상/두께 조절 (테마와 어울리게)

**영향 범위**:
- `components/cube-visualization/gen-empty-cube.ts`
- `cube-three.tsx`
- `lib/store/hide-stickers.ts` (영향 검토)

**난이도**: 중. hide-stickers 와의 상호작용 검증 필요.

---

### [ ] 4-3. 모바일 최적화

**목표**: 작은 화면에서도 사용 가능.

**현황**:
- cube wrapper 400px 고정. 모바일에서 viewport 초과 가능.
- 터치 인터랙션 미검증.

**구현 방향**:
- 반응형 cubeScale: `Math.min(1, viewport_width / 500)` 등
- pointer events 는 터치 호환이지만 pinch zoom 차단 필요할 수도
- 모바일에선 시점 회전 영역을 더 크게

**영향 범위**:
- `scramble-cube.tsx`
- `solve.tsx`
- `cube-pos-anchor.tsx`

**난이도**: 중.

---

## ⚪ 우선순위 5: 기술 부채 / 품질

### [x] 5-1. 테스트 자동화

**목표**: 회귀 방지. 28 케이스 (정규화+풀이+검증) 영구화.

**현황**: 임시 파일로만 검증 후 삭제.

**구현 방향**:
- `vitest` 도입
- `lib/solver/lbl-solver.test.ts`: 28 케이스 + 추가 랜덤
- `lib/store/init-solve-cube.test.ts`: 정규화/relabel 단위 테스트
- npm script: `npm test`

**영향 범위**:
- `package.json` (dependency, script)
- 신규 테스트 파일

**난이도**: 중. vitest 설정 + 기존 코드와 호환.

---

### [ ] 5-2. 솔루션 단축

**목표**: 평균 ~100수 → ~50~70수 로 단축 (학습 부담 ↓)

**현황**: LBL 보수적 접근, 출력에 슬라이스 미포함.

**구현 방향**:
- 옵션 A: 슬라이스 출력 허용 (rotation-utils 슬라이스 지원 후) → 평균 ~70수
- 옵션 B: LL 단계의 매크로 탐색 최적화 (검증된 PLL/OLL 알고리즘 직접 매핑)
- 옵션 C: Kociemba 두 단계 솔버 (학습 모드 / 최단 풀이 모드 분리)

**영향 범위**:
- `lib/solver/lbl-solver.ts` 핵심 부분
- (옵션 A) `lib/moves/rotation-utils.ts`

**난이도**: 상. 솔버 알고리즘 깊이 있는 변경.

---

### [x] 5-3. 렌더 성능 최적화

**목표**: requestAnimationFrame 50ms+ violation 해소.

**현황**: composer.render() 가 매 프레임 호출. OutlinePass 가 가장 무거움.

**구현 방향**:
- 변화 감지: 카메라/오브젝트 변경 시에만 render
- OutlinePass: outlinedSelection.current.length === 0 일 때 패스 스킵
- 또는 throttle (16ms → 33ms 등)

**영향 범위**:
- `cube-three.tsx` 의 render 루프

**난이도**: 중. THREE.js 렌더 파이프라인 이해 필요.

---

## 2. 권장 작업 묶음

전부 한 번에 진행하기보다, 다음 묶음 중 하나 선택 권장:

### 🎯 묶음 A: "학습 흐름 완성" (최우선 추천)
- 1-1 (슬라이스+시점 회전)
- 1-2 (Undo)
- 1-3 (자동 인식)
- 2-1 (단계 설명 카드)

**예상 작업량**: 중상 / **사용자 가치**: 매우 높음

### 🎯 묶음 B: "패시브 학습"
- 2-2 (자동 재생)
- 2-3 (통계)
- 4-1 (부드러운 전환)

**예상 작업량**: 중 / **사용자 가치**: 중상

### 🎯 묶음 C: "능동 연습"
- 2-4 (연습/힌트 모드)
- 3-4 (무브 히스토리)
- 3-1 (튜토리얼)

**예상 작업량**: 상 / **사용자 가치**: 매우 높음 (능동 학습)

### 🎯 묶음 D: "기반 정비"
- 5-1 (테스트)
- 4-2 (시각 품질)
- 5-3 (성능)
- 3-3 (Reset)

**예상 작업량**: 중 / **사용자 가치**: 중 (장기적)

---

## 3. 진행 방식

1. 사용자가 묶음 또는 개별 항목 선택
2. 항목별 체크박스로 진행 표시
3. 완료 시 본 문서 업데이트 + `HANDOVER_v5.md` 작성
4. 1차 완성 커밋 (`4b4ab24`) 이후 별도 브랜치/PR 권장

---

## 3.5. 추가 구현 (계획 외)

### [x] solve 단계 시점 회전 + 자동 복귀
사용자 요청으로 추가 구현. solve 화면에서 빈 영역 드래그 시 시점 회전,
release 시 0.6초 부드럽게 원위치로 복귀. canvas pointer-events 활성화 +
OrbitControls `start`/`end` 이벤트 + gsap 카메라 트윈.

---

## 4. 참고

- 1차 완성 상태: `HANDOVER_v4.md` 참고
- 이전 라운드 계획: `CLAUDE_CODE_PLAN.md` (LBL 솔버 도입)
- 본 계획: 사용자 결정 후 항목 단위로 실행
