"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store/store";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/use-toast";
import {
  detectCubePose,
  FACE_TO_SCAN,
  type CubePose,
  type CubeROI,
  type DetectedCenter,
} from "@/lib/vision/pose-lock";
import {
  calibrateFromCenter,
  classifyColor,
  resetColorCalibration,
  type ScanColor,
} from "@/lib/helpers/classify-scan-color";
import { getCVWorker, type CVWorkerClient, type Pt } from "@/lib/vision/cv-worker-client";
import { sampleFaceGridFromStickers, type FaceGrid } from "@/lib/vision/grid-sampler";
import type { ICubeSide } from "@/types/types";

// ScanColor → 면 라벨 (pose-lock 의 SCAN_TO_FACE 와 동일 매핑).
// 9-grid 정중앙 cell 의 ScanColor 를 면 라벨로 변환할 때 사용.
const SCAN_TO_FACE_LOCAL: Record<ScanColor, ICubeSide> = {
  Y: "U",
  G: "R",
  R: "F",
  W: "D",
  B: "L",
  O: "B",
};

// ScanColor → CSS 표시색. 9-grid cell 색 원 시각화용.
const SCAN_FILL: Record<ScanColor | "X", string> = {
  Y: "#ffd000",
  G: "#00b341",
  R: "#d4423d",
  W: "#ffffff",
  B: "#1b7fff",
  O: "#f96706",
  X: "#444444",
};

// 트래킹 phase 의 자기 캘리브는 신뢰도 게이트로 보호한다. 4면 이상이 동시에 잡혀야
// 큐브가 충분히 보인다고 판단 → false positive 의 self-reinforcement 위험 감소.
const SELF_CALIB_MIN_CENTERS_TRACKING = 4;
// 학습 phase 에선 사용자가 큐브를 회전시키며 한 면씩 보여주므로 1+ 도 학습 신호로 사용.
// 학습 신호는 어차피 "classify→같은 라벨" 게이트가 한 번 더 걸러 self-reinforcement 위험은 낮음.
const SELF_CALIB_MIN_CENTERS_LEARNING = 1;
// 진입 시 색 학습에 할당하는 시간. 사용자가 천천히 큐브 한 바퀴 돌려 6면을 보여주기 충분.
const CALIB_DURATION_MS = 4000;

// frame 처리 해상도. 720p 원본을 그대로 Canny 돌리면 노트북 메인 스레드가 hang.
// 480×270 = 130k px (약 5.3배 가벼움). 큐브 윤곽/색 분류 정확도엔 충분.
const PROC_W = 480;
const PROC_H = 270;
// 처리 throttle — RAF 매 프레임이 아니라 최대 15fps 정도로 제한해 메인 스레드 여유 확보.
const PROC_MIN_INTERVAL_MS = 66;
// ROI sticky 유지 기간. worker 가 이 시간 동안 ROI 못 찾으면 stale 로 간주 → null.
// 1초 = ~15 frame. 큐브 잠깐 가려져도 ROI 유지하되, frame 밖으로 빠진 큐브의 옛 ROI 는 사라짐.
const ROI_STALE_MS = 1000;

// OpenCV.js 디버그 경로. main-thread Canny 가 hang 시키던 문제를 Worker 격리로 해결 (v10 A).
// Worker 가 별도 스레드에서 cvtColor → GaussianBlur → Canny 수행, 결과 edges 만 transferable 로 회신.
const ENABLE_OPENCV_DEBUG = true;

// 검출된 중심을 그릴 색. colorMapThree 와 톤을 맞춤(U=노랑, R=초록, F=빨강, D=흰,
// L=파랑, B=주황). X 는 미사용이지만 record 완전성을 위해 정의.
const FACE_FILL: Record<ICubeSide, string> = {
  U: "#ffd000",
  R: "#00b341",
  F: "#d4423d",
  D: "#ffffff",
  L: "#1b7fff",
  B: "#f96706",
  X: "#000000",
};

