# HANDOVER v3

> 참고: 저장소에 `HANDOVER_v2.md`가 존재하지 않아 동일 형식을 직접 참조하지 못했습니다.
> 일반적인 핸드오버 구조로 작성했습니다. v2가 별도 위치에 있다면 섹션 순서만 맞춰 주세요.

작성일: 2026-05-19
대상 브랜치: `main`
범위: LBL 솔버 도입 → 견고성/길이 보정 → store 연동 → 학습 UI → **수동 입력 UI를 3D 스크램블 큐브로 전면 교체**

---

## 1. 한눈에 보기

기존 `dejwi/rubiks-app` 포크의 Thistlethwaite 솔버를 **LBL(8단계) 솔버**로 교체하고,
학습용 단계별 UI와 **3D 인터랙티브 수동 입력(스크램블 큐브)** 진입점을 추가했다.

- LBL 솔버: 무작위 25수 스크램블 **80/80 (100%)** 복원, 합계 평균 약 100수.
- 솔버 정확성 핵심: 검증된 이동 엔진 위의 **목표지향 탐색**(표기 핸드니스 무관 구조적 정확).
- UI: 8단계 진행 표시 + 한글 이동 안내 + 3D 스크램블 큐브 입력.
- `tsc --noEmit` 통과, 솔버 회귀(`solveLBL(solved)`→전단계 빈 배열) 유지.

---

## 2. 변경/신규 파일

### 솔버 / 데이터
- `lib/solver/lbl-solver.ts` (신규) — LBL 8단계 솔버. 검증된 3D 기하 순열 엔진 포팅 +
  크로스 BFS 거리테이블 + 슬롯 한정 IDDFS + LL 매크로 탐색 + 순수 3-cycle 자동 선별 +
  **데드라인 가드(7초)**.
- `lib/maps/move-descriptions.ts` (신규) — 18개 이동 한글 설명 맵.

### Store
- `lib/store/store.ts` (수정) — `solveStages: LBLStage[]`, `currentStageIndex` 추가.
  `appStages`에 `"manual-input"` 추가.
- `lib/store/init-solve-cube.ts` (수정) — Thistlethwaite → `solveLBL`.
  풀이 평탄화 + **완전복원 검증 안전장치**(parity 위반 입력 차단 → 기존 toast 흐름).
- `lib/store/next-solve-step.ts` (수정) — `cubeSolutionStep` 진행 시
  누적 이동수 기준으로 `currentStageIndex` 동기화(마지막 캡). 회전/하이라이트 미수정.

### UI
- `components/main-page/stages/solve/stage-progress.tsx` (신규) — 8 도트 + 단계명.
- `components/main-page/stages/solve/move-guide.tsx` (신규) — 이동기호 + 한글설명 + 카운터.
- `components/main-page/stages/solve/solve.tsx` (수정) — 레이아웃 재구성(3D 큐브 재사용 유지).
- `components/main-page/stages/init/init.tsx` (수정) — deviceselect에 "Manual Input" 보조 버튼.
- `components/main-page/main-page.tsx` (수정) — manual-input 스테이지 분기.
- **`components/main-page/stages/manual-input/scramble-cube.tsx` (신규)** — 3D 스크램블 큐브.
- ~~`components/main-page/stages/manual-input/manual-input.tsx`~~ (삭제) — 기존 2D 네트 입력 제거.

### 무관 변경(미해결, 본 작업 아님)
- `pnpm-lock.yaml` (+3730/−2586), `pnpm-workspace.yaml`, `CLAUDE.md`, `CLAUDE_CODE_PLAN.md`
  — 의도 여부 미확인. 커밋 전 점검 필요.

---

## 3. LBL 솔버 설계 요약

