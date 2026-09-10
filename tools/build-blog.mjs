#!/usr/bin/env node
/* Builds /blog from Sanity, as plain static HTML.
 *
 * Nothing about the blog is fetched in the browser: posts are pulled here, at
 * publish time, rendered to files, and committed. A crawler — search engine or
 * model — sees the whole post in the first response, with its own meta tags and
 * JSON-LD, exactly like the hand-written pages.
 *
 * Post bodies are Markdown (the `markdownBody` field), which is what the
 * authoring pipeline writes. Headings get GitHub-style ids, so a table of
 * contents written as anchor links in the Markdown resolves.
 *
 * Writes:
 *   blog/index.html            the post list
 *   blog/<slug>/index.html     one page per post
 *   blog/feed.xml              RSS 2.0, full text
 *   blog/media/*               post images, pulled off the Sanity CDN
 * Rewrites, between BLOG:START / BLOG:END markers:
 *   index.html  sitemap.xml  llms.txt  llms-full.txt
 *
 *   node tools/build-blog.mjs
 *   BLOG_FIXTURE=posts.json node tools/build-blog.mjs   # render without Sanity
 */

import { readFile, writeFile, mkdir, readdir, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { SITE, SANITY, BLOG } from './config.mjs';
import { page, esc } from './template.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, BLOG.dir);
const MEDIA = path.join(OUT, 'media');
const BLOG_URL = SITE.origin + BLOG.base;

const exists = (p) => access(p).then(() => true, () => false);
const log = (...a) => console.log(...a);

/* ─────────────────────────── Sanity ─────────────────────────── */

/* Selected by shape, not by document type: anything with a slug, a publish date
   and a Markdown body is a post, whatever the authoring pipeline decided to call
   it. Documents that look like posts but carry no Markdown are reported rather
   than silently dropped — that is what a mis-set export format looks like.
   coalesce() covers both generations of field names (description/excerpt,
   mainImage/coverImage). */
const QUERY = `*[
  !(_id in path("drafts.**"))
  && defined(slug.current)
  && defined(publishedAt)
  && publishedAt <= now()
] | order(publishedAt desc) {
  _id, _type, _updatedAt, title, "slug": slug.current, publishedAt, updatedAt, seoTitle, tags,
  "excerpt": coalesce(excerpt, description),
  "metaDescription": coalesce(metaDescription, description),
  "cover": coalesce(coverImage, mainImage),
  markdownBody,
  "authorName": coalesce(author, "${SITE.author.name}")
}`;

async function fetchPosts() {
  /* Local preview and tests: BLOG_FIXTURE=file.json feeds the same shape the
     query returns, so the renderer can be exercised without touching Sanity. */
  if (process.env.BLOG_FIXTURE) {
    log(`  (fixture: ${process.env.BLOG_FIXTURE})`);
    return JSON.parse(await readFile(path.resolve(process.env.BLOG_FIXTURE), 'utf8'));
  }

  /* api, not apicdn: a webhook-triggered build wants the write that just landed,
     not whatever the edge cached a minute ago. */
  const url =
    `https://${SANITY.projectId}.api.sanity.io/v${SANITY.apiVersion}` +
    `/data/query/${SANITY.dataset}?query=${encodeURIComponent(QUERY)}`;

  const headers = { Accept: 'application/json' };
  if (process.env.SANITY_READ_TOKEN) headers.Authorization = `Bearer ${process.env.SANITY_READ_TOKEN}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Sanity refused the query (${res.status}). The dataset is private — either make ` +
          `"${SANITY.dataset}" public in Sanity Manage, or set SANITY_READ_TOKEN.\n${body}`
      );
    }
    throw new Error(`Sanity query failed (${res.status}): ${body}`);
  }
  const { result } = await res.json();
  return Array.isArray(result) ? result : [];
}

/* ─────────────────────────── images ─────────────────────────── */

/* Rendered content is 760 CSS px wide; 2x covers retina. */
const WIDTHS = [760, 1520];
const usedMedia = new Set();
let downloaded = 0;

/** image-<id>-<w>x<h>-<ext>, the reference Sanity stores on a document. */
function assetFromRef(ref) {
  const m = /^image-([a-f0-9]+)-(\d+)x(\d+)-(\w+)$/.exec(ref || '');
  return m ? { id: m[1], width: +m[2], height: +m[3], ext: m[4] } : null;
}

