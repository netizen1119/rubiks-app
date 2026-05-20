"use client";

import { CubePosAnchor } from "@/components/cube-visualization/cube-pos-anchor";
import { THREE_HEIGHT, THREE_WIDTH } from "@/components/cube-visualization/cube-three";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cameraPositions } from "@/lib/maps/camera-positions";
import { useAppStore } from "@/lib/store/store";
import { useEffect, useRef } from "react";
import StageProgress from "./stage-progress";
import MoveGuide from "./move-guide";
import gsap from "gsap";

const SolveCubeStage = () => {
  const { updateStore, initSolveCube, updateCameraPos, cubeSolutionStep, nextCubeSolveStep } =
    useAppStore();
  const { toast } = useToast();

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

  const finished = cubeSolutionStep === null;

  return (
    <div className="w-full h-full flex justify-center items-center flex-col overflow-hidden gap-3">
      <StageProgress />

      <div
        className="flex items-center justify-center"
        style={{ width: `${THREE_WIDTH}px`, height: `${THREE_HEIGHT - 160}px` }}
      >
        <CubePosAnchor />
      </div>

      <MoveGuide />

      <Button
        onClick={() => nextCubeSolveStep()}
        disabled={finished}
        style={{ width: `${THREE_WIDTH - 160}px` }}
      >
        {finished ? "완료" : "다음 이동 →"}
      </Button>
    </div>
  );
};

export default SolveCubeStage;
