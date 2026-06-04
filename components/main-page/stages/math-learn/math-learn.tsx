"use client";

import "katex/dist/katex.min.css";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAppStore } from "@/lib/store/store";
import { Button } from "@/components/ui/button";
import { CubePosAnchor } from "@/components/cube-visualization/cube-pos-anchor";
import { THREE_HEIGHT, THREE_WIDTH } from "@/components/cube-visualization/cube-three";
import { MATH_BLOCKS } from "./math-content";
import { MathBlockView } from "./math-blocks";
import { useCubeDemo } from "./use-cube-demo";

// 수학 학습 페이지: 큐브 풀이를 11학년 눈높이로 설명하는 스크롤 아티클.
// 상단 sticky 존에 공유 3D 큐브를 고정(불투명 배경이 스크롤되는 본문을 가림),
// 본문의 demo 블록 버튼이 그 큐브에 무브 시퀀스를 시연.
const MathLearnStage = () => {
  const { language, updateStore, cubeScale } = useAppStore();
  const tCommon = useTranslations("common");
  const tMath = useTranslations("math");
  const { play, playingLabel } = useCubeDemo();

  // 마운트: 큐브를 정지·풀린 상태로(데모 훅 reset 은 첫 demo 때 호출되지만, 진입 즉시
  // 홈 스핀을 멈추기 위해 여기서도 1회 정리) + 아티클에 맞는 작은 스케일.
  useEffect(() => {
    const st = useAppStore.getState();
    if (st.cubeSpinningTimeline.current) {
      st.cubeSpinningTimeline.current.kill();
      st.cubeSpinningTimeline.current = null;
    }
    useAppStore.setState({ isDuringRotation: false });

    const apply = () => {
      const s = Math.min(window.innerWidth / 900, 0.62);
      updateStore({ cubeScale: Math.max(0.42, s) });
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [updateStore]);

  const cubeZoneH = (THREE_HEIGHT - 110) * cubeScale;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[40rem] flex-col px-4 pb-20">
      {/* sticky 헤더 */}
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur">
        <Button variant="ghost" size="sm" className="px-2" onClick={() => updateStore({ currentAppStage: "homepage" })}>
          ← {tCommon("back")}
        </Button>
        <span className="text-sm font-semibold text-foreground">{tMath("title")}</span>
        <span className="w-12" />
      </div>

      {/* sticky 큐브 존 — 불투명 배경으로 스크롤되는 본문을 가린다. 큐브 오버레이가 이 위에 그려짐. */}
      <div
        className="sticky top-[2.75rem] z-10 -mx-4 flex items-center justify-center bg-background"
        style={{ height: `${Math.max(150, cubeZoneH)}px`, width: "auto" }}
      >
        <div style={{ width: `${THREE_WIDTH * cubeScale}px`, height: `${cubeZoneH}px` }} className="flex items-center justify-center">
          <CubePosAnchor />
        </div>
      </div>

      {/* 아티클 본문 */}
      <article className="pt-2">
        <p className="mb-3 text-center text-xs text-muted-foreground">{tMath("subtitle")}</p>
        {MATH_BLOCKS.map((block, i) => (
          <MathBlockView key={i} block={block} lang={language} onDemo={play} playingLabel={playingLabel} />
        ))}
        <p className="mt-10 border-t border-border/40 pt-4 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
          {tMath("sources")}
        </p>
      </article>
    </div>
  );
};

export default MathLearnStage;
