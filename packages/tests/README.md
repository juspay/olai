# @olai/tests — the browser tests

Cucumber features driven through Playwright against a real `olai` server
serving a real directory of fixture outlines. Nothing here is mocked: the
server loads `.jsonl` files off disk, the client renders them over a
WebSocket, and the assertions read the DOM a person would be looking at.

```
packages/tests/
├── cucumber.js              # the `ui` profile, and its env knobs
├── features/                # Gherkin — what the app promises
├── step_definitions/        # one file per feature
├── support/
│   ├── world.ts             # OlaiWorld: page, locators, the UI contract
│   ├── hooks.ts             # browser + a server per corpus (and per scratch copy)
│   └── mcp.ts               # an MCP client, for the agent olai did not start
├── agent/                   # the scripted ACP agent the chat scenarios drive
└── fixtures/                # the served directories (see fixtures/README.md)
```

## Running

```bash
just e2e                      # the whole suite against the nix-built binary
```

That is the leg `just check` runs. To iterate faster, run the suite yourself
inside the e2e dev shell (which is the default shell plus Playwright's
browsers):

```bash
export OLAI_BIN="$(nix build .#olai --no-link --print-out-paths)/bin/olai"
nix develop .#e2e -c bash
cd packages/tests

bun run test                                     # everything
bun run test features/see_the_outline.feature    # one feature
bun run test features/see_the_outline.feature:45 # one scenario
```

While changing the server or the client, point `OLAI_BIN` at a two-line script
that runs the working tree instead of rebuilding with Nix each time:

```bash
printf '#!/usr/bin/env bash\nexec bun %s/packages/server/src/main.ts "$@"\n' "$PWD" > /tmp/olai-dev
chmod +x /tmp/olai-dev && export OLAI_BIN=/tmp/olai-dev
```

It takes the same argv, so the harness cannot tell the difference — but it
serves `packages/web/dist`, so a client change needs a `just build-client`
first. `just e2e` always uses the nix-built binary, which is what a user runs.

Bun hosts the runner. Bun executes `.ts` directly, so there is no tsx, no
ts-node and no build step between a step definition and the browser — which is
also why the dev shell needs no node.

## Environment

Which server the suite drives is two decisions, not one — **who owns the
process** and **where it is** — so it is two variables. Set exactly one of
them; setting both, or neither, fails at `BeforeAll` and says which to pick.

| variable | meaning |
|---|---|
| `OLAI_BIN` | Path to the `olai` executable. The harness **spawns** one server per corpus as `<bin> web <dir> --port <port> --host 127.0.0.1` and waits for its `http://127.0.0.1:<port>` line on stdout. This is what `just e2e` sets. |
| `OLAI_URL` | Base URL of a server you are **already running**, reused as it is. No spawning, so no per-corpus servers — see `OLAI_CORPUS`. |
| `OLAI_CORPUS` | Only read with `OLAI_URL`: which fixture corpus that one server is serving (default `good`). A scenario needing a different one fails immediately, with the command to run instead — better than quietly asserting against the wrong outlines. |
| `HEADLESS` | `false` opens a visible browser. Anything else (or unset) is headless. |
| `OLAI_TEST_VERBOSE` | Stream the server child's stdout/stderr into the test output. |
| `CUCUMBER_TAGS` | Replaces the default tag filter (`not @skip`). `CUCUMBER_TAGS='@corpus:tangled'` runs only the tangled-corpus scenarios. |
| `CUCUMBER_PARALLEL` | Worker count. Default 1. |
| `CUCUMBER_RETRY` | Scenario retry budget. Default 0 — a local run should show a real failure the first time. |

Playwright's browsers come from the Nix store via `PLAYWRIGHT_BROWSERS_PATH`,
which `.#e2e` sets. The npm `playwright` version is pinned to the Nix
`playwright-driver`'s (1.61.1) because the driver refuses a browser build it
was not compiled against; the two move together or not at all.

## Watching it happen

```bash
nix develop .#e2e -c bash
cd packages/tests
HEADLESS=false bun run test features/see_the_outline.feature:45
```

`HEADLESS=false` shows the browser; a `:<line>` suffix on the feature path runs
the one scenario starting at that line, so the window is not a blur of forty
others. For a step-through, add `PWDEBUG=1` — Playwright's inspector pauses
before every action.

A failing scenario writes `reports/screenshots/<scenario-name>.png` whether or
not you were watching.

## Fixture corpora

Scenarios do not build their own outlines: they name a directory. A feature (or
a scenario) carries a `@corpus:<name>` tag naming a directory under
`fixtures/`, and `hooks.ts` starts a server on it the first time some scenario
asks — then keeps it for the rest of the run. Untagged scenarios get
`@corpus:good`.

That is why a server-per-corpus exists rather than a server-per-scenario: a
server that has loaded a broken set cannot also serve a good one, and spawning
one process per scenario would cost more than the assertions do. See
`fixtures/README.md` for what each corpus contains and why.

