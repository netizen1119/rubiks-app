"use client";

import { useAppStore } from "@/lib/store/store";
import { useEffect, useRef } from "react";
import { THREE_HEIGHT, THREE_WIDTH } from "./cube-three";
import { cn } from "@/lib/utils";

export const CubePosAnchor = ({ className }: { className?: string }) => {
  const { cubeScale, updateStore } = useAppStore();
  const ref = useRef<HTMLDivElement | null>(null);

  // 앵커(=큐브가 놓일 자리)의 화면 위치를 측정해 캔버스 좌상단 좌표로 환산.
  // 레이아웃 확정 후(useEffect)에 측정하고, 창 크기 변경/레이아웃 변동 시 재측정해
  // 큐브가 항상 앵커(보통 화면 중앙)에 정렬되도록 한다.
  useEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const pos = el.getBoundingClientRect();
      updateStore({
        cubeTop: pos.top - (THREE_HEIGHT * cubeScale) / 2,
        cubeLeft: pos.left - (THREE_WIDTH * cubeScale) / 2,
      });
    };

    // 레이아웃/폰트 안정화 후 한 번 더 측정(초기 commit 시점 부정확 대비).
    measure();
    const raf = requestAnimationFrame(measure);

    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [cubeScale, updateStore]);

  return <div className={cn("cube-anchor", className)} ref={ref} />;
};
