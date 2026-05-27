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
} from "@/lib/helpers/classify-scan-color";
import { getCVWorker, type CVWorkerClient } from "@/lib/vision/cv-worker-client";
import type { ICubeSide } from "@/types/types";

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
                // ROI 는 sticky — worker 가 한 프레임 못 찾아도 직전 ROI 유지 (잠깐 가려진 경우 대비).
                // 큐브가 화면을 벗어나도 마지막 ROI 가 그대로지만, 그 영역엔 어차피 큐브 색이 없어
                // sampling 결과가 비게 되므로 큰 부작용 없음.
                if (result.roi) lastROIRef.current = result.roi;
              });
            }
            const lastEdges = lastEdgesRef.current;
            if (overlayCtx && lastEdges && lastEdges.width === w && lastEdges.height === h) {
              drawCannyEdges(overlayCtx, lastEdges.edges, w, h);
            }
            if (overlayCtx && lastROIRef.current) {
              drawROIBox(overlayCtx, lastROIRef.current);
            }
            if (detected) {
              setPose(detected);
              if (overlayCtx) drawCenters(overlayCtx, detected.centers, h);
              // 자기 캘리브: 검출된 면이 충분히 많을 때만, 그리고 픽셀 평균을 다시
              // classify 해서 같은 라벨이 나올 때만 EMA 갱신 (use-get-scanned-colors 와 동일 패턴).
              // 학습 phase 동안은 게이트를 낮춰 큐브를 한 면씩 보여줄 때도 학습 신호 흡수.
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
              centers: {pose?.centerCount ?? 0} / 6 · confidence:{" "}
              {pose ? pose.confidence.toFixed(2) : "—"} · cv: {cvStatus}
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
