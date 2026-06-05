# 프로젝트 컨텍스트

## 현재 상태
**math-learn 대대적 개편: 조각 하이라이트 + 3탭 분할 + 쉬운 말 재작성 (2026-06-05).**
math-learn 수학 학습 페이지를 한 세션에 크게 다듬음 (브라우저 헤드리스 chromium 으로 매 단계
시각 검증):
- **조각 하이라이트**(`15b5c4b`): 데모 종료 후 **실제로 바뀐 조각만 노란 외곽선**으로 강조
  (`outlinedSelection` in-place 변이 → OutlinePass) + "N개만 바뀜·나머지 M개 제자리" 캡션.
  교환자/켤레의 "나머지는 그대로" 마법을 눈으로. 검출 = 3D 큐비 직접 검사(slot≠orgIdx OR
  quaternion 비-identity; 센터·코어 제외, [[cube-string-vs-3d-cubie-divergence]]).
  superflip=12조각(코너 0), 교환자/켤레=7조각으로 검증.
- **데모 무브 self-paced**(`218ed4d`→`a868073`): 고정 타이머 디스패치가 느린 환경서 더블 무브
  (800ms)를 회전가드에 드롭하거나 검출을 애니 도중 실행하던 버그. 무브를 "이전 무브 완료
  (isDuringRotation=false)" 후에만 디스패치 + 검출도 정착 후 → 속도 무관·드롭 불가.
- **3탭 분할**(`8514caf`): 긴 단일 스크롤 → 사람 풀이/컴퓨터 풀이/God's Number 3탭. MATH_TABS
  가 Part2·Part3 의 h2 경계로 자동 슬라이스. 탭 전환 시 reset(시연중단+외곽선+큐브 solved)+스크롤.
- **쉬운 말 재작성**(`c96a50e`): 3탭 산문 전면 평이화(한·영). 긴 문장 분리, em-dash 축소, 어려운
  표현 교체. 수식·표·데모·숫자·블록 구조는 유지.
- 부수: "sexy move"→"네 수 트리거"(`462250c`), 부제 "11학년" 삭제(`a868073`), 뒤로 버튼 이중
  화살표 수리(`9addab9`).
tsc·51/51 PASS, KaTeX·콘솔 에러 0 확인. 카메라 실측은 여전히 미완.
브랜치 `feat/phase2b-move-detector` (최신 `c96a50e`; origin/private 푸시됨; math-learn 도입
`d960914`·`7b7bdac`):
- 코드 검토 수리(`12d4da9`): rotation-utils U2 prerotation `/double` 누락, next-solve-step
  currentStep 경계 가드, cv-worker-client terminate 시 in-flight Promise hang. (cube-three RAF/
  renderer cleanup 누수는 `inited 가드+cleanup 위험` 규칙 충돌로 보류 — 메모리 기록.)
- math-learn(`d960914`·`7b7bdac`): 신규 4파일(math-content/math-blocks/use-cube-demo/math-learn)
  + main-page 디스패치·홈 링크 + store appStages "math-learn" + i18n math.* + katex(pnpm).
  **함정 수리**: 큐브 오버레이 `inset-0` 누락 → 긴 스크롤 스테이지서 큐브 화면 밖 사라짐(짧은
  스테이지는 우연히 정상). 스크롤 비침은 불투명 밴드를 본문 뒤 DOM 에 배치해 z-index 없이 가림.
- `HANDOVER_v16.md` — **가장 최신** (학습 모드: learn-method stage = demo/practice 디스패처.
  learn-demo = solved 큐브 알고리즘 시연 루프. learn-practice = 실제 큐브 단계별 따라하기, solve
  handleGuess/StageInfo/MoveGuide 재사용 + move-arrow 3D 화살표 힌트 + 자유 시점/리셋. learnMode
  플래그로 scan/manual 완료 분기. 홈 복귀 시 큐브 solved 복원. 홈 2버튼=내큐브로배우기/카메라.)