/** The same asset as it appears in a Markdown image URL. */
function assetFromUrl(url) {
  const m = /^https?:\/\/cdn\.sanity\.io\/images\/[^/]+\/[^/]+\/([a-f0-9]+)-(\d+)x(\d+)\.(\w+)/.exec(url || '');
  return m ? { id: m[1], width: +m[2], height: +m[3], ext: m[4] } : null;
}

function cdnUrl(a, params) {
  const qs = new URLSearchParams(params).toString();
  return `https://cdn.sanity.io/images/${SANITY.projectId}/${SANITY.dataset}/${a.id}-${a.width}x${a.height}.${a.ext}?${qs}`;
}

/* Sanity's image pipeline does the resize and the WebP/JPEG encode; we only keep
   the result, so the published page serves it from our own origin. */
async function pull(a, { w, h, fm, q }) {
  const name = `${a.id}-${w}${h ? `x${h}` : ''}.${fm}`;
  usedMedia.add(name);
  const dest = path.join(MEDIA, name);
  if (!(await exists(dest))) {
    const params = { w: String(w), fm, q: String(q) };
    if (h) Object.assign(params, { h: String(h), fit: 'crop' });
    const res = await fetch(cdnUrl(a, params));
    if (!res.ok) throw new Error(`image ${a.id} (${res.status}) — ${cdnUrl(a, params)}`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    downloaded++;
  }
  return `${BLOG.base}media/${name}`;
}

/** Local, responsive copies of one Sanity image. `og` adds the 1200×630 share card. */
async function localise(a, { alt = '', caption = '', og = false } = {}) {
  const widths = WIDTHS.filter((w) => w <= a.width);
  if (!widths.length) widths.push(a.width);

  const srcs = [];
  for (const w of widths) srcs.push({ w, url: await pull(a, { w, fm: 'webp', q: 82 }) });

  const displayW = widths[0];
  return {
    src: srcs[0].url,
    srcset: srcs.map((s) => `${s.url} ${s.w}w`).join(', '),
    width: displayW,
    height: Math.round((displayW * a.height) / a.width),
    alt,
    caption,
    /* Social crawlers are unreliable with WebP, so share cards get a JPEG. */
    og: og ? await pull(a, { w: 1200, h: 630, fm: 'jpg', q: 80 }) : null,
  };
}

function imgTag(img) {
  const responsive = img.srcset?.includes(',')
    ? ` srcset="${esc(img.srcset)}" sizes="(max-width:800px) 100vw, 760px"`
    : '';
  return (
    `<img src="${esc(img.src)}"${responsive} width="${img.width}" height="${img.height}"` +
    ` alt="${esc(img.alt)}" loading="lazy" decoding="async">`
  );
}

/** Every Sanity image the Markdown links to, pulled local before rendering. */
async function markdownImages(md) {
  const map = new Map();
  for (const m of String(md || '').matchAll(/!\[[^\]]*\]\(\s*(\S+?)[\s)]/g)) {
    const url = m[1];
    if (map.has(url)) continue;
    const a = assetFromUrl(url);
    if (a) map.set(url, await localise(a));
  }
  return map;
}

/* ─────────────────────────── markdown ─────────────────────────── */

/* GitHub's heading-anchor rules, because that is what a table of contents
   written as [Section](#section) in the Markdown assumes — with one departure:
   runs of hyphens are collapsed. GitHub would turn "1. Dovilo — Best Overall"
   into "1-dovilo--best-overall", keeping the gap the em dash left behind, and
   the tables of contents in practice write a single hyphen there. Collapsing
   here and in resolveAnchors() below makes both spellings land. */
function githubSlug(text, seen) {
  const base = String(text)
    .replace(/<[^>]+>/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\- ]+/g, '')
    .replace(/ /g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

/** Points in-page links at the heading they meant, and reports the ones that
    match nothing at all — a table of contents whose links quietly do nothing is
    worse than no table of contents. */
function resolveAnchors(html, slug) {
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  const missing = new Set();

  const out = html.replace(/href="#([^"]+)"/g, (whole, anchor) => {
    if (ids.has(anchor)) return whole;
    const collapsed = anchor.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
    if (ids.has(collapsed)) return `href="#${collapsed}"`;
    missing.add(anchor);
    return whole;
  });

  for (const a of missing) console.warn(`  ! ${slug}: #${a} matches no heading on the page`);
  return out;
}