| 단계 | 방식 | 평균 길이 |
|---|---|---|
| 1 십자 | 크로스 4엣지 BFS 거리테이블 → 최적 경로 하강 | ~6 |
| 2 정렬 | 1단계 통합(0수) | 0 |
| 3 1층 코너 | 슬롯 면집합 한정 IDDFS(케이스 최단) | ~15 |
| 4 2층 | 슬롯 면집합 한정 IDDFS + 추출 | ~25 |
| 5 노란 십자 | AUF 매크로 탐색(F R U R' U' F') | ~11 |
| 6 노란 면 | AUF 매크로 탐색(Sune/Antisune) | ~12 |
| 7 코너 PLL | 자동 선별된 순수 코너 3-cycle + AUF | ~13 |
| 8 엣지 PLL | 자동 선별된 순수 엣지 3-cycle(U-perm) + AUF | ~18 |
| 합계 | | **~100** |

- 표기 핸드니스가 표준과 달라(엔진 내부 일관성은 있음) 표준 알고리즘 문자열이
  다른 효과를 낼 수 있으므로, 7·8단계는 SOLVED에서 "방향·F2L 보존 순수 3-cycle"로
  실제 동작하는 후보만 모듈 로드 시 자동 선별해 사용.
- **데드라인 가드**: parity 위반 등 풀 수 없는 입력에서 한정 탐색이 깊이 한계까지
  전수 탐색하며 사실상 멈추는 것을 방지. `solveLBL` 진입 시 `now+7000ms` 설정,
  `searchRestricted`/`macroSearch`/`drive`/`solveCross` 핫 루프에서 체크, finally 해제.
- M 이동은 솔버 **출력에 사용 안 함**(rotation-utils 미지원). 8단계는 R기반 U-perm.

---

## 4. 3D 스크램블 큐브 (이번 핵심 교체)

`scramble-cube.tsx` — solve용 Three.js와 **완전 독립 인스턴스**.

- 초기 solved 54자 문자열. 26 큐비(MeshBasicMaterial, 외부면만 채색).
- hover → Raycasting → 큐비의 **Y축 층 기본 하이라이트**(살짝 밝게).
- 클릭+드래그 15px 확정: 수평→Y축 층, 수직→X축 층.
  드래그 우=U′/좌=U, 아래=R′/위=R 방향. 90° 회전 애니메이션(pivot + rAF, ~180ms).
  **완료 시 1회** `applyMove(state, move)` → 문자열 갱신 → 메시 재채색 + 트랜스폼 리셋.
  중간 프레임은 오브젝트만 회전, 문자열 미갱신.
- 빈 영역 드래그 → 구면 시점 회전(OrbitControls 미사용, 수동 구현).
- `isAnimating` 가드로 애니메이션 중 입력 무시.
- 버튼: Reset / "이 상태로 풀기 →"(store.cube=문자열 → `initSolveCube()` →
  성공 시 'solve' 전환, 실패 시 toast) / 뒤로.
- `applyMove`는 `lib/solver/lbl-solver`에서 **import만**(솔버 미수정).

### 의도된 단순화 / 설계 결정
1. **"뒤로" 대상**: 명세의 `'get-ready'`는 `IAppStages`에 없는 값(쓰면 strict 오류).
   실제 get-ready 화면은 `deviceselect`이므로 `'deviceselect'`로 전환(기존 동작 유지).
2. **Y 중간(E)층**: 엔진 무브셋에 E 없음 → 수평 드래그가 E층 큐비면 무시(명세 허용).
   X축은 R/M/L 지원(M은 상태 문자열 변형용일 뿐 rotation-utils로 가지 않음).
3. **시각↔문자열 매핑**: 표준 URFDLB 전단사 사용. 상태는 오직 `applyMove`로만 변형 →
   **항상 유효**(parity 검증 불필요). 매핑이 엔진 표기와 미세하게 다르면 커밋 시
   약간의 시각적 스냅 가능 — 상태 정확성/풀이엔 무관(명세 단순화 허용 범위).
4. **"이 상태로 풀기"**: `initSolveCube()`를 여기서 호출(조기 toast). solve.tsx
   마운트 시 동일 호출이 한 번 더 일어나는 기존 패턴은 멱등이라 허용.

---

## 5. 검증 현황

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` (프로젝트 전체, strict) | 통과 (에러 0) |
| `solveLBL(solved)` → 전 단계 빈 배열 | PASS |
| 무작위 25수 스크램블 80개 회귀 | **80/80 (100%)** |
| 유효 큐브 평균/최대 풀이 시간 | ~2.0s / ~3.5s (데드라인 7s 미만) |
| invalid(두 칸 swap, parity 위반) | 7s 데드라인에 종료, 미해결로 차단 → toast, **무한루프/행 없음** |
| 단계 진행 매핑 스모크 | PASS (0→다음 전이는 step==직전단계 누적길이 시점; 빈 2단계는 건너뜀) |

테스트는 임시 파일로 수행 후 모두 삭제(저장소에 테스트 파일 없음).
실행 방식: `node --experimental-strip-types <임시>.ts` (jest/tsx 미설치).

---

## 6. 미완료 / 미확인 사항 (다음 담당자 주의)

1. **수동(런타임) 확인 미수행** — `npm run dev`로 실제 브라우저에서 아래 미검증:
   - deviceselect → "Manual Input" → 큐비 드래그 회전 / 시점 회전 / Reset / "이 상태로 풀기".
   - 3D **시각↔문자열 일치 체감**(섹션 4-3 스냅 가능성). 눈에 거슬리면 매핑을
     엔진 순열에 맞춰 보정 필요(상태 정확성과는 별개, 시각 품질 이슈).
   - solve 단계의 8 도트/단계명/한글 안내 표시, "다음 이동" 진행, 완료 버튼.
   - touch 디바이스 제스처(pointer 이벤트 기반이라 동작 예상되나 미검증).
2. **카메라 스캔 단계 동작 안 함** — 별도 기존 이슈. 본 작업에서 미수정.
   수동 입력 경로가 임시 우회로. 스캔 파이프라인 진단은 별도 작업 필요.
3. **3D 미리보기(solve용 큐브와의 동기화)** — 의도적으로 제외(scan/회전 파이프라인
   강결합, 회귀 위험). 별도 작업으로 분리 권장.
4. **E층 회전 미지원** — 수동 큐브에서 Y 중간층은 돌릴 수 없음. 풀 상태 공간 도달엔
   영향 없으나 UX상 제한. 필요 시 E를 R/L/M 조합 또는 엔진 확장으로 보완.
5. **8단계 길이(평균 ~18)** — 목표 경계. M 출력 금지 제약상 R기반 U-perm이 하한.
   강제 단축은 보류함(정확성 우선).
6. **`pnpm-lock.yaml` 등 무관 변경** — 의도 여부 미확인. 커밋 전 분리/복원 판단 필요.
7. **이중 `initSolveCube` 호출** — 수동 큐브 + solve.tsx 마운트에서 각 1회(멱등이나
   ~2s 재계산 2회). 신경 쓰이면 한쪽으로 일원화 가능.
8. **CLAUDE_CODE_PLAN.md Step 5~7 후속** — UI 기본 연동은 완료. 디자인/애니메이션
   다듬기, 단계별 설명 텍스트 보강은 미진행.

---

## 7. 재현/검증 방법 (다음 담당자용)

```bash
# 타입체크
npx tsc --noEmit

# 솔버 회귀(임시 파일 예시) — solved→빈배열 + N개 스크램블 복원
#   node --experimental-strip-types <tmp>.ts  (import 경로 끝에 .ts 필요)
#   solveLBL/applyMoves 는 lib/solver/lbl-solver 에서 import

# 런타임
npm run dev   # deviceselect → Manual Input 진입점 확인
```

단계 진행 로직: `cubeSolutionStep`이 직전 단계들의 누적 이동수에 도달하면
`currentStageIndex`가 다음 단계로(빈 길이 단계는 건너뜀), 종료 시 마지막 단계로 캡.

---

## 8. 색상 매핑 (참조, 코드와 일치)

U=Yellow `#FFD500` · R=Green `#009B48` · F=Red `#B90000` ·
D=White `#FFFFFF` · L=Blue `#0045AD` · B=Orange `#FF5900`

문자열 54자: U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53), 면 좌상→우하 행 우선.
센터 인덱스 고정: U=4 R=13 F=22 D=31 L=40 B=49.
