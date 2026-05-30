# HANDOVER v15

작성일: **2026-05-30**
대상 브랜치: `feat/phase2b-move-detector` (private repo `netizen1119/rubiks-app-private`)
  — `fix/vision-lifecycle-leaks` 머지 포함 (아래 §3).
범위: **Phase 2b 구현** — forward-model 무브 감지 코어(단위 테스트) + tracked-solve 카메라 통합.
이전: `HANDOVER_v14.md` (Phase 2a contour+9-neighbor ROI 검출 + Phase 2b 확정안 §4).

---

## 1. 한눈에 보기

HANDOVER_v14 §4 의 확정 설계(blind 복원 아님 = **forward-model 매칭**)를 그대로 구현.
tracked-solve 진입 시 풀 큐브 상태 S(54자)를 이미 아니까, 카메라가 본 한 면을 S 에 18무브
적용한 예측과 비교해 일어난 무브를 역산한다.

- **순수 코어** (`move-detector.ts`): 카메라 없이 단위 테스트로 검증됨. 6면×4 orient×15무브
  = 360 round-trip 전부 hamming 0 복원. tsc PASS · **51/51 테스트 PASS**.
- **통합** (`tracked-solve.tsx` + `tracker-bridge.ts`): 방향 lock → idle/moving/settled
  상태머신 → 가설 검색 → commit(3D 회전 + S 갱신) → 미매칭 재lock+toast. 카메라 실측 미완(다음).
- 보너스: Phase 2a 검출 파이프라인의 **생명주기 누수 5건** 수리 (별도 fix 브랜치, 머지됨).

---

## 2. 이 세션에 한 작업

### 2-1. `lib/vision/move-detector.ts` — stub → 순수 forward-model 코어
좌표계: S 도 관측 tuple 도 **면 라벨 공간**(U/R/F/D/L/B). 카메라 색(ScanColor)→면 라벨 변환은
호출자 책임. 전부 순수 함수 → 단위 테스트 대상.
- `rotateFace(face[9], k)` — row-major 3×3 를 90° CW 로 k 번 회전 (mod 4). `ROT_CW` 인덱스맵.
- `detectableMoves(front)` — front 면당 감지가능 **15무브** (반대면 그룹 제외; 예 front=F→B 안 보임).
  `OPPOSITE` 맵 + 18 `FACE_MOVES` 필터.
- `lockOrientation(S, face, observed, maxHamming=1)` — known S 면 9칸을 4회전시켜 관측과 최소
  해밍 orient 확정. `maxHamming` 초과 시 null(lock 실패→재시도).
- `searchMove(S, face, orient, observed, threshold=1)` — 15무브 각각 `applyMove(S,m)` → lock 된
  (face,orient) 로 9칸 예측 → 관측 해밍 최소 후보. `threshold` 초과 시 null(미매칭). `score=1-h/9`.
- `detectMove(prev, curr, S, face, orient)` — 모션 게이트(prev==curr→null) + searchMove. (HANDOVER
  시그니처. tracked-solve 는 lock/search 를 직접 호출하므로 현재 미사용이지만 API 로 유지.)
- `getFace`/`applyMove` (lbl-solver) **재사용** — DRY. `FaceLabel` 타입 export(=Exclude<ICubeSide,"X">).
- **로컬 import 는 `.ts` 확장자** — node --test ESM 런타임 resolver 요구 (normalize.ts 와 동일 컨벤션).

### 2-2. `lib/vision/move-detector.test.ts` (신규) — round-trip 13 케이스
카메라 없이 코어 검증. 무브를 *합성*해 예측 9칸을 만들고 detector 가 복원하는지.
- `rotateFace`: 항등/4회전/CW 인덱스/음수 mod.
- `detectableMoves`: 면당 15개, 반대면 제외.
- `lockOrientation`: 4 orient 정확 복원, 1칸 오분류 허용.
- `searchMove`: **6×4×15=360 round-trip** hamming 0 복원, 반대면 불가시성.
- `detectMove`: idle null, 무브 복원, **커밋 체인**(S 갱신하며 연속 무브).
- `package.json` test glob 에 `lib/vision/*.test.ts` 추가.

