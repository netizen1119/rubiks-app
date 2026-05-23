"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "manualInputTutorialSeen.v1";
const TITLE_ID = "tutorial-overlay-title";

// 매뉴얼 입력 첫 진입 시 1회용 안내 오버레이. localStorage 로 표시 여부 추적.
const TutorialOverlay = () => {
  const [show, setShow] = useState(false);
  const t = useTranslations();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

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

  // Esc 닫기 + 열림 시 close 버튼에 첫 포커스.
  useEffect(() => {
    if (!show) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

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
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className={cn(
          "max-w-[28rem] mx-4 px-5 py-4 rounded-lg",
          "bg-zinc-900 border border-border shadow-2xl",
          "text-sm leading-relaxed"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={TITLE_ID} className="text-base font-semibold mb-3">{t("tutorial.title")}</h2>
        <ul className="space-y-2 text-muted-foreground">
          <li>
            <span className="text-foreground font-medium">{t("tutorial.dragFaceTitle")}</span> ·{" "}
            {t("tutorial.dragFaceBody")}
          </li>
          <li>
            <span className="text-foreground font-medium">{t("tutorial.dragEmptyTitle")}</span> ·{" "}
            {t("tutorial.dragEmptyBody")}
          </li>
          <li>
            <span className="text-foreground font-medium">{t("tutorial.hoverTitle")}</span> ·{" "}
            {t("tutorial.hoverBody")}
          </li>
          <li>
            <span className="text-foreground font-medium">{t("tutorial.resetTitle")}</span> · {t("tutorial.resetBody")}{" "}
            <span className="text-foreground font-medium">{t("tutorial.solveTitle")}</span> {t("tutorial.solveBody")}
          </li>
        </ul>
        <div className="flex justify-end mt-4">
          <Button ref={closeBtnRef} onClick={close} size="sm">
            {t("common.start")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
