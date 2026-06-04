# The Mathematics of the Rubik's Cube — A Student's Guide

*A friendly tour of the math hiding inside the Rubik's Cube: why human solving methods work, how computers solve it differently, and why "20 moves" became one of the most famous numbers in puzzle math.*

This guide is written for a curious 11th-grader who likes math. You don't need university courses — just factorials, exponents, and a willingness to think about "actions you can combine and undo." Anything fancier is explained as we go.

> **One bit of vocabulary first — what counts as a "move"?**
> Throughout this guide, a "move" means turning one face, in what's called the **Half-Turn Metric (HTM)**. Turning a face 90° (a quarter turn) counts as **one move**, and turning it 180° (a half turn) *also* counts as **one move**. There's another counting system, the **Quarter-Turn Metric (QTM)**, where a 180° turn counts as **two moves**. The metric you pick changes some of the famous numbers, so we'll always say which one we mean.

---

## Part 0: The Big Picture

A Rubik's Cube looks like a toy, but it's secretly a giant math object. Here are the three big questions this guide answers:

1. **How do humans solve it?** (Part 1) — Staged methods like Layer-By-Layer, CFOP, and Roux.
2. **How do computers solve it, and how is that different?** (Part 2) — Group theory, clever algorithms, and search.
3. **What is the absolute hardest scramble, and how many moves does it need?** (Part 3) — The story of "God's Number = 20."

The single most important idea connecting all three: **the cube is enormous, so you can't solve it by luck — you have to turn one giant problem into a sequence of smaller, controlled problems.** Humans do this with memorized stages. Computers do this with subgroups and search. Both are the same idea wearing different clothes.

---

## Part 1: How Humans Solve the Cube

### 1.1 The language: move notation

Almost every cube tutorial uses **Singmaster notation** (named after mathematician David Singmaster). The six faces are named relative to how you're holding the cube:

| Symbol | Face  |
|--------|-------|
| `R`    | Right |
| `L`    | Left  |
| `U`    | Up    |
| `D`    | Down  |
| `F`    | Front |
| `B`    | Back  |

A plain letter = turn that face **90° clockwise** (as if you're looking straight at it from outside):

```
R  = turn the right face 90° clockwise
U  = turn the up face 90° clockwise
F  = turn the front face 90° clockwise
```

Two modifiers change the turn:

```
R'  = "R inverse" = right face 90° counterclockwise (undo an R)
R2  = right face 180°
```

So a sequence like `R U R' U'` reads: *do `R`, then `U`, then undo `R`, then undo `U`.* This compact language is why cubers all over the world can share "algorithms" (short move recipes) and reason about them. There are also **slice moves** (`M`, `E`, `S`) that turn the middle layers between two opposite faces — these matter a lot in the Roux method below.

### 1.2 How big is the problem? The state space

Here's the number that makes everything else interesting. A standard 3×3×3 cube has exactly:

$$43{,}252{,}003{,}274{,}489{,}856{,}000$$

reachable arrangements — about **43 quintillion** (43 followed by 18 digits). Where does that monster come from? Here is the actual formula, and it's built entirely out of things you already know — factorials and exponents:

$$|G| = \frac{8! \cdot 3^7 \cdot 12! \cdot 2^{11}}{2} = 43{,}252{,}003{,}274{,}489{,}856{,}000$$

Let's read it piece by piece. (The little cube pieces are called **cubies**: 8 corner pieces and 12 edge pieces. The 6 center pieces never move relative to each other, so they don't count.)

| Factor | What it counts |
|-------:|----------------|
| $8!$ | The 8 corner cubies can be arranged in any order: $8! = 40{,}320$ ways. |
| $3^7$ | Each corner can be twisted into 3 orientations. There are 8 corners, but once 7 are set, the 8th is *forced* — so $3^7$, not $3^8$. |
| $12!$ | The 12 edge cubies can be arranged in any order. |
| $2^{11}$ | Each edge can be flipped 2 ways, but the last edge is forced by the other 11 — so $2^{11}$, not $2^{12}$. |
| $\div 2$ | A parity rule (explained below) cuts the total in half. |

The "forced" parts and the "divide by 2" aren't arbitrary fudge factors — they come from **three physical laws** that every legal turn of the cube always obeys:

