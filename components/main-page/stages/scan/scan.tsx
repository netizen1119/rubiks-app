"use client";

import { useScanRefresh } from "@/lib/use-scan-refresh";
import React, { useEffect, useRef, useState } from "react";
import { useGetScannedColors } from "../../../../lib/use-get-scanned-colors";
import { resetColorCalibration } from "@/lib/helpers/classify-scan-color";
import DevScanResultPreview from "@/components/devtools/scan-result-preview";
import { useAppStore } from "@/lib/store/store";
import { motion } from "framer-motion";
import ScanCard from "./card";
import { useToast } from "@/components/ui/use-toast";

const ScanCubeStage = () => {
  const [video, setVideo] = useState<HTMLVideoElement>();
  const [canvas, setCanvas] = useState<HTMLCanvasElement>();
  const [streamStared, setStreamStarted] = useState(false);

  const { scanReversed, previewReversed, scanSize, deviceId, updateCubeScan, updateStore } = useAppStore();
  const { toast } = useToast();

  const getScannedColors = useGetScannedColors({ video, canvas });
  useScanRefresh({ getScannedColors });

  const inited = useRef(false);

  useEffect(() => {
    if (inited.current) return;
    inited.current = true;

    // 스캔을 처음(F면)부터 다시 시작할 수 있도록 면 인덱스를 리셋.
    // (완료 후 currentScanFace 가 null 로 남아 재진입 시 시퀀스가 멈추던 문제 방지)
    updateStore({ currentScanFace: -1, scannedFaces: {} });
    // 색 캘리브레이션도 초기화 — 직전 세션 조명 보정값이 새 스캔에 새지 않도록.
    resetColorCalibration();

    const videoEl = document.querySelector("video") as HTMLVideoElement;
    const canvasEl = document.querySelector("#canvas-scan") as HTMLCanvasElement;

    setVideo(videoEl);
    setCanvas(canvasEl);

    const fn = async () => {
      // 제약은 ideal 로만 — exact(height 1280 / 9:16)는 일반 웹캠/데스크탑에서
      // OverconstrainedError 로 실패해 영상이 안 뜨던 원인. 실패 시 단순 제약으로 폴백.
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
        videoEl.srcObject = stream;
        // 단계 이탈 시 카메라를 끌 수 있도록 스트림 보관.
        updateStore({ scanStream: stream });
        await videoEl.play();
      } catch (err) {
        toast({
          variant: "destructive",
          title: "카메라를 열 수 없습니다",
          description: "카메라 권한, 그리고 다른 앱이 카메라를 쓰고 있지 않은지 확인해주세요.",
          duration: Infinity,
        });
      }
    };

    fn();
  }, []);

  const onVideoCanPlay = () => {
    setStreamStarted(true);
    if (!streamStared) {
      updateStore({ isScanRefreshing: true });
      updateCubeScan([]);
    }
  };

  // 스캔 화면에서 나갈 때 카메라 스트림을 정지하고 deviceselect 로 복귀.
  const onBack = () => {
    const stream = useAppStore.getState().scanStream;
    stream?.getTracks().forEach((t) => t.stop());
    updateStore({ scanStream: null, isScanRefreshing: false, currentAppStage: "deviceselect" });
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="fixed top-4 left-4 z-50 rounded-md bg-black/60 px-3 py-1.5 text-sm text-white/90 backdrop-blur-sm hover:bg-black/75 transition-colors"
      >
        ← 뒤로
      </button>
      <motion.div
        className="flex w-screen h-screen relative  items-center justify-center"
        initial={{ opacity: 0 }}
        animate={streamStared ? { opacity: 1, transition: { delay: 0.5 } } : { opacity: 0 }}
        exit={{ opacity: 0 }}
      >
        <motion.video
          autoPlay
          className={scanReversed || previewReversed ? "-scale-x-100" : undefined}
          onCanPlay={onVideoCanPlay}
          playsInline
        />
        <ScanCard />
        {streamStared && (
          <div
            className="absolute grid grid-cols-3 grid-rows-3 [&_div]:border-2 [&_div]:border-zinc-900 rounded-lg border-2 border-zinc-900 border-collapse overflow-hidden opacity-70"
            style={{ width: `${scanSize}px`, height: `${scanSize}px` }}
          >
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
          </div>
        )}
      </motion.div>

      <canvas id="canvas-scan" className="hidden" />

      {process.env.NEXT_PUBLIC_DEV_MODE === "true" && streamStared && <DevScanResultPreview />}
    </div>
  );
};

ScanCubeStage.displayName = "ScanCubeStage";

export default ScanCubeStage;
