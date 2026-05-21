# HANDOVER v4

작성일: **2026-05-20**
대상 브랜치: `main` (커밋 `4b4ab24`)
범위: HANDOVER v3 이후 작업 — **메인 vis 큐브 단일화**, 슬라이스 무브 정규화,
다수의 통합/렌더링 버그 수정, 학습 UI 완료.

---

## 1. 한눈에 보기

HANDOVER v3 에서 LBL 솔버 + 별도 스크램블 큐브(Three.js 분리 인스턴스) 구조를
이어받아, 이번 라운드에서 **모든 알려진 시각/동기화 문제를 해결**하고 매뉴얼 입력을
**메인 vis 큐브 직접 조작 방식으로 단일화**했다.

- 슬라이스 무브(M/E/S) 포함 임의 스크램블 → 정규화 후 풀이 → 라벨 재매핑 → 면 무브 출력
- 매뉴얼 입력: 별도 캔버스/씬 제거. 메인 vis 큐브에 포인터 핸들러를 직접 부착.
- 28/28 종단 검증 통과 (면-only, 슬라이스 9종, 혼합, 랜덤 25수 ×10).
- `tsc --noEmit` 통과.

---

## 2. 최종 아키텍처 (이전 대비 차이)

### 단일 Three.js 인스턴스
- 매뉴얼 입력 단계에서 자체 `scene/renderer/camera` 생성하지 않음.
- 메인 vis 의 캔버스에 포인터 핸들러를 부착 (`mainCanvas` ref via store).
- 큐비/스티커 메시도 메인 vis 의 것을 그대로 사용. "색만 매핑" 단계 제거.

### 스토어 노출 ref
- `mainCanvas: HTMLCanvasElement | null` — 매뉴얼 입력 포인터 핸들러 부착용.
- `orbitControls: { enabled: boolean } | null` — 매뉴얼 입력 중 시점 회전 비활성화.

### 큐비 정체성 추적
- `gen-empty-cube.ts` 에서 각 cubeGroup 에 `userData.orgIdx = i` 마커.
- 매뉴얼 입력 진입 시 모든 큐비를 초기 격자(local=0,0,0 + 단위 회전)로 복원.

### 풀이 파이프라인
1. `normalizeCenters(cube)`: U 라벨을 U-pos, R 라벨을 R-pos 로 보내는 큐브 회전 시퀀스 (x/y 합성으로 z 회전 대체).
2. `solveLBL(normalized)`: 표준 센터 가정 솔버 실행.
3. `buildRelabel(rotations)`: 회전을 솔브드 큐브에 적용해 각 면-pos 에 놓이는 라벨 산출.
4. `transformMoves(moves, relabel)`: 솔버 출력의 면 라벨을 원본 좌표계로 재매핑.
5. 출력은 **면 무브만** (rotation-utils 호환).

### Stage 전환
- `main-page.tsx` 의 `AnimatePresence mode="wait"` 제거 → 단순 조건 렌더링.
- `init.tsx` 의 inner `motion.div` exit 애니메이션이 결합되어 다음 stage 마운트를 차단하던 이슈 해결.

### React StrictMode 호환
- `ScrambleCube` 의 `useEffect` 에서 `inited.current` 가드 제거.
- setup 을 idempotent 하게 작성 → cleanup → 재setup 사이클에 안전.

---

## 3. 매뉴얼 입력 UX

### 면-기반 직관 회전
- 호버: 큐비의 어느 면 위에 있는지 + 큐비 중심으로부터의 NDC 오프셋으로 회전축/슬라이스 결정.
- `OutlinePass`(`outlinedSelection.current`)에 해당 슬라이스의 모든 큐비를 채워 시각적 강조.
- 드래그(임계 12px): 실제 스와이프 NDC 벡터로 다시 분해 → 동일 알고리즘으로 축/슬라이스 + 부호 결정.

### 회전 적용
- `rotateCube(move)` 호출로 메인 vis 큐비 시각 회전 (rotateCubeAction 사용).
- `updateStore({ cube: applyMove(state.cube, move) })` 로 상태 문자열 동기화.
- 솔브드 큐브를 그대로 "이 상태로 풀기" 시도하면 toast 로 차단.

### 제외된 동작
- 슬라이스 무브(M/E/S): `resolveAxisSlice` 가 가운데 슬라이스(slice=0) 를 null 처리.
  → 면 무브 9개만 회전 가능. 큐브 상태 공간 전체엔 영향 없음.
- 시점 회전(OrbitControls): 매뉴얼 입력 진입 시 `orbitControls.enabled = false`, 떠날 때 복원.

---

## 4. 해결한 버그 목록

