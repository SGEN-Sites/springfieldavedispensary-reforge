// lib-text.mjs — shared, dependency-free HTML text helpers for the T1 content gates
// (prove-content.mjs, parity.mjs and their self-tests). Node 18+ builtins only.
//
// Usage (library, ES module):
//   import { parse, textRuns, textOf, flowText, match, attrs, links, headFields, alts, qsa, norm } from './lib-text.mjs';
//   const runs = textRuns(html, { exclude: ['header', 'footer', 'nav', '[role=dialog]#age-gate'] });
//
// Self-check:  node src/tools/lib-text.mjs --selftest     (exit 0 only when every case passes)
//
// What the tokenizer does (deliberately small, good enough for browser-serialised pages and the static build):
//   - elements, attributes (quoted / unquoted / bare), comments, doctype, void elements, "/>" self-closing
//   - <script> <style> <noscript> <template> bodies are NOT text (their raw body is kept on node.raw, so
//     headFields() can read application/ld+json); <textarea> <title> are RCDATA (entity-decoded text)
//   - minimal implied end tags (p, li, option, dt/dd, tr, td/th) and tolerant end-tag matching
//   - entities: the common named set + every numeric form (&#123; &#x1F33F;), unknown names left verbatim
//   - norm(): NFC, soft hyphen / zero-width space / BOM / word joiner removed, all whitespace (incl. nbsp) -> one space
//   - <dialog> content and aria-hidden duplicates are ordinary text; svg <title>/<desc> are not text
//   - every element node carries .start/.end source offsets (start tag '<' .. end of end tag) for string surgery
//
// Text joining (textOf / flowText / textRuns):
//   INLINE elements (span a em strong b i small sup sub abbr mark code label time u s q cite … img svg) are joined
//   WITHOUT a space; ONE space is inserted only at a block boundary (p div li h1-h6 section article header footer
//   nav main br td th dd dt figcaption button input select option …, i.e. every element not in INLINE) and around an
//   excluded subtree. So <h1><span>Elevating</span> <span><span class="accent">Irvington</span>, NJ</span></h1> reads
//   "Elevating Irvington, NJ" and <h1>Elevating<br><span>Irvington, NJ</span></h1> reads "Elevating Irvington, NJ".
//   textRuns split modes (opts.split):
//     'block'    (default) one run per block box: inline content joined, split at block boundaries / <br>
//     'adjacent' 'block' + also split where two inline ELEMENTS touch with no text between them
//                (<a>Home</a><a>Menu</a>, <span>Featured</span><span>Nov 02, 2025</span>) and around an inline
//                element whose whole text is a separator glyph (<span>·</span>, <span>→</span>). The live React DOM
//                lays such siblings out as flex items, so a browser shows them apart; measured on the 20 live
//                pages: 'block' glues 176 of 1039 runs ("HomeMenuAboutBlog…"), 'adjacent' glues 0 that innerText
//                shows apart (text.txt), except text hidden from innerText (collapsed career details).
//     'node'     one run per DOM text node
//   match(needle, hay) is the one comparison the gates use: 'ok' (exact, word-boundary aligned), 'case' (only a
//   case-insensitive aligned match), 'fragment' (only inside a longer word/number, e.g. "20" in "200+"), 'missing'.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'keygen']);
const RAW_SKIP = new Set(['script', 'style', 'noscript', 'template', 'xmp', 'iframe', 'noembed', 'noframes']);
const RCDATA = new Set(['textarea', 'title']);
const P_CLOSERS = new Set(['address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']);
export const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'label', 'font', 'del', 'ins', 'wbr', 'img', 'svg', 'path', 'tspan', 'picture', 'output', 'ruby', 'rt', 'rp']);

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '©', reg: '®', trade: '™', hellip: '…',
  mdash: '—', ndash: '–', minus: '−', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„',
  laquo: '«', raquo: '»', lsaquo: '‹', rsaquo: '›', middot: '·', bull: '•', deg: '°', plusmn: '±', times: '×',
  divide: '÷', frac12: '½', frac14: '¼', frac34: '¾', sup1: '¹', sup2: '²', sup3: '³', cent: '¢', pound: '£',
  euro: '€', yen: '¥', curren: '¤', sect: '§', para: '¶', iexcl: '¡', iquest: '¿', shy: '\u00ad', ensp: '\u2002',
  emsp: '\u2003', thinsp: '\u2009', zwnj: '\u200c', zwj: '\u200d', lrm: '\u200e', rlm: '\u200f', dagger: '†',
  Dagger: '‡', permil: '‰', prime: '′', Prime: '″', larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔',
  star: '☆', starf: '★', check: '✓', hearts: '♥', spades: '♠', clubs: '♣', diams: '♦', loz: '◊', ordf: 'ª',
  ordm: 'º', micro: 'µ', not: '¬', macr: '¯', acute: '´', cedil: '¸', uml: '¨', brvbar: '¦', infin: '∞',
  le: '≤', ge: '≥', ne: '≠', asymp: '≈', sum: '∑', prod: '∏', radic: '√', percnt: '%', num: '#', dollar: '$',
  excl: '!', quest: '?', comma: ',', period: '.', colon: ':', semi: ';', lpar: '(', rpar: ')', lsqb: '[',
  rsqb: ']', lbrack: '[', rbrack: ']', lcub: '{', rcub: '}', sol: '/', bsol: '\\', ast: '*', plus: '+',
  equals: '=', hyphen: '‐', dash: '‐', vert: '|', verbar: '|', grave: '`', Hat: '^', lowbar: '_', commat: '@',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aring: 'Å', AElig: 'Æ', Ccedil: 'Ç', Egrave: 'È',
  Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë', Igrave: 'Ì', Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï', Ntilde: 'Ñ', Ograve: 'Ò',
  Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', Oslash: 'Ø', Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û', Uuml: 'Ü',
  Yacute: 'Ý', szlig: 'ß', agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ',
  ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï',
  ntilde: 'ñ', ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø', ugrave: 'ù',
  uacute: 'ú', ucirc: 'û', uuml: 'ü', yacute: 'ý', yuml: 'ÿ',
};
const LEGACY = new Set(['amp', 'lt', 'gt', 'quot', 'nbsp', 'copy', 'reg']);

