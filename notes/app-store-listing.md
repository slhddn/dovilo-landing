# App Store & Google Play listing review

Internal working notes, not part of the site. Written 2026-09-09 against the live
App Store listing (Play listing could not be read programmatically — the copy
recommendations below apply to both, the screenshot order is per-store).

## 1. Fix first: the listing claims something the app does not do

The App Store promotional text reads *"work to rain or lo-fi"* and the 1.1.0
What's New says *"plus lo-fi and instrumental focus music"*.

Dovilo has **no music** — no melodies, no beats, no lo-fi, no instrumental tracks.
It has layered ambient sound. This is stated flatly in `llms-full.txt` and on the
site. A listing that promises lo-fi music sells an install to someone who wants
Lofi Girl and gets rain, which is a one-star review and a refund, not a customer.

- Promotional text → drop "or lo-fi".
- What's New for the next release → correct it there; old What's New text cannot
  be edited retroactively, so the fix has to ride the next submission.
- Search the rest of both listings for "music" before submitting.

## 2. Subtitle: four products in thirty characters

Current iOS subtitle: **"Focus, Tasks, AI & Your City"** — the same problem the
homepage had. A subtitle is read in about a second, in a list of competitors, by
someone who does not know what MCP is.

One promise, in priority order of what is actually differentiated:

| Rank | Subtitle | Why |
|---|---|---|
| 1 | `Tasks that build your city` | The payoff and the mechanic in four words. Nothing else in the category says this. |
| 2 | `Finish tasks, build a city` | Same idea, imperative, tests well against procrastination-driven searchers. |
| 3 | `Your to-do list, as a city` | Safest; leads with the category word for search. |

Keep "AI" out of the subtitle. Nobody browsing the Productivity charts is
searching for an MCP server, and the people who are will arrive from
[dovilo.app/mcp](https://dovilo.app/mcp), not from a store subtitle.

## 3. Screenshot order

Order drives installs more than the description does — most people never expand
the description at all. First frame must carry the single strongest promise.

**Recommended order (both stores):**

1. `mobile-city.png` — the city, with a caption tying it to work: *"Every task you finish puts a building here."* This is the frame nothing else in the category can show.
2. `mobile-tasks.png` — My Day. Proves it is a real task manager, immediately after the hook. Caption: *"A proper to-do list underneath it all."*
3. `mobile-focus.png` — focus session in the Rainy City scene. Caption: *"Focus fills the whole screen."*
4. `mobile-ambience-scenes.png` — scene picker. Caption: *"Five scenes, each with its own sound."* (Say **sound**, never *music*.)
5. `mobile-stats.png` — completion rate and trend. The "am I actually improving" frame.
6. `mobile-market.png` — the Market. Shows what bricks are for.
7. `mobile-ai.png` — AI tasks. Last, and only one frame. Caption: *"Let your AI coding agent work the same list."*

Not in the first seven: `mobile-views.png`, `mobile-planned.png`,
`mobile-task-detail.png`, `mobile-ambience-sound.png`, `mobile-focus-midnight.png`,
`mobile-ai-done.png`. They are good frames for later slots but none of them
answers "why this app".

**Store-specific:**
- **App Store** — the first *three* are what appear in search results without a
  tap. Frames 1–3 above must work as a set: city, list, focus.
- **Google Play** — the feature graphic is doing more work than any screenshot.
  It should be the city, one line of text, no feature list.

## 4. Description opening

Both stores show roughly the first 2–3 lines before "more". The current opening
already does this well — *"Every check mark becomes a brick. Every focus session
funds your skyline."* Keep it. Do not move the MCP paragraph up; it belongs where
it is, near the bottom, for the reader who scrolled that far.

## 5. What to add when it exists

- The 7-day Pro trial is not mentioned in the opening lines. Worth one line near
  the pricing paragraph: *"Pro starts with a 7-day free trial."*
- Data export: add to the description only once it ships (see /changelog/).
- Ratings and reviews are the missing trust signal in both stores. Nothing to do
  about it in copy — do not fabricate testimonials.
