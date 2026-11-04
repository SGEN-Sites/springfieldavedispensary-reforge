# Change log — decisions, findings and open owner calls

Evidence lives in `audit/`: the server HTML (`audit/raw/`), the rendered pages after the 21+ gate
(`audit/pages/<slug>/rendered.html`, `text.txt`, `harvest.json`, `expanded.json`, `live-1440.png`, `live-390.png`).

## Source facts (2026-11-04)

- `springfieldavedispensary.com` 301s to `https://springfieldavedispensary.store/`. 20 URLs, all in the sitemap, crawl not
  truncated. Robots: allow all except `/css-export /seo-export /compare /templates/ /seo/` (honoured).
- The live site is a React (Vite) single-page app. The homepage HTML is an empty `#root`; the other 19 routes ship a
  prerendered SEO snapshot that differs from what the browser draws (see F3). Content source of truth = the RENDERED page.
- **The JS bundle is shared with a sister store, Central Jersey Dispensary (tenant `cjd`, Somerset NJ).** It carries CJD's
  copy, hours, logo, interior hero, staff photo (live alt "Central Jersey Dispensary staff at the counter"), storefront
  photo (alt "Central Jersey Dispensary storefront in Somerset, NJ") and a sixth blog post ("New Delivery Zone Expansion")
  that the Springfield site never renders. **None of that is used.** Only strings and images the Springfield pages render.
