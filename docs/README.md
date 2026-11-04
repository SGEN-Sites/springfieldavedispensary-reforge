# Springfield Ave Dispensary — redesign

A full-site redesign of https://springfieldavedispensary.store/ (the live site is a React single-page app; this build is
static HTML/CSS/JS with no framework and no runtime dependency). Every word comes from the live Springfield pages; the
look is new. The owner's brief (`docs/OWNER-BRIEF.md`) is kept in the working project; decisions and open owner calls are in `docs/CHANGE-LOG.md`;
the design language is `docs/BRAND-SYSTEM.md`; going live is `docs/DEPLOY.md`; builder rules are `docs/BUILD-CONTRACT.md`.

## Build

```
node src/tools/build.mjs                 # -> dist/   (--preview for a noindex preview, --out <dir>, --only <ids|templates>)
python3 -I src/tools/prepare-images.py   # re-derive the pictures from the live files (only when sources change)
node src/tools/gen-site.mjs              # re-derive the page list + live head fields from the captures
```

Look at it: `sh src/tools/browser-lock.sh node src/tools/shoot.mjs --path home --vp 1440x900,390x844 --full`
(writes PNGs under audit/shots/), or serve `dist/` with any static server. The age gate shows once per browser.

## Gates

```
node src/tools/prove-content.mjs         # every string traced to the live site or declared (src/content/ui-labels*.json)
node src/tools/parity.mjs                # every live text run, link, head field, alt and form field is in the build
sh src/tools/browser-lock.sh node src/tools/check.mjs --all     # rendered rules at 6 viewports + functional checks
sh src/tools/browser-lock.sh node src/tools/a11y-axe.mjs --all  # axe-core 4.10.2
```

## Where things are

| Path | What |
|---|---|
| `audit/raw/` | the live server's HTML, untouched (evidence) |
| `audit/pages/<id>/` | each live page as a browser draws it: rendered.html, text, harvest, expanded text, screenshots |
| `src/content/` | the content models (copy only from the evidence), images.json, site.json (pages + live head fields) |
| `src/styles/`, `src/lib/`, `src/pages/`, `src/sections/`, `src/scripts/` | the design system, renderers and behaviour |
| `src/assets-static/` | self-hosted fonts and the derived pictures |
| `dist/` | the deliverable |