- `HANDOVER_v15.md` — Phase 2b (forward-model 매칭: known S 에 18무브 적용 → 보이는 면 예측
  → 관측 9-tuple 해밍 비교. move-detector 순수 코어 = rotateFace/detectableMoves/lockOrientation/
  searchMove, 360 round-trip 테스트. tracker-bridge = rotateCube + cube 문자열 동기. tracked-solve
  = 방향 lock → idle/moving/settled 상태머신 → commit → 미매칭 재lock+toast. + Phase 2a 생명주기
  누수 5건 수리(별도 fix 브랜치 머지). 다음: 카메라 실측 + 튜닝.)
- `HANDOVER_v14.md` — Phase 2a 완료 (contour+9-neighbor ROI 검출, 9 sticker lattice,
  grid-sampler sticker 좌표 기반 + trimmed-mean. 브라우저 6면 검증 통과. Phase 2b 확정안 §4)
- `HANDOVER_v13.md` — ROI 방향 전환 리서치 결론 (edge-density 폐기, contour 정답 파이프라인)
- `HANDOVER_v12.md` — Phase 2a: grid-sampler 신규, 9-grid 시각화, edge-density ROI 3차 시도
- `HANDOVER_v11.md` — Phase 1 + C-1: OpenCV Worker 이전 + 큐브 ROI (커밋 `76a4510`)
- `HANDOVER_v10.md` — Phase 1 색 기반 PoC + main-thread OpenCV hang
- `HANDOVER_v9.md` — 카메라 트래킹 모드 설계/Phase 0 스캐폴딩
- `HANDOVER_v8.md` — i18n·a11y·DRY (스캔→solve 복구, 2-4 연습 모드, 한·영 토글, 드래그 DRY)
- `HANDOVER_v7.md` — UX 폴리시/반응형/HiDPI·조명/카메라 스캔 복구·정리
- `HANDOVER_v6.md` — 3차 (수준 선택 learn/fast → 모드별 솔버 분기, 도중 전환 토글)
- `HANDOVER_v5.md` — 2차 작업 결과
- `HANDOVER_v4.md` — 1차 완성 시점 (LBL 솔버 + 매뉴얼 입력)
- `CLAUDE_CODE_PLAN_v2.md` — 2차/3차 작업 계획 + 진행 체크박스
- `CLAUDE_CODE_PLAN.md` — 1차 작업 계획

저장소: private `netizen1119/rubiks-app-private` (origin, SSH). public 포크는 `fork` remote.
다음: Phase 2b 카메라 실측 (상태머신은 React refs+store 결합 → 자동 테스트 불가, dev 서버
시각 확인). 튜닝 노브 = tracked-solve.tsx 상단 MOVE_DELTA_MIN/SETTLE_FRAMES/MATCH_THRESHOLD.
이후 Phase 3 (풀이 흐름 합류 + 3D 미리보기). HANDOVER_v15 §5.

## 기술 스택
Next.js 14, React 18, Three.js, Zustand, TypeScript strict, Tailwind, GSAP

## 코딩 규칙
- "use client" — Three.js/GSAP 관련 컴포넌트 필수
- Zustand 패턴 — IStoreFn (get, set) 유지
- TypeScript strict — 타입 누락 금지
- React StrictMode 호환: useEffect 의 setup 은 idempotent 하게 작성하거나
  cleanup 없이 1회만 실행 (inited.current 가드 + cleanup 조합은 위험)

## 큐브 색상
U=Yellow, R=Green, F=Red, D=White, L=Blue, B=Orange

문자열 54자: U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53), 면 좌상→우하 행 우선.
센터 인덱스: U=4, R=13, F=22, D=31, L=40, B=49.

