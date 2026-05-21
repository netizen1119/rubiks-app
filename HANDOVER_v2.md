# 인계 문서 v2 — Rubik's Cube 학습 앱

**작성일:** 2026-05-19 20:10 KST
**레포:** https://github.com/netizen1119/rubiks-app
**로컬 경로:** `~/Rubiks app`
**선행 문서:** `HANDOVER.md` (v1, 2026-05-19 작성), `CLAUDE_CODE_PLAN.md`

---

## 한 줄 요약

LBL 솔버·UI 8단계 통합까지 완료. 풀이 플로우는 정상 동작 확인.
**카메라 스캔이 동작하지 않아** 수동 큐브 입력 UI를 추가 중 (Claude Code 작업 진행 중).

---

## 진행 상태 (전체)

| 단계 | 내용 | 상태 |
|------|------|------|
| Step 1 | `lib/maps/move-descriptions.ts` 한글 이동 설명 | ✅ |
| Step 2 | `lib/solver/lbl-solver.ts` 8단계 솔버 | ✅ |
| Step 2-견고성 | 무작위 25수 스크램블 80개 100% 해결 | ✅ |
| Step 2-다이어트 | 합계 평균 136.9 → 100.5수 (27% 단축, 80/80 유지) | ✅ |
| Step 3 | `store.ts` 확장 (`solveStages`, `currentStageIndex`) | ✅ |
| Step 4 | `init-solve-cube.ts` LBL 연동 | ✅ |
| Step 4-보정 | `next-solve-step.ts`에 단계 진행 동기화 로직 | ✅ |
| Step 5 | `stage-progress.tsx` 신규 (8단계 도트 + 단계명) | ✅ |
| Step 6 | `move-guide.tsx` 신규 (이동 기호 + 한글 설명 + 카운터) | ✅ |
| Step 7 | `solve.tsx` 전면 교체 | ✅ |
| 수동 점검 | 풀이 플로우 정상, 스캔 화면 검게 변하는 버그 발견 | ✅ |
| **NEW** | 수동 큐브 입력 UI (`manual-input/`) | 🔄 진행 중 |

---

## 검증 누적 결과

- TypeScript strict `tsc --noEmit` 오류 0
- `solveLBL(solved_cube)` → 8단계 전부 빈 배열 (인수조건)
- 무작위 25수 스크램블 80개 × 두 시드 모두 100% 복원
- 다이어트 후 단계별 평균:
  - 1단계 십자: ≤10 / 3단계 1층 코너: 15.4 / 4단계 2층: ~25
  - 5·6 윗면: 목표 이내 / 7단계: ~13 / 8단계: 18~19 (M 미지원 합리적 하한)
- 풀이 UI 수동 점검: 도트·단계명·한글 설명 정상

---

## 미해결 사안

### 1. 카메라 스캔 동작 안 함 (중요)
- 증상: 권한 허용 후 Scan 버튼 클릭 → 화면 검게 변함, 큐브 미리보기 윤곽만 어둡게 표시
- JS 콘솔 에러 없음 (No Issues)
- Elements 탭에 `<video>` 엘리먼트 자체가 마운트 안 됨
- **원인 미확정**: 우리 작업으로 인한 회귀인지, 포크 시점부터 미구현인지 진단 안 함
- 우회: 수동 입력 UI(현재 작업 중)로 입력 경로 확보

### 2. 2단계 도트 점프 (마이너)
- 2단계가 1단계와 통합되어 길이 0 → 도트가 0→1 아닌 0→2로 점프
- 현재는 의도된 동작으로 두기로 함, 거슬리면 추후 UX 정리

### 3. `pnpm-lock.yaml` 미커밋 변경
- 본 작업과 무관, 커밋 시 분리 처리 필요

---

## 진행 중 작업 — 수동 큐브 입력 UI

**옵션 선택:** A — 스캔 화면에 "Manual Input" 보조 버튼 추가 (스캔 살릴 때 양립 가능)

