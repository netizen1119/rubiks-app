// 8단계 LBL 알고리즘 각 단계의 학습용 설명 + 대표 알고리즘.
// stageIndex 는 0-based (0..7) — solveLBL 출력의 stages 배열 인덱스와 일치.

export type StageDescription = {
  stageIndex: number;
  shortTitle: string; // 짧은 제목 (도트 옆 표시용은 stageName 이미 사용)
  goal: string; // 무엇을 만들지
  approach: string; // 어떻게 풀지 (핵심 알고리즘/패턴)
  representativeAlgo?: string; // 대표 무브 시퀀스 (선택)
  tip?: string; // 학습 팁 (선택)
};

export const stageDescriptions: StageDescription[] = [
  {
    stageIndex: 0,
    shortTitle: "1단계 — 흰 십자",
    goal: "아래면(흰색) 4개 엣지를 D면으로 정렬. 측면 색이 해당 면 센터와 일치하도록.",
    approach:
      "흰색 엣지를 찾아 U면으로 올린 뒤, 목표 위치 위에 U 회전으로 정렬하고 F2/R2/B2/L2 로 내림.",
    tip: "센터 색이 곧 그 면의 목표 색. 흰색은 D, 그 옆 측면 센터를 같이 보고 위치를 정한다.",
  },
  {
    stageIndex: 1,
    shortTitle: "2단계 — 십자 정렬",
    goal: "D 십자의 측면 색을 각 면 센터에 맞춤. (실제로는 1단계와 통합)",
    approach:
      "본 솔버는 1단계에서 정렬까지 함께 수행하므로 이 단계의 이동수는 0인 경우가 많다.",
  },
  {
    stageIndex: 2,
    shortTitle: "3단계 — 1층 코너",
    goal: "흰색 4개 코너를 올바른 위치+방향으로 D면에 삽입.",
    approach:
      "코너를 U면으로 꺼낸 뒤 목표 위치 위에 정렬, R U R' U' (오른) 또는 L' U' L U (왼) 트리거 반복.",
    representativeAlgo: "R U R' U'",
    tip: "흰색 면이 어느 방향을 보고 있는지가 트리거 횟수를 결정. 1~5회 반복.",
  },
  {
    stageIndex: 3,
    shortTitle: "4단계 — 2층",
    goal: "중간 레이어 4개 엣지 삽입. 노란색 포함 엣지 제외.",
    approach:
      "U면에서 노란색 없는 엣지를 찾고 측면 색을 센터에 맞춘 뒤, 오른쪽/왼쪽 삽입 알고리즘 적용.",
    representativeAlgo: "오른쪽: U R U' R' U' F' U F\n왼쪽:  U' L' U L U F U' F'",
  },
  {
    stageIndex: 4,
    shortTitle: "5단계 — 노란 십자",
    goal: "U면 4개 엣지 칸(U[1,3,5,7])을 노란색으로.",
    approach:
      "패턴 인식: 점 → L자 → 선 → 십자. 같은 알고리즘 F R U R' U' F' 를 패턴에 맞춰 1~3회 적용.",
    representativeAlgo: "F R U R' U' F'",
    tip: "점은 임의 방향 1회 → 보통 L자나 선으로 변함. L자는 좌상단 ㄴ자 배치, 선은 수평으로 두고 적용.",
  },
  {
    stageIndex: 5,
    shortTitle: "6단계 — 노란 면",
    goal: "U면 9칸 모두 노란색 (코너 포함).",
    approach:
      "Sune 알고리즘 R U R' U R U2 R' 반복. 노란 코너 수와 방향에 따라 1~3회.",
    representativeAlgo: "R U R' U R U2 R'  (Sune)",
    tip: "노란 코너 0개: 임의 방향 Sune. 1개: 그 코너를 우상에 두고 Sune. 2개: 특정 패턴별로 위치 조정.",
  },
  {
    stageIndex: 6,
    shortTitle: "7단계 — 3층 코너 위치",
    goal: "U면 4개 코너의 측면 색이 해당 센터와 일치하도록 위치 교환.",
    approach:
      "맞는 코너 1개를 고정하고 나머지 3개를 순환. PLL 코너 교환 알고리즘 사용.",
    tip: "맞는 코너가 0개면 임의 방향 1회 → 1개 맞는 상태로 변함. 1개 맞는 코너를 우후방에 두고 순환.",
  },
  {
    stageIndex: 7,
    shortTitle: "8단계 — 3층 엣지 위치",
    goal: "U면 4개 엣지의 측면 색이 해당 센터와 일치하도록 위치 교환. 큐브 완성.",
    approach:
      "U-perm (세 엣지 순환). 시계방향과 반시계방향 두 가지를 큐브 상태에 따라 선택.",
    representativeAlgo:
      "시계방향: R2 U R U R' U' R' U' R' U R'\n반시계방향: R U' R U R U R U' R' U' R2",
    tip: "이미 맞는 엣지 1개를 F면 위로 두고 적용. 모두 안 맞으면 임의 방향 1회 → 1개 맞는 상태로 변함.",
  },
];

// stageIndex 로 조회.
export const getStageDescription = (idx: number): StageDescription | undefined =>
  stageDescriptions[idx];
