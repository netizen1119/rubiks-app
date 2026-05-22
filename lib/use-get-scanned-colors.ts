"use client";

import { scannedColorToSide } from "@/lib/maps/color-scan-map";
import { reverseCord } from "@/lib/helpers/helper";
import { cube_sides_scan } from "@/lib/maps/cube";
import { calibrateFromCenter, classifyColor, ScanColor } from "@/lib/helpers/classify-scan-color";
import { useAppStore } from "@/lib/store/store";
import { IScanResult } from "@/types/types";
import { useCallback } from "react";

interface IProps {
  video: HTMLVideoElement | undefined;
  canvas: HTMLCanvasElement | undefined;
}

// 면(side) → 스캔 색 라벨. 센터 색 캘리브레이션에 사용.
const sideToScanColor: Record<string, ScanColor> = { D: "W", U: "Y", R: "G", L: "B", F: "R", B: "O" };

// 캡처 시 좌우(열) 미러 반전 여부. 프리뷰 셀카 반전(scanReversed)과 분리.
// raw 프레임이 환경마다 이미 미러돼 올 수 있어, 여기서 항상 raw 열을 그대로 쓰고(=false)
// 풀리는 배치를 기준으로 둔다. 좌우가 거꾸로면 이 값만 true 로 토글.
const MIRROR_SAMPLE_COLUMNS = false;

// 채널별 중앙값 — 패치 안의 노이즈/광택(highlight) 이상치에 강함.
const median = (arr: number[]) => {
  arr.sort((a, b) => a - b);
  const mid = arr.length >> 1;
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
};

export const useGetScannedColors = ({ canvas, video }: IProps) => {
  const scanSize = useAppStore((s) => s.scanSize);

  const getScannedColors = useCallback((): IScanResult => {
    if (!canvas || !video) return [];

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return [];
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(video, 0, 0);

    const calculatedScanSize = scanSize * (width / window.innerWidth);
    const offset = 3;
    const spacing = calculatedScanSize / 3 - offset;
    const startX = width / 2 - spacing + offset / 2;
    const startY = height / 2 - spacing + offset / 2;

    // 셀당 단일 픽셀 대신 정사각형 패치의 채널별 중앙값을 표본으로 사용.
    const half = Math.max(4, Math.min(18, Math.round(spacing * 0.16)));
    const sampleRGB = (cx: number, cy: number): [number, number, number] => {
      const x0 = Math.max(0, Math.round(cx - half));
      const y0 = Math.max(0, Math.round(cy - half));
      const w = Math.min(width - x0, half * 2);
      const h = Math.min(height - y0, half * 2);
      if (w <= 0 || h <= 0) return [0, 0, 0];
      const { data } = ctx.getImageData(x0, y0, w, h);
      const rs: number[] = [];
      const gs: number[] = [];
      const bs: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        rs.push(data[i]);
        gs.push(data[i + 1]);
        bs.push(data[i + 2]);
      }
      return [median(rs), median(gs), median(bs)];
    };

    // 1) 9칸 RGB 표본 수집 (좌상→우하).
    const rgb: [number, number, number][] = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        rgb.push(sampleRGB(startX + x * spacing, startY + y * spacing));
      }
    }

    // 2) 현재 면의 센터(=알려진 색)로 캘리브레이션. 미러와 무관하게 중앙은 인덱스 4.
    // 단, 센터가 이미 기대 색으로 분류될 때만 보정한다 — 회전 중/엉뚱한 면 프레임이
    // 기준 Hue 를 끌어당겨 오염시키는 것을 방지(자동 전진과 함께 중요).
    const currentScanFace = useAppStore.getState().currentScanFace;
    if (currentScanFace !== null && currentScanFace > -1) {
      const known = sideToScanColor[cube_sides_scan[currentScanFace]];
      if (known && classifyColor(...rgb[4]) === known) calibrateFromCenter(known, ...rgb[4]);
    }

    // 3) 분류 + (필요 시) 좌우 미러 좌표 재매핑.
    const colors: IScanResult = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const [r, g, b] = rgb[x + y * 3];
        const scanColor = classifyColor(r, g, b);
        const mappedSide = scanColor !== "X" ? scannedColorToSide[scanColor] || "X" : "X";
        const obj: IScanResult[number] = {
          scanData: new Uint8ClampedArray([r, g, b, 255]),
          destSide: mappedSide,
        };
        colors[(MIRROR_SAMPLE_COLUMNS ? reverseCord[x] : x) + y * 3] = obj;
      }
    }

    return colors;
  }, [canvas, video, scanSize]);

  return getScannedColors;
};
