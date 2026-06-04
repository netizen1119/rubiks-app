"use client";

import katex from "katex";
import { Language } from "@/lib/store/store";
import { ICubeMoves } from "@/lib/moves/moves";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { L, MathBlock, pick } from "./math-content";

// KaTeX 렌더 헬퍼 — react-katex 대신 코어 renderToString 사용(타입·의존성 최소).
const tex = (src: string, display: boolean) =>
  katex.renderToString(src, { displayMode: display, throwOnError: false, output: "html" });

const InlineMath = ({ src }: { src: string }) => (
  <span dangerouslySetInnerHTML={{ __html: tex(src, false) }} />
);

const BlockMath = ({ src }: { src: string }) => (
  <div className="my-3 overflow-x-auto text-center" dangerouslySetInnerHTML={{ __html: tex(src, true) }} />
);

// 인라인 $...$ 를 KaTeX 로, 나머지는 일반 텍스트로 분할 렌더.
const RichText = ({ text }: { text: string }) => {
  const parts = text.split("$");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <InlineMath key={i} src={part} /> : <span key={i}>{part}</span>
      )}
    </>
  );
};

const parseMoves = (s: string): ICubeMoves[] =>
  s.trim().split(/\s+/).filter(Boolean) as ICubeMoves[];

type Props = {
  block: MathBlock;
  lang: Language;
  onDemo: (label: string, moves: ICubeMoves[]) => void;
  playingLabel: string | null;
};

export const MathBlockView = ({ block, lang, onDemo, playingLabel }: Props) => {
  const tr = (l: L) => pick(l, lang);

  switch (block.t) {
    case "h":
      return block.lvl === 2 ? (
        <h2 className="mt-8 mb-2 border-b border-border/60 pb-1 text-xl font-bold text-foreground">
          {tr(block.text)}
        </h2>
      ) : (
        <h3 className="mt-5 mb-1.5 text-base font-semibold text-foreground">{tr(block.text)}</h3>
      );

    case "p":
      return (
        <p className="my-2 text-sm leading-relaxed text-muted-foreground">
          <RichText text={tr(block.text)} />
        </p>
      );

    case "math":
      return <BlockMath src={block.tex} />;

    case "callout":
      return (
        <div className="my-3 rounded-md border-l-4 border-primary/70 bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground/90">
          <RichText text={tr(block.text)} />
        </div>
      );

    case "code":
      return (
        <pre className="my-2 overflow-x-auto rounded-md bg-zinc-900/95 px-3 py-2 font-mono text-xs leading-relaxed text-foreground/90">
          {block.code}
        </pre>
      );

    case "list":
      return block.ordered ? (
        <ol className="my-2 ml-5 list-decimal space-y-1 text-sm leading-relaxed text-muted-foreground">
          {block.items.map((it, i) => (
            <li key={i}>
              <RichText text={tr(it)} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="my-2 ml-5 list-disc space-y-1 text-sm leading-relaxed text-muted-foreground">
          {block.items.map((it, i) => (
            <li key={i}>
              <RichText text={tr(it)} />
            </li>
          ))}
        </ul>
      );

    case "table":
      return (
        <div className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                {block.head.map((h, i) => (
                  <th key={i} className="px-2 py-1.5 text-left font-semibold text-foreground">
                    <RichText text={tr(h)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-b border-border/40 align-top">
                  {row.map((cell, c) => (
                    <td key={c} className="px-2 py-1.5 text-muted-foreground">
                      <RichText text={tr(cell)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "demo": {
      const label = tr(block.label);
      const active = playingLabel === label;
      return (
        <div className="my-3 rounded-md border border-border bg-background px-3 py-2.5">
          <Button
            size="sm"
            variant={active ? "default" : "secondary"}
            className="w-full"
            disabled={active}
            onClick={() => onDemo(label, parseMoves(block.moves))}
          >
            {active ? tr({ ko: "시연 중…", en: "Playing…" }) : label}
          </Button>
          <p className="mt-1.5 text-center font-mono text-[0.7rem] text-foreground/70">{block.moves}</p>
          {block.note && (
            <p className={cn("mt-1 text-center text-xs text-muted-foreground")}>
              <RichText text={tr(block.note)} />
            </p>
          )}
        </div>
      );
    }

    case "hr":
      return <hr className="my-6 border-border/60" />;
  }
};