export function decodeEntities(s) {
  if (!s || s.indexOf('&') === -1) return s || '';
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*)(;?)/g, (m, body, semi) => {
    if (body[0] === '#') {
      if (!semi && !/^#[xX]?[0-9a-fA-F]+$/.test(body)) return m;
      const cp = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '\ufffd';
      return String.fromCodePoint(cp);
    }
    if (Object.prototype.hasOwnProperty.call(NAMED, body) && (semi || LEGACY.has(body))) return NAMED[body];
    return m;
  });
}

// One normal form for every comparison in the T1 gates.
export function norm(s) {
  if (s == null) return '';
  return String(s).normalize('NFC')
    .replace(/[\u00ad\u200b\u2060\ufeff]/g, '')
    .replace(/[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g, ' ')
    .trim();
}

// Runs that are nothing but separators / arrows / stars are not content (·, |, →, ›, ↓, ←, ★ alone).
const PUNCT_ONLY = /^[\p{P}\s|·•★☆←-⇿⟰-⟿⤀-⥿⬀-⯿]+$/u;
export function isPunctOnly(s) { return PUNCT_ONLY.test(s); }

// ---------------------------------------------------------------- parser
function el(tag, attrsObj, parent, start) { return { type: 'el', tag, attrs: attrsObj, children: [], parent, start, end: -1, startTagEnd: -1 }; }

function parseAttrs(src) {
  const out = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1].toLowerCase();
    if (Object.prototype.hasOwnProperty.call(out, name)) continue;
    const raw = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
    out[name] = decodeEntities(raw);
  }
  return out;
}

// Find the end of a start tag beginning at i ('<' position); respects quoted attribute values.
function startTagEnd(html, i) {
  let q = null;
  for (let j = i + 1; j < html.length; j++) {
    const c = html[j];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") {
      // only a quote that opens an attribute value (after '=' with optional spaces)
      let k = j - 1; while (k > i && /\s/.test(html[k])) k--;
      if (html[k] === '=') q = c;
      continue;
    }
    if (c === '>') return j;
  }
  return -1;
}

