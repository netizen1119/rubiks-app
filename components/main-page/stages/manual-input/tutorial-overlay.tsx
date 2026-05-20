"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "manualInputTutorialSeen.v1";

// 매뉴얼 입력 첫 진입 시 1회용 안내 오버레이. localStorage 로 표시 여부 추적.
const TutorialOverlay = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) setShow(true);
    } catch {
      // localStorage 미지원 환경. 일단 보여줌.
      setShow(true);
    }
  }, []);

  const close = () => {
    setShow(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  };

  if (!show) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-black/70 backdrop-blur-sm",
        "animate-[fade-in_0.3s_ease-out]"
      )}
      onClick={close}
    >
      <div
        className={cn(
          "max-w-[28rem] mx-4 px-5 py-4 rounded-lg",
          "bg-zinc-900 border border-border shadow-2xl",
          "text-sm leading-relaxed"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-3">매뉴얼 입력 사용법</h2>
        <ul className="space-y-2 text-muted-foreground">
          <li>
            <span className="text-foreground font-medium">조각 면 드래그</span> ·
            해당 층을 회전. 면 위에 마우스를 올리면 회전할 층이 강조됩니다.
          </li>
          <li>
            <span className="text-foreground font-medium">빈 공간 드래그</span> ·
            큐브 시점(각도) 회전. 뒷면을 보고 싶을 때 사용.
          </li>
          <li>
            <span className="text-foreground font-medium">호버 위치</span> ·
            큐비의 윗/아랫/좌/우 가장자리 근처로 커서 → 다른 층이 강조됩니다.
            한 큐비에서 가로줄/세로줄 모두 선택 가능.
          </li>
          <li>
            <span className="text-foreground font-medium">Reset</span> · 큐브를
            솔브드 상태로 복원. <span className="text-foreground font-medium">이 상태로 풀기</span>{" "}
            → 단계별 풀이 안내 시작.
          </li>
        </ul>
        <div className="flex justify-end mt-4">
          <Button onClick={close} size="sm">
            시작하기
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
