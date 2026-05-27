# HANDOVER v11

작성일: **2026-05-27**
대상 브랜치: `main` (private repo `netizen1119/rubiks-app-private`)
범위: **OpenCV.js Worker 이전 (옵션 A) + 큐브 ROI 검출 (옵션 C-1)** 완료.
이전: `HANDOVER_v10.md` (Phase 1 색 기반 PoC + main-thread Canny hang 으로 OpenCV 비활성).

---

## 1. 한눈에 보기

v10 §4 의 두 트랙을 차례로 진행:
- **A** — OpenCV.js 를 Web Worker 로 이전. main-thread hang 사라짐, `cv: ready` 안정 도달.
- **C-1** — Canny edges 위에 morphological CLOSE + `findContours(RETR_EXTERNAL)` +
  approxPolyDP 다각형 필터 → 큐브 후보 ROI 산출. main 의 색 분류(`pose-lock`)는
  이 ROI 안만 sampling.

결과:
- ✅ ROI 박스(노란 점선)가 큐브를 안정적으로 둘러쌈 (스크린샷 검증).
- ✅ 메인 스레드 응답성 정상 — RAF 부드러움, "뒤로" 즉시 클릭됨.
- ✅ Canny edges 가 큐브 격자/외곽에 정확히 그려짐.
- ⚠️ ROI 가 큐브 + 손 일부까지 포함하는 경우 있음 (closing kernel 부작용) → ROI 안
  손 살색이 여전히 오렌지로 분류돼 "B" 라벨 false positive.
- ⚠️ 섞인 큐브의 *중심 sticker* 검출은 색 connected-component 만으로는 본질적 한계.
  같은 색이 면 위에 흩어져 있어 한 stricker 만 잡힘. **다음 트랙: 9-grid 패턴 인식**.

진행 상태:
- **Phase 0 (스캐폴딩)** — `b98a73a` 커밋, push 대기
- **Phase 1 (PoC: pose lock + OpenCV Worker + ROI)** — 이 HANDOVER 커밋에 포함
- **Phase 2 (9-grid 인식 → 면 무브 감지)** — 다음 트랙 (자연스러운 진화)

---

## 2. v10 이후 한 작업 (시간 순)

### 2-1. OpenCV Worker 이전 (옵션 A)
| 변경 | 효과 |
|---|---|
| `public/cv-worker.js` 신규 | OpenCV.js Worker. `importScripts(CDN)` → Canny edges + ROI 산출, 결과를 `Uint8Array.buffer` transferable 로 회신. Next.js 14 turbo 의 worker 번들 한계 회피 위해 plain JS + public 호스팅 |
| `lib/vision/cv-worker-client.ts` 신규 | main-thread wrapper. 싱글톤 + `ready` Promise + `computeEdges` (back-pressure: in-flight 시 frame drop) + `terminate` |
| `tracked-solve.tsx` | 기존 `loadOpenCV`/`computeCannyEdges` 제거, Worker client 사용. 비동기 결과를 `lastEdgesRef` 에 저장, RAF 마다 그 최신본 재그림. onExit 시 worker terminate. `ENABLE_OPENCV_DEBUG=true` 로 재활성. `willReadFrequently: true` 로 getContext 경고 해소 |
| `lib/vision/opencv-loader.ts` 삭제 | Worker 경유로 통일됨. main-thread 직접 로드 경로 사용처 없음 |

**Next.js turbo gotcha** — 처음 `new Worker(new URL("./cv-worker.ts", import.meta.url))`
패턴으로 시도했더니 turbo 가 worker 를 정적 asset(MIME=`video/mp2t`)으로 emit 해서
브라우저가 실행 거부. 우회: `public/cv-worker.js` 에 plain JS 호스팅 → `new Worker("/cv-worker.js")`.
같은 origin → importScripts CORS 안전. 정확한 MIME(text/javascript).

