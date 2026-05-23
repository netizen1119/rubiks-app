"use client";

import { useAppStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";

const LanguageToggle = () => {
  const language = useAppStore((s) => s.language);
  const updateStore = useAppStore((s) => s.updateStore);

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50 flex rounded-full overflow-hidden",
        "border border-border bg-black/40 backdrop-blur-sm text-xs"
      )}
    >
      {(["ko", "en"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => updateStore({ language: lang })}
          className={cn(
            "px-2.5 py-1 transition-colors uppercase font-medium",
            language === lang
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
          aria-pressed={language === lang}
        >
          {lang === "ko" ? "한" : "EN"}
        </button>
      ))}
    </div>
  );
};

export default LanguageToggle;
