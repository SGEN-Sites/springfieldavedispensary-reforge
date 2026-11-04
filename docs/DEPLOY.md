# Deploying the redesign

`dist/` is a static site: HTML, CSS, JS, fonts and pictures, no server code and no build step on the host.
Every link inside it is relative, so `dist/` works from any folder or sub-path; only `404.html` links from a base
(`node src/tools/build.mjs --base /` — the default — or `--base /<repo>/` for a project sub-path host).

## What needs the live host

| Function | Needs | On any other host |
|---|---|---|
| Contact form | `POST /api/contact` (JSON `{site:"sfd",name,email,phone?,message}`) on the same origin — the live server already serves it | the form shows the live error message ("Something went wrong…" / "Network error…"); nothing is sent anywhere else |
| Careers application | `POST /api/careers/apply` (JSON `{site:"sfd",role,name,email,phone?,availability?,experience?,resumeUrl?,message?}`) | same |
| VIP list | `POST /api/newsletter/subscribe` (JSON `{email,site:"sfd",source:"home_vip_newsletter"}`) | same |
| Menu | the Dutchie embed script `https://dutchie.com/api/v2/embedded-menu/699a62e4906190ac014a622c.js?menuType=rec` (third party, loaded by `assets/js/menu.js`) | depends on Dutchie's allowed-origin setting for the embed (see the menu lane's report in CHANGE-LOG) |
| Map | Google Maps embed iframe (third party) | works anywhere |

So: deploy `dist/` onto the live host (the server that answers `springfieldavedispensary.store`, Google Frontend / App
Engine today) in place of the SPA build, keeping its `/api/*` routes.

## URLs

The live site serves pages without a trailing slash (`/about`) and canonicals say so. `dist/` writes `about/index.html`.
Either serve clean URLs (`/about` -> `about/index.html`, which most static hosts and App Engine handlers do) or add
301s `/x` -> `/x/`. Canonical tags keep the live form. New: `/deals` (sitemap and canonical added).

## Files the build writes

- `robots.txt` = the live robots file verbatim; `sitemap.xml` = every built page's canonical.
- `--preview` builds a public preview: every page gets `<meta name="robots" content="noindex, nofollow">` and
  `robots.txt` disallows all. Use it for any preview host; never for production.

## Before go-live (owner)

Open decisions are in `docs/CHANGE-LOG.md` (F1–F9). The two that change what customers read: F1 ("New to Treehouse?")
and F4 (delivery "launching soon" vs free delivery on $60+).
