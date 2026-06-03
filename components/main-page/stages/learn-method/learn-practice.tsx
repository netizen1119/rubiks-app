"use client";

import { CubePosAnchor } from "@/components/cube-visualization/cube-pos-anchor";
import { THREE_HEIGHT, THREE_WIDTH } from "@/components/cube-visualization/cube-three";
import OrientationLabels from "@/components/cube-visualization/orientation-labels";
import { useCubeDrag } from "@/components/cube-visualization/use-cube-drag";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cameraPositions } from "@/lib/maps/camera-positions";
import { ICubeMoves } from "@/lib/moves/moves";
import { useAppStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { useTranslations, useMessages } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import StageInfo from "../solve/stage-info";
import MoveGuide from "../solve/move-guide";
import { LEARN_STEPS } from "./learn-steps";
import { buildMoveArrow, disposeArrow } from "./move-arrow";

// 솔버 단계 인덱스(0..7) → 학습 카드 id. 단계 1(정렬, 0무브)은 흰 십자에 통합.
const STAGE_TO_STEP: Record<number, string> = {
  0: "cross",
  1: "cross",
  2: "firstLayer",
  3: "secondLayer",
  4: "yellowCross",
  5: "yellowFace",
  6: "cornerPerm",
  7: "edgePerm",
};

// 누적 이동수 기준 step 이 속한 단계 인덱스 (next-solve-step 와 동일 규칙).
const stageIndexForStep = (stages: { moves: string[] }[], step: number): number => {
  let cum = 0;
  for (let i = 0; i < stages.length; i++) {
    cum += stages[i].moves.length;
    if (step < cum) return i;
  }
  return stages.length ? stages.length - 1 : 0;
};

// 연습 모드: 내가 스캔/입력한 실제 큐브를 단계별로 직접 따라 돌리며 학습.
const LearnPractice = () => {
  const { updateStore, initSolveCube, updateCameraPos, cubeSolutionStep, currentStageIndex, cubeScale } =
    useAppStore();
  const { toast } = useToast();
  const t = useTranslations("learnMethod");
  const tCommon = useTranslations("common");
  const tSolve = useTranslations("solve");
  const messages = useMessages() as any;

  const [hintRevealed, setHintRevealed] = useState(false);
  // 더블(180°) 진행 추적: 같은 방향 쿼터 2회 중 첫 쿼터만 적용된 상태. (solve 와 동일)
  const practiceProgress = useRef<{ step: number; dir: string | null }>({ step: -1, dir: null });

  const finished = cubeSolutionStep === null;
  const stepId = STAGE_TO_STEP[currentStageIndex] ?? "cross";
  const cardIdx = Math.max(0, LEARN_STEPS.findIndex((s) => s.id === stepId));
  const desc = messages?.stages?.lblDesc?.[String(LEARN_STEPS[cardIdx]?.lblDescIdx)];

  // 마운트: 회전 정지/스냅 + 연습 모드 on + 실제 큐브 풀이 단계 산출(미리보기 없이 step0).
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;

    const state = useAppStore.getState();
    if (state.cubeSpinningTimeline.current) {
      state.cubeSpinningTimeline.current.kill();
      state.cubeSpinningTimeline.current = null;
    }
    gsap.killTweensOf(state.objects.current.rubiksGroup.rotation);
    state.objects.current.rubiksGroup.rotation.set(0, 0, 0);
    updateStore({ isDuringRotation: false, solvePractice: true });

    try {
      initSolveCube({ autoAdvance: false });
      updateCameraPos(cameraPositions.F);
    } catch {
      // 풀 수 없는 입력(주로 스캔 색 오류) → 재스캔 유도.
      toast({
        variant: "destructive",
        title: tSolve("scanRescanTitle"),
        description: tSolve("scanRescanDesc"),
        duration: 6000,
      });
      updateStore({ currentAppStage: "scan" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 빈 영역 드래그로 시점 회전. solve 와 달리 release 시 원위치로 복귀하지 않고 그대로 고정 →
  // 돌려본 면을 보면서 계속 학습. 원래 정면 배치는 리셋 버튼(resetView)으로 복귀.
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

    return () => {
      canvas.style.pointerEvents = prevPointerEvents;
      canvas.style.touchAction = prevTouchAction;
      orbit.enabled = prevOrbitEnabled;
      gsap.killTweensOf(camera.position);
    };
  }, []);

  // 시점을 원래 정면(F) 배치로 복귀. 학습은 그대로 이어진다.
  const resetView = () => {
    useAppStore.getState().updateCameraPos(cameraPositions.F);
  };

  // 뷰포트에 맞춘 큐브 스케일 (solve 와 동일).
  useEffect(() => {
    const apply = () => {
      const s = Math.min(window.innerWidth / 520, window.innerHeight / 720, 1);
      updateStore({ cubeScale: Math.max(0.5, s) });
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [updateStore]);

  // 연습 판정: 드래그한 무브를 정답과 비교해 맞을 때만 적용·진행. (solve 의 handleGuess 동일)
  const handleGuess = useCallback(
    (move: string) => {
      const st = useAppStore.getState();
      const step = st.cubeSolutionStep;
      if (step === null || st.isDuringRotation) return;
      const expected = st.cubeSolution[step];
      const face = expected[0];
      const isDouble = expected.endsWith("2");

      const advance = () => {
        const s = useAppStore.getState();
        const next = step + 1;
        const done = next >= s.cubeSolution.length;
        useAppStore.setState({
          cubeSolutionStep: done ? null : next,
          currentStageIndex: done
            ? Math.max(0, s.solveStages.length - 1)
            : stageIndexForStep(s.solveStages, next),
        });
        setHintRevealed(false);
      };

      const prog = practiceProgress.current;
      const halfActive = prog.dir !== null && prog.step === step;

      if (halfActive) {
        if (move === prog.dir) {
          st.rotateCube(move as ICubeMoves);
          practiceProgress.current = { step: -1, dir: null };
          advance();
        } else {
          const inv = prog.dir!.endsWith("'") ? prog.dir![0] : prog.dir! + "'";
          st.rotateCube(inv as ICubeMoves);
          practiceProgress.current = { step: -1, dir: null };
          toast({ description: tSolve("doubleHint"), duration: 1500 });
        }
        return;
      }

      if (move[0] !== face) {
        toast({ description: tSolve("wrongFace"), duration: 1500 });
        return;
      }

      if (isDouble) {
        practiceProgress.current = { step, dir: move };
        st.rotateCube(move as ICubeMoves);
        return;
      }

      if (move !== expected) {
        toast({ description: tSolve("wrongDir"), duration: 1500 });
        return;
      }
      st.rotateCube(move as ICubeMoves);
      advance();
    },
    [toast, tSolve]
  );

  useCubeDrag({ enabled: !finished, onResolveMove: handleGuess });

  // 현재 무브 힌트: 돌려야 할 면 위에 회전 방향 곡선 화살표를 scene 에 띄운다.
  // cubeSolutionStep 이 바뀔 때마다 갱신, 언마운트/단계변경 시 제거.
  useEffect(() => {
    if (finished || cubeSolutionStep === null) return;
    const scene = useAppStore.getState().objects.current.scene;
    const move = useAppStore.getState().cubeSolution[cubeSolutionStep];
    if (!move) return;
    const arrow = buildMoveArrow(move);
    if (!arrow) return;
    scene.add(arrow);
    return () => {
      scene.remove(arrow);
      disposeArrow(arrow);
    };
  }, [cubeSolutionStep, finished]);

  const exit = () => {
    updateStore({ learnMode: false, solvePractice: false, currentAppStage: "homepage" });
  };

  return (
    <div className="flex flex-col items-center gap-3 px-4">
      <OrientationLabels />

      {/* 나가기 — 학습 시작점(홈)으로. */}
      <button
        onClick={exit}
        className="fixed left-4 top-4 z-50 rounded-md bg-black/40 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-foreground"
      >
        {tCommon("exit")}
      </button>

      {/* 시점 리셋 — 배경 드래그로 돌려본 시점을 원래 정면으로 복귀. */}
      <button
        onClick={resetView}
        className="fixed right-4 top-4 z-50 rounded-md bg-black/40 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-foreground"
      >
        {t("resetView")}
      </button>

      {/* 친근 별칭 + 한국어 부제 */}
      <div className="mt-6 text-center">
        <h2 className="text-lg font-bold text-foreground">{t(`steps.${stepId}.name`)}</h2>
        <p className="text-xs text-muted-foreground">{desc?.shortTitle}</p>
      </div>

      {/* 7단계 진행 점 (현재 단계 기준) */}
      <div className="flex items-center gap-1.5">
        {LEARN_STEPS.map((s, i) => (
          <span
            key={s.id}
            aria-hidden="true"
            className={cn(
              "rounded-full transition-all",
              i < cardIdx && "h-2 w-2 bg-foreground",
              i === cardIdx && !finished && "h-2.5 w-2.5 bg-primary ring-2 ring-primary/30",
              (i > cardIdx || finished) && i !== cardIdx && "h-2 w-2 bg-muted",
              i === cardIdx && finished && "h-2 w-2 bg-foreground"
            )}
          />
        ))}
      </div>

      {/* 실제 큐브 (공유 vis) */}
      <div
        className="flex items-center justify-center"
        style={{
          width: `${THREE_WIDTH * cubeScale}px`,
          height: `${(THREE_HEIGHT - 80) * cubeScale}px`,
        }}
      >
        <CubePosAnchor />
      </div>

      {/* 따라하기 가이드 */}
      {finished ? (
        <div className="flex h-[4.5rem] flex-col items-center justify-center gap-1">
          <p className="text-base font-medium text-foreground">{t("done")}</p>
          <Button className="mt-1" onClick={exit}>
            {tCommon("completed")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-muted-foreground">{t("practiceHint")}</p>
          <MoveGuide />
        </div>
      )}

      {/* 단계 설명 (기존 lblDesc 재사용) */}
      {!finished && <StageInfo />}
    </div>
  );
};

export default LearnPractice;