const TrackedSolveStage = () => {
  const { deviceId, scanReversed, previewReversed, updateStore } = useAppStore();
  const t = useTranslations();
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const procCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const inited = useRef(false);
  // 처리 throttle 용 마지막 처리 timestamp.
  const lastProcessRef = useRef(0);
  // 학습 phase 의 마감 timestamp. frame loop 가 매 tick 마다 비교해 phase 분기.
  // ref 로 두어 학습 phase 동안 매 프레임 re-render 없이 분기 가능.
  const calibDeadlineRef = useRef<number | null>(null);

  const [streamStarted, setStreamStarted] = useState(false);
  const [pose, setPose] = useState<CubePose | null>(null);
  // 9-grid 정중앙 cell 이 추정한 현재 보이는 면. 상태 라인 표시용.
  const [currentFace, setCurrentFace] = useState<ICubeSide | null>(null);
  // 9 sticker 검출/분류 상태 — 상태 라인을 stickers primary 기준으로 표시 (pose 0/6 대신).
  const [gridState, setGridState] = useState<{ detected: boolean; classified: number }>({
    detected: false,
    classified: 0,
  });
  // UI 표시용 카운트다운(초). null = 학습 종료(트래킹 phase).
  const [calibSecondsLeft, setCalibSecondsLeft] = useState<number | null>(null);
  // OpenCV 로딩 상태. "loading" → "ready" / "failed".
  const [cvStatus, setCvStatus] = useState<"loading" | "ready" | "failed">("loading");
  // OpenCV Worker 핸들 - frame loop 가 ref 로 직접 접근 (re-render 트리거 없이).
  const cvWorkerRef = useRef<CVWorkerClient | null>(null);
  // 마지막 worker 결과 — async 라 매 RAF 마다 최신 결과를 다시 그린다.
  const lastEdgesRef = useRef<{ edges: Uint8Array; width: number; height: number } | null>(null);
  // 마지막 worker ROI — color sampling 을 큐브 영역으로 한정. null 이면 전체 frame.
  const lastROIRef = useRef<CubeROI | null>(null);
  // 마지막 ROI 갱신 timestamp. STALE_MS 이상 지나면 stale 로 보고 ROI 무시 (큐브가 frame 밖으로
  // 나갔는데 sticky 한 옛 ROI 가 계속 sampling 되는 걸 방지).
  const lastROIUpdatedAtRef = useRef(0);
  // 마지막 9 sticker 좌표 + side — worker 의 contour+9-neighbor 산출. 면 색 sampling primary.
  const lastStickersRef = useRef<{ stickers: Pt[]; side: number } | null>(null);
  // sticker 갱신 timestamp — ROI 와 동일하게 STALE_MS 후 stale 처리.
  const lastStickersUpdatedAtRef = useRef(0);
  // 마지막 9-grid sampling 결과 — 9 sticker 색 + 정중앙 cell = 면 anchor.
  const lastGridRef = useRef<FaceGrid | null>(null);
  // 디버그: worker 의 candidate 사각형들 — contour 검출이 어디를 사각형으로 잡는지 overlay 로 확인.
  const lastQuadsRef = useRef<Pt[][] | null>(null);

  // OpenCV.js Worker 기동 — 첫 사용자에게 7MB WASM 다운로드. 캐시 후엔 즉시.
  // Worker 내부에서 importScripts(CDN) → onRuntimeInitialized → "ready" 메시지.
  useEffect(() => {
    if (!ENABLE_OPENCV_DEBUG) {
      setCvStatus("ready"); // OpenCV 미사용 모드에선 UI 가 로딩 메시지 안 띄우게.
      return;
    }
    let cancelled = false;
    const client = getCVWorker();
    cvWorkerRef.current = client;
    client.ready
      .then(() => {
        if (cancelled) return;
        setCvStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setCvStatus("failed");
        toast({
          variant: "destructive",
          title: t("trackedSolve.cvLoadFailed"),
          duration: Infinity,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 카메라 스트림 획득 — scan 스테이지와 동일한 ideal-only 제약 + 폴백 패턴.
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;

    // manual-input 경로로 들어왔으면 분류기 캘리브는 default 상태일 수 있고,
    // scan 경로였더라도 이전 조명에서 학습된 상태일 수 있다. 양쪽 모두에서 깨끗하게 시작.
    resetColorCalibration();

    const fn = async () => {
      const preferred: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { ideal: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(preferred);
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        const videoEl = videoRef.current;
        if (!videoEl) return;
        videoEl.srcObject = stream;
        updateStore({ trackStream: stream });
        await videoEl.play();
      } catch {
        toast({
          variant: "destructive",
          title: t("scan.cameraOpenErrorTitle"),
          description: t("scan.cameraOpenErrorDesc"),
          duration: Infinity,
        });
      }
    };
    fn();
  }, []);

  // overlay 캔버스 위치/크기를 video 의 표시 영역에 동기화. Canny edge 와 색 라벨을
  // 같은 캔버스에 겹쳐 그리므로 위치 동기화는 매 프레임 시작 시 한 번만 한다.
  const syncOverlayLayout = (srcW: number, srcH: number) => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas) return null;
    if (canvas.width !== srcW) canvas.width = srcW;
    if (canvas.height !== srcH) canvas.height = srcH;
    const rect = video.getBoundingClientRect();
    canvas.style.left = `${rect.left}px`;
    canvas.style.top = `${rect.top}px`;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    return canvas.getContext("2d");
  };

  // PoC 디버그: Canny edge 결과를 overlay 에 반투명 cyan 으로 그린다.
  // 큐브 윤곽(스티커 검은 grid)이 잘 잡히는지 확인용. 이후 단계에서 제거 예정.
  const drawCannyEdges = (
    ctx: CanvasRenderingContext2D,
    edgesData: Uint8Array,
    srcW: number,
    srcH: number,
  ) => {
    const img = ctx.createImageData(srcW, srcH);
    for (let i = 0; i < edgesData.length; i++) {
      const out = i * 4;
      if (edgesData[i] > 0) {
        // cyan with 60% alpha.
        img.data[out] = 0;
        img.data[out + 1] = 255;
        img.data[out + 2] = 255;
        img.data[out + 3] = 150;
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  // 디버그: worker 의 candidate 사각형들(approxPolyDP 4-vertex 통과)을 반투명 빨강 외곽선으로 overlay.
  // contour 검출이 큐브 스티커를 사각형으로 잡는지, 손/배경의 false 사각형이 얼마나 끼는지 눈으로 확인.
  // 빨강 사각형이 큐브 스티커에 격자로 모여야 정상 (9-neighbor anchor 가 그 중심을 찾음).
  const drawQuads = (ctx: CanvasRenderingContext2D, quads: Pt[][]) => {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 60, 60, 0.85)";
    ctx.lineWidth = 1.5;
    for (const q of quads) {
      if (q.length < 4) continue;
      ctx.beginPath();
      ctx.moveTo(q[0].x, q[0].y);
      for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].x, q[i].y);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  };

  // worker 가 추정한 큐브 ROI 를 노란 점선 사각형으로 시각화. 색 분류가 이 안만 보고 있음을
  // 사용자(개발자)에게 보여주는 디버그 마커.
  const drawROIBox = (ctx: CanvasRenderingContext2D, roi: CubeROI) => {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 230, 0, 0.95)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(roi.x, roi.y, roi.w, roi.h);
    ctx.restore();
  };

  // 9-grid sampling 시각화 — 9 sticker 중심을 잇는 격자선 + 각 중심에 추정 색 원.
  // 정중앙 cell(idx 4) 은 더 크게 그려 면 anchor 임을 강조 + 추정된 면 라벨(U/R/F/D/L/B) 표기.
  const drawStickerGrid = (ctx: CanvasRenderingContext2D, grid: FaceGrid) => {
    ctx.save();
    const p = grid.centerPx;
    // 인접 sticker 중심 연결선 (행 0-1-2 / 3-4-5 / 6-7-8, 열 0-3-6 / 1-4-7 / 2-5-8).
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let r = 0; r < 3; r++) {
      ctx.moveTo(p[r * 3].x, p[r * 3].y);
      ctx.lineTo(p[r * 3 + 1].x, p[r * 3 + 1].y);
      ctx.lineTo(p[r * 3 + 2].x, p[r * 3 + 2].y);
    }
    for (let c = 0; c < 3; c++) {
      ctx.moveTo(p[c].x, p[c].y);
      ctx.lineTo(p[c + 3].x, p[c + 3].y);
      ctx.lineTo(p[c + 6].x, p[c + 6].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const baseRadius = Math.max(6, grid.cellW * 0.25);
    for (let i = 0; i < 9; i++) {
      const c = grid.cells[i];
      const { x, y } = grid.centerPx[i];
      const isCenter = i === 4;
      const radius = isCenter ? baseRadius * 1.6 : baseRadius;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = SCAN_FILL[c];
      ctx.fill();
      ctx.lineWidth = isCenter ? 2 : 1;
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.stroke();
      if (isCenter && c !== "X") {
        // 면 라벨 텍스트 (검은 글자, 가운데 정렬).
        ctx.fillStyle = "rgba(0,0,0,0.95)";
        ctx.font = `bold ${Math.round(radius)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(SCAN_TO_FACE_LOCAL[c], x, y);
      }
    }
    ctx.restore();
  };

  const drawCenters = (
    ctx: CanvasRenderingContext2D,
    centers: DetectedCenter[],
    srcH: number,
  ) => {
    // 원의 크기는 frame 해상도에 비례 — 720p 기준 약 18px 반지름.
    const radius = Math.max(10, Math.round(srcH / 40));
    for (const c of centers) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = FACE_FILL[c.face];
      ctx.fill();
      ctx.lineWidth = Math.max(2, Math.round(radius / 6));
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.stroke();
      // 면 라벨(U/R/F/D/L/B) 텍스트.
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.font = `bold ${radius}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(c.face, c.x, c.y);
    }
  };

  // 매 프레임 캔버스에 그려 ImageData 를 detectCubePose 로 전달.
  const startFrameLoop = () => {
    const tick = () => {
      // 처리 throttle — RAF 는 매 frame 호출되지만 무거운 처리는 PROC_MIN_INTERVAL_MS 마다.
      const now = performance.now();
      if (now - lastProcessRef.current < PROC_MIN_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastProcessRef.current = now;

      const video = videoRef.current;
      const procCanvas = procCanvasRef.current;
      if (video && procCanvas && video.readyState >= 2) {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          // 처리 해상도 고정 — video 를 PROC_W × PROC_H 로 다운스케일 후 모든 처리는 그 좌표계.
          if (procCanvas.width !== PROC_W) procCanvas.width = PROC_W;
          if (procCanvas.height !== PROC_H) procCanvas.height = PROC_H;
          const w = PROC_W;
          const h = PROC_H;
          // willReadFrequently: 매 frame getImageData 를 두 번 (color + worker) 호출하므로
          // CPU-backed 캔버스를 명시 → 브라우저가 readback 최적화 적용.
          const ctx = procCanvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const frame = ctx.getImageData(0, 0, w, h);
            // ROI 가 잡혀 있으면 그 안만 sampling — 손/벽/모니터 색 잡음 차단.
            const detected = detectCubePose(frame, lastROIRef.current);
            const overlayCtx = syncOverlayLayout(w, h);
            if (overlayCtx) overlayCtx.clearRect(0, 0, w, h);
            // OpenCV Worker: ready 이고 in-flight 가 아니면 frame 별도 copy 를 transfer.
            // 결과는 비동기로 lastEdgesRef/lastROIRef 에 도착 — 매 RAF 마다 그 최신본을 사용/렌더.
            // (직전 worker round-trip 동안 새 frame 은 drop = back-pressure.)
            const cvWorker = ENABLE_OPENCV_DEBUG ? cvWorkerRef.current : null;
            if (cvWorker) {
              const cvFrame = ctx.getImageData(0, 0, w, h);
              void cvWorker.computeEdges(cvFrame).then((result) => {
                if (!result) return;
                lastEdgesRef.current = result;
                // 디버그 candidate 사각형 — DEBUG_QUADS off 면 quads == null → overlay 안 그림.
                lastQuadsRef.current = result.quads;
                // stickers/ROI 는 짧은 시간 sticky — worker 가 한 frame 못 찾아도 즉시 사라지지 않음.
                // STALE_MS 이상 갱신 없으면 stale 판정 (tick 안에서 timestamp 검사).
                if (result.stickers && result.stickers.length === 9) {
                  lastStickersRef.current = { stickers: result.stickers, side: result.side };
                  lastStickersUpdatedAtRef.current = performance.now();
                }
                if (result.roi) {
                  lastROIRef.current = result.roi;
                  lastROIUpdatedAtRef.current = performance.now();
                }
              });
            }
            const lastEdges = lastEdgesRef.current;
            if (overlayCtx && lastEdges && lastEdges.width === w && lastEdges.height === h) {
              drawCannyEdges(overlayCtx, lastEdges.edges, w, h);
            }
            // 디버그 quads overlay — Canny edge 위에 candidate 사각형을 빨강 외곽선으로 덮어
            // contour 검출이 큐브 스티커를 잡는지 표시 (cyan edge + red quads 겹쳐 보임).
            const lastQuads = lastQuadsRef.current;
            if (overlayCtx && lastQuads) {
              drawQuads(overlayCtx, lastQuads);
            }
            // Phase 2a: stickers 가 있으면 9 sticker 좌표로 직접 sampling → 면 중심 anchor (primary).
            // stickers 가 없거나 stale 이면 기존 connected-component centroid 시각화 (fallback).
            const now2 = performance.now();
            const stickersFresh =
              now2 - lastStickersUpdatedAtRef.current <= ROI_STALE_MS
                ? lastStickersRef.current
                : null;
            const roi = now2 - lastROIUpdatedAtRef.current > ROI_STALE_MS ? null : lastROIRef.current;
            if (overlayCtx && roi) {
              drawROIBox(overlayCtx, roi);
            }
            if (stickersFresh) {
              const grid = sampleFaceGridFromStickers(
                frame,
                stickersFresh.stickers,
                stickersFresh.side,
              );
              lastGridRef.current = grid;
              if (grid && overlayCtx) drawStickerGrid(overlayCtx, grid);
              // 상태 라인 — 9칸 중 분류된 수. 매 tick setState 지만 변화 없으면 prev 반환 (re-render 억제).
              const classified = grid ? grid.cells.filter((c) => c !== "X").length : 0;
              setGridState((prev) =>
                prev.detected && prev.classified === classified
                  ? prev
                  : { detected: true, classified },
              );
              if (grid && grid.cells[4] !== "X") {
                // 자기 캘리브: 정중앙 sticker(idx 4) 의 RGB 평균이 같은 라벨로 재분류되면 EMA 학습.
                // sticker 중심 둘레만 샘플한 평균이라 검은 grid line 회피 → connected-component
                // centroid 보다 잡음에 강함 → 게이트 단순화 (centerCount 없음).
                const known = grid.cells[4];
                const { r, g, b } = grid.rgb[4];
                if (classifyColor(r, g, b) === known) {
                  calibrateFromCenter(known, r, g, b);
                }
                setCurrentFace((prev) => {
                  const next = SCAN_TO_FACE_LOCAL[known];
                  return prev === next ? prev : next;
                });
              } else {
                setCurrentFace((prev) => (prev === null ? prev : null));
              }
            } else {
              // stickers stale — 상태 라인 검출 표시 해제 (fallback centers 로 표시 전환).
              setGridState((prev) => (prev.detected ? { detected: false, classified: 0 } : prev));
              setCurrentFace((prev) => (prev === null ? prev : null));
            }
            if (detected) {
              setPose(detected);
            }
            if (!stickersFresh && detected) {
              // ROI 미검출 fallback: connected-component centroids 시각화 + 학습.
              if (overlayCtx) drawCenters(overlayCtx, detected.centers, h);
              const learning =
                calibDeadlineRef.current !== null && Date.now() < calibDeadlineRef.current;
              const minCenters = learning
                ? SELF_CALIB_MIN_CENTERS_LEARNING
                : SELF_CALIB_MIN_CENTERS_TRACKING;
              if (detected.centerCount >= minCenters) {
                for (const c of detected.centers) {
                  if (c.face === "X") continue;
                  const known = FACE_TO_SCAN[c.face as Exclude<ICubeSide, "X">];
                  if (classifyColor(c.r, c.g, c.b) === known) {
                    calibrateFromCenter(known, c.r, c.g, c.b);
                  }
                }
              }
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const onVideoCanPlay = () => {
    setStreamStarted(true);
    // 비디오 준비된 시점부터 학습 phase 시작 — 처음부터 detection 안 돌면 시간 낭비.
    if (calibDeadlineRef.current === null) {
      calibDeadlineRef.current = Date.now() + CALIB_DURATION_MS;
      setCalibSecondsLeft(Math.ceil(CALIB_DURATION_MS / 1000));
    }
    if (rafRef.current === null) startFrameLoop();
  };

  // 학습 phase 카운트다운 — 1초 간격으로 줄이고 0 이 되면 학습 종료.
  useEffect(() => {
    if (calibSecondsLeft === null) return;
    if (calibSecondsLeft <= 0) {
      setCalibSecondsLeft(null);
      return;
    }
    const id = window.setTimeout(() => {
      setCalibSecondsLeft((s) => (s === null ? null : s - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [calibSecondsLeft]);

  const onExit = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const stream = useAppStore.getState().trackStream;
    stream?.getTracks().forEach((t) => t.stop());
    // Worker 는 명시 terminate — 다시 진입할 때 새로 띄우면 됨 (캐시된 WASM 으로 즉시).
    cvWorkerRef.current?.terminate();
    cvWorkerRef.current = null;
    lastEdgesRef.current = null;
    lastROIRef.current = null;
    lastStickersRef.current = null;
    lastQuadsRef.current = null;
    lastGridRef.current = null;
    updateStore({ trackStream: null, currentAppStage: "homepage", trackedSolve: false });
  };

  const mirrorClass = scanReversed || previewReversed ? "-scale-x-100" : undefined;

  return (
    <div>
      <button
        onClick={onExit}
        className="fixed top-4 left-4 z-50 rounded-md bg-black/60 px-3 py-1.5 text-sm text-white/90 backdrop-blur-sm hover:bg-black/75 transition-colors"
      >
        {t("common.back")}
      </button>
      <div className="flex w-screen h-screen relative items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={mirrorClass}
          onCanPlay={onVideoCanPlay}
        />
        {/* 오버레이 캔버스: 매 프레임 video 표시 영역에 맞춰 위치/크기 동기화. */}
        <canvas
          ref={overlayCanvasRef}
          className={`fixed pointer-events-none ${mirrorClass ?? ""}`}
        />
        {streamStarted && calibSecondsLeft !== null && (
          <div className="absolute top-20 left-0 right-0 flex flex-col items-center gap-2 text-white pointer-events-none z-10">
            <div className="rounded-md bg-emerald-700/85 px-4 py-2 text-sm backdrop-blur-sm shadow-lg">
              {t("trackedSolve.calibrating")}
            </div>
            <div className="rounded-md bg-black/60 px-3 py-1 text-xs font-mono backdrop-blur-sm">
              {t("trackedSolve.calibCountdown", { seconds: calibSecondsLeft })}
            </div>
          </div>
        )}
        {streamStarted && (
          <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 text-white/90 pointer-events-none z-10">
            <div className="rounded-md bg-black/60 px-3 py-1.5 text-sm backdrop-blur-sm">
              {t("trackedSolve.title")}
            </div>
            <div className="rounded-md bg-black/60 px-3 py-1.5 text-xs font-mono backdrop-blur-sm">
              face: {currentFace ?? "—"} ·{" "}
              {gridState.detected
                ? `grid: ${gridState.classified}/9`
                : `centers: ${pose?.centerCount ?? 0}/6`}{" "}
              · cv: {cvStatus}
            </div>
          </div>
        )}
        {cvStatus === "loading" && (
          <div className="absolute top-4 right-4 z-10 rounded-md bg-black/60 px-3 py-1.5 text-xs text-white/90 backdrop-blur-sm pointer-events-none">
            {t("trackedSolve.loadingCV")}
          </div>
        )}
      </div>
      {/* 처리용 hidden 캔버스 — getImageData 전용. */}
      <canvas ref={procCanvasRef} className="hidden" />
    </div>
  );
};

export default TrackedSolveStage;
