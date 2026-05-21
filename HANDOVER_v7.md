# HANDOVER v7

작성일: **2026-05-21**
대상 브랜치: `main` (private repo `netizen1119/rubiks-app-private`)
범위: 3차 후속 — **UX 폴리시 / 반응형 / 카메라 스캔 복구 / 코드 정리**.
이전: `HANDOVER_v6.md`(3차 — 풀이 수준 선택 learn/fast).

---

## 1. 한눈에 보기

v6(모드 선택 + 도중 전환)에 이어, 화면/입력 경험을 다듬고 멈춰 있던 **카메라 스캔을 복구**했다.
- **라이브 방향 나침반** — 면 라벨이 시점 따라 이동(양 화면)
- **시점 복귀 부드럽게** — 복귀 중 확대→축소 튐 제거(구면 보간)
- **반응형 레이아웃** — 창 크기/비율에 맞춰 큐브 정렬·크기·간격 자동 조절(양 화면)
- **HiDPI 화질 + 조명/광택** — 선명도 + 입체감
- **카메라 스캔 작동 복구** — 영상이 안 뜨던 문제 해결 + 거울 모드 + 뒤로가기
- **코드 정리** — 죽은 코드/디버그 로그/잘못된 import 제거

---

## 2. 커밋 시리즈 (v6 이후)

| 해시 | 메시지 |
|---|---|
| `1b400e6` | add solve mode selection: learn (LBL) vs fast (Thistlethwaite) |
| `7f8ac17` | add mid-solve mode toggle, live orientation compass, camera fixes |
| `a2c2c61` | responsive cube layout, hidpi rendering, and lighting polish |
| `b7f08b8` | apply responsive layout and orientation compass to manual input |
| `6ee86db` | fix camera scan: relaxed constraints, back buttons, mirror preview |
| `0c17936` | cleanup: remove dead code, debug logs, and stray imports |

---

## 3. 작업 항목별 요약

### 3-1. 도중 모드 전환 토글 (`7f8ac17`)
- `lib/store/switch-solve-mode.ts` (신규) + `solve.tsx` 세그먼트 토글.
- 되감기 없이 **현재 진행 위치에서 새 모드로 이어 풀기**(현재 논리 상태 재풀이). 상세는 v6 §5-1.

### 3-2. 라이브 방향 나침반 (`7f8ac17`, `b7f08b8`)
- `components/cube-visualization/orientation-labels.tsx` (공유 컴포넌트, 처음엔 solve 폴더 → 이후 cube-visualization 으로 이동).
- 각 면 중심 월드좌표(U=+y, D=-y, R=+x, L=-x, F=+z, B=-z, 반경 2.35)를 매 프레임 화면 투영 → 라벨이 큐브 면을 따라 이동, 카메라 향한 면은 진하게/뒤면은 흐리게.
- solve + 매뉴얼 입력 양쪽에 표시.

### 3-3. 시점 복귀 구면 보간 (`7f8ac17`)
- `solve.tsx`, `scramble-cube.tsx`: 빈 영역 드래그 후 release 시 카메라 복귀를 **직선 보간 → 구면 보간(방향 nlerp + 반경 lerp)** 으로 변경. 복귀 중 카메라가 큐브로 파고들어 확대됐다 축소되던 현상 제거. 복귀 중 재드래그 시 트윈 즉시 중단(`returnTween.kill()`).

### 3-4. 반응형 레이아웃 (`a2c2c61`, `b7f08b8`)
- `cube-pos-anchor.tsx`: 앵커 위치 측정을 **레이아웃 후(useEffect)+rAF 재측정 + window resize/ResizeObserver** 로 변경 → 창 크기/비율 바뀌어도 큐브 항상 중앙 정렬. (기존엔 마운트 1회 측정 → 어긋남)
- `solve.tsx`, `scramble-cube.tsx`: 고정 `cubeScale:1` → 뷰포트 기반 `min(vw/520, vh/720, 1)`(최소 0.5) + resize 대응. 큐브 영역 컨테이너 크기도 `cubeScale` 비례 → 간격 자동 조절.

### 3-5. 화질 + 조명/광택 (`a2c2c61`)
- `cube-three.tsx`: `renderer.setPixelRatio(min(devicePixelRatio,2))` + `composer.setPixelRatio/setSize` → HiDPI 선명도.
- 조명: 앰비언트 `4→2.4`, 주광 `(1,1,1) 2 → (4,7,6) 3`, **보조광 추가** `(-5,-2,-4) 0.8` → 면별 명암 그라데이션.
- `gen-empty-cube.ts`: 스티커 roughness `0.8→0.45`+metalness`0.05`, 큐비 본체 roughness `0.55` → 광택/입체감.

