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
blocks. The only external request is the Inter webfont from Google Fonts.

Light and dark themes are CSS custom properties, with the choice stored in `localStorage` and
applied before first paint so there is no flash.

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
