# Brand system — Springfield Ave Dispensary redesign

"Premium, but with heart." One dark, green-tinted world lit by light, not paint; glass as the material; editorial type;
calm motion. Source of every value: `src/styles/tokens.css` (change values there, never at a call site).

## Colour

| Role | Token | Value | Use |
|---|---|---|---|
| Ground | `--bg-0 … --bg-4` | #040a06 · #07110b · #0b1810 · #102217 · #15301f | page and surfaces; never flat black |
| Ink | `--ink` | #f5f0e6 | headings, key text (warm off-white) |
| Ink, support | `--ink-2` / `--ink-3` / `--ink-4` | #d6cfc1 / #aea797 / #8c958c | body / labels / quiet meta — all ≥ 4.5:1 on the ground |
| Brand green as LIGHT | `--emerald`, `--emerald-deep` | 56 196 124 / 31 107 63 | radial pools, halos, card light-up; never a fill or a button |
| Warm glow | `--amber` | 240 172 92 | at most one small pool per screen; "Coming soon" badges |
| THE accent | `--accent` (+ `--accent-hi`, `--accent-lo`, `--accent-ink`) | #a3ce0c (the live site's own CTA lime) | every call to action, the today/active state, accent-word glow — nothing else |

## Type

- Display: **Bricolage Grotesque** 700–800, tight tracking, `text-wrap: balance`, fluid `clamp()` sizes (`--t-h1`, `--t-h2`, `--t-h3`).
- Accent word: **Instrument Serif** italic with the `--accent-word` gradient (`.accent`) — one word per key heading.
- Body: **Inter** (the live site's face), `--t-body` 16–17px, line-height 1.62; measure ≤ 68ch.
- Sign lettering: **Overpass** (`--f-sign`, the open Highway-Gothic model) — only on the street-sign plates of the hero, echoing the logo.
- Labels: `.eyebrow` — 12px, uppercase, 0.22em tracking, a short lime rule before it.
- Live copy keeps its DOM case; uppercase appears only through CSS on labels, badges and eyebrows.

## Material and shape

- Glass: `.glass` (fill + 1px light line + top sheen + blur 18px, 12px on phones), `.glass--strong` (modals, drawer),
  `.glass--lit` (emerald light from the top), `.glass--accent` (the one highlighted card per section).
- Radius: cards 22px (18 phones), tiles 18px, inputs 14px, badges 10px, buttons and chips pill.
- Depth: `--shadow-1`, `--shadow-2`; floating cut-outs use `.float` (drop shadow + soft emerald glow).

## Components (src/styles/components.css, src/lib/parts.mjs)

Buttons (`.btn--primary` lime gradient, `.btn--ghost` glass) · `.link-arrow` · chips / badges / stat chips · big stat
callouts (`.stat__num`, `--outline`) · tiles with dark product photography (`.tile`) · cards that lift and light up
(`.card--link`, `.card--hover`) · swipe rails with arrows (`[data-carousel]`) · deal cards + dialogs · marquee (outlined
words) · accordions (`details.acc`) · filters (`[data-filter-group]`) · forms (`.field`, `.form-status`) · the logo seal
(`.seal`: the real logo on a warm light disc) · inner-page hero (`pageHero`).

## Light and motion (src/styles/atmosphere.css)

A fixed haze layer (two drifting pools), section light pools (`.pool`, `--pool-x/-y`), film grain, rising particles,
floating cut-outs, breathing glows, marquees, staggered scroll reveals. Every animation stops with the pause control
(`html[data-motion="paused"]`, remembered) and under `prefers-reduced-motion`; a still marquee becomes a wrapped list.
Reveals never hide content without JavaScript.

## Layout rules

Sections ≤ about one screen at 1440x900; long lists become rails, tabs, filters or a link to a page; phones get compact
2-column grids and swipe rails; 44px tap targets; a sticky glass header and, on phones, a bottom dock (Deals · Shop Now ·
Get Directions); the hero always fits one screen with its main CTA visible.