### 3-6. 카메라 스캔 복구 (`6ee86db`)
- **작동 복구**: `scan.tsx` 의 `getUserMedia` 제약 `height:exact 1280 + aspectRatio 9/16 + deviceId exact` → **`ideal` 만** 사용 + `{video:true}` 폴백 + try/catch 에러 토스트. (exact 조합이 데스크탑/일반 웹캠에서 OverconstrainedError → 영상 안 뜨던 직접 원인)
- **뒤로가기**: 스캔 화면 `← 뒤로`(카메라 스트림 정지 + deviceselect), deviceselect `← 뒤로`(homepage 로 모드 재선택). Solve 진입 시에도 스트림 정지.
- **스트림 관리**: `store.scanStream` 에 보관 → 어느 경로로 나가든 트랙 정지(StrictMode 안전 위해 unmount cleanup 대신 네비게이션 핸들러에서 명시 정지).
- **거울 모드**: `scanReversed` 기본 `true` → 미리보기 좌우 반전(셀카) + 스캔 샘플링 X좌표 재매핑(`reverseCord`)으로 인식 정확 유지.

### 3-7. 코드 정리 (`0c17936`)
- 잘못된 `import { clear } from "console"`(cube-visualization) 제거.
- 디버그 `console.log` 4곳 + 미사용 keydown 'c' 전역 리스너 제거.
- 죽은 코드: `RIGHT_OF/LEFT_OF/findEdge`(lbl-solver), `Corner/Edge` enum(fcube), `get_face/create_move_set/fcube_to_ifcube` import(thistlethwaite), `UnrealBloomPass`/`THREE_WIDTH`/`THREE_HEIGHT`/`useEffect`(cube-vis), `updateStore`(use-init), `scene`(scramble-cube) 제거.
- scan hidden canvas 무효 `-scale-x-100` 제거.

---

## 4. 신규/변경 파일 (v6 이후)

### 신규
- `lib/store/switch-solve-mode.ts` — 도중 모드 전환 액션
- `components/cube-visualization/orientation-labels.tsx` — 라이브 방향 나침반(공유)

### 주요 수정
- `lib/store/store.ts` — `switchSolveMode`, `scanStream`, `scanReversed` 기본 true
- `components/cube-visualization/cube-pos-anchor.tsx` — resize 재측정
- `components/cube-visualization/cube-three.tsx` — pixelRatio + 조명
- `components/cube-visualization/gen-empty-cube.ts` — 광택
- `components/main-page/stages/solve/solve.tsx` — 토글/나침반/반응형/복귀
- `components/main-page/stages/manual-input/scramble-cube.tsx` — 반응형/나침반/복귀
- `components/main-page/stages/scan/scan.tsx`, `card.tsx` — 카메라 복구/뒤로/스트림
- `components/main-page/stages/init/init.tsx` — deviceselect 뒤로가기

---

## 5. 검증 현황

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` | PASS |
| `npm test` (LBL 28 케이스) | 28/28 PASS |
| `next lint` | 경고 6(전부 의도된 exhaustive-deps), 에러 0 |
| fast 솔버 정확성(랜덤 20) | 0 실패, 평균 ~31수 |
| 모드 전환(learn↔fast 임의 위치 30) | 0 실패 |
| 카메라 스캔 영상 표시 | PASS(사용자 확인) |
| 거울 모드 | PASS |
| 반응형(창 크기 변경) | PASS(사용자 확인) |

---

## 6. 남은 작업 (다음 후보)

### 개선 (중기)
- **테스트 범위 확대** — `switch-solve-mode`, `prev/next-solve-step`, 스캔 파이프라인 단위 테스트 미비(회귀 위험 구간).
- **6면 스캔 → solve 전체 흐름 점검** — 실제 스캔으로 풀이까지 연결 검증.
- **solve 화면 뒤로가기** — 진입 출처(scan/manual) 추적 필요. 매뉴얼 재진입 시 큐브 초기화 이슈로 목적지 미정.
- **2-4 연습/힌트 모드** — 능동 학습(가치 최고, 난이도 상). v5/계획서 잔여.
- **4-3 모바일 터치 제스처 검증** — 반응형 레이아웃은 적용됨, 실제 터치 동작 점검 남음.

### 저장소 위생
- 스크린샷 PNG 5개 untracked. public 포크(`fork` remote, `netizen1119/rubiks-app`)는 여전히 공개.

### 알려진 제한 (의도)
- `useEffect [] + idempotent setup` 패턴의 exhaustive-deps 경고 6개 — 의도된 것(StrictMode 안전). 필요 시 줄별 eslint-disable 주석 추가 가능.

---

## 7. 재현 / 검증

```bash
npx tsc --noEmit      # 타입
npm test              # LBL 28 케이스
npx next lint         # 경고 6(의도)
npm run dev           # http://localhost:3000
#  홈 → 차근차근/빠르게 선택 → deviceselect(카메라 선택 또는 Manual Input)
#   - Scan: 카메라(거울) → 6면 스캔 → Solve / ← 뒤로
#   - Manual: 드래그 스크램블 → 풀기
#  solve: 모드 토글, 방향 나침반, 자동재생, 시점 드래그→복귀, 창 크기 변경 시 반응형
```