| # | 증상 | 원인 | 해결 |
|---|---|---|---|
| 1 | 슬라이스 무브 후 "풀 수 없음" 토스트 | LBL 솔버의 cross BFS 가 표준 'D' 라벨 하드코딩, 슬라이스로 센터 시프트 시 거리 테이블 미스 | `initSolveCube` 에서 정규화+라벨 재매핑 |
| 2 | solve 단계 큐브가 사용자 스크램블 미반영 | 매뉴얼 → solve 전환 시 store.cube 만 set 하고 스티커 메시 미갱신 | `updateCube(state, true)` 호출 (현재는 메인 vis 단일화로 자연 해결) |
| 3 | solve 진행 시 매 이동 한 수씩 어긋남 | `initSolveCube` 의 자동 `nextCubeSolveStep` 호출이 scramble-cube + solve.tsx 두 곳에서 발생 | scramble-cube 에서 호출 제거, solve.tsx 만 호출 |
| 4 | solve 진행 중 큐비 어긋남/큐브 깨짐 | `rubiksGroup` 의 Y축 자동 회전이 진행 중인 상태에서 레이어 회전이 시작, 회전된 큐비(scene) vs 남은 큐비(rubiksGroup) 누적 회전 어긋남 | solve 진입 시 spinning timeline kill + `gsap.killTweensOf` + `rotation.set(0,0,0)` 스냅 |
| 5 | 2.2초 타이머가 사용자 진행 후 회전 재시작 | `useInitApp` 의 `setTimeout` 발화 시점 가드 없음 | stage 가 homepage/deviceselect 일 때만 `toggleCubeRotating` |
| 6 | 매뉴얼 입력 진입 시 스크램블 큐브 간헐 미표시 | (구) 별도 Three.js 인스턴스의 WebGL 컨텍스트 누적 가능성 | 메인 vis 단일화로 인스턴스 제거 |
| 7 | manual-input 으로 stage 변경해도 ManualInputStage 미마운트 | `AnimatePresence mode="wait"` + InitStage 의 inner motion.div exit (0.9s) 가 다음 자식 마운트 차단 | `AnimatePresence` 제거 |
| 8 | 큐브가 보이지만 드래그 무반응 | React 18 StrictMode dev 에서 `inited.current` 가드 + cleanup 패턴이 (setup → cleanup → 스킵된 setup) 으로 핸들러 제거된 채 남음 | `inited` 가드 제거, setup 을 idempotent 하게 |
| 9 | "이 상태로 풀기" 버튼 클릭 불가 (F12 누르면 활성화) | 캔버스(400x400) + `pointer-events: auto` 가 wrapper(240px) 위아래로 80px 씩 튀어나와 버튼 영역을 덮음 | wrapper 높이 `THREE_HEIGHT` (=400px) 로 매칭 |
| 10 | 레이어 드래그 시 큐브 시점이 같이 회전 | OrbitControls 가 같은 캔버스에 부착되어 핸들러와 동시 발화 | 매뉴얼 입력 진입 시 `orbitControls.enabled = false`, cleanup 복원 |

---

## 5. 변경/신규 파일 (커밋 `4b4ab24`)

### 신규
- `lib/solver/lbl-solver.ts` — LBL 8단계 솔버 + E/S 무브 (HANDOVER v3 산출물 유지)
- `lib/maps/move-descriptions.ts` — 한글 이동 설명 맵
- `components/main-page/stages/manual-input/scramble-cube.tsx` — 메인 vis 직접 조작 매뉴얼 입력
- `components/main-page/stages/solve/move-guide.tsx`
- `components/main-page/stages/solve/stage-progress.tsx`

### 수정
- `lib/store/store.ts` — `solveStages`, `currentStageIndex`, `mainCanvas`, `orbitControls` 추가; `appStages` 에 `manual-input` 포함
- `lib/store/init-solve-cube.ts` — 정규화+풀이+재라벨 파이프라인 + 완전복원 검증
- `lib/store/next-solve-step.ts` — 누적 이동수 기준 `currentStageIndex` 동기화
- `lib/use-init.ts` — 2.2초 타이머에 stage 가드
- `components/main-page/main-page.tsx` — `AnimatePresence` 제거
- `components/main-page/stages/init/init.tsx` — Manual Input 보조 버튼
- `components/main-page/stages/solve/solve.tsx` — 단계 도트/이동 안내 결합, `rubiksGroup` 스냅
- `components/cube-visualization/cube-three.tsx` — `mainCanvas`, `orbitControls` 노출
- `components/cube-visualization/gen-empty-cube.ts` — `userData.orgIdx` 마커

