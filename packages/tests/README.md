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
│   └── hooks.ts             # browser + a server per corpus (and per scratch copy)
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
