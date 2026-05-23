"use client";

import { useEffect } from "react";
import * as THREE from "three";
import { useAppStore } from "@/lib/store/store";

// 메인 vis 큐브를 드래그해 레이어를 회전시키는 공유 입력 훅.
// 매뉴얼 입력(스크램블)과 solve 연습 모드가 공유한다. 드래그가 무브로 해석되면
// 적용하지 않고 onResolveMove(move) 콜백으로 넘겨, 호출부가 처리(바로 적용 / 정답비교)한다.

export type Axis = "x" | "y" | "z";
export type HoverHint = { pos: string; neg: string } | null;

const IN_PLANE: Record<string, [Axis, Axis]> = {
  U: ["x", "z"], D: ["x", "z"],
  F: ["x", "y"], B: ["x", "y"],
  R: ["y", "z"], L: ["y", "z"],
};

// (rotAxis, slice) → 무브. 슬라이스(M/E/S) 포함.
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

const getGridPos = (group: THREE.Group): { gx: number; gy: number; gz: number } => {
  const p = new THREE.Vector3();
  group.children[0].getWorldPosition(p);
  return { gx: Math.round(p.x), gy: Math.round(p.y), gz: Math.round(p.z) };
};

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

interface Opts {
  // 활성 여부 (예: solve 의 연습 모드일 때만 true).
  enabled: boolean;
  // 드래그가 무브로 해석됐을 때 호출. 적용은 호출부 책임.
  onResolveMove: (move: string) => void;
  // 호버 시 슬라이스의 두 방향 무브 미리보기(또는 null).
  onHover?: (hint: HoverHint) => void;
}

export const useCubeDrag = ({ enabled, onResolveMove, onHover }: Opts) => {
  useEffect(() => {
    if (!enabled) return;
    const state = useAppStore.getState();
    const canvas = state.mainCanvas.current;
    const camera = state.camera.current;
    const outlined = state.outlinedSelection;
    if (!canvas || !camera) return;
    const cubes = state.objects.current.cubes;
    // pointer-events/touchAction 은 각 단계(스크램블/solve)가 관리한다. 본 훅은 핸들러만.

    const targets: THREE.Mesh[] = cubes
      .map((g) => (g && g.children[0] ? (g.children[0] as THREE.Mesh) : null))
      .filter((m): m is THREE.Mesh => !!m);

    const raycaster = new THREE.Raycaster();
    const ndcTmp = new THREE.Vector2();

    const pickHit = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      ndcTmp.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndcTmp.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndcTmp, camera);
      const hits = raycaster.intersectObjects(targets, false);
      if (!hits.length) return null;
      const hit = hits[0];
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

    const setOutlinedSlice = (rotAxis: Axis | null, slice: number | null) => {
      outlined.current.length = 0;
      if (!rotAxis || slice === null) return;
      for (const g of cubes) {
        if (!g || !g.children[0]) continue;
        const grid = getGridPos(g);
        if (gValOf(grid, rotAxis) === slice) outlined.current.push(g);
      }
    };

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
        onHover?.(null);
        return;
      }
      const grid = getGridPos(hit.group);
      const cursor = cursorNDC(clientX, clientY);
      const centerNDCv3 = hit.center.clone().project(camera);
      const offset = cursor.sub(new THREE.Vector2(centerNDCv3.x, centerNDCv3.y));
      if (offset.length() < 1e-3) offset.set(0.01, 0);
      const resolved = resolveAxisSlice(hit.face, grid, hit.center, offset);
      if (!resolved) {
        setOutlinedSlice(null, null);
        onHover?.(null);
        return;
      }
      setOutlinedSlice(resolved.rotAxis, resolved.slice);
      const spec = MOVE_TABLE[`${resolved.rotAxis}|${resolved.slice}`];
      if (spec) onHover?.({ pos: spec.pos, neg: spec.neg });
    };

    const onDown = (e: PointerEvent) => {
      if (useAppStore.getState().isDuringRotation) return;
      const hit = pickHit(e.clientX, e.clientY);
      if (!hit) {
        pending = null;
        return;
      }
      e.stopImmediatePropagation();
      startX = e.clientX;
      startY = e.clientY;
      pending = { face: hit.face, grid: getGridPos(hit.group), center: hit.center.clone() };
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
      const positive = swipeNDC.dot(posDir) > 0;
      const spec = MOVE_TABLE[`${resolved.rotAxis}|${resolved.slice}`];
      if (!spec) return;
      onResolveMove(positive ? spec.pos : spec.neg);
    };

    const onUp = () => {
      if (pending) {
        pending = null;
        setOutlinedSlice(null, null);
      }
    };

    canvas.addEventListener("pointerdown", onDown, true);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown, true);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      outlined.current.length = 0;
    };
  }, [enabled, onResolveMove, onHover]);
};
