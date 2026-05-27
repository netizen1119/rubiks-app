# HANDOVER v10

작성일: **2026-05-26 (휴식 직전)**
대상 브랜치: `main` (private repo `netizen1119/rubiks-app-private`)
범위: **카메라 트래킹 풀이 모드 Phase 1 본격 PoC + OpenCV.js 도입 시도/막힘**.
이전: `HANDOVER_v9.md` (Phase 0 스캐폴딩 + Phase 1 미커밋 초안).

---

## 1. 한눈에 보기

Phase 1(pose lock)을 색 분류 기반으로 자체 구현했으나 조명/배경 노이즈 한계가
명확해 OpenCV.js 도입을 시도. main-thread Canny + putImageData 가 노트북에서
브라우저를 hang 시키는 문제로 **Worker 이전 필요** 결론. 현재 OpenCV 경로는
`ENABLE_OPENCV_DEBUG=false` 로 비활성, 색 기반 코드(connected-component + 4초
학습 phase)는 그대로 동작 가능 상태.

진행 상태:
- **Phase 0 (스캐폴딩)** — 커밋 `b98a73a`, push 대기
- **Phase 1 (PoC: pose lock)** — 코드 완성, 미커밋. 정확도는 색 기반의 본질적 한계까지 도달.
- **OpenCV.js Step A+B (로더 + Canny 디버그)** — 코드 작성·feature flag off. **검증 실패 (브라우저 hang)**
- **Phase 2~4 / OpenCV Step C-E** — 미착수

---

## 2. v9 이후 한 작업 (시간 순)

### 2-1. Phase 1 색 기반 PoC 완성
| 변경 | 효과 |
|---|---|
| `pose-lock.ts` — connected-component (4-conn flood fill) | 색별 가장 큰 blob 만 채택 → centroid 가 배경+큐브 평균에 떠다니던 문제 해결 |
| `pose-lock.ts` — centroid 평균 RGB 도 함께 반환 | 호출자가 EMA 캘리브에 다시 먹일 수 있음 |
| `pose-lock.ts` — `FACE_TO_SCAN` export | 면→ScanColor 역매핑 |
| `tracked-solve.tsx` — 자기 EMA 캘리브 (`calibrateFromCenter` 매 프레임) | scan 의 `use-get-scanned-colors.ts:87` 패턴 — `classify→같은 라벨`일 때만 학습 |
| `tracked-solve.tsx` — 4초 학습 phase + 카운트다운 UI | 진입 시 사용자가 큐브 회전시켜 6면 보여주는 동안 reference 자동 산출. 학습 게이트는 1+, 트래킹은 4+ blob |
| `messages/ko.json` `messages/en.json` — `calibrating`, `calibCountdown`, `loadingCV`, `cvLoadFailed` | i18n 키 추가 |

### 2-2. 색 기반의 본질적 한계 (사용자 검증)
- 라벨이 큐브 면 위에 정확히 안 붙음.
- 조명 변화에 분류가 흔들림.
- 배경 색이 큐브 색과 비슷하면 끊임없이 오인식.
- 큐브 한 면의 중심 자체도 잡히지 않는 경우 발생.

→ **색이 아니라 공간/구조 정보로 큐브를 먼저 찾는** 방향으로 전환 결정.

### 2-3. OpenCV.js 도입 시도 (Step A + Step B)
- `lib/vision/opencv-loader.ts` 신규 — CDN(`https://docs.opencv.org/4.10.0/opencv.js`)
  동적 script + `cv.onRuntimeInitialized` 핸들. 멀티콜 safe (한 번만 로드, 이후 캐시).
- `tracked-solve.tsx` — Canny edge 계산 (cvtColor→GaussianBlur→Canny 50/150) +
  overlay 에 반투명 cyan 시각화. Mat 메모리는 매 프레임 alloc/delete (try/finally).
- 부담 완화 시도:
  - 처리 해상도 `1280×720 → 480×270` (PROC_W/PROC_H 상수)
  - 처리 throttle `66ms` (≈15fps) 도입 (RAF 는 매 frame, 무거운 처리만 간격)
- **결과**: 사용자 환경(ThinkPad X390, Fedora 44, Chromium)에서도 **브라우저 hang**.
  main-thread Canny + 픽셀 단위 putImageData 가 노트북 CPU 에 무리.

### 2-4. 정리 (휴식 직전)
`ENABLE_OPENCV_DEBUG` feature flag 추가, 기본 `false`. flag off 시:
- `loadOpenCV()` 호출 안 함
- frame loop 에서 Canny 호출 skip
- UI 로딩 메시지 안 표시

