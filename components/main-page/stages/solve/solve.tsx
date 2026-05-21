"use client";

import { CubePosAnchor } from "@/components/cube-visualization/cube-pos-anchor";
import { THREE_HEIGHT, THREE_WIDTH } from "@/components/cube-visualization/cube-three";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cameraPositions } from "@/lib/maps/camera-positions";
import { useAppStore } from "@/lib/store/store";
import { useEffect, useRef, useState } from "react";
import StageProgress from "./stage-progress";
import MoveGuide from "./move-guide";
import StageInfo from "./stage-info";
import SolveStats from "./stats";
import gsap from "gsap";

const SPEED_OPTIONS = [0.5, 1, 1.5, 2, 3] as const;
type Speed = (typeof SPEED_OPTIONS)[number];
const BASE_TICK_MS = 450; // 1x 기준 tick 간격 (각 회전 phase 소요 ~0.4s + 버퍼)

const SolveCubeStage = () => {
  const {
    updateStore,
    initSolveCube,
    updateCameraPos,
    cubeSolutionStep,
    cubeSolution,
    nextCubeSolveStep,
    prevCubeSolveStep,
    solveMode,
  } = useAppStore();
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  // 빠른 모드는 풀이를 빨리 훑어보려는 사용자가 대상이라 기본 속도를 높게.
  const [speed, setSpeed] = useState<Speed>(() =>
    useAppStore.getState().solveMode === "fast" ? 2 : 1
  );

  const inited = useRef(false);
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;

    updateStore({ cubeScale: 1 });

    // 메인 vis rubiksGroup 의 진행 중 Y축 자동 회전(및 어떤 gsap 트윈이든)을 즉시
    // 정지하고 회전값을 (0,0,0)으로 스냅. 점진적 감속 도중에 레이어 회전이 시작되면
    // 회전된 큐비(scene 으로 detach)와 남은 큐비(rubiksGroup 내) 사이에 누적 회전이
    // 어긋나 큐브 구조가 깨진다.
    const state = useAppStore.getState();
    if (state.cubeSpinningTimeline.current) {
      state.cubeSpinningTimeline.current.kill();
      state.cubeSpinningTimeline.current = null;
    }
    gsap.killTweensOf(state.objects.current.rubiksGroup.rotation);
    state.objects.current.rubiksGroup.rotation.set(0, 0, 0);

    try {
      initSolveCube();
      updateCameraPos(cameraPositions.F);
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to generate cube solution - cube scan may be incorrect",
        title: "Error",
        duration: Infinity,
      });
    }
  }, []);

  // 빈 영역 드래그로 시점 회전 + release 시 원위치 복귀. initSolveCube 와 분리해서
  // inited 가드 없이 idempotent setup → StrictMode dev 이중호출에 안전.
  useEffect(() => {
    const state = useAppStore.getState();
    const canvas = state.mainCanvas.current;
    const orbit = state.orbitControls.current;
    const camera = state.camera.current;
    if (!canvas || !orbit) return;

    const prevPointerEvents = canvas.style.pointerEvents;
    canvas.style.pointerEvents = "auto";
    const prevTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    const prevOrbitEnabled = orbit.enabled;
    orbit.enabled = true;

    // updateCameraPos 이 gsap 으로 카메라를 움직이므로, 그 완료 후의 위치를 "원위치"
    // 로 삼아야 한다. 약간의 지연 후 캡처.
    let originalCameraPos = camera.position.clone();
    const captureTimer = setTimeout(() => {
      originalCameraPos = camera.position.clone();
    }, 700);

    const onOrbitStart = () => {
      gsap.killTweensOf(camera.position);
    };
    const onOrbitEnd = () => {
      gsap.killTweensOf(camera.position);
      gsap.to(camera.position, {
        x: originalCameraPos.x,
        y: originalCameraPos.y,
        z: originalCameraPos.z,
        duration: 0.6,
        ease: "power2.inOut",
        onUpdate: () => camera.lookAt(0, 0, 0),
      });
    };
    orbit.addEventListener("start", onOrbitStart);
    orbit.addEventListener("end", onOrbitEnd);

    return () => {
      clearTimeout(captureTimer);
      canvas.style.pointerEvents = prevPointerEvents;
      canvas.style.touchAction = prevTouchAction;
      orbit.removeEventListener("start", onOrbitStart);
      orbit.removeEventListener("end", onOrbitEnd);
      orbit.enabled = prevOrbitEnabled;
      gsap.killTweensOf(camera.position);
    };
  }, []);

  const finished = cubeSolutionStep === null;
  // Undo 가능 조건: 진행 중이면 step > 0, 완료 상태면 solution 이 비지 않았을 때.
  const canUndo = finished
    ? cubeSolution.length > 0
    : (cubeSolutionStep ?? 0) > 0;

  // 자동 재생: 일정 간격으로 nextCubeSolveStep 호출.
  // 각 호출 = 1 phase (preview 또는 commit). isDuringRotation 가드로 안전.
  // 완료(cubeSolutionStep === null)되면 자동 정지.
  useEffect(() => {
    if (!isPlaying) return;
    if (finished) {
      setIsPlaying(false);
      return;
    }
    const intervalMs = BASE_TICK_MS / speed;
    const id = setInterval(() => {
      const st = useAppStore.getState();
      if (st.cubeSolutionStep === null) {
        setIsPlaying(false);
        return;
      }
      st.nextCubeSolveStep();
    }, intervalMs);
    return () => clearInterval(id);
  }, [isPlaying, speed, finished]);

  return (
    <div
      className="w-full h-full flex justify-center items-center flex-col gap-3"
      style={{ animation: "fade-in 0.4s ease-out" }}
    >
      <div className="flex items-center gap-2">
        <span
          className={
            "px-2 py-0.5 rounded-full text-[0.7rem] font-medium " +
            (solveMode === "fast"
              ? "bg-amber-500/15 text-amber-400"
              : "bg-emerald-500/15 text-emerald-400")
          }
        >
          {solveMode === "fast"
            ? `⚡ 빠른 풀이 · ${cubeSolution.length}수`
            : `📚 차근차근 · ${cubeSolution.length}수`}
        </span>
      </div>

      <StageProgress />

      <div
        className="flex items-center justify-center"
        style={{ width: `${THREE_WIDTH}px`, height: `${THREE_HEIGHT - 160}px` }}
      >
        <CubePosAnchor />
      </div>

      <MoveGuide />

      <SolveStats />

      <StageInfo />

      <div className="flex items-center gap-2" style={{ width: `${THREE_WIDTH - 160}px` }}>
        <Button
          variant="secondary"
          onClick={() => prevCubeSolveStep()}
          disabled={!canUndo}
          className="px-3"
        >
          ← 이전
        </Button>
        <Button
          onClick={() => nextCubeSolveStep()}
          disabled={finished}
          className="flex-1"
        >
          {finished ? "완료" : "다음 이동 →"}
        </Button>
      </div>

      {/* 자동 재생 컨트롤 */}
      <div
        className="flex items-center gap-3 text-xs text-muted-foreground"
        style={{ width: `${THREE_WIDTH - 160}px` }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsPlaying((p) => !p)}
          disabled={finished}
          className="px-2"
        >
          {isPlaying ? "⏸ 일시정지" : "▶ 자동 재생"}
        </Button>
        <div className="flex items-center gap-1 ml-auto">
          <span className="opacity-70">속도</span>
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={
                "px-1.5 py-0.5 rounded text-[0.7rem] transition-colors " +
                (s === speed
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted")
              }
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SolveCubeStage;
