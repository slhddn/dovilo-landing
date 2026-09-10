# Dovilo — Landing site

Source for **[dovilo.app](https://dovilo.app)**, the marketing and documentation site for
[Dovilo](https://dovilo.app) — a to-do list, focus timer and city builder for iOS, Android,
Windows and macOS, with a local MCP server on desktop that lets AI coding agents work through
tasks you write for them.

The app itself is closed source; this repository is the public website only.

## Pages

| Path | What it is |
| --- | --- |
| [`/`](https://dovilo.app) | Product overview — tasks, focus, ambience, the city, pricing, FAQ |
| [`/ai`](https://dovilo.app/ai/) | The MCP integration: nine tools, client presets, what agents can and cannot reach |
| [`/docs/webhooks`](https://dovilo.app/docs/webhooks/) | Signed webhook events — payload schema, signature verification, retry policy |
| [`/downloads`](https://dovilo.app/downloads/) | App Store, Play Store and desktop installers |
| [`/changelog`](https://dovilo.app/changelog/) | Release notes per platform, plus the roadmap |
| [`/blog`](https://dovilo.app/blog/) | Posts, generated from Sanity — see [The blog](#the-blog) |
| [`/faq`](https://dovilo.app/faq/) | Tasks, focus, ambience, the city, Pro and MCP |
| [`/privacy`](https://dovilo.app/privacy/) · [`/terms`](https://dovilo.app/terms/) · [`/licenses`](https://dovilo.app/licenses/) | Legal and third-party attributions |

## Stack

Hand-written static HTML. No framework, and no build step outside [`/blog`](#the-blog) — each page
is a single self-contained `index.html` with its CSS inlined and its structured data in
`application/ld+json` blocks. Nothing is fetched from a third party: Inter is self-hosted from
[`fonts/`](fonts/) as a variable `woff2` declared with `@font-face`, so no stylesheet blocks the
first paint. Blog pages are generated to the same shape and committed, so they are served the same
way — nothing about a post is fetched in the browser either.

Light and dark themes are CSS custom properties, with the choice stored in `localStorage` and
applied before first paint so there is no flash.

### Screenshots

Pages reference `.webp`; the `.png` files next to them are the lossless sources, kept so the
variants can be regenerated. The hero and the two desktop shots also carry `srcset`/`sizes`, whose
candidate widths are named in the filename (`-193`, `-700` … ). To add or replace a screenshot,
drop the PNG in [`screenshots/`](screenshots/) and re-encode it with ffmpeg:

```bash
# full-size WebP (quality 80 for the busy city render, 88 elsewhere)
ffmpeg -i screenshots/mobile-x.png -c:v libwebp -quality 88 -compression_level 6 screenshots/mobile-x.webp

# 1x variant for the phone slots (~193 CSS px wide)
ffmpeg -i screenshots/mobile-x.png -vf scale=193:-2:flags=lanczos -c:v libwebp -quality 88 -compression_level 6 screenshots/mobile-x-193.webp
```

Share cards (`og:image`, `twitter:image`) stay on PNG/JPG — social crawlers are unreliable with WebP.

## The blog

Posts live in [Sanity](https://sanity.io) (project `3unyshld`, dataset `production`) and are
rendered to static HTML here, at publish time. Nothing is fetched in the browser: a crawler — search
engine or model — gets the whole post in the first response, with its own meta tags, `BlogPosting`
JSON-LD and share card. That is the entire reason for the build step.

```
tools/config.mjs       project, origin, how many posts the homepage shows
tools/template.mjs     the page shell — a copy of the hand-written pages' tokens and chrome
tools/build-blog.mjs   fetch → render → write
studio/                Sanity Studio: the schema, and the editor at dovilo.sanity.studio
```

`npm run build:blog` writes `blog/index.html`, `blog/<slug>/index.html`, `blog/feed.xml` and
`blog/media/`, then rewrites the block between `<!-- BLOG:START -->` and `<!-- BLOG:END -->` in
[`index.html`](index.html), [`sitemap.xml`](sitemap.xml), [`llms.txt`](llms.txt) and
[`llms-full.txt`](llms-full.txt). Everything it writes is committed. Unpublish a post in Sanity and
the next build deletes its directory.

### Writing a post

A post is a document with a `slug`, a `publishedAt` in the past, and a **Markdown** body in
`markdownBody`. Markdown, not Portable Text, on purpose: Portable Text has no table block, and
exporting to it drops tables and turns most inline links into plain text.

- `## headings` get GitHub-style ids, so a list of `[Section](#section)` links at the top of the
  body renders as a table of contents whose anchors resolve.
- Tables, lists, code fences, `---` rules and bold all render into [`tools/template.mjs`](tools/template.mjs)'s prose styles.
- A cover image goes in `mainImage`, with alt text. Images on the Sanity CDN are pulled into
  `blog/media/` as WebP at build time (plus a 1200×630 JPEG for share cards, because social
  crawlers are unreliable with WebP); anything hosted elsewhere stays remote and the build says so.
- `publishedAt` in the future holds the post back until a later build — the workflow's daily run
  releases it.

The build refuses to guess: any document with a slug and a publish date but no `markdownBody` is
listed by name at the top of the run, rather than quietly skipped.

### Publishing

Sanity is the trigger; nobody touches the repository:

```
Publish in Sanity → webhook → repository_dispatch → .github/workflows/blog.yml
                  → npm run build:blog → commit to main → GitHub Pages
```

Roughly 40 seconds end to end. The workflow also runs daily at 06:17 UTC as a safety net, and can be
started by hand from the Actions tab.

Setting up the webhook, once: **Sanity Manage → API → Webhooks → Create**

| Field | Value |
| --- | --- |
| URL | `https://api.github.com/repos/slhddn/dovilo-landing/dispatches` |
| Trigger on | Create, Update, Delete |
| Filter | `_type == "post"` |
| HTTP method | `POST` |
| HTTP headers | `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `User-Agent: dovilo-sanity-webhook` |
| Projection | `{"event_type": "sanity-publish"}` |

The token is a GitHub fine-grained PAT scoped to this repository with **Contents: read and write**.

The dataset is public, so the build needs no credentials. If it is ever made private, add a Sanity
read token as the `SANITY_READ_TOKEN` repository secret — the workflow already passes it through.

### Studio

```bash
cd studio
npm install
npx sanity login
npx sanity deploy      # → https://dovilo.sanity.studio
```

The schema in [`studio/schemaTypes/post.js`](studio/schemaTypes/post.js) and the query in
[`tools/build-blog.mjs`](tools/build-blog.mjs) share the same field names. Rename a field in one and
the other stops seeing it.

### Previewing locally

```bash
npm run build:blog                              # against the live dataset
BLOG_FIXTURE=posts.json npm run build:blog      # against a local JSON file, no network
```

The fixture takes the same shape the query returns — useful for working on the template without
publishing anything. Remember to run the real build before committing, or the fixture's posts end up
in the repository.

## Local preview

Any static file server works; the pages use extensionless internal links, so serve from the repo
root rather than opening files directly:

```bash
python -m http.server 8000
# → http://localhost:8000
```

## Deploy

GitHub Pages serves `main` at the apex domain in [`CNAME`](CNAME). Pushing to `main` publishes;
there is no build or CI step in between. The blog reaches `main` the same way — the workflow commits
the generated pages, Pages publishes the commit — so a broken build or an unreachable Sanity leaves
the published site exactly as it was.

## For language models

The site is meant to be crawled and quoted. [`robots.txt`](robots.txt) allows every major search
and AI crawler, and two structured summaries are published for models that would rather read prose
than parse markup:

- **[llms.txt](https://dovilo.app/llms.txt)** — one-page overview
- **[llms-full.txt](https://dovilo.app/llms-full.txt)** — full reference: features, pricing, FAQ, MCP tools, webhook payloads

Both carry a `## Blog` section that the blog build keeps current, and every post is in
[`sitemap.xml`](sitemap.xml) and the RSS feed at [`/blog/feed.xml`](https://dovilo.app/blog/feed.xml).

## Related repositories

- **[dovilo-desktop-releases](https://github.com/slhddn/dovilo-desktop-releases)** — installers and the auto-update feed for Dovilo Desktop
- **[dovilo-langgraph-demo](https://github.com/slhddn/dovilo-langgraph-demo)** — working LangGraph receiver that drives a Claude agent through Dovilo webhooks and MCP

---

[Website](https://dovilo.app) · [AI & MCP](https://dovilo.app/ai/) ·
[Changelog](https://dovilo.app/changelog/) · [X](https://x.com/doviloapp)

Built by [Selahaddin Akgün](https://sakgun.com) in Istanbul.