function renderMarkdown(md, images, slug) {
  const seen = new Map();
  const marked = new Marked({ gfm: true });

  marked.use({
    renderer: {
      heading(token) {
        /* h1 would compete with the post title, which is already an h1. */
        const depth = Math.max(2, Math.min(token.depth, 4));
        const inner = this.parser.parseInline(token.tokens);
        return `<h${depth} id="${githubSlug(inner, seen)}">${inner}</h${depth}>\n`;
      },
      link(token) {
        const href = token.href ?? '';
        const text = this.parser.parseInline(token.tokens);
        const external = /^https?:\/\//.test(href) && !href.startsWith(SITE.origin);
        return `<a href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
      },
      image(token) {
        const local = images.get(token.href);
        if (local) return imgTag({ ...local, alt: token.text || local.alt });
        /* Anything not in Sanity stays where it is — but it is worth knowing about,
           because the rest of the site serves every byte from its own origin. */
        console.warn(`  ! ${slug}: image left on a third-party origin — ${token.href}`);
        return `<img src="${esc(token.href)}" alt="${esc(token.text || '')}" loading="lazy" decoding="async">`;
      },
    },
  });

  return marked.parse(String(md || ''), { async: false });
}

/* A leading list of nothing but in-page links is a table of contents; give it
   the frame it deserves instead of leaving it as a naked bullet list. */
function liftTableOfContents(html) {
  const start = html.search(/\S/);
  if (start === -1 || !html.startsWith('<ul>', start)) return html;

  /* A table of contents nests, so the first </ul> is rarely the closing one. */
  const tag = /<\/?ul>/g;
  tag.lastIndex = start;
  let depth = 0;
  let end = -1;
  for (let m; (m = tag.exec(html)); ) {
    depth += m[0] === '<ul>' ? 1 : -1;
    if (depth === 0) {
      end = tag.lastIndex;
      break;
    }
  }
  if (end === -1) return html;

  const list = html.slice(start, end);
  const links = [...list.matchAll(/<a href="([^"]+)"/g)].map((x) => x[1]);
  if (!links.length || !links.every((h) => h.startsWith('#'))) return html;

  return (
    `<nav class="toc" aria-label="On this page">\n<p class="toc-title">On this page</p>\n${list}\n</nav>` +
    html.slice(end)
  );
}

/** Markdown stripped back to prose, for word counts and description fallbacks. */
function plainText(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/^\s*-{3,}\s*$/gm, ' ')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ───────────────────────── formatting ───────────────────────── */

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtDate = (iso) => DATE.format(new Date(iso));
const isoDay = (iso) => new Date(iso).toISOString().slice(0, 10);
const rfc822 = (iso) => new Date(iso).toUTCString();

/** Cuts on a word boundary rather than mid-word. */
function clip(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.—-]$/, '') + '…';
}

function describe(post, text) {
  const written = post.metaDescription || post.excerpt;
  const d = written ? written.replace(/\s+/g, ' ').trim() : clip(text, 155);
  /* Google shows about 155 characters of a snippet and drops the rest. */
  if (d.length > 160) {
    console.warn(`  ! ${post.slug}: meta description is ${d.length} chars — Google will cut it near 155`);
  }
  return d;
}

/* Generated HTML is committed, so it is worth breaking between blocks: a diff
   then shows the paragraph that changed rather than one enormous line. */
const prettify = (html) =>
  html.replace(/(<\/(?:p|h2|h3|h4|ul|ol|blockquote|pre|figure|table|nav)>)(?=\s*<)/g, '$1\n').replace(/\n{2,}/g, '\n');

/* ───────────────────────── page bodies ───────────────────────── */

const tagRow = (tags) =>
  tags?.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : '';

function postCard(p) {
  return `      <a class="card" href="${BLOG.base}${p.slug}/">
        <div class="meta">
          <time datetime="${p.publishedAt}">${fmtDate(p.publishedAt)}</time>
          <span class="sep">·</span><span>${p.readingTime} min read</span>
        </div>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.cardText)}</p>${p.tags?.length ? `\n        ${tagRow(p.tags)}` : ''}
      </a>`;
}

function indexPage(posts) {
  const body = `    <h1>${BLOG.title}</h1>
    <p class="lede">${esc(BLOG.tagline)} <a href="${BLOG.base}feed.xml">RSS</a>.</p>

${
  posts.length
    ? `    <div class="post-list">\n${posts.map(postCard).join('\n')}\n    </div>`
    : `    <div class="empty">No posts yet. The first one is being written — in the meantime, the
      <a href="/changelog/">release notes</a> carry what changed in the app.</div>`
}`;

  return page({
    title: `Blog — ${SITE.name}`,
    description: BLOG.tagline,
    canonical: BLOG_URL,
    back: { href: '/', label: 'Dovilo' },
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        '@id': `${BLOG_URL}#blog`,
        name: `${SITE.name} blog`,
        description: BLOG.tagline,
        url: BLOG_URL,
        inLanguage: 'en',
        publisher: {
          '@type': 'Organization',
          name: SITE.name,
          url: SITE.origin,
          logo: { '@type': 'ImageObject', url: SITE.origin + SITE.logo },
        },
        blogPost: posts.map((p) => ({
          '@type': 'BlogPosting',
          headline: p.title,
          url: `${BLOG_URL}${p.slug}/`,
          datePublished: p.publishedAt,
          dateModified: p.dateModified,
          description: p.description,
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Dovilo', item: SITE.origin + '/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: BLOG_URL },
        ],
      },
    ],
  });
}

