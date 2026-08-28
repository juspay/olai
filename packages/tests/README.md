# @olai/tests — the browser tests

Cucumber features driven through Playwright against a real `olai` server serving a real directory of fixture outlines. Nothing here is mocked: the server loads `.olai` files off disk, the client renders them over a WebSocket, and the assertions read the DOM a person would be looking at. Every server this suite starts dies with the run: it is a process-group leader, SIGINT / SIGTERM / `exit` of cucumber SIGKILL the group (`support/reaper.ts`), each spawn gets its own `$XDG_RUNTIME_DIR` so lock files do not land in the developer's runtime directory, and on Linux `olai web` dies with its parent.

## What earns a scenario

A scenario has to earn the browser. Grammar, semantics and pure logic belong in the unit suites (`packages/format`, `web`, `ops`, `server`). Re-asserting a unit-tested law here is waste: it costs a Chromium, a server and a corpus copy, and it does not catch a class of bug the unit test missed.

Do not add:

- a scenario for anything a unit test can pin
- a static render assertion (a label exists, a class is present) — those barely can break without a compile error
- one shared law through every door: if the keyboard, the menu, the palette and the agent all meet the same ops-layer sentence, one representative door suffices
- a pixel-threshold or scroll-geometry assertion unless the geometry **is** the feature

This suite **is** for what only a real browser shows: stacking and overlap via `elementFromPoint`, real drag and touch sequencing, live-wire behaviour (watcher edits, reconnects, server death), multi-tab races, CSP and iframe sealing.

## What a step definition may import

The suite shares names with `@olai/web` rather than retyping them — a constant typed twice eventually disagrees with the app it asserts about — and it reaches them through **one door**: the client's `./testlib` subpath (`packages/web/src/suite.testlib.ts`, the curated list, whose header says what goes in and why). What it may not import is anything past that door — a path into the client's own modules — and above all a client **component**: a `.tsx` drags its whole import graph into a process with no browser in it, and that graph reaches `wire.ts`, which dials at module scope and throws without a `location`. One such import once stopped the whole suite from booting, with an error naming `connectSurface` and nothing that looked like a test. `imports.test.ts` fences both ends — a file here spells `@olai/web` as the door or not at all, and the door re-exports no component.


Prefer a shared scratch corpus per **feature** over a private server per scenario. `@share-scratch` at the top of a feature is that opt-in: one copy and one server per worker, and After restores the fixture under the still-running server so overlapping writers can share too. `@own-scratch` on a scenario inside it keeps a private copy, for the things restore cannot make true (a server restart, conversation state, git). A restore that does not put the tree back fails naming the scenario and the files.

