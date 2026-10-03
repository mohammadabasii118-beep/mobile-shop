# CaseLine — Project Instructions

## Design System (MANDATORY)
`DESIGN.md` (repo root) is the single source of truth for all UI: tokens, RTL rules, mobile rules, components, admin dashboard, Do/Don't. It is an original CaseLine system (Framer + Nike + Linear/Vercel principles), not a copy of any of them.

**Before ANY UI change — anything in `src/components`, `src/pages`, `src/features`, `src/layouts`, `src/index.css`, `tailwind.config.js`, or any visual/CSS/layout/copy-in-UI edit — you MUST read `DESIGN.md` first** (the whole file, not a skim) and follow it.

Rules of engagement
1. Use only tokens from `DESIGN.md` (colors, type scale, spacing, radius, shadows, motion). Need something new? Propose adding it to `DESIGN.md` first.
2. Persian + RTL always: logical CSS properties (no `left/right/ml/mr/pl/pr` in new code), Persian digits and تومان in UI, Vazirmatn, **letter-spacing 0 for Persian**.
3. Mobile-first; verify 390px, 810px and 1440px. Touch targets ≥ 44px. No horizontal page scroll.
4. If a request conflicts with `DESIGN.md`, say so and ask before deviating.
5. **Do not redesign or restyle existing pages (`src/pages/*`, `src/components/*` used by the live storefront/admin) until the user has approved the new look.** New design work goes into the controlled demo (`/design-demo`) until approved.
6. Keep `/design-demo` in sync with `DESIGN.md` when tokens/components change.

## Stack & commands
React 18 + TypeScript + Vite + Tailwind + Framer Motion + React Three Fiber + Zustand. Persian, RTL.
`npm install` · `npm run dev` · `npm run typecheck` · `npm run build`
Single-file demo build: `DEMO_START=/design-demo npx vite build -c vite.demo.config.ts`

## Enforcement
`.claude/settings.json` registers a `PreToolUse` hook (`.claude/hooks/design-md-reminder.sh`) that reminds Claude to read `DESIGN.md` whenever a UI file is edited. It only reminds; the rule above is what binds.