## 무브 지원
- 면 무브: U/D/F/B/L/R + ' / 2 (rotation-utils 완전 지원)
- 슬라이스 무브: M/E/S + ' / 2 (rotation-utils 에 추가됨, 매뉴얼 입력 사용 가능)
- 큐브 회전: x/y/z + ' / 2 (lbl-solver 엔진 내부 정규화용, 시각화 미지원)

LBL 솔버 출력은 면 무브만 (rotation-utils 호환). 슬라이스로 회전된 입력은
정규화 후 풀이 + 라벨 재매핑으로 면 무브 시퀀스 산출.

## 개발 서버
```bash
npm run dev     # http://localhost:3000
npm test        # 38 케이스 단위 테스트
npx tsc --noEmit  # 타입체크
```

## 풀이 모드
큐브 풀이 알고리즘 (`solveMode`, init-solve-cube 가 분기):
- **learn** (`solveLBL` 8단계, ~98수, 풀 설명) — 학습/카메라 모드의 기본 알고리즘.
- **fast** (`solveFast` Thistlethwaite 래퍼, 4단계 ~31수, fast 실패 시 learn 폴백).
둘 다 면 무브만 출력 → 동일 시각화/정규화 파이프라인 공유.
solve 스테이지(learn/fast 보기·연습)는 **코드 유지하나 홈에서 숨김** (HANDOVER_v16). 진입은
learn-practice/tracked-solve 내부에서 알고리즘 재사용.

## 홈 진입점 (HANDOVER_v16 정리)
홈 버튼 2개:
- **내 큐브로 배우기** (`learnMode: true`) → deviceselect → scan/manual 완료 시 `learn-method`(연습)
  스테이지. 실제 풀이 단계를 친근 별칭으로 직접 따라하기 + 3D 화살표 힌트.
- **카메라로 따라가며 풀기** (`trackedSolve: true`) → `tracked-solve` 스테이지 (HANDOVER_v9/v15).
홈 우상단 작은 링크 **「🧮 큐브 수학」** → `math-learn` 스테이지 (수학 학습 아티클, 2026-06-04).
숨김(코드 유지): 차근차근/빠르게(→solve), 푸는 법 데모(→learn-method demo, `learnMode:false`).

## 주요 단계 (사용자 흐름)
1. **homepage** → 「내 큐브로 배우기 / 카메라로 따라가며 풀기」 → **deviceselect**
2. **deviceselect** → Scan 또는 Manual Input → **scan** / **manual-input**
3. **manual-input** → 드래그로 큐브 섞기 → "이 상태로 풀기 →" → **learn-method** / **tracked-solve**
   (learnMode/trackedSolve 분기; solve 는 홈 숨김이라 직접 도달 안 함)
4. **learn-method (연습)** → 단계별 친근 별칭 + 다음 무브 3D 화살표 → 드래그로 따라하기 → 완료
4'. **tracked-solve** → 카메라 미리보기 + forward-model 무브 감지 (카메라 실측 미완)
4''. **math-learn** (홈 우상단 링크) → 수학 학습 아티클(한·영, KaTeX, 데모 버튼이 공유 큐브 시연).
   상단 고정 밴드에 큐브 핀 고정 + **3탭 분할**(사람 풀이/컴퓨터 풀이/God's Number; MATH_TABS 가
   Part2·Part3 h2 경계로 자동 슬라이스). 탭 전환 시 reset(시연중단+외곽선+큐브 solved)+스크롤 top.
   데모 종료 후 **바뀐 조각만 노란 외곽선 강조**(3D 큐비 직접 검사, [[cube-string-vs-3d-cubie-divergence]]).
   components/main-page/stages/math-learn/ (콘텐츠=math-content.ts).
- 홈 복귀 시 큐비 solved 자동 복원 (main-page, HANDOVER_v16).

## 핵심 아키텍처

### 단일 메인 vis 큐브
매뉴얼 입력과 solve 양쪽이 같은 Three.js 씬/큐비를 공유. 별도 인스턴스 없음.
- `store.objects.current.cubes` — 27개 큐비 그룹, `userData.orgIdx` 마커로 reset 가능
- `store.mainCanvas.current` — 매뉴얼 입력 단계에서 포인터 핸들러 부착용
- `store.orbitControls.current` — 시점 회전 토글용

