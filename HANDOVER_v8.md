# HANDOVER v8

작성일: **2026-05-21** (i18n 추가: **2026-05-23**)
대상 브랜치: `main` (private repo `netizen1119/rubiks-app-private`)
범위: 스캔→solve 흐름 안정화 / 나가기·i18n / **2-4 연습(힌트) 모드** / **한·영 토글 i18n**.
이전: `HANDOVER_v7.md` (UX 폴리시·반응형·카메라 스캔 복구·정리).

---

## 1. 한눈에 보기

v7 이후, 카메라 스캔 흐름의 실패 처리를 안정화하고 UI를 한국어로 통일했으며,
계획서의 핵심 미진행 항목인 **2-4 연습/힌트 모드(능동 학습)** 를 구현했다.
2026-05-23 에 **next-intl 기반 한국어/영어 토글**을 추가했다.

- **스캔→solve 실패 루프 해소** — 풀 수 없는 스캔이면 깨진 화면 대신 재스캔 유도
- **solve 나가기 + i18n 통일** — 모든 단계 뒤로가기 + 영어 잔여 문구 한국어화
- **연습 모드** — 사용자가 직접 드래그로 다음 무브를 맞춰가며 학습 (정답만 적용)
- **한·영 토글** — 우상단 floating 「한 / EN」, navigator/localStorage 자동 감지

---

## 2. 커밋 (v7 이후)

| 해시 | 메시지 | 상태 |
|---|---|---|
| `864bb37` | fix scan→solve failure flow: redirect to rescan, re-entrant scan | 커밋됨 |
| `c684634` | add solve exit button and unify UI strings to Korean | 커밋됨 |
| (미커밋) | 2-4 연습/힌트 모드 (store solvePractice, use-cube-drag, solve UI) | **미커밋·런타임 테스트 대기** |
| (미커밋) | 한·영 i18n 토글 (next-intl, messages/, LanguageToggle) | **미커밋·런타임 OK** |

---

## 3. 작업 항목별 요약

### 3-1. 스캔→solve 실패 흐름 안정화 (`864bb37`)
- `solve.tsx`: `initSolveCube` 실패(풀 수 없는 입력 = 주로 스캔 색 오류) 시 깨진 화면에
  머무르지 않고 **한국어 안내 토스트 + 스캔 화면 복귀**(재스캔 유도). 매뉴얼 입력은 항상
  풀 수 있어 이 경로에 안 옴.
- `scan.tsx`: 마운트 시 `currentScanFace = -1` 리셋 → 완료 후에도 **처음(F면)부터 재스캔** 가능
  (이전엔 null 로 남아 시퀀스가 멈춤).
- `move-guide.tsx`: 풀이 0개일 때 "완료 🎉" 오표시 대신 "풀이를 준비하는 중…" 중립 표시.

### 3-2. solve 나가기 + i18n (`c684634`)
- `solve.tsx`: 좌상단 **← 나가기** → deviceselect(입력 시작점). 스캔 뒤로가기와 동일 스타일.
  (출처 추적 시 큐브 리셋 이슈가 있어 deviceselect 로 통일)
- i18n: `cubeSidesFull/cubeSidesNamedColors`(면/색 이름), 스캔 카드("…을 보여주세요"/"색을
  확인하세요"/"풀기"/"스캔"/"확인"), color-panel, device-select(권한/선택), init(스캔/직접
  입력), 초기화 버튼 등 **한국어 통일**. 큐브 무브 표기(U/R/F…)는 유지.

### 3-3. 한·영 i18n 토글 (미커밋, 2026-05-23)
- **next-intl@4.12.0** 도입. routing 없는(SPA) 모드 — `NextIntlClientProvider` 가 store의
  `language` 를 읽어 메시지를 swap.
- **신규**:
  - `messages/ko.json`, `messages/en.json` — 전체 UI + LBL/fast 단계 설명까지 번역.
  - `lib/i18n/provider.tsx` — Zustand `language` ↔ provider 연결, navigator/localStorage
    자동 감지 + `<html lang>` 동기화.
  - `lib/i18n/request.ts` — SSR/SSG fallback (`locale: "ko"`, `timeZone: "Asia/Seoul"`).
  - `components/main-page/language-toggle.tsx` — 우상단 floating 「한 / EN」.
  - `next.config.mjs` — `next-intl/plugin` 등록 (request config 경로 지정).
- **store**: `language: "ko" | "en"` 필드 추가 (기본 `ko`, provider 마운트 시 갱신).
- **변환된 컴포넌트**: init/heading/intructions-info/device-select, scan/card, scramble-cube,
  tutorial-overlay, solve, move-guide, stage-info, stage-progress, stats, orientation-labels.
- **lib/maps/move-descriptions.ts** — 한국어 dict 대신 `moveDescriptionKey()` 가 face/dir 키
  반환, 컴포넌트가 `t("move.face.X")` / `t("move.dir.Y")` 로 조합.
