import { ICubeSide } from "../../types/types";

// 스캔 색 라벨 → 큐브 면. (색 분류 자체는 lib/helpers/classify-scan-color.ts 가 담당)
// 큐브 색 배치: U=Yellow, R=Green, F=Red, D=White, L=Blue, B=Orange.
export const scannedColorToSide: Record<string, ICubeSide> = {
  W: "D",
  O: "B",
  Y: "U",
  G: "R",
  R: "F",
  B: "L",
};
