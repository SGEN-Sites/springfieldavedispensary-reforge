# Build contract — Springfield Ave Dispensary redesign

Binding for every builder (human or agent). The owner brief is `docs/OWNER-BRIEF.md`; decisions and open owner calls
are in `docs/CHANGE-LOG.md`. P = `Code/clones/springfield-ave-dispensary`.

## 1. Layout

```
src/content/site.json            page list: path, id, template, evidence slugs, head (title/description/canonical/og/ld)
src/content/shared.json          chrome copy (nav, footer, NAP, hours, age gate) — every string proved
src/content/pages/<id>.json      one content model per page — every string proved
src/content/images.json          every shipped picture (prepare-images.py) — key, file, w, h, alt, origin
src/content/ui-labels.json       DECLARED strings the redesign adds (aria labels, "Pause motion", filter "All", new page
                                 meta for /deals + 404). {text, why}. Never a claim, price, stat or fact.
src/content/removals.json        DECLARED live strings not carried, each with a reason (parity reads it)
src/lib/h.mjs                    escape / attribute / relative-link / picture helpers
src/lib/chrome.mjs               head, header, drawer, dock, footer, age gate — shared by every page
src/pages/<template>.mjs         export function render(ctx) -> { main, head?, bodyClass?, scripts? }
src/styles/{tokens,base,atmosphere,components,chrome}.css   the design system (lead-owned)
src/styles/pages/<template>.css  page CSS (lane-owned). Uses tokens + components; adds no new colours/fonts/radii.
src/scripts/site.js              shared behaviour (lead-owned); page JS in src/scripts/<template>.js if needed
src/tools/build.mjs              -> dist/  (node src/tools/build.mjs)
dist/                            the deliverable. Every link relative, so dist/ works from any folder.
```

## 2. Pages (54 outputs: the 22 below + 32 owner-supplied posts, 2026-11-05)

