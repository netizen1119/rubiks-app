# HANDOVER v16

작성일: **2026-06-03**
대상 브랜치: `feat/phase2b-move-detector` (private repo `netizen1119/rubiks-app-private`)
범위: **큐브 학습 모드** 추가 (easiestsolve.com 참고) + 홈 진입점 정리.
이전: `HANDOVER_v15.md` (Phase 2b forward-model 무브 감지 + tracked-solve 카메라 통합).

---

## 1. 한눈에 보기

easiestsolve.com(비기너 LBL 8단계, 친근 별칭) 참고해 **학습 흐름**을 추가. 알고리즘은 기존
`solveLBL` 그대로 — 신규는 **프레젠테이션/상호작용 레이어**뿐.

- **데모 모드** (`learn-demo.tsx`): 섞인 큐브 없이 SOLVED 에 대표 알고리즘 역순을 칠해
  케이스를 만든 뒤 알고리즘 애니 재생(루프) = 알고리즘 시연.
- **연습 모드** (`learn-practice.tsx`): 내 큐브 스캔/입력 → 실제 풀이 단계를 7단계 친근 네이밍으로
  **직접 따라하기**(드래그). 다음 무브를 큐브 위 **3D 곡선 화살표**로 힌트. 자유 시점 회전(고정)+리셋.
- **홈 정리**: 진입점 5→2 (내 큐브로 배우기 / 카메라로 따라가며). 차근차근·빠르게·데모는 숨김.
- 공통 버그 수리: 스캔/섞기/풀기/학습 후 홈 복귀 시 큐브 풀린 상태로 복원.

tsc PASS · **51/51 테스트 PASS** (솔버 코어 무변경). 카메라 실측은 여전히 미완(시각 확인).

커밋: `06ac926`(학습 모드 추가) · `0e5f8b1`(홈 진입점 2개로 정리). 둘 다 origin 푸시됨.

---

## 2. 이 세션에 한 작업

### 2-1. 학습 stage 신설 — `components/main-page/stages/learn-method/`
디스패처 `learn-method.tsx` 가 `store.learnMode` 로 분기.
- `learn-demo.tsx` — solved 큐브 알고리즘 시연(루프). `resetCubiesToSolved` + `updateCube(케이스)`
  → `setInterval`+`rotateCube` 재생. 단계 점/이전·다음/재생·일시정지/다시.
- `learn-practice.tsx` — 실제 큐브 단계별 따라하기. solve 의 `handleGuess`(드래그 정답 판정,
  더블무브 처리) 로직 + `StageInfo`/`MoveGuide` 서브컴포넌트 **재사용**. 친근 별칭 헤더 + 7단계 점.
  완료 시 축하 → 홈.
- `learn-steps.ts` — 7단계 데이터 `{id, lblDescIdx, demoMoves}` + `invertMoves`. 텍스트는 기존
  `messages.stages.lblDesc[idx]` 재사용(중복 0). 별칭만 `learnMethod` 네임스페이스.
- `move-arrow.ts` — 무브 → 돌릴 면 위 회전방향 **3D 곡선 화살표**(TubeGeometry 호 + Cone 화살촉).
  좌표계 U=+y/R=+x/F=+z, 반경~1.5. 비프라임=면 바깥에서 시계방향(각도 감소). `depthTest:false`로
  큐브에 안 가려짐. LBL 출력은 면 무브만 → 모든 무브 대응.
- `reset-cubies.ts` — orgIdx 기반 큐비 solved 복원 (scramble-cube 의 resetCubeToInitial 추출, 공유).

### 2-2. 라우팅 — `learnMode` 플래그
- `store.ts` — `learnMode: false` 추가. `initSolveCube(opts?: {autoAdvance})` 시그니처 확장.
- `init-solve-cube.ts` — `autoAdvance:false` 면 첫 무브 미리보기(nextCubeSolveStep) 생략 → 연습이
  step0 에서 시작(드래그 입력과 어긋나지 않게).