This suite is 74 features, 908 scenarios (898 Gherkin `Scenario`/`Scenario Outline` entries; five outlines expand to fifteen examples), 631 `@scratch:`. 28 features carry `@share-scratch` (395 sharing scenarios, 25 `@own-scratch` inside them). A 2026-08-19 audit cut ~160 that did not earn the browser; the grammar, the destination refusals, the trash wording, the install fetch and the rest of that list live in the unit suites now. Four browser-only claims the first cut left unpinned (anchor jump, sidebar inner scroll, same-page never-inside-itself, a preview's height after a late picture) are back.

```
packages/tests/
├── cucumber.js              # the `ui` profile, and its env knobs
├── features/                # Gherkin — what the app promises
├── step_definitions/        # one file per feature
├── support/
│   ├── world.ts             # OlaiWorld: page, locators, the UI contract
│   ├── hooks.ts             # browser + a server per corpus copy (and per scratch copy)
│   ├── reaper.ts            # process-group kill; SIGINT/SIGTERM of cucumber takes the servers with it
│   ├── scratch.ts           # @share-scratch / @own-scratch, restore, the leftover refusal
│   ├── settling.ts          # the client's own count of the keys it has not
│                           #   finished with — the ONE wait after a key (see
│                           #   "Waiting", below)
│   ├── caret.ts             # what is left of the per-key receipts: the
│                           #   click-away's, and the two reads that were
│                           #   never waits
│   ├── said.ts              # what the page said about a write, wherever it says it
│   ├── probe.ts             # what SURVIVED a gesture: a serial on every element of
│                           #   a region and a watch over it, so a scenario can say the
│                           #   column held still rather than that it ended up drawing
│                           #   the same markup
│   ├── mcp.ts               # an MCP client, for the agent olai did not start
│   ├── ndjson.ts            # line-delimited JSON off a pipe — one copy, shared
│                           #   by that client and every fake below
│   └── scripted.ts          # ... and the write half: the JSON-RPC envelope, the
│                           #   requests a fake is waiting on, and the hold
│                           #   protocol — shared by the two scripted agents
├── agent/                   # the two scripted ACP agents the chat scenarios
│                           #   drive — one shaped like the Claude Code adapter,
│                           #   one like opencode — and the fake `kolu` every
│                           #   server finds on PATH
├── bin/broken-git/git       # a `git` that is found and fails, for @git:broken
├── tasks.ts                 # what the PINNED ADAPTER says about a background
│                            #   task — a driver, not a lane: it needs a real
│                            #   agent, which is the point of it
└── fixtures/                # the served directories (see fixtures/README.md)
```

## Running

```bash
just e2e                      # the whole suite against the nix-built binary
```

That is the leg `just check` runs. It is parallel by default, sized to the machine — see `CUCUMBER_PARALLEL` below. To iterate faster, run the suite yourself inside the e2e dev shell (which is the default shell plus Playwright's browsers):

```bash
export OLAI_BIN="$(nix build .#olai --no-link --print-out-paths)/bin/olai"
nix develop .#e2e -c bash
cd packages/tests

bun run test                                     # everything
bun run test features/see_the_outline.feature    # one feature
bun run test features/see_the_outline.feature:45 # one scenario
```

While changing the server or the client, point `OLAI_BIN` at a two-line script that runs the working tree instead of rebuilding with Nix each time:

```bash
just build-client
export OLAI_BIN="$(just dev-bin)"
```

`just dev-bin` writes `.olai-dev/bin` inside THIS worktree. `/tmp/olai-dev` is a path every checkout shares, and two e2e lanes used to drive one tree through it. The wrapper takes the same argv, so the harness cannot tell the difference — but it serves `packages/web/dist`, so a client change needs the `just build-client` first. `just e2e` always uses the nix-built binary, which is what a user runs.

Bun hosts the runner. Bun executes `.ts` directly, so there is no tsx, no ts-node and no build step between a step definition and the browser — which is also why the dev shell needs no node.

It hosts it because the `test` script names cucumber's entry file (`bun ./node_modules/@cucumber/cucumber/bin/cucumber.js`) rather than the `cucumber-js` bin. The bin is a shebang file that says `#!/usr/bin/env node`, and `bun run` executes a package script's argv rather than interpreting it — so the shebang is resolved against PATH. Bun supplies a `node`-to-bun shim there, but only when the host has no node of its own; a machine that has one hands the suite to it, and `nix develop` appends the host's PATH rather than replacing it, so being inside `.#e2e` does not save you. The symptom was the whole suite dying before its first scenario with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`: node refusing the raw-TypeScript `@kolu/*` sources. `runner.test.ts` pins the spelling.

## Environment

Which server the suite drives is two decisions, not one — **who owns the process** and **where it is** — so it is two variables. Set exactly one of them; setting both, or neither, fails at `BeforeAll` and says which to pick.

| variable | meaning |
|---|---|
| `OLAI_BIN` | Path to the `olai` executable. The harness **spawns** one server per corpus as `<bin> web <dir> --host 127.0.0.1` — no `--port`, so the process default of 0 lets the OS pick, pointed at this worker's own copy of that corpus, see below — and waits for the `url=` field of its `serving` line on stdout, decoded with `@olai/log`'s own `findLogfmt` rather than a regex of ours. This is what `just e2e` sets. |
| `OLAI_URL` | Base URL of a server you are **already running**, reused as it is. No spawning, so no per-corpus servers — see `OLAI_CORPUS`. |
| `OLAI_CORPUS` | Only read with `OLAI_URL`: which fixture corpus that one server is serving (default `good`). A scenario needing a different one fails immediately, with the command to run instead — better than quietly asserting against the wrong outlines. |
| `HEADLESS` | `false` opens a visible browser. Anything else (or unset) is headless. |
| `OLAI_TEST_VERBOSE` | Stream the server child's stdout/stderr into the test output. |
| `OLAI_TEST_SLOW` | The multiplier Chromium slows this scenario's RENDERER by (`Emulation.setCPUThrottlingRate`). Unset, or `1`, is a browser nobody touched and no CDP session at all. It is how a race only a loaded box loses is reproduced on a quiet one — see *Making it flake on purpose*. |
| `CUCUMBER_TAGS` | Replaces the default tag filter (`not @skip`). `CUCUMBER_TAGS='@corpus:tangled'` runs only the tangled-corpus scenarios. |
| `CUCUMBER_PARALLEL` | Worker count. Unset, the suite sizes itself to the machine (`os.availableParallelism() - 1`, floored at 1, capped at 4) so a laptop and a CI box both run parallel by default without a flag. Set it to override, including `=1` for a serial run. |
| `CUCUMBER_RETRY` | Scenario retry budget. Default 0 — a local run should show a real failure the first time. |

Playwright's browsers come from the Nix store via `PLAYWRIGHT_BROWSERS_PATH`, which `.#e2e` sets. The npm `playwright` version is pinned to the Nix `playwright-driver`'s (1.61.1) because the driver refuses a browser build it was not compiled against; the two move together or not at all.

## Watching it happen

```bash
nix develop .#e2e -c bash
cd packages/tests
HEADLESS=false bun run test features/see_the_outline.feature:45
```

`HEADLESS=false` shows the browser; a `:<line>` suffix on the feature path runs the one scenario starting at that line, so the window is not a blur of forty others. For a step-through, add `PWDEBUG=1` — Playwright's inspector pauses before every action.

A failing scenario writes `reports/screenshots/<worker>-<scenario-name>.png` whether or not you were watching. The worker prefix keeps parallel screenshots from colliding.

## Showing it to a person

```bash
just build-client
nix develop .#e2e -c bash
cd packages/tests
SHOTS=/tmp/shots bash evidence.sh
```

`evidence.ts` / `evidence.sh` are NOT part of the suite — nothing imports them and `just e2e` never runs them. They drive the real app through one gesture at a time and leave a screenshot beside each, which is what a pull request shows a reviewer that a passing `✔` cannot: what the drop indicator looks like while a row is in the air, what a pick looks like, what the Trash asks before it takes a branch, what a duplicated subtree looks like beside the one it was copied from.

A section may also photograph one page TWICE, once in each half of the palette table: `a-filtered-row-says-why` writes the theme where this browser keeps it (`olai.theme`) and reloads, because the boot script is what paints the first frame and a screenshot taken any other way would be of a page that had already flashed the default. What it is about is a claim no `✔` can show — that a filtered page says why each of its rows is drawn, with the query's words lit where they sit, the ancestry that leads to a match dim, and one clamped line of a note under the row whose only hit is behind its ¶.

A section may also write the served directory behind the app's back, which is the driver's half of the suite's own `I rewrite` step: some refusals are about the set as it *is*, so the thing that provokes one has to be written by somebody other than the tab being photographed — and one section is about that write LANDING rather than being refused. `what-refers-to-this-node` photographs a zoomed node's `Referenced by …` section shut, then open, and then after another hand has added a note naming that node's `@id` in a file the tab never touched: the third shot is the whole claim, because nothing was clicked or reloaded between it and the second. It goes through the driver's `rewrite`, which needs the `VAULT` the runner exports and throws without one — a shot of a gesture that never reached a file is worse than no shot.

One section per run, against a directory the driver has just re-copied and a server it has just started. Restoring the fixture underneath a running server is not the same thing — the store holds the snapshot it last wrote, and a file put back with the same length is a change its watcher is entitled not to notice, so a gesture made after one would be a gesture over a frame nobody can reproduce.

`SECTION=` on its own lists the sections; `SECTION=<name>` runs one against a server you are already running (`BASE` says where).

## Showing what the TOOL surface answers

```bash
just build-client
nix develop -c bash
cd packages/tests
bash reads.sh
```

`reads.ts` / `reads.sh` are the third driver here and are not part of the suite either. `evidence.ts` photographs the app because what it is showing is a LOOK, and `wire.ts` counts bytes because what it is showing is a COST. What a tool surface has to show is neither: the claim is "this question is one call now", and the only honest exhibit is the call and the answer printed beside it. So this connects to `/mcp` exactly as a `.mcp.json` client does, runs a scripted read session, and prints every request and every answer — the refusals included, since a refusal is an answer here and its `kind` travelling as data is half of what the surface promises.

It needs no browser and no `.#e2e` shell. The CLIENT is the suite's own (`support/mcp.ts`, the one the `an_external_agent` scenarios drive), so there is one hand-rolled JSON-RPC client in this package rather than two that could come to speak different protocols. The VAULT is written by the script rather than taken from `fixtures/`, because the session's subject is the SHAPE of a directory — an outline with more than one top-level root, notes under some of the tasks, a second outline to be a typo's near miss, one file that does not parse — and a fixture shared with the suite would drift away from the exhibit the moment a scenario needed a row.

`BASE=` runs it against a server you are already running, in which case the vault is whatever that server is serving.


## Showing what the ADAPTER says about a background task

```bash
nix develop -c bash
cd packages/tests
bash tasks.sh                  # a Monitor that ticks and ends
KIND=bash bash tasks.sh        # a background shell that exits 3
```

`tasks.ts` / `tasks.sh` are the fourth driver here and the only one that talks to no olai at all: it drives the PINNED ADAPTER directly, arms one real background task, and prints what reaches an ACP client beside what the CLI underneath it actually sent.

It exists because `chat-background-tasks-visible` rests on two claims about somebody else's process, and both are the kind a later reader re-decides by assuming. The first is that the adapter as released completes such a call at LAUNCH, which is why olai patches its pin (`acp/patches/README.md`) and which stops being true the day upstream lands its own fix — the timeline is where that shows up. The second is that the task's own EVENTS are on no wire underneath: a monitor's every line reaches the model and the task's output file and no SDK message carries one, so the panel draws the task's life rather than its events. The driver CHECKS that rather than asserting it — a harness frame carrying the monitor's output prints a line saying so, and the day one does, that line is how anybody finds out. The model's own frames are excluded from that check on purpose: the agent is woken per event and says *tick-1 received*, which is the agent's prose and not the task's stream.

It needs a real, authenticated `claude`, so it is a thing a person runs and never a lane — the promises live in `features/the_agent.feature` and in the unit tests, driven by the scripted agent's `watch` verb.
## Measuring what a session costs the wire

```bash
just build-client
nix develop .#e2e -c bash
cd packages/tests
LABEL=after bash wire.sh
```

`wire.ts` / `wire.sh` are the same kind of thing as `evidence.ts` one section up — not part of the suite, never run by `just e2e` — and they answer the question a screenshot cannot: how many bytes a session cost, and down which of the two wires. It opens the app, opens a saved page of a megabyte, rewrites it three times while it is on screen and then opens a note, counting every websocket frame the tab was delivered and every byte fetched off `/media/`.

That is `SESSION=preview`, the first of FOUR. `SESSION=pages` walks an ordinary reading session over a generated vault, which is how `vault-in-browser`'s trade — a small first frame against a round trip per navigation — landed as a number. `SESSION=filter` counts ASKS rather than bytes: it opens a narrowed outline over a 90,000-node vault, picks thirty rows and ticks them off, and reports how many times the page asked the matcher what its filter selects. That third one is the instrument `reactivity-after-the-flip` §3.5 was measured with, and it is what said the coalescing that finding asked for could not help — the ask was already one per published revision, and this gesture's revisions are a procedure round trip apart (the edits go out one at a time through the editor's queue), which is further apart than any window the filter could honestly hold. It is then the ACCEPTANCE TEST for the fix that did work ([brainstorming/filter-rides-the-page.md](https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/filter-rides-the-page.md)): the narrowing is a stream over the page now, so the gesture costs the matcher nothing at all. The counter knows BOTH spellings of the ask — the old `search.matching` procedure and the new `narrowing` subscribe — because `ROOT=` is the whole point of the driver and the two worktrees it measures are on either side of that change.

`SESSION=chat` is the FOURTH, and it counts a second number the other three do
not: **frames** as well as bytes. It asks the scripted agent for a
five-paragraph answer — 3,180 bytes, 634 chunks of five characters, the shape a
model's own tokens arrive in — and reports what one turn cost. Two things make
it a different instrument from the three above rather than a fourth session of
the same one.

The first is that it needs an AGENT, and it is the only session that does:

```bash
AGENT=$PWD/agent/fake-acp-agent.ts SESSION=chat bash wire.sh
```

`support/serve.sh` wires `AGENT` through as the served server's
`OLAI_ACP_AGENT` (and pins `OLAI_AGENT_PATH=` empty, so which agents the driver
finds is a property of the driver and never of the laptop it runs on). Without
it the panel comes up with no agent to send to, and the driver says so and stops
rather than waiting out a timeout on an attribute.

The second is `DELAY=`, and it is the whole reason the session exists in this
shape. `transcript-stream-quadratic` is TWO defects, and only one of them is
bytes: a subscription whose transport acknowledges each frame carries one
publish per round trip, so the cost of a streamed answer is chunks × RTT and
does not move when the link gets fatter. None of that is visible on a loopback
socket, where a round trip is a hundred microseconds — which is exactly why it
shipped. `DELAY=125` puts a relay in front of the server that holds every chunk
for that many milliseconds in each direction (`delay.ts`), so a round trip
through it costs twice that and the numbers on the other side are the numbers a
reader in another country gets:

```bash
AGENT=$PWD/agent/fake-acp-agent.ts SESSION=chat DELAY=125 bash wire.sh
```

The session asks the agent twice — once paced the way a model paces its tokens
(`stream slow`), once as fast as the pipe will take them — and each mark reports
three times as well as the counts: when the AGENT finished (the panel's own cell
going idle, which is not queued behind the answer), when the ANSWER finished
arriving, and the gap between them. On loopback those two are the same instant.
On a link with distance in it they are not, and that gap is what a reader
experiences as an answer being typed out that was finished a minute ago.

`ROOT=` is the knob it exists for: the driver imports nothing of olai, so pointing it at a second worktree measures THAT branch's server through the same session, and the two numbers are comparable. That is how `preview-body-not-shipped`'s were taken — a previewed page's body used to cross the socket as well as the route, so the same session read 3.9 MB on the socket before and about 50 kB after (which is the note, and only the note).

## Photographing a window the wire is allowed to open

```bash
just build-client
nix develop .#e2e -c bash
cd packages/tests
SHOTS=/tmp/shots bash skew.sh
ROOT=/path/to/another/worktree LABEL=before SHOTS=/tmp/shots bash skew.sh
```

`skew.ts` / `skew.sh` are the fourth driver, and not part of the suite either. The other three drive a wire behaving exactly as it does for everybody — `evidence.ts` photographs a LOOK, `wire.ts` counts a COST, `reads.ts` prints what a tool surface ANSWERS. This one is about a wire behaving in one of the two ways it is ALLOWED to and normally does not: the `manifest` cell and the `heads` collection are two members on two channels, and the server declines to promise an order between them ([`@olai/server`'s `runtime.ts`](../server/src/runtime.ts), where a revision is published — "a reader tolerates the skew either way"). A reader that tolerates only one of the two is wrong in a window nobody can photograph by waiting for it, because the order that exposes it is the one the server happens not to produce.

So one frame is HELD, and nothing else is touched: the server is a real `olai web` over a real directory that really does not parse, so the manifest cell really does say `null`; the SECOND frame of `surface/manifest/get` — the `{}` that says the set finally loaded — is held for `HOLD_MS` by a Playwright `routeWebSocket`, and the heads of that same revision pass through untouched. Every frame the driver holds or passes is announced on stdout with a clock beside it, so the transcript says what was interfered with rather than asking anybody to take it on trust. Three shots: the boot over a set that never validated, THE WINDOW (`WINDOW_MS` after the files are repaired on disk, that revision's heads already here and the cell's `{}` still held), and the same page once the frame is let through, which is the control.

`ROOT=` is the knob it exists for, exactly as `wire.ts` has one: the driver imports no olai package, so pointing it at a second worktree photographs THAT branch's client through the same frames, and the two runs are of the same window. That is how `manifest-fold-skew`'s before and after were taken — one run drawing the error report over a directory the tab was holding, one drawing the directory, at the same instant of the same held frame.

The vault is the driver's own, both states of it, for `reads.ts`'s reason one section up: the exhibit is the TRANSITION between a refused set and a repaired one, and a corpus shared with the suite would drift away from it the moment a scenario needed a row. The refused state is a MEANING error and not a syntax one, which is load-bearing — a file that will not PARSE keeps its key and carries its errors (`Head.broken`), so that set still validates and its heads still travel; a row hanging off a parent nothing declares is what leaves the store with no snapshot at all. It is seeded by `bash skew.sh`'s own `--seed` pass, before the server starts, because an empty directory is a valid set and would boot to a directory rather than to the `null` the window opens out of.

What the BEHAVIOUR is held by is not here: [`directory.browsertest.ts`](../web/src/client/directory.browsertest.ts) orders the two arrivals deterministically and [`runtime.test.ts`](../server/src/runtime.test.ts) pins the fact the browser's rule rests on. This is the picture, and a picture is all it is.

## Making it flake on purpose

```bash
export OLAI_BIN="$(nix build .#olai --no-link --print-out-paths)/bin/olai"
nix develop .#e2e -c bash
cd packages/tests
RUNS=20 BUSY=48 sh underload.sh     # one suite, the box pinned
RUNS=6  SUITES=5 sh underload.sh    # five suites at once, as a shared box is
```

`underload.sh` / `underload.ts` are NOT part of the suite either. They exist because the failures this section is about are one scenario in six hundred, never the same one twice — so the fact worth having is a CENSUS over thirty runs and not a log of one, and `underload.ts` reads the cucumber message streams back into exactly that: which scenarios went, how often, on which step, and what each said.

**The two knobs are two different questions, and mixing them answers neither.** `BUSY` pins the cores and leaves this the only suite on the box, so whatever fails under it failed on LOAD. `SUITES` starts several at once, which is what a box shared between worktrees actually looks like, and is the only way to reach the failures that need a STRANGER on the machine rather than a slow one — the shared-port collisions this suite used to have were found that way and nothing else would have found them.

```bash
OLAI_TEST_SLOW=20 bun run test features/zoom_and_navigate.feature:113
```

**And a third question, which neither of those can ask: what does the PAGE lose when the page is slow?** `OLAI_TEST_SLOW` is Chromium's own CPU throttle, and it slows the renderer alone — the server, the harness and the wire keep full speed. That is what makes it a load *simulator* rather than a load test, and it is exactly the right instrument for a race between what the page does and what the page is asked about, because it widens that window and nothing else. It is also the only one of the three a REVIEWER can re-run: `BUSY=48` needs a box to spare and thirty runs to say anything, while the scroll-restore race this arrived with went 1/30 green at `=20` and 30/30 green after the fix, on the same laptop, in a quarter of an hour each way. A number a reviewer can reproduce is worth more than a number they have to believe.

## Fixture corpora

Scenarios do not build their own outlines: they name a directory. A feature (or a scenario) carries a `@corpus:<name>` tag naming a directory under `fixtures/`, and `hooks.ts` starts a server on a copy of it the first time some scenario asks — then keeps it for the rest of the run. Untagged scenarios get `@corpus:good`.

That is why a server-per-corpus exists rather than a server-per-scenario: a server that has loaded a broken set cannot also serve a good one, and spawning one process per scenario would cost more than the assertions do. See `fixtures/README.md` for what each corpus contains and why.

A COPY, and one per worker, because `--parallel` is one process per worker: four workers asking for `good` are four olai, and olai enforces one per directory (`packages/server/src/lock.ts` — a second one over the same files refuses to boot, naming the first). So each worker serves `<its temp root>/<corpus>/served`, made on first ask and thrown away with the worker. Nothing about a scenario changes: the corpus is still shared by every scenario THAT worker runs, which is why writing to it still needs `@scratch:`.

**And the run asserts it afterwards.** Copies and `world.scratch()` make writing into the repository's own `fixtures/` hard, not impossible — a step that joins a raw path would still do it, silently, leaving the next run to read a changed baseline. So `hooks.ts` reads `git status --porcelain` over `fixtures/` before the run and again after it, and fails the run if they differ. Two readings rather than one clean-tree check: somebody ADDING a fixture has uncommitted work there and their run must not fail for it; what may not happen is a change across the run.

**`@scratch:<name>`** is the exception, and the live store is what asks for it. Those scenarios EDIT the served files while the server is watching them, so they get a temp copy of the named corpus that they may write to. By default that copy — and the server watching it — is private to the scenario and thrown away with it. A `@corpus:` server could not survive the edit (the next scenario would inherit it) and neither could the repository (the fixtures are tracked). `world.writeServed` refuses to write anywhere else, so "a scenario scribbled on the fixtures" is not a thing that can happen quietly.

**`@share-scratch`** is how a feature shares one copy and one server, per worker. Put it at the top of the feature; every `@scratch:` scenario in that file on this worker reuses the same process. Sharing never crosses workers: four workers running the same feature are still four olai, for the same lock as the corpus servers. After each sharing scenario the harness drains in-flight writes, puts the fixture back under the still-running server, and asks it to re-read (`POST /olai/resync`). Closing the tab can still have a write in flight (a blur commit, a last key still staging); restoring under that write left `.olai-<pid>-<n>.tmp` on the tree. The POST waits for those writes to finish (`Ops.idle`) before it probes, After drains then restores then probes again, and overlapping writers can share because the next scenario starts from the original corpus, not from the last one's leftovers. A restore that does not put the tree back fails naming the scenario and the files — never a silent flake. Bytes put back are not enough on their own: the store's cheap look is entitled to see nothing in a same-length rewrite that landed in the same second (the evidence driver's own warning, below), which is exactly the shape a restore has. So the POST asks the store for its other freshness class — `refresh("verified")`, "a look you may believe against a tree something outside this process rewrote" — and what that costs the store is the store's business rather than the harness's; the POST does not return until idle, then published. AfterAll kills each server's process group (the olai and the ACP agent it spawned) and closes the pipes before the browser, so a leftover child cannot keep the worker alive past the cucumber summary.

**`@own-scratch`** on a scenario inside a sharing feature keeps a private copy, for the things restore cannot make true: a server restart, conversation state (chat lives in the process and in XDG), `@git` / `@kolu` / `@agent-stored`. It is refused without `@share-scratch`, because a tag that does nothing is how an author thinks they opted out and did not. Chat features stay private regardless of files.

**`@git`** rides on top of `@scratch:`: the scratch copy is made a git repository with the fixtures already committed, and its server is started with `--commit=manual` rather than the harness's usual `--commit=off`. What is waiting to be committed is DERIVED from git rather than counted, so there is nothing to test without a repository — and the assertions at the end of those scenarios are lines out of its log, read through `world.git`. **`@no-git`** is the other half of the same knob: commits ON, and deliberately no repository, which is the only way to reach the Commit pill's "no git here" face. Every other scenario keeps `--commit=off`: committing into whatever repository happens to contain a temp directory is not this suite's business.

A `@scratch:` scenario may also RESTART its server, which nothing else in the suite may do — a `@corpus:` server is running for every other scenario in the run, and a `@share-scratch` server is running for every other scenario in that feature on this worker, and `hooks.ts` refuses both rather than trusting the tag (the restarting scenario wants `@own-scratch`). That is what lets a feature ask the one question no other scenario could: what does an open page do when the process behind it is replaced? The restart comes back on the SAME port, because the page is already pointed at it — `startOwnServer` binds the exact port and fails loudly if the address it got back is a different one, so a port stolen in between reads as itself instead of as a mysteriously dead page.

**The first bind asks the OS.** No `--port` means the process default of 0, so two worktrees cannot pick the same number and cannot squat production. A restart still has to come back on the address the page is pointed at. `holdPort` keeps that socket across the kill; it is released before the replacement listens, so the remaining window is a `listen(0)` elsewhere on the box racing into the same ephemeral port — a hard scenario failure, no retry. The suite used to claim a band below the kernel's ephemeral range so that race was impossible; a worker id is unique inside ONE run and says nothing about the run beside it, so two worktrees both numbered their workers from zero and both scanned from 20000 — which is how one e2e lane dialed another's server, and is why the band went.

## Git, which every other scenario is served without

Every server this harness spawns runs with `--no-commit`: a scratch corpus is a temp copy, and committing into whatever repository happens to contain the temp directory is not the suite's business. That is also a STATE — the one the header calls `commits off` — so it is asserted rather than assumed.

**`@git:<repo|none|broken>`** starts a scenario's server without the opt-out and says which of the three things git is for its directory: a real repository (the scratch copy is `git init`ed with a local identity and a first commit), a directory that is not one, or a git that is FOUND and fails — `bin/broken-git/git`, put first on that server's PATH, answering every call with git's own `fatal: detected dubious ownership`. The last one is the case the indicator exists for: it is not "there is no repository here", and reporting it as if it were is the bug `features/git_state.feature` holds shut — together with the newer one it is named for, which is that ONE control in the header answers for git. That feature counts them.

Like `@kolu` and `@agent-stored`, it needs `@scratch:<corpus>` — what a server commits to is decided when it is started, and a `@corpus:` server is running for every other scenario in the run. The `Before` hook says so by name.

One of those scenarios goes the whole way rather than reading chrome: it asks the agent for a write under a broken git and opens the tool call's detail, which is the op's own reply as the reader gets it. That is the only assertion in the suite that follows one field (`Applied.why`) from the ops layer, through the internal MCP server and the transcript, onto a screen.

## What crossed the socket, as against what the page drew

**`@wire`** keeps every websocket frame of the scenario's life, in both directions, so a step can say what the server chose to send this reader — `the websocket carried "…"` and its negative — and what this tab ASKED FOR. Nothing else in the suite can answer either: `world.requests` is what the page FETCHED, and the surface's traffic makes no requests at all. Every procedure call and every subscription this client opens is a frame on that one socket (`@kolu/surface`'s links).

It is a tag rather than the default because unlike the request and error recorders it retains PAYLOADS — a transcript's token-by-token deltas, a document's whole body. A scenario that forgets it does not quietly pass a negative over an empty list: `world.socketCarried` throws, the way `world.requestsWatched` does for the same class of mistake. It also throws on a probe string carrying a character the framing escapes, since the frames are raw and such a probe would be absent whether or not the body was sent.

**What the server SENT.** Two scenarios are the halves of one rule (`html_previews.feature`): a previewed `.html`'s body must never cross the socket — the frame fetches the file over HTTP — while a `.md`'s body must, because that reader has no other way to have it.

**What the tab ASKED.** The other direction answers a claim no assertion about the DOM can make: that a gesture cost the wire nothing. A client that re-asks a question whose answer cannot have changed — a title looked up on every keystroke, a subscription re-opened on every frame that redraws the row it is about — draws exactly what a correct one draws. So those claims are counted: `I mark the wire`, the gesture, and then a step in that feature's own words (`node_context.feature`'s *the tab has asked what the armed nodes are called 0 times*, `move_to_picker.feature`'s *the tab has asked to judge this move 0 times*). Counted from a MARK, through `world.socketAskedSince`, because a count over the scenario's whole life is a count of the boot as well.

The probe those steps hold is a wire TAG — `<member>/<verb>`, which is how kolu addresses a surface member (`surfaceTag`, whose whole tag is `<prefix><member>/<verb>`; the prefix is left off, so the probe is a substring however the surface is composed). A second probe beside it narrows the same question to the ARGUMENT — a tag plus an id is *did this tab ask that member about that node* — which is what a claim about what a gesture asked ABOUT needs: a panel that opened asking about the rows the last one was showing sends the right member with the wrong argument, and the tag alone cannot tell the two apart.

And its mirror, `world.socketSaidSince`, is how a scenario says a tab STOPPED watching: a subscription nobody let go of leaves no other trace — nothing is drawn from an answer to a question nobody is asking, so the answer ARRIVING is the whole of the evidence. Both take several probes and want them all in one frame, because a field name alone is a substring of other members' frames.

## A phone, and the two things it changes

**`@phone`** on a scenario gives it a handset context instead of a laptop one: 390×844 CSS pixels, a touch screen, no mouse. It is orthogonal to the corpus tags — a scenario carries both. `isMobile` is what makes Chromium honour the shell's `<meta name="viewport">` at all; without it the page is laid out as a very narrow desktop, which is a different thing that happens to fire the same media queries. It is not one of Playwright's `devices` presets, because those also install a Safari user agent on top of Chromium and none of these scenarios are about what the browser calls itself.

Those scenarios do two things nothing else in the suite does. They **tap** (`locator.tap()`, a real `touchstart`/`touchend` pair) rather than click, which is the only way to find out that a control a pointer can reach is reachable without one — and, for the row menu a phone opens by HOLDING a finger, they **hold** and **flick** (`world.hold()` / `world.flick()`), which Playwright has no verb for: those go in through `Input.dispatchTouchEvent` on a CDP session, so Chromium's own gesture recogniser sees the press. That is the point of the extra machinery rather than a synthetic `pointerdown` — the client's answer to a long press is only half of what happens, and the browser's own half (the `contextmenu` it raises mid-gesture, the text-selection callout with it, the click it makes up when the finger lifts) is exactly what that affordance has to coexist with. The hold is the client's `LONG_PRESS_MS` plus a margin, imported from the client for the reason every selector here is. And they **measure** when the promise is a property no attribute can carry: chrome that has to stay inside the header, a drawer that covers the outline. The rendered markdown a document draws (`document_steps.ts`, `app_steps.ts`) is the same exception — the tags are correct however badly they are set and the damage is only in the layout. An anchor jump (`sticky_header_steps.ts`, "the heading is clear of the header") is the same exception said about movement: a fragment that changes the address and scrolls nowhere leaves every attribute on the page exactly as it was, and only the heading's box says so.

The install surface — the manifest, the icons, the viewport, and WHICH of the framework's two `/sw.js` workers this origin serves — is the server's to pin (`packages/server/src/serve.test.ts`). An installer asks the process, not the page, and a browser scenario that only fetched URLs was not earning Chromium.

## The one client that is not a browser

`features/an_external_agent.feature` is about the tool surface a coding agent in a terminal reaches, so its steps are not a browser at all: `support/mcp.ts` POSTs JSON-RPC at that server's `/mcp` — the same URL a `.mcp.json` names. The client is hand-rolled and tiny on purpose; an MCP SDK here would be testing that SDK's framing against ours rather than ours.

The assertions afterward DO go through the browser, and that is the whole point of putting these scenarios in this suite instead of a unit test: the claim is not "the write happened" but "the page a person is looking at followed a write made by a client it has never heard of". They are `@scratch:` for the usual reason — the agent writes.

## The claim only the AGENT can make

`features/node_context.feature` is about a row handing the agent a node, and what has to be proved is not that a chip appeared — it is that the node reached the AGENT, in a form it can act on. No browser can say that. So the scripted agent says it: its `context` verb reads the id out of its own prompt, calls the real `read_node` with it over the real MCP route, and reports the title that came back. A sentence like *`order` is the node titled order the new cabinets* cannot be produced by a build where the id never left the browser.

The sentence had to be picked carefully, and a sabotage run is what said so: the chip on the sent message carries the node's TITLE too, so a step matching the bare title anywhere in the panel passed with the context stripped out of the prompt entirely. What it asserts on now is the agent's own phrasing, scoped to the answer. The same run caught an absence asserted before the thing it was about had arrived. Both are the ordinary failure of an e2e assertion — passing for a reason that is not the feature — and both are cheap to find by breaking the code on purpose and expensive to find any other way.

Two more of that shape were found by review, and both are pinned here now. A press that should stay on the page asserts the ADDRESS afterwards: "the row lit up" is also true of a row on the page a navigation just landed on, so the scenarios that mean *in place* now say which page they are still on — and the one that means *go there* was already saying it. And a PLACEMENT the agent named is its own scenario, written with `I rewrite` rather than into the fixture, because it is that scenario's subject and nobody else's: the mirror id has to arrive at the node it shows, or the reference names a row that does not exist. The scripted agent's `name <id>` verb exists for it — an id in prose, no tool call, because the id a scenario wants named is not always one a tool would accept.

## Colour, which is the one thing a step may not write down

`features/theming.feature` is about the named palettes, and not one of its steps names a colour. The paper is compared against ITSELF (before a pick, after a pick), against the browser chrome — the status-bar colour and the tab's own mark, both from the same table — and against what the manifest says — never against a hex, which would make the suite the place a design decision has to be changed. The default theme, the attribute, the storage key and the custom-property name are IMPORTED from the client that owns them — the same argument as `TESTID`, one level up: renaming any of them is a type error rather than a timeout, and markup added so a test can read a constant back is markup every reader ships. The only strings the feature spells are the two or three themes a scenario asks for by name, which is the scenario saying what it wants.

Two of its scenarios are about what does NOT happen. One records every request the page makes (`world.watchRequests`) and asserts a pick made none: "it works" and "it works without asking anybody" look identical on screen. The other installs a `MutationObserver` before any page script and reads `document.readyState` at the moment `data-theme` appears — `loading` is the parser still going, and it is the only evidence that a stored theme beat the first paint rather than flashing the default at everybody on every load.

Its last scenario opens a SECOND page in the same context, which is what makes it a second tab of the same browser rather than a second browser: one origin, one `localStorage`, and a `storage` event fired in every document of it except the one that wrote. The second tab is left open on purpose — a preference that only crossed once the other tab was gone would pass a scenario that closed it.

The chips themselves are a ROW of the preferences panel (`features/preferences.feature`), so every scenario here opens that panel to reach one — `showPreferences` in `preferences_steps.ts` is shared for exactly that. What the retired header pill promised, and what the theming feature still asserts under a new name, is that something NAMES the theme in force: it is the Theme row's hint now. Mutation-tested both times — hard-coding the name to "chalk" passed every theming scenario until a step asked.

`features/preferences.feature` carries the same second-tab scenario for the OTHER preference, and it is worth its own sentence because a reload cannot ask the question: deleting `followDoneHidden()` outright passes every other Done scenario in the file, and fails this one. The reload scenario is the boot read, not the write: applying the default at module load (`pref.set(SHOWN, { persist: false })` after the factory) reddens only `It is remembered`. The write is the stored-key step on the hide scenario, which master already shipped. It also holds the two ends of the panel's TAB CYCLE — Shift+Tab out to the trigger, Tab back in to the first control — which is the promise a portalled panel cannot get from document order. Both were sabotage-checked against the fix they are the fence for.

## The one thing this suite's browser cannot draw

Playwright's Chromium ships **no PDF viewer**, and neither does its Firefox (which disables pdf.js by preference). Both were checked rather than assumed. That is a fact about the harness and not about olai — real Chrome draws `fixtures/good/reports/q3.pdf` in its own viewer, toolbar and all — so `features/pdf_csv_and_pictures.feature` asserts the disjunction it can honestly make: **the viewer drew it, or the page says it cannot and hands over the file**.

The half that is worth having is the second one, and it is only assertable *because* this browser has no viewer. A `.pdf` page is an `<object>` rather than an `<embed>` for exactly one word — fallback — so a browser that will not draw a PDF must land on a sentence and a link to the file rather than on an empty rectangle. This is the one browser in the house that can produce that failure, and it does, on every run.

What the viewer itself looks like is evidence rather than a scenario: the PR's own pass drives real Chrome (`google-chrome-stable`, through Playwright's `executablePath`) against the same fixture.

## Breaking the client on purpose

`features/the_client_breaks.feature` is the one scenario whose subject is a bug in olai rather than in an outline, and it is the only place in this suite that reaches past the app's own surface. Every other error here is DATA — a fixture that does not validate — while a fault in a render is not data, and the app deliberately offers no way to ask for one: a fault switch shipped is a fault switch in production.

So it is injected with `addInitScript`, into `String.prototype.padStart` and only for the exact call the date arithmetic under the client makes (`@olai/format`'s `calendar.ts`), which every page runs through before it can draw. Narrow because a builtin broken for everybody would take out a dependency's module initialisation or the fault card itself, and the scenario would be proving something else. The coupling is answered rather than hidden: if that call stops happening the app draws itself perfectly, and the step fails in a second saying exactly that instead of timing out with nothing to say.

## The UI contract

Steps address the app through `data-testid` and `data-*` attributes, never a CSS class — a class is a styling decision a refactor is entitled to change; a `data-testid` is a promise. Every selector is a named constant at the top of `support/world.ts`.

The names are not written down twice. `support/world.ts` imports the client's own `TESTID` record and its `selector()` helper through the client's `./testlib` door (the first reason `@olai/web` is a dependency of this package), and builds every constant from it. The same rule covers the handful of other constants a step would otherwise re-spell — the day arithmetic, the theme table's attribute, storage key and default — but never MACHINERY: these tests drive the client through a browser, and nothing one imports here may need one. The furthest an import goes is a PURE READ of the client — the door's own two such reads are named in its header as the exception to names-only, one rule and one class. A renamed testid is therefore a type error at `bun run typecheck`, not a thirty-second timeout in a scenario that no longer says why it failed. `#root` stays spelled out locally: it is `index.html`'s mount point, which the client does not own.

**Narrowing a selector by an attribute value goes through one helper.** `support/selectors.ts`' `attr(name, value, match?)` — re-exported by `support/world.ts`, so a step imports it beside every other selector name — builds `[data-file="…"]` with the value QUOTED SAFELY. `match` is the CSS matcher and defaults to `=`; `~=` is the other one that exists, for the step asking whether a blocker is among the several `data-blocked` lists. Sixty steps across seventeen files used to paste the value straight between two quotes, and what that is one value away from is not a missed row: a `"` ends the CSS string early, Playwright refuses the whole selector, and the step dies naming a parse error rather than the thing it could not find. Nothing in the app was ever at risk — Solid writes dynamic attributes through `setAttribute`, so the DOM is escaped by construction — which is why this is a rule about test selectors and lives here. `selectors.test.ts` holds the grammar (the quote and the backslash are escaped, a newline becomes `\a `, and *nothing else* is, because escaping more than the grammar asks for is how a selector quietly stops matching); `it_stays_live.feature`'s scenario about an outline whose file name carries a quote is a real Chromium agreeing with it. Four selectors are built inline instead, and each says why where it is: they sit inside a `page.evaluate` callback, which runs in the browser where `attr` does not exist, and all four interpolate a value from a closed table. **The rule is a sweep, not a sentence** — `selectors.test.ts` reads every step and support file and requires the hand-built set to be exactly those four, because `data-from` was the *fourth* spelling of this idiom when #182 met it and a suite where some steps are careful and some are not teaches the next step to be careless. **And the sweep's own pattern is tested**, which is not belt-and-braces: its first draft read `[` + a literal name + `="${…}"` and was blind to five real call sites — a matcher other than `=` (`[data-blocked~="${blocker}"]`), and four with an interpolated *name*, among them `expectAttribute`'s `[${attribute}="${expected}"]`, which is how most steps reach the DOM at all. None was safe by design; they were safe because no scenario had yet typed a quote. All five go through `attr` now, the pattern reads the shape rather than one spelling of it, and a test spells out both what it must catch and what it must leave alone.

| selector | what it marks |
|---|---|
| `#root` | the mount point |
| `[data-testid="outline-list"]` | the sidebar's file tree (outlines and documents under folders) |
| `[data-testid="outline-link"][data-file]` | one outline entry in that tree |
| `[data-testid="outline-tree"]` | the outline tree pane (nodes of one file) |
| `[data-testid="node"][data-node-id]` | one node; also `data-status`, `data-collapsed`, `data-mirror` |
| `[data-testid="node-title"]` | the title text — inline-only markdown (bold/links/code), never block elements |
| `[data-testid="tag"]` | a styled inline `#tag` |
| `[data-testid="date"]` | the date badge; `data-occasion` is which of the node's dates it is (`date`, or the mark carrying one) |
| `[data-testid="desc"]` | a node's note — one clamped plain line under the title when closed (`data-preview="true"`, `data-open="false"`), full markdown when open (`data-open="true"`); always full on a zoomed page |
| `[data-testid="node"][data-note-open]` | note expansion: `true` while click/tap-opened |
| `[data-testid="toggle"]` | the collapse/expand control on an outline node (hover-reveal on a pointer device; always drawn on a phone) |
| `[data-testid="node-menu"]` | the `•••` menu trigger left of the triangle — pointer devices only (not laid out on a phone, where a long press on the row opens the same menu) |
| `[data-testid="node-menu-panel"]` | the open menu panel (`absolute` under the trigger, or under the row itself on a phone) |
| `[data-testid="node-menu-item"][data-action]` | one verb in that panel: the reads (zoom, expand/collapse, expand/collapse all, copy link), then the writes it applies to (the marks, clear date, remove placement, trash) and `Copy as text`. The two buttons of a confirm are items too (`data-action="cancel"` is the way out) |
| `[data-testid="node-menu-confirm"]` | the question that panel asks before `Move to Trash`, naming the row and how many rows go with it — present only while it is asking |
| `[data-testid="node-menu-said"][data-tone]` | what the last verb said, beside the `•••`: `alarm` for a refusal (the ops layer's own words, or a clipboard the browser refused), `aside` for news about something that happened — a nudge from a write that landed, or a copy confirming it reached the clipboard (`link copied` / `text copied`), which is the one case where the page itself shows nothing |
| `[data-testid="file-dir"][data-path]` | one folder in the sidebar file tree; `data-collapsed` says whether its children are hidden |
| `[data-testid="file-dir-toggle"]` | the fold control on that folder |
| `[data-testid="document-link"][data-file]` | one document entry in the file tree |
| `[data-testid="document-page"][data-file]` | one document, as a page |
| `[data-testid="document-body"]` | a document's rendered markdown, on its page, inline under a node, or as a day's note |
| `[data-testid="day-note"][data-file]` | THE day's note on a day page: the document named for that date, drawn above the dated nodes |
| `[data-testid="day-note-link"]` | its heading — the way from the day to that document's own page |
| `[data-testid="toc"]` | a document's table of contents, above its body — a `<details>`, so whether it is open is the element's own state; ABSENT on anything that is not a document's own page, and on a document with fewer than two headings |
| `[data-testid="toc-link"]` | one line of it: a link to a heading in the same page, its `href` naming the id that heading carries |
| `[data-testid="doc-ref"][data-doc]` | a node's `doc`, at its RESOLVED path; `data-inline` when the document is drawn whole |
| `[data-testid="doc-link"]` | the link inside that reference |
| `[data-testid="node-gutter"]` | one row's own line — its controls and title, and nothing from the rows nested under it |
| `[data-testid="zoom"]` | a row's bullet: the link to that node's own page; `data-halo="true"` when the row is collapsed with children |
| `[data-testid="checkbox"][data-status][data-face]` | the status box beside that bullet: `data-face` is `checked` / `doing` / `empty` (CSS squares, not Unicode glyphs) — and NOT PRESENT on a node carrying none of them, which is how a bullet is told from an unstarted task |
| `[data-testid="node"][data-blocked]` | the ids a node is waiting on, space-separated and in the promised order; ABSENT when nothing is in its way |
| `[data-testid="blocked"]` | what draws that: the mark column's waiting face (`data-face="waiting"`) on a row or a day entry, the named blockers on a zoomed page |
| `[data-testid="tip"]` | this app's own hover tip; what it says is also the control's `aria-label`, and where it goes is clamped to the window |
| `[data-testid="see-refs"]` | a node's free cross-references (`see`) |
| `[data-testid="node-ref"]` | one link from a node to another node inside either of those rows; the target id rides `data-ref` on a span inside it |
| `[data-testid="zoom-title"][data-node-id]` | the heading of a zoomed page — the CANONICAL node's id |
| `[data-testid="breadcrumbs"]` / `[data-testid="crumb"]` | the ancestry above a zoomed node, and one link in it |
| `[data-testid="empty-under"]` | said on a zoomed page with no rows: a leaf, or a subtree Prefs has hidden |
| `[data-testid="nothing"]` | said when the address names no file the directory holds — a missing `.md`, a missing outline. Absent while the pane is still on `Reading…` |
| `[data-testid="not-found"][data-reason]` | shown when `/#<id>` names no node |
| `[data-testid="error-view"]` | shown INSTEAD of sidebar + tree when nothing has ever validated |
| `[data-testid="error-file-group"][data-file]` | one group per file with errors |
| `[data-testid="error"][data-code]` | one error row; its text names `<file>:<line>` |
| `[data-testid="cross-file-errors"]` | errors implicating two files |
| `[data-testid="stale-banner"]` | shown OVER a last-good tree: the files stopped validating |
| `[data-testid="broken-file-line"][data-file][data-state]` | ONE broken file's line inside that banner — its path, its state (`unreadable`/`unparsed`/`invalid`) and a row COUNT. Never the rows: the banner is drawn over somebody else's page |
| `[data-testid="broken-file-more"]` | …and the tail, when more files are broken than the banner draws |
| `[data-testid="outline-failure"][data-file]` | shown in ONE outline's place: that file will not parse |
| `[data-testid="outline-link"][data-broken]` | the sidebar entry of a file that will not parse |
| `[data-testid="connection"][data-connection]` | the connection dot, in every shape of the app: `connecting`, `live`, `reconnecting`, `retired` |
| `[data-testid="offline"][data-connection]` | THE FREEZE: over everything, with everything under it inert — the wire cannot carry a question, so the app takes no gesture at all. `data-connection` is the state that froze it |
| `[data-testid="reload"]` | the button in that surface — the whole of the recovery |
| `[data-testid="commit-pill"][data-state][data-uncommitted][data-repo][data-auto][data-push-refused]` | the Commit pill, ALWAYS drawn, and the header's ONE indicator for git; `data-state` is the face — `off`, `no-repo`, `error`, `never`, `committed`, `waiting`, `blocked`, or `unknown` before the first frame. Two facts ride BESIDE the face because they are different questions about the same directory: `data-auto` is what the server's quiet window is doing (`off`, `armed`, `paused`) and `data-push-refused` is present when the last push was refused, which is what takes the ✓ off a healthy face. What git SAID is its `aria-label` and its tip, never a colour; the inert faces carry `aria-disabled` and stay focusable |
| `[data-testid="commit-last"]` | what olai last recorded here, or the words saying it never has |
| `[data-testid="commit-panel"]` | the panel it opens |
| `[data-testid="commit-change"][data-node-id][data-sort]` | one node that changed, and WHAT changed about it — never the phrase it is rendered as |
| `[data-testid="commit-blocked"]` | why the repository cannot take a commit right now |
| `[data-testid="commit-message"]` / `[data-testid="commit-now"]` | the message box, and the button |
| `[data-testid="prefs-trigger"]` | the header's one way into the preferences — the theme pill beside it retired into the panel |
| `[data-testid="prefs-panel"]` | the panel it opens, portalled out of the header |
| `[data-testid="prefs-row"][data-pref]` | one preference on it — `theme`, `done` |
| `[data-testid="prefs-hint"]` | that row's line about the choice IN FORCE, re-read whenever the control moves |
| `[data-testid="prefs-choice"][data-value]` | one segment of a two-way choice; `aria-pressed` says which is in force |
| `[data-testid="prefs-scope"]` | the footer line: these are this browser's, and are never sent |
| `[data-testid="theme-chip"][data-value]` | one chip of the Theme row; `aria-pressed` says whether it is the one in force |

## Adding a test

1. Write the scenario in a `.feature` file, in the language of the promise rather than of the DOM. Check it against **What earns a scenario** first.
2. Run it. Cucumber prints a snippet for every step it does not recognise.
3. Implement the step in the `step_definitions/` file for that feature, as `function (this: OlaiWorld)` — never an arrow function, which would not get a `this`. Assertions are `node:assert`; there is no `expect`.
4. If it needs an outline no corpus has, add it to `fixtures/good` rather than inventing a corpus — the fixtures are documentation too, and three small readable directories beat thirty single-purpose ones.
5. If it needs to CHANGE a file, tag it `@scratch:<corpus>` and write through `world.writeServed`. Put `@share-scratch` at the top of the feature rather than paying a process spawn per scenario — overlapping writers share too, because After restores the fixture. Tag `@own-scratch` only when restore cannot make the next scenario's baseline true (a server restart, conversation state, git). The assertions that follow such a write usually need to wait for something to change or disappear, which a Playwright selector cannot state — `world.waitUntil` is what those steps are built on.
6. If the edit changes WHICH records exist — an insert, a delete, a reorder — assert the id multiset (`the outline "x.olai" shows exactly the nodes "…"`), not that some title eventually reads a certain way. A tree that has lost one node and drawn another twice still has all the right titles in it, which is how a broken live view stayed green through a whole feature file.
7. Read the section below before writing a step that reads the disk or presses a key. All three mistakes it names pass on an idle laptop.

## Waiting, which is the whole of being honest under load

This suite runs parallel, on machines that are also doing something else, so every assertion in it is a race unless it was written not to be. A run on a saturated box is the only way to find out — `sh underload.sh` is that run, and it counts what it dropped rather than leaving five logs to read — and there are exactly six ways to get it wrong. All six are green on an idle laptop.

**A value read on its way to its final one.** Most assertions here WAIT: they poll until the page or the file says the thing, and fail saying what they were waiting for. The ones that cannot are the NEGATIVES, and a negative is two different steps that read almost the same:

| the claim | the shape | example |
|---|---|---|
| nothing was written, and stays unwritten | HOLD: assert repeatedly across the commit window | `"house.olai" holds no node titled "…"` |
| the write took it away | WAIT: poll for it to go | `"house.olai" no longer holds a node titled "…"` |

Asking the holding form of a write passes only when the round trip happens to land inside one animation frame. Asking the waiting form of "nothing was written" passes instantly and proves nothing. Where a count is the claim, it is both: wait for the number, then hold it, because the second of two writes lands a moment after the first.

A one-shot `isVisible()` to pick WHICH element to wait on is the same mistake: the overlay is always in the DOM and always carries `data-connection`, so `the connection is "retired"` waits on that attribute (and, after a restart, on the handshake in the server log) rather than sampling whether the freeze dialog is up this tick. A miss on a phone has no pill to fall through to (`on_a_phone.feature:79`).

**A file the write has not minted yet** — `_olai/Trash.olai`, which the first trash creates, and `_olai/Inbox.olai`, which the first capture does. A waiting reader goes through `world.servedNodesSoFar`, which answers "nothing there yet" for a file that is not there; a step that WRITES the served directory goes through `world.servedNodes`, which throws. The reason either is right is on the method.

**A key pressed before the page has answered the last one.** The one that costs the most to debug, because it fails four steps later on something that reads nothing like the cause: `Escape` closes a draft that has not opened yet and the draft opens behind it, so every ⌘Z after that is dead; `Tab` walks the browser's focus ring out of the row, so the next key finds no editor; `⌘A` selects the page, so the title typed after it lands beside the old one instead of replacing it.

**The client says when it has finished with a key, and that is the whole of the contract now.** `data-keys-settling` rides the app shell and counts down to `"0"`: how many keys this tab has not finished with (`@olai/web`'s `client/quiescence.ts`, where what holds the count and what deliberately does not is argued out one edge at a time). `support/settling.ts` is this side of it — `pressed`, `typed`, and `keysSettled` for a key aimed at a box through a locator — and there is ONE wait after every key in this suite, the same wait whichever key it was.

What it promises when it returns: every handler the key reached has run; every procedure the key SENT has been answered, refused or not; the write queue has drained everything the key put on it, which means the file was written AND the inverse ⌘Z spends is on the stack; and the frames that draw all of it are committed.

What it does not, and so what still needs a wait of its own:

| not covered | why | what waits instead |
|---|---|---|
| a debounce — the idle commit, a search settle — AND the write at the end of it | the timer is cancelled and restarted by the next keystroke, so waiting it out is waiting for the reader to stop typing; and the write it eventually makes lands in a task of its own, where no key is being handled, so it goes on the write queue uncounted exactly as a pointer's does | `IDLE_COMMIT`; `data-asked` through `support/shortlist.ts` |
| what another writer did — a watcher, a second tab, the agent | not this key's effect, however soon after it lands | the disk and the row, which poll |
| a turn | `Enter` in the composer is settled when the server has TAKEN the message | the transcript's own steps |
| an animation, a transition, a measured collapse | the count is about the DOM the key committed | the geometry, where the geometry is the claim |
| a POINTER | the count is about keys | `support/caret.ts`, which is what is left of the per-key receipts: the click-away's, and the two reads that were never waits |

`I press "…" without waiting` and `I press "…" twice without waiting` are how the two scenarios that MEAN the race say so, and they are the whole of the exception.

**What this replaced** was a proxy per key shape, kept in this package: the caret leaving a line for `Enter`, the caret arriving for `Tab`, a draft closing for `Escape`, a list going for a completion. Each was a guess at the thing rather than the thing, and two keys had no proxy at all — `Control+Enter` redraws a row without moving the caret, so nothing visible changes when the client takes the caret back from where it already is, and two of those in a row was a race nobody could write a wait for.

**A gesture aimed at the tab across a DISK assertion.** The newest one, and the one that reads most like a passing step. A write goes: the server writes the file, publishes the new set, and only then answers the tab that asked (`packages/store/src/store.ts` — *rename them all → re-probe and publish → the caller's post-publish hook*). So a step that polls the disk is reading a fact the server has, and the tab has not — and the tab has rules that turn on having been answered:

| the rule | where | what it does to a gesture aimed too early |
|---|---|---|
| the inverse is filed when the answer comes back | `writes.ts` → `edit/undoing.ts`'s `record` | ⌘Z spends an empty stack: it draws `nothing to undo`, and the late `record` wipes even that, so the page keeps no trace |
| one write at a time | `palette/Palette.tsx`, `edges/editing.tsx`, `date/DatePicker.tsx` — all `sending` | the second write is dropped where it stands: no op, no sentence, nothing on screen |

Both were measured under load, and both failed fifteen seconds later on a file that never changed. So a scenario that makes a write and then aims something ELSE at the same tab needs the tab's own receipt in between, not the disk's: the palette's remark (`I capture …` now waits for it), the row the page redrew (`the node "…" comes after "…"`), the box re-primed. One of those receipts is a message SHORT, and takes a frame on top: what the edge steps watch is the refs the snapshot drew (`edge_steps.ts`'s `drawnOrSaid`), and the snapshot is one message ahead of the answer on the same wire — so the happy path waits a frame after the chip moves, which is the same ritual `support/settling.ts` now performs for the keys. The disk assertion is still worth making — it is the claim about what LANDED — it just is not a gate. A cold `goto` after a write is the same class: `page.goto` aborts the in-flight apply, so the node leaving the outline is the receipt, not the navigation.

**A press aimed at a control something is pinned over.** Playwright hit-tests the point it is about to press, and when something else is on top the action is RETRIED — every attempt re-running "scroll into view if needed", so a press that could not land where it was aimed is rescued by scrolling the page to wherever the browser had to put it for the press to reach. Nothing says so; the step passes. It stays invisible until a scenario is about WHERE THE PAGE IS, and then it is fatal: `zoom_and_navigate.feature`'s scroll restore scrolled to the bottom, pressed a bullet lying under the pinned `kitchen` section heading (`client/Tree.tsx` — a section holds its place while its own branch scrolls past), and was rescued to the top before the navigation, so the client remembered 0 and put the reader back at 0, correctly, against a number the step had sampled before any of it. `world.press` measures it first now — `elementFromPoint` at the point the press would land — and the test is `sticky` ALONE, which is the app's own distinction rather than a guess. Something sticky holds its place IN THE FLOW (`AppHeader.tsx` argues that choice for the bar): it is chrome the page scrolls under, it will still be where it is next frame, and moving the page is what a reader does to reach what it covers — so one arithmetic scroll clears the control, the short way out among the directions the page has room for. Something `fixed` is an overlay over the whole app (the drawer, its scrim, both faces of the chat panel) and scrolling the page out from under one is not a reader's answer to it; neither is anything else on top, which is on its way somewhere. Both are left exactly alone, because waiting for them to go is what Playwright already does and does correctly. What is NOT left alone is a control whose centre is off the screen — `elementFromPoint` answers `null` there, which is not a cover but is not pressable either, so it is scrolled into view first and then asked again: a press that needs a scroll to reach at all is the very case the retry would have rescued silently. A scenario that RECORDS where the reader is must record it after that reach, which is what `I scroll to the bottom of the page, keeping the bullet of "…" pressable` says and the plain sentence does not.

**A search asserted before the query it typed has been answered.** The shortlist, the filter bar, the ⌘K palette and the `@` list all publish `data-asked` — which query the rows on screen answer. `support/shortlist.ts` waits on it. A negative (`the palette lists no document`) that held after one frame was reading the previous query's rows.

None of the six mistakes is fixed by a longer timeout, and a step that needed one was asking the wrong question. This one is the sharpest case: the gesture was *lost*, so the fifteen seconds are the budget and not the latency, and a minute would fail the same way.

**What the first four were worth, measured** (2026-08-16, 32-core box, five suites at once, six rounds each — thirty full runs both sides; the fifth, a search asserted before `data-asked`, is this file's 2026-08-24 addition, and the sixth, a press rescued by a scroll, its 2026-08-25 one):

| | drops | runs that dropped something |
|---|---|---|
| before | 27 | 20 of 30 |
| after | 6 | 6 of 30 |

The seventeen port drops went to zero, and so did the four faces of the disk-as-receipt mistake. The one scenario this suite had not answered — `A rename staged by hand reads as a rename`, which burned a thirty-second wait and still could not pin the pill — is gone. It never answered, and keeping it was the wait budget talking.

**Re-baselined** 2026-08-21 on `kolu-ci-6` (32-core Intel i9-14900K, 125 GiB), SHA `399cf308`, after the ~150-scenario cut and `#281`'s scratch-sharing. Two knobs, never mixed — LOAD pins the cores; STRANGER is five suites at once:

| knob | settings | runs | with a drop | scenarios dropped | port/lock |
|---|---|---|---|---|---|
| LOAD | `RUNS=20 BUSY=48` | 20 | 11 | 19 | 0 |
| STRANGER | `RUNS=20 SUITES=5` | 100 | 17 | 18 | 0 |

Port/lock did not move: it is still zero, the way the 2026-08-16 wait-honesty run left it. The remaining drops are other classes (a scroll-restore that missed 267px, a CSP-picture assertion, 15s waits); they are counted, not fixed, here. Taken on `399cf308`, before `#296` restored overlapping writers onto a shared scratch.

The scroll-restore drop counted there is closed: it was the sixth waiting mistake above, and it is measured under `OLAI_TEST_SLOW=20` rather than by waiting for a loaded box to lose the race again.

## The scripted agents

There are TWO, and that is the point rather than an accident of history: one is
shaped like the Claude Code adapter and one like opencode, and what they share
is the transport (`support/scripted.ts`, `support/ndjson.ts`) and nothing else.
Every frame shape each of them sends — where a tool's name is said, how an MCP
server's tools are spelled, which methods are refused, the order of a
permission's options — is its own file's, so the two are independent witnesses
to the same protocol. A fake whose shape is chosen by a flag is one that can
agree with the client by construction.

### The Claude-shaped one

`agent/fake-acp-agent.ts` is a deterministic ACP agent: line-delimited JSON-RPC on stdio, just enough of the protocol to be indistinguishable from a real one as far as the server's client is concerned. Every server this suite spawns is pointed at it, for the same reason the Chromium flags are not branched on `CI` — a server configured differently for one feature than for another is a class of bug that only reproduces where it is hardest to see.

What makes it worth having is the last thing it does: it calls the **real** internal MCP server, over the real HTTP route, with the token the real `session/new` handed it. So a chat scenario drives the real panel, the real ops layer and the real store — everything except the part that would need a language model, which is the one thing a CI lane cannot afford to be non-deterministic about. Behaviour is keyed on the prompt text (`done <id>`, `add <title>`, `edit [file]`, `hunks [file]`, `servers`, `slow`, `hold`, `model <id>`, `crash`), so a scenario asks for what it needs.

`edit` is the one verb that deliberately does NOT reach the ops layer: it reports a direct file edit the way a real adapter does, as a tool call carrying a `diff` content block, and writes nothing to the disk. What is under test there is the panel's reading of the protocol, and a scripted agent that also wrote the file would be testing the store on the way past. The diff rides the announcement and the completion carries only a status, which is the shape a real one has and the one that catches the merge rule — a row that read a status-only report as "no diffs now" would drop the change at the moment the call finished.

`hunks` is that verb's other shape, and it is the one the panel had never been shown. A real `Edit` is reported twice by two different builders: the announcement is optimistic (one `diff` block, built from the tool's own arguments), and then the adapter's PostToolUse hook walks the patch the tool actually made and sends **one block per hunk, every one of them carrying the same path**. So an edit that landed in three places is three blocks under one name. Its scenario asserts the COUNT and that the page is still standing, because both halves broke: two blocks sharing a name were one of them silently dropped, and three were a `<Key>` handing the framework one element three times, which its list reconciliation does not survive.

One behaviour is keyed on the prompt's SHAPE rather than its first word: a prompt naming an attached FILE opens it and says how many bytes it found. A scripted agent cannot look at a picture or parse a PDF and does not have to — what an e2e can prove is that the bytes the browser pasted are the bytes at the path the agent was handed, and a size read off the disk is the only way to say so. The paste itself is DISPATCHED rather than performed (`chat_steps.ts`): Playwright cannot put an image on the system clipboard portably, so the step builds the `ClipboardEvent` the browser would have built, with a real `File` in a real `DataTransfer`, and everything after that line is the app.

A DROP is dispatched for the same reason — no portable way to make the desktop drag a file into a headless browser — and the events are aimed at the TRANSCRIPT, the part of the panel furthest from the composer: a drop that only worked over the box would pass a test aimed at the box and fail the person aiming at the panel. The `dragenter`/`dragover` pair with no drop after it is what the drop-state affordance is asserted on.

`hold` is the one worth knowing about: it starts a tool call, streams a chunk, and goes on streaming until the scenario touches `.agent-release` in the served directory. A turn that finishes in a millisecond can only be asserted about afterwards, and afterwards is when a panel's own bugs stop being visible — a row rebuilt on every frame looks perfect once the frames stop. Waiting on a file rather than a clock is what makes "mid-turn" a state a scenario ENDS instead of one it races; the file is a dot-file, which the store's walk prunes, so waiting for one is not itself an edit.

It lives in `agent/` rather than `support/` because Cucumber imports everything under `support/` as part of the world, and importing this reads stdin — which, in the runner's own process, ends immediately and takes the run down with it. It imports the other way round freely: `support/ndjson.ts` is a function and nothing else, so there is nothing for Cucumber's import of it to start.

`@no-agent` is the other knob, and it starts the server with `OLAI_ACP_AGENT` set to the EMPTY string — the same way a person turns chat off, rather than through a hole in the harness. It is the one state no documented launch path reaches, so the scenario that covers it is the only place the panel's no-agent message is exercised.

`@agent-stored` is the second knob: with it, the agent answers `session/list` with two stored conversations, so boot loads one and replays it. Without it, nothing is stored and boot opens a fresh session. The two boot paths, chosen by a property of the machine the agent woke up on rather than by anything the client says.

`.agent-says-nothing` is the same idiom over what an agent ADVERTISES: armed, the next handshake carries neither the queue capability nor the steering one, which is the panel's face for an agent it has been told nothing about — no promise that a message sent mid-turn will be got to, and no `interrupt` control to press. It is a dot-file rather than a tag because the handshake happens once, before the client has said anything, so a scenario arms it and restarts. What it must NOT change is the sending: the words still go at once, the row still says it is waiting, and the agent still gets to them.

`refuse busy` is the third leg of that world, and it is a prompt verb rather than a dot-file because it is a property of the turn rather than of the handshake: from then on a `session/prompt` arriving while a turn RUNS is answered with an error, off the read loop, without joining the queue. Both agents olai ships against hold a mid-turn prompt — one advertises the queue, the other was verified — so an agent with no queue at all (an older adapter) was the one shape nothing here could produce, and "a busy send degrades honestly" was a sentence rather than a scenario. It does: the row keeps the words, wears *not sent*, and offers to send them again.

WHICH of the two is loaded is the thing several of those scenarios are about. A first boot has nothing written down, so it takes the most recently updated — the fallback, and once the whole rule. After a conversation has been PICKED, the server remembers it and a restart comes back to that one however much fresher its sibling is (`chat-restore-wrong`), and falls back to the newest again only when the remembered one has gone. A scenario takes one away with `.agent-forgot-<sessionId>`, a dot-file in the served directory like the `hold` release — the store's walk prunes those, so arming one is not an edit.

The real Claude adapter is for driving the panel by hand: `just serve` resolves the pinned one on demand.

### The opencode-shaped one

`agent/opencode/opencode` is an executable named exactly that, and its directory
goes on `OLAI_AGENT_PATH` for a scenario tagged `@opencode` — the variable olai
probes for installed agents. Every OTHER server this suite spawns gets that
variable set to the EMPTY string, which is "look nowhere": which agents a server
finds decides whether its panel ASKS which one a conversation is with, so a
developer with the real opencode installed would otherwise run a different suite
than a CI lane does. The fake `kolu` next door makes the same argument about
PATH.

Its differences from the file above are opencode 1.17.9's own, captured live
(`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/opencode-chat.md`): no `_meta` on any frame, so the tool's
name is the head of the `toolCallId` (`bash:0`) and the `title` moves under a
running call; MCP tools spelled `<server>_<tool>`; permission options that lead
with an ALLOW where the other's lead with the refusal; `session/set_mode` and
`_session/steering` refused; the model in `configOptions` and changes only in
method responses. And it QUEUES: one `session/prompt` at a time, because "sends
wait their turn" is a claim a fake that answered two at once could not witness —
which since `compact-lost-to-steer` is what every send does on every agent, so
the scripted Claude agent next door queues the same way and this is no longer
the leg that behaves differently. Behaviour is keyed on the prompt text
(`done <id>`, `bash`, `permit`, `nameless`, `slow`, `silent`).

`silent` is the auth failure, whole: one zero-token `usage_update` and then a
SUCCESSFUL `end_turn`, with no error anywhere. It is a scripted turn rather than
a unit test because nothing about it is an error — every layer between the wire
and the panel behaves correctly, and the bug was that the panel drew the result
as an ordinary turn. A `.agent-hold-open` dot-file makes the next session open
sit on the wire until `the agent is released`, which is how a scenario reaches
the seconds between picking an agent and having a conversation: on a laptop that
window is too short to aim at, and it is the window a message typed into it used
to be lost in.

## The fake kolu

`agent/kolu/kolu` is an executable named exactly that, and its directory goes FIRST on the PATH of every server this suite spawns. Olai looks for a `kolu` when it opens a conversation and hands the session kolu's terminals if a padi daemon answers it, so without this the suite would ask the laptop it is running on — and a developer working inside a kolu terminal would get a different run than a CI lane does.

It answers the probe two ways, and the DEFAULT is the unhelpful one: it speaks the protocol and reaches no daemon, which is both "no kolu here" and what a wrong build looks like (a padi-spawned terminal prepends its own bundled copy, and one of those was an older build reporting the same version while missing most of the verbs). `@kolu` is the knob that makes a daemon answer. So a scenario that says nothing about kolu is one whose session gets olai's own tool server and nothing else, deterministically.

`@kolu` needs `@scratch:<corpus>`, the same way `@agent-stored` does: what a server finds on PATH is decided when it is started, and a `@corpus:` server is running for every other scenario in the run — not this one's to repoint. The `Before` hook says so by name rather than letting the scenario fail later about a transcript.

Nothing about a terminal is simulated. What a scenario can ask is which MCP servers the SESSION was given, and the scripted agent answers that when asked (`servers`).

## Reading a pipe, once

Three things here speak newline-framed JSON-RPC down or up a pipe — the MCP client, the scripted agent, the fake kolu — and each used to carry its own copy of the same six lines: keep what has not ended in a buffer, cut on newlines, parse each whole line. That is `support/ndjson.ts` now, and the copies were the bug: a chunk boundary is not a message boundary, which is the one thing this is easy to get wrong about, and getting it right in three places means fixing it in three places.

It is framing and nothing more. Who a message is for and what to do about it is each caller's own, which is why it takes a callback and knows no method names. A line that will not parse goes to a caller's handler — and the MCP client passes none on purpose, so a frame that is not one throws rather than being skipped: that client is reading a protocol *we* serve.
