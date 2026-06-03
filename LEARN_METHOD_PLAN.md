# 학습 세션 페이지 (Learn Method) 구현 계획

출처 참고: https://easiestsolve.com/ (비기너 LBL 8단계, 친근 별칭·시각 mnemonic)

## 결정 사항 (사용자 확정)

- **3D 데모:** 라이브 애니 데모 — 단계마다 공유 `CubeVisualization` 큐브에 해당 알고리즘 자동 재생.
- **단계 명칭:** easiestsolve 친근 별칭 + 한국어 병기.
- **단계 수:** 기존 8단계 유지 (Daisy 분할 안 함, `solveLBL` 단계와 1:1).
- **형태:** 섞인 큐브 없이 학습만 하는 **독립 stage** (풀이 흐름과 분리).

## 핵심 아이디어

기존 app `messages.stages.lblDesc` 에 이미 8단계 goal/approach/algo/tip 한국어 콘텐츠 존재.
학습 페이지는 이 텍스트를 **재사용**하고, easiestsolve 친근 별칭 + 라이브 3D 데모만 신규.

데모 메커니즘: SOLVED 큐브에 대표 알고리즘의 역순(`invert(repAlgo)`)을 선적용 →
알고리즘을 재생하면 SOLVED 로 복귀 = "알고리즘 작동 시연". 끝나면 루프 리셋.

## 친근 별칭 매핑 (easiestsolve → app 단계)

| # | easiestsolve 별칭 | app 단계 (lblDesc idx) | 한국어 별칭 |
|---|---|---|---|
| 1 | Daisy + White Plus | 1단계 흰 십자 (idx 0, 1 통합) | 흰 꽃잎 → 흰 십자 |
| 2 | Find the Lost Dogs | 3단계 1층 코너 (idx 2) | 강아지 집 찾기 (1층 코너) |
| 3 | ABC's | 4단계 2층 (idx 3) | ABC (2층 엣지) |
| 4 | Furry Yellow Plus (FUR/URF) | 5단계 노란 십자 (idx 4) | 노란 십자 (FUR/URF) |
| 5 | Yellow Fish | 6단계 노란 면 (idx 5) | 노란 물고기 (노란 면) |
| 6 | Thumbs Up Final Corners | 7단계 3층 코너 (idx 6) | 엄지척 코너 |
| 7 | Finish Him! | 8단계 3층 엣지 (idx 7) | 마무리 한 방 |

(데모 단계 = 7개 카드. lblDesc idx 0,2,3,4,5,6,7 사용. idx 1 은 1단계에 통합.)

## 구현 단계

### 1. 스토어 — 새 stage
- `lib/store/store.ts:51` — `appStages` 에 `"learn-method"` 추가.

### 2. 홈 버튼
- `components/main-page/stages/init/init.tsx` — 4번째 버튼 `t("home.modeStudy")` →
  `updateStore({ currentAppStage: "learn-method" })`. 풀이 3버튼과 시각 구분(섹션/variant).

### 3. 디스패처
- `components/main-page/main-page.tsx` — `{currentAppStage === "learn-method" && <LearnMethodStage/>}` 추가.

### 4. 새 컴포넌트 `components/main-page/stages/learn-method/`
- `learn-method.tsx` — 메인. 단계 배열 + 진행/네비 + 데모 재생.
- `learn-steps.ts` — 단계 데이터 (별칭 키 + lblDesc idx + repAlgo + demoSetup).
- 텍스트는 `useMessages().stages.lblDesc[idx]` 재사용. 별칭만 `learnMethod` 네임스페이스.
- **데모:** `CubePosAnchor` 배치 → 공유 큐브 위치. 진입 시 `store.cube` 백업.
  단계 선택 시 `updateCube(applyMoves(SOLVED, invert(repAlgo)))` → `setInterval`+`rotateCube`
  (450ms, solve.tsx 패턴) 로 algo 재생 → 루프.
- **UI:** 친근 제목, 단계 점(7), 이전/다음, 재생/일시정지/다시, 펼침 설명(stage-info 패턴), 뒤로가기.
- **정리:** 이탈 cleanup → cube 복원, GSAP 타임라인 kill, `isDuringRotation` 리셋
  (CLAUDE.md StrictMode 규칙 준수).

### 5. i18n
- `messages/ko.json` + `en.json`:
  - `home.modeStudy`
  - `learnMethod`: `title`, 7개 `funnyName`/`funnyNameSub`, `play`/`pause`/`replay`/`exit`/`stepOf`.

## 검증

- `npx tsc --noEmit` 통과.
- `npm run dev` 시각 확인: 7단계 데모 재생/루프, 큐브 위치 정렬, 이탈 시 cube 복원,
  solve/tracked-solve 흐름 무영향.

## 안 하는 것

- 솔버 알고리즘 변경 없음.
- Daisy 분할·신규 solveMode 없음.
- 자동 테스트 추가 없음 (상태머신/GSAP 결합 → 시각 확인).

## 리스크

공유 vis 큐브 1개를 solve/tracked-solve/learn 공유. 학습 데모가 `store.cube` 변경 →
이탈 시 백업/복원 가드 필수. invert/applyMoves 는 lbl-solver 기존 함수 재사용.
