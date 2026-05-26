"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CubePosAnchor } from "@/components/cube-visualization/cube-pos-anchor";
import { THREE_HEIGHT, THREE_WIDTH } from "@/components/cube-visualization/cube-three";
import OrientationLabels from "@/components/cube-visualization/orientation-labels";
import { useCubeDrag, type HoverHint } from "@/components/cube-visualization/use-cube-drag";
import { applyMove } from "@/lib/solver/lbl-solver";
import { ICubeMoves } from "@/lib/moves/moves";
import { useAppStore } from "@/lib/store/store";
import { solved_cube } from "@/lib/helpers/helper";
import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import TutorialOverlay from "./tutorial-overlay";
import { useTranslations } from "next-intl";

const ScrambleCube = () => {
  const { updateStore, updateCube, rotateCube, cubeScale } = useAppStore();
  const { toast } = useToast();
  const t = useTranslations();
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  // 호버 시 슬라이스의 두 방향 무브(pos/neg) 표시. 드래그 전에 어떤 무브가
  // 적용될지 미리 보여줌. 호버 외 null.
  const [hoverHint, setHoverHint] = useState<HoverHint>(null);

  // 드래그 → 무브 해석은 공유 훅에 위임. 매뉴얼 입력은 적용 + 히스토리 누적이 책임.
  const onResolveMove = useCallback(
    (move: string) => {
      const cur = useAppStore.getState().cube;
      rotateCube(move as ICubeMoves);
      updateStore({ cube: applyMove(cur, move) });
      setMoveHistory((prev) => [...prev, move]);
    },
    [rotateCube, updateStore]
  );
  useCubeDrag({ enabled: true, onResolveMove, onHover: setHoverHint });

  // 큐비 누적 회전을 초기화하고 solved 상태로 페인트. mount + Reset 버튼 양쪽에서 사용.
  const resetCubeToInitial = () => {
    const state = useAppStore.getState();
    if (state.cubeSpinningTimeline.current) {
      state.cubeSpinningTimeline.current.kill();
      state.cubeSpinningTimeline.current = null;
    }
    gsap.killTweensOf(state.objects.current.rubiksGroup.rotation);
    state.objects.current.rubiksGroup.rotation.set(0, 0, 0);

    // 모든 큐비를 원본 격자 위치/방향으로 복원. cubeGroup 의 local 은 (0,0,0) 이고
    // 그 자식 cube mesh 가 (x-1,y-1,z-1) 로 오프셋되어 있다(gen-empty-cube 참고).
    const rubiksGroup = state.objects.current.rubiksGroup;
    const allCubies: THREE.Group[] = [];
    state.objects.current.scene.traverse((obj) => {
      if (obj instanceof THREE.Group && (obj.userData as { orgIdx?: number }).orgIdx !== undefined) {
        allCubies.push(obj);
      }
    });
    rubiksGroup.traverse((obj) => {
      if (obj instanceof THREE.Group && (obj.userData as { orgIdx?: number }).orgIdx !== undefined && !allCubies.includes(obj)) {
        allCubies.push(obj);
      }
    });
    const newCubesArray: THREE.Group[] = new Array(27);
    for (const g of allCubies) {
      const idx = (g.userData as { orgIdx: number }).orgIdx;
      gsap.killTweensOf(g.position);
      gsap.killTweensOf(g.rotation);
      gsap.killTweensOf(g.quaternion);
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
      g.quaternion.set(0, 0, 0, 1);
      g.scale.set(1, 1, 1);
      rubiksGroup.add(g);
      newCubesArray[idx] = g;
    }
    state.objects.current.cubes = newCubesArray;

    // 큐브 상태를 solved 로 초기화하고 가시화.
    updateCube(solved_cube, true);
  };

  // 뷰포트 크기에 맞춰 큐브 스케일 자동 조절 (작은 화면 축소, resize 대응) — solve 와 동일.
  useEffect(() => {
    const apply = () => {
      const s = Math.min(window.innerWidth / 520, window.innerHeight / 720, 1);
      updateStore({ cubeScale: Math.max(0.5, s) });
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [updateStore]);

  useEffect(() => {
    // inited 가드는 두지 않는다. React StrictMode dev 에서 effect 가 두 번 실행되는데
    // 가드를 두면 (setup → cleanup → 스킵된 setup) 패턴이 되어 핸들러가 제거된 상태로
    // 남는다. 본 setup 은 idempotent 하게 작성돼 두 번 실행돼도 안전.

    // 1~3) 큐비 초기화 + 색상 reset
    resetCubeToInitial();

    const state = useAppStore.getState();

    // 4) 메인 vis 캔버스에 포인터 핸들러 연결.
    const canvas = useAppStore.getState().mainCanvas.current;
    if (!canvas) return;

    // CubeVisualization 래퍼가 pointer-events-none 이므로 캔버스에서만 이벤트 활성.
    const prevPointerEvents = canvas.style.pointerEvents;
    canvas.style.pointerEvents = "auto";
    const prevTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = "none";

    // OrbitControls 는 활성 상태 유지하되, 캡처 단계에서 큐비를 짚었을 때만
    // stopImmediatePropagation 으로 차단해서 레이어 회전만 일어나도록 한다.
    // 빈 영역 드래그 시엔 propagation 그대로 통과 → OrbitControls 가 시점 회전 처리.
    const orbit = state.orbitControls.current;
    const prevOrbitEnabled = orbit?.enabled ?? true;
    if (orbit) orbit.enabled = true;

    // 매뉴얼 입력 진입 시점의 카메라 위치를 "원위치" 로 저장.
    // 빈 영역 드래그 종료 시 부드럽게 복귀.
    const camera = state.camera.current;
    const originalCameraPos = camera.position.clone();
    // 위치 직선 보간은 구 내부를 통과해 복귀 중 "확대→축소"가 보인다.
    // → 방향은 구면 보간(nlerp), 반경은 선형 보간해 거리를 유지.
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
      const tw = { t: 0 };
      returnTween = gsap.to(tw, {
        t: 1,
        duration: 0.6,
        ease: "power2.inOut",
        onUpdate: () => {
          const dir = startDir.clone().lerp(endDir, tw.t).normalize();
          const r = startR + (endR - startR) * tw.t;
          camera.position.copy(dir.multiplyScalar(r));
          camera.lookAt(0, 0, 0);
        },
        onComplete: () => {
          returnTween = null;
        },
      });
    };
    if (orbit) {
      orbit.addEventListener("start", onOrbitStart);
      orbit.addEventListener("end", onOrbitEnd);
    }

    // 드래그 → 무브 해석은 useCubeDrag 훅이 담당. cleanup 시 훅이 자체 정리.

    return () => {
      canvas.style.pointerEvents = prevPointerEvents;
      canvas.style.touchAction = prevTouchAction;
      if (orbit) {
        orbit.removeEventListener("start", onOrbitStart);
        orbit.removeEventListener("end", onOrbitEnd);
        orbit.enabled = prevOrbitEnabled;
      }
      if (returnTween) returnTween.kill();
      gsap.killTweensOf(camera.position);
    };
  }, []);

  const onSolve = () => {
    const cur = useAppStore.getState().cube;
    if (cur === solved_cube) {
      toast({
        variant: "destructive",
        title: t("manualInput.alreadySolvedTitle"),
        description: t("manualInput.alreadySolvedDesc"),
        duration: 4000,
      });
      return;
    }
    const nextStage = useAppStore.getState().trackedSolve ? "tracked-solve" : "solve";
    updateStore({ currentAppStage: nextStage });
  };

  const onReset = () => {
    if (useAppStore.getState().isDuringRotation) return;
    resetCubeToInitial();
    setMoveHistory([]);
  };

  const onCopyHistory = async () => {
    if (moveHistory.length === 0) return;
    try {
      await navigator.clipboard.writeText(moveHistory.join(" "));
      toast({
        title: t("common.copied"),
        description: t("manualInput.copyToastDesc", { count: moveHistory.length }),
        duration: 2000,
      });
    } catch {
      // navigator.clipboard 미지원 환경. 무시.
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-5 overflow-hidden p-4"
      style={{ animation: "fade-in 0.4s ease-out" }}
    >
      <TutorialOverlay />
      <OrientationLabels />
      <h1 className="text-lg font-semibold text-foreground">{t("manualInput.heading")}</h1>
      <p className="text-xs text-muted-foreground -mt-3 text-center max-w-[22rem]">
        {t("manualInput.hint")}
      </p>
      {/* 캔버스에 pointer-events: auto 가 적용되어 있어 wrapper 보다 캔버스가 크면 */}
      {/* 캔버스가 위/아래 버튼 영역을 덮어 클릭을 가로챈다. 캔버스 크기(스케일 반영)로 wrapper 지정. */}
      <div
        className="flex items-center justify-center"
        style={{ width: `${THREE_WIDTH * cubeScale}px`, height: `${THREE_HEIGHT * cubeScale}px` }}
      >
        <CubePosAnchor />
      </div>

      {/* 호버 힌트 — 드래그 방향별 무브 미리보기 */}
      <div className="text-xs text-muted-foreground h-4">
        {hoverHint ? (
          <span>
            {t("manualInput.dragDirection")}{" "}
            <span className="font-mono text-foreground">{hoverHint.pos}</span>
            <span className="opacity-60">{t("manualInput.or")}</span>
            <span className="font-mono text-foreground">{hoverHint.neg}</span>
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={onReset}>
          {t("common.reset")}
        </Button>
        <Button onClick={onSolve}>{t("manualInput.solve")}</Button>
        <Button variant="ghost" onClick={() => updateStore({ currentAppStage: "deviceselect" })}>
          {t("common.back")}
        </Button>
      </div>

      {/* 무브 히스토리 — 실물 큐브로 동일 스크램블 재현용 */}
      {moveHistory.length > 0 && (
        <div className="w-full max-w-[24rem] mt-1">
          <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground mb-1 px-1">
            <span>{t("manualInput.movesLabel", { count: moveHistory.length })}</span>
            <button
              onClick={onCopyHistory}
              className="text-foreground hover:underline"
            >
              {t("common.copy")}
            </button>
          </div>
          <div
            className="px-2 py-1.5 rounded-md border border-border/60 bg-muted/30 font-mono text-xs text-foreground/90 leading-relaxed max-h-16 overflow-y-auto break-words"
          >
            {moveHistory.join(" ")}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScrambleCube;
