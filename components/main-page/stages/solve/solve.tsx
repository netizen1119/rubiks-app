"use client";

import { CubePosAnchor } from "@/components/cube-visualization/cube-pos-anchor";
import { THREE_HEIGHT, THREE_WIDTH } from "@/components/cube-visualization/cube-three";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cameraPositions } from "@/lib/maps/camera-positions";
import { useAppStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import StageProgress from "./stage-progress";
import MoveGuide from "./move-guide";
import StageInfo from "./stage-info";
import SolveStats from "./stats";
import OrientationLabels from "@/components/cube-visualization/orientation-labels";
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
    cubeScale,
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
      // 풀 수 없는 입력(주로 스캔 색 오류) → 깨진 solve 화면에 머무르지 않고
      // 스캔으로 복귀해 재스캔 유도. (매뉴얼 입력은 항상 풀 수 있어 이 경로에 안 옴)
      toast({
        variant: "destructive",
        title: "스캔을 다시 해주세요",
        description: "스캔된 색 배치로는 큐브를 풀 수 없어요. 면 색을 확인하고 다시 스캔해주세요.",
        duration: 6000,
      });
      updateStore({ currentAppStage: "scan" });
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

    // 복귀 애니메이션 핸들. 위치를 직선 보간하면 시작/끝이 같은 구 위에 있어도
    // 직선이 구 내부를 통과해 카메라가 큐브 쪽으로 파고들어 "확대→축소"가 보인다.
    // → 방향은 구면 보간(nlerp), 반경은 선형 보간해 거리를 유지한다.
    let returnTween: gsap.core.Tween | null = null;
    const onOrbitStart = () => {
      if (returnTween) {
        returnTween.kill();
        returnTween = null;
      }
    };
    const onOrbitEnd = () => {
      if (returnTween) returnTween.kill();
      const startDir = camera.position.clone().normalize();
      const startR = camera.position.length();
      const endDir = originalCameraPos.clone().normalize();
      const endR = originalCameraPos.length();
      const state = { t: 0 };
      returnTween = gsap.to(state, {
        t: 1,
        duration: 0.6,
        ease: "power2.inOut",
        onUpdate: () => {
          const dir = startDir.clone().lerp(endDir, state.t).normalize();
          const r = startR + (endR - startR) * state.t;
          camera.position.copy(dir.multiplyScalar(r));
          camera.lookAt(0, 0, 0);
        },
        onComplete: () => {
          returnTween = null;
        },
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
      if (returnTween) returnTween.kill();
      gsap.killTweensOf(camera.position);
    };
  }, []);

  // 뷰포트 크기에 맞춰 큐브 스케일 자동 조절 (작은 화면에서 축소, resize 대응).
  // 큐브 캔버스(400px) + 상/하 UI 가 함께 들어가도록 가로/세로 양쪽 제약을 본다.
  useEffect(() => {
    const apply = () => {
      const s = Math.min(window.innerWidth / 520, window.innerHeight / 720, 1);
      updateStore({ cubeScale: Math.max(0.5, s) });
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [updateStore]);

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

  // 도중 모드 전환: 되감지 않고 현재 진행 위치에서 새 모드로 이어 풀기.
  // 진행 중(preview) 무브가 있으면 commit 으로 clean boundary 도달 후 전환.
  const switchMode = (mode: "learn" | "fast") => {
    const st = useAppStore.getState();
    if (st.solveMode === mode || st.isDuringRotation) return;
    setIsPlaying(false);
    setSpeed(mode === "fast" ? 2 : 1);

    const finish = () => {
      try {
        useAppStore.getState().switchSolveMode(mode);
      } catch {
        toast({
          variant: "destructive",
          title: "Error",
          description: "모드 전환 중 풀이 생성에 실패했습니다.",
          duration: Infinity,
        });
      }
    };

    if (st.nextCubeRotation !== null) {
      // preview 상태 → 진행 중 무브를 commit 한 뒤 회전 종료를 기다려 전환.
      st.nextCubeSolveStep();
      const waitClean = () => {
        const s = useAppStore.getState();
        if (s.isDuringRotation || s.nextCubeRotation !== null) requestAnimationFrame(waitClean);
        else finish();
      };
      requestAnimationFrame(waitClean);
    } else {
      finish();
    }
  };

  return (
    <div
      className="w-full h-full flex justify-center items-center flex-col gap-3"
      style={{ animation: "fade-in 0.4s ease-out" }}
    >
      <OrientationLabels />

      {/* 나가기 — solve 종료 후 입력 시작점(deviceselect)으로. 스캔 화면 뒤로가기와 동일 스타일. */}
      <button
        onClick={() => updateStore({ currentAppStage: "deviceselect" })}
        className="fixed top-4 left-4 z-50 rounded-md bg-black/40 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-black/60 backdrop-blur-sm transition-colors"
      >
        ← 나가기
      </button>

      {/* 모드 전환 토글 — 클릭 시 현재 위치에서 해당 모드로 이어 풀기. */}
      <div className="flex items-center gap-2 text-xs">
        <div className="flex rounded-full border border-border overflow-hidden">
          {([
            { m: "learn" as const, label: "📚 차근차근" },
            { m: "fast" as const, label: "⚡ 빠르게" },
          ]).map(({ m, label }) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn(
                "px-2.5 py-0.5 transition-colors",
                solveMode === m
                  ? m === "fast"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-emerald-500/20 text-emerald-300"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground">{cubeSolution.length}수</span>
      </div>

      <StageProgress />

      <div
        className="flex items-center justify-center"
        style={{
          width: `${THREE_WIDTH * cubeScale}px`,
          height: `${(THREE_HEIGHT - 80) * cubeScale}px`,
        }}
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