코드/타입/테스트는 정상. 색 기반 PoC 만 동작.

---

## 3. 현재 미커밋 변경

```
M CLAUDE.md
M components/main-page/stages/tracked-solve/tracked-solve.tsx
M lib/store/store.ts
M lib/vision/pose-lock.ts
M messages/en.json
M messages/ko.json
?? HANDOVER_v9.md
?? HANDOVER_v10.md
?? lib/vision/opencv-loader.ts
```

`tsc --noEmit` PASS · `npm test` 38/38 PASS.

---

## 4. 다음 세션 재개 옵션

### A. OpenCV 를 Web Worker + OffscreenCanvas 로 이전 (가장 본질적)
- `lib/vision/cv-worker.ts` 신규 — worker 안에서 `loadOpenCV` 호출.
- main 은 OffscreenCanvas.transferToImageBitmap 으로 frame 만 worker 로 송신.
- 결과(edges 마스크 / contour 좌표) 만 receive.
- main-thread hang 원인 자체가 사라짐.
- **공수 중간**: Worker 메시지 프로토콜 + Mat 메모리 관리 + 결과 직렬화.

### B. OpenCV 자체를 포기, 더 가벼운 자체 구현
- Sobel(or Scharr) edge 마스크를 자체 typed-array 구현 → edge density 가 높은 ROI 만 sampling.
- 직접 4-connectivity flood fill 로 큐브 후보 영역 검출.
- 의존성 0, 가벼움. 정확도는 OpenCV 보다 낮을 가능성.

### C. 색 기반 PoC 만으로 Phase 2 (무브 감지) 진입
- 검출 정확도는 한계 인정.
- 18 무브 후보 검색에서 노이즈에 강한 점수 함수로 보완 시도.
- 큐브 영역 검출 없이 진행 → false positive 위험.

추천 순서: **A → C 병행** (Worker 이전이 시간 걸리면, 그 동안 색 기반으로 Phase 2 prototype).

### D. UX 우회 (마지막 카드)
- 사용자가 화면 가이드 박스에 큐브를 맞추고 클릭 → 그 영역만 sampling.
- 자동성 손실, 단순화 큼.

---

## 5. 재개 시 즉시 (체크리스트)

1. `git status` 로 미커밋 상태 확인.
2. 재개 결정:
   - 옵션 A 가면 `lib/vision/cv-worker.ts` 신규 + tracked-solve 에서 worker 통신.
   - 옵션 B 가면 `lib/vision/edge-mask.ts` 신규.
   - 옵션 C 가면 `lib/vision/move-detector.ts` 실구현 진입.
3. 색 기반 PoC 검증을 한 번 더 하고 Phase 1 commit 결정 (검증 후 `b98a73a` 위에 한 commit).

---

## 6. 알려진 한계 / 기록

- **OpenCV main-thread**: ThinkPad X390 에서 720p Canny hang 확인. 480×270 + 15fps throttle 도 부족. Worker 이전 필요.
- **색 기반 정확도**: 학습 phase + connected-component + EMA 까지 다 해도 조명/배경에 취약. **색 자체로는 한계**.
- **B(뒷면) 무브**: 단독으로 안 보이는 위치에선 검출 불가 (v9 §2-2 기록). UX 안내로 우회 예정.
- **scan 캘리브 prime**: 미구현. manual-input 경로에선 영구 default hue 시작 (학습 phase 도입 후엔 4초 안에 EMA 수렴 시도 — 효과 제한).

---

## 7. 커밋 (v9 이후)

| 해시 | 메시지 | 상태 |
|---|---|---|
| `b98a73a` | scaffold: add tracked-solve mode (Phase 0) | 커밋, push 대기 |
| _(미커밋)_ | Phase 1 (connected-component + 학습 phase + OpenCV Step A+B feature flag) | 검증·휴식 후 commit |

---

## 8. 휴식 직전 메모 (2026-05-26)

- 다음 세션 진입 시: CLAUDE.md 최신 → 본 HANDOVER_v10 의 §4-5 순서대로.
- ENABLE_OPENCV_DEBUG 는 false 로 두고 OpenCV 검증 재개 시 toggle.
- 색 기반 PoC 는 정상 동작 — 다음 세션 시작할 때 dev 서버 띄우면 색 라벨 오버레이까지 즉시 확인 가능.
