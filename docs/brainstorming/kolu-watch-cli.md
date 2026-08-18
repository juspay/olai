# kolu watch grows up: idle terminals nag until dealt with — no new verbs

Status: brainstorming, rev 5 (2026-08-18). Rev 3–4's `kolu ring` / `kolu snooze` verbs are ruled out — the same semantics land as flags on the existing `kolu watch`. Roadmap: `kolu-watch-next-cli`.

## The problem

An agent terminal finishes and sits at an empty prompt. Nobody notices for hours — twice, on consecutive nights. Every alert we built taps the operator once, when the terminal goes idle; miss that tap and the terminal is silent forever, guarded only by memory. And raw `kolu watch` can't be that alert: it relays byte-level churn (an idle grok repaints ~1/s — a flood), it only shows changes (join late and standing neglect is invisible), and it never repeats itself (ignore a line and it's gone). Both failure modes are field-tested: once-only lost hours; per-repaint flooded the channel in minutes.

## The fix: four flags on `kolu watch`

1. **`--states waiting,awaiting`** — emit agent-bucket TRANSITIONS, not repaints. Padi already knows each agent's bucket through its adapters; filter there, at the source. (This is also the PR #2177 lesson: "screen quiet" is not "agent idle" — grok idles at a ~1s repaint, which starved a 1.5s quiet gate forever. Ask the adapter, never the bytes.)
2. **`--held-for 60s`** — emit only once the state has HELD that long. Debounce where the clock lives, not in every consumer's awk.
3. **`--nag 5m`** — RE-emit while the state keeps holding. The level-trigger: an ignored terminal reappears instead of vanishing after one line.
4. **Snapshot on connect** — first print the currently-matching set, then stream. A late joiner sees standing neglect, not just future changes.

Then `kolu watch --states waiting,awaiting --held-for 60s --nag 5m` is the whole supervision loop: background it, and every neglected terminal announces itself every few minutes until someone gives it work or kills it. The operator's three hand-rolled doorbells (grep/awk pollers with state files) collapse into that one line. No subscriptions, cursors, acks, or client-side state.

**`--json` keeps working, and the flags filter it too** — the NDJSON face is what scripts and jq consume, so the filtering must happen before the stream leaves padi, in both modes. New event shapes carry a `kind` so a consumer can tell a snapshot line from a fresh transition from a nag repeat.

**The id argument stays as it is**: no-arg = the whole fleet (supervision must never be scoped by enumeration — a watcher greppd to two repos went blind to a third, 2026-08-17); one optional id = a debugging tail, composing fine with the flags. No id lists.

## Dock mapping — same condition, three faces

The Dock already has both halves: the pinned **needs-you strip** (fills and empties while a condition holds — the level) and the **attention engine** (fires sound/popup once per transition — the edge). Mapping: "idle ≥ held-for, un-excused" joins what puts a row in the strip; the ding stays fire-once on entry. One semantic change matters: today's unseen-dot clears when you LOOK (`markHostSeen`); this state must clear only when you ACT — work, excuse, or kill. Looking is not dealing; that gap is exactly why terminals sat idle for hours.

## The MCP face — same knobs, one implementation

`watch_open`/`watch_next` share every defect the flags fix, and orchestrators live on this face: `watch_open`'s REQUIRED id list is enumeration blindness institutionalized (a lane not added is invisible — it happened twice on 2026-08-18); `watch_next` fires once per settle, so a terminal that settles and stays idle never re-enters the queue; and a fresh queue after a restart answers "nothing owed" while standing neglect exists. So: ids become optional (absent = whole fleet), the states/held-for filters become subscription params, still-idle terminals RE-enter the queue on the nag interval, and (re)opening delivers the currently-matching set as initial events. One padi implementation serves both faces — the CLI flags and the MCP params are the same knobs, never two codepaths.

## Deferred: the excuse record (was `snooze`)

Legitimizing planned idleness ("waiting on darwin CI, 2h") needs one small durable record per terminal — {until, reason} — surfaced on the Dock tile and excluded from `--nag`. It is NOT a new verb: it arrives later as a Dock action and/or a flag spelling on an existing command, once the watch flags have proven themselves. Until then a legitimately-idle terminal just gets nagged and ignored on purpose, which is noisy but never loses anything.