**`@scratch:<name>`** is the exception, and the live store is what asks for it.
Those scenarios EDIT the served files while the server is watching them, so
they get a private temp copy of the named corpus and a server of their own,
both thrown away with the scenario. A shared corpus could not survive it (the
next scenario would inherit the edit) and neither could the repository (the
fixtures are tracked). `world.writeServed` refuses to write anywhere else, so
"a scenario scribbled on the fixtures" is not a thing that can happen quietly.

A `@scratch:` scenario may also RESTART its server, which nothing else in the
suite may do — a shared corpus server is running for every other scenario in
the run, and `hooks.ts` refuses rather than trusting the tag. That is what lets
a feature ask the one question no other scenario could: what does an open page
do when the process behind it is replaced? The restart comes back on the SAME
port, because the page is already pointed at it — `startOwnServer` binds the
exact port and fails loudly if the address it got back is a different one, so a
port stolen in between reads as itself instead of as a mysteriously dead page.

## A phone, and the two things it changes

**`@phone`** on a scenario gives it a handset context instead of a laptop one:
390×844 CSS pixels, a touch screen, no mouse. It is orthogonal to the corpus
tags — a scenario carries both. `isMobile` is what makes Chromium honour the
shell's `<meta name="viewport">` at all; without it the page is laid out as a
very narrow desktop, which is a different thing that happens to fire the same
media queries. It is not one of Playwright's `devices` presets, because those
also install a Safari user agent on top of Chromium and none of these
scenarios are about what the browser calls itself.

Those scenarios do two things nothing else in the suite does. They **tap**
(`locator.tap()`, a real `touchstart`/`touchend` pair) rather than click, which
is the only way to find out that a control a pointer can reach is reachable
without one. And they **measure**: "big enough for a finger" is a size, and no
attribute can carry it — it is the sum of a font, a padding and a breakpoint —
so `world.box()` / `world.boxes()` read what the browser laid out (the plural
takes every match in one pass, because a rule that held for the first row and
not the tenth is not in force). That is the one exception to
the rule below, and it is confined to `step_definitions/phone_steps.ts`, where
a map turns a reader's name for a control ("collapse toggle") into the
`data-testid` it is found by. `features/on_a_phone.feature` ends with a laptop
scenario on purpose: the finger-sized rule is about the pointer, and a control
that grew everywhere would be a regression in the other direction.

`features/install_it.feature` is the other half — the manifest and the icons —
and it asks the SERVER rather than the page (`world.fetch`), because that is
who an installer asks.

## The one client that is not a browser

`features/an_external_agent.feature` is about the tool surface a coding agent in
a terminal reaches, so its steps are not a browser at all: `support/mcp.ts`
launches `olai mcp <dir>` — the same nix-built binary the servers come from, via
`olaiBin()` — and speaks newline-framed JSON-RPC down its pipes. The client is
hand-rolled and tiny on purpose; an MCP SDK here would be testing that SDK's
framing against ours rather than ours.

The assertions afterward DO go through the browser, and that is the whole point
of putting these scenarios in this suite instead of a unit test: the claim is
not "the write happened" but "the page a person is looking at followed a write
made by a process it has never heard of". They are `@scratch:` for the usual
reason — the agent writes — and the child process is killed in `After` beside
the server, before the directory both were watching is removed.

## The UI contract

Steps address the app through `data-testid` and `data-*` attributes, never a
CSS class — a class is a styling decision a refactor is entitled to change; a
`data-testid` is a promise. Every selector is a named constant at the top of
`support/world.ts`.

The names are not written down twice. `support/world.ts` imports the client's
own `TESTID` record and its `selector()` helper from
`packages/web/src/client/testids.ts` (the only reason `@olai/web` is a
dependency of this package), and builds every constant from it. A renamed
testid is therefore a type error at `bun run typecheck`, not a thirty-second
timeout in a scenario that no longer says why it failed. `#root` stays spelled
out locally: it is `index.html`'s mount point, which the client does not own.

