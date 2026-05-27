// 카메라 프레임에서 6면 중심을 식별해 큐브 좌표계(3축)를 결정한다.
// 면 무브는 중심을 평면 위에서 회전만 시키므로, 6개 중심 색은 영구적 anchor 역할.
// 3개 이상의 중심이 보이면 큐브 축이 유일하게 결정된다.
//
// Iteration 2: 색 블롭 검출 + centroid 만 산출. 축 결정은 Iteration 3+ 에서.

import { classifyColor, type ScanColor } from "../helpers/classify-scan-color";
import type { ICubeSide } from "../../types/types";

// 프로젝트 매핑: U=Yellow(Y), R=Green(G), F=Red(R), D=White(W), L=Blue(B), B=Orange(O).
// classify-scan-color 가 돌려주는 라벨(Y/G/R/W/B/O)을 면 라벨(U/R/F/D/L/B) 로 변환.
const SCAN_TO_FACE: Record<Exclude<ScanColor, "X">, ICubeSide> = {
  Y: "U",
  G: "R",
  R: "F",
  W: "D",
  B: "L",
  O: "B",
};

// 역방향 매핑 — 캘리브용으로 호출자가 면 라벨을 ScanColor 로 되돌릴 때 사용.
export const FACE_TO_SCAN: Record<Exclude<ICubeSide, "X">, ScanColor> = {
  U: "Y",
  R: "G",
  F: "R",
  D: "W",
  L: "B",
  B: "O",
};

export type CubeAxis = [number, number, number];

export type DetectedCenter = {
  face: ICubeSide;
  /** 이미지 좌표(px) — 프레임 원본 기준. UI 미러 적용은 호출자 책임. */
  x: number;
  y: number;
  /** 이 색으로 분류된 grid sample 수. 작을수록 노이즈 가능성 ↑. */
  pixelCount: number;
  /** centroid 픽셀들의 RGB 평균 — 호출자가 캘리브에 다시 먹일 수 있게 함께 반환. */
  r: number;
  g: number;
  b: number;
};

export type CubePose = {
  centers: DetectedCenter[];
  centerCount: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** 3축은 Iteration 3+ 에서 산출. 그 전까지 null. */
  axisX: CubeAxis | null;
  axisY: CubeAxis | null;
  axisZ: CubeAxis | null;
  /** 0..1; centerCount/6 + 향후 일관성 점수 결합. */
  confidence: number;
};

/**
 * 큐브 후보의 frame 내 ROI. cv-worker 의 findContours+사각형 필터가 추정해 보내준다.
 * detectCubePose 에 전달하면 그리드 sampling 을 이 영역으로만 제한해 손/벽/배경 잡음을 차단.
 */
export type CubeROI = { x: number; y: number; w: number; h: number };

// 매 SAMPLE_STEP 픽셀마다 한 점을 분류 (1280×720 → 80×45 = 3,600 샘플).
// 너무 촘촘하면 main thread 부하 ↑, 너무 듬성하면 작은 큐브가 누락.
const SAMPLE_STEP = 16;
// 이 미만의 그리드 셀 수만 잡힌 blob 은 노이즈로 무시 (옷·배경에서 같은 색 작은 점).
const MIN_CENTER_PIXEL_COUNT = 30;