export function parse(html) {
  if (html && typeof html === 'object' && (html.type === 'root' || html.type === 'el')) return html;
  html = String(html || '');
  const root = { type: 'root', tag: '#root', attrs: {}, children: [], parent: null, start: 0, end: html.length, src: html };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  let i = 0;
  const n = html.length;
  let inForeign = 0;
  const pushText = (t) => { if (t) top().children.push({ type: 'text', value: decodeEntities(t), parent: top() }); };
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { pushText(html.slice(i)); break; }
    if (lt > i) pushText(html.slice(i, lt));
    i = lt;
    if (html.startsWith('<!--', i)) {
      const e = html.indexOf('-->', i + 4);
      i = e === -1 ? n : e + 3;
      continue;
    }
    if (html[i + 1] === '!' || html[i + 1] === '?') {
      if (html.startsWith('<![CDATA[', i)) {
        const e = html.indexOf(']]>', i);
        pushText(html.slice(i + 9, e === -1 ? n : e));
        i = e === -1 ? n : e + 3;
        continue;
      }
      const e = html.indexOf('>', i);
      i = e === -1 ? n : e + 1;
      continue;
    }
    if (html[i + 1] === '/') {
      const m = /^<\/([A-Za-z][^\s\/>]*)[^>]*>/.exec(html.slice(i, i + 200));
      if (!m) { pushText('<'); i += 1; continue; }
      const name = m[1].toLowerCase();
      const endPos = i + m[0].length;
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag === name) {
          while (stack.length > k) {
            const node = stack.pop();
            node.end = endPos;
            if (node.tag === 'svg' || node.tag === 'math') inForeign = Math.max(0, inForeign - 1);
          }
          break;
        }
      }
      i = endPos;
      continue;
    }
    if (!/[A-Za-z]/.test(html[i + 1] || '')) { pushText('<'); i += 1; continue; }
    const e = startTagEnd(html, i);
    if (e === -1) { pushText(html.slice(i)); break; }
    const inner = html.slice(i + 1, e);
    const nm = /^([A-Za-z][^\s\/>]*)/.exec(inner);
    const tag = nm[1].toLowerCase();
    const selfClose = /\/\s*$/.test(inner);
    const attrsObj = parseAttrs(inner.slice(nm[1].length).replace(/\/\s*$/, ''));
    // implied end tags (top of stack only)
    const t = top().tag;
    if (t === 'p' && P_CLOSERS.has(tag)) stack.pop().end = i;
    else if (t === 'li' && tag === 'li') stack.pop().end = i;
    else if (t === 'option' && (tag === 'option' || tag === 'optgroup')) stack.pop().end = i;
    else if ((t === 'dt' || t === 'dd') && (tag === 'dt' || tag === 'dd')) stack.pop().end = i;
    else if ((t === 'td' || t === 'th') && (tag === 'td' || tag === 'th' || tag === 'tr')) stack.pop().end = i;
    else if (t === 'tr' && tag === 'tr') stack.pop().end = i;
    const node = el(tag, attrsObj, top(), i);
    node.startTagEnd = e + 1;
    top().children.push(node);
    i = e + 1;
    if (VOID.has(tag) || selfClose) { node.end = i; continue; }
    if (RAW_SKIP.has(tag) || RCDATA.has(tag)) {
      const closeRe = new RegExp('</' + tag + '\\s*>', 'ig');
      closeRe.lastIndex = i;
      const cm = closeRe.exec(html);
      const bodyEnd = cm ? cm.index : n;
      const body = html.slice(i, bodyEnd);
      if (RCDATA.has(tag)) node.children.push({ type: 'text', value: decodeEntities(body), parent: node });
      else node.raw = body;
      node.end = cm ? cm.index + cm[0].length : n;
      i = node.end;
      continue;
    }
    if (tag === 'svg' || tag === 'math') inForeign++;
    stack.push(node);
  }
  while (stack.length > 1) stack.pop().end = n;
  return root;
}

