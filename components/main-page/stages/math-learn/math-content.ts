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
    "루빅스 큐브 안에는 수학이 숨어 있다. 이 글은 세 가지를 본다. 사람은 큐브를 왜 그렇게 푸는지, 컴퓨터는 어떻게 다르게 푸는지, 그리고 “20”이라는 숫자가 어떻게 퍼즐 수학에서 가장 유명한 숫자가 되었는지.",
    "There's math hiding inside a Rubik's Cube. This guide looks at three things: why people solve it the way they do, how computers solve it differently, and how the number “20” became the most famous number in puzzle math."
  ),
  callout(
    "먼저 용어 하나. 이 글에서 “1수”는 한 면을 한 번 돌리는 것이다. 90°(1/4 바퀴)를 돌려도 1수, 180°(반 바퀴)를 돌려도 1수로 센다. 이 방식을 “절반-회전 척도(HTM)”라고 부른다. 다른 방식(QTM)에서는 180°를 2수로 센다. 척도가 바뀌면 유명한 숫자도 달라지므로, 늘 어떤 척도인지 함께 적는다.",
    "First, one word. In this guide a “move” means turning one face once. A 90° quarter turn counts as one move, and a 180° half turn also counts as one move. This way of counting is the Half-Turn Metric (HTM). Another way, the Quarter-Turn Metric (QTM), counts a 180° turn as two. Since the metric changes the famous numbers, we always say which one we mean."
  ),

  // ── Part 0 ─────────────────────────────────────────────
  h2("Part 0 — 큰 그림", "Part 0 — The Big Picture"),
  p(
    "루빅스 큐브는 장난감 같지만, 사실은 아주 큰 수학 덩어리다. 이 글은 큰 질문 세 개에 답한다:",
    "A Rubik's Cube looks like a toy, but it's really a huge chunk of math. This guide answers three big questions:"
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
    "세 가지를 잇는 핵심 생각은 이렇다. 큐브는 너무 커서 운으로는 못 푼다. 그래서 거대한 문제 하나를 작고 다루기 쉬운 문제 여러 개로 쪼개야 한다. 사람은 외운 단계로 쪼개고, 컴퓨터는 부분군과 탐색으로 쪼갠다. 방법만 다를 뿐 같은 생각이다.",
    "One idea ties all three together. The cube is far too big to solve by luck. So you break one giant problem into many small, manageable ones. People break it up with memorized stages; computers with subgroups and search. Same idea, different tools."
  ),

  // ── Part 1 ─────────────────────────────────────────────
  h2("Part 1 — 사람은 어떻게 푸는가", "Part 1 — How Humans Solve the Cube"),
  h3("1.1 언어: 무브 표기법", "1.1 The language: move notation"),
  p(
    "거의 모든 설명서는 “싱매스터 표기법”을 쓴다(수학자 David Singmaster 의 이름). 여섯 면은 큐브를 든 방향대로 이름 붙는다. R(오른쪽), L(왼쪽), U(위), D(아래), F(앞), B(뒤). 글자 하나는 그 면을 바깥에서 봤을 때 시계방향으로 90° 돌리라는 뜻이다.",
    "Almost every guide uses Singmaster notation (named after mathematician David Singmaster). The six faces are named by how you hold the cube: R (right), L (left), U (up), D (down), F (front), B (back). A single letter means: turn that face 90° clockwise, seen from outside."
  ),
  code("R   = 오른쪽 면 90° 시계방향\nR'  = R 역회전 (반시계 90°, R 되돌리기)\nR2  = 오른쪽 면 180°"),
  p(
    "그래서 $R\\,U\\,R'\\,U'$ 는 “R 하고, U 하고, R 되돌리고, U 되돌리기”라는 뜻이다. 이 짧은 표기 덕분에 전 세계 큐버가 “알고리즘”(짧은 무브 묶음)을 서로 나누고 따져볼 수 있다. 두 면 사이의 가운데 층을 돌리는 “슬라이스 무브” $M, E, S$ 도 있다(Roux 에서 특히 많이 쓴다).",
    "So $R\\,U\\,R'\\,U'$ means: do R, do U, undo R, undo U. This short notation lets cubers everywhere share and reason about “algorithms” (short sets of moves). There are also slice moves $M, E, S$ that turn the middle layers (used a lot in Roux)."
  ),
  { t: "demo", label: { ko: "▶ R U R' U' 시연", en: "▶ Play R U R' U'" }, moves: "R U R' U'", note: { ko: "유명한 네 수 트리거(four-turn trigger). 몇 개 조각만 순환시키고 나머지는 그대로 둔다. 여섯 번 반복하면 다시 풀린다(차수 6).", en: "The famous four-turn trigger — cycles a few pieces and leaves the rest alone. Repeat it six times and the cube returns to solved (order 6)." } },

  h3("1.2 문제는 얼마나 큰가? 상태 공간", "1.2 How big is the problem? The state space"),
  p(
    "이제 모든 이야기를 흥미롭게 만드는 숫자가 나온다. 보통 3×3×3 큐브가 만들 수 있는 모양의 수는 정확히 이만큼이다:",
    "Now comes the number that makes everything interesting. The number of arrangements a standard 3×3×3 cube can make is exactly:"
  ),
  math("43{,}252{,}003{,}274{,}489{,}856{,}000"),
  p(
    "약 43경이다(43 뒤에 0이 18개). 이 거대한 수는 어디서 올까? 공식은 우리가 이미 아는 것, 팩토리얼과 거듭제곱만으로 만들어진다:",
    "That's about 43 quintillion (43 followed by 18 zeros). Where does such a huge number come from? The formula is built only from things you already know — factorials and powers:"
  ),
  math("|G| = \\frac{8! \\cdot 3^7 \\cdot 12! \\cdot 2^{11}}{2} = 43{,}252{,}003{,}274{,}489{,}856{,}000"),
  p(
    "하나씩 읽어보자. (작은 조각을 “큐비”라고 한다. 코너 8개, 모서리 12개. 가운데 센터 6개는 서로 자리가 안 바뀌므로 세지 않는다.)",
    "Let's read it part by part. (The little pieces are called cubies: 8 corners and 12 edges. The 6 center pieces never change place relative to each other, so we don't count them.)"
  ),
  {
    t: "table",
    head: [{ ko: "인수", en: "Factor" }, { ko: "무엇을 세는가", en: "What it counts" }],
    rows: [
      [{ ko: "$8!$", en: "$8!$" }, { ko: "코너 8개를 임의 순서로 배열: $8! = 40{,}320$ 가지.", en: "The 8 corners in any order: $8! = 40{,}320$ ways." }],
      [{ ko: "$3^7$", en: "$3^7$" }, { ko: "코너 하나는 3가지 방향으로 비틀 수 있다. 코너가 8개지만, 7개를 정하면 마지막 1개는 저절로 정해진다. 그래서 $3^8$ 이 아니라 $3^7$.", en: "Each corner can twist 3 ways. There are 8 corners, but once 7 are set, the last one is fixed automatically — so $3^7$, not $3^8$." }],
      [{ ko: "$12!$", en: "$12!$" }, { ko: "모서리 12개를 임의 순서로 배열.", en: "The 12 edges in any order." }],
      [{ ko: "$2^{11}$", en: "$2^{11}$" }, { ko: "모서리 하나는 2가지로 뒤집힌다. 마지막 1개는 나머지 11개로 정해진다. 그래서 $2^{12}$ 가 아니라 $2^{11}$.", en: "Each edge flips 2 ways. The last one is fixed by the other 11 — so $2^{11}$, not $2^{12}$." }],
      [{ ko: "$\\div 2$", en: "$\\div 2$" }, { ko: "패리티 규칙(아래)이 총합을 절반으로 자른다.", en: "A parity rule (below) cuts the total in half." }],
    ],
  },
  p(
    "“저절로 정해진다”와 “÷2”는 아무렇게나 붙인 게 아니다. 모든 올바른 회전이 늘 지키는 세 가지 규칙에서 나온다:",
    "The “fixed automatically” parts and the “÷2” aren't made up. They come from three rules that every legal turn always obeys:"
  ),
  {
    t: "list",
    ordered: true,
    items: [
      { ko: "코너 비틀림 규칙: 코너 8개의 비틀림을 모두 더하면 항상 3의 배수다. 그래서 코너 하나만 비틀어 둘 수는 없다. ($3^7$)", en: "Corner-twist rule: add up the twists of all 8 corners and you always get a multiple of 3. So you can never leave just one corner twisted. (the $3^7$)" },
      { ko: "모서리 뒤집힘 규칙: 뒤집힌 모서리의 개수는 항상 짝수다. 하나만 뒤집어 둘 수 없다. ($2^{11}$)", en: "Edge-flip rule: the number of flipped edges is always even. You can never leave just one flipped. (the $2^{11}$)" },
      { ko: "순열 패리티 규칙: 딱 두 조각만 서로 바꿀 수는 없다. 모든 맞바꿈은 어딘가의 다른 맞바꿈과 짝을 이룬다. ($\\div 2$)", en: "Permutation-parity rule: you can never swap exactly two pieces. Every swap is paired with another swap somewhere. (the $\\div 2$)" },
    ],
  },
  callout(
    "왜 중요할까? 큐브를 분해해서 아무렇게나 다시 끼우면, 12번 중 1번만 실제로 돌려서 풀 수 있다! 나머지 약 518경 가지 모양은 풀린 큐브에서 절대 만들 수 없는 “불가능한” 상태다. 잘못 조립한 큐브가 영원히 안 풀리는 이유가 이것이다.",
    "Why does this matter? Take a cube apart and put it back together at random, and only 1 in 12 times can it actually be solved by turning! The other ~518 quintillion arrangements are “impossible” states you can never reach from a solved cube. That's why a wrongly reassembled cube can stay stuck forever."
  ),

  h3("1.3 Layer-By-Layer (LBL): 입문 방법", "1.3 Layer-By-Layer (LBL): the beginner method"),
  p(
    "대부분 처음 배우는 방법은 한 층씩 푼다. 흔한 7단계 버전: ① 흰 십자 ② 첫 층 코너 ③ 둘째 층 모서리 ④ 노란 십자 ⑤ 노란 면(마지막 층 방향) ⑥ 마지막 층 코너 위치 ⑦ 마지막 층 모서리 위치.",
    "Most people first learn to solve one layer at a time. A common 7-stage version: (1) white cross (2) first-layer corners (3) second-layer edges (4) yellow cross (5) yellow face (orient last layer) (6) permute last-layer corners (7) permute last-layer edges."
  ),
  p(
    "왜 통할까(핵심): 첫 층을 다 풀고 나면, 둘째 층 알고리즘은 새 조각을 끼우면서 첫 층을 정확히 원래대로 되돌리도록 만들어져 있다. 도중에는 아래층이 잠깐 흐트러지지만, 끝나면 늘 제자리로 돌아온다. 수학으로 말하면, 이미 푼 조각을 건드리지 않는 무브만 골라 쓰는 것이다. 더 작고 안전한 무브의 세계인 셈이다.",
    "Why does it work (the key idea)? Once the first layer is done, the second-layer algorithms are built to insert a new piece and put the first layer back exactly as it was. The bottom gets disturbed for a moment, but it always comes back. In math terms, you only use moves that leave already-solved pieces untouched — a smaller, safer world of moves."
  ),
  p(
    "장단점: LBL 은 배우기 쉽지만(알고리즘 8~12개) 효율은 낮다. 아무 섞임이나 80~120수가 든다. 최적해는 평균 18수쯤이다. 그러니 입문자는 필요한 것보다 5~6배 많이 돌린다. 쉬운 대신 치르는 값이다.",
    "Pros and cons: LBL is easy to learn (8–12 algorithms) but not efficient. A random scramble takes 80–120 moves, while the best solution averages about 18. So beginners turn 5–6× more than needed — the price of being simple."
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
    "OLL 과 PLL 의 영리한 점은 “방향”과 “자리”를 따로 푸는 것이다. “조각이 어느 쪽을 향하나(방향)”와 “조각이 어디로 가나(자리)”를 서로 다른 문제로 나눠 푼다. 큐브 수학에서 계속 나오는 생각이다. 알고리즘 개수는 마지막 층이 $57\\text{(OLL)} + 21\\text{(PLL)} = 78$ 개. 여기에 F2L 41가지를 더해 흔히 119가지라고 말한다(실제로는 F2L 은 감으로 하고 78개만 외운다).",
    "The clever part of OLL and PLL is solving “direction” and “place” separately. “Which way a piece faces (orientation)” and “where a piece goes (position)” are treated as two different problems. This idea keeps coming back in cube math. For counts, the last layer is $57\\text{ (OLL)} + 21\\text{ (PLL)} = 78$ algorithms. Add 41 F2L cases and people often say 119 (in practice you do F2L by feel and memorize just the 78)."
  ),
  p(
    "왜 CFOP 가 LBL 보다 빠를까? LBL 은 코너를 다 맞춘 뒤 모서리를 다 맞춘다. 두 번의 작업이 서로를 방해한다. F2L 은 코너와 모서리를 한 쌍으로 묶어 같이 끼우므로 그 낭비가 사라진다. 그래서 한 번 풀 때 80~120수 대신 약 55~60수면 된다.",
    "Why is CFOP faster than LBL? LBL places all the corners, then all the edges — two passes that get in each other's way. F2L pairs a corner with an edge and inserts them together, so that waste disappears. The result: about 55–60 moves per solve instead of 80–120."
  ),

  h3("1.5 Roux: 층 대신 블록", "1.5 Roux: blocks instead of layers"),
  p(
    "Roux 방법(2003, Gilles Roux)은 “층”을 버리고 블록을 쌓는다. ① 왼쪽에 1×2×3 블록을 만든다. ② 오른쪽에도 짝이 되는 블록을 만든다(왼쪽 블록은 안 깨고). ③ CMLL — 마지막 층의 코너만 맞춘다(알고리즘 42개), 가운데 모서리는 잠시 무시. ④ LSE — 마지막 모서리 6개를 $M$ 과 $U$ 무브만으로 감 잡아 마무리한다.",
    "Roux (2003, Gilles Roux) drops “layers” and stacks blocks. (1) Build a 1×2×3 block on the left. (2) Build a matching block on the right (without breaking the first). (3) CMLL — solve only the last-layer corners (42 algorithms), ignoring the middle edges for now. (4) LSE — finish the last 6 edges by feel, using only $M$ and $U$ moves."
  ),
  p(
    "Roux 는 평균 45~50수로 CFOP 보다 적고, 큐브 전체를 거의 안 돌린다. 마무리가 특별한데, $M$ 과 $U$ 만 쓰는 아주 작고 빠른 무브 세계다. 단점은 블록 쌓기를 감으로 해야 해서 배우는 데 더 오래 걸린다는 점이다.",
    "Roux averages 45–50 moves — fewer than CFOP — and barely turns the whole cube. Its finish is special: a tiny, fast world of moves using only $M$ and $U$. The downside is that block-building relies on feel, so it takes longer to learn."
  ),

  h3("1.6 비밀 엔진: 교환자와 켤레", "1.6 The secret engine: commutators and conjugates"),
  p(
    "여기서 수학이 정말 아름다워진다. 거의 모든 큐브 알고리즘은, 어떤 방법이든, 두 가지 패턴으로 만들어진다.",
    "Here the math gets truly beautiful. Almost every cube algorithm — no matter the method — is built from just two patterns."
  ),
  p(
    "교환자(commutator). $[A, B]$ 로 쓰고, 뜻은 이렇다:",
    "Commutator. We write it $[A, B]$, and it means:"
  ),
  math("[A, B] = A \\cdot B \\cdot A' \\cdot B'"),
  p(
    "(“A 하고, B 하고, A 되돌리고, B 되돌리기.”) 핵심은 ‘상쇄’다. $A$ 와 $B$ 가 서로 완전히 다른 조각만 건드리면, 전체가 깔끔하게 상쇄돼 아무 일도 안 일어난다. 하지만 둘이 작은 영역에서 겹치면, 교환자는 그 겹친 조각만 바꾸고 나머지는 그대로 둔다. 풀이 막바지에 이미 푼 부분을 깨뜨릴까 봐 조심할 때, 바로 이게 필요하다.",
    "(“Do A, do B, undo A, undo B.”) The key is cancellation. If $A$ and $B$ touch completely separate pieces, the whole thing cancels out and nothing happens. But if they overlap in a small area, the commutator changes only those overlapping pieces and leaves the rest alone. That's exactly what you want late in a solve, when you're afraid of breaking what's already done."
  ),
  { t: "demo", label: { ko: "▶ 교환자 [R, U] 시연", en: "▶ Play commutator [R, U]" }, moves: "R U R' U'", note: { ko: "$[R, U] = R\\,U\\,R'\\,U'$ — 코너 몇 개만 순환.", en: "$[R, U] = R\\,U\\,R'\\,U'$ — cycles just a few corners." } },
  p(
    "켤레(conjugate). $[A : B]$ 로 쓰고, 뜻은 이렇다:",
    "Conjugate. We write it $[A : B]$, and it means:"
  ),
  math("[A : B] = A \\cdot B \\cdot A'"),
  p(
    "$A$ 는 준비 무브, $B$ 는 쓸모 있는 알고리즘, $A'$ 는 준비 되돌리기다. 즉 “준비 → 일하기 → 준비 풀기”. 덕분에 알고리즘 하나를 여러 상황에 다시 쓸 수 있다. 목표 조각을 알고리즘이 통하는 자리로 옮기고, 알고리즘을 돌린 뒤, 다시 제자리로 가져온다. 이 “작업장으로 옮겨서 일하고 도로 가져오기” 패턴은 LBL, CFOP, Roux, 블라인드까지 어디에나 나온다.",
    "$A$ is a setup move, $B$ is a useful algorithm, and $A'$ undoes the setup: “set up → do the work → undo the setup.” This lets you reuse one algorithm in many situations: carry a target piece to where the algorithm works, run it, then carry everything back. This “move it to the workbench, work, move it back” pattern shows up everywhere — LBL, CFOP, Roux, even blindfolded solving."
  ),
  { t: "demo", label: { ko: "▶ 켤레 [F : R U R' U'] 시연", en: "▶ Play conjugate [F : R U R' U']" }, moves: "F R U R' U' F'", note: { ko: "셋업 F → 네 수 트리거 → 셋업 해제 F'. 작용 영역이 옮겨진다.", en: "Setup F → four-turn trigger → undo F'. The region of effect shifts." } },
  callout(
    "패리티 한마디: 교환자는 항상 짝수 순열을 만든다. 그래서 지금 상태가 홀수 패리티(예를 들어 딱 두 조각만 바뀐 경우)라면, 교환자로 마무리하기 전에 면 회전 1수를 먼저 넣어 패리티부터 고쳐야 한다.",
    "A note on parity: a commutator always makes an even permutation. So if your position has odd parity (for example, exactly two pieces swapped), you must first add a single face turn to fix the parity before commutators can finish the job."
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
    "큰 생각의 전환이 필요하다. 스티커 대신 “변환”을 떠올려 보자. 무브는 그림이 아니라, 한 상태를 다른 상태로 바꾸는 “함수”다. 무브를 이어서 하는 것은 함수를 합성하는 것이다. 이 한 가지 생각이 컴퓨터가 하는 모든 일의 문을 연다.",
    "You need one big change in thinking. Instead of stickers, picture transformations. A move isn't a picture — it's a function that turns one state into another. Doing moves in a row is composing functions. This single idea opens the door to everything computers do."
  ),
  h3("2.1 큐브는 “군(group)”이다", "2.1 The cube is a “group”"),
  p(
    "수학에서 “군(group)”이란, 합치고 되돌리고 반복할 수 있는 동작들의 모음이다. 그러면서 늘 같은 시스템 안에 머문다. 큐브가 여기에 딱 들어맞는다:",
    "In math, a “group” is a collection of actions you can combine, undo, and repeat — always staying inside the same system. The cube fits this perfectly:"
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
    "마지막 줄이 중요하다. 큐브 군은 “비가환”이다(순서가 중요하다는 뜻). 바로 이 점이 큐브를 흥미롭고 어렵게 만든다. 군의 크기는 Part 1 의 43경과 같다.",
    "That last row matters. The cube group is non-commutative (order matters). This is exactly what makes the cube interesting and hard. The size of the group is the same 43 quintillion from Part 1."
  ),
  callout(
    "(욕심내는 사람을 위해) 정식 구조는 $G \\cong \\left[ \\left( \\mathbb{Z}_3^7 \\rtimes S_8 \\right) \\times \\left( \\mathbb{Z}_2^{11} \\rtimes S_{12} \\right) \\right]^{1/2}$ 로 쓴다. 지금 외계어처럼 보여도 괜찮다. “코너는 자리를 바꾸고 비틀리고, 모서리는 자리를 바꾸고 뒤집히며, 거기에 패리티 규칙이 붙는다”를 정확하게 적은 것일 뿐이다. Part 1 의 공식이 멋진 옷을 입은 모습이다.",
    "(For the ambitious) the formal structure is written $G \\cong \\left[ \\left( \\mathbb{Z}_3^7 \\rtimes S_8 \\right) \\times \\left( \\mathbb{Z}_2^{11} \\rtimes S_{12} \\right) \\right]^{1/2}$. It's fine if that looks like alien script right now. It just precisely records “corners change place and twist, edges change place and flip, plus the parity rules.” It's the Part 1 formula wearing a fancy outfit."
  ),
  p(
    "왜 굳이 군으로 볼까? 막연한 감을 정확한 도구로 바꿔 주기 때문이다. 부분군은 “더 작은 무브의 세계”, 잉여류(coset)는 “거대한 상태 공간을 똑같은 크기로 자른 덩어리”, 불변량은 “무엇이 불가능한지 설명하는 규칙”이다. 케일리 그래프는 퍼즐 전체를 지도로 그린 것이다. 상태는 점, 무브는 점을 잇는 선, 푸는 것은 “풀린” 점까지 가는 길을 찾는 일이다.",
    "Why bother seeing it as a group? Because it turns vague intuition into precise tools. A subgroup is “a smaller world of moves,” a coset is “a chunk of the huge state space cut into equal pieces,” and an invariant is “a rule that explains what's impossible.” The Cayley graph draws the whole puzzle as a map: states are dots, moves are lines between dots, and solving is finding a path to the “solved” dot."
  ),
  h3("2.2 왜 사람 방법은 최단해를 못 찾나", "2.2 Why human methods can't find the shortest"),
  p(
    "사람 방법은 풀린 상태로 가는 “한 가지 길”을 찾는다. 최적 솔버는 “가장 짧은 길”을 찾고, 더 짧은 길이 없다는 것까지 증명한다. 두 번째 일이 훨씬 어렵다. “가장 짧다”를 증명하려면 더 짧은 가능성을 하나도 빠짐없이 없애야 하기 때문이다. 그래서 사람은 50~120수를 쓰고, 컴퓨터는 약 18수를 찾는다.",
    "A human method finds one path to solved. An optimal solver finds the shortest path and even proves no shorter one exists. That second job is much harder: to prove “shortest,” you have to rule out every shorter possibility. That's why people use 50–120 moves while computers find about 18."
  ),
  h3("2.3 Thistlethwaite 알고리즘 (1981): 중첩 부분군", "2.3 Thistlethwaite's Algorithm (1981): nested subgroups"),
  p(
    "Morwen Thistlethwaite 의 돌파구는 이것이다. 조각을 하나씩 풀지 말고, 큐브를 점점 좁아지는 부분군의 사슬에 깔때기처럼 통과시켜 마지막에 “풀림”만 남기자.",
    "Morwen Thistlethwaite's breakthrough was this: don't solve piece by piece. Instead, funnel the cube through a chain of shrinking subgroups until only “solved” is left at the end."
  ),
  math("G_0 \\supset G_1 \\supset G_2 \\supset G_3 \\supset G_4 = \\{I\\}"),
  math("\\begin{aligned} G_0 &= \\langle L, R, F, B, U, D \\rangle \\\\ G_1 &= \\langle L, R, F, B, U^2, D^2 \\rangle \\\\ G_2 &= \\langle L, R, F^2, B^2, U^2, D^2 \\rangle \\\\ G_3 &= \\langle L^2, R^2, F^2, B^2, U^2, D^2 \\rangle \\\\ G_4 &= \\{I\\} \\end{aligned}"),
  p(
    "각 단계가 큐브를 점점 더 좁은 세계로 몰아넣는다. ① $G_1$ — 모든 모서리의 방향을 고정한다(U/D 의 1/4 회전이 더는 필요 없음). ② $G_2$ — 코너의 방향을 고정하고, 슬라이스 모서리를 제 슬라이스로 보낸다. ③ $G_3$ — 절반 회전만으로 풀 수 있는 구조로 만든다. ④ $G_4$ — 절반 회전만으로 완전히 푼다.",
    "Each phase pushes the cube into a narrower world. (1) $G_1$ — fix every edge's orientation (no more U/D quarter-turns needed). (2) $G_2$ — fix the corners' orientation and send the slice edges into their slice. (3) $G_3$ — reach a structure solvable with half-turns only. (4) $G_4$ — fully solve using half-turns only."
  ),
  p(
    "왜 멋질까? 43경 전체를 뒤지는 대신, 각 단계는 훨씬 작은 “몫(quotient)” 문제만 탐색하고 미리 계산해 둔 표에서 답을 꺼낸다. Thistlethwaite 버전은 어떤 큐브든 52수 이하를 보장했다. 컴퓨터로 검증한 최초의 한계였다(나중에 45로 개선).",
    "Why is it brilliant? Instead of searching all 43 quintillion, each phase searches a much smaller “quotient” problem and looks up an answer in a precomputed table. Thistlethwaite's version guaranteed 52 moves or fewer for any cube — the first computer-verified bound (later improved to 45)."
  ),
  h3("2.4 Kociemba 2-Phase (1992): 실전 일꾼", "2.4 Kociemba's Two-Phase (1992): the workhorse"),
  p(
    "Herbert Kociemba 는 4단계를 2단계로 합쳤다. 1992년 Atari ST 에서 개발할 만큼 빨랐다. 핵심이 되는 가운데 부분군은 H-군(“도미노 군”)이다:",
    "Herbert Kociemba merged the four phases into two — fast enough to develop on a 1992 Atari ST. The key middle subgroup is the H-group (the “domino group”):"
  ),
  math("H = \\langle U, D, R^2, L^2, F^2, B^2 \\rangle"),
  p(
    "모든 방향이 이미 풀려 있고 가운데 슬라이스 모서리가 제 슬라이스에 있으면, 큐브는 “$H$ 안”에 있다. 그 순간 큐브는 납작한 2층 도미노 퍼즐처럼 행동해서 절반 회전만으로 풀린다. Phase 1 은 섞인 큐브를 $H$ 안으로 몰아넣고, Phase 2 는 $H$ 안에서 푼다. Phase 1 의 탐색 공간은 정확히 이만큼이다:",
    "When all orientations are already solved and the middle slice edges sit in their slice, the cube is “in $H$.” At that moment it behaves like a flat 2-layer domino puzzle, solvable with half-turns. Phase 1 drives the scramble into $H$; Phase 2 solves it from inside $H$. The Phase-1 search space is exactly:"
  ),
  math("2187 \\times 2048 \\times 495 = 2{,}217{,}093{,}120 \\text{ states}"),
  p(
    "이 숫자, 22억을 기억해 두자. God's Number 증명에서 다시 나온다. 실제로 Kociemba 솔버는 1000분의 1초 만에 18~20수짜리 답을 찾는다. 무료 프로그램 Cube Explorer 가 표준 도구다.",
    "Remember this number — 2.2 billion. It comes back in the God's Number proof. In practice, Kociemba solvers find 18–20 move solutions in milliseconds. His free program Cube Explorer is the standard tool."
  ),
  h3("2.5 IDA*: 밑바닥 탐색 엔진", "2.5 IDA*: the search engine underneath"),
  p(
    "위 두 알고리즘 모두 IDA*(반복 심화 A*, Richard Korf 가 고안)를 쓴다. ① 길이 0, 1, 2…를 차례로 늘려 가며 찾는다(심화). ② 매 단계 남은 무브 수의 “하한”을 어림한다. ③ (지금까지 쓴 수) + (하한)이 현재 깊이 한계를 넘으면, 그 가지는 버린다(가지치기). ④ 이 어림이 절대 실제보다 크지 않으므로, 어떤 깊이를 다 뒤졌을 때 처음 찾은 답이 곧 가장 짧은 답임이 증명된다.",
    "Both algorithms use IDA* (Iterative Deepening A*, invented by Richard Korf). (1) Search lengths 0, 1, 2… one at a time (deepening). (2) At each step, estimate a lower bound on the moves still left. (3) If (moves used) + (lower bound) exceeds the current depth limit, drop that branch (pruning). (4) Since this estimate is never larger than the truth, the first solution found at a fully searched depth is provably the shortest."
  ),
  p(
    "핵심 기술은 “패턴 데이터베이스”다. 큐브의 일부(예를 들어 코너 8개)만 푸는 데 드는 정확한 최소 수를 미리 표로 저장한 것이다. 일부만 푸는 일은 전체를 푸는 일보다 결코 더 어렵지 않으므로, 이 값은 안전한(허용 가능한) 하한이 된다. Korf 는 여러 표를 합쳤다:",
    "The key trick is the “pattern database.” It's a precomputed table of the exact minimum moves to solve just a part of the cube (for example, only the 8 corners). Solving a part is never harder than solving the whole, so this value is a safe (admissible) lower bound. Korf combined several tables:"
  ),
  math("h(\\text{cube}) = \\max\\!\\big(h_{\\text{corners}},\\; h_{\\text{edges 1}},\\; h_{\\text{edges 2}}\\big)"),
  p(
    "거짓말은 안 하면서도 더 큰 어림일수록 더 많은 가지를 안전하게 버릴 수 있다. 이 방법으로 Korf 의 1997년 솔버는 최적해의 중앙값이 18수임을 보였다.",
    "The bigger the estimate (while still never lying), the more branches you can safely throw away. With this, Korf's 1997 solver showed that the median optimal solution is 18 moves."
  ),
  h3("2.6 대칭: 같은 퍼즐을 두 번 풀지 마라", "2.6 Symmetry: don't solve the same puzzle twice"),
  p(
    "큐브에는 대칭이 48개 있다. 공간 회전 24가지에 거울상 2배를 곱한 값이다. 두 섞임이 서로 회전이나 거울상 관계일 뿐이면, 둘은 똑같이 어렵다(풀림까지 거리가 같다). 그래서 솔버는 대표 하나의 답만 저장하고 닮은꼴은 건너뛴다. 2010년 최종 증명에서 이 덕분에 작업량이 2,217,093,120가지에서 55,882,296가지로, 약 40배 줄었다.",
    "A cube has 48 symmetries: 24 spatial rotations times 2 for mirrors. If two scrambles are just rotations or mirrors of each other, they're equally hard (the same distance from solved). So a solver stores the answer for one representative and skips the look-alikes. In the 2010 proof, this cut the work from 2,217,093,120 cases to 55,882,296 — about 40× fewer."
  ),
  h3("2.7 최악 한계를 좁힌 경주 (HTM)", "2.7 The race to bound the worst case (HTM)"),
  p(
    "30년 동안 수학자들은 최악의 숫자를 양쪽에서 좁혀 갔다. “이 값보다 작을 수는 없다”(하한)와 “이 값보다 클 수는 없다”(상한)를 차례로 증명하면서:",
    "For 30 years, mathematicians squeezed the worst-case number from both sides — proving “it can't be less than this” (the lower bound) and “it can't be more than this” (the upper bound):"
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
    "하한과 상한이 바이스(죔쇠)처럼 서로를 향해 조여든다. 1995년엔 답이 20과 29 사이에 갇혔다. 하지만 그 마지막 9수 간격을 닫는 데 15년과 구글급 컴퓨팅이 더 필요했다.",
    "The lower and upper bounds close in on each other like a vise. By 1995 the answer was trapped between 20 and 29 — but closing that last 9-move gap took another 15 years and Google-scale computing."
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
    "QTM 결과(26)는 2014년 Rokicki 와 Davidson 이 증명했다. 큐브 전체에서 26번의 1/4 회전이 온전히 필요한 위치는 딱 3개뿐이다.",
    "The QTM result (26) was proved by Rokicki and Davidson in 2014. In the entire cube, only three positions actually need a full 26 quarter-turns."
  ),

  // ── Part 3 ─────────────────────────────────────────────
  h2("Part 3 — God's Number 는 20", "Part 3 — God's Number Is 20"),
  h3("3.1 질문을 정확히", "3.1 The question, stated precisely"),
  p(
    "가장 나쁜 섞임을 완벽하게 풀면 몇 수가 필요할까? 어떤 상태 $s$ 에 대해, $d(s)$ 를 “$s$ 에서 풀림까지의 최단 수”라고 하자. God's Number 는 모든 상태 중에서 가장 나쁜 경우다:",
    "If you play the worst scramble perfectly, how many moves do you need? For a state $s$, let $d(s)$ be “the shortest number of moves from $s$ to solved.” God's Number is the worst case over all states:"
  ),
  math("\\text{God's Number} = \\max_{s \\in G}\\, d(s) = 20 \\quad (\\text{HTM})"),
  p(
    "Part 2 의 지도(케일리 그래프)로 말하면, God's Number 는 그래프의 “지름”이다. 어떤 상태와 풀림 사이의 “최단 경로” 중에서 가장 긴 것을 뜻한다. 모든 걸 아는 솔버라면, 아무리 고약한 섞임이라도 20수를 넘길 일이 없다.",
    "In the map language (Cayley graph) from Part 2, God's Number is the graph's “diameter” — the longest of all the “shortest paths” between any state and solved. An all-knowing solver never needs more than 20 moves, no matter how nasty the scramble."
  ),
  h3("3.2 superflip: 가장 유명한 어려운 위치", "3.2 The superflip: the most famous hard position"),
  p(
    "superflip 은 큐브 위치들 사이에서 유명 인사다. 코너 8개는 위치도 방향도 모두 정확하고 ✅, 센터 6개도 정확하다 ✅. 하지만 모서리 12개는 제자리에 있으면서도 전부 180° 뒤집혀 있다 ❌. 거의 다 풀린 것처럼 보이는데(다 제자리니까!), 모든 모서리가 반대로 향해 있어 공략할 틈이 없다. 풀린 큐브에서 여기에 이르는 한 가지 방법은 이렇다:",
    "The superflip is a celebrity among cube positions. All 8 corners are correct in both position and orientation ✅, and all 6 centers are correct ✅. But all 12 edges, while sitting in their slots, are flipped 180° ❌. It looks almost solved (everything's home!), yet every edge faces the wrong way, so there's no easy angle of attack. Here's one way to reach it from a solved cube:"
  ),
  { t: "demo", label: { ko: "▶ superflip 도달 시연 (20수)", en: "▶ Play to superflip (20 moves)" }, moves: "R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U", note: { ko: "끝나면 모든 모서리가 제자리지만 전부 뒤집혀 보인다.", en: "At the end every edge is home but flipped." } },
  p(
    "1995년 Michael Reid 가 superflip 은 정확히 20수가 필요하다는 것을 증명했다. 더 적게는 불가능하다. 이 결과가 하한을 20으로 끌어올렸다. 적어도 한 위치는 진짜로 20수가 필요하다는 뜻이다.",
    "In 1995, Michael Reid proved that the superflip needs exactly 20 moves — no fewer is possible. This pushed the lower bound up to 20: at least one position genuinely requires 20 moves."
  ),
  p(
    "superflip 은 대수적으로도 특별하다. 큐브 군의 “중심”에 있어서 모든 무브와 교환된다(앞에 하든 뒤에 하든 결과가 같다). 이 깊은 대칭이 superflip 이 그토록 풀기 까다로운 이유 중 하나다.",
    "The superflip is also special in algebra. It sits at the “center” of the cube group, so it commutes with every move (do it before or after anything, and the result is the same). This deep symmetry is part of why it's so stubborn."
  ),
  h3("3.3 2010 증명: 모든 큐브가 ≤ 20", "3.3 The 2010 proof: every cube in ≤ 20"),
  p(
    "superflip 은 God's Number 가 적어도 20이라는 것을 보여 줬다. 어려운 나머지 절반은 “최대 20”임을, 즉 어떤 위치도 21수 이상이 필요하지 않음을 증명하는 일이었다. Tomas Rokicki, Herbert Kociemba, Morley Davidson, John Dethridge 가 2010년 7월에 해냈다.",
    "The superflip showed that God's Number is at least 20. The hard other half was proving “at most 20” — that no position needs 21 or more. Tomas Rokicki, Herbert Kociemba, Morley Davidson, and John Dethridge did it in July 2010."
  ),
  p(
    "영리한 점은 이거다. 43경 상태 전부의 최적해를 찾은 게 아니라(그건 불가능하다), 각 상태가 “20수 이하짜리 어떤 해”를 가진다는 것만 증명했다. 그것으로 충분하다.",
    "Here's the clever part. They didn't find the optimal solution for all 43 quintillion states (that's impossible). They only proved that each state has some solution of 20 moves or fewer — and that's enough."
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
    "방법을 단계별로 보자. ① 잘게 나누기 — 43경 상태를 Kociemba $H$-군의 잉여류 22억 개(똑같은 크기의 덩어리)로 나눈다. ② 덩어리째 풀기 — 잉여류 하나(약 200억 상태)를 약 20초에 처리해, 그 안의 모든 상태가 20수 이하임을 증명한다. ③ 대칭 활용 — 48개의 대칭으로 22억 개를 약 5,600만 개로 줄인다. ④ 나눠서 돌리기 — 구글이 수천 대의 컴퓨터에 분산해, PC 한 대로는 약 35년 걸릴 일을 몇 주 만에 끝냈다.",
    "Let's see the method step by step. (1) Slice it up — divide the 43 quintillion states into 2.2 billion cosets of Kociemba's $H$-group (equal-sized chunks). (2) Solve a chunk at a time — handle one coset (~20 billion states) in about 20 seconds, proving every state in it is ≤ 20. (3) Use symmetry — 48 symmetries shrink 2.2 billion down to about 56 million. (4) Split the work — Google spread it across thousands of machines, finishing in weeks what one PC would take ~35 years."
  ),
  math("\\underbrace{\\text{superflip} = 20}_{\\geq 20} \\;+\\; \\underbrace{\\text{모든 상태} \\leq 20}_{\\leq 20} \\;\\Longrightarrow\\; \\boxed{\\text{God's Number} = 20}"),
  h3("3.4 20수 섞임은 얼마나 드문가", "3.4 How rare is a 20-move scramble?"),
  p(
    "풀림으로부터 거리별 상태 수(거리 15까지는 정확, 16~20은 추정):",
    "Number of states at each distance from solved (exact up to 15, estimated for 16–20):"
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
    "이 표가 말해 주는 것: 가장 많은 곳은 거리 18이다(약 29경). 평균 최적해는 약 18수다. 대부분의 섞임은 “18쯤”이지 20이 아니다. 거리 20인 위치는 터무니없이 드물어서, 대략 880억 섞임 중 1개꼴이다. 그래도 약 3억~5억 개는 존재하므로, 20은 어쩌다 나온 괴짜가 아니라 진짜 최악이다. 거리 15 이후의 수치는 아직 추정값일 뿐, 누구도 정확히 세지 못했다.",
    "What the table tells us: the biggest pile is at distance 18 (about 29 quintillion). The average optimal solution is about 18 moves. Most scrambles are “around 18,” not 20. Distance-20 positions are absurdly rare — roughly 1 in 88 billion scrambles. Still, about 300–490 million of them exist, so 20 is a real worst case, not a one-off freak. The counts past distance 15 are still only estimates — nobody has counted them exactly."
  ),
  h3("3.5 왜 놀라운가", "3.5 Why this is surprising"),
  p(
    "상태가 43경이나 되는데, 풀림에서 20수보다 멀리 떨어진 것이 하나도 없다. 어떻게 그럴까? 큐브가 쉬워서가 아니다. 무브 하나마다 수많은 새 가능성으로 갈라지기 때문에, “지도”가 믿기 힘들 만큼 촘촘히 연결돼 있어서다. 진짜 “좁은 세상” 네트워크인 셈이다. 점은 천문학적으로 많지만, 지름은 아주 작다.",
    "There are 43 quintillion states, yet not one is more than 20 moves from solved. How? Not because the cube is easy. It's because every move branches into many new possibilities, so the “map” is incredibly well-connected. It's a true “small-world” network: astronomically many dots, but a tiny diameter."
  ),
  p(
    "가장 깊은 교훈은, 네가 큐브를 푸는 방식과 이 증명이 작동하는 방식이 아름답게 닮았다는 점이다:",
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
    "큐브는 손바닥에 들어오는 작은 물건이지만, 그 속 수학은 순열군, 그래프 이론, 휴리스틱 탐색, 그리고 역사상 가장 유명한 컴퓨터 증명 중 하나에까지 닿는다.",
    "The cube fits in the palm of your hand, but the math inside it reaches all the way to permutation groups, graph theory, heuristic search, and one of the most famous computer proofs in history."
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