export const detectCubePose = (frame: ImageData, roi?: CubeROI | null): CubePose | null => {
  const { data, width, height } = frame;

  // 1단계: 그리드 셀 단위로 분류. cell(gx, gy) = SAMPLE_STEP 픽셀당 1점.
  // ROI 가 있으면 그 안의 grid 만 채워서 큐브 바깥(손/벽/모니터) 잡음은 미분류로 남긴다.
  // 좌표는 frame 전체 기준으로 유지 (flood fill 의 인접 cell 계산을 그대로 쓸 수 있게).
  const half = SAMPLE_STEP >> 1;
  const gw = Math.floor((width - half) / SAMPLE_STEP) + 1;
  const gh = Math.floor((height - half) / SAMPLE_STEP) + 1;
  const labels = new Int8Array(gw * gh);
  const rgbR = new Uint8Array(gw * gh);
  const rgbG = new Uint8Array(gw * gh);
  const rgbB = new Uint8Array(gw * gh);
  // 0 = 미분류, 1..6 = U/R/F/D/L/B 의 (index+1).
  const FACE_ORDER: ICubeSide[] = ["U", "R", "F", "D", "L", "B"];
  const FACE_TO_CODE = new Map(FACE_ORDER.map((f, i) => [f, i + 1]));

  // ROI 픽셀 범위. 없으면 전체 frame.
  const roiX0 = roi ? Math.max(0, roi.x) : 0;
  const roiY0 = roi ? Math.max(0, roi.y) : 0;
  const roiX1 = roi ? Math.min(width, roi.x + roi.w) : width;
  const roiY1 = roi ? Math.min(height, roi.y + roi.h) : height;

  for (let gy = 0; gy < gh; gy++) {
    const y = half + gy * SAMPLE_STEP;
    if (y < roiY0 || y >= roiY1) continue;
    for (let gx = 0; gx < gw; gx++) {
      const x = half + gx * SAMPLE_STEP;
      if (x < roiX0 || x >= roiX1) continue;
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const sc = classifyColor(r, g, b);
      if (sc === "X") continue;
      const face = SCAN_TO_FACE[sc];
      const cell = gy * gw + gx;
      labels[cell] = FACE_TO_CODE.get(face) ?? 0;
      rgbR[cell] = r;
      rgbG[cell] = g;
      rgbB[cell] = b;
    }
  }

  // 2단계: 각 셀에서 4-connectivity flood fill 로 component 찾기.
  // 같은 색 큰 덩어리(큐브 면)와 작은 점(배경 노이즈)을 분리하고, 면별 최대 blob 만 채택.
  // → "같은 색이 화면 두 곳" 이라도 평균 좌표가 빈 공간에 떠 다니지 않는다.
  type Blob = {
    face: ICubeSide;
    cells: number; // grid cell 수
    sumX: number; // 픽셀 좌표 합
    sumY: number;
    sumR: number;
    sumG: number;
    sumB: number;
  };
  const visited = new Uint8Array(gw * gh);
  const queue = new Int32Array(gw * gh);
  const bestByFace = new Map<ICubeSide, Blob>();

  for (let start = 0; start < labels.length; start++) {
    if (visited[start] || labels[start] === 0) continue;
    const code = labels[start];
    const face = FACE_ORDER[code - 1];
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const blob: Blob = {
      face,
      cells: 0,
      sumX: 0,
      sumY: 0,
      sumR: 0,
      sumG: 0,
      sumB: 0,
    };
    while (head < tail) {
      const cell = queue[head++];
      const gx = cell % gw;
      const gy = (cell - gx) / gw;
      blob.cells += 1;
      blob.sumX += half + gx * SAMPLE_STEP;
      blob.sumY += half + gy * SAMPLE_STEP;
      blob.sumR += rgbR[cell];
      blob.sumG += rgbG[cell];
      blob.sumB += rgbB[cell];
      // 4-neighborhood.
      if (gx + 1 < gw) {
        const n = cell + 1;
        if (!visited[n] && labels[n] === code) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (gx > 0) {
        const n = cell - 1;
        if (!visited[n] && labels[n] === code) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (gy + 1 < gh) {
        const n = cell + gw;
        if (!visited[n] && labels[n] === code) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (gy > 0) {
        const n = cell - gw;
        if (!visited[n] && labels[n] === code) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
    }
    const prev = bestByFace.get(face);
    if (!prev || blob.cells > prev.cells) bestByFace.set(face, blob);
  }

  const centers: DetectedCenter[] = [];
  for (const [face, a] of bestByFace.entries()) {
    if (a.cells < MIN_CENTER_PIXEL_COUNT) continue;
    centers.push({
      face,
      x: a.sumX / a.cells,
      y: a.sumY / a.cells,
      pixelCount: a.cells,
      r: a.sumR / a.cells,
      g: a.sumG / a.cells,
      b: a.sumB / a.cells,
    });
  }

  const centerCount = Math.min(centers.length, 6) as CubePose["centerCount"];
  return {
    centers,
    centerCount,
    axisX: null,
    axisY: null,
    axisZ: null,
    confidence: centerCount / 6,
  };
};