| path | id / evidence | template |
|---|---|---|
| `` (home) | index | home |
| `shop/` | shop | shop |
| `shop/<flower|pre-rolls|vaporizers|concentrates|edibles|topicals|accessories>/` | shop-<cat> | shop-category |
| `about/` | about | about |
| `blog/` | blog | blog |
| `blog/<live-rosin-science|understanding-terpenes|edibles-101-dosing|sativa-summer-picks|community-cleanup-recap>/` | blog-<slug> | post |
| `careers/` | careers | careers |
| `bundles/` | bundles | bundles |
| `loyalty/` | loyalty | loyalty |
| `contact/` | contact | contact |
| `deals/` (NEW, brief) | deals; evidence index + index/deal-modals.json | deals |
| `404.html` (NEW, brief) | notfound | notfound |
| `blog/<slug>/` x 32 (NEW, owner 2026-11-05) | blog-<slug>; evidence import-<slug> (+ its three related posts' import-<slug>, blog, blog-understanding-terpenes); list in `src/content/imports.json` | post |

The 32 owner-supplied posts are DERIVED files: a local converter (kept in `audit/imports/`, not shipped) writes each
`src/content/pages/blog-<slug>.json`, `src/content/imports.json`, the imported items of `pages/blog.json` and
`ui-labels.d/blog-imports.json` (the posts' head fields + their one declared label, the date) from the untouched source
and its declared rules; `prove-content` proves every string against `audit/pages/import-<slug>/` (the source text after
those rules, marked as import evidence, not a live capture). Change a post by changing the rules and re-running the
converter, never by hand: its `--check` mode fails on any hand edit.

Head fields (title, description, canonical, og, twitter, JSON-LD) are the LIVE rendered values (from
`audit/pages/<id>/harvest.json`), never rewritten. New pages get declared meta (ui-labels.json).

## 3. Content rules (hard)

- Every visible string comes from the live Springfield page it belongs to: `audit/pages/<id>/rendered.html` (DOM text —
  title case; the live site uppercases with CSS), `expanded.json` (FAQ answers, career details), `index/deal-modals.json`
  (the seven deal details). Copy it exactly; style case with CSS (`text-transform`), never by retyping.
- **Nothing from the sister store.** The shared bundle carries Central Jersey Dispensary content (Somerset, CJD staff
  and storefront photos, a "Delivery Zone Expansion" post). Any "Central Jersey", "Somerset", "cjd" in src/ or dist/ fails.
- No invented facts: no phone number (there is none), no reviews, no prices/stats beyond the live ones, no people.
- A live string not carried goes in `removals.json` with a reason. Live defects are kept verbatim and listed in
  CHANGE-LOG (e.g. "New to Treehouse?").
- `node src/tools/prove-content.mjs` must print PASS (every content string proved or declared).
- `node src/tools/parity.mjs` must print PASS (every live text run, link, head field, alt and form field present).

## 4. DOM hooks (the gates read these — do not rename)

| hook | meaning |
|---|---|
| `a.skip-link[href="#main"]` | first focusable |
| `header.site-header` | sticky glass header; `[data-status]` open/closed (live wording), `[data-shop-now]` |
| `button.menu-toggle[aria-controls="drawer"][aria-expanded]` | phone/tablet menu (< 1100px) |
| `#drawer[role=dialog][aria-modal=true]` | slide-out menu; contains `[data-status]` + `[data-shop-now]` |
| `nav.dock` | phone bottom bar (< 768px): Shop Now + Deals + Directions |
| `aside.pickup[data-pickup]` | order bar (>= 768px wide AND >= 500px tall; not on the `shop/` pages; in the DOM between `main` and the footer): the live status (`[data-status]`), Order Online -> `shop/`, Get Directions; `button[data-pickup-x]` hides it for the visit (sessionStorage `sad-pickup-bar` = `off`, re-read on a back/forward-cache restore). JS adds `.is-on` once the visitor has scrolled and `main`'s first section is above the top 30%, drops it over the footer, whenever a `form` reaches the bottom fifth of the screen and while a form field has focus; CSS hides it under the drawer and the age gate, and without JS; `html` gets `scroll-padding-bottom: 120px` there so a focused control never sits under it. `check.mjs` R5 pins it shown for its contrast pass, hidden where the footer is on screen |
| `main#main` | one per page; `main > section` = a page section |
| `section.hero[data-hero]` | first section on pages that have a hero; must fit one screen |
| `[data-primary-cta]` | the hero's main action; must be visible without scrolling |
| `footer.site-footer` | shared footer |
| `#age-gate[role=dialog][aria-modal=true]` | `[data-age-yes]`, `[data-age-no]`; localStorage `sad-age-verified` = `{"v":1,"at":<ms>}` (30 days); No -> https://google.com (live behaviour) |
| `button[data-motion-toggle][aria-pressed]` | pause all motion; sets `html[data-motion="paused"]`; localStorage `sad-motion` |
| `[data-reveal]` | scroll reveal. Visible with no JS and under reduced motion; JS adds `.is-in` |
| `[data-carousel]` > `[data-rail]` + `button[data-prev]` / `button[data-next]` | swipe rows |
| `[data-filter-group]` > `button[aria-pressed]` | tabs / filters |
| `[data-day="0..6"]` (0 = Sunday) | weekly special; JS sets `data-today` from America/New_York; opens `dialog#deal-<day>` |
| `.marquee` > `.marquee__track` | marquee; the duplicate half is `aria-hidden="true"` |
| `form[data-api="/api/…"]` + `[data-form-status][aria-live=polite]` | live endpoints + payloads (CHANGE-LOG) |
| `[data-dutchie][data-category]` | Dutchie embed slot (shop pages) |

## 5. Design system (summary — tokens.css is the source)

- World: deep green-black ground, brand green used only as LIGHT (radial pools, glows, vignettes), one warm amber glow
  used sparingly, warm off-white ink. ONE accent for every call to action: the brand lime (`--accent`).
- Material: glass (`.glass`, `.glass--strong`): translucent fill, backdrop blur, 1px light border, top sheen.
- Type: display `Bricolage Grotesque` 700–800 (headings), accent word `Instrument Serif` italic with the glow gradient
  (`.accent`), body `Inter`. Eyebrow labels `.eyebrow` (small, tracked, uppercase). Headings use `clamp()` and
  `text-wrap: balance`; never wider than their column, never more than ~4 lines on a 360px phone.
- Radii: cards/panels `--r-card` (22px), tiles `--r-tile` (18px), buttons/chips pill, inputs `--r-input` (14px).
- Spacing: section padding `--sec-y` (clamp 56–96px), gutters `--gutter` (16px phones -> clamp up to 48px), grid gap
  `--gap`. No section taller than about one screen at 1440x900; long lists become rails (`[data-carousel]`), tabs or a
  link to a dedicated page.
- Motion: ambient (haze drift, rising particles, breathing glow), staggered reveals, card lift + light-up on hover,
  marquees. All of it stops with the pause control and under `prefers-reduced-motion`. Motion never hides content.
- Phones: decorative cut-outs smaller or hidden, two-column compact grids, swipe rails, 44px targets, bottom dock.

## 6. Gates (run on the build you ship)

```
node src/tools/build.mjs
node src/tools/prove-content.mjs           # PASS
node src/tools/parity.mjs                  # PASS
sh src/tools/browser-lock.sh node src/tools/check.mjs --paths <paths> [--vp …]   # PASS (rendered rules + functional)
sh src/tools/browser-lock.sh node src/tools/a11y-axe.mjs --paths <paths>         # 0 violations
```
This Mac is a shared 8 GB machine: every headless browser goes through `browser-lock.sh` (2 slots). One browser per
agent, closed after use. No full-site captures inside a lane.