### 2-2. ROI 검출 (옵션 C-1)
| 변경 | 효과 |
|---|---|
| `cv-worker.js` `detectCubeROI` 추가 | Canny edges → morphological CLOSE(5×5) → `findContours(RETR_EXTERNAL)` → 각 contour 에 approxPolyDP + area/aspect/vertex 필터 → 가장 큰 사각형 후보의 bbox |
| `lib/vision/pose-lock.ts` | `detectCubePose(frame, roi?)` — ROI 가 있으면 grid sampling 좌표 범위를 그 안으로 제한. ROI 없으면 전체 frame fallback |
| `cv-worker-client.ts` `EdgesResult` | `roi` 필드 추가 (`{x,y,w,h} | null`) |
| `tracked-solve.tsx` `lastROIRef` | 워커 결과의 ROI 를 sticky 로 보관 (`if (result.roi) lastROIRef.current = result.roi`). detectCubePose 호출 시 전달. overlay 에 노란 점선 사각형으로 시각화 |

**Tuning 한 임계값들** (모두 `cv-worker.js` 상수):
- `ROI_MIN_AREA` = 480×270×0.04 ≈ 5,200px
- `ROI_MAX_AREA` = 480×270×0.7
- `ROI_ASPECT_MIN` = 0.6, `ROI_ASPECT_MAX` = 1.7
- `APPROX_EPSILON_RATIO` = 0.04 (perimeter * ratio = approxPolyDP epsilon)
- vertex 허용 4~10 (1면=quadrilateral, 3면 perspective=hexagon, 노이즈 ±1~2점)
- `MORPH_CLOSE` kernel 5×5 (점선 같은 1~3px Canny 갭 메우기)

### 2-3. 검증 (사용자 dev 검증)
| 항목 | 결과 |
|---|---|
| Worker 로드 (importScripts CDN) | OK — `cv: ready` 도달 |
| 메인 스레드 응답성 | OK — RAF / 입력 부드러움 |
| Canny edges 시각화 (cyan) | OK — 큐브 격자/외곽 정확 |
| ROI 박스(노란 점선) 시각화 | OK — 큐브를 안정적으로 둘러쌈 (closing 으로 살짝 큰 경우 있음) |
| ROI 안 손가락 → "B" false positive | 알려진 한계 — 다음 트랙에서 해결 예정 |
| `tsc --noEmit` | PASS |
| `npm test` | 38/38 PASS |
| `npm run lint` | 0 error / 13 warning (기존 동일, 신규 워닝 없음) |

---

## 3. 알려진 한계 / 다음 트랙

### 3-1. ROI 가 큐브보다 살짝 큼
morphological CLOSE 가 큐브 외곽과 손/배경 사이 작은 갭까지 메워서 closed contour 가
손 일부까지 흡수. ROI 안 손 살색 픽셀이 `classifyColor` 에서 오렌지로 잡혀 "B" false
positive 가 ROI 내부에서도 발생.

**튜닝 옵션** (다음 세션이 원하면):
- `MORPH_CLOSE` kernel 5×5 → 3×3 (갭 메우는 정도 약하게)
- `APPROX_EPSILON_RATIO` 0.04 → 0.02 (더 정밀한 다각형 근사 → 큐브 모서리만 채택)
- 색 분류기에 saturation gate (살색의 저채도 → "X") — 빠른 윈, 본질 한계는 그대로

### 3-2. 색 connected-component 로는 중심 sticker 불가
**알고리즘 본질적 한계** — 큐브 중심 anchor 를 색 분류만으로 잡으려면 면 위에 같은 색
sticker 가 1개여야 함. 섞인 큐브에선 같은 색이 면 위에 흩어져 있어 connected-component
의 가장 큰 blob 이 항상 *중심 sticker* 라는 보장 X.

**해결**: ROI 안에서 **9-grid 패턴 인식** → 면을 3×3 cell 로 분할 → 정중앙 cell 의
평균 색 = 중심 anchor. 이게 Phase 2 의 자연스러운 진화이자 본질적 트랙.

