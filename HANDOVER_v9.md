# HANDOVER v9

작성일: **2026-05-26**
대상 브랜치: `main` (private repo `netizen1119/rubiks-app-private`)
범위: **카메라 트래킹 풀이 모드** 신규 트랙 — 사용자가 큐브를 직접 돌리면
카메라가 실시간으로 추적하면서 풀이를 안내하는 시스템의 설계/스캐폴딩.
이전: `HANDOVER_v8.md` (i18n·a11y·DRY).

---

## 1. 한눈에 보기

매핑(scan/manual-input)으로 큐브 상태 S 가 확정된 뒤, 카메라가 사용자가 돌리는
무브를 실시간 추적·인식해 풀이 단계를 자동 진행시키는 새 모드.
원리적 기반: **6면 중심 색은 영구 anchor** (면 무브에선 중심이 회전만 함).
3개 이상 보이면 큐브 좌표계 결정 → 매핑된 S 와 관측의 차이를 18 무브 후보 중에서
탐색해 적용.

진행 상태:
- **Phase 0 (스캐폴딩)** — 커밋 완료 `b98a73a`
- **Phase 1 (PoC-1: pose lock)** — Iteration 2 코드 작성 완료, **미커밋 / dev 검증 대기**
- **Phase 2~4** — 미착수

---

## 2. 설계 결정 (대화 요약)

### 2-1. 왜 가능한가
- 면 무브는 인접 4면에 띠를 남기므로, 카메라가 한 면만 봐도 띠 변화로 무브 감지 가능.
- **6면 중심**은 영구 위치 anchor — 3개 이상 보이면 큐브의 3축 유일 결정.
- 매핑된 S 와 가시영역을 18 무브 후보(`U/D/F/B/L/R × {´, 2, plain}`)각각에 적용해
  비교, 가장 잘 맞는 m 을 commit.

### 2-2. 사각지대 (의도된 한계)
- **B(뒷면) 무브**: 인접한 가시 띠가 전혀 없으면 관측상 변화 0 → UX 로 "B 계열은 뒤가
  살짝 보이게 기울여 주세요" 안내로 우회.
- **큐브 자체 회전 vs 무브**: 모든 스티커가 함께 움직이면 회전, 한 띠만 움직이면 무브.
  centers 들의 상대 위치 일관성으로 판별.

### 2-3. 모드 분리 (결정)
기존 solve 스테이지에 토글로 얹지 않고 **별도 `tracked-solve` 스테이지** 로 분리.
사유: solve UI(제안/이전/자동재생)와 tracked UI(카메라 미리보기/감지 상태) 책임이
완전히 다름. 합치면 양쪽 다 복잡해짐.

알고리즘 측면에선 `solveMode: "learn"` 그대로 사용 (사용자가 직접 무브를 하기 때문에
단계별 풀이가 의미 있음). 즉 `trackedSolve: boolean` 은 **인터랙션 모드** 플래그.

### 2-4. 색 분류기 (결정)
scan 의 풀 분류기(`classify-scan-color.ts` — HSV 거리 + 캘리브레이션)는 **그대로 재사용**.
별도 경량 분류기를 만들 계획이었지만 Iteration 2 에서 그냥 같은 함수 호출해 보고
부하/정확도 측정 후 결정. 매 프레임 3,600 샘플 (1280×720, step=16) 기준 부담 미미.

향후: scan 완료 시점에 캘리브된 6색 reference 를 store 에 저장 → tracked-solve 시작 시
prime 해서 첫 프레임부터 잘 분류되게 (현재는 default hue 로 시작 — manual-input
경로에선 영구 default).

### 2-5. 실행 환경 (결정)
**main thread + requestAnimationFrame** 으로 시작. 6중심 검출은 부담 적음.
부하 측정 후 Worker + OffscreenCanvas 로 옮길 수 있음 (현재 미구현).

---

## 3. 단계별 마일스톤

| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 스캐폴딩 (모드 진입 + 모듈 폴더) | ✅ 커밋 `b98a73a` |
| 1 | PoC-1: pose lock (6중심 검출 + 오버레이) | 🟡 Iteration 2 미커밋, 검증 대기 |
| 2 | PoC-2: 단일 무브 감지 (모션 게이트 + 18 가설 검색) | ⬜ |
| 3 | MVP: solver 연동 (감지 m → store dispatch + 재풀이) | ⬜ |
| 4 | 폴리시 (occlusion / lighting / i18n / a11y) | ⬜ |

---

## 4. 구조

### 4-1. 새 모듈 — `lib/vision/`
| 파일 | 역할 |
|---|---|
| `pose-lock.ts` | 프레임 → 검출된 중심 리스트 + 향후 3축 산출. Iteration 2: centroid 만. |
| `move-detector.ts` | 모션 게이트 + 가설 검색 (18 무브 후보). **stub** (Phase 2). |
| `tracker-bridge.ts` | 확정 무브 후보 → store dispatch. **stub** (Phase 3). |

세 모듈 모두 순수 함수 시그니처. 향후 Web Worker 로 이전해도 호출부 변경 최소.