// ---------------------------------------------------------------- selectors (compound only, comma lists)
function parseCompound(sel) {
  sel = sel.trim();
  const out = { tag: null, id: null, classes: [], attrs: [] };
  const re = /^([A-Za-z*][\w-]*)|#([\w-]+)|\.([\w-]+)|\[\s*([\w:-]+)\s*(?:([~^$*|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]/g;
  let m; let pos = 0;
  while ((m = re.exec(sel))) {
    if (m.index !== pos) throw new Error('unsupported selector: ' + sel);
    pos = re.lastIndex;
    if (m[1]) out.tag = m[1] === '*' ? null : m[1].toLowerCase();
    else if (m[2]) out.id = m[2];
    else if (m[3]) out.classes.push(m[3]);
    else out.attrs.push({ name: m[4].toLowerCase(), op: m[5] || null, value: m[6] ?? m[7] ?? m[8] ?? null });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  if (pos !== sel.length) throw new Error('unsupported selector: ' + sel);
  return out;
}
export function compileSelector(sel) {
  if (typeof sel === 'function') return sel;
  const parts = (Array.isArray(sel) ? sel : String(sel).split(',')).map((s) => s.trim()).filter(Boolean).map(parseCompound);
  return (node) => node && node.type === 'el' && parts.some((c) => matchCompound(node, c));
}
function matchCompound(node, c) {
  if (c.tag && node.tag !== c.tag) return false;
  if (c.id && node.attrs.id !== c.id) return false;
  if (c.classes.length) {
    const cls = (node.attrs.class || '').split(/\s+/);
    if (!c.classes.every((k) => cls.includes(k))) return false;
  }
  for (const a of c.attrs) {
    const v = node.attrs[a.name];
    if (v === undefined) return false;
    if (!a.op) continue;
    if (a.op === '=' && v !== a.value) return false;
    if (a.op === '~=' && !v.split(/\s+/).includes(a.value)) return false;
    if (a.op === '^=' && !v.startsWith(a.value)) return false;
    if (a.op === '$=' && !v.endsWith(a.value)) return false;
    if (a.op === '*=' && !v.includes(a.value)) return false;
    if (a.op === '|=' && !(v === a.value || v.startsWith(a.value + '-'))) return false;
  }
  return true;
}

export function qsa(scope, sel) {
  const test = compileSelector(sel);
  const out = [];
  const walk = (node) => { for (const c of node.children || []) { if (c.type !== 'el') continue; if (test(c)) out.push(c); walk(c); } };
  walk(scope && scope.type ? scope : parse(scope));
  return out;
}
export function qs(scope, sel) { return qsa(scope, sel)[0] || null; }
export function closest(node, sel) {
  const test = compileSelector(sel);
  for (let p = node; p; p = p.parent) if (p.type === 'el' && test(p)) return p;
  return null;
}

// Scope resolution: {root:'auto'} -> #root when present, else <body>, else the whole document.
export function scopeOf(html, opts = {}) {
  if (opts.scope && typeof opts.scope === 'object' && opts.scope.type) return opts.scope;
  if (html && typeof html === 'object' && html.type === 'el') return html;
  const doc = parse(html);
  if (typeof opts.scope === 'string') return qs(doc, opts.scope);
  const mode = opts.root || 'auto';
  if (mode === 'auto' || mode === 'root') {
    const r = qs(doc, '#root');
    if (r) return r;
    if (mode === 'root') return null;
  }
  return qs(doc, 'body') || doc;
}

function inSvgMeta(node) {
  for (let p = node.parent; p; p = p.parent) { if (p.tag === 'title' || p.tag === 'desc') { for (let q = p.parent; q; q = q.parent) if (q.tag === 'svg') return true; return false; } }
  return false;
}

// Raw text of a subtree (no boundaries) — used to decide whether an inline element is a separator glyph.
function rawText(node) {
  let s = '';
  const walk = (n) => { for (const c of n.children || []) { if (c.type === 'text') { if (!inSvgMeta(c)) s += c.value; } else if (c.type === 'el' && !RAW_SKIP.has(c.tag)) walk(c); } };
  walk(node);
  return s;
}
const SPLITS = new Set(['block', 'adjacent', 'node']);

// Text runs inside the scope, skipping excluded subtrees (see "Text joining" at the top).
// textRunNodes returns {text, node, nodes} (node = first text node, nodes = every text node of the run) so callers
// can walk node.parent; textRuns returns the strings. Runs are normalised and non-empty; punctuation/arrow-only runs
// (·, |, →, ›, ↓, ←, ★ alone) are dropped unless opts.keepPunct.
// opts.exclude: selector string / list, or a predicate (node) => boolean. opts.split: 'block' | 'adjacent' | 'node'.
export function textRunNodes(html, opts = {}) {
  const scope = scopeOf(html, opts);
  if (!scope) return [];
  const ex = typeof opts.exclude === 'function' ? opts.exclude : opts.exclude && opts.exclude.length ? compileSelector(opts.exclude) : null;
  const keepPunct = !!opts.keepPunct;
  const split = opts.split || 'block';
  if (!SPLITS.has(split)) throw new Error('textRuns: unknown split mode ' + split);
  const out = [];
  let buf = []; let nodes = [];
  const push = (t, ns) => { if (t && (keepPunct || !isPunctOnly(t))) out.push({ text: t, node: ns[0], nodes: ns }); };
  const flush = () => { if (buf.length) push(norm(buf.join('')), nodes); buf = []; nodes = []; };
  const walk = (node) => {
    let prevEl = false; // the previous sibling with content was an inline element (adjacent mode)
    for (const c of node.children || []) {
      if (c.type === 'text') {
        if (inSvgMeta(c) || c.value === '') continue;
        if (split === 'node') { push(norm(c.value), [c]); continue; }
        buf.push(c.value); nodes.push(c); prevEl = false;
        continue;
      }
      if (c.type !== 'el') continue;
      if (ex && ex(c)) { flush(); prevEl = false; continue; }
      if (c.tag === 'head' || RAW_SKIP.has(c.tag)) continue;
      if (c.tag === 'br' || !INLINE.has(c.tag)) { flush(); if (c.tag !== 'br') { walk(c); flush(); } prevEl = false; continue; }
      if (split === 'adjacent') {
        const rt = norm(rawText(c));
        const sep = rt !== '' && isPunctOnly(rt);
        if (prevEl || sep) flush();
        walk(c);
        if (sep) flush();
        prevEl = true;
      } else walk(c);
    }
  };
  if (scope.type === 'el' && ex && ex(scope)) return out;
  walk(scope);
  flush();
  return out;
}
export function textRuns(html, opts = {}) { return textRunNodes(html, opts).map((r) => r.text); }

// All text of the scope (default <body>, or #root when present) as a browser would flow it: inline elements joined
// WITHOUT a space, a single space at block boundaries / <br>. Separator glyphs are kept (they are text).
// opts.split 'adjacent' gives the variant with a space between touching inline elements (flex siblings).
export function textOf(html, opts = {}) { return textRuns(html, { ...opts, keepPunct: true }).join(' '); }
// Kept as a name for callers of the first version; identical to textOf.
export function flowText(html, opts = {}) { return textOf(html, opts); }

// ---------------------------------------------------------------- the one comparison
const WORDCH = /[\p{L}\p{N}]/u;
const lastChar = (s) => { const a = Array.from(s); return a[a.length - 1] || ''; };
const charBefore = (s, i) => (i > 0 ? Array.from(s.slice(Math.max(0, i - 2), i)).pop() || '' : '');
const charAt = (s, i) => (i < s.length ? String.fromCodePoint(s.codePointAt(i)) : '');
// Exact occurrence of needle in hay whose alphanumeric edges do not touch another letter/digit.
export function findAligned(hay, needle) {
  if (!needle || !hay) return false;
  const ws = WORDCH.test(Array.from(needle)[0]); const we = WORDCH.test(lastChar(needle));
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) {
    if (ws && WORDCH.test(charBefore(hay, i))) continue;
    if (we && WORDCH.test(charAt(hay, i + needle.length))) continue;
    return true;
  }
  return false;
}
// hay: a string, or {text, lower} (lower = text.toLowerCase(), cached by the caller).
// Returns 'ok' | 'case' | 'fragment' | 'missing'.
export function match(needle, hay) {
  const text = typeof hay === 'string' ? hay : hay.text;
  const lower = typeof hay === 'string' ? hay.toLowerCase() : hay.lower || hay.text.toLowerCase();
  if (findAligned(text, needle)) return 'ok';
  const nl = needle.toLowerCase();
  if (findAligned(lower, nl)) return 'case';
  if (text.includes(needle) || lower.includes(nl)) return 'fragment';
  return 'missing';
}
// The built text a case-insensitive / fragment match actually hit (for messages).
export function caseSnippet(needle, hay, pad = 0) {
  const text = typeof hay === 'string' ? hay : hay.text;
  const lower = typeof hay === 'string' ? hay.toLowerCase() : hay.lower || text.toLowerCase();
  const i = lower.indexOf(needle.toLowerCase());
  return i < 0 ? null : text.slice(Math.max(0, i - pad), i + needle.length + pad);
}