function postPage(p, prev, next) {
  const url = `${BLOG_URL}${p.slug}/`;
  const body = `    <article>
      <header class="post-head">${p.tags?.length ? `\n        ${tagRow(p.tags)}` : ''}
        <h1>${esc(p.title)}</h1>
        <div class="meta">
          <time datetime="${p.publishedAt}">${fmtDate(p.publishedAt)}</time>
          <span class="sep">·</span><span>${p.readingTime} min read</span>
          <span class="sep">·</span><span>${esc(p.authorName)}</span>
        </div>
      </header>
${
  p.cover
    ? `      <figure class="cover">${imgTag({ ...p.cover, alt: p.cover.alt || p.title })}${
        p.cover.caption ? `<figcaption>${esc(p.cover.caption)}</figcaption>` : ''
      }</figure>\n`
    : ''
}      <div class="prose">
${p.html}
      </div>
    </article>

    <div class="cta">
      <div><strong>Dovilo turns finished work into a city you can see.</strong>
        A to-do list, focus sessions with full-screen ambience, and an isometric city built from
        what you complete. Free on iOS and Android.</div>
      <a href="/downloads/">Get Dovilo</a>
    </div>

    <nav class="more" aria-label="More posts">
      ${prev ? `<a href="${BLOG.base}${prev.slug}/"><span>Previous</span>${esc(prev.title)}</a>` : '<span></span>'}
      <a href="${BLOG.base}"><span>&nbsp;</span>All posts &rarr;</a>
      ${next ? `<a href="${BLOG.base}${next.slug}/"><span>Next</span>${esc(next.title)}</a>` : '<span></span>'}
    </nav>`;

  return page({
    title: `${p.seoTitle || p.title} — ${SITE.name}`,
    description: p.description,
    canonical: url,
    ogType: 'article',
    ogImage: p.cover?.og,
    ogImageAlt: p.cover ? p.cover.alt || p.title : '',
    head:
      `  <meta property="article:published_time" content="${p.publishedAt}">\n` +
      `  <meta property="article:modified_time" content="${p.dateModified}">\n` +
      `  <meta property="article:author" content="${esc(p.authorName)}">\n` +
      (p.tags ?? []).map((t) => `  <meta property="article:tag" content="${esc(t)}">\n`).join(''),
    back: { href: BLOG.base, label: 'Blog' },
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: p.title.slice(0, 110),
        name: p.title,
        description: p.description,
        url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        datePublished: p.publishedAt,
        dateModified: p.dateModified,
        inLanguage: 'en',
        wordCount: p.wordCount,
        ...(p.tags?.length ? { keywords: p.tags.join(', ') } : {}),
        ...(p.cover ? { image: [SITE.origin + p.cover.og] } : {}),
        author: { '@type': 'Person', name: p.authorName, url: SITE.author.url },
        publisher: {
          '@type': 'Organization',
          name: SITE.name,
          url: SITE.origin,
          logo: { '@type': 'ImageObject', url: SITE.origin + SITE.logo },
        },
        isPartOf: { '@type': 'Blog', '@id': `${BLOG_URL}#blog`, name: `${SITE.name} blog`, url: BLOG_URL },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Dovilo', item: SITE.origin + '/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: BLOG_URL },
          { '@type': 'ListItem', position: 3, name: p.title, item: url },
        ],
      },
    ],
  });
}

