// 큐브 한 면의 9 sticker 좌표(worker 의 contour+9-neighbor 산출)에서 각 sticker 색을 추출한다.
// Phase 2a 의 핵심 — 색 connected-component centroid 로는 *섞인 큐브의 중심 sticker* 가
// 항상 가장 큰 blob 이라는 보장이 없어 anchor 가 흔들렸음. 9-neighbor 는 면 중심 스티커를
// 구조 제약(8 이웃)으로 직접 찾아 9 좌표를 산출 → 정중앙(idx 4) cell 이 곧 면 중심 anchor.
//
// 이전 버전은 ROI bbox 를 3×3 균등분할로 추정했음(perspective 무시). 이제 worker 가 보낸
// 9 sticker 중심을 직접 받아 그 둘레만 샘플 → bbox 균등분할 가정 폐기, 정확도 향상.

import { classifyColor, type ScanColor } from "../helpers/classify-scan-color";

export type FaceGrid = {
  /** 9 cell 의 추정 색. row-major (idx 0=좌상, 4=중앙, 8=우하). "X" 는 미분류. */
  cells: (ScanColor | "X")[];
  /** 9 cell 의 sample 영역 평균 RGB. */
  rgb: { r: number; g: number; b: number }[];
  /** 각 cell 의 중심 (frame 좌표 px). 시각화/디버그용. */
  centerPx: { x: number; y: number }[];
  /** 시각화용 cell 크기 (sticker side 에서 파생). */
  cellW: number;
  cellH: number;
};

// sticker 중심 둘레 side*RATIO 반경의 정사각만 평균 — 검은 grid line/이웃 sticker 침범 회피.
// 0.3 → 변 길이 0.6×side 영역. 너무 작으면 노이즈, 너무 크면 grid line 픽셀이 평균 왜곡.
const SAMPLE_HALF_RATIO = 0.3;
// max(r,g,b) 이 이 미만인 픽셀은 평균서 제외 — 흰 sticker 중앙 루빅스 로고(검은 인쇄),
// 검은 grid line, 그림자 outlier 차단. 큐브 6색(W/Y/R/O/G/B)은 전부 한 채널 이상 밝아 통과.
const DARK_CUTOFF = 55;

export const sampleFaceGridFromStickers = (
  frame: ImageData,
  stickers: { x: number; y: number }[],
  side: number,
): FaceGrid | null => {
  if (stickers.length !== 9 || side <= 0) return null;
  const { data, width, height } = frame;
  const half = Math.max(1, side * SAMPLE_HALF_RATIO);

  const cells: (ScanColor | "X")[] = new Array(9).fill("X");
  const rgb: FaceGrid["rgb"] = new Array(9);
  const centerPx: FaceGrid["centerPx"] = new Array(9);

  for (let i = 0; i < 9; i++) {
    const cx = stickers[i].x;
    const cy = stickers[i].y;
    // sampling 영역을 frame 경계에 맞춰 clip — sticker 가 frame 가장자리에 닿아도 안전.
    const sx0 = Math.max(0, Math.floor(cx - half));
    const sy0 = Math.max(0, Math.floor(cy - half));
    const sx1 = Math.min(width, Math.ceil(cx + half));
    const sy1 = Math.min(height, Math.ceil(cy + half));

    // 밝은 픽셀(sum*/cnt)과 전체 픽셀(sum*All/cntAll) 둘 다 누적 — 밝은 픽셀 없으면 전체로 fallback.
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;
    let sumRAll = 0;
    let sumGAll = 0;
    let sumBAll = 0;
    let countAll = 0;
    for (let y = sy0; y < sy1; y++) {
      const rowOff = y * width;
      for (let x = sx0; x < sx1; x++) {
        const idx = (rowOff + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        sumRAll += r;
        sumGAll += g;
        sumBAll += b;
        countAll++;
        // 로고/grid line/그림자(어두운 픽셀) 제외 — sticker 본색만 평균.
        if (r >= DARK_CUTOFF || g >= DARK_CUTOFF || b >= DARK_CUTOFF) {
          sumR += r;
          sumG += g;
          sumB += b;
          count++;
        }
      }
    }

    centerPx[i] = { x: cx, y: cy };
    if (countAll === 0) {
      rgb[i] = { r: 0, g: 0, b: 0 };
      cells[i] = "X";
    } else {
      // 밝은 픽셀이 하나라도 있으면 그 평균(로고 제거), 아니면 전체 평균(진짜 어두운 영역 → X 분류).
      const n = count > 0 ? count : countAll;
      const r = (count > 0 ? sumR : sumRAll) / n;
      const g = (count > 0 ? sumG : sumGAll) / n;
      const b = (count > 0 ? sumB : sumBAll) / n;
      rgb[i] = { r, g, b };
      cells[i] = classifyColor(r, g, b);
    }
  }

  return { cells, rgb, centerPx, cellW: side, cellH: side };
};