### 4-2. 새 스테이지 — `tracked-solve`
- `components/main-page/stages/tracked-solve/tracked-solve.tsx` —
  카메라 + 처리 canvas + 오버레이 canvas + RAF 루프 + 디버그 상태 표시.

### 4-3. store 변경 (`lib/store/store.ts`)
- `appStages`: `"tracked-solve"` 추가.
- `trackedSolve: boolean` — 인터랙션 모드 플래그. scan/manual-input 종료 시 분기.
- `trackStream: MediaStream | null` — 트래킹 모드 카메라 스트림 (scanStream 과 분리).

### 4-4. 진입 흐름
```
homepage
 └ [카메라로 따라가며 풀기 버튼]
   → solveMode="learn", trackedSolve=true, currentAppStage="deviceselect"
 → deviceselect → scan 또는 manual-input
 → (scan 종료 또는 manual-input "이 상태로 풀기 →")
   → trackedSolve 플래그 체크 → currentAppStage="tracked-solve"
 → tracked-solve (카메라 미리보기 + 검출 오버레이)
```

라우팅 분기는 scan/card.tsx:47, manual-input/scramble-cube.tsx:187 한 줄씩 추가.

---

## 5. 커밋 (v8 이후)

| 해시 | 메시지 | 상태 |
|---|---|---|
| `b2b5ebf` | docs: bump test case count in CLAUDE.md (28 → 38) | 커밋·push 완료 |
| `b98a73a` | scaffold: add tracked-solve mode (Phase 0) | 커밋됨, **push 대기** |
| _(미커밋)_ | Phase 1 Iteration 1+2: 카메라 plumbing + 색 블롭 검출 | 코드 작성 완료, 검증 대기 |

### Phase 1 미커밋 변경 파일
- `lib/store/store.ts` — `trackStream` 필드 추가
- `lib/vision/pose-lock.ts` — `detectCubePose` 실제 구현 (grid sampling + classifyColor + centroid)
- `components/main-page/stages/tracked-solve/tracked-solve.tsx` —
  placeholder 제거, video + procCanvas + overlayCanvas + RAF + 검출 시각화

---

## 6. 검증 현황

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` | PASS |
| `npm test` | 38/38 PASS (i18n 키 가드 통과 — `home.modeTracked`·`trackedSolve.*`) |
| `npm run lint` | 0 error / 13 warning (기존 7 + vision stub의 `_param` 6) |
| dev 서버 (localhost:3001) | 기동 OK, Phase 0 라우팅까지 사용자 확인 완료 |
| Phase 1 카메라/검출 시각화 | **검증 대기 (휴식 후 재개)** |

---

## 7. 남은 작업

### Phase 1 (재개 시 즉시)
1. dev 서버에서 tracked-solve 진입 → 카메라 권한 / 비디오 미리보기 / 색 원 오버레이 확인.
2. 검출 정확도 1차 평가 — 6중심 모두 잡히는지, 잘못된 색이 끼는지.
3. 정확도 이슈 발견 시: `SAMPLE_STEP`/`MIN_CENTER_PIXEL_COUNT` 튜닝 또는 connected-component
   라벨링 도입 검토 (현재는 단순 centroid).
4. 통과하면 Phase 1 마무리 commit + Phase 2(무브 감지) 진입.

### Phase 1 후속 (가능하면 이 phase 안에 한 번에)
- 3+ 중심에서 큐브 3축 산출 → 화면에 RGB 축 라인 오버레이.
- scan 캘리브레이션 결과를 tracked-solve 시작 시 prime (manual-input 경로 제외).

### Phase 2 (다음 트랙)
- 모션 게이트 state machine (idle → moving → settled).
- 18 무브 가설 검색 (apply(m, S) 와 관측 가시영역 일치 점수).
- 정확도 80%+ 목표.

### 알려진 한계 (의도)
- B 무브는 단독으로 보이지 않는 위치에서 검출 불가 → UX 안내로 우회 예정.
- 손 occlusion 시 false negative → 모션 게이트가 흡수 (settled 까지 commit 보류).

---

## 8. 재현 / 검증

```bash
git checkout main
git pull
npx tsc --noEmit
npm test
npm run dev   # http://localhost:3000 (3001 fallback)
#  홈 → "카메라로 따라가며 풀기" → deviceselect → Manual Input(또는 Scan)
#  → 큐브 섞은 뒤 "이 상태로 풀기 →" → tracked-solve 도착
#  → 카메라 권한 허용 → 비디오 미리보기 + 하단 "centers: N / 6 · confidence: X" 라인
#  → (Phase 1 검증) 큐브를 카메라에 비추면 각 면 중심에 색 원이 그려져야 함
```

---

## 9. 휴식 직전 메모 (2026-05-26)

- HANDOVER_v9 작성 완료. Phase 0 commit + Phase 1 미커밋 코드 상태.
- 휴식 후 재개 순서: 위 §7 "Phase 1 재개 시 즉시" 1번부터.
- 풀 컨텍스트는 대화 종료 시 압축되니, 다음 세션에선 이 파일과 CLAUDE.md 만 읽어도 진입 가능.