- Menu = Dutchie embedded menu: script `https://dutchie.com/api/v2/embedded-menu/699a62e4906190ac014a622c.js?menuType=rec`
  → iframe `dutchie.com/embedded-menu/springfield-ave-dispensary/`; category pages point the iframe at
  `/products/<flower|pre-rolls|vaporizers|concentrates|edibles|topicals|accessories>`; filter links use
  `?dtche[category]=<slug>` (the live code's own scheme).
- Forms POST JSON to same-origin endpoints on the live server (tenant id `site:"sfd"`, the bundle constant `w2`): `/api/contact` {site,name,email,phone?,message},
  `/api/careers/apply` {site,role,name,email,phone?,availability?,experience?,resumeUrl?,message?},
  `/api/newsletter/subscribe` {email,site,source:"home_vip_newsletter"}. They only work when served by that host.
- Real Springfield imagery: the logo (518x510 JPG on white), ONE store-interior photo (382x510), six category product
  shots on black (896x1280), five blog pictures. That is all.

## Findings on the live site that need an owner call (open)

| # | Finding | Where | What the rebuild does until decided |
|---|---|---|---|
| F1 | "New to **Treehouse**? Every first-time purchase gets 20% off" names a different dispensary | home, First Visit card | keeps the live words verbatim, flagged |
| F2 | Bundles + Loyalty say COMING SOON / LAUNCHING SOON on the rendered pages | home, /bundles, /loyalty | kept as live (rendered) |
| F3 | Prerendered SEO snapshots differ from the rendered pages: bundles $130/$130/$210 vs rendered From $100/$100/$180; loyalty snapshot reads as a live program | /bundles, /loyalty server HTML | rendered (visitor-facing) values used; the snapshots' copy is not carried |
| F4 | Delivery: home/about/FAQ say free delivery on $60+; /shop says "Delivery launching soon — join our VIP waitlist" | /shop | both kept verbatim, flagged |
| F5 | No phone number anywhere on the Springfield site (the brief asks for phone on Contact; curbside says "just text us when you pull up") | contact, home | no phone shown; never invented |
| F6 | No photography of people for Springfield (the staff photo in the bundle is CJD's) and the one interior photo is 382x510 | about | About uses the interior photo at sizes it can carry + graphic storytelling; owner photos requested |
| F7 | Three footer social icons link to `#` | footer | not carried (no destination) until the owner gives the profiles |
| F8 | Category pages: "Delivery orders placed after 9:00 PM will be scheduled for next-day delivery" while the store closes at 8 PM | /shop/<category> | kept verbatim, flagged |
| F9 | Live age gate is remembered for the browser SESSION only (sessionStorage) | all | the brief asks to remember the answer: localStorage, 30 days |

## Redesign decisions (lead, 2026-11-04)

| # | Decision | Why |
|---|---|---|
| D1 | One accent for every call to action = the brand's own lime (live `--accent-cta` #a3ce0c); the brand green (#2a6b2a family) appears only as light (pools, glows, halos) | brief: one accent, green as light |
| D2 | Display type Bricolage Grotesque, accent words Instrument Serif italic with a lime-to-mint glow gradient, body Inter (the live site's own face); all self-hosted (latin subsets, 141 KB) | brief typography; no runtime font host |
| D3 | Headings keep the live DOM case (title case); the live site uppercases with CSS — the redesign uppercases only eyebrows, badges and labels | warmer editorial read; text-transform keeps the words identical |
| D4 | Age gate remembers "Yes" for 30 days (localStorage `sad-age-verified`), "No" goes to google.com as live | brief: remembers the answer (live used sessionStorage, F9) |
| D5 | Today's deal uses the America/New_York weekday (live used the visitor's local weekday); the open/closed status is the live function ported word for word | the store's day, everywhere on the page |
| D6 | "Deals" added to the nav, footer and phone dock; "View All Deals" now opens the new /deals page (live linked it to /shop) | brief page 8 needs a path in |
| D7 | Footer gains a "More" column linking the live but un-navigated /bundles and /loyalty pages | live pages were reachable only from home cards |
| D8 | Floating product cut-outs are made from the live category shots by a luminance key + edge fade (src/tools/prepare-images.py); no image was generated | brief: floating cut-outs; no AI spend without the owner's OK |
| D9 | Phone bottom dock: Deals · Shop Now · Get Directions | brief: primary actions always in reach on phones |

## Findings from the page lanes (2026-11-04) — open owner calls

| # | Finding | Where | What the rebuild does |
|---|---|---|---|
| F10 | Dutchie answers **403 "you have been blocked"** (bot protection) to this Mac's headless browser, so the menu could not be seen rendering in any automated check. The embed script loads, the iframe is created and pointed at the right `/products/<slug>` path in every case | /shop, /shop/<cat> | embed kept exactly as live; **must be confirmed in a real browser on the production host**; Dutchie may need a new host allowed in the store's embed settings (unverified) |
| F11 | The /shop hero "Get Directions" link is a bare `https://maps.google.com` with no destination | /shop | kept verbatim; recommend the site's directions link |
| F12 | Category pages show hours "Mon–Sat: 9AM – 8PM" only (no Sunday) | /shop/<cat> | kept verbatim |
| F13 | Blog "Load More" loads nothing (all 5 posts already shown) | /blog | removed, declared in src/content/removals.d/blog.json |
| F14 | Blog "Updates" filter has no posts; the live page shows no empty state | /blog | chip kept; declared line "No posts in this category yet." |
| F15 | The Community Clean-Up post's picture is a delivery van (file `blog-delivery`) | /blog, post | kept verbatim (it is what Springfield renders) |
| F16 | Article claims carried verbatim: "Over 60 volunteers showed up", staff-favourite strains "from the current menu", edibles dosing advice | posts | kept; owner/compliance to confirm they are current |
| F17 | About has only three live mission paragraphs; the rebuild adds the live homepage "Rooted in Irvington" paragraph and the live site stats. Longer story copy (founders, history, community work) must come from the owner | /about | no copy invented |
| F18 | Live stats (200+ Strains, 500+ Products, 20+ Brands, 9+ Communities Served, 4.8★ Reviews) have no source anywhere on the live site | home, about | carried verbatim; owner to confirm or source |
| F19 | Careers copy implies more than one store ("across both stores", "neighborhood dispensaries") | /careers | kept verbatim |
| F20 | Careers role details: the live cards had two disclosures; the rebuild uses one per card labelled "Details" (declared) holding both live lists | /careers | owner to confirm the label |
| F21 | The Loyalty card's "Join the VIP List" links to /loyalty (live), while the VIP signup form is on the homepage | home | kept as live |
| F22 | /contact's LIVE meta and social descriptions say "…hours, phone number, and contact form" / "…directions, phone, and a contact form" but no phone exists | /contact head | head kept verbatim (SEO parity); owner to supply a number or approve rewording |
| F23 | The Google map on /contact is tinted dark with a CSS filter (invert + hue-rotate) to sit in the dark world; seen once with third parties allowed, never on a production host | /contact | owner may prefer Google's untinted map (one line in src/styles/pages/contact/02-main.css) |
| F24 | Bundles on phones: a rail of three cards of different heights leaves ~130–170px of empty ground under the shorter cards | /bundles | owner may approve accordions on phones instead |
| F25 | The Dutchie embed draws its own (white) menu inside the dark site; its theme is set in Dutchie's admin, not here | /shop, /shop/<cat> | embed kept as live |
| F26 | 404 copy is declared, not live: "Page not found" + "The page you were looking for has moved or no longer exists." (the live 404 was a developer placeholder) | 404 | owner to confirm wording |

## More redesign decisions (lead, 2026-11-04, after the lanes)

| # | Decision | Why |
|---|---|---|
| D10 | Big "outlined" stat callouts are rendered as accent-lit gradient digits, not stroked outlines | a stroke on the variable display font draws its overlapping contours inside 9 / 5 / +, and an opaque-filled outline measured 1.1–1.5:1 in the contrast gate; marquee words (decorative) stay outlined, painted stroke-under-fill |
| D11 | Every form names its live endpoint as `action` (method post) and carries `site`/`source` as hidden inputs, in addition to the JS JSON post | a form must still submit without JavaScript (skill gate: "form has no action") |
| D12 | The 404 page is `noindex` and names no canonical | a canonical on a page served at any missing URL is wrong |
| D13 | Header at 1100–1279px: tighter nav spacing, status shows its label only | the full header overflowed the window sideways at those widths (found by the lanes, outside the gate's default sizes) |
| D14 | /deals shows the seven deals with full detail and terms in the cards; the homepage keeps the live click-to-open dialogs | the brief: "the full weekly specials … on one page" |
| D15 | The About hero shows two live fact chips (Minority-Women Owned, Irvington, NJ); the "CRC Licensed" credential stays where the live site states it (home) | the live About page makes no licence claim |
| D16 | **Hero = Option A "The Corner Sign" (owner pick, 2026-11-04)**: the logo's two street-sign plates on a glowing pole, the New Jersey silhouette as emerald light and the store photo as a small lit shop window, beside the unchanged hero copy. Options board: audit/labs/hero-options/ (A, B, C + current); the previous hero is kept in src/labs/hero-options/v1/ | owner chose A from three street-sign options |
| D17 | Sign lettering uses Overpass (the open Highway-Gothic model, self-hosted, 39 KB, latin), token `--f-sign`, ONLY on sign plates — a fourth face, accepted with option A | the logo's signage voice |
| D18 | The rendered gate's contrast rule (check.mjs R5) no longer rates sticky text at positions where another layer covers it (the menu filter chips sliding under the header at 1920x1080 measured 4.31:1 while invisible). A deliberately darkened chip copy still fails (8 chips caught) | a gate must not grade hidden text |
| D19 | The contact map iframe is out of the tab order (`tabindex="-1"`); keyboard users get the "Get Directions" link beside it (the full Google Maps route) | focus on a cross-origin map frame cannot show a reliable focus ring |
| D20 | A swipe rail with nothing focusable inside (Loyalty tiers, Bundles) takes keyboard focus itself while it overflows, named by its section heading | axe `scrollable-region-focusable` (serious) on phones |
| D21 | The hero sign plates draw their words from `data-text` with CSS (pixel-identical: max diff 0 at 1440 and 390) | the plates are aria-hidden decoration repeating the brand name; keeping them out of the document text avoids duplicate brand copy (and a false "credential" run in the skill's claim scan) |

## Skill gate on the published build (final5, dist de2ddbfc390262a4; 2026-11-04)

`sr-gate` (graded workspace `reforge/`): **NOT-READY — PASS 25 · FAIL 2 · UNPROVEN 2 of 29** (gate self-test: 29/29 checks
proven able to fail). Not packaged: `sr-package` refuses over a red gate without the owner's `--force --why`.

| Check | Result | Why |
|---|---|---|
| C22 pixel match to the source | FAIL (worst drift 92.3%) | a redesign by brief, not a copy — structural |
| C23 responsive sweep | FAIL (135 majors) | 128 = words inside the clipped, moving marquees (the sweep exempts only overflow-x scrollers; check.mjs R1 proves no page scrolls sideways at any size) + 7 = Deals card buttons named by `aria-labelledby` (the sweep reads only text/aria-label/title; axe: 0 button-name issues in 46 scans) |
| C11 source animations reproduced | UNPROVEN | the live Tailwind keyframes are replaced by the brief's motion on purpose (source spec kept: reforge/audit/skill/motion.source.css) |
| C12 preset library | UNPROVEN | no SGEN preset library was used; the design is bespoke to the owner brief (naming "closest presets" would invent provenance) |

Project gates on the same build: prove-content PASS (1151 strings, 0 unproved), parity PASS (649 live text runs, 0
missing; 208 links; 291 head fields; 34 form items), check.mjs PASS (22 pages x 6 sizes, 1426 checks), axe PASS (46 scans,
0 serious/critical), sr-parity PARITY (99.9% recall), sr-fabrication SOURCED (137 claims), sr-decontaminate CLEAN.
