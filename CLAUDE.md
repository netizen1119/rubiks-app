# 프로젝트 컨텍스트

## 현재 상태
연습 모드 + 스캔 흐름 안정화 + i18n 완료 (2026-05-21). 진행 내역:
- `HANDOVER_v8.md` — **가장 최신** (스캔→solve 실패 복구, solve 나가기·i18n, 2-4 연습 모드[런타임 테스트 대기])
- `HANDOVER_v7.md` — UX 폴리시/반응형/HiDPI·조명/카메라 스캔 복구·정리
- `HANDOVER_v6.md` — 3차 (수준 선택 learn/fast → 모드별 솔버 분기, 도중 전환 토글)
- `HANDOVER_v5.md` — 2차 작업 결과
- `HANDOVER_v4.md` — 1차 완성 시점 (LBL 솔버 + 매뉴얼 입력)
- `CLAUDE_CODE_PLAN_v2.md` — 2차/3차 작업 계획 + 진행 체크박스
- `CLAUDE_CODE_PLAN.md` — 1차 작업 계획

저장소: private `netizen1119/rubiks-app-private` (origin, SSH). public 포크는 `fork` remote.
다음: 연습 모드 런타임 테스트 / 큐브 도착 후 카메라 매핑 검증 / 드래그 로직 DRY 통합 (HANDOVER_v8 §5).

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
npm test        # 28 케이스 단위 테스트
npx tsc --noEmit  # 타입체크
```

## 풀이 모드 (3차 추가)
홈에서 `solveMode` 선택 → init-solve-cube 가 분기:
- **learn** (차근차근 배우기, 기본): `solveLBL` 8단계, ~98수, 풀 설명.
- **fast** (빠르게 풀이 보기): `solveFast`(Thistlethwaite 래퍼) 4단계, ~31수. fast 실패 시 learn 폴백.
둘 다 면 무브만 출력 → 동일 시각화/정규화 파이프라인 공유.

## 주요 단계 (사용자 흐름)
1. **homepage** → 「차근차근 배우기 / 빠르게 풀이 보기」 → **deviceselect**
2. **deviceselect** → Manual Input → **manual-input**
   (스캔 경로는 카메라 필요 — 현재 미진행)
3. **manual-input** → 드래그로 큐브 섞기 → "이 상태로 풀기 →" → **solve**
4. **solve** → 다음 이동 / 이전 이동 / 자동 재생 / 풀이 원리 보기 → 완료

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
