"use client";

import "katex/dist/katex.min.css";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAppStore } from "@/lib/store/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CubePosAnchor } from "@/components/cube-visualization/cube-pos-anchor";
import { THREE_HEIGHT, THREE_WIDTH } from "@/components/cube-visualization/cube-three";
import { MATH_TABS, pick } from "./math-content";
import { MathBlockView } from "./math-blocks";
import { useCubeDemo } from "./use-cube-demo";

// 수학 학습 페이지: 큐브 풀이를 쉬운 눈높이로 설명하는 스크롤 아티클.
// 긴 글을 3개 탭(사람/컴퓨터/God's Number)으로 분할 — 한 화면 가독성.
// 상단 고정 밴드(헤더+큐브존+탭바)는 z-index 없는 fixed:
//  - 본문(일반 흐름)보다 위에 그려져 스크롤되는 글을 가리고,
//  - main-page 에서 더 나중 형제인 큐브 오버레이(fixed inset-0, z-auto)는 이 밴드 위에 그려진다.
// 큐브 오버레이가 viewport 좌상단 고정이라(inset-0), 밴드에 앵커를 두면 큐브가 그 자리에 핀 고정.
const HEADER_H = 44;
const TAB_H = 40;

const MathLearnStage = () => {
  const { language, updateStore, cubeScale } = useAppStore();
  const tCommon = useTranslations("common");
  const tMath = useTranslations("math");
  const { play, playingLabel, highlight, reset } = useCubeDemo();
  const [tab, setTab] = useState(0);

  // 탭 전환: 진행 중 시연/외곽선 정리 + 큐브 solved 복원 + 새 탭 상단으로 스크롤.
  const changeTab = (i: number) => {
    if (i === tab) return;
    reset();
    setTab(i);
    window.scrollTo(0, 0);
  };

  // 진입 시 홈 스핀 정지 + 회전 가드 해제.
  useEffect(() => {
    const st = useAppStore.getState();
    if (st.cubeSpinningTimeline.current) {
      st.cubeSpinningTimeline.current.kill();
      st.cubeSpinningTimeline.current = null;
    }
    useAppStore.setState({ isDuringRotation: false });
  }, []);

  // 뷰포트에 맞춘 큐브 스케일 — 아티클용으로 살짝 작게(상한 0.6).
  useEffect(() => {
    const apply = () => {
      const s = Math.min(window.innerWidth / 640, window.innerHeight / 900, 0.6);
      updateStore({ cubeScale: Math.max(0.42, s) });
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [updateStore]);

  // 밴드는 큐브 시각 전체 높이(THREE_HEIGHT*scale)를 덮어야 뒤로 비침이 없다.
  // 앵커가 존 중앙 → 큐브가 존을 꽉 채우므로 존 높이 = 풀 큐브 높이.
  const cubeZoneH = THREE_HEIGHT * cubeScale;
  const bandH = HEADER_H + cubeZoneH + TAB_H + 8;

  return (
    <div className="flex flex-col items-center px-4 pb-24">
      {/* 밴드 높이만큼 띄운 뒤 본문 시작 */}
      <div aria-hidden="true" style={{ height: `${bandH}px` }} />

      {/* 아티클 본문 — 활성 탭 블록만 렌더 */}
      <article className="w-full max-w-[40rem]">
        {MATH_TABS[tab].blocks.map((block, i) => (
          <MathBlockView key={i} block={block} lang={language} onDemo={play} playingLabel={playingLabel} highlight={highlight} />
        ))}
        <p className="mt-10 border-t border-border/40 pt-4 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
          {tMath("sources")}
        </p>
      </article>

      {/* 상단 고정 밴드 — 불투명 bg 로 스크롤되는 본문을 가린다. z-index 대신 DOM 순서로 해결:
          본문(KaTeX 는 position:relative 라 positioned) 뒤에 둬서 밴드가 그 위에 그려지고,
          큐브 오버레이는 main-page 에서 더 나중 형제라 밴드 위에 그려진다.
          순서(페인트): 본문 KaTeX < 밴드 < 큐브 오버레이. fixed 라 시각 위치는 항상 상단. */}
      <div className="fixed inset-x-0 top-0 flex flex-col items-center bg-background pb-2">
        <div className="flex w-full max-w-[40rem] items-center justify-between border-b border-border/60 px-2" style={{ height: `${HEADER_H}px` }}>
          <Button variant="ghost" size="sm" className="px-2" onClick={() => updateStore({ currentAppStage: "homepage" })}>
            {tCommon("back")}
          </Button>
          <span className="text-sm font-semibold text-foreground">{tMath("title")}</span>
          <span className="w-12" />
        </div>
        {/* 큐브 존 — 큐브 fixed 오버레이가 이 앵커 자리에 핀 고정. */}
        <div
          className="flex items-center justify-center"
          style={{ width: `${THREE_WIDTH * cubeScale}px`, height: `${cubeZoneH}px` }}
        >
          <CubePosAnchor />
        </div>
        {/* 탭바 — 사람/컴퓨터/God's Number */}
        <div className="flex w-full max-w-[40rem] gap-1 px-2" style={{ height: `${TAB_H}px` }} role="tablist">
          {MATH_TABS.map((t, i) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={i === tab}
              onClick={() => changeTab(i)}
              className={cn(
                "flex-1 rounded-t-md border-b-2 px-1 text-xs font-semibold transition-colors",
                i === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {pick(t.label, language)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MathLearnStage;
