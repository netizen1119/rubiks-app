"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CubePosAnchor } from "@/components/cube-visualization/cube-pos-anchor";
import { THREE_HEIGHT, THREE_WIDTH } from "@/components/cube-visualization/cube-three";
import { applyMove } from "@/lib/solver/lbl-solver";
import { ICubeMoves } from "@/lib/moves/moves";
import { useAppStore } from "@/lib/store/store";
import { solved_cube } from "@/lib/helpers/helper";
import { useEffect, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import TutorialOverlay from "./tutorial-overlay";

// 큐비의 현재 위치(world)로부터 격자 인덱스 (gx, gy, gz ∈ {-1, 0, 1}).
// 메인 vis 큐비는 격자 -1~1 좌표에 놓여 있으며, rotateCubeAction 이 회전 후
// 새 격자 위치로 재정렬한다(누적 회전 0, 위치는 lattice integer).
const getGridPos = (group: THREE.Group): { gx: number; gy: number; gz: number } => {
  const p = new THREE.Vector3();
  group.children[0].getWorldPosition(p);
  return {
    gx: Math.round(p.x),
    gy: Math.round(p.y),
    gz: Math.round(p.z),
  };
};

type Axis = "x" | "y" | "z";

const IN_PLANE: Record<string, [Axis, Axis]> = {
  U: ["x", "z"], D: ["x", "z"],
  F: ["x", "y"], B: ["x", "y"],
  R: ["y", "z"], L: ["y", "z"],
};

// (rotAxis, slice) → 엔진/시각화 무브. 슬라이스 포함.
const MOVE_TABLE: Record<string, { pos: string; neg: string }> = {
  "x|1": { pos: "R'", neg: "R" },
  "x|0": { pos: "M", neg: "M'" },
  "x|-1": { pos: "L", neg: "L'" },
  "y|1": { pos: "U'", neg: "U" },
  "y|0": { pos: "E", neg: "E'" },
  "y|-1": { pos: "D", neg: "D'" },
  "z|1": { pos: "F'", neg: "F" },
  "z|0": { pos: "S'", neg: "S" },
  "z|-1": { pos: "B", neg: "B'" },
};

const axisVec3 = (a: Axis): THREE.Vector3 =>
  a === "x" ? new THREE.Vector3(1, 0, 0)
  : a === "y" ? new THREE.Vector3(0, 1, 0)
  : new THREE.Vector3(0, 0, 1);

const gValOf = (g: { gx: number; gy: number; gz: number }, axis: Axis): number =>
  axis === "x" ? g.gx : axis === "y" ? g.gy : g.gz;

// 큐비의 +X/+Y/+Z 면 normal(world)들 중, 카메라를 향하고(시각적으로 보이고) 충돌 점의
// (P - center) 와 가장 정렬되는 축의 부호. → 사용자가 짚은 면 식별.
const detectHitFace = (
  hitPoint: THREE.Vector3,
  cubieCenter: THREE.Vector3
): "U" | "D" | "F" | "B" | "R" | "L" => {
  const d = hitPoint.clone().sub(cubieCenter);
  const ax = Math.abs(d.x);
  const ay = Math.abs(d.y);
  const az = Math.abs(d.z);
  if (ax >= ay && ax >= az) return d.x > 0 ? "R" : "L";
  if (ay >= ax && ay >= az) return d.y > 0 ? "U" : "D";
  return d.z > 0 ? "F" : "B";
};

const ScrambleCube = () => {
  const { updateStore, updateCube, rotateCube } = useAppStore();
  const { toast } = useToast();
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  // 호버 시 슬라이스의 두 방향 무브(pos/neg) 표시. 드래그 전에 어떤 무브가
  // 적용될지 미리 보여줌. 호버 외 null.
  const [hoverHint, setHoverHint] = useState<{ pos: string; neg: string } | null>(
    null
  );

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

  useEffect(() => {
    // inited 가드는 두지 않는다. React StrictMode dev 에서 effect 가 두 번 실행되는데
    // 가드를 두면 (setup → cleanup → 스킵된 setup) 패턴이 되어 핸들러가 제거된 상태로
    // 남는다. 본 setup 은 idempotent 하게 작성돼 두 번 실행돼도 안전.

    // 1~3) 큐비 초기화 + 색상 reset
    resetCubeToInitial();

    // 풀 사이즈로 표시.
    updateStore({ cubeScale: 1 });

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
    if (orbit) {
      orbit.addEventListener("start", onOrbitStart);
      orbit.addEventListener("end", onOrbitEnd);
    }

    const cubes = state.objects.current.cubes;
    const outlined = state.outlinedSelection;
    const scene = state.objects.current.scene;

    // 큐비 그룹의 첫 자식(box mesh)을 raycaster 대상으로 모은다.
    const targets: THREE.Mesh[] = cubes
      .map((g) => (g && g.children[0] ? (g.children[0] as THREE.Mesh) : null))
      .filter((m): m is THREE.Mesh => !!m);

    const raycaster = new THREE.Raycaster();
    const ndcTmp = new THREE.Vector2();

    const pickHit = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      // 캔버스가 스케일/이동된 motion.div 안에 있으므로 NDC 는 캔버스 bounding rect 기준.
      ndcTmp.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndcTmp.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndcTmp, camera);
      const hits = raycaster.intersectObjects(targets, false);
      if (!hits.length) return null;
      const hit = hits[0];
      // hit.object 의 부모가 큐비 그룹.
      const group = hit.object.parent as THREE.Group | null;
      if (!group) return null;
      const center = new THREE.Vector3();
      group.children[0].getWorldPosition(center);
      const face = detectHitFace(hit.point, center);
      return { group, face, hitPoint: hit.point.clone(), center };
    };

    const projAxisAtCubie = (cubieCenter: THREE.Vector3, ax: THREE.Vector3): THREE.Vector2 => {
      const p0 = cubieCenter.clone().project(camera);
      const p1 = cubieCenter.clone().add(ax).project(camera);
      return new THREE.Vector2(p1.x - p0.x, p1.y - p0.y);
    };

    // 면 + 큐비 격자 + (NDC공간) 방향 → 회전축/슬라이스. 가운데(slice=0) 도 허용 (M/E/S).
    const resolveAxisSlice = (
      face: "U" | "D" | "F" | "B" | "R" | "L",
      grid: { gx: number; gy: number; gz: number },
      cubieCenter: THREE.Vector3,
      ndcDir: THREE.Vector2
    ): { rotAxis: Axis; slice: number } | null => {
      const [A1, A2] = IN_PLANE[face];
      const s1 = projAxisAtCubie(cubieCenter, axisVec3(A1));
      const s2 = projAxisAtCubie(cubieCenter, axisVec3(A2));
      if (s1.length() < 1e-6 || s2.length() < 1e-6) return null;
      const d = ndcDir.clone().normalize();
      const dot1 = d.dot(s1.normalize());
      const dot2 = d.dot(s2.normalize());
      const isA1 = Math.abs(dot1) >= Math.abs(dot2);
      const rotAxis = isA1 ? A2 : A1;
      const slice = gValOf(grid, rotAxis);
      return { rotAxis, slice };
    };

    // 큐비가 슬라이스에 속한 모든 큐비를 outlined 에 채워 OutlinePass 가 강조.
    const setOutlinedSlice = (rotAxis: Axis | null, slice: number | null) => {
      outlined.current.length = 0;
      if (!rotAxis || slice === null) return;
      for (const g of cubes) {
        if (!g || !g.children[0]) continue;
        const grid = getGridPos(g);
        if (gValOf(grid, rotAxis) === slice) outlined.current.push(g);
      }
    };

    // 큐비 위치(world)에서 "+axis 기준 +90° 회전 시 cubie 가 움직이는 방향" 의 NDC 벡터.
    const positiveSwipeDirNDC = (rotAxis: Axis, cubieCenter: THREE.Vector3): THREE.Vector2 => {
      const axU = axisVec3(rotAxis);
      const rPerp = cubieCenter.clone().sub(axU.clone().multiplyScalar(cubieCenter.dot(axU)));
      const motion = axU.clone().cross(rPerp);
      return projAxisAtCubie(cubieCenter, motion);
    };

    type Pending = {
      face: "U" | "D" | "F" | "B" | "R" | "L";
      grid: { gx: number; gy: number; gz: number };
      center: THREE.Vector3;
    };
    let pending: Pending | null = null;
    let startX = 0;
    let startY = 0;

    const cursorNDC = (clientX: number, clientY: number): THREE.Vector2 => {
      const rect = canvas.getBoundingClientRect();
      return new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
    };

    const computeHover = (clientX: number, clientY: number) => {
      const hit = pickHit(clientX, clientY);
      if (!hit) {
        setOutlinedSlice(null, null);
        setHoverHint((prev) => (prev === null ? prev : null));
        return null;
      }
      const grid = getGridPos(hit.group);
      const cursor = cursorNDC(clientX, clientY);
      const centerNDCv3 = hit.center.clone().project(camera);
      const offset = cursor.sub(new THREE.Vector2(centerNDCv3.x, centerNDCv3.y));
      if (offset.length() < 1e-3) offset.set(0.01, 0);
      const resolved = resolveAxisSlice(hit.face, grid, hit.center, offset);
      if (!resolved) {
        setOutlinedSlice(null, null);
        setHoverHint((prev) => (prev === null ? prev : null));
        return null;
      }
      setOutlinedSlice(resolved.rotAxis, resolved.slice);
      const spec = MOVE_TABLE[`${resolved.rotAxis}|${resolved.slice}`];
      if (spec) {
        setHoverHint((prev) => {
          if (prev && prev.pos === spec.pos && prev.neg === spec.neg) return prev;
          return { pos: spec.pos, neg: spec.neg };
        });
      }
      return { face: hit.face, grid, center: hit.center };
    };

    // capture 단계로 등록하여 OrbitControls(bubble)보다 먼저 실행.
    // 큐비를 짚었으면 stopImmediatePropagation 으로 OrbitControls 차단,
    // 미스 시 통과시켜 시점 회전이 일어나게 한다.
    const onDown = (e: PointerEvent) => {
      if (useAppStore.getState().isDuringRotation) return;
      const hit = pickHit(e.clientX, e.clientY);
      if (!hit) {
        // 빈 영역 → OrbitControls 가 시점 회전 처리. 본 핸들러는 아무것도 안 함.
        pending = null;
        return;
      }
      // 큐비 hit → 레이어 회전 의도. OrbitControls 가 받지 않도록 차단.
      e.stopImmediatePropagation();
      startX = e.clientX;
      startY = e.clientY;
      pending = {
        face: hit.face,
        grid: getGridPos(hit.group),
        center: hit.center.clone(),
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (useAppStore.getState().isDuringRotation) return;
      if (!pending) {
        computeHover(e.clientX, e.clientY);
        return;
      }
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      const swipeNDC = new THREE.Vector2(dx, -dy);
      const resolved = resolveAxisSlice(pending.face, pending.grid, pending.center, swipeNDC);
      const committed = pending;
      pending = null;
      setOutlinedSlice(null, null);
      if (!resolved) return;
      const posDir = positiveSwipeDirNDC(resolved.rotAxis, committed.center);
      const sign = swipeNDC.dot(posDir);
      const positive = sign > 0;
      const spec = MOVE_TABLE[`${resolved.rotAxis}|${resolved.slice}`];
      if (!spec) return;
      const move = positive ? spec.pos : spec.neg;
      // 시각 회전(rotateCube) + 큐브 상태 문자열 동기화(applyMove) + 히스토리 추가.
      const cur = useAppStore.getState().cube;
      rotateCube(move as ICubeMoves);
      updateStore({ cube: applyMove(cur, move) });
      setMoveHistory((prev) => [...prev, move]);
    };

    const onUp = () => {
      if (pending) {
        pending = null;
        setOutlinedSlice(null, null);
      }
    };

    // pointerdown 은 capture 단계로 등록(OrbitControls 보다 먼저 받음).
    canvas.addEventListener("pointerdown", onDown, true);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown, true);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.style.pointerEvents = prevPointerEvents;
      canvas.style.touchAction = prevTouchAction;
      if (orbit) {
        orbit.removeEventListener("start", onOrbitStart);
        orbit.removeEventListener("end", onOrbitEnd);
        orbit.enabled = prevOrbitEnabled;
      }
      gsap.killTweensOf(camera.position);
      setOutlinedSlice(null, null);
    };
  }, []);

  const onSolve = () => {
    const cur = useAppStore.getState().cube;
    if (cur === solved_cube) {
      toast({
        variant: "destructive",
        title: "이미 풀린 상태",
        description: "큐브를 먼저 섞어주세요.",
        duration: 4000,
      });
      return;
    }
    updateStore({ currentAppStage: "solve" });
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
        title: "복사됨",
        description: `${moveHistory.length}개 무브를 클립보드에 복사했습니다.`,
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
      <h1 className="text-lg font-semibold text-foreground">큐브를 스크램블하세요</h1>
      <p className="text-xs text-muted-foreground -mt-3 text-center max-w-[22rem]">
        조각 면 위에 커서를 올리면 회전할 층이 강조됩니다. 그 방향으로 드래그해 회전.
      </p>
      {/* 캔버스에 pointer-events: auto 가 적용되어 있어 wrapper 보다 캔버스가 크면 */}
      {/* 캔버스가 위/아래 버튼 영역을 덮어 클릭을 가로챈다. 캔버스 전체 크기로 wrapper 지정. */}
      <div
        className="flex items-center justify-center"
        style={{ width: `${THREE_WIDTH}px`, height: `${THREE_HEIGHT}px` }}
      >
        <CubePosAnchor />
      </div>

      {/* 호버 힌트 — 드래그 방향별 무브 미리보기 */}
      <div className="text-xs text-muted-foreground h-4">
        {hoverHint ? (
          <span>
            드래그 방향:{" "}
            <span className="font-mono text-foreground">{hoverHint.pos}</span>
            <span className="opacity-60"> 또는 </span>
            <span className="font-mono text-foreground">{hoverHint.neg}</span>
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={onReset}>
          Reset
        </Button>
        <Button onClick={onSolve}>이 상태로 풀기 →</Button>
        <Button variant="ghost" onClick={() => updateStore({ currentAppStage: "deviceselect" })}>
          뒤로
        </Button>
      </div>

      {/* 무브 히스토리 — 실물 큐브로 동일 스크램블 재현용 */}
      {moveHistory.length > 0 && (
        <div className="w-full max-w-[24rem] mt-1">
          <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground mb-1 px-1">
            <span>무브 ({moveHistory.length})</span>
            <button
              onClick={onCopyHistory}
              className="text-foreground hover:underline"
            >
              📋 복사
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
