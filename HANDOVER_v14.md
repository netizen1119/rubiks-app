# HANDOVER v14

작성일: **2026-05-29**
대상 브랜치: `main` (private repo `netizen1119/rubiks-app-private`)
범위: **Phase 2a 완료** — ROI 검출을 contour+9-neighbor 로 재작성, 브라우저 6면 검증 통과.
이전: `HANDOVER_v13.md` (edge-density 폐기 + contour 정답 파이프라인 리서치 결론).

---

## 1. 한눈에 보기

v13 의 리서치 결론(edge-density grid 구조적 오류 → contour+9-neighbor 정답)을 그대로 구현.
**한 번에 동작.** edge-density 3차 시도 전부 실패하던 ROI 검출이 contour 전환으로 해결됨.

브라우저 검증 (사용자 dev 서버):
- 6면(U/R/F/D/L/B) 전부 ROI bbox 타이트하게 잡힘.
- 9 sticker 원이 각 칸에 정확히 정렬. 정중앙 면 라벨 안정적.
- 빨강 candidate 사각형이 큐브 9칸에 격자로 모이고, 손/배경 false 사각형은 9-neighbor 로 탈락.
- 색 분류 거의 정확 (캘리브 수렴 후 6면 OK). 흰칸 루빅스 로고는 trimmed-mean 으로 보정.

---

## 2. 이 세션에 한 작업

### 2-1. `public/cv-worker.js` — `detectCubeROI`(edge-density) 전면 폐기 → `detectCubeFace`
검증된 파이프라인 (qbr/dwalton76/kociemba):
1. 전처리: `cvtColor → GaussianBlur(3,3) → Canny(30,60) → dilate(MORPH_RECT 7×7)`.
   **dilate 가 핵심** — 끊긴 스티커 검은 테두리를 닫아 findContours 가 사각형(스티커 구멍)을 잡게 함.
2. `findContours(RETR_TREE, CHAIN_APPROX_SIMPLE)` → per-contour:
   `approxPolyDP(0.1·peri)` 4-vertex && `isContourConvex` && aspect[0.75,1.35] && fill≥0.4 && area≥50.
3. **median 상대 크기 게이트**: 전체 candidate side 의 median 0.5×~2× 만 유지 (절대 px 금지, 거리 적응).
4. **9-neighbor anchor**: 각 사각형의 이웃(거리 ≤ 1.8×side) 수 카운트 → 최다(면 중심=8 이웃)가 anchor.
   `bestCount < FACE_MIN_NEIGHBORS(4)` 면 면 아님 → null (고립된 손/배경 사각형 자동 탈락).
5. face set = anchor + 반경 내 이웃. spacing = set 내 최근접 이웃 거리의 median (sticker pitch).
6. anchor 중심 기준 3×3 lattice → **9 sticker 좌표 row-major** (0=좌상, 4=중앙, 8=우하).
7. 회신: `{ edges(raw Canny), roi(lattice bbox), stickers[9], side, quads(디버그 candidate) }`.
   Mat 메모리 전부 `.delete()` (contours/hierarchy/approx/cnt/kernel).

상수 (전부 `cv-worker.js` 상단, 480×270 처리해상도 기준):
- `DILATE_KERNEL=7`, Canny `30,60`, `APPROX_EPS_RATIO=0.1`
- `QUAD_ASPECT_MIN/MAX=0.75/1.35`, `QUAD_FILL_MIN=0.4`, `QUAD_MIN_AREA=50`
- `SIZE_MED_MIN/MAX=0.5/2.0`, `NEIGHBOR_DIST_RATIO=1.8`, `FACE_MIN_NEIGHBORS=4`
- `DEBUG_QUADS=true` (튜닝 끝나면 false → quads overlay 끔)

### 2-2. `lib/vision/cv-worker-client.ts`
- `EdgesResult` 정리: `dense/gw/gh/cell` 제거 → `stickers: Pt[]|null`, `side: number`, `quads: Pt[][]|null`.
- `Pt = {x,y}` export 추가. 메시지 핸들러 갱신.

### 2-3. `lib/vision/grid-sampler.ts` — sticker 좌표 기반 재작성
- `sampleFaceGrid(frame, roi)`(ROI bbox 3×3 균등분할 추정) **폐기**.
- `sampleFaceGridFromStickers(frame, stickers, side)`: worker 의 9 sticker 중심 직접 입력,
  각 중심 둘레 `side×0.6` 정사각 평균 RGB → `classifyColor`. bbox 균등분할 가정 제거.
- **trimmed-mean**: `max(r,g,b) < DARK_CUTOFF(55)` 픽셀 제외 — 흰칸 루빅스 로고(검은 인쇄),
  grid line, 그림자 outlier 차단. 큐브 6색은 전부 한 채널 밝아 통과. 밝은 픽셀 0 이면 전체 평균 fallback.

### 2-4. `components/.../tracked-solve.tsx`
- refs: `lastDenseRef` 제거 → `lastStickersRef{stickers,side}` + `lastStickersUpdatedAtRef` + `lastQuadsRef`.
- 시각화: `drawDenseCells`(빨강 cell) → `drawQuads`(빨강 사각형 외곽). `drawFaceGrid(roi,grid)` →
  `drawStickerGrid(grid)` (9 중심 연결선 + 색 원 + 정중앙 면 라벨).
- tick loop: stickers primary path 로 sampling. `ROI_STALE_MS` 게이트를 stickers 에도 적용.
  stale 시 connected-component fallback (pose-lock).