### 정규화 파이프라인 (lib/solver/normalize.ts)
1. `normalizeCenters(cube)` — 큐브 회전(x/y 합성)으로 표준 센터 배치 복원
2. `solveLBL(normalized)` — 표준 센터 가정 솔버 실행
3. `buildRelabel(rotations)` + `transformMoves(moves, relabel)` — 면 라벨 원본 좌표계로 재매핑
4. 최종 출력은 면 무브만 (rotation-utils 호환)

### 비전 파이프라인 (lib/vision/ + public/cv-worker.js, Phase 1+)
1. `public/cv-worker.js` — OpenCV.js Web Worker. `importScripts(CDN)` 로 WASM 로드, 매 frame
   gray → blur(3×3) → Canny(30,60) → **dilate(7×7)** → `findContours(RETR_TREE)` →
   approxPolyDP 4-vertex+convex+aspect/fill/area quad 필터 → **median 상대 크기 게이트** →
   **9-neighbor anchor**(이웃 최다 사각형=면 중심) → anchor 중심+sticker pitch 로 **3×3 lattice**
   = 9 sticker 좌표 row-major. `{ edges, roi, stickers, side, quads }` transferable 회신.
   plain JS in `public/` — Next.js 14 turbo 의 worker.ts MIME 한계(`video/mp2t`) 우회.
   (dilate 가 끊긴 스티커 테두리를 닫는 핵심 트릭. edge-density 접근은 v13 에서 폐기.)
2. `cv-worker-client.ts` — main-side wrapper. 싱글톤 + ready Promise + back-pressure
   (in-flight frame drop) + terminate. `EdgesResult` 에 stickers/side/quads.
3. `grid-sampler.ts` — `sampleFaceGridFromStickers(frame, stickers, side)`: worker 의 9 sticker
   중심 둘레 side×0.6 영역 평균 RGB → `classifyColor`. **어두운 픽셀(<55) 제외 trimmed-mean**
   으로 흰칸 루빅스 로고/grid line/그림자 outlier 차단. 정중앙(idx 4) = 면 중심 anchor.
4. `pose-lock.ts` — connected-component flood fill centroid. **stickers 미검출 시 fallback** 전용
   (1초 stale 후). optional ROI 인자로 sampling 범위 제한.
5. `move-detector.ts` — **forward-model 매칭** (Phase 2b). 순수 함수: `rotateFace`(3×3 회전),
   `detectableMoves`(front 면당 15무브, 반대면 제외), `lockOrientation`(known S 면 4회전 해밍
   최소로 orient 확정), `searchMove`(15무브 `applyMove` 예측 vs 관측 해밍). 좌표계=면 라벨 공간.
   `getFace`/`applyMove`(lbl-solver) 재사용. round-trip 단위 테스트 `move-detector.test.ts`.
6. `tracker-bridge.ts` — `commitDetectedMove`: `store.rotateCube(move)`(3D 애니) +
   `set({cube: applyMove(...)})`(forward-model S 동기). rotateCubeAction 은 cube 문자열 안 건드려서
   직접 갱신 필요. isDuringRotation 가드. 풀이 흐름 합류는 Phase 3.

6면 중심은 면 무브에 의해 위치 불변 (회전만) → 영구 anchor 로 활용.
tracked-solve 진입 시 4초 학습 phase 가 `calibrateFromCenter` EMA 로 색 reference 자동 수렴.

**해결됨 (v14):** v11 의 "색 connected-component 만으론 섞인 큐브 중심 sticker 보장 불가" 한계는
contour+9-neighbor 가 면 중심 스티커를 구조 제약(8 이웃)으로 직접 찾아 해결. connected-component
는 fallback 으로 강등.
