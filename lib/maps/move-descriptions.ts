export type MoveDescription = {
  face: string;
  direction: string;
};

export const moveDescriptions: Record<string, MoveDescription> = {
  R: { face: "오른면", direction: "시계방향" },
  "R'": { face: "오른면", direction: "반시계방향" },
  R2: { face: "오른면", direction: "180°" },
  L: { face: "왼면", direction: "반시계방향" },
  "L'": { face: "왼면", direction: "시계방향" },
  L2: { face: "왼면", direction: "180°" },
  U: { face: "윗면", direction: "시계방향" },
  "U'": { face: "윗면", direction: "반시계방향" },
  U2: { face: "윗면", direction: "180°" },
  D: { face: "아랫면", direction: "시계방향" },
  "D'": { face: "아랫면", direction: "반시계방향" },
  D2: { face: "아랫면", direction: "180°" },
  F: { face: "앞면", direction: "시계방향" },
  "F'": { face: "앞면", direction: "반시계방향" },
  F2: { face: "앞면", direction: "180°" },
  B: { face: "뒷면", direction: "시계방향" },
  "B'": { face: "뒷면", direction: "반시계방향" },
  B2: { face: "뒷면", direction: "180°" },
  M: { face: "가운데 세로 슬라이스", direction: "왼면 방향" },
  "M'": { face: "가운데 세로 슬라이스", direction: "오른면 방향" },
  M2: { face: "가운데 세로 슬라이스", direction: "180°" },
  E: { face: "가운데 가로 슬라이스", direction: "아랫면 방향" },
  "E'": { face: "가운데 가로 슬라이스", direction: "윗면 방향" },
  E2: { face: "가운데 가로 슬라이스", direction: "180°" },
  S: { face: "가운데 정면 슬라이스", direction: "앞면 방향" },
  "S'": { face: "가운데 정면 슬라이스", direction: "뒷면 방향" },
  S2: { face: "가운데 정면 슬라이스", direction: "180°" },
};