**Claude Code에 지시한 명세 요약:**
- 진입: 스캔 화면(get-ready)에 보조 버튼
- 새 stage: `components/main-page/stages/manual-input/manual-input.tsx`
- 펼친 net 레이아웃 (U / L F R B / D), 54칸, 센터 6칸 고정
- 색상 팔레트 6개, 칸 클릭으로 색상 지정
- 초기 상태 = solved, Reset 버튼, Solve 버튼
- 유효성: 각 색상 9개씩 카운트
- Store에 'manual-input' stage 추가
- 3D 미리보기 실시간 동기화는 Claude Code 판단 (포함 시 보고)

**검증 요청:**
- `tsc --noEmit` 통과
- solved 상태 Solve → "이미 풀림" 처리
- invalid 상태(예: 두 칸 swap) Solve → **무한 루프 안 나는지 특히 확인**

---

## 다음 세션 시작 방법

```bash
cd ~/Rubiks\ app
claude
```

### 첫 프롬프트 분기

**A. 수동 입력 UI 작업이 완료되어 보고가 끝나있으면:**
```
방금 끝난 수동 입력 UI 작업 결과를 확인하고,
다음 작업 후보 중 하나를 골라 진행:
1. 스캔 회귀/미구현 진단 (git worktree로 포크 시점 비교)
2. 8단계 PLL 길이 추가 단축 (M 이동 우회 불가 외 가능성 점검)
3. 2단계 도트 UX 정리 (점프 거슬리면)
4. pnpm-lock.yaml 커밋 정리
```

**B. 수동 입력 UI 작업이 중간에 끊겼으면:**
```
HANDOVER_v2.md의 "진행 중 작업 — 수동 큐브 입력 UI" 섹션 명세대로
이어서 진행해줘. tsc 통과 + invalid 상태 무한 루프 안 나는지 검증 포함.
```

---

## 핵심 주의사항 (매 세션 상기)

- **M 이동**: `rotation-utils.ts`가 M 미지원 → 솔버 출력 수열에 M 포함 금지
- **TypeScript strict**: 타입 누락 시 빌드 오류
- **Zustand 패턴**: `IStoreFn(get, set)` 유지
- **`"use client"`**: Three.js/GSAP 사용 컴포넌트 필수
- **회귀 보호**: 80개 스크램블 회귀 + tsc는 매 작업 후 재확인 (Claude Code가 자동으로 하고 있음)
- **스캔 단계 코드 손대지 말 것**: 별도 진단 작업 전까지 보존

---

## 변경된 파일 (현재까지)

```
M  lib/store/store.ts
M  lib/store/init-solve-cube.ts
M  lib/store/next-solve-step.ts
M  lib/solver/lbl-solver.ts
M  components/main-page/stages/solve/solve.tsx
N  lib/maps/move-descriptions.ts
N  components/main-page/stages/solve/stage-progress.tsx
N  components/main-page/stages/solve/move-guide.tsx
?? CLAUDE.md
?? CLAUDE_CODE_PLAN.md
?? HANDOVER.md
?? HANDOVER_v2.md  (이 문서)
M  pnpm-lock.yaml  (작업 무관, 별도 처리)
```

작업 중인 추가 파일 (수동 입력 UI):
```
N (예정) components/main-page/stages/manual-input/manual-input.tsx
M (예정) lib/store/store.ts  (stage enum에 'manual-input' 추가)
M (예정) 스캔 화면 컴포넌트  (Manual Input 버튼 추가)
```

---

## 전체 목표 recap

학습자가 자신의 큐브 상태를 입력 (스캔 또는 수동) → 3D 표시 →
Vincent 8단계 LBL 커리큘럼으로 단계별 안내받는 학습 앱.

기존 Thistlethwaite 최적 솔버 → LBL 솔버 교체 완료.
UI 단계명 + 한글 이동 설명 + 진행 도트 전면 교체 완료.
스캔 단계 우회용 수동 입력 추가 작업 중.