1. **Corner twist law.** Add up the twist of all 8 corners — it's always a multiple of 3. So you can never twist *just one* corner in place. (This is the $3^7$ instead of $3^8$.)
2. **Edge flip law.** The number of flipped edges is always **even**. You can never flip *just one* edge. (This is the $2^{11}$.)
3. **Permutation parity law.** You can never swap *exactly two* pieces — every swap must be paired with another swap somewhere. (This is the $\div 2$.)

**Why this matters:** if you pulled a cube apart and reassembled it randomly, only **1 out of every 12** reassemblies is actually solvable by turning! The other ~518 quintillion arrangements are physically impossible to reach from a solved cube — they're "illegal." That's a wild fact, and it's why people who reassemble a cube wrong can get stuck forever.

> **Takeaway:** 43 quintillion states is why you can't brute-force a cube in your head. Every human method is really a strategy for shrinking this giant problem into bite-sized stages.

### 1.3 Layer-By-Layer (LBL): the beginner method

The method most people learn first solves the cube one layer at a time. A common 7-stage version:

1. White cross (4 edges around the white center)
2. First-layer corners
3. Second-layer edges
4. Yellow cross
5. Yellow face (orient the last layer)
6. Permute last-layer corners
7. Permute last-layer edges

**Why it works (the key insight).** Once you've solved the first layer, the algorithms for the second layer are specially chosen so that they insert a new piece *and put the first layer back exactly as it was.* The pieces below get temporarily messed up during the algorithm, but they always return home by the end. Mathematically, you're restricting yourself to moves that **leave the already-solved pieces fixed** — a smaller, safer world of moves.

**The trade-off.** LBL is easy to learn (only ~8–12 algorithms) but inefficient: a random scramble takes **80–120 moves**. The best possible ("optimal") solution averages around **18 moves**. So beginners use roughly 5–6× more moves than necessary — that's the price of simplicity.

### 1.4 CFOP (the Fridrich Method): the speedcuber's choice

**CFOP** = **C**ross, **F**2L, **O**LL, **P**LL. It's popularly called the Fridrich Method after Jessica Fridrich, who popularized it online in the mid-1990s.

| Stage | What you do | The math idea |
|-------|-------------|---------------|
| **Cross** | Solve 4 bottom edges around a center. | Build a stable "reference frame" for everything else. |
| **F2L** | Solve each bottom corner *together with* its matching middle edge as a **pair**. | Do two jobs at once instead of two separate passes. |
| **OLL** | Orient all top pieces so the top face is one solid color. | Fix **orientation** first, ignore position for now. |
| **PLL** | Slide the top pieces into their correct spots. | Now fix **position**, since orientation is already done. |

The clever idea in OLL/PLL is **separating orientation from permutation** — solve "which way pieces face" and "where pieces go" as two independent problems. That's a recurring theme in cube math.

How many algorithms? Full CFOP last-layer is:

$$57 \text{ (OLL)} + 21 \text{ (PLL)} = 78 \text{ algorithms}$$

Add the 41 F2L cases and references often quote **119 total cases**. (In practice most cubers do F2L by intuition and only memorize the 78.)

**Why CFOP beats LBL:** in LBL you place all corners, *then* all middle edges — two passes that keep disturbing each other. F2L fuses a corner + edge into one pair and inserts them together, killing that wasted effort. Result: about **55–60 moves** per solve instead of 80–120.

### 1.5 Roux: building blocks instead of layers

The **Roux Method** (created by Gilles Roux in 2003) throws out the "layers" idea and builds **blocks**:

| Phase | Goal |
|-------|------|
| First block | Build a 1×2×3 block on the left side. |
| Second block | Build a matching 1×2×3 block on the right, without wrecking the first. |
| **CMLL** | Solve the last-layer corners (42 algorithms), ignoring the middle edges. |
| **LSE** (Last Six Edges) | Finish the 6 remaining edges using only middle-slice (`M`) and top (`U`) moves — no memorized algorithms, pure intuition. |

Roux averages **45–50 moves** — even fewer than CFOP — and barely rotates the whole cube. Its finish is special: you only ever use `M` and `U` turns, which is a tiny, fast world of moves. The catch is that block-building is intuitive and takes longer to *learn*.

### 1.6 The secret engine: commutators and conjugates

Here's where the math gets genuinely beautiful. Most cube algorithms — across *every* method — are built from two patterns.

**Commutator.** Written $[A, B]$, it means:

$$[A, B] = A \cdot B \cdot A' \cdot B'$$

