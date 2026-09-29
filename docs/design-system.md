# CaseLine Design System (v0.1 — demo)

Direction: warm-neutral canvas, ink-black secondary, coral primary, teal accent. Deliberately not blue (BluVibe reference is blue-toned). Product-first, rounded, RTL/Persian, mobile-first.

| Token | Light | Dark |
|---|---|---|
| Primary | #F2542D | #FF6A45 |
| Secondary | #14161F | #F1EFE9 |
| Accent | #14B8A6 | #2DD4BF |
| Background | #F6F5F2 | #0E1016 |
| Surface | #FFFFFF | #171A23 |
| Text | #14161F | #F1EFE9 |
| Muted | #6B6F7B | #9A9EAB |
| Border | #E4E1DA | #2A2E3B |
| Success / Warning / Error | #12A150 / #D98A06 / #DC2F3C | #34D27B / #F0B23A / #FF6B76 |

- Typography: Vazirmatn Variable; H1 36–60px/900, section titles 20–24px/800, body 14–16px.
- Radius: 8 / 12 / 20px. Shadow: sm / md / lg (tokens in `app/globals.css`).
- Spacing: Tailwind 4px scale; section rhythm 32px; container max 1280px, 16/24/32px gutters.
- Buttons: primary, secondary (ink), outline, ghost; heights 36/44/48px. Badges: pill. Cards: 20px radius, 1px border, hover shadow.
- Theme: Light / Dark / System, saved in `localStorage` (`caseline-theme`); inline `<head>` script applies it before first paint (no flash).
