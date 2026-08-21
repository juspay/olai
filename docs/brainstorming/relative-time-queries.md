# Relative time in the query grammar: `created:1h` and everything behind it

Status: proposal, 2026-08-21. Born from the human typing `created:1h` into the header search and being refused — the stamps carry second precision (`2026-08-21T16:47:29-04:00`), the operators bottom out at days. `1h` is one value of a family; this file surveys the family across the ecosystem and proposes the olai-shaped subset.

## What the grammar has today

`date:` / `created:` / `changed:` take: absolute day, month or year (`2026-08-10`, `2026-08`, `2026`); relative day-words (`today`, `yesterday`, `tomorrow`, `this-`/`last-`/`next-` with `week`/`month`/`year`); and ranges of either, open at either end (`2026-08-01..2026-08-14`, `..today`, `last-week..`). Anchoring is ask-time, server timezone, weeks Monday–Sunday. Unknown values are refused with the operator's own usage — which is exactly the popover the human saw.

## Prior art

| System | Syntax | Units | Semantics | Notes |
|---|---|---|---|---|
| **Workflowy** | `last-changed:1h`, `last-changed:1d` | h, d only | bare duration = within the last N | The nearest neighbor (outliner); deliberately tiny unit set |
| **Gmail** | `newer_than:2d`, `older_than:1y` | d, m, y — **no hours** | two named directions | `m` means MONTHS here |
| **GitHub** | `created:>2026-08-01`, `created:a..b` | absolute only | comparisons + ranges | no durations at all |
| **Jira JQL** | `created >= -1h`, `-30m` | m, h, d, w | signed duration = point at now−N | `m` means MINUTES; also `startOfDay()` functions |
| **Sentry** | `age:-24h`, `firstSeen:+1d` | m, h, d, w | +/− pick older/younger | duration as point, sign as direction |
| **Grafana / Prometheus** | `now-1h`, `now-7d` | m, h, d, w, y | explicit anchor arithmetic | range = two such points |
| **Elasticsearch** | `now-1h`, `now-1d/d` | full set | date math with **rounding** (`/d`) | power-tool territory |
| **Kusto** | `ago(1h)` | full set | function form | |
| **Splunk** | `earliest=-1h@h` | full set | duration + **snap** (`@h`) | |
| **git** | `--since=1.hour.ago`, `--since=yesterday` | natural-ish | approxidate | forgiving parser, fuzzy edges |
| **find / journalctl** | `-mmin -60` / `--since "1 hour ago"` | minutes / natural | | unit split across flags (find) is the cautionary tale |

**The patterns worth extracting:**

1. **Two families everywhere**: points in time (dates, day-words) and durations-ago (`1h`, `2d`). Every system has the first; the second is what olai lacks.
2. **Bare duration means "within the last N"** in the consumer tools (Workflowy, Gmail) — which is precisely what the human's fingers assumed. The power tools (JQL, Grafana, Splunk) instead treat a duration as a *point* (now−N) and compose it with comparisons or anchors.
3. **The `m` collision is the one real trap**: Gmail's `m` is months, Jira's and Sentry's is minutes. Any proposal must rule this, not inherit it.
4. **Snapping/rounding** (`@h`, `/d`) exists only in the power tools; no consumer tool has it and nobody misses it there.
5. Workflowy's restraint — hours and days only — is a deliberate choice that has held up.

## The proposal

**One new value kind — the duration — spelled `<n><unit>` with units `m` (minutes), `h` (hours), `d` (days), `w` (weeks). No month or year duration units, ever**: that kills the `m` collision by fiat (minutes win, as in Jira/Sentry — the recency-query tools), and month/year recency is already expressible in words the grammar owns (`created:last-month..`, `created:2026`).

Durations slot into the grammar in the two ways the prior art splits on — and olai can honestly have both, because ranges already exist:

1. **Bare duration = within the last N** (the Workflowy/Gmail reading, the intuitive one): `created:1h` answers everything created in the last hour. Formally sugar for `created:1h..`.
2. **Duration as a range end = the point now−N** (the JQL/Grafana reading): `created:..1h` is *older than an hour*; `changed:2h..30m` is a window; `created:yesterday..3h` mixes families, since range ends already take day-words. Inequalities stay spelled as ranges — no `>=`, per the house grammar; no `now-` anchor spelling, because the range position already says which side of now you mean.

**Uniformity**: all three operators take it (`date:`, `created:`, `changed:`) — one value grammar, one refusal text. A day-granular field compares at its own precision, so `date:1h` effectively selects on done-instants (the only sub-day fact `date:` reads); that asymmetry is stated in the docs, not special-cased in the grammar.

**Anchoring and staleness — the precedent already exists**: `today` and `last-week` are already ask-time-anchored; a live page holding `created:today` already goes stale at midnight without a revision. Durations only shorten that horizon (a `created:1h` page drifts within the hour). v1 keeps the existing behavior — evaluated at ask, re-evaluated on any revision — and a coarse re-ask timer for time-anchored live filters is a separate, later decision if the drift ever bites.

**What moves with the grammar**: the operator's refusal/usage text (the popover the human saw), `search.md`, `filter-in-place.md`'s operator table, and the `search_nodes` MCP tool description — same one-grammar-two-faces rule as always.

**Deliberately out**: comparison operators (`>=` — ranges are the house spelling), snapping/rounding (`@h`, `/d`), function forms (`ago()`, `now-`), natural language ("1 hour ago"), and month/year duration units (the collision; words cover it).

## Open questions

1. Does `w` earn its place, or does Workflowy's restraint (h + d only, `7d` for a week) win? Cheap either way; `w` is unambiguous. Lean: include.
2. Bare-duration sugar (`created:1h` ≡ `created:1h..`): worth the second spelling, or should the grammar demand the range form? Lean: keep the sugar — it is the exact string the human typed, and Workflowy/Gmail prove it is the natural reading.
