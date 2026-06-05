// 큐브 풀이의 수학 학습 페이지 콘텐츠 (한/영 병행).
// 원본: rubiks_math_for_11th_graders.md — 쉬운 눈높이 3부 구성을 블록 데이터로 이식.
// 블록 단위로 렌더(math-blocks.tsx). 본문은 i18n json 대신 이 데이터 모듈에 보관(장문 가독성).

import { Language } from "@/lib/store/store";

/** 언어별 문자열. */
export type L = { ko: string; en: string };

export const pick = (l: L, lang: Language) => l[lang];

export type MathBlock =
  | { t: "h"; lvl: 2 | 3; text: L }
  /** 문단. 인라인 수식은 $...$ 로 표기 (math-blocks 가 KaTeX 로 렌더). */
  | { t: "p"; text: L }
  /** 디스플레이 수식 (언어 무관). */
  | { t: "math"; tex: string }
  | { t: "callout"; text: L }
  /** 무브 표기/코드 — 등폭 글꼴 블록. */
  | { t: "code"; code: string }
  | { t: "table"; head: L[]; rows: L[][] }
  | { t: "list"; items: L[]; ordered?: boolean }
  /** 인터랙티브: 버튼 누르면 공유 3D 큐브에 moves 시퀀스 시연. */
  | { t: "demo"; label: L; moves: string; note?: L }
  | { t: "hr" };

const h2 = (ko: string, en: string): MathBlock => ({ t: "h", lvl: 2, text: { ko, en } });
const h3 = (ko: string, en: string): MathBlock => ({ t: "h", lvl: 3, text: { ko, en } });
const p = (ko: string, en: string): MathBlock => ({ t: "p", text: { ko, en } });
const math = (tex: string): MathBlock => ({ t: "math", tex });
const callout = (ko: string, en: string): MathBlock => ({ t: "callout", text: { ko, en } });
const code = (c: string): MathBlock => ({ t: "code", code: c });
const hr = (): MathBlock => ({ t: "hr" });