function feed(posts) {
  const items = posts
    .map(
      (p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${BLOG_URL}${p.slug}/</link>
    <guid isPermaLink="true">${BLOG_URL}${p.slug}/</guid>
    <pubDate>${rfc822(p.publishedAt)}</pubDate>
    <description>${esc(p.description)}</description>
${(p.tags ?? []).map((t) => `    <category>${esc(t)}</category>\n`).join('')}    <content:encoded><![CDATA[${p.html.replace(/]]>/g, ']]&gt;')}]]></content:encoded>
  </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>Dovilo — Blog</title>
  <link>${BLOG_URL}</link>
  <atom:link href="${BLOG_URL}feed.xml" rel="self" type="application/rss+xml"/>
  <description>${esc(BLOG.tagline)}</description>
  <language>en</language>
${posts.length ? `  <lastBuildDate>${rfc822(posts[0].publishedAt)}</lastBuildDate>\n` : ''}${items}
</channel>
</rss>
`;
}

/* ───────────── the blocks stitched into hand-written files ───────────── */

const START = '<!-- BLOG:START -->';
const END = '<!-- BLOG:END -->';

/** Replaces whatever sits between the markers, keeping their indentation. */
async function patch(file, block) {
  const full = path.join(ROOT, file);
  const src = await readFile(full, 'utf8');
  const a = src.indexOf(START);
  const b = src.indexOf(END);
  if (a === -1 || b === -1) {
    console.warn(`  ! ${file}: no ${START} / ${END} markers — left untouched`);
    return false;
  }
  const indent = src.slice(src.lastIndexOf('\n', b) + 1, b);
  const next = src.slice(0, a + START.length) + '\n' + block + '\n' + indent + src.slice(b);
  if (next === src) return false;
  await writeFile(full, next);
  log(`  ~ ${file}`);
  return true;
}

function homeSection(posts) {
  if (!posts.length) return '';
  const cards = posts
    .slice(0, BLOG.postsOnHome)
    .map(
      (p) => `        <a class="blog-card" href="${BLOG.base}${p.slug}/">
          <div class="blog-card-meta"><time datetime="${p.publishedAt}">${fmtDate(p.publishedAt)}</time> · ${p.readingTime} min read</div>
          <h3>${esc(p.title)}</h3>
          <p>${esc(clip(p.cardText, 180))}</p>
          <span class="blog-card-more">Read the post &rarr;</span>
        </a>`
    )
    .join('\n');

  return `  <section class="blog-band" id="blog" aria-label="From the Dovilo blog">
    <div class="blog-inner">
      <p class="section-label">Blog</p>
      <h2 class="section-title">Written while building Dovilo</h2>
      <div class="blog-grid">
${cards}
      </div>
      <div class="blog-all"><a href="${BLOG.base}">All posts &rarr;</a></div>
    </div>
  </section>`;
}

function sitemapBlock(posts) {
  const entry = (loc, lastmod, changefreq, priority) =>
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

  const lastmod = posts.length ? isoDay(posts[0].dateModified) : isoDay(new Date().toISOString());
  return [
    entry(BLOG_URL, lastmod, 'weekly', '0.8'),
    ...posts.map((p) => entry(`${BLOG_URL}${p.slug}/`, isoDay(p.dateModified), 'monthly', '0.7')),
  ].join('\n\n');
}

function llmsBlock(posts) {
  if (!posts.length) {
    return `## Blog\n\n- [Blog](${BLOG_URL}): posts about focus, productivity and agent workflows. No posts published yet.`;
  }
  return (
    `## Blog\n\nLong-form posts, newest first — full text at each link, and an RSS feed at ${BLOG_URL}feed.xml.\n\n` +
    posts.map((p) => `- [${p.title}](${BLOG_URL}${p.slug}/) — ${isoDay(p.publishedAt)}. ${p.description}`).join('\n')
  );
}