- 상태 라인: `centers: N/6` (pose) → 검출 시 `grid: N/9` (분류된 칸 수), fallback 시 `centers: N/6`.
  `gridState` state 추가 (변화 없으면 prev 반환해 re-render 억제).
- `onExit` 새 ref 정리 추가.

---

## 3. 현재 미커밋 → 이 커밋에 포함

```
M  CLAUDE.md                  (상태 Phase 2a 완료 + 비전 파이프라인 섹션 갱신)
M  cv-worker.js               (contour+9-neighbor 재작성)
M  cv-worker-client.ts        (EdgesResult 정리)
M  tracked-solve.tsx          (stickers 통합 + 시각화 교체 + 상태줄)
?? grid-sampler.ts            (sticker 좌표 기반 + trimmed-mean)
?? HANDOVER_v12/13/14.md
```
`tsc --noEmit` PASS · `npm test` 38/38 PASS · worker `node --check` PASS.

---

## 4. 다음 세션 재개 — Phase 2b (확정안, 2026-05-29 브리핑)

### 결정적 통찰: blind 복원 아님, **forward-model 매칭**
tracked-solve 진입 시 **풀 큐브 상태 S 를 이미 안다** (scan/manual-input → `store.cube` 54자).
카메라는 한 면만 본다. 무브 감지 = 18 후보를 S 에 적용해 보이는 면 예측 → 관측과 비교 → 최선 일치.

이미 있는 무기 (확인됨):
- `store.cube` — 54자 현재 상태 S (tracked-solve 에서 읽기 가능).
- `applyMove(S, m)` / `applyMoves` (`lib/solver/lbl-solver.ts`) — **문자열 레벨 forward model**. 순수 함수.
- `store.rotateCube(m)` — 확정 무브를 3D vis + S 에 반영 (애니메이션 포함).
- `grid.cells[9]` (`lastGridRef`) — 관측된 보이는 면 9-tuple.

### 확정 설계 결정 (브리핑)
- **방향 lock = 초기 1회**: 첫 settled 에서 known S 면 9칸 vs 관측 9-tuple 4회전 비교 →
  맞는 orient(0/90/180/270) 확정 후 고정. 사용자가 면 회전 안 바꾼다 가정.
- **감지 대상 = 감지가능 부분집합만 + 안내**: 정면(=보이는 면) 기준 15 무브 —
  면 전체회전 `F/F'/F2`(9칸 in-place 순열) + 인접 layer 한 줄 교체 `U/D/L/R × '/2`(12).
  **안 보임**: `B/B'/B2`(뒷면) + 정면 미접촉 슬라이스 → 미매칭 시 "풀이 면을 카메라로" toast.
  (보이는 면 라벨 따라 15무브 동적 매핑 — 정면이 U/R/… 일 때 회전.)

### 구현 순서
1. **`lib/vision/move-detector.ts`** — stub 시그니처 변경
   (`(prevTuple, currTuple, S, faceLabel, orient) → MoveCandidate|null`):
   - state machine: 9-tuple 해밍 δ 로 idle/moving/settled. settled 진입 시만 가설 검색.
   - 각 m: `applyMove(S, m)` → lock 된 (face, orient) 로 보이는 면 9칸 추출 → 관측 해밍 스코어.
     최고 & 임계(예: 8/9) → 후보. 미매칭(B 등) → null + unmatched 플래그.
2. **방향 lock 헬퍼** (신규 or move-detector 내): 첫 settled orient 확정 후 고정. lock 실패 재시도.
3. **`lib/vision/tracker-bridge.ts`** — `commitDetectedMove` → `store.rotateCube(m)`.
4. **`tracked-solve.tsx`** — `lastGridRef` → prev/curr tuple 버퍼, detector tick, commit, unmatched toast.
5. **단위 테스트 우선**: forward-model 은 순수(`applyMove`) → 카메라 없이 "알려진 무브 → 예측 9칸 →
   detector 가 그 무브 복원" round-trip 으로 로직 90% 검증. Phase 2b 안전판.

### 리스크
- lock 실패(첫 면 색 캘리브 미수렴) → 재시도 필요.
- 해밍 임계 8/9: 색 1칸 오분류 허용. 빡세면 놓침, 느슨하면 오확정.
- 빠른 연속 무브 → moving 못 빠져나옴 (15fps back-pressure). 천천히 권장 안내.

### 잔여 튜닝/한계 (Phase 2b 전 선택)
- `DEBUG_QUADS=true` — 디버그 끝나면 false (빨강 사각형 overlay 끔).
- **front-facing lattice 가정**: 큐브 크게 기울이면 축 정렬 깨짐. 다음 iteration ROI 4-vertex +
  `cv.warpPerspective` 로 정사각 grid 펴기.
- anchor 가 면 중심이 아닌 edge 스티커일 때(부분 가림) lattice 가 한 칸 어긋날 수 있음 — 현 PoC 허용.
- 색 분류는 조명/캘리브 의존 — 첫 진입 4초 학습 후 안정. 로고는 trimmed-mean 으로 보정됨.

---

## 5. 메모

- worker 정적 파일은 HMR 안 됨 — `cv-worker.js` 변경 후 항상 브라우저 강력 새로고침 (Ctrl+Shift+R).
  TS 파일(grid-sampler/tracked-solve/client)은 HMR 됨.
- `76a4510`, `b98a73a` 는 아직 origin push 대기. 이번 커밋까지 묶어 push 가능.
- 검증은 *시각 확인이 가장 빠름* — 디버그 overlay(quads/stickers)가 그대로 살아있음.