("Do $A$, do $B$, undo $A$, undo $B$.") The magic is **cancellation**: if $A$ and $B$ touch completely separate pieces, the whole thing cancels to nothing. But if they *overlap in a small region*, the commutator changes **only those overlapping pieces** and leaves the entire rest of the cube untouched. That's exactly what you want at the end of a solve, when you're terrified of breaking what you've already done.

```
[R, U] = R U R' U'
```

This is the famous **"sexy move."** It cycles just a few corner pieces and leaves everything else alone.

**Conjugate.** Written $[A : B]$, it means:

$$[A : B] = A \cdot B \cdot A'$$

Here $A$ is a **setup move**, $B$ is a useful algorithm, and $A'$ undoes the setup:

```
setup  →  do the useful thing  →  undo the setup
```

This lets you reuse *one* algorithm in *many* situations: move a target piece into the spot where your algorithm works, run the algorithm, then move everything back. This "carry the piece to the workshop, work on it, carry it home" pattern shows up in LBL, CFOP, Roux, blindfolded solving — everywhere.

> **Parity footnote:** commutators always produce an **even** permutation. So if a position has *odd* parity (like exactly two pieces swapped), you must first insert a single face turn to fix the parity before commutators can finish.

### 1.7 Part 1 cheat sheet

| Method | Algorithms to memorize | Average moves |
|--------|------------------------|---------------|
| LBL (beginner) | ~8–12 | 80–120 |
| CFOP (full) | 119 | 55–60 |
| Roux | ~42 + intuition | 45–50 |
| **Optimal (computer)** | — | **~18** |

---

## Part 2: How Computers Solve the Cube (and Why It's Different)

The big mental shift: stop thinking about *stickers* and start thinking about *transformations*. A move isn't a picture — it's a **function** that turns one cube state into another. A sequence of moves is just **function composition**. This one idea unlocks everything computers do.

### 2.1 The cube is a "group"

In math, a **group** is a collection of actions you can **combine, undo, and repeat**, while always staying inside the same system. The cube fits this perfectly:

| Group idea | What it means on the cube |
|------------|---------------------------|
| **Element** | A legal move sequence (or the state it produces from solved). |
| **Operation** | Composition: do one sequence, then another. |
| **Identity** | "Do nothing" — the solved state. |
| **Inverse** | Undo a sequence by reversing it. The inverse of `R U F` is `F' U' R'`. |
| **Generators** | The 6 basic face turns, written $\langle U, D, R, L, F, B \rangle$ — every state is reachable from these. |
| **Non-commutative** | Order matters! `R U` and `U R` give *different* results. |

That last point is important: the cube group is **non-abelian** (order matters), which is exactly what makes it interesting and hard. Its size is the same 43 quintillion from Part 1.

> *(For the ambitious: the formal structure is written $G \cong \left[ \left( \mathbb{Z}_3^7 \rtimes S_8 \right) \times \left( \mathbb{Z}_2^{11} \rtimes S_{12} \right) \right]^{1/2}$. Don't worry if that's gibberish right now — it's just a precise bookkeeping of "corners can be permuted and twisted, edges can be permuted and flipped, with the parity rules attached." It's the formula from Part 1 in fancy clothes.)*

Why bother framing it as a group? Because it converts vague solving intuition into precise tools:

