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
};
