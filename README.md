# Rubik's Cube Solver & Learning Webapp

An interactive 3D Rubik's Cube app that scans your real cube with a camera, solves it,
and teaches you how — step by step in 3D, with a built-in math article on the theory
behind the puzzle. Korean / English bilingual.

Built on top of [dejwi/rubiks-app](https://github.com/dejwi/rubiks-app), extended with
camera vision, guided-learning, camera-tracked solving, and a math-learning mode.

## Features

- **3D cube** — single shared Three.js scene/cubies driven by Zustand; manual input and
  solving share one instance.
- **Camera scan** — OpenCV.js Web Worker (`public/cv-worker.js`) detects the cube face via
  `Canny → dilate → findContours → 9-neighbor anchor → 3×3 sticker lattice`, then samples
  sticker colors with a trimmed-mean to reject logos / grid lines / shadows. Face
  orientation is auto-detected, so you can hold the cube any way up.
- **Manual input** — drag stickers to recreate a scrambled state.
- **Two solvers**, both emitting face moves only (shared visualization / normalization):
  - `learn` — Layer-by-Layer (LBL), ~98 moves, full explanations.
  - `fast` — Thistlethwaite wrapper, 4 stages ~31 moves (falls back to LBL on failure).
  - A normalization pipeline (`lib/solver/normalize.ts`) restores standard centers via cube
    rotation, solves, then remaps face labels back to the original frame.
- **Learn mode** — follow the real solve step by step on your own cube, with friendly
  step aliases, 3D move-arrow hints, free camera, and reset.
- **Camera-tracked solve** — forward-model move detection: predicts the visible faces for
  each of 15 candidate moves and Hamming-matches against the observation. *(Camera field
  validation still in progress.)*
- **Math-learn mode** — a bilingual (KaTeX) article on the math of the cube, with demo
  buttons that animate the shared cube and highlight only the pieces that changed (yellow
  outline). Split into 3 tabs: human method / computer method / God's Number.
- **i18n & a11y** — Korean / English toggle (`next-intl`), keyboard-accessible UI.

## Stack

Next.js 14, React 18, Three.js, Zustand, GSAP, KaTeX, Tailwind, shadcn/ui, TypeScript (strict).

## Cube convention

- Colors: U=Yellow, R=Green, F=Red, D=White, L=Blue, B=Orange.
- 54-char facelet string: U(0–8) R(9–17) F(18–26) D(27–35) L(36–44) B(45–53), each face
  left-top → right-bottom, row-major.
- Supported moves: faces `U/D/F/B/L/R`, slices `M/E/S`, rotations `x/y/z` (each with `'` / `2`).

## Dev

This repo uses **pnpm**.

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm dev-https      # HTTPS (needed for camera on some browsers; see certificates/)
pnpm test           # unit tests (solver / i18n / vision)
pnpm build
npx tsc --noEmit    # typecheck
```

Optional: `NEXT_PUBLIC_DEV_MODE=true` enables a small dev menu in the bottom-left corner.

## License

See [LICENSE](LICENSE).
