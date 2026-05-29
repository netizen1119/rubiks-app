# HANDOVER v12

작성일: **2026-05-27 (휴식 직전)**
대상 브랜치: `main` (private repo `netizen1119/rubiks-app-private`)
범위: **Phase 2a — 9-grid 인식** 진입. 코드 완성, **ROI 검출 알고리즘 검증 미완 (대기)**.
이전: `HANDOVER_v11.md` (Phase 1 + C-1 commit `76a4510`).

---

## 1. 한눈에 보기

Phase 2a 목표: ROI bbox 를 3×3 cell 로 분할 → 각 cell 평균 RGB → ScanColor →
**정중앙 cell = 면 중심 anchor**. v11 의 "색 connected-component 만으론 섞인
큐브의 중심 sticker 보장 불가" 한계를 위치 기반 분할로 우회.

진행:
- ✅ `lib/vision/grid-sampler.ts` — `sampleFaceGrid(frame, roi)` 신규.
- ✅ `tracked-solve.tsx` — 9-grid 시각화 + 정중앙 cell EMA 학습 + 면 라벨 노출.
- ✅ ROI staleness gate — 1초간 worker 가 ROI 못 찾으면 stale → null.
- 🟡 **ROI 알고리즘 두 차례 시도, 둘 다 실패**. 세 번째 시도(edge density 기반) 검증 대기.

검증 상태 (사용자 dev 서버 기준):
- Worker hang 없음, `cv: ready` 안정.
- 9-grid 시각화 코드는 정상 동작 (cell 점선 + 색 원 + 정중앙 면 라벨 + 하단 `face: D` 등).
- **ROI 자체가 큐브를 못 잡음** — 다양한 시도 후에도 큐브 대신 책상/벽/배경을 잡음.

---

## 2. v11 이후 한 작업 (시간 순)

### 2-1. `lib/vision/grid-sampler.ts` 신규
- `sampleFaceGrid(frame: ImageData, roi: CubeROI): FaceGrid | null`
- ROI 를 3×3 cell 로 분할, 각 cell 안 60%×60% 영역만 평균 RGB → classifyColor.
  (스티커 사이 검은 grid line 회피 위해 60% 안쪽만 sampling.)
- 반환: `cells: (ScanColor|"X")[9]`, `rgb: {r,g,b}[9]`, `centerPx: {x,y}[9]`, `cellW/cellH`.
- row-major (idx 0=좌상, 4=중앙, 8=우하).

### 2-2. `tracked-solve.tsx` 통합
- `SCAN_TO_FACE_LOCAL: Record<ScanColor, ICubeSide>` — 정중앙 cell ScanColor → 면 라벨.
- `SCAN_FILL` — ScanColor → CSS 색 (시각화 원).
- `drawFaceGrid()` — ROI 안에 3×3 cell 점선 + 각 cell 중앙에 추정 색 원.
  정중앙 cell 은 1.6× 크기 + 면 라벨(U/R/F/D/L/B) 텍스트.
- tick 루프에서 `lastROIRef` 가 있으면 `sampleFaceGrid` → `lastGridRef` → 시각화.
- 자기 캘리브를 9-grid 정중앙 cell RGB 평균 기반으로 전환 (기존 connected-component
  centroid 는 ROI 없을 때 fallback).
- 하단 상태 라인에 `face: U` 식으로 현재 면 노출 (`currentFace` state).

### 2-3. ROI 검출 알고리즘 — 세 차례 시도

**시도 1: findContours + morphological CLOSE 5×5 + RETR_EXTERNAL + approxPolyDP + area/aspect/vertex 필터** (v11 commit 의 마지막 상태)
- 결과: **ROI 가 화면 거의 전체로 부풀어 오름**. closing 5×5 가 큐브와 손/책상/벽
  사이 갭까지 메워 거대한 false closed contour 생성. 그 contour 의 contourArea 는
  작아도 bbox 는 frame 전체 (얇은 follower).

**시도 2: closing 3×3 + bbox max area + solidity ≥ 0.65 + 임계 강화**
- 결과: **ROI 가 아예 안 잡힘**. 큐브 외곽선 자체가 손/배경과 만나는 부분에서
  Canny edge 가 끊겨 closed contour 안 됨. 강화된 게이트로 false contour 들 떨어졌지만
  정작 큐브 contour 도 존재하지 않아 ROI = null.

**시도 3 (현재, 검증 대기): edge density 기반 ROI**
- findContours 완전 폐기.
- frame 을 16×16 cell grid 로 분할.
- 각 cell 의 edge 픽셀 비율 ≥ 12% → "dense".
- dense cell 들의 4-connectivity 군집 → 가장 큰 군집의 bbox = ROI.
- 큐브의 본질적 시그니처를 *내부 grid line 자체* 로 사용 (외곽 닫힘 무관).
- 책상/벽/손 가장자리는 단일 line → cell 비율 낮음 → 자동 제외.