### 커밋 제외 (작업 환경 부산물)
- `pnpm-lock.yaml` (+3730/−2586), `pnpm-workspace.yaml` — 본 작업과 무관
- `CLAUDE.md`, `CLAUDE_CODE_PLAN.md`, `HANDOVER.md`, `HANDOVER_v2.md`, `HANDOVER_v3.md`, 본 파일 — 워크플로 문서
- 스크린샷 png 파일

---

## 6. 검증 현황

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` (strict, 전체) | 통과 (에러 0) |
| `solveLBL(solved)` → 모든 단계 빈 배열 | PASS |
| 면 무브 단순 스크램블 (R, RUR'U', Sune, T-perm) | PASS |
| 9가지 슬라이스 변형 (M/M'/M2, E/E'/E2, S/S'/S2) 단독 | PASS |
| 면+슬라이스 혼합 (RM, UM'D, MES, RUMEF) | PASS |
| 27가지 무브 풀에서 랜덤 25수 × 10회 | 10/10 PASS |
| 출력 무브: U/D/F/B/L/R + ' / 2 만 (rotation-utils 호환) | PASS |
| 런타임 검증: Manual Input → 섞기 → "이 상태로 풀기" → 끝까지 풀림 | PASS (사용자 확인) |
| Manual Input 호버/드래그 시 시점 회전 발생하지 않음 | PASS |
| "이 상태로 풀기" 버튼 클릭 정상 | PASS |
| solve 화면이 사용자 스크램블 상태로 시작 | PASS |

---

## 7. 알려진 제한 / 후속 작업

1. **매뉴얼 입력 슬라이스 무브 미지원** — 면 무브 9종만 회전 가능 (가운데 슬라이스 회전 의도는 무시). 큐브 상태 공간엔 영향 없음.
2. **매뉴얼 입력 중 시점 회전 비활성** — OrbitControls 비활성화. 시점 회전 기능이 필요하면 별도 키 매핑/모드 토글 필요.
3. **Reset 버튼 제거** — 회전 누적 상태에서 깨끗하게 되돌리려면 cubies 재배열 필요. 현재는 매뉴얼 입력 재진입 시 useEffect setup 이 항상 큐비를 초기 격자로 복원하므로, 뒤로 → Manual Input 재진입이 사실상의 reset.
4. **8단계 길이 평균 ~18** — 엔진 표기 한정상 U-perm 이 R 기반. M 출력 금지 제약. 정확성 우선.
5. **cube material `transparent: true`** — 불필요한 transparent 렌더 경로. 큰 영향 없으나 향후 `transparent: false` 로 정리 가능.
6. **dev 환경에서 `requestAnimationFrame` 50~74ms violation 경고** — composer.render() 가 무거움. 기능 영향 없음.

---

## 8. 색상 / 무브 매핑 (참조)

색상 (CLAUDE.md 와 일치):
- U=Yellow `#FFD500` · R=Green `#009B48` · F=Red `#B90000`
- D=White `#FFFFFF` · L=Blue `#0045AD` · B=Orange `#FF5900`

문자열 54자: U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53), 면 좌상→우하 행 우선.
센터 인덱스 고정: U=4 R=13 F=22 D=31 L=40 B=49.

엔진 무브 부호 (rotation-utils 와 일치):
- "U" = -π/2 around +Y, "U'" = +π/2 around +Y
- "R" = -π/2 around +X, "R'" = +π/2 around +X
- "F" = -π/2 around +Z, "F'" = +π/2 around +Z
- "D" = +π/2 around +Y, "L" = +π/2 around +X, "B" = +π/2 around +Z
- (M = +π/2 around +X, E = +π/2 around +Y, S = -π/2 around +Z — 솔버 외부 동결, 출력엔 미사용)

---

## 9. 재현 / 검증 방법

```bash
# 타입체크
npx tsc --noEmit

# 런타임
npm run dev   # http://localhost:3000
#   1. Continue → deviceselect
#   2. Manual Input → 매뉴얼 입력 화면
#   3. 큐비 드래그로 섞기
#   4. "이 상태로 풀기 →" 클릭
#   5. 다음 이동 끝까지 → 완전히 풀림
```

솔버 파이프라인 단위 테스트는 임시 파일로 수행 후 삭제 (저장소에 테스트 파일 없음).
실행 방식: `node --experimental-strip-types <임시>.ts` (import 경로 끝에 `.ts` 필요).

---

## 10. 1차 완성 커밋

- 해시: `4b4ab24`
- 메시지: `add LBL solver and manual scramble input`
- 변경: 14 files, +1376 / -33
- 신규 5개 파일 + 수정 9개 파일.