// Values of `attr` on every `tag` element (tag '*' = any) inside the scope (default: whole document).
export function attrs(html, tag, attr, opts = {}) {
  const scope = opts.root || opts.scope ? scopeOf(html, opts) : parse(html);
  const sel = !tag || tag === '*' ? '*' : tag;
  const ex = opts.exclude && opts.exclude.length ? compileSelector(opts.exclude) : null;
  return qsa(scope, sel).filter((n) => n.attrs[attr] !== undefined && !(ex && closest(n, ex))).map((n) => n.attrs[attr]);
}

export function links(html, opts = {}) {
  const scope = scopeOf(html, opts.root || opts.scope ? opts : { ...opts, root: 'body' });
  const ex = opts.exclude && opts.exclude.length ? compileSelector(opts.exclude) : null;
  return qsa(scope, 'a[href],area[href]').filter((n) => !(ex && closest(n, ex))).map((n) => ({
    href: n.attrs.href.trim(),
    text: flowText(n, { scope: n }),
    aria: n.attrs['aria-label'] != null ? norm(n.attrs['aria-label']) : null,
  }));
}

export function alts(html, opts = {}) {
  const scope = scopeOf(html, opts.root || opts.scope ? opts : { ...opts, root: 'body' });
  const ex = opts.exclude && opts.exclude.length ? compileSelector(opts.exclude) : null;
  return qsa(scope, 'img[alt],area[alt],input[alt]').filter((n) => !(ex && closest(n, ex))).map((n) => norm(n.attrs.alt));
}