export const MATH_BLOCKS: MathBlock[] = [
  // ── 인트로 ──────────────────────────────────────────────
  p(
    "루빅스 큐브 속에 숨은 수학 여행: 사람의 풀이법이 왜 통하는지, 컴퓨터는 어떻게 다르게 푸는지, 그리고 “20수”가 어떻게 퍼즐 수학에서 가장 유명한 숫자가 되었는지.",
    "A friendly tour of the math hiding inside the Rubik's Cube: why human methods work, how computers solve it differently, and how “20 moves” became one of the most famous numbers in puzzle math."
  ),
  callout(
    "용어 하나 먼저 — “1수”란? 이 글에서 “1수(move)”는 한 면을 돌리는 것, 이른바 절반-회전 척도(HTM)다. 면을 90°(1/4 회전) 돌려도 1수, 180°(절반 회전) 돌려도 1수. 또 다른 척도인 1/4-회전 척도(QTM)에서는 180°가 2수다. 어떤 척도냐에 따라 유명한 숫자들이 달라지므로 항상 명시한다.",
    "One bit of vocabulary first — what counts as a “move”? Here a move means turning one face, in the Half-Turn Metric (HTM). A 90° quarter turn is one move, and a 180° half turn is also one move. In the Quarter-Turn Metric (QTM) a 180° turn counts as two. The metric changes some famous numbers, so we always say which we mean."
  ),

  // ── Part 0 ─────────────────────────────────────────────
  h2("Part 0 — 큰 그림", "Part 0 — The Big Picture"),
  p(
    "루빅스 큐브는 장난감처럼 보이지만 사실 거대한 수학 객체다. 이 글이 답하는 세 가지 큰 질문:",
    "A Rubik's Cube looks like a toy, but it's secretly a giant math object. This guide answers three big questions:"
  ),
  {
    t: "list",
    ordered: true,
    items: [
      { ko: "사람은 어떻게 푸는가? (Part 1) — Layer-By-Layer, CFOP, Roux 같은 단계별 방법.", en: "How do humans solve it? (Part 1) — staged methods like Layer-By-Layer, CFOP, Roux." },
      { ko: "컴퓨터는 어떻게, 무엇이 다르게 푸는가? (Part 2) — 군론, 영리한 알고리즘, 탐색.", en: "How do computers solve it, and how is that different? (Part 2) — group theory, clever algorithms, search." },
      { ko: "가장 어려운 섞임은 무엇이고 몇 수가 필요한가? (Part 3) — “God's Number = 20” 이야기.", en: "What is the hardest scramble, and how many moves? (Part 3) — the story of “God's Number = 20”." },
    ],
  },
  p(
    "셋을 잇는 가장 중요한 생각: 큐브는 너무 거대해서 운으로 풀 수 없다 — 하나의 거대한 문제를 작고 통제된 문제들의 연속으로 바꿔야 한다. 사람은 암기한 단계로, 컴퓨터는 부분군과 탐색으로 이걸 한다. 둘은 옷만 다른 같은 아이디어다.",
    "The idea connecting all three: the cube is enormous, so you can't solve it by luck — you must turn one giant problem into a sequence of smaller, controlled problems. Humans do this with memorized stages; computers with subgroups and search. Same idea, different clothes."
  ),

  // ── Part 1 ─────────────────────────────────────────────
  h2("Part 1 — 사람은 어떻게 푸는가", "Part 1 — How Humans Solve the Cube"),
  h3("1.1 언어: 무브 표기법", "1.1 The language: move notation"),
  p(
    "거의 모든 튜토리얼은 싱매스터 표기법(수학자 David Singmaster)을 쓴다. 여섯 면은 큐브를 든 방향 기준으로 이름 붙는다: R(오른쪽) L(왼쪽) U(위) D(아래) F(앞) B(뒤). 글자 하나 = 그 면을 바깥에서 봤을 때 90° 시계방향 회전.",
    "Almost every tutorial uses Singmaster notation (after mathematician David Singmaster). The six faces are named relative to how you hold the cube: R (Right), L (Left), U (Up), D (Down), F (Front), B (Back). A plain letter = turn that face 90° clockwise as seen from outside."
  ),
  code("R   = 오른쪽 면 90° 시계방향\nR'  = R 역회전 (반시계 90°, R 되돌리기)\nR2  = 오른쪽 면 180°"),
  p(
    "그래서 $R\\,U\\,R'\\,U'$ 는 “R 하고, U 하고, R 되돌리고, U 되돌리기”. 이 간결한 언어 덕에 전 세계 큐버가 “알고리즘”(짧은 무브 레시피)을 공유하고 추론한다. 두 인접 면 사이 중간층을 돌리는 슬라이스 무브 $M, E, S$ 도 있다(Roux 에서 특히 중요).",
    "So $R\\,U\\,R'\\,U'$ reads: do R, then U, undo R, undo U. This compact language lets cubers worldwide share “algorithms” (short move recipes) and reason about them. There are also slice moves $M, E, S$ turning the middle layers (key in Roux)."
  ),
  { t: "demo", label: { ko: "▶ R U R' U' 시연", en: "▶ Play R U R' U'" }, moves: "R U R' U'", note: { ko: "유명한 네 수 트리거(four-turn trigger). 몇 개 조각만 순환시키고 나머지는 그대로 둔다. 여섯 번 반복하면 다시 풀린다(차수 6).", en: "The famous four-turn trigger — cycles a few pieces and leaves the rest alone. Repeat it six times and the cube returns to solved (order 6)." } },

  h3("1.2 문제는 얼마나 큰가? 상태 공간", "1.2 How big is the problem? The state space"),
  p(
    "여기 모든 걸 흥미롭게 만드는 숫자가 있다. 표준 3×3×3 큐브가 가질 수 있는 배열의 수는 정확히:",
    "Here's the number that makes everything interesting. A standard 3×3×3 cube has exactly:"
  ),
  math("43{,}252{,}003{,}274{,}489{,}856{,}000"),
  p(
    "약 43경(43 뒤로 0이 18개). 이 괴물은 어디서 올까? 실제 공식은 너희가 이미 아는 것 — 팩토리얼과 거듭제곱 — 으로만 이루어진다:",
    "About 43 quintillion (43 followed by 18 digits). Where does this monster come from? The actual formula is built entirely from things you know — factorials and exponents:"
  ),
  math("|G| = \\frac{8! \\cdot 3^7 \\cdot 12! \\cdot 2^{11}}{2} = 43{,}252{,}003{,}274{,}489{,}856{,}000"),
  p(
    "조각조각 읽어보자. (작은 조각을 큐비라 한다: 코너 8개, 모서리 12개. 가운데 센터 6개는 서로 위치가 안 변하니 세지 않는다.)",
    "Let's read it piece by piece. (The little pieces are cubies: 8 corners, 12 edges. The 6 centers never move relative to each other, so they don't count.)"
  ),
  {
    t: "table",
    head: [{ ko: "인수", en: "Factor" }, { ko: "무엇을 세는가", en: "What it counts" }],
    rows: [
      [{ ko: "$8!$", en: "$8!$" }, { ko: "코너 8개를 임의 순서로 배열: $8! = 40{,}320$ 가지.", en: "The 8 corners in any order: $8! = 40{,}320$ ways." }],
      [{ ko: "$3^7$", en: "$3^7$" }, { ko: "각 코너는 3가지로 비틀 수 있다. 8개지만 7개를 정하면 8번째는 강제로 결정 — 그래서 $3^8$ 이 아닌 $3^7$.", en: "Each corner twists 3 ways. With 8 corners, once 7 are set the 8th is forced — so $3^7$, not $3^8$." }],
      [{ ko: "$12!$", en: "$12!$" }, { ko: "모서리 12개를 임의 순서로 배열.", en: "The 12 edges in any order." }],
      [{ ko: "$2^{11}$", en: "$2^{11}$" }, { ko: "각 모서리는 2가지로 뒤집힘. 마지막 1개는 나머지 11개로 강제 — $2^{12}$ 가 아닌 $2^{11}$.", en: "Each edge flips 2 ways; the last is forced by the other 11 — so $2^{11}$, not $2^{12}$." }],
      [{ ko: "$\\div 2$", en: "$\\div 2$" }, { ko: "패리티 규칙(아래)이 총합을 절반으로 자른다.", en: "A parity rule (below) cuts the total in half." }],
    ],
  },
  p(
    "“강제” 부분과 “÷2”는 임의의 보정값이 아니다 — 모든 합법 회전이 항상 지키는 세 가지 물리 법칙에서 나온다:",
    "The “forced” parts and the “÷2” aren't arbitrary fudge — they come from three physical laws every legal turn obeys:"
  ),
  {
    t: "list",
    ordered: true,
    items: [
      { ko: "코너 비틀림 법칙. 코너 8개의 비틀림 합은 항상 3의 배수. 그래서 코너 하나만 제자리에서 비틀 수 없다. ($3^7$)", en: "Corner-twist law. The total twist of all 8 corners is always a multiple of 3 — so you can never twist just one. (the $3^7$)" },
      { ko: "모서리 뒤집힘 법칙. 뒤집힌 모서리 수는 항상 짝수. 하나만 뒤집을 수 없다. ($2^{11}$)", en: "Edge-flip law. The number of flipped edges is always even — you can never flip just one. (the $2^{11}$)" },
      { ko: "순열 패리티 법칙. 정확히 두 조각만 맞바꿀 수 없다 — 모든 교환은 어딘가의 다른 교환과 짝을 이룬다. ($\\div 2$)", en: "Permutation-parity law. You can never swap exactly two pieces — every swap pairs with another. (the $\\div 2$)" },
    ],
  },
  callout(
    "왜 중요한가: 큐브를 분해해 무작위로 다시 조립하면, 12개 중 1개만 실제로 돌려서 풀 수 있다! 나머지 ~518경 배열은 풀린 큐브에서 도달이 물리적으로 불가능한 “불법” 상태다. 잘못 조립한 사람이 영영 못 푸는 이유다.",
    "Why it matters: reassemble a cube randomly and only 1 in 12 reassemblies is actually solvable by turning! The other ~518 quintillion arrangements are physically unreachable “illegal” states. That's why a wrongly-reassembled cube can be stuck forever."
  ),

  h3("1.3 Layer-By-Layer (LBL): 입문 방법", "1.3 Layer-By-Layer (LBL): the beginner method"),
  p(
    "대부분 처음 배우는 방법은 한 층씩 푼다. 흔한 7단계 버전: ① 흰 십자 ② 첫 층 코너 ③ 둘째 층 모서리 ④ 노란 십자 ⑤ 노란 면(마지막 층 방향) ⑥ 마지막 층 코너 위치 ⑦ 마지막 층 모서리 위치.",
    "Most people first learn to solve one layer at a time. A common 7-stage version: (1) white cross (2) first-layer corners (3) second-layer edges (4) yellow cross (5) yellow face (orient last layer) (6) permute last-layer corners (7) permute last-layer edges."
  ),
  p(
    "왜 통하나(핵심): 첫 층을 푼 뒤 둘째 층 알고리즘은 새 조각을 끼우면서 첫 층을 정확히 원래대로 되돌리도록 특별히 골라졌다. 도중엔 아래가 잠시 흐트러지지만 끝나면 항상 제자리로 돌아온다. 수학적으로는 이미 푼 조각을 고정시키는 무브로 자신을 제한하는 것 — 더 작고 안전한 무브 세계.",
    "Why it works (key insight): after the first layer is solved, the second-layer algorithms are chosen to insert a piece and put the first layer back exactly. Pieces below get briefly disturbed but always return. Mathematically you restrict yourself to moves that leave already-solved pieces fixed — a smaller, safer world."
  ),
  p(
    "절충: LBL 은 배우기 쉽지만(알고리즘 ~8–12개) 비효율적 — 무작위 섞임에 80–120수. 최적해는 평균 ~18수. 입문자는 필요보다 대략 5–6배 더 쓴다. 그게 단순함의 대가.",
    "Trade-off: LBL is easy (~8–12 algorithms) but inefficient — a random scramble takes 80–120 moves vs. an optimal ~18. Beginners use ~5–6× more moves than needed — the price of simplicity."
  ),

  h3("1.4 CFOP (프리드리히 방법): 스피드큐버의 선택", "1.4 CFOP (Fridrich Method): the speedcuber's choice"),
  p(
    "CFOP = Cross, F2L, OLL, PLL. 1990년대 중반 온라인에 보급한 Jessica Fridrich 이름을 따 프리드리히 방법이라 부른다.",
    "CFOP = Cross, F2L, OLL, PLL. Named the Fridrich Method after Jessica Fridrich, who popularized it online in the mid-1990s."
  ),
  {
    t: "table",
    head: [{ ko: "단계", en: "Stage" }, { ko: "하는 일", en: "What you do" }, { ko: "수학 아이디어", en: "Math idea" }],
    rows: [
      [{ ko: "Cross", en: "Cross" }, { ko: "바닥 모서리 4개를 센터 둘레에 푼다.", en: "Solve 4 bottom edges around a center." }, { ko: "모든 것의 안정적 “기준틀” 구축.", en: "Build a stable reference frame." }],
      [{ ko: "F2L", en: "F2L" }, { ko: "바닥 코너 + 짝 중간 모서리를 한 쌍으로 함께 푼다.", en: "Solve each bottom corner with its middle edge as a pair." }, { ko: "두 일을 한 번에.", en: "Do two jobs at once." }],
      [{ ko: "OLL", en: "OLL" }, { ko: "윗면 조각 방향을 모두 맞춰 한 색으로.", en: "Orient all top pieces to one color." }, { ko: "위치 무시, 방향 먼저.", en: "Fix orientation first." }],
      [{ ko: "PLL", en: "PLL" }, { ko: "윗면 조각을 제 위치로 옮긴다.", en: "Slide top pieces into place." }, { ko: "이제 위치 — 방향은 이미 끝남.", en: "Now fix position." }],
    ],
  },
  p(
    "OLL/PLL 의 영리함은 방향과 순열의 분리 — “어느 쪽을 향하나”와 “어디로 가나”를 독립 문제로 푼다. 큐브 수학의 반복 주제다. 알고리즘 수: 마지막 층은 $57\\text{(OLL)} + 21\\text{(PLL)} = 78$ 개. F2L 41 케이스를 더해 흔히 119 케이스로 인용(실전에선 F2L 은 직관, 78개만 암기).",
    "OLL/PLL's cleverness is separating orientation from permutation — “which way pieces face” vs. “where they go” as independent problems. A recurring theme. Counts: last layer is $57\\text{ (OLL)} + 21\\text{ (PLL)} = 78$. Adding 41 F2L cases gives the often-quoted 119 (most do F2L by intuition, memorizing the 78)."
  ),
  p(
    "왜 CFOP 가 LBL 보다 빠른가: LBL 은 코너 전부, 그다음 모서리 전부 — 서로 방해하는 두 패스. F2L 은 코너+모서리를 한 쌍으로 융합해 함께 끼워 그 낭비를 없앤다. 결과: 풀이당 80–120수 대신 약 55–60수.",
    "Why CFOP beats LBL: LBL places all corners, then all edges — two passes that disturb each other. F2L fuses a corner+edge and inserts them together, killing the waste. Result: ~55–60 moves instead of 80–120."
  ),

  h3("1.5 Roux: 층 대신 블록", "1.5 Roux: blocks instead of layers"),
  p(
    "Roux 방법(2003, Gilles Roux)은 “층” 개념을 버리고 블록을 쌓는다: ① 왼쪽에 1×2×3 블록 ② 오른쪽에 짝 블록(첫 블록 안 깨고) ③ CMLL — 마지막 층 코너만(42 알고리즘), 중간 모서리는 무시 ④ LSE(마지막 모서리 6개) — $M$ 과 $U$ 무브만으로 직관 마무리.",
    "Roux (2003, Gilles Roux) drops “layers” and builds blocks: (1) a 1×2×3 block on the left (2) a matching block on the right (3) CMLL — last-layer corners only (42 algorithms), ignoring middle edges (4) LSE (last six edges) — finished intuitively with only $M$ and $U$ moves."
  ),
  p(
    "Roux 는 평균 45–50수로 CFOP 보다 더 적고, 큐브 전체를 거의 안 돌린다. 마무리가 특별: $M$ 과 $U$ 만 쓰는 아주 작고 빠른 무브 세계. 단점은 블록 쌓기가 직관이라 배우는 데 더 오래 걸린다.",
    "Roux averages 45–50 moves — fewer than CFOP — and barely rotates the whole cube. Its finish uses only $M$ and $U$ turns, a tiny fast world of moves. The catch: block-building is intuitive and takes longer to learn."
  ),

  h3("1.6 비밀 엔진: 교환자와 켤레", "1.6 The secret engine: commutators and conjugates"),
  p(
    "여기서 수학이 진짜로 아름다워진다. 거의 모든 큐브 알고리즘은(어떤 방법이든) 두 패턴으로 이루어진다.",
    "Here the math gets genuinely beautiful. Almost every cube algorithm — across every method — is built from two patterns."
  ),
  p(
    "교환자(commutator). $[A, B]$ 로 쓰며 뜻은:",
    "Commutator. Written $[A, B]$, it means:"
  ),
  math("[A, B] = A \\cdot B \\cdot A' \\cdot B'"),
  p(
    "(“A 하고, B 하고, A 되돌리고, B 되돌리기.”) 마법은 상쇄다: $A$ 와 $B$ 가 완전히 다른 조각만 건드리면 전체가 무(無)로 상쇄된다. 하지만 작은 영역에서 겹치면 교환자는 그 겹친 조각만 바꾸고 나머지 전체는 그대로 둔다. 풀이 막바지, 이미 푼 걸 깨뜨릴까 두려울 때 정확히 원하는 것.",
    "(“Do A, do B, undo A, undo B.”) The magic is cancellation: if $A$ and $B$ touch entirely separate pieces, the whole thing cancels to nothing. But if they overlap in a small region, the commutator changes only those overlapping pieces and leaves the rest untouched — exactly what you want late in a solve."
  ),
  { t: "demo", label: { ko: "▶ 교환자 [R, U] 시연", en: "▶ Play commutator [R, U]" }, moves: "R U R' U'", note: { ko: "$[R, U] = R\\,U\\,R'\\,U'$ — 코너 몇 개만 순환.", en: "$[R, U] = R\\,U\\,R'\\,U'$ — cycles just a few corners." } },
  p(
    "켤레(conjugate). $[A : B]$ 로 쓰며 뜻은:",
    "Conjugate. Written $[A : B]$, it means:"
  ),
  math("[A : B] = A \\cdot B \\cdot A'"),
  p(
    "$A$ 는 셋업 무브, $B$ 는 쓸모 있는 알고리즘, $A'$ 는 셋업 되돌리기: “셋업 → 유용한 작업 → 셋업 해제.” 덕분에 하나의 알고리즘을 여러 상황에 재사용한다 — 대상 조각을 알고리즘이 통하는 자리로 옮기고, 실행하고, 다시 제자리로. “조각을 작업장으로 옮겨 작업하고 도로 가져오기” 패턴은 LBL·CFOP·Roux·블라인드 등 어디에나 나온다.",
    "$A$ is a setup move, $B$ a useful algorithm, $A'$ undoes the setup: “setup → do the useful thing → undo setup.” This reuses one algorithm in many situations — carry a target piece to where the algorithm works, run it, carry everything back. This “workshop” pattern appears everywhere: LBL, CFOP, Roux, blindfolded."
  ),
  { t: "demo", label: { ko: "▶ 켤레 [F : R U R' U'] 시연", en: "▶ Play conjugate [F : R U R' U']" }, moves: "F R U R' U' F'", note: { ko: "셋업 F → 네 수 트리거 → 셋업 해제 F'. 작용 영역이 옮겨진다.", en: "Setup F → four-turn trigger → undo F'. The region of effect shifts." } },
  callout(
    "패리티 각주: 교환자는 항상 짝수 순열을 만든다. 그래서 위치가 홀수 패리티(예: 정확히 두 조각만 바뀜)면, 교환자로 마무리하기 전에 면 회전 1수를 먼저 넣어 패리티를 고쳐야 한다.",
    "Parity footnote: commutators always produce an even permutation. So if a position has odd parity (e.g. exactly two pieces swapped), you must first insert a single face turn to fix parity before commutators can finish."
  ),

  h3("1.7 Part 1 요약표", "1.7 Part 1 cheat sheet"),
  {
    t: "table",
    head: [{ ko: "방법", en: "Method" }, { ko: "암기 알고리즘", en: "Algorithms" }, { ko: "평균 수", en: "Avg moves" }],
    rows: [
      [{ ko: "LBL (입문)", en: "LBL (beginner)" }, { ko: "~8–12", en: "~8–12" }, { ko: "80–120", en: "80–120" }],
      [{ ko: "CFOP (풀)", en: "CFOP (full)" }, { ko: "119", en: "119" }, { ko: "55–60", en: "55–60" }],
      [{ ko: "Roux", en: "Roux" }, { ko: "~42 + 직관", en: "~42 + intuition" }, { ko: "45–50", en: "45–50" }],
      [{ ko: "최적 (컴퓨터)", en: "Optimal (computer)" }, { ko: "—", en: "—" }, { ko: "~18", en: "~18" }],
    ],
  },

  // ── Part 2 ─────────────────────────────────────────────
  h2("Part 2 — 컴퓨터는 어떻게 푸는가 (그리고 왜 다른가)", "Part 2 — How Computers Solve the Cube"),
  p(
    "큰 인식 전환: 스티커 대신 변환을 생각하라. 무브는 그림이 아니라 한 상태를 다른 상태로 바꾸는 함수다. 무브의 연속은 함수 합성. 이 한 아이디어가 컴퓨터가 하는 모든 걸 연다.",
    "The big mental shift: stop thinking about stickers, think about transformations. A move isn't a picture — it's a function turning one state into another. A sequence is function composition. This one idea unlocks everything."
  ),
  h3("2.1 큐브는 “군(group)”이다", "2.1 The cube is a “group”"),
  p(
    "수학에서 군이란 결합·되돌리기·반복할 수 있는 동작들의 모음으로, 항상 같은 시스템 안에 머문다. 큐브가 완벽히 들어맞는다:",
    "In math, a group is a collection of actions you can combine, undo, and repeat, always staying inside the same system. The cube fits perfectly:"
  ),
  {
    t: "table",
    head: [{ ko: "군 개념", en: "Group idea" }, { ko: "큐브에서의 의미", en: "On the cube" }],
    rows: [
      [{ ko: "원소", en: "Element" }, { ko: "합법 무브 시퀀스(또는 그것이 만든 상태).", en: "A legal move sequence (or the state it produces)." }],
      [{ ko: "연산", en: "Operation" }, { ko: "합성: 한 시퀀스 후 다른 시퀀스.", en: "Composition: do one sequence, then another." }],
      [{ ko: "항등원", en: "Identity" }, { ko: "“아무것도 안 함” — 풀린 상태.", en: "“Do nothing” — the solved state." }],
      [{ ko: "역원", en: "Inverse" }, { ko: "거꾸로 해서 되돌리기. $R\\,U\\,F$ 의 역은 $F'\\,U'\\,R'$.", en: "Undo by reversing. The inverse of $R\\,U\\,F$ is $F'\\,U'\\,R'$." }],
      [{ ko: "생성원", en: "Generators" }, { ko: "6개 기본 면 회전 $\\langle U, D, R, L, F, B \\rangle$ — 모든 상태가 여기서 도달 가능.", en: "The 6 face turns $\\langle U, D, R, L, F, B \\rangle$ — every state is reachable." }],
      [{ ko: "비가환", en: "Non-commutative" }, { ko: "순서가 중요! $R\\,U$ 와 $U\\,R$ 은 다른 결과.", en: "Order matters! $R\\,U$ and $U\\,R$ differ." }],
    ],
  },
  p(
    "마지막 점이 중요: 큐브 군은 비아벨(순서가 중요)이고, 바로 그게 흥미롭고 어렵게 만든다. 크기는 Part 1 의 43경과 같다.",
    "That last point matters: the cube group is non-abelian (order matters), which is what makes it interesting and hard. Its size is the same 43 quintillion."
  ),
  callout(
    "(야심가용) 형식 구조는 $G \\cong \\left[ \\left( \\mathbb{Z}_3^7 \\rtimes S_8 \\right) \\times \\left( \\mathbb{Z}_2^{11} \\rtimes S_{12} \\right) \\right]^{1/2}$ 로 쓴다. 지금 외계어 같아도 괜찮다 — “코너는 순열·비틀림, 모서리는 순열·뒤집힘, 거기에 패리티 규칙”을 정밀히 적은 것일 뿐. Part 1 공식이 화려한 옷을 입은 것.",
    "(For the ambitious) the formal structure is $G \\cong \\left[ \\left( \\mathbb{Z}_3^7 \\rtimes S_8 \\right) \\times \\left( \\mathbb{Z}_2^{11} \\rtimes S_{12} \\right) \\right]^{1/2}$. If that's gibberish, fine — it's just precise bookkeeping of “corners permute and twist, edges permute and flip, with parity rules.” The Part 1 formula in fancy clothes."
  ),
  p(
    "왜 군으로 보나? 막연한 직관을 정밀한 도구로 바꾸기 때문: 부분군 = 더 작은 무브 세계, 잉여류(coset) = 거대 상태공간을 균등한 덩어리로 자르기, 불변량 = 불가능을 설명하는 법칙, 케일리 그래프 = 퍼즐 전체를 지도로 — 상태는 점, 무브는 점을 잇는 선, 풀이는 “풀린” 점으로 가는 경로 찾기.",
    "Why frame it as a group? It converts vague intuition into precise tools: subgroups = smaller worlds of moves, cosets = slicing the state space into equal chunks, invariants = laws explaining impossibilities, Cayley graph = the whole puzzle as a map — states are dots, moves are edges, solving = finding a path to the “solved” dot."
  ),
  h3("2.2 왜 사람 방법은 최단해를 못 찾나", "2.2 Why human methods can't find the shortest"),
  p(
    "사람 방법은 풀린 상태로 가는 한 경로를 찾는다. 최적 솔버는 최단 경로를 찾고, 더 짧은 게 없음을 증명한다. 두 번째 일이 훨씬 어렵다 — “최단”을 증명하려면 모든 더 짧은 가능성을 배제해야 하니까. 그래서 사람은 50–120수, 컴퓨터는 ~18수.",
    "A human method finds a path to solved. An optimal solver finds the shortest and proves nothing shorter exists. That second job is far harder — proving “shortest” means ruling out every shorter possibility. Hence humans use 50–120 moves while computers find ~18."
  ),
  h3("2.3 Thistlethwaite 알고리즘 (1981): 중첩 부분군", "2.3 Thistlethwaite's Algorithm (1981): nested subgroups"),
  p(
    "Morwen Thistlethwaite 의 돌파구: 조각별로 풀지 말고, 큐브를 점점 좁아지는 부분군의 사슬로 깔때기처럼 흘려보내 “풀림”만 남기기.",
    "Morwen Thistlethwaite's breakthrough: don't solve piece by piece — funnel the cube through a chain of shrinking subgroups until only “solved” is left."
  ),
  math("G_0 \\supset G_1 \\supset G_2 \\supset G_3 \\supset G_4 = \\{I\\}"),
  math("\\begin{aligned} G_0 &= \\langle L, R, F, B, U, D \\rangle \\\\ G_1 &= \\langle L, R, F, B, U^2, D^2 \\rangle \\\\ G_2 &= \\langle L, R, F^2, B^2, U^2, D^2 \\rangle \\\\ G_3 &= \\langle L^2, R^2, F^2, B^2, U^2, D^2 \\rangle \\\\ G_4 &= \\{I\\} \\end{aligned}"),
  p(
    "각 단계가 큐브를 더 제한된 세계로 몰아넣는다: ① $G_1$ — 모든 모서리 방향 고정, U/D 1/4 회전 불필요 ② $G_2$ — 코너 방향 고정, 슬라이스 모서리를 제 슬라이스에 ③ $G_3$ — 절반 회전만으로 가능한 구조로 ④ $G_4$ — 절반 회전만으로 풀림.",
    "Each phase forces a more restricted world: (1) $G_1$ — all edge orientations fixed, no U/D quarter-turns needed (2) $G_2$ — corner orientations fixed, slice edges in their slice (3) $G_3$ — forced into a half-turn-only structure (4) $G_4$ — solved with half-turns only."
  ),
  p(
    "왜 멋진가: 43경 전체를 뒤지는 대신 각 단계는 훨씬 작은 “몫(quotient)” 문제만 탐색하고 미리 계산한 표에서 답을 찾는다. Thistlethwaite 버전은 어떤 큐브든 ≤ 52수를 보장 — 최초의 컴퓨터 검증 한계(이후 45로 개선).",
    "Why brilliant: instead of all 43 quintillion, each phase searches a much smaller “quotient” and looks up a precomputed table. His version guaranteed ≤ 52 moves — the first computer-verified bound (later refined to 45)."
  ),
  h3("2.4 Kociemba 2-Phase (1992): 실전 일꾼", "2.4 Kociemba's Two-Phase (1992): the workhorse"),
  p(
    "Herbert Kociemba 는 4단계를 2단계로 합쳤고, 1992년 Atari ST 에서 개발할 만큼 빠르다. 핵심 중간 부분군은 H-군(“도미노 군”):",
    "Herbert Kociemba collapsed four phases into two, fast enough to develop on a 1992 Atari ST. The key middle subgroup is the H-group (“domino group”):"
  ),
  math("H = \\langle U, D, R^2, L^2, F^2, B^2 \\rangle"),
  p(
    "모든 방향이 이미 풀리고 중간 슬라이스 모서리가 제 슬라이스에 있으면 큐브가 “$H$ 안”에 있다 — 그 순간 평평한 2층 도미노 퍼즐처럼 절반 회전으로 풀린다. Phase 1: 섞임을 $H$ 안으로 몰기. Phase 2: $H$ 안에서 풀기. Phase 1 탐색 공간은 정확히:",
    "When all orientations are solved and slice edges sit in their slice, the cube is “in $H$” — it behaves like a flat 2-layer domino puzzle solvable with half-turns. Phase 1: drive the scramble into $H$. Phase 2: solve from inside $H$. The Phase-1 space is exactly:"
  ),
  math("2187 \\times 2048 \\times 495 = 2{,}217{,}093{,}120 \\text{ states}"),
  p(
    "이 숫자 — 22억 — 을 기억하라. God's Number 증명에서 다시 나온다. 실전에서 Kociemba 솔버는 밀리초 만에 18–20수 해를 찾는다. 무료 프로그램 Cube Explorer 가 표준 도구.",
    "Remember 2.2 billion — it returns in the God's Number proof. In practice Kociemba solvers find 18–20 move solutions in milliseconds. His free Cube Explorer is the standard tool."
  ),
  h3("2.5 IDA*: 밑바닥 탐색 엔진", "2.5 IDA*: the search engine underneath"),
  p(
    "위 두 알고리즘 모두 IDA*(반복 심화 A*, Richard Korf 고안)를 쓴다: ① 길이 0, 1, 2… 순으로 찾기(심화) ② 매 단계 남은 수의 하한을 추정 ③ (쓴 수)+(하한) > 현재 깊이 한계면 그 가지를 포기(가지치기) ④ 추정이 결코 과대평가 안 하므로, 완료된 깊이에서 처음 찾은 해가 증명적으로 최단.",
    "Both use IDA* (Iterative Deepening A*, by Richard Korf): (1) look for length 0, 1, 2… (deepening) (2) estimate a lower bound on moves remaining (3) if (moves used)+(bound) > current depth limit, prune that branch (4) since the estimate never overshoots, the first solution found at a completed depth is provably shortest."
  ),
  p(
    "핵심 트릭은 패턴 데이터베이스: 큐브의 한 조각(예: 코너 8개)을 푸는 정확한 최소 수를 저장한 표. 일부를 푸는 게 전체보다 결코 더 어렵지 않으니 안전한(허용 가능한) 하한이다. Korf 는 여럿을 결합:",
    "The crucial trick is the pattern database: a table of the exact minimum moves to solve a piece (e.g. just the 8 corners). Solving part is never harder than the whole, so these are admissible lower bounds. Korf combined several:"
  ),
  math("h(\\text{cube}) = \\max\\!\\big(h_{\\text{corners}},\\; h_{\\text{edges 1}},\\; h_{\\text{edges 2}}\\big)"),
  p(
    "정직하면서도 더 큰 추정일수록 더 많은 가지를 안전히 버린다. 이로써 Korf 의 1997 솔버는 최적해 중앙값이 18수임을 보였다.",
    "The bigger (yet honest) the estimate, the more branches you safely discard. With this, Korf's 1997 solver showed the median optimal solution is 18 moves."
  ),
  h3("2.6 대칭: 같은 퍼즐을 두 번 풀지 마라", "2.6 Symmetry: don't solve the same puzzle twice"),
  p(
    "큐브에는 48개 대칭이 있다: 공간 회전 24가지 × 거울상 2배. 두 섞임이 서로 회전/거울상일 뿐이면 똑같이 어렵다 — 풀림까지 거리가 같다. 그래서 솔버는 대표 하나의 답만 저장하고 닮은꼴은 건너뛴다. 2010 최종 증명에서 이는 작업을 2,217,093,120 케이스에서 55,882,296 으로 — 약 40배 — 줄였다.",
    "A cube has 48 symmetries: 24 spatial rotations × 2 for mirrors. If two scrambles are rotations/mirrors of each other, they're equally hard. So solvers store one representative and skip the look-alikes. In the 2010 proof this cut work from 2,217,093,120 cases to 55,882,296 — about 40× less."
  ),
  h3("2.7 최악 한계를 좁힌 경주 (HTM)", "2.7 The race to bound the worst case (HTM)"),
  p(
    "30년간 수학자들은 최악 숫자를 양쪽에서 깎았다 — 어떤 값보다 작을 수 없음(하한)과 클 수 없음(상한)을 증명하며:",
    "For 30 years mathematicians chipped at the worst case from both sides — proving it couldn't be less (lower bound) nor more (upper bound):"
  ),
  {
    t: "table",
    head: [{ ko: "시기", en: "Date" }, { ko: "하한", en: "Lower" }, { ko: "상한", en: "Upper" }, { ko: "누가", en: "Who" }],
    rows: [
      [{ ko: "~1980", en: "by 1980" }, { ko: "18", en: "18" }, { ko: "—", en: "—" }, { ko: "셈 논증", en: "counting" }],
      [{ ko: "1981.7", en: "Jul 1981" }, { ko: "18", en: "18" }, { ko: "52", en: "52" }, { ko: "Thistlethwaite", en: "Thistlethwaite" }],
      [{ ko: "1990.12", en: "Dec 1990" }, { ko: "18", en: "18" }, { ko: "42", en: "42" }, { ko: "Kloosterman", en: "Kloosterman" }],
      [{ ko: "1992.5", en: "May 1992" }, { ko: "18", en: "18" }, { ko: "39", en: "39" }, { ko: "Michael Reid", en: "Michael Reid" }],
      [{ ko: "1995.1", en: "Jan 1995" }, { ko: "20", en: "20" }, { ko: "29", en: "29" }, { ko: "Reid: superflip=20", en: "Reid: superflip=20" }],
      [{ ko: "2005.12", en: "Dec 2005" }, { ko: "20", en: "20" }, { ko: "28", en: "28" }, { ko: "Radu", en: "Radu" }],
      [{ ko: "2010.7", en: "Jul 2010" }, { ko: "20", en: "20" }, { ko: "20", en: "20" }, { ko: "Rokicki 외", en: "Rokicki et al." }],
    ],
  },
  p(
    "하한과 상한이 바이스처럼 서로를 향해 조여든다. 1995년엔 답이 20과 29 사이에 갇혔지만, 그 마지막 9수 간격을 닫는 데 15년과 구글급 컴퓨팅이 더 걸렸다.",
    "The bounds squeeze toward each other like a vise. By 1995 the answer was trapped between 20 and 29 — but closing that last 9-move gap took 15 more years and Google-scale computing."
  ),
  h3("2.8 HTM 대 QTM", "2.8 HTM vs. QTM"),
  {
    t: "table",
    head: [{ ko: "척도", en: "Metric" }, { ko: "1수 =", en: "One move =" }, { ko: "God's Number", en: "God's Number" }],
    rows: [
      [{ ko: "HTM", en: "HTM" }, { ko: "임의 면 회전 (90·180·270°)", en: "any face turn (90/180/270°)" }, { ko: "20", en: "20" }],
      [{ ko: "QTM", en: "QTM" }, { ko: "90° 회전만 (180°=2수)", en: "only 90° (180° = 2 moves)" }, { ko: "26", en: "26" }],
    ],
  },
  p(
    "QTM 결과(26)는 2014년 Rokicki·Davidson 이 증명. 전체 큐브에서 완전한 26 1/4-회전이 필요한 위치는 단 3개뿐.",
    "The QTM result (26) was proved by Rokicki and Davidson in 2014. Only three positions in the entire cube need a full 26 quarter-turns."
  ),

  // ── Part 3 ─────────────────────────────────────────────
  h2("Part 3 — God's Number 는 20", "Part 3 — God's Number Is 20"),
  h3("3.1 질문을 정확히", "3.1 The question, stated precisely"),
  p(
    "가장 나쁜 섞임에서, 완벽히 플레이하면 몇 수가 필요한가? 상태 $s$ 에 대해 $d(s)$ = $s$ 에서의 최단해 길이라 하자. God's Number 는 모든 상태에 대한 최악:",
    "From the worst scramble, if you play perfectly, how many moves? For state $s$, let $d(s)$ = the shortest solution length from $s$. God's Number is the worst case over all states:"
  ),
  math("\\text{God's Number} = \\max_{s \\in G}\\, d(s) = 20 \\quad (\\text{HTM})"),
  p(
    "Part 2 의 지도(케일리 그래프) 언어로는: God's Number 는 그래프의 지름 — 어떤 상태와 풀림 사이 “최단 경로” 중 가장 긴 것. 전지적 솔버라면 아무리 사악한 섞임이라도 20수를 넘길 일이 없다.",
    "In the map (Cayley graph) language: God's Number is the diameter — the longest “shortest path” between any state and solved. An all-knowing solver never needs more than 20, no matter how evil the scramble."
  ),
  h3("3.2 superflip: 가장 유명한 어려운 위치", "3.2 The superflip: the most famous hard position"),
  p(
    "superflip 은 큐브 위치들의 셀럽이다: 코너 8개 모두 위치·방향 정확 ✅, 센터 6개 정확 ✅, 모서리 12개 모두 제 슬롯에 있지만 전부 180° 뒤집힘 ❌. 거의 풀린 듯 보이는데(다 제자리!) 모든 모서리가 반대로 향해 공략 각이 없다. 풀린 큐브에서 도달하는 한 방법:",
    "The superflip is the celebrity of positions: all 8 corners correct in position and orientation ✅, all 6 centers correct ✅, all 12 edges in their slots but every one flipped 180° ❌. It looks almost solved (everything home!) yet every edge faces wrong, so there's no easy angle. One way to reach it from solved:"
  ),
  { t: "demo", label: { ko: "▶ superflip 도달 시연 (20수)", en: "▶ Play to superflip (20 moves)" }, moves: "R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U", note: { ko: "끝나면 모든 모서리가 제자리지만 전부 뒤집혀 보인다.", en: "At the end every edge is home but flipped." } },
  p(
    "1995년 Michael Reid 가 superflip 이 정확히 20수가 필요함을 증명했다 — 더 적게는 불가능. 이 결과가 하한을 20으로 올렸다: 적어도 한 위치는 진짜로 20수가 필요하다.",
    "In 1995 Michael Reid proved the superflip needs exactly 20 moves — no fewer. This raised the lower bound to 20: at least one position genuinely requires 20."
  ),
  p(
    "superflip 은 대수적으로도 특별 — 큐브 군의 중심에 있어 모든 무브와 교환된다(앞에 하든 뒤에 하든 같은 결과). 그 깊은 대칭이 이토록 완고한 이유의 일부다.",
    "The superflip is also special: it sits in the center of the cube group, commuting with every move (do it before or after anything, same result). That deep symmetry is part of why it's so stubborn."
  ),
  h3("3.3 2010 증명: 모든 큐브가 ≤ 20", "3.3 The 2010 proof: every cube in ≤ 20"),
  p(
    "superflip 은 God's Number 가 적어도 20임을 보였다. 어려운 절반은 최대 20임을 — 어떤 위치도 21 이상 필요 없음을 — 증명하는 것. Tomas Rokicki, Herbert Kociemba, Morley Davidson, John Dethridge 가 2010년 7월 해냈다.",
    "The superflip showed God's Number is at least 20. The hard half was proving it's at most 20 — that no position needs 21+. Rokicki, Kociemba, Davidson, and Dethridge did it in July 2010."
  ),
  p(
    "영리한 수: 43경 모든 상태의 최적해를 찾은 게 아니라(불가능), 각 상태가 길이 ≤ 20 인 어떤 해를 가짐만 증명했다 — 그걸로 충분.",
    "The clever move: they didn't find optimal solutions for all 43 quintillion states (impossible) — they only proved each has some solution of length ≤ 20, which suffices."
  ),
  {
    t: "table",
    head: [{ ko: "재료", en: "Ingredient" }, { ko: "값", en: "Value" }],
    rows: [
      [{ ko: "전체 상태", en: "Total states" }, { ko: "43,252,003,274,489,856,000", en: "43,252,003,274,489,856,000" }],
      [{ ko: "잉여류 수 ($H$-군)", en: "Cosets ($H$-group)" }, { ko: "2,217,093,120", en: "2,217,093,120" }],
      [{ ko: "잉여류당 상태", en: "States per coset" }, { ko: "19,508,428,800", en: "19,508,428,800" }],
      [{ ko: "대칭 적용 후 잉여류", en: "Cosets after symmetry" }, { ko: "55,882,296", en: "55,882,296" }],
      [{ ko: "사용한 컴퓨팅", en: "Computing used" }, { ko: "~35 CPU-년 (구글 기부)", en: "~35 CPU-years (donated by Google)" }],
    ],
  },
  p(
    "방법, 단계별: ① 잘게 나누기 — 43경 상태를 Kociemba $H$-군의 22억 잉여류(균등 덩어리)로 분할 ② 덩어리 통째 풀기 — 한 잉여류(~200억 상태)를 약 20초에 처리해 모두 ≤ 20 증명 ③ 대칭 활용 — 48 대칭이 22억을 ~5,600만으로 줄임 ④ 분산 — 구글이 수천 대에 돌려 PC 한 대로 ~35년 걸릴 일을 몇 주에.",
    "The method: (1) slice it up — partition 43 quintillion states into 2.2 billion cosets of Kociemba's $H$-group (2) solve a whole chunk — handle one coset (~20 billion states) in ~20 seconds, proving all ≤ 20 (3) use symmetry — 48 symmetries shrink 2.2 billion to ~56 million (4) distribute — Google ran it across thousands of machines, finishing in weeks what one PC would take ~35 years."
  ),
  math("\\underbrace{\\text{superflip} = 20}_{\\geq 20} \\;+\\; \\underbrace{\\text{모든 상태} \\leq 20}_{\\leq 20} \\;\\Longrightarrow\\; \\boxed{\\text{God's Number} = 20}"),
  h3("3.4 20수 섞임은 얼마나 드문가", "3.4 How rare is a 20-move scramble?"),
  p(
    "풀림으로부터 거리별 상태 수(거리 15까지 정확, 16–20 추정):",
    "Counts of states by distance from solved (exact through 15, estimated 16–20):"
  ),
  {
    t: "table",
    head: [{ ko: "거리", en: "Distance" }, { ko: "위치 수", en: "Positions" }],
    rows: [
      [{ ko: "10", en: "10" }, { ko: "232,248,063,316", en: "232,248,063,316" }],
      [{ ko: "12", en: "12" }, { ko: "40,374,425,656,248", en: "40,374,425,656,248" }],
      [{ ko: "14", en: "14" }, { ko: "6,989,320,578,825,358", en: "6,989,320,578,825,358" }],
      [{ ko: "15", en: "15" }, { ko: "91,365,146,187,124,313", en: "91,365,146,187,124,313" }],
      [{ ko: "16", en: "16" }, { ko: "≈ 1.1 × 10¹⁸", en: "≈ 1.1 × 10¹⁸" }],
      [{ ko: "17", en: "17" }, { ko: "≈ 1.2 × 10¹⁹", en: "≈ 1.2 × 10¹⁹" }],
      [{ ko: "18", en: "18" }, { ko: "≈ 2.9 × 10¹⁹ (정점)", en: "≈ 2.9 × 10¹⁹ (peak)" }],
      [{ ko: "19", en: "19" }, { ko: "≈ 1.5 × 10¹⁸", en: "≈ 1.5 × 10¹⁸" }],
      [{ ko: "20", en: "20" }, { ko: "≈ 4.9 × 10⁸", en: "≈ 4.9 × 10⁸" }],
    ],
  },
  p(
    "이것이 말해주는 것: 정점은 거리 18(~29경). 평균 최적해는 약 18수다. 대부분 섞임은 “18쯤”이지 20이 아니다. 거리-20 위치는 터무니없이 드물다 — 대략 880억 섞임 중 1개. 그래도 ~3억–5억 개는 존재하니 20은 단일 괴짜가 아닌 진짜 최악이다. 거리 15 이후 수치는 아직 추정뿐 — 누구도 정확히 계산 못 했다.",
    "What this tells us: the peak is at distance 18 (~29 quintillion). The average optimal solution is about 18 moves. Most scrambles are “18-ish,” not 20. Distance-20 positions are absurdly rare — roughly 1 in 88 billion scrambles. Yet ~300–490 million exist, so 20 is a real worst case, not a freak. Counts past 15 are still only estimates — nobody has computed them exactly."
  ),
  h3("3.5 왜 놀라운가", "3.5 Why this is surprising"),
  p(
    "43경 상태인데 풀림에서 20수보다 먼 게 없다. 어떻게? 큐브가 쉬워서가 아니라 — 매 무브가 수많은 새 가능성으로 갈라져 “지도”가 믿기 어려울 만큼 잘 연결되어 있기 때문. 진정한 좁은 세상 네트워크: 천문학적으로 많은 점, 그러나 아주 작은 지름.",
    "43 quintillion states, yet nothing is more than 20 turns from solved. How? Not because the cube is easy — because each move branches into many possibilities, so the “map” is incredibly well-connected. A true small-world network: astronomically many dots, tiny diameter."
  ),
  p(
    "가장 깊은 교훈은 네가 큐브를 푸는 방식과 증명이 작동하는 방식의 아름다운 평행이다:",
    "The deepest lesson is the beautiful parallel between how you solve a cube and how the proof works:"
  ),
  {
    t: "table",
    head: [{ ko: "사람 풀이", en: "Human solving" }, { ko: "계산적 증명", en: "Computational proof" }],
    rows: [
      [{ ko: "이미 푼 조각을 보호.", en: "Protect already-solved pieces." }, { ko: "고정 유지하는 부분군 안에서 탐색.", en: "Search inside fixing subgroups." }],
      [{ ko: "셋업 후 되돌리기.", en: "Setup moves, then undo." }, { ko: "켤레와 대칭 사용.", en: "Use conjugation and symmetry." }],
      [{ ko: "풀이를 단계로 쪼개기.", en: "Break the solve into stages." }, { ko: "군을 부분군·잉여류로 분해.", en: "Decompose into subgroups/cosets." }],
      [{ ko: "작은 영역만 건드리는 알고리즘.", en: "Algorithms touching a small region." }, { ko: "가지치기 표로 막다른 가지 차단.", en: "Pruning tables cut dead branches." }],
    ],
  },
  p(
    "큐브는 손에 들어오지만, 그 수학은 순열군·그래프 이론·휴리스틱 탐색, 그리고 역사상 가장 유명한 계산 증명 중 하나에까지 닿는다.",
    "The cube fits in your hand, but its mathematics reaches into permutation groups, graph theory, heuristic search, and one of the most famous computational proofs ever."
  ),

  hr(),
  h2("기억할 숫자들", "Numbers Worth Remembering"),
  {
    t: "table",
    head: [{ ko: "사실", en: "Fact" }, { ko: "값", en: "Value" }],
    rows: [
      [{ ko: "전체 합법 상태", en: "Total legal states" }, { ko: "≈ 43경", en: "≈ 43 quintillion" }],
      [{ ko: "상태공간 공식", en: "State-space formula" }, { ko: "$\\frac{8! \\cdot 3^7 \\cdot 12! \\cdot 2^{11}}{2}$", en: "$\\frac{8! \\cdot 3^7 \\cdot 12! \\cdot 2^{11}}{2}$" }],
      [{ ko: "풀 수 있는 재조립 비율", en: "Solvable reassemblies" }, { ko: "$\\tfrac{1}{12}$", en: "$\\tfrac{1}{12}$" }],
      [{ ko: "God's Number (HTM)", en: "God's Number (HTM)" }, { ko: "20", en: "20" }],
      [{ ko: "God's Number (QTM)", en: "God's Number (QTM)" }, { ko: "26", en: "26" }],
      [{ ko: "평균 최적해", en: "Average optimal" }, { ko: "≈ 18수", en: "≈ 18 moves" }],
      [{ ko: "교환자 / 켤레", en: "Commutator / conjugate" }, { ko: "$[A,B]=ABA'B'$, $[A:B]=ABA'$", en: "$[A,B]=ABA'B'$, $[A:B]=ABA'$" }],
      [{ ko: "Kociemba Phase-1 = 잉여류 수", en: "Kociemba Phase-1 = # cosets" }, { ko: "$2187 \\times 2048 \\times 495 = 2{,}217{,}093{,}120$", en: "$2187 \\times 2048 \\times 495 = 2{,}217{,}093{,}120$" }],
      [{ ko: "증명된 해", en: "Year proven" }, { ko: "2010 (HTM), 2014 (QTM)", en: "2010 (HTM), 2014 (QTM)" }],
    ],
  },
];

// 한 화면에 다 안 들어오는 긴 아티클 → 3개 탭으로 분할(가독성).
// 경계는 Part 2 / Part 3 의 h2 제목으로 자동 산출(콘텐츠 편집에 견고).
//  - 탭1 "사람 풀이"   = 인트로 + Part 0(큰 그림) + Part 1
//  - 탭2 "컴퓨터 풀이" = Part 2
//  - 탭3 "God's Number" = Part 3 + 기억할 숫자들
export type MathTab = { id: string; label: L; blocks: MathBlock[] };

const partIdx = (n: number) =>
  MATH_BLOCKS.findIndex((b) => b.t === "h" && b.lvl === 2 && b.text.en.startsWith(`Part ${n}`));

const p2 = partIdx(2);
const p3 = partIdx(3);

export const MATH_TABS: MathTab[] = [
  { id: "humans", label: { ko: "사람 풀이", en: "Humans" }, blocks: MATH_BLOCKS.slice(0, p2) },
  { id: "computers", label: { ko: "컴퓨터 풀이", en: "Computers" }, blocks: MATH_BLOCKS.slice(p2, p3) },
  { id: "gods-number", label: { ko: "God's Number", en: "God's Number" }, blocks: MATH_BLOCKS.slice(p3) },
];