### 2-3. `lib/vision/tracker-bridge.ts` — `commitDetectedMove` 구현
- `store.rotateCube(move)` (3D gsap 애니, 0.4s) + `set({cube: applyMove(get().cube, move)})`.
- **핵심**: `rotateCubeAction` 은 3D 큐비 *배열*만 재정렬하고 `store.cube` 문자열은 안 건드림
  → bridge 가 applyMove 로 S 직접 동기. 3D 는 cube 문자열에 반응 구독 없음 → 무충돌.
- `isDuringRotation` 가드 — 애니 진행 중이면 둘 다 skip (3D/S desync 방지).

### 2-4. `components/.../tracked-solve.tsx` — 감지 상태머신 통합
- imports: `lockOrientation`/`searchMove`/`FaceLabel`, `commitDetectedMove`, `ICubeMoves`.
- 상수: `MOVE_DELTA_MIN=2`, `SETTLE_FRAMES=2`, `SETTLE_FRAME_DELTA=1`, `MATCH_THRESHOLD=1`,
  `RELOCK_AFTER_UNMATCHED=4`. 모듈 헬퍼 `tupleDelta`(9칸 해밍).
- refs: `trackOrientRef`/`trackFaceRef`(lock), `stableTupleRef`(기준 면), `prevFrameTupleRef`,
  `moveStateRef`(idle/moving), `settleCountRef`, `unmatchedRunRef`. state `lastMove`.
- `runMoveDetection(grid)` (tracking phase 만 호출):
  1. 9칸 X 있으면 skip (가림/노이즈).
  2. orient 미확정 → `lockOrientation` 시도, 성공 시 baseline 잡고 고정.
  3. lock 면≠관측 면 → 큐브 통째 돌림 → 무시.
  4. baselineΔ≥2 → moving. 프레임간 정지 2연속 → settled.
  5. settled & baselineΔ≥2 → `searchMove`. 매칭 & !isDuringRotation → commit + 기준 갱신.
     미매칭 → 기준 갱신 + 미매칭 카운트; 4연속이면 재lock + `showSolveFace` toast.
- frame loop: center-calib 뒤 `if (grid && !learningPhase) runMoveDetection(grid)`.
- 상태 라인에 `move: {lastMove}` 추가.
- `IStoreFn` 은 `{ get: () => useAppStore.getState(), set: (p) => useAppStore.setState(p) }` 로 전달.

### 2-5. i18n
- `messages/{ko,en}.json` `trackedSolve.showSolveFace` 추가 (parity 테스트 통과).

---

## 3. 곁다리: 생명주기 누수 수리 (`fix/vision-lifecycle-leaks`, 머지됨)
Phase 2a 코드 점검에서 발견한 자원 누수/게이트 누락 5건 (논리 버그 아님):
1. `tracked-solve.tsx` camera effect → StrictMode-safe setup/cleanup 재작성(inited 가드 제거).
   onExit 미경유 언마운트 시 MediaStream·RAF·Worker 누수 해소.
2. `tracked-solve.tsx` `detectCubePose` 가 raw `lastROIRef` 사용 → stale-gated `roi` 로 교체.
3. `tracked-solve.tsx` `cvReadyRef` 게이트 — 로딩중/실패 worker 에 frame 전송 낭비 방지.
4. `cv-worker-client.ts` worker crash 시 `inFlight` 영구 wedge → error 핸들러서 리셋 + pending 정리.
5. `cv-worker.js` contour 루프 throw 시 Mat 누수 → per-iteration try/finally.

origin push 됨. main 미머지. feat 브랜치에 머지돼 있어 main 머지 시 중복 커밋 git 자동 처리.