| selector | what it marks |
|---|---|
| `#root` | the mount point |
| `[data-testid="outline-list"]` | the sidebar of found outlines |
| `[data-testid="outline-link"][data-file]` | one sidebar entry per `.jsonl` |
| `[data-testid="outline-tree"]` | the tree pane |
| `[data-testid="node"][data-node-id]` | one node; also `data-status`, `data-collapsed`, `data-mirror` |
| `[data-testid="node-title"]` | the title text |
| `[data-testid="tag"]` | a styled inline `#tag` |
| `[data-testid="date"]` | the date badge |
| `[data-testid="desc"]` | the rendered markdown of `desc` |
| `[data-testid="toggle"]` | the collapse/expand control |
| `[data-testid="document-list"]` | the sidebar's second list, one entry per `.md` |
| `[data-testid="document-link"][data-file]` | one of those entries |
| `[data-testid="document-page"][data-file]` | one document, as a page |
| `[data-testid="document-body"]` | a document's rendered markdown, on its page or inline under a node |
| `[data-testid="doc-ref"][data-doc]` | a node's `doc`, at its RESOLVED path; `data-inline` when the document is drawn whole |
| `[data-testid="doc-link"]` | the link inside that reference |
| `[data-testid="zoom"]` | a row's bullet: the link to that node's own page |
| `[data-testid="zoom-title"][data-node-id]` | the heading of a zoomed page — the CANONICAL node's id |
| `[data-testid="breadcrumbs"]` / `[data-testid="crumb"]` | the ancestry above a zoomed node, and one link in it |
| `[data-testid="done-toggle"][data-hidden]` | the per-view Visible/Hidden switch for done nodes |
| `[data-testid="not-found"][data-reason]` | shown when `/n/<id>` names no node |
| `[data-testid="error-view"]` | shown INSTEAD of sidebar + tree when nothing has ever validated |
| `[data-testid="error-file-group"][data-file]` | one group per file with errors |
| `[data-testid="error"][data-code]` | one error row; its text names `<file>:<line>` |
| `[data-testid="cross-file-errors"]` | errors implicating two files |
| `[data-testid="stale-banner"]` | shown OVER a last-good tree: the files stopped validating |
| `[data-testid="outline-failure"][data-file]` | shown in ONE outline's place: that file will not parse |
| `[data-testid="outline-link"][data-broken]` | the sidebar entry of a file that will not parse |
| `[data-testid="connection"][data-connection]` | the connection dot, in every shape of the app: `connecting`, `live`, `reconnecting`, `retired` |
| `[data-testid="restarted"]` | over everything: the server that served this page has been replaced |
| `[data-testid="reload"]` | the button in that surface — the whole of the recovery |

## Adding a test

1. Write the scenario in a `.feature` file, in the language of the promise
   rather than of the DOM.
2. Run it. Cucumber prints a snippet for every step it does not recognise.
3. Implement the step in the `step_definitions/` file for that feature, as
   `function (this: OlaiWorld)` — never an arrow function, which would not get
   a `this`. Assertions are `node:assert`; there is no `expect`.
4. If it needs an outline no corpus has, add it to `fixtures/good` rather than
   inventing a corpus — the fixtures are documentation too, and three small
   readable directories beat thirty single-purpose ones.
5. If it needs to CHANGE a file, tag it `@scratch:<corpus>` and write through
   `world.writeServed`. The assertions that follow such a write usually need to
   wait for something to change or disappear, which a Playwright selector
   cannot state — `world.waitUntil` is what those steps are built on.
6. If the edit changes WHICH records exist — an insert, a delete, a reorder —
   assert the id multiset (`the outline "x.jsonl" shows exactly the nodes "…"`),
   not that some title eventually reads a certain way. A tree that has lost one
   node and drawn another twice still has all the right titles in it, which is
   how a broken live view stayed green through a whole feature file.

## The scripted agent

`agent/fake-acp-agent.ts` is a deterministic ACP agent: line-delimited JSON-RPC
on stdio, just enough of the protocol to be indistinguishable from a real one
as far as the server's client is concerned. Every server this suite spawns is
pointed at it, for the same reason the Chromium flags are not branched on `CI`
— a server configured differently for one feature than for another is a class
of bug that only reproduces where it is hardest to see.

What makes it worth having is the last thing it does: it calls the **real**
internal MCP server, over the real HTTP route, with the token the real
`session/new` handed it. So a chat scenario drives the real panel, the real ops
layer and the real store — everything except the part that would need a
language model, which is the one thing a CI lane cannot afford to be
non-deterministic about. Behaviour is keyed on the prompt text (`done <id>`,
`add <title>`, `slow`, `hold`, `model <id>`, `crash`), so a scenario asks for
what it needs.

`hold` is the one worth knowing about: it starts a tool call, streams a chunk,
and goes on streaming until the scenario touches `.agent-release` in the served
directory. A turn that finishes in a millisecond can only be asserted about
afterwards, and afterwards is when a panel's own bugs stop being visible — a row
rebuilt on every frame looks perfect once the frames stop. Waiting on a file
rather than a clock is what makes "mid-turn" a state a scenario ENDS instead of
one it races; the file is a dot-file, which the store's walk prunes, so waiting
for one is not itself an edit.

It lives in `agent/` rather than `support/` because Cucumber imports everything
under `support/` as part of the world, and importing this reads stdin — which,
in the runner's own process, ends immediately and takes the run down with it.

`@no-agent` is the other knob, and it starts the server with `OLAI_ACP_AGENT`
set to the EMPTY string — the same way a person turns chat off, rather than
through a hole in the harness. It is the one state no documented launch path
reaches, so the scenario that covers it is the only place the panel's no-agent
message is exercised.

`@agent-stored` is the second knob: with it, the agent answers `session/list`
with two stored conversations, so the server's boot ADOPTS the most recent one
and replays it. Without it, nothing is stored and boot opens a fresh session.
The two boot paths, chosen by a property of the machine the agent woke up on
rather than by anything the client says.

The real Claude adapter is for driving the panel by hand: `just serve` resolves
the pinned one on demand.