- **Subgroups** = smaller worlds of moves (e.g., "only half-turns allowed").
- **Cosets** = a way to slice the giant state space into equal, organized chunks.
- **Invariants** = the laws that explain impossibilities (why you can't flip one edge).
- **Cayley graph** = turn the whole puzzle into a **map**: every state is a dot (vertex), every move is a line (edge) connecting two dots. Solving = finding a path back to the "solved" dot.

### 2.2 Why human methods can't find the shortest solution

A human method finds **a** path to solved. An **optimal** solver finds **the shortest** path — and *proves* nothing shorter exists. That second job is dramatically harder, because proving "shortest" means ruling out *every* shorter possibility. That's why humans use 50–120 moves while computers find ~18.

### 2.3 Thistlethwaite's Algorithm (1981): solving through nested subgroups

Morwen Thistlethwaite's breakthrough idea: don't solve piece by piece — instead **funnel the cube through a chain of shrinking subgroups** until only "solved" is left.

$$G_0 \supset G_1 \supset G_2 \supset G_3 \supset G_4 = \{I\}$$

$$\begin{aligned}
G_0 &= \langle L, R, F, B, U, D \rangle \quad\text{(everything allowed)}\\
G_1 &= \langle L, R, F, B, U^2, D^2 \rangle \\
G_2 &= \langle L, R, F^2, B^2, U^2, D^2 \rangle \\
G_3 &= \langle L^2, R^2, F^2, B^2, U^2, D^2 \rangle \quad\text{(only half-turns)}\\
G_4 &= \{I\} \quad\text{(solved)}
\end{aligned}$$

Each phase forces the cube into a more restricted world:

| Phase | Reaches | What gets locked in |
|-------|---------|---------------------|
| 1 | $G_1$ | All edge orientations fixed; no more U/D quarter-turns needed. |
| 2 | $G_2$ | Corner orientations fixed; slice edges placed in their slice. |
| 3 | $G_3$ | Everything forced into a half-turn-only structure. |
| 4 | $G_4$ | Solve with only half-turns. |

**Why this is brilliant:** instead of searching all 43 quintillion states, each phase only searches a *much smaller* "quotient" problem and looks the answer up in a precomputed table. Thistlethwaite's version guaranteed any cube in **≤ 52 moves** — the first-ever computer-verified bound. (Later refinements pushed it to 45.)

### 2.4 Kociemba's Two-Phase Algorithm (1992): the practical workhorse

Herbert Kociemba collapsed Thistlethwaite's four phases into **two**, and it runs fast enough that he developed it on a 1992 Atari ST. The key middle subgroup is the **H-group** (or "domino group"):

$$H = \langle U, D, R^2, L^2, F^2, B^2 \rangle$$

A cube is "in $H$" when all orientations are already solved and the middle-slice edges sit in their slice — at that point the cube behaves like a flat 2-layer domino puzzle solvable with half-turns.

| Phase | Goal | Search space |
|-------|------|--------------|
| Phase 1 | Drive the scramble *into* $H$. | All face turns, tracked by 3 numbers: edge orientation, corner orientation, slice-edge placement. |
| Phase 2 | Solve from inside $H$. | Only $\langle U, D, R^2, L^2, F^2, B^2 \rangle$. |

The Phase 1 search space is exactly:

$$2187 \times 2048 \times 495 = 2{,}217{,}093{,}120 \text{ states}$$

Remember that number — **2.2 billion** — because it comes back in the God's Number proof. In practice, Kociemba solvers find **18–20 move** solutions in *milliseconds*. His free program **Cube Explorer** is the standard tool.

### 2.5 IDA*: the search engine underneath

Both algorithms above use a search method called **IDA\*** (Iterative Deepening A*), invented by Richard Korf. The idea:

1. Look for a solution of length 0, then 1, then 2, and so on (deepening).
2. At each step, estimate a **lower bound** on how many moves are still needed.
3. If (moves used) + (lower bound) > current depth limit, **give up on that branch** (prune it).
4. Because the estimate *never overshoots*, the first solution you find at a completed depth is **provably the shortest**.

The crucial trick is the **pattern database**: a precomputed table storing the *exact* minimum number of moves to solve a *piece* of the cube — say, just the 8 corners. Solving part of the cube is never harder than solving all of it, so these are safe ("admissible") lower bounds. Korf combined several:

$$h(\text{cube}) = \max\!\big(h_{\text{corners}},\; h_{\text{edges 1}},\; h_{\text{edges 2}}\big)$$

The bigger (but still honest) the estimate, the more branches you can safely throw away. With this, **Korf's 1997 solver showed the median optimal solution is 18 moves.**

### 2.6 Symmetry: don't solve the same puzzle twice

A cube has **48 symmetries**: 24 ways to rotate it in space, times 2 for mirror images. If two scrambles are just rotations or mirrors of each other, they're *equally hard* — same distance from solved. So solvers store the answer for **one** representative and skip all its look-alikes. In the final 2010 proof, this cut the work from **2,217,093,120** cases down to **55,882,296** — about 40× less work.

### 2.7 The race to bound the worst case (HTM timeline)

For 30 years, mathematicians chipped away at the worst-case number from both sides — proving it couldn't be *less* than some value (lower bound) and couldn't be *more* than some value (upper bound):

| Date | Lower | Upper | Who |
|------|------:|------:|-----|
| by 1980 | 18 | — | counting arguments |
| Jul 1981 | 18 | 52 | Thistlethwaite |
| Dec 1990 | 18 | 42 | Hans Kloosterman |
| May 1992 | 18 | 39 | Michael Reid |
| May 1992 | 18 | 37 | Dik Winter |
| Jan 1995 | 18 | 29 | Michael Reid (analyzing Kociemba) |
| **Jan 1995** | **20** | 29 | **Reid proves superflip needs 20** |
| Dec 2005 | 20 | 28 | Silviu Radu |
| 2006–2008 | 20 | 27→22 | Radu, Kunkle & Cooperman, Rokicki & Welborn |
| **Jul 2010** | **20** | **20** | **Rokicki, Kociemba, Davidson, Dethridge** |

Notice the lower and upper bounds squeezing toward each other like a vise. By 1995 the answer was trapped between 20 and 29 — but closing that last 9-move gap took **15 more years** and Google-scale computing.

### 2.8 HTM vs. QTM

| Metric | One move = | God's Number |
|--------|-----------|-------------:|
| **HTM** | any face turn (90°, 180°, or 270°) | **20** |
| **QTM** | only a 90° turn (180° counts as 2) | **26** |

The QTM result (26) was proved by Rokicki and Davidson in 2014. Only **three** positions in the entire cube need a full 26 quarter-turns.

---

## Part 3: God's Number Is 20

### 3.1 The question, stated precisely

> *From the worst possible scramble, if you play perfectly, how many moves do you need?*

For state $s$, let $d(s)$ = the length of the *shortest* solution from $s$. Then **God's Number** is the worst case over all states:

$$\text{God's Number} = \max_{s \in G}\, d(s) = 20 \quad (\text{HTM})$$

In the map (Cayley graph) language from Part 2: God's Number is the **diameter** of the graph — the longest "shortest path" between any state and solved. An all-knowing solver would *never* need more than 20 moves, no matter how evil the scramble.

### 3.2 The superflip: the most famous hard position

The **superflip** is the celebrity of cube positions:

- All 8 corners: correct position **and** correct orientation. ✅
- All 6 centers: correct. ✅
- All 12 edges: in their **correct slots** — but **every single one is flipped** 180°. ❌

It looks *almost solved* (everything is home!) yet every edge faces the wrong way, so there's no easy angle of attack. From a solved cube, one way to reach it is:

```
R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U
```

In **1995, Michael Reid proved the superflip needs exactly 20 moves** — no fewer. That single result raised the *lower bound* to 20: at least one position genuinely requires 20.

The superflip is also algebraically special — it sits in the **center** of the cube group, meaning it **commutes with every move** (you can do it before or after anything and get the same result). That deep symmetry is part of why it's so stubborn.

### 3.3 The 2010 proof: every cube in ≤ 20

The superflip showed God's Number is *at least* 20. The hard half was proving it's *at most* 20 — that **no** position needs 21 or more. Tomas Rokicki, Herbert Kociemba, Morley Davidson, and John Dethridge did it in July 2010.

The clever move: **they didn't find the optimal solution for all 43 quintillion states** (impossible). They only proved each state has *some* solution of length ≤ 20 — which is enough.

| Ingredient | Value |
|------------|-------|
| Total states | 43,252,003,274,489,856,000 |
| Number of cosets (using the $H$-group) | 2,217,093,120 |
| States per coset | 19,508,428,800 |
| Cosets left after using symmetry | 55,882,296 |
| Computing used | ~35 CPU-years (donated by Google) |

**The method, step by step:**

1. **Slice it up.** Partition all 43 quintillion states into **2.2 billion cosets** (equal-sized chunks) of Kociemba's $H$-group. (There's that 2.2 billion again from Part 2!)
2. **Solve a whole chunk at once.** They wrote a program that could handle an entire coset (~20 billion states) in about **20 seconds**, proving every state in it solves in ≤ 20.
3. **Use symmetry.** The 48 symmetries shrank 2.2 billion cosets down to ~56 million that actually needed checking.
4. **Distribute the work.** Google ran it across thousands of computers, finishing in weeks what one PC would take ~35 years to do.

Combine the two halves:

$$\underbrace{\text{superflip needs 20}}_{\text{lower bound: } \geq 20} \;+\; \underbrace{\text{every state} \leq 20}_{\text{upper bound: } \leq 20} \;\Longrightarrow\; \boxed{\text{God's Number} = 20}$$

### 3.4 How rare is a 20-move scramble?

Here's the exact (through distance 15) and estimated (16–20) breakdown of how far states are from solved:

| Distance | Number of positions |
|---------:|--------------------:|
| 0 | 1 |
| 1 | 18 |
| 2 | 243 |
| 3 | 3,240 |
| 4 | 43,239 |
| 5 | 574,908 |
| 6 | 7,618,438 |
| 7 | 100,803,036 |
| 8 | 1,332,343,288 |
| 9 | 17,596,479,795 |
| 10 | 232,248,063,316 |
| 11 | 3,063,288,809,012 |
| 12 | 40,374,425,656,248 |
| 13 | 531,653,418,284,628 |
| 14 | 6,989,320,578,825,358 |
| 15 | 91,365,146,187,124,313 |
| 16 | ≈ 1,100,000,000,000,000,000 |
| 17 | ≈ 12,000,000,000,000,000,000 |
| 18 | ≈ 29,000,000,000,000,000,000 |
| 19 | ≈ 1,500,000,000,000,000,000 |
| 20 | ≈ 490,000,000 |

What this tells us:

- **The peak is at distance 18** (~29 quintillion states). The **average** optimal solution is about **18.32 moves**. Most scrambles are "18-ish," not 20.
- **Distance-20 positions are absurdly rare** — roughly **1 in 88 billion** scrambles. Yet there are still ~**300–490 million** of them, so 20 is a *real* worst case, not a single freak position.
- The counts past distance 15 are still only estimates — nobody has computed them exactly.

### 3.5 Why this is surprising

43 quintillion states, but **nothing is more than 20 turns from solved.** How? Not because the cube is easy — because each move branches into many new possibilities, so the "map" is **incredibly well-connected**. It's a true *small-world* network: astronomically many dots, but a tiny diameter.

The deepest lesson is the beautiful parallel between how *you* solve a cube and how the *proof* works:

| Human solving | Computational proof |
|---------------|---------------------|
| Protect pieces you've already solved. | Search inside subgroups that keep things fixed. |
| Use setup moves, then undo them. | Use conjugation and symmetry. |
| Break the solve into stages. | Decompose the group into subgroups and cosets. |
| Use algorithms that touch a small region. | Use pruning tables to cut off dead-end branches. |

The cube fits in your hand, but its mathematics reaches into permutation groups, graph theory, heuristic search, and one of the most famous computational proofs ever done.

---

## Quick Reference: The Numbers Worth Remembering

| Fact | Value |
|------|-------|
| Total legal cube states | $43{,}252{,}003{,}274{,}489{,}856{,}000$ (≈ 43 quintillion) |
| State-space formula | $\dfrac{8! \cdot 3^7 \cdot 12! \cdot 2^{11}}{2}$ |
| Fraction of reassemblies that are solvable | $\tfrac{1}{12}$ |
| God's Number (HTM) | **20** |
| God's Number (QTM) | **26** |
| Average optimal solution | ≈ 18.32 moves |
| Commutator / conjugate | $[A,B] = ABA'B'$ , $[A:B] = ABA'$ |
| CFOP last-layer algorithms | $57 + 21 = 78$ |
| Kociemba Phase-1 space = # of cosets | $2187 \times 2048 \times 495 = 2{,}217{,}093{,}120$ |
| Year God's Number was proven | 2010 (HTM), 2014 (QTM) |

---

## Sources

The research behind this guide draws on:

- **Rokicki, Kociemba, Davidson, Dethridge**, "The Diameter of the Rubik's Cube Group Is Twenty," *SIAM J. Discrete Math.* (2013) — the God's Number proof. <https://tomas.rokicki.com/rubik20.pdf>
- **Cube20.org** — public summary of the 2010 and 2014 proofs. <https://www.cube20.org/>
- **Richard E. Korf**, "Finding Optimal Solutions to Rubik's Cube Using Pattern Databases," AAAI (1997). <https://cdn.aaai.org/AAAI/1997/AAAI97-109.pdf>
- **Herbert Kociemba**, "The Two-Phase Algorithm." <https://kociemba.org/math/twophase.htm>
- **Jaap Scherphuis**, "Useful Mathematics" & "Thistlethwaite's algorithm," Jaap's Puzzle Page. <https://www.jaapsch.net/puzzles/theory.htm>
- **Ryan Heise**, on commutators, conjugates, and parity. <https://www.ryanheise.com/cube/>
- **Speedsolving.com Wiki** (CFOP, commutators) and **Ruwix** (LBL, Roux) tutorials.
- **David Singmaster**, *Notes on Rubik's Magic Cube* (1981) — origin of standard notation.
