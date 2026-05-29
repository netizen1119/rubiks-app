# HANDOVER v13

작성일: **2026-05-29**
대상 브랜치: `main` (private repo `netizen1119/rubiks-app-private`)
범위: **ROI 검출 방향 전환 — 리서치 결론**. edge-density 접근 폐기 결정.
이전: `HANDOVER_v12.md` (Phase 2a 9-grid, edge-density ROI 3차 시도).

---

## 1. 한눈에 보기

v12 의 edge-density ROI 가 계속 큐브를 못 잡아(또는 배경을 잡아) deep-research 로
실제 출시된 큐브 스캐너들의 검증된 기법을 조사. **결론: edge-density grid 접근 자체가
구조적으로 틀렸다.** 실제 스캐너(qbr, dwalton76/rubiks-cube-tracker, kociemba.org)
아무도 grid density 를 쓰지 않음. 모두 **contour 기반 + 3×3 grid 구조 제약**.

이 세션은 리서치 + 디버그 시각화 추가까지. 구현(재작성)은 다음 세션.

---

## 2. 이 세션에 한 작업

### 2-1. dense cell 디버그 overlay 추가 (미커밋)
- `public/cv-worker.js` — `DEBUG_DENSE` 플래그, `detectCubeROI` 가 dense 배열 반환,
  result 메시지에 `dense/gw/gh/cell` 포함.
- `lib/vision/cv-worker-client.ts` — `EdgesResult` 에 dense 필드 passthrough.
- `tracked-solve.tsx` — `lastDenseRef` + `drawDenseCells()` 반투명 빨강 overlay.
- 추가로 edge-density 알고리즘에 dilation + 8-connectivity + aspect-gate 시도 (cv-worker.js).

### 2-2. 시각 검증 결과 (브라우저)
- 빨강(dense)이 큐브에도 뜨지만 배경(창/의자/모니터)에도 흩어짐.
- 큐브 dense cell 은 grid line 따라 **구멍 뚫린 mesh** → cluster 가 큐브 일부만 잡음.
- ROI(노란 박스)가 큐브 좌상단 1열 등 일부만, 또는 배경을 잡음.
- **edge-density 접근의 근본 한계 확인.**

### 2-3. deep-research (qbr/dwalton76/kociemba 소스 검증)
결론은 메모 `cube-detect-contour-pipeline` + 아래 §3.

---

## 3. 검증된 정답 파이프라인 (다음 세션 구현 대상)

실제 출시 스캐너들이 쓰는 방식 (3-0 confirmed):

1. **dilate + findContours** (edge-density 아님):
   `gray → denoise → Canny → DILATE → findContours(RETR_TREE)`
   - **dilation 이 핵심 트릭** — 스티커 검은 테두리를 닫아 findContours 가 사각형을 잡게 함.
     현 코드에 없던 단계.
   - qbr: blur(3×3) → Canny(30,60) → dilate 9×9 rect kernel → findContours(RETR_TREE)
   - dwalton76: denoise → Canny(5,10) → dilate 4×4 ×4회

2. **quad 필터** (per-contour): `approxPolyDP @ 0.1*perimeter`, 꼭짓점 정확히 4개,
   각 코너 90°±20°, aspect 0.8~1.2, area/(w·h) > 0.4, rotation < 30°.

3. ⭐ **3×3 grid 구조 제약 = 최강 anti-clutter**:
   qbr 은 "이웃 사각형이 정확히 9개인 contour = 중심 스티커" 로 한 면을 확정.
   손/모니터/창의 false 사각형은 *고립* → 9-이웃 못 만듦 → 자동 탈락.
   tracked-solve(면 하나 정면)에 직접 매핑. **fragmentation + 배경 문제 동시 해결.**

4. **크기 게이트는 절대 px 아닌 median 상대**: median square area 의 0.5×~2× 만 통과.
   카메라 거리 자동 적응. (qbr 의 30-60px 하드코딩은 그 해상도 전용 — 복붙 금지, frame 크기에 스케일.)

5. **색 일관성이 식별 base** (Canny 아님): kociemba 는 Canny "not satisfactory" → 색 전환.
   per-cell hue 표준편차 작으면 색 facelet, 흰색 = low sat + high value.
   **패턴: contour 로 후보 찾고, 색으로 분류/anchor.** 기존 4초 EMA 캘리브가 색 reference 에 부합.

### 기각된 것 (verification 에서 killed)
- **YOLO 등 ML 실시간 in-browser**: WASM-CPU ~4-5fps(220ms/frame). 15fps 불가
  (WebGPU + SIMD + multithreading + COOP/COEP 헤더 + 양자화 없이는). **ML 경로 버림.**
- Hough 우월 주장(arXiv) 0-3 기각. HoughLinesP 는 보조 grid-line 체크로만 (noise-prone).

소스: github.com/kkoomen/qbr, github.com/dwalton76/rubiks-cube-tracker,
kociemba.org/computervision.html.

---

## 4. 다음 세션 재개

1. `public/cv-worker.js` 의 edge-density `detectCubeROI` **폐기** → §3 의 contour+9-neighbor 로 재작성.
   - OpenCV.js 에 `findContours` / `approxPolyDP` / `dilate` / `contourArea` 전부 있음.
   - 9-neighbor 가 스티커 9개 좌표를 직접 산출 → `lib/vision/grid-sampler.ts` 의 ROI 3×3 분할
     추정이 불필요해질 수 있음 (스티커 좌표 정확). grid-sampler 통합/대체 여부 결정.
2. 디버그 overlay 는 dense → contour 후보 사각형 + 9-neighbor 매칭 시각화로 교체.
3. 통과하면 Phase 2a commit → Phase 2b (9-tuple 시간순 추적 + 18 무브 가설).

### 미커밋 상태
```
M  CLAUDE.md
M  components/main-page/stages/tracked-solve/tracked-solve.tsx  (dense overlay)
M  public/cv-worker.js  (dense debug + dilation/8conn/aspect — 재작성으로 폐기 예정)
?? HANDOVER_v12.md, HANDOVER_v13.md
?? lib/vision/grid-sampler.ts
```
`tsc --noEmit` PASS · worker `node --check` PASS.

---

## 5. 메모

- 리서치 핵심은 auto-memory `cube-detect-contour-pipeline` 에도 저장 (다음 세션 자동 recall).
- worker 정적 파일 HMR 안 됨 — 변경 후 항상 Ctrl+Shift+R.
- edge-density 코드는 미커밋이므로 재작성 시 그냥 덮어쓰면 됨. 커밋 이력 오염 없음.