/* ───────────────────────────── build ───────────────────────────── */

/** Removes post directories and images that no longer belong to a published post. */
async function prune(slugs) {
  for (const e of await readdir(OUT, { withFileTypes: true })) {
    if (e.isDirectory() && e.name !== 'media' && !slugs.has(e.name)) {
      await rm(path.join(OUT, e.name), { recursive: true, force: true });
      log(`  - blog/${e.name}/ (unpublished)`);
    }
  }
  if (await exists(MEDIA)) {
    for (const f of await readdir(MEDIA)) {
      if (!usedMedia.has(f)) {
        await rm(path.join(MEDIA, f), { force: true });
        log(`  - blog/media/${f} (unused)`);
      }
    }
  }
}

/** Loud about anything that looked like a post but cannot be rendered. */
function report(raw) {
  const renderable = raw.filter((d) => typeof d.markdownBody === 'string' && d.markdownBody.trim());
  const skipped = raw.filter((d) => !renderable.includes(d));

  log(`  ${renderable.length} publishable post${renderable.length === 1 ? '' : 's'}`);
  if (skipped.length) {
    console.warn(
      `  ! ${skipped.length} document(s) have a slug and a publish date but no markdownBody, so they cannot be\n` +
        `    rendered. Set the content pipeline to export Markdown, or delete them:`
    );
    for (const d of skipped) console.warn(`      ${d._type}/${d.slug} — ${d._id}`);
  }

  const byTitle = new Map();
  for (const d of renderable) byTitle.set(d.title, (byTitle.get(d.title) ?? 0) + 1);
  for (const [title, n] of byTitle) {
    if (n > 1) console.warn(`  ! ${n} published posts share the title "${title}" — search engines treat that as duplicate content`);
  }

  return renderable;
}

async function main() {
  log(`Reading ${SANITY.projectId}/${SANITY.dataset} …`);
  const raw = report(await fetchPosts());

  await mkdir(MEDIA, { recursive: true });

  const posts = [];
  for (const post of raw) {
    const images = await markdownImages(post.markdownBody);
    const text = plainText(post.markdownBody);
    const words = text.split(/\s+/).filter(Boolean).length;
    const coverAsset = assetFromRef(post.cover?.asset?._ref);

    posts.push({
      ...post,
      html: prettify(
        liftTableOfContents(resolveAnchors(renderMarkdown(post.markdownBody, images, post.slug), post.slug))
      ),
      cover: coverAsset
        ? await localise(coverAsset, { alt: post.cover.alt || '', caption: post.cover.caption || '', og: true })
        : null,
      description: describe(post, text),
      cardText: post.excerpt ? post.excerpt.replace(/\s+/g, ' ').trim() : clip(text, 200),
      wordCount: words,
      readingTime: Math.max(1, Math.round(words / 220)),
      dateModified: post.updatedAt || post._updatedAt || post.publishedAt,
    });
  }

  for (const [i, p] of posts.entries()) {
    const dir = path.join(OUT, p.slug);
    await mkdir(dir, { recursive: true });
    /* The list is newest first, so the next entry in the array is the older post. */
    await writeFile(path.join(dir, 'index.html'), postPage(p, posts[i + 1], posts[i - 1]));
    log(`  + blog/${p.slug}/ (${p.wordCount} words)`);
  }

  await writeFile(path.join(OUT, 'index.html'), indexPage(posts));
  await writeFile(path.join(OUT, 'feed.xml'), feed(posts));
  log('  + blog/index.html, blog/feed.xml');

  await prune(new Set(posts.map((p) => p.slug)));

  await patch('index.html', homeSection(posts));
  await patch('sitemap.xml', sitemapBlock(posts));
  await patch('llms.txt', llmsBlock(posts));
  await patch('llms-full.txt', llmsBlock(posts));

  log(`Done — ${posts.length} post(s), ${downloaded} image(s) pulled.`);
}

main().catch((err) => {
  console.error('\nBlog build failed:\n' + (err?.stack || err));
  process.exit(1);
});