export function headFields(html) {
  const doc = parse(html);
  const head = qs(doc, 'head') || doc;
  const t = qs(head, 'title') || qs(doc, 'title');
  const metas = qsa(doc, 'meta');
  const meta = (k) => { const m = metas.find((x) => (x.attrs.name || '').toLowerCase() === k); return m ? norm(m.attrs.content || '') : null; };
  const canon = qsa(doc, 'link[rel]').find((x) => x.attrs.rel.toLowerCase().split(/\s+/).includes('canonical'));
  const og = {}; const ogAll = {};
  for (const m of metas) {
    const key = (m.attrs.property || m.attrs.name || '').trim();
    if (!/^(og|twitter):/i.test(key)) continue;
    const v = norm(m.attrs.content || '');
    (ogAll[key] = ogAll[key] || []).push(v);
    if (!(key in og)) og[key] = v;
  }
  const ld = qsa(doc, 'script').filter((s) => (s.attrs.type || '').trim().toLowerCase() === 'application/ld+json').map((s) => (s.raw || '').trim());
  return { title: t ? norm(t.children.map((c) => c.value || '').join('')) : null, description: meta('description'), canonical: canon ? canon.attrs.href.trim() : null, og, ogAll, ld };
}

// ---------------------------------------------------------------- self-check
async function selftest() {
  const cases = [];
  const ok = (name, cond) => cases.push([name, !!cond]);
  const eq = (name, got, want) => { const g = JSON.stringify(got); const w = JSON.stringify(want); cases.push([name + (g === w ? '' : `  got ${g} want ${w}`), g === w]); };
  // --- the joining rule (lead, round 2): inline joined without a space, one space only at block boundaries
  const built = '<body><h1><span>Elevating</span> <span><span class="accent">Irvington</span>, NJ</span></h1></body>';
  const live = '<body><h1 class="uppercase">Elevating<br><span class="text-white">Irvington, NJ</span></h1></body>';
  const noComma = '<body><h1><span>Elevating</span> <span><span class="accent">Irvington</span> NJ</span></h1></body>';
  eq('built h1: textOf joins the accent span without a space', textOf(built), 'Elevating Irvington, NJ');
  eq('built h1: textRuns (block) is one run', textRuns(built), ['Elevating Irvington, NJ']);
  eq('built h1: textRuns (adjacent) is one run (text follows the span)', textRuns(built, { split: 'adjacent' }), ['Elevating Irvington, NJ']);
  eq('live h1: <br> is a boundary', textRuns(live), ['Elevating', 'Irvington, NJ']);
  eq('live h1: textOf', textOf(live), 'Elevating Irvington, NJ');
  eq('live run "Irvington, NJ" is found in the built text', match('Irvington, NJ', textOf(built)), 'ok');
  eq('comma dropped: "Irvington, NJ" is missing', match('Irvington, NJ', textOf(noComma)), 'missing');
  eq('block siblings get a space: <div>Irvington</div><div>, NJ</div>', textOf('<body><div>Irvington</div><div>, NJ</div></body>'), 'Irvington , NJ');
  for (const t of ['span', 'a', 'em', 'strong', 'b', 'i', 'small', 'sup', 'sub', 'abbr', 'mark', 'code', 'label', 'time']) {
    eq(`inline <${t}> joined without a space`, textOf(`<body><p>x<${t}>y</${t}>z</p></body>`), 'xyz');
  }
  for (const t of ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'td', 'dd', 'dt', 'figcaption', 'button']) {
    eq(`block <${t}> gets one space each side`, textOf(`<body><div>x<${t}>y</${t}>z</div></body>`), 'x y z');
  }
  eq('<br> gets one space', textOf('<body><p>x<br>y</p></body>'), 'x y');
  eq('inline + block mix', textOf('<body><p>Get <strong>20%</strong> off</p><p>Next</p></body>'), 'Get 20% off Next');
  // --- split modes
  const flex = '<body><div class="flex"><a href="/">Home</a><a href="/m">Menu</a></div></body>';
  eq('block mode glues touching inline elements', textRuns(flex), ['HomeMenu']);
  eq('adjacent mode splits touching inline elements', textRuns(flex, { split: 'adjacent' }), ['Home', 'Menu']);
  eq('adjacent: separator element splits and is dropped', textRuns('<body><span class="flex">Read Article <span>→</span></span></body>', { split: 'adjacent' }), ['Read Article']);
  eq('adjacent: "·" element + icon', textRuns('<body><div>1070 Springfield Ave Suite C, Irvington NJ<span class="mx-2">·</span><svg><path d="M0"/></svg>Mon–Sat</div></body>', { split: 'adjacent' }), ['1070 Springfield Ave Suite C, Irvington NJ', 'Mon–Sat']);
  eq('adjacent: whitespace between spans keeps one run', textRuns('<body><p><span>A</span> <span>B</span></p></body>', { split: 'adjacent' }), ['A B']);
  eq('node mode: one run per text node', textRuns('<body><p>Get <strong>20%</strong> off</p></body>', { split: 'node' }), ['Get', '20%', 'off']);
  eq('textOf adjacent variant spaces flex siblings', textOf('<body><div><span>Y</span><span>You</span></div></body>', { split: 'adjacent' }), 'Y You');
  // --- the comparison
  eq('match ok (aligned)', match('Our Story', 'Read Our Story today'), 'ok');
  eq('match case', match('Our Story', 'READ OUR STORY'), 'case');
  eq('match fragment: "20" inside "200+"', match('20', '200+ strains'), 'fragment');
  eq('match fragment: "Irving" inside "Irvington"', match('Irving', 'Elevating Irvington, NJ'), 'fragment');
  eq('match fragment: "$10" inside "From $100"', match('$10', 'From $100'), 'fragment');
  eq('match ok: "$100" (non-word start)', match('$100', 'From $100'), 'ok');
  eq('match fragment: "7g" inside "17g" (start edge)', match('7g', 'Half oz 17g'), 'fragment');
  eq('match fragment: "old" inside "Gold" (start edge)', match('old', 'Gold tier'), 'fragment');
  eq('match ok: "Y" in "Y You"', match('Y', 'Y You'), 'ok');
  eq('match fragment: "Y" in "YYou"', match('Y', 'YYou'), 'fragment');
  eq('match ok: punctuation edges', match('Open Now', '·Open Now·'), 'ok');
  eq('match missing', match('Somewhere', 'nothing here'), 'missing');
  eq('match ok: later aligned occurrence', match('Gold', 'Golden Gold'), 'ok');
  // --- tokenizer + helpers
  const h = `<!doctype html><html><head><title>A &amp; B</title><meta name="description" content="D&#39;s">
<link rel="canonical" href="https://x.test/a"><meta property="og:title" content="OG"><meta name="twitter:card" content="s">
<script type="application/ld+json">{"@type":"Thing","n":"<b>"}</script><style>.x{content:"NOPE"}</style></head>
<body><header><nav><a href="/">Home</a> · <span>Open Now</span></nav></header>
<div id="root"><main><h1>Elevating<br><span>Irvington,&nbsp;NJ</span></h1>
<p>Get <strong>20%</strong> off &#8212; &#x1F33F; caf&eacute;</p><p>unclosed<p>second</p>
<script>var s = "<p>NOT TEXT</p>";</script><noscript><p>NO</p></noscript><template><p>TPL</p></template>
<dialog id="deal-1"><p>Dialog text</p></dialog><div aria-hidden="true">Dup</div><div>Dup</div>
<div><svg><title>Icon title</title><path d="M0"/></svg><span>→</span><span>★</span><span>|</span><span>4.8★</span></div>
<img alt="Logo &quot;x&quot;" src="a.jpg"><img src="b.jpg" alt=""><a href='/shop?dtche[category]=flower' aria-label="F">Flower</a>
<input placeholder="Enter your email" aria-label="Email address"><select><option>One<option>Two</select>
<textarea placeholder="Msg">&lt;raw&gt;</textarea></main>
<div role="dialog" id="age-gate"><p>Are you 21?</p></div></div><footer>Foot</footer></body></html>`;
  const runs = textRuns(h, { exclude: ['header', 'footer', 'nav', '[role=dialog]#age-gate'] });
  const aruns = textRuns(h, { exclude: ['header', 'footer', 'nav', '[role=dialog]#age-gate'], split: 'adjacent' });
  ok('runs include Elevating + Irvington, NJ (nbsp normalised)', runs.includes('Elevating') && runs.includes('Irvington, NJ'));
  ok('script/noscript/template/style bodies are not text', !runs.some((r) => /NOT TEXT|^NO$|TPL|NOPE/.test(r)));
  ok('dialog content is text', runs.includes('Dialog text'));
  ok('aria-hidden duplicate is text (2x Dup)', runs.filter((r) => r === 'Dup').length === 2);
  ok('svg title is not text', !runs.some((r) => r.includes('Icon title')));
  ok('adjacent: punctuation-only runs skipped (→ ★ |), 4.8★ kept', !aruns.includes('→') && !aruns.includes('★') && !aruns.includes('|') && aruns.includes('4.8★'));
  ok('block: a run of only glyphs+text keeps the text', runs.includes('→★|4.8★'));
  ok('entities decoded (— 🌿 é), inline joined', runs.includes('Get 20% off — 🌿 café'));
  ok('implied </p>', runs.includes('unclosed') && runs.includes('second'));
  ok('option implied close', runs.includes('One') && runs.includes('Two'));
  ok('exclude header/footer/age-gate', !runs.includes('Home') && !runs.includes('Foot') && !runs.includes('Are you 21?'));
  ok('#root scope (header outside root ignored even without exclude)', !textRuns(h).includes('Home'));
  ok('textarea RCDATA decoded', runs.includes('<raw>'));
  ok('textOf body keeps separators', textOf(h, { root: 'body' }).startsWith('Home · Open Now Elevating Irvington, NJ Get 20% off'));
  ok('flowText === textOf', flowText(h, { root: 'body' }) === textOf(h, { root: 'body' }));
  const hf = headFields(h);
  ok('headFields title/desc/canonical', hf.title === 'A & B' && hf.description === "D's" && hf.canonical === 'https://x.test/a');
  ok('headFields og/twitter', hf.og['og:title'] === 'OG' && hf.og['twitter:card'] === 's');
  ok('headFields ld raw kept', hf.ld.length === 1 && JSON.parse(hf.ld[0]).n === '<b>');
  ok('alts', JSON.stringify(alts(h)) === JSON.stringify(['Logo "x"', '']));
  const L = links(h);
  ok('links', L.some((l) => l.href === '/shop?dtche[category]=flower' && l.text === 'Flower' && l.aria === 'F') && L.some((l) => l.href === '/'));
  ok('attrs placeholder', JSON.stringify(attrs(h, '*', 'placeholder')) === JSON.stringify(['Enter your email', 'Msg']));
  ok('offsets: dialog source slice', (() => { const d = qs(parse(h), 'dialog'); return h.slice(d.start, d.end).startsWith('<dialog') && h.slice(d.start, d.end).endsWith('</dialog>'); })());
  ok('compound selector [role=dialog]#age-gate', qsa(parse(h), '[role=dialog]#age-gate').length === 1);
  ok('attrs on an element node', JSON.stringify(attrs(qs(parse(h), 'body'), '*', 'alt')) === JSON.stringify(['Logo "x"', '']));
  ok('norm NFC + zero-width', norm('café​  x') === 'café x');
  const failed = cases.filter((c) => !c[1]);
  for (const [n, p] of cases) console.log((p ? 'PASS ' : 'FAIL ') + n);
  console.log(`SELFTEST lib-text: ${cases.length - failed.length}/${cases.length} cases ${failed.length ? 'FAIL' : 'PASS'}`);
  process.exit(failed.length ? 1 : 0);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv.includes('--selftest')) selftest();
