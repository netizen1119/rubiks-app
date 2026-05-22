import { cube_sides_scan } from "./maps/cube";
import { useAppStore } from "@/lib/store/store";
import { ICubeSide, IScanResult } from "@/types/types";
import { useEffect, useRef } from "react";

interface IProps {
  getScannedColors: () => IScanResult;
}

// 자동 캡처 파라미터.
const SCAN_INTERVAL_MS = 350;
// 최근 유효 프레임을 이만큼 모아 칸별 다수결 → 깜빡임에 강함.
const VOTE_WINDOW = 4;
// 각 칸의 최다 색이 윈도우의 과반(> WINDOW/2)일 때만 캡처(decisive).
// 캡처 후 다음 면으로 돌리는 동안 재캡처를 막는 시간.
const CAPTURE_COOLDOWN_MS = 1200;

// 디버그 오버레이가 읽는 자동 캡처 상태(리렌더 무관 모듈 싱글톤).
export type AutoScanDebug = {
  face: number | null;
  valid: boolean;
  hasX: boolean;
  centerMatch: boolean;
  progress: number;
  window: number;
};
let autoDebug: AutoScanDebug = {
  face: null,
  valid: false,
  hasX: false,
  centerMatch: false,
  progress: 0,
  window: VOTE_WINDOW,
};
export const getScanAutoDebug = () => autoDebug;

export const useScanRefresh = ({ getScannedColors }: IProps) => {
  const [isScanRefreshing, updateCubeSide, updateCubeScan, currentScanFace, updateStore] = useAppStore((s) => [
    s.isScanRefreshing,
    s.updateCubeSide,
    s.updateCubeScan,
    s.currentScanFace,
    s.updateStore,
  ]);

  // 최근 유효 프레임 버퍼 + 쿨다운 — 리렌더 무관하게 유지.
  const frames = useRef<ICubeSide[][]>([]);
  const cooldownUntil = useRef(0);

  useEffect(() => {
    if (!isScanRefreshing) return;

    const interval = setInterval(() => {
      const scannedData = getScannedColors();
      updateStore({ lastScanResult: scannedData.map((scanData) => ({ ...scanData, id: Math.random() })) });

      if (currentScanFace === null || currentScanFace === -1) return;

      const expectedSide = cube_sides_scan[currentScanFace];
      const labels = scannedData.map((d) => d.destSide);

      // 화면 큐브에 실시간 반영.
      updateCubeSide(expectedSide, labels);

      // ── 자동 캡처: 유효 프레임을 모아 칸별 다수결이 확정되면 다음 면으로 전진 ──
      const now = Date.now();
      const hasX = labels.includes("X");
      const centerMatch = labels[4] === expectedSide; // 올바른 면이 정면인지
      const valid = labels.length === 9 && !hasX && centerMatch;

      if (now < cooldownUntil.current || !valid) {
        frames.current = [];
      } else {
        frames.current.push(labels);
        if (frames.current.length > VOTE_WINDOW) frames.current.shift();

        if (frames.current.length >= VOTE_WINDOW) {
          const voted: ICubeSide[] = [];
          let decisive = true;
          for (let i = 0; i < 9; i++) {
            const counts = new Map<ICubeSide, number>();
            for (const f of frames.current) counts.set(f[i], (counts.get(f[i]) || 0) + 1);
            let bestSide = labels[i];
            let bestN = 0;
            counts.forEach((n, side) => {
              if (n > bestN) {
                bestN = n;
                bestSide = side;
              }
            });
            voted.push(bestSide);
            if (bestN * 2 <= VOTE_WINDOW) decisive = false; // 과반 미달 칸 있으면 보류
          }

          if (decisive) {
            const result: IScanResult = scannedData.map((d, i) => ({ scanData: d.scanData, destSide: voted[i] }));
            // 캡처 방향 그대로 9칸을 면별로 저장 → 풀기 시 auto-orient 가 회전 보정.
            const prev = useAppStore.getState().scannedFaces;
            updateStore({ scannedFaces: { ...prev, [expectedSide]: voted } });
            // 현재 면 확정 + 고스트 애니메이션 + 다음 면으로 카메라/시퀀스 전진.
            updateCubeScan(result);
            frames.current = [];
            cooldownUntil.current = now + CAPTURE_COOLDOWN_MS;
          }
        }
      }

      autoDebug = {
        face: currentScanFace,
        valid,
        hasX,
        centerMatch,
        progress: frames.current.length,
        window: VOTE_WINDOW,
      };
    }, SCAN_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [isScanRefreshing, getScannedColors, currentScanFace, updateCubeSide, updateCubeScan, updateStore]);
};
