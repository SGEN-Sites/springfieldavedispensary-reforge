#!/usr/bin/env node
// gen-site.mjs — writes src/content/site.json: the page list (docs/BUILD-CONTRACT.md §2) with each live page's head
// fields copied from the RENDERED capture (audit/pages/<id>/harvest.json: what the browser shows after the SPA sets
// title/meta per route). New pages (/deals, 404) get head fields declared in src/content/ui-labels.json.
//   node src/tools/gen-site.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const inv = J('audit/site-inventory.json');
// owner-supplied posts (2026-11-05): src/content/imports.json (written by the local import converter) lists each new
// post page and its evidence (audit/pages/import-<slug>/ + the live blog pages for the shared post-template words)
const IMPORTS = fs.existsSync(path.join(ROOT, 'src', 'content', 'imports.json')) ? J('src/content/imports.json').posts : [];
const slugOf = (u) => { const p = new URL(u).pathname.replace(/^\/|\/$/g, ''); return p ? p.replace(/\//g, '-') : 'index'; };
const tpl = (id) => id === 'index' ? 'home' : id === 'shop' ? 'shop' : id.startsWith('shop-') ? 'shop-category'
  : id === 'blog' ? 'blog' : id.startsWith('blog-') ? 'post' : id;
const pages = [];
for (const p of inv.pages) {
  const id = slugOf(p.url);
  const h = J(`audit/pages/${id}/harvest.json`);
  const rawHead = fs.readFileSync(path.join(ROOT, 'audit', 'raw', (id === 'index' ? 'index' : id) + '.html'), 'utf8');
  const livePath = new URL(p.url).pathname;                       // e.g. /about (no trailing slash on the live site)
  // evidence = the live pages whose words this page may carry (its own first). Cross-page carries are live words reused
  // on another page of the same site (e.g. Contact's pickup/delivery info is the homepage's "Ways to Order" copy).
  const EXTRA = { contact: ['index'], about: ['index'], bundles: ['index'], loyalty: ['index'], blog: ['blog-live-rosin-science', 'blog-understanding-terpenes', 'blog-edibles-101-dosing', 'blog-sativa-summer-picks', 'blog-community-cleanup-recap', ...IMPORTS.map((x) => x.evidence[0])], careers: [] };
  const extra = EXTRA[id] || (id.startsWith('shop') ? ['shop', 'index'] : id.startsWith('blog-') ? ['blog'] : []);
  pages.push({
    id, template: tpl(id), path: id === 'index' ? '' : livePath.replace(/^\//, '') + '/', livePath, evidence: [id, ...extra.filter((e) => e !== id)],
    head: { title: h.title, description: h.description, canonical: h.canonical, og: h.og, ld: h.ld },
    serverTitle: (rawHead.match(/<title>([^<]*)<\/title>/) || [])[1] || null,
  });
}
const order = ['index', 'shop', 'shop-flower', 'shop-pre-rolls', 'shop-vaporizers', 'shop-concentrates', 'shop-edibles', 'shop-topicals',
  'shop-accessories', 'deals', 'bundles', 'loyalty', 'about', 'blog', 'blog-live-rosin-science', 'blog-understanding-terpenes',
  'blog-edibles-101-dosing', 'blog-sativa-summer-picks', 'blog-community-cleanup-recap', ...IMPORTS.map((x) => x.id), 'careers', 'contact', 'notfound'];
pages.push({ id: 'deals', template: 'deals', path: 'deals/', livePath: null, evidence: ['index'], isNew: true, head: { declared: 'deals' } });
pages.push({ id: 'notfound', template: 'notfound', path: '404.html', livePath: null, evidence: ['index'], isNew: true, head: { declared: 'notfound' } });
for (const x of IMPORTS) pages.push({ id: x.id, template: 'post', path: x.path, livePath: null, evidence: x.evidence, isNew: true, head: { declared: x.id } });
pages.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
const out = { schema: 'springfield/site@1', origin: 'https://springfieldavedispensary.store', generatedFrom: 'audit/pages/*/harvest.json', pages };
fs.writeFileSync(path.join(ROOT, 'src', 'content', 'site.json'), JSON.stringify(out, null, 1) + '\n');
for (const p of pages) console.log(p.id.padEnd(30), p.template.padEnd(14), (p.path || '/').padEnd(34), (p.head.title || p.head.declared || '').slice(0, 70));
