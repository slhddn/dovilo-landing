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
| [`/faq`](https://dovilo.app/faq/) | Tasks, focus, ambience, the city, Pro and MCP |
| [`/privacy`](https://dovilo.app/privacy/) · [`/terms`](https://dovilo.app/terms/) · [`/licenses`](https://dovilo.app/licenses/) | Legal and third-party attributions |

## Stack

Hand-written static HTML. No build step, no framework, no package manager — each page is a
single self-contained `index.html` with its CSS inlined and its structured data in `application/ld+json`
blocks. Nothing is fetched from a third party: Inter is self-hosted from [`fonts/`](fonts/) as a
variable `woff2` declared with `@font-face`, so no stylesheet blocks the first paint.

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

## Local preview

Any static file server works; the pages use extensionless internal links, so serve from the repo
root rather than opening files directly:

```bash
python -m http.server 8000
# → http://localhost:8000
```

## Deploy

GitHub Pages serves `main` at the apex domain in [`CNAME`](CNAME). Pushing to `main` publishes;
there is no build or CI step in between.

## For language models

The site is meant to be crawled and quoted. [`robots.txt`](robots.txt) allows every major search
and AI crawler, and two structured summaries are published for models that would rather read prose
than parse markup:

- **[llms.txt](https://dovilo.app/llms.txt)** — one-page overview
- **[llms-full.txt](https://dovilo.app/llms-full.txt)** — full reference: features, pricing, FAQ, MCP tools, webhook payloads

## Related repositories

- **[dovilo-desktop-releases](https://github.com/slhddn/dovilo-desktop-releases)** — installers and the auto-update feed for Dovilo Desktop
- **[dovilo-langgraph-demo](https://github.com/slhddn/dovilo-langgraph-demo)** — working LangGraph receiver that drives a Claude agent through Dovilo webhooks and MCP

---

[Website](https://dovilo.app) · [AI & MCP](https://dovilo.app/ai/) ·
[Changelog](https://dovilo.app/changelog/) · [X](https://x.com/doviloapp)

Built by [Selahaddin Akgün](https://sakgun.com) in Istanbul.