### 3-3. Phase 2 (9-grid 인식 → 면 무브 감지) 설계 스케치

ROI bbox 가 잡힌 면을 3×3 grid 로 분할:
```
roiBbox → 9 cells (각 cell = roi.w/3 × roi.h/3 영역)
각 cell 중심 N×N 픽셀 평균 RGB → classifyColor → ScanColor
정중앙 cell (idx 4) = face center anchor
```

근데 큐브가 perspective 로 trapezoid 면 grid 도 perspective 분할 필요. 첫 시도는
bbox 만으로 (정면) → 정확도 부족하면 4-vertex 사각형 후 perspective transform 으로
정사각형 grid 로 펴기 (`cv.warpPerspective` + `getPerspectiveTransform`).

면 무브 감지(Phase 2 본 목표) 는 9-grid 색 배열을 frame 간 비교:
- idle: 9-color tuple 안정
- moving: tuple 변화 (정확히 한 띠가 회전 = 18 가설 중 하나)
- settled: 새 tuple 안정 → m 후보 commit

---

## 4. 현재 미커밋 변경 (이 commit 에 포함될 것)

```
M CLAUDE.md
M components/main-page/stages/tracked-solve/tracked-solve.tsx
M lib/store/store.ts
M lib/vision/pose-lock.ts
M messages/en.json
M messages/ko.json
D lib/vision/opencv-loader.ts
?? HANDOVER_v9.md
?? HANDOVER_v10.md
?? HANDOVER_v11.md
?? lib/vision/cv-worker-client.ts
?? public/cv-worker.js
```

---

## 5. 재현 / 검증

```bash
git checkout main
git pull
npx tsc --noEmit
npm test
npm run dev   # http://localhost:3000
#  홈 → "카메라로 따라가며 풀기" → deviceselect → Manual Input
#  → "이 상태로 풀기 →" → tracked-solve 도착
#  → 카메라 권한 허용 → 우상단 "Loading OpenCV..." 잠시
#  → cv: ready, cyan edges + 노란 점선 ROI 박스
```

---

## 6. 커밋 (v10 이후)

| 해시 | 메시지 | 상태 |
|---|---|---|
| `b98a73a` | scaffold: add tracked-solve mode (Phase 0) | 커밋됨, push 대기 |
| _(이 HANDOVER 의 commit)_ | Phase 1 + C-1: OpenCV Worker 이전 + 큐브 ROI 검출 | 작성 중 |

---

## 7. 다음 세션 재개 (체크리스트)

1. `git status` 클린 상태 확인.
2. 다음 트랙 — **Phase 2 (9-grid 인식)**:
   - `cv-worker.js` 에 ROI bbox 의 4-vertex(또는 perspective transform 결과) 회신 옵션 추가
   - `lib/vision/grid-sampler.ts` 신규 — ROI → 9-cell 분할 → 각 cell 평균 색 → 면 raw state
   - `pose-lock.ts` 또는 새 `face-detector.ts` 가 9-cell 결과를 받아 중심 anchor / 면 회전 추정
3. 위 §3-1 ROI tuning 은 9-grid 인식 후 정확도 보면서 필요 시 손봄.
4. Phase 2 끝나면 `move-detector.ts` 실구현 (현재 stub).

---

## 8. 메모

- `public/cv-worker.js` 는 plain JS 라 type 체크 안 됨. 작은 파일이라 JSDoc 안 붙임.
  향후 grid sampler 까지 worker 안에서 돌리면 별도 d.ts 또는 worker-side tsconfig 도입 고려.
- OpenCV.js CDN(`docs.opencv.org/4.10.0/opencv.js`) ~7MB. 첫 로드만 느림, 이후 캐시.
  CDN 다운 시 fallback 없음 — 향후 `public/` 에 self-host 옵션 고려.
- Worker terminate 는 onExit 에서. 다시 진입 시 새 Worker (캐시된 WASM 으로 빠름).