- **stage 이름 lookup**: solver의 stageName 필드 대신 `stage.stageIndex` (1-based) 로
  `t("stages.lbl.{n}")` / `t("stages.fast.{n}")` 키 조회.
- ⚠️ 번역 자체는 동작하지만 **영문 표현이 부분적으로 어색**(특히 LBL 단계 설명) → 추후 다듬기 TODO.
- ⚠️ `lib/maps/stage-descriptions.ts` 는 이제 사용처가 없는 dead code (제거 후보).
- ⚠️ `lbl-solver.ts`, `fast-solve.ts` 의 `stageName/stageNameEn` 필드도 더 이상 사용 안 됨.

### 3-4. 2-4 연습/힌트 모드 (미커밋)
- **신규** `components/cube-visualization/use-cube-drag.ts`: 큐브 드래그→무브 해석을
  `onResolveMove(move)` 콜백으로 분리한 공유 훅. 적용은 호출부 책임.
  - ⚠️ 검증된 매뉴얼 입력 코드는 **건드리지 않음**. 드래그 로직이 일시적으로 중복 →
    추후 매뉴얼 입력도 이 훅으로 통합하는 **DRY 정리 후보**.
- **store** `solvePractice: boolean`.
- **solve.tsx**:
  - 상단 토글 **✋ 내가 풀기 / 👁 풀이 보기**.
  - 내가 풀기: 큐브 직접 드래그 → 정답이면 적용·진행, 틀리면 적용 안 함 + 안내.
  - 180°(X2): 같은 방향 쿼터 2회로 처리(드래그는 90°만 생성). 두 번째 틀리면 첫 쿼터 자동 복원.
  - **💡 힌트** 버튼으로 다음 무브 공개. 자동재생 숨김, ← 이전은 연습 중 비활성.
  - learn/fast 전환·나가기와 호환(step 기반 일관성). 모드 토글 시 더블 중간상태 복원.
- **검증 한계**: 드래그 상호작용은 런타임에서만 확인 가능 → 브라우저 테스트 필요.

---

## 4. 검증 현황

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` | PASS |
| `npm test` | 38/38 PASS (LBL 35 + i18n 3: 키 일관성·placeholder·빈값 가드) |
| `next build` (production) | PASS (next-intl SSG `ENVIRONMENT_FALLBACK` 경고는 자동 폴백) |
| 스캔 카메라 영상/거울/뒤로가기 | PASS (사용자 확인) |
| 연습 모드 드래그 상호작용 | **미검증 (런타임 테스트 대기)** |
| 한·영 토글 런타임 (homepage) | PASS (사용자 확인 — "번역 잘 됨, 표현 어색") |

### 번들 크기 베이스라인 (2026-05-23)
i18n 추가 후 production 빌드 기준. 다음 작업 시 이 값에서 크게 부풀어 오르는지 비교용.
```
Route (app)                Size     First Load JS
/                          87.6 kB        365 kB
/_not-found                 885 B         85.4 kB
+ shared by all                          84.6 kB
```
ko/en messages JSON 두 벌이 모두 client 번들에 포함된 상태. 줄이려면 활성
언어만 dynamic import 하도록 split (효과 ~수 KB, 우선순위 낮음).

---

## 5. 남은 작업

### 큐브 도착 후
- **카메라 면별 방향/거울 매핑 검증** + 정답 1세트로 회귀 테스트 lock (HANDOVER_v7 §6).

### 개선
- **연습 모드 런타임 테스트** 후 다듬기.
- **드래그 로직 DRY 통합** — 매뉴얼 입력도 `use-cube-drag` 훅으로(현재 중복).
- **영문 번역 다듬기** — 특히 `messages/en.json` 의 `stages.lblDesc.*` / `solve.*` 의
  어색한 문장(자연스러운 cubing 용어로 교체).
- **dead code 정리** — `lib/maps/stage-descriptions.ts`, solver의 `stageName/stageNameEn`
  필드 제거 가능.
- 모바일 터치 제스처 검증 (나중).
- (사소) device-select 카메라 0개 시 안내 토스트.

### 알려진 제한 (의도)
- `useEffect [] + idempotent setup` 의 exhaustive-deps 경고 6개 — StrictMode 안전 위한 의도.

---

## 6. 재현 / 검증

```bash
npx tsc --noEmit
npm test
npm run dev   # http://localhost:3000
#  홈 → 차근차근/빠르게 → deviceselect (스캔 또는 직접 입력)
#  solve: ✋ 내가 풀기 토글 → 큐브 드래그로 다음 무브 맞추기 / 💡힌트 / 👁 풀이 보기
#         ← 나가기, 모드 토글, 자동재생, 빈영역 드래그 시점회전
#  우상단 「한 / EN」 토글로 언어 전환 (localStorage 영속 + navigator 자동 감지)
```