- `scan/card.tsx` + `manual-input/scramble-cube.tsx` — 완료 분기:
  `learnMode ? "learn-method" : trackedSolve ? "tracked-solve" : "solve"`.
- `main-page.tsx` — 디스패처에 learn-method 등록 + **홈 복귀 리셋**(deep stage → homepage/deviceselect
  전환 시 큐비 solved 복원 + 스핀 재시작, prevStage ref 가드).

### 2-3. 홈 진입점 정리 — `init.tsx`
홈 버튼 5→2: **내 큐브로 배우기**(`chooseLearnMode`, learnMode=true) + **카메라로 따라가며 풀기**
(`chooseTrackedMode`). 차근차근/빠르게(`chooseMode` 제거)·데모 버튼 숨김.
solve(learn/fast)·learn-demo 스테이지 **코드는 유지**(홈 도달 불가). solve 의 `solvePractice` 와
learn-practice 중복 → 홈에선 learn-practice 로 일원화.

### 2-4. i18n
`messages/{ko,en}.json` — `learnMethod` 네임스페이스(친근 별칭 7 + practiceHint/done/resetView/
play/pause/replay/stepOf/howItWorks/goal/approach/algo/tip), `home.modeStudyScan`.
미사용 잔류: `home.modeLearn/modeFast/modeStudyDemo`(복원 대비 보존).

---

## 3. 친근 별칭 매핑 (easiestsolve → app 단계)

| 카드 id | 친근 별칭 | lblDesc idx | app 단계 |
|---|---|---|---|
| cross | 🌼 데이지 → 흰 십자 | 0 | 1단계 흰 십자 |
| firstLayer | 🐶 강아지 집 찾기 | 2 | 3단계 1층 코너 |
| secondLayer | 🔤 ABC 끼우기 | 3 | 4단계 2층 |
| yellowCross | ➕ 노란 십자 (FUR·URF) | 4 | 5단계 노란 십자 |
| yellowFace | 🐟 노란 물고기 | 5 | 6단계 노란 면 |
| cornerPerm | 👍 엄지척 코너 | 6 | 7단계 3층 코너 |
| edgePerm | 🎉 마무리 한 방! | 7 | 8단계 3층 엣지 |

(lblDesc idx 1=정렬, 0무브 → cross 에 통합.)

---

## 4. 데모 메커니즘 (왜 항상 루프 가능한가)

vis 큐브의 `updateCube(str)` 는 sticker index(=solved 배치) 기준으로 색만 칠한다 → **큐비가
solved 위치일 때만** 인덱싱이 유효. 그래서:
1. `resetCubiesToSolved()` (orgIdx 복원) → 큐비 solved 위치.
2. `updateCube(applyMoves(SOLVED, invert(algo)))` → "케이스" 색 페인트.
3. `rotateCube` 로 algo 재생 → 색 순열이 solved 로 돌아옴(rotateCube 와 applyMove 가 동일 순열).
scramble=invert 라 algo 1회 = 항상 solved 복귀 → 무한 루프 안전. (연습 모드는 스캔이 이미
색을 칠한 상태이므로 reset 하지 않음.)

---

## 5. 검증 / 남은 것

- `npx tsc --noEmit` PASS · `npm test` **51/51** (솔버 무변경).
- **시각 확인 필요** (상태머신+GSAP 결합 → 자동 테스트 불가):
  - 연습: 화살표 방향 ↔ 정답 무브 일치, 드래그 판정, 단계 전환, 완료, 자유 시점+리셋.
    (화살표 방향 어긋나면 `move-arrow.ts` 의 `prime ?` 삼항 한 줄 플립으로 전체 교정.)
  - 홈 복귀 리셋, 데모 루프.
- 미완(이전부터): Phase 2b 카메라 실측 + 튜닝(`tracked-solve.tsx` MOVE_DELTA_MIN/SETTLE_FRAMES/
  MATCH_THRESHOLD).
- 참고: `LEARN_METHOD_PLAN.md` (설계 계획).