상수 (모두 `public/cv-worker.js`):
- `DENSITY_CELL = 16` (px) — 한 sticker 절반 정도, 큐브 grid 가 cell 마다 1+ 줄 통과
- `DENSITY_THRESHOLD = 0.12` — cell 안 edge 픽셀 비율
- `ROI_MIN_DENSE_CELLS = 9` — 너무 작은 군집은 노이즈로 무시

### 2-4. ROI staleness gate
- `lastROIUpdatedAtRef` timestamp ref 추가.
- worker 가 `roi != null` 회신할 때만 갱신.
- tick 안에서 `(performance.now() - lastROIUpdatedAtRef) > ROI_STALE_MS (1000)` 면
  `roi = null` 로 사용 → connected-component fallback.
- 큐브 frame 밖으로 빠진 후 옛 ROI 가 sticky 로 남는 문제 해소.

---

## 3. 현재 미커밋 변경

```
M  CLAUDE.md
M  components/main-page/stages/tracked-solve/tracked-solve.tsx
M  public/cv-worker.js
?? HANDOVER_v12.md
?? lib/vision/grid-sampler.ts
```

`tsc --noEmit` PASS · `npm test` 38/38 PASS · `lint` 신규 워닝 없음.

---

## 4. 다음 세션 재개 (체크리스트)

### 4-1. 즉시
1. `git status` 로 미커밋 상태 확인.
2. dev 서버 띄우고 (`npm run dev`) tracked-solve 진입 → 브라우저 강력 새로고침.
3. **edge density ROI 가 큐브를 타이트하게 잡는지 확인**.
   - 잘 잡힘 → 9-grid 정렬 자연 정상화 → **Phase 2a commit** + Phase 2b 진입.
   - 안 잡힘 → §4-2 튜닝.

### 4-2. ROI 가 안 잡히면 튜닝 순서
1. `DENSITY_THRESHOLD` 0.12 → 0.08 (cell 의 edge 비율 임계 낮춤).
2. `DENSITY_CELL` 16 → 12 또는 20 (cell 크기 조정).
3. `ROI_MIN_DENSE_CELLS` 9 → 4 (작은 큐브도 통과).
4. 디버그 시각화 추가: dense cell 그리드를 반투명 빨강으로 overlay → 어떤 영역이
   dense 로 잡히는지 눈으로 확인. 이게 가장 빠른 디버그 경로.

### 4-3. ROI 가 잡히지만 큐브 외 영역에 잡히면
- 큐브 *외* 어디가 dense 로 잡히는지 디버그 시각화로 확인.
- 책장 같은 grid 구조가 있으면 그쪽으로 끌릴 수 있음 — aspect ratio 게이트 추가 (정사각형 우선).
- 또는 *9-grid 안쪽의 자체 grid 패턴 점수* — bbox 안을 다시 3×3 으로 나눠 각 sub-cell
  의 edge 밀도가 균질한지 확인 (큐브는 균질, 책장은 불균질).

### 4-4. Phase 2a 완료 후
- Phase 2b 진입: 9-tuple 색 배열을 시간순으로 추적 → idle/moving/settled state machine →
  18 무브 가설 검색. HANDOVER_v11 §3-3 의 면 무브 감지 설계.
- `lib/vision/move-detector.ts` 의 stub 자리에 본 구현.

---

## 5. 알려진 한계 / 메모

- **9-grid 가 bbox 정렬 가정**: 큐브가 화면에 정면 가까울 때 OK, perspective 로
  trapezoid/hexagon 면 cell 위치 어긋남. 다음 iteration 에서 ROI 4-vertex +
  `cv.warpPerspective` 로 정사각형 grid 펴는 방안.
- **현재 fallback (connected-component)** 은 ROI 못 잡힐 때만 보임 (1초 stale 후).
  PoC 단계라 양쪽 다 살아있는 게 디버그 도움 — 이후 9-grid 안정되면 fallback 제거 고려.
- worker 정적 파일은 HMR 안 됨 — 변경 후 항상 브라우저 강력 새로고침 (Ctrl+Shift+R).

---

## 6. 커밋 (v11 이후)

| 해시 | 메시지 | 상태 |
|---|---|---|
| `76a4510` | feat: OpenCV.js Worker 이전 + 큐브 ROI 검출 (Phase 1 + C-1) | 커밋됨, **push 대기** |
| `b98a73a` | scaffold: add tracked-solve mode (Phase 0) | 커밋됨, push 대기 |
| _(미커밋)_ | Phase 2a: 9-grid 인식 + edge density ROI | 검증·휴식 후 commit |

---

## 7. 휴식 직전 메모 (2026-05-27)

- 다음 세션 진입 시: CLAUDE.md 최신 → 본 HANDOVER_v12 의 §4-1 1번부터.
- dev 서버는 띄워둬도 되고 꺼도 됨 (재진입 시 `npm run dev` 1773ms 부팅).
- ROI 검증은 *시각적 확인이 가장 빠름* — 임계 튜닝 전에 디버그 시각화 (dense cell
  overlay) 부터 도입 권장.
- Phase 2a 커밋 메시지 초안: `feat: 9-grid 인식 + edge density ROI (Phase 2a)`.
