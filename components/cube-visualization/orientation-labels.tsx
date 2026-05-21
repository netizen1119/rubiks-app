"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAppStore } from "@/lib/store/store";
import { THREE_WIDTH, THREE_HEIGHT } from "@/components/cube-visualization/cube-three";

// 라이브 방향 나침반.
// 각 면 중심의 월드 위치를 매 프레임 화면으로 투영해 라벨을 붙인다. 시점을 돌리면
// 라벨이 큐브 면을 따라 같이 움직이고, 뒤로 돌아간 면은 흐려진다.
// 스티커 색은 풀이 중 계속 바뀌지만 센터(면 정체성)는 고정 → 면 문자로 방향을 잡는다.
//
// 좌표계: U=+y, D=-y, R=+x, L=-x, F=+z(기본 시점이 바라보는 면), B=-z.
// 큐브 반경 ~1.5 바깥(R)로 띄워 면 위에 겹치지 않게 한다.
const R = 2.35;
const FACES = [
  { key: "U", label: "U 위", pos: new THREE.Vector3(0, R, 0) },
  { key: "D", label: "D 아래", pos: new THREE.Vector3(0, -R, 0) },
  { key: "R", label: "R 오른", pos: new THREE.Vector3(R, 0, 0) },
  { key: "L", label: "L 왼", pos: new THREE.Vector3(-R, 0, 0) },
  { key: "F", label: "F 정면", pos: new THREE.Vector3(0, 0, R) },
  { key: "B", label: "B 뒤", pos: new THREE.Vector3(0, 0, -R) },
];

const OrientationLabels = () => {
  const cubeLeft = useAppStore((s) => s.cubeLeft);
  const cubeTop = useAppStore((s) => s.cubeTop);
  const cubeScale = useAppStore((s) => s.cubeScale);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const ndc = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    const update = () => {
      raf = requestAnimationFrame(update);
      const camera = useAppStore.getState().camera.current;
      if (!camera) return;
      for (let i = 0; i < FACES.length; i++) {
        const el = refs.current[i];
        if (!el) continue;
        const f = FACES[i];
        ndc.copy(f.pos).project(camera); // NDC [-1,1]
        const x = (ndc.x * 0.5 + 0.5) * THREE_WIDTH;
        const y = (-ndc.y * 0.5 + 0.5) * THREE_HEIGHT;
        // 면 법선(=정규화한 면 중심)이 카메라를 향하면 앞면(진하게), 아니면 뒷면(흐리게).
        toCam.copy(camera.position).sub(f.pos).normalize();
        const facing = f.pos.x * toCam.x + f.pos.y * toCam.y + f.pos.z * toCam.z;
        el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        el.style.opacity = facing > 0.05 ? "0.95" : "0.22";
      }
    };
    update();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="fixed pointer-events-none z-20"
      style={{
        left: `${cubeLeft}px`,
        top: `${cubeTop}px`,
        width: `${THREE_WIDTH}px`,
        height: `${THREE_HEIGHT}px`,
        transform: `scale(${cubeScale})`,
        transformOrigin: "top left",
      }}
    >
      {FACES.map((f, i) => (
        <span
          key={f.key}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="absolute left-0 top-0 select-none whitespace-nowrap rounded-md bg-black/60 px-1.5 py-0.5 text-[0.7rem] font-semibold text-white/95"
          style={{ willChange: "transform" }}
        >
          {f.label}
        </span>
      ))}
    </div>
  );
};

export default OrientationLabels;
