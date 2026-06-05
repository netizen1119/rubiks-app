"use client";

import { CubePosAnchor } from "@/components/cube-visualization/cube-pos-anchor";
import { THREE_HEIGHT, THREE_WIDTH } from "@/components/cube-visualization/cube-three";
import OrientationLabels from "@/components/cube-visualization/orientation-labels";
import { Button } from "@/components/ui/button";
import { cameraPositions } from "@/lib/maps/camera-positions";
import { solved_cube } from "@/lib/helpers/helper";
import { applyMoves } from "@/lib/solver/lbl-solver";
import { useAppStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { useTranslations, useMessages } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { LEARN_STEPS, invertMoves } from "./learn-steps";
import { resetCubiesToSolved } from "./reset-cubies";

// 각 데모 무브 사이 간격: 싱글 0.4s, 더블(R2/U2 등)은 0.8s (rotation-utils duration).
// 회전 중 rotateCube 가 가드로 드롭하므로 더블 뒤엔 더 띄워야 누락이 없다.
const SINGLE_MS = 480; // 400ms 애니 + 80 버퍼
const DOUBLE_MS = 880; // 800ms 애니 + 80 버퍼
const tickFor = (m: string) => (m[1] === "2" ? DOUBLE_MS : SINGLE_MS);
// 케이스를 보여주고 시작하기 전 대기, 풀린 뒤 다음 루프까지 대기.
const CASE_VIEW_MS = 650;
const LOOP_GAP_MS = 1100;

// 데모 모드: 섞인 큐브 없이 SOLVED 에 invert(algo) 케이스를 칠해 알고리즘을 시연(루프).
const LearnDemo = () => {
  const { updateStore, updateCameraPos, cubeScale } = useAppStore();
  const t = useTranslations("learnMethod");
  const tCommon = useTranslations("common");
  const messages = useMessages() as any;

  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  const step = LEARN_STEPS[stepIdx];
  const desc = messages?.stages?.lblDesc?.[String(step.lblDescIdx)];

  // 데모 스케줄 타이머 + 취소 토큰. 단계 전환·일시정지·언마운트 시 즉시 중단.
  const timers = useRef<number[]>([]);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  }, []);

  // 한 단계의 데모 1회 재생(케이스 페인트 → 알고리즘 애니 → 풀림). loop=true 면 반복.
  const playStep = useCallback(
    (idx: number, loop: boolean) => {
      clearTimers();
      const st = useAppStore.getState();
      const moves = LEARN_STEPS[idx].demoMoves;

      // 1) 큐비를 solved 위치로 복원 후 케이스 색 페인트(= invert 적용 상태).
      resetCubiesToSolved();
      st.updateCube(applyMoves(solved_cube, invertMoves(moves)), true);

      // 2) 케이스를 잠깐 보여준 뒤 알고리즘을 한 무브씩 애니메이션.
      let at = CASE_VIEW_MS;
      moves.forEach((m) => {
        timers.current.push(window.setTimeout(() => useAppStore.getState().rotateCube(m), at));
        at += tickFor(m);
      });

      // 3) 풀린 뒤 대기, loop 면 다시 재생.
      if (loop) {
        timers.current.push(
          window.setTimeout(() => {
            if (isPlayingRef.current) playStep(idx, true);
          }, at + LOOP_GAP_MS)
        );
      }
    },
    [clearTimers]
  );

  // 마운트: 회전 정지/스냅 + 카메라 정면 + 첫 단계 데모 시작. 언마운트: 정리 + solved 복원.
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
    // 이전 단계에서 회전 가드가 true 로 남으면 rotateCube 가 no-op → 데모가 멈춘다. 해제.
    updateStore({ isDuringRotation: false });

    updateCameraPos(cameraPositions.F);
    playStep(0, true);

    return () => {
      clearTimers();
      resetCubiesToSolved();
      useAppStore.getState().updateCube(solved_cube, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 뷰포트에 맞춘 큐브 스케일 (solve/manual-input 과 동일).
  useEffect(() => {
    const apply = () => {
      const s = Math.min(window.innerWidth / 520, window.innerHeight / 720, 1);
      updateStore({ cubeScale: Math.max(0.5, s) });
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [updateStore]);

  const goToStep = (idx: number) => {
    if (idx < 0 || idx >= LEARN_STEPS.length) return;
    setStepIdx(idx);
    setIsPlaying(true);
    isPlayingRef.current = true;
    playStep(idx, true);
  };

  const togglePlay = () => {
    setIsPlaying((p) => {
      const next = !p;
      isPlayingRef.current = next;
      if (next) playStep(stepIdx, true);
      else clearTimers();
      return next;
    });
  };

  const replay = () => {
    setIsPlaying(true);
    isPlayingRef.current = true;
    playStep(stepIdx, true);
  };

  return (
    <div className="flex flex-col items-center gap-3 px-4">
      {/* 헤더: 뒤로 + 진행 */}
      <div className="flex w-full max-w-[24rem] items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          onClick={() => updateStore({ currentAppStage: "homepage" })}
        >
          {tCommon("back")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("stepOf", { current: stepIdx + 1, total: LEARN_STEPS.length })}
        </span>
      </div>

      {/* 친근 별칭 + 한국어 부제 */}
      <div className="text-center">
        <h2 className="text-lg font-bold text-foreground">{t(`steps.${step.id}.name`)}</h2>
        <p className="text-xs text-muted-foreground">{desc?.shortTitle}</p>
      </div>

      {/* 단계 진행 점 */}
      <div className="flex items-center gap-1.5">
        {LEARN_STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goToStep(i)}
            aria-label={t(`steps.${s.id}.name`)}
            className={cn(
              "h-2.5 w-2.5 rounded-full transition-colors",
              i === stepIdx ? "bg-foreground" : "bg-muted hover:bg-muted-foreground/60"
            )}
          />
        ))}
      </div>

      {/* 라이브 3D 데모 (공유 vis 큐브) */}
      <div
        className="flex items-center justify-center"
        style={{
          width: `${THREE_WIDTH * cubeScale}px`,
          height: `${(THREE_HEIGHT - 80) * cubeScale}px`,
        }}
      >
        <CubePosAnchor />
        <OrientationLabels />
      </div>

      {/* 재생 컨트롤 */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="px-3" onClick={togglePlay}>
          {isPlaying ? t("pause") : t("play")}
        </Button>
        <Button variant="ghost" size="sm" className="px-3" onClick={replay}>
          {t("replay")}
        </Button>
      </div>

      {/* 펼침 설명 (기존 lblDesc 텍스트 재사용) */}
      {desc && (
        <div className="w-full max-w-[24rem] text-xs">
          <button
            onClick={() => setShowInfo((o) => !o)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5",
              "bg-background text-muted-foreground transition-colors hover:text-foreground"
            )}
          >
            <span>{t("howItWorks")}</span>
            <span className="opacity-60">{showInfo ? "▲" : "▼"}</span>
          </button>
          {showInfo && (
            <div className="mt-1.5 space-y-2 rounded-md border border-border/80 bg-zinc-900/95 px-3 py-2 leading-relaxed">
              <div>
                <span className="font-medium text-foreground">{t("goal")} </span>
                <span className="text-muted-foreground">{desc.goal}</span>
              </div>
              <div>
                <span className="font-medium text-foreground">{t("approach")} </span>
                <span className="text-muted-foreground">{desc.approach}</span>
              </div>
              {desc.representativeAlgo && (
                <div>
                  <span className="font-medium text-foreground">{t("algo")} </span>
                  <pre className="inline whitespace-pre-wrap font-mono text-[0.7rem] text-foreground/90">
                    {desc.representativeAlgo}
                  </pre>
                </div>
              )}
              {desc.tip && (
                <div>
                  <span className="font-medium text-foreground">{t("tip")} </span>
                  <span className="text-muted-foreground">{desc.tip}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 이전/다음 */}
      <div className="flex w-full max-w-[24rem] items-center gap-2">
        <Button
          variant="secondary"
          className="px-3"
          onClick={() => goToStep(stepIdx - 1)}
          disabled={stepIdx === 0}
        >
          {tCommon("prev")}
        </Button>
        <Button
          className="flex-1"
          onClick={() => goToStep(stepIdx + 1)}
          disabled={stepIdx === LEARN_STEPS.length - 1}
        >
          {tCommon("next")}
        </Button>
      </div>
    </div>
  );
};

export default LearnDemo;