---

## 4. 현재 미커밋 (이 커밋에 포함)
```
M  components/.../tracked-solve.tsx   (감지 상태머신 통합)
M  lib/vision/move-detector.ts        (FaceLabel export — 코어는 55e0953 에 커밋됨)
M  lib/vision/tracker-bridge.ts       (commitDetectedMove)
M  messages/{ko,en}.json              (showSolveFace)
?? HANDOVER_v15.md, CLAUDE.md 갱신
```
`tsc --noEmit` PASS · `npm test` **51/51** PASS · lint clean(경고 2개=기존 []-deps effect).
주: move-detector 코어 + 테스트는 이미 `55e0953` 커밋. 이번 미커밋은 Step C(통합) 분량.

---

## 5. 다음 세션 재개 — Phase 2b 실측 + Phase 3

### 즉시: 카메라 실측 (자동 테스트 불가 영역)
상태머신은 React refs+store 결합이라 단위 테스트 안 됨 → **dev 서버 시각 확인이 가장 빠름**.
1. 홈 → 카메라로 따라가며 풀기 → scan/manual-input 으로 S 입력 → tracked-solve.
2. 4초 색 학습(큐브 한 바퀴) 후 한 면 비추고 **천천히** 한 수씩 → 상태라인 `move:` 갱신 확인.
3. 점검 포인트:
   - 방향 lock 이 첫 프레임에 잡히는가 (안 잡히면 색 캘리브 미수렴 → 학습 시간/조명).
   - 무브 1수 = commit 1회 인가 (이중 트리거 시 `SETTLE_FRAMES`/`MOVE_DELTA_MIN` 상향).
   - 미매칭 toast 빈발 시 `MATCH_THRESHOLD` 또는 lock 정확도 문제.

### 튜닝 노브 (전부 tracked-solve.tsx 상단)
- `MOVE_DELTA_MIN`(moving 진입), `SETTLE_FRAMES`/`SETTLE_FRAME_DELTA`(정지 판정),
  `MATCH_THRESHOLD`(매칭 허용 해밍), `RELOCK_AFTER_UNMATCHED`(재lock 임계).

### 알려진 한계
- **0.4s 회전 게이트 + 15fps**: 빠른 연속 무브 못 따라감 → 천천히 안내. (애니 큐잉은 Phase 3.)
- **front-facing lattice**: 큐브 크게 기울이면 축 정렬 깨짐 (Phase 2a 잔여). warpPerspective 보정 후보.
- **3D 미렌더**: tracked-solve 엔 Three 캔버스 없음 → rotateCube 는 상태만 갱신(안 보임). Phase 3 합류.
- **방향 가정 고정**: lock 후 사용자가 큐브 통째 돌리면 추적 면≠관측 면 → 그 프레임 무시(재lock 안 함).

### Phase 3 (tracker-bridge §주석)
- 풀이 흐름 합류: 제안 무브와 다른 무브 감지 시 재풀이/안내.
- tracked-solve 에 3D 미리보기 합류 or 다음 추천수 오버레이.

### 디버그 스캐폴딩 (출시 전 off)
`DEBUG_QUADS`(cv-worker.js), `ENABLE_OPENCV_DEBUG`/full-frame `drawCannyEdges`(tracked-solve).
실측 끝나면 끄기.

---

## 6. 메모
- worker 정적 파일(`cv-worker.js`)은 HMR 안 됨 — 변경 시 Ctrl+Shift+R. TS 파일은 HMR.
- 검증 우선순위: 순수 코어=단위 테스트(완), 통합=시각 확인(미완).
- 브랜치 2개: `fix/vision-lifecycle-leaks`(push됨), `feat/phase2b-move-detector`(fix 머지+코어 커밋,
  Step C 미커밋). main 머지 순서는 fix→feat 권장(또는 feat 하나로 한꺼번에).
