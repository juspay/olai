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
│   ├── mcp.ts               # an MCP client, for the agent olai did not start
│   └── ndjson.ts            # line-delimited JSON off a pipe — one copy, shared
│                           #   by that client and both fakes below
├── agent/                   # the scripted ACP agent the chat scenarios drive,
│                           #   and the fake `kolu` every server finds on PATH
├── bin/broken-git/git       # a `git` that is found and fails, for @git:broken
└── fixtures/                # the served directories (see fixtures/README.md)
```

## Running

```bash
just e2e                      # the whole suite against the nix-built binary
```

That is the leg `just check` runs. It is parallel by default, sized to the
machine — see `CUCUMBER_PARALLEL` below. To iterate faster, run the suite
yourself inside the e2e dev shell (which is the default shell plus Playwright's
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
| `OLAI_BIN` | Path to the `olai` executable. The harness **spawns** one server per corpus as `<bin> web <dir> --port <port> --host 127.0.0.1` and waits for the `url=` field of its `serving` line on stdout, decoded with `@olai/log`'s own `findLogfmt` rather than a regex of ours. This is what `just e2e` sets. |
| `OLAI_URL` | Base URL of a server you are **already running**, reused as it is. No spawning, so no per-corpus servers — see `OLAI_CORPUS`. |
| `OLAI_CORPUS` | Only read with `OLAI_URL`: which fixture corpus that one server is serving (default `good`). A scenario needing a different one fails immediately, with the command to run instead — better than quietly asserting against the wrong outlines. |
| `HEADLESS` | `false` opens a visible browser. Anything else (or unset) is headless. |
| `OLAI_TEST_VERBOSE` | Stream the server child's stdout/stderr into the test output. |
| `CUCUMBER_TAGS` | Replaces the default tag filter (`not @skip`). `CUCUMBER_TAGS='@corpus:tangled'` runs only the tangled-corpus scenarios. |
| `CUCUMBER_PARALLEL` | Worker count. Unset, the suite sizes itself to the machine (`os.availableParallelism() - 1`, floored at 1, capped at 4) so a laptop and a CI box both run parallel by default without a flag. Set it to override, including `=1` for a serial run. |
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

A failing scenario writes `reports/screenshots/<worker>-<scenario-name>.png`
whether or not you were watching. The worker prefix keeps parallel
screenshots from colliding.

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

**`@git`** rides on top of `@scratch:`: the scratch copy is made a git
repository with the fixtures already committed, and its server is started with
`--commit=manual` rather than the harness's usual `--commit=off`. What is
waiting to be committed is DERIVED from git rather than counted, so there is
nothing to test without a repository — and the assertions at the end of those
scenarios are lines out of its log, read through `world.git`. **`@no-git`** is
the other half of the same knob: commits ON, and deliberately no repository,
which is the only way to reach the Commit pill's "no git here" face. Every other
scenario keeps `--commit=off`: committing into whatever repository happens to
contain a temp directory is not this suite's business.

A `@scratch:` scenario may also RESTART its server, which nothing else in the
suite may do — a shared corpus server is running for every other scenario in
the run, and `hooks.ts` refuses rather than trusting the tag. That is what lets
a feature ask the one question no other scenario could: what does an open page
do when the process behind it is replaced? The restart comes back on the SAME
port, because the page is already pointed at it — `startOwnServer` binds the
exact port and fails loudly if the address it got back is a different one, so a
port stolen in between reads as itself instead of as a mysteriously dead page.

## Git, which every other scenario is served without

Every server this harness spawns runs with `--no-commit`: a scratch corpus is a
temp copy, and committing into whatever repository happens to contain the temp
directory is not the suite's business. That is also a STATE — the one the header
calls `commits off` — so it is asserted rather than assumed.

**`@git:<repo|none|broken>`** starts a scenario's server without the opt-out and
says which of the three things git is for its directory: a real repository (the
scratch copy is `git init`ed with a local identity and a first commit), a
directory that is not one, or a git that is FOUND and fails —
`bin/broken-git/git`, put first on that server's PATH, answering every call with
git's own `fatal: detected dubious ownership`. The last one is the case the
indicator exists for: it is not "there is no repository here", and reporting it
as if it were is the bug `features/git_state.feature` holds shut — together with
the newer one it is named for, which is that ONE control in the header answers
for git. That feature counts them.

Like `@kolu` and `@agent-stored`, it needs `@scratch:<corpus>` — what a server
commits to is decided when it is started, and a `@corpus:` server is running for
every other scenario in the run. The `Before` hook says so by name.

One of those scenarios goes the whole way rather than reading chrome: it asks
the agent for a write under a broken git and opens the tool call's detail, which
is the op's own reply as the reader gets it. That is the only assertion in the
suite that follows one field (`Applied.why`) from the ops layer, through the
internal MCP server and the transcript, onto a screen.

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
not the tenth is not in force). That is the one exception to the rule below,
and it is an exception about WHEN rather than about where: a step may measure
when the promise is a property no attribute can carry, and only then. Two
places qualify so far — the finger-sized controls here, and the rendered
markdown a document draws (`document_steps.ts`, `app_steps.ts`), where the
tags are correct however badly they are set and the damage is only in the
layout. An anchor jump (`toc_steps.ts`) is the same exception said about
movement: a fragment that changes the address and scrolls nowhere leaves every
attribute on the page exactly as it was, and only the heading's box says so. In `step_definitions/phone_steps.ts`, a map turns a reader's name for
a control ("collapse toggle") into the `data-testid` it is found by. `features/on_a_phone.feature` ends with a laptop
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

## The claim only the AGENT can make

`features/node_context.feature` is about a row handing the agent a node, and
what has to be proved is not that a chip appeared — it is that the node reached
the AGENT, in a form it can act on. No browser can say that. So the scripted
agent says it: its `context` verb reads the id out of its own prompt, calls the
real `read_node` with it over the real MCP route, and reports the title that
came back. A sentence like *`order` is the node titled order the new cabinets*
cannot be produced by a build where the id never left the browser.

The sentence had to be picked carefully, and a sabotage run is what said so: the
chip on the sent message carries the node's TITLE too, so a step matching the
bare title anywhere in the panel passed with the context stripped out of the
prompt entirely. What it asserts on now is the agent's own phrasing, scoped to
the answer. The same run caught an absence asserted before the thing it was
about had arrived. Both are the ordinary failure of an e2e assertion — passing
for a reason that is not the feature — and both are cheap to find by breaking
the code on purpose and expensive to find any other way.

Two more of that shape were found by review, and both are pinned here now. A
press that should stay on the page asserts the ADDRESS afterwards: "the row lit
up" is also true of a row on the page a navigation just landed on, so the
scenarios that mean *in place* now say which page they are still on — and the
one that means *go there* was already saying it. And a PLACEMENT the agent named
is its own scenario, written with `I rewrite` rather than into the fixture,
because it is that scenario's subject and nobody else's: the mirror id has to
arrive at the node it shows, or the reference names a row that does not exist.
The scripted agent's `name <id>` verb exists for it — an id in prose, no tool
call, because the id a scenario wants named is not always one a tool would
accept.

## Colour, which is the one thing a step may not write down

`features/theming.feature` is about fifteen palettes, and not one of its steps
names a colour. The paper is compared against ITSELF (before a pick, after a
pick), against the browser chrome and against what the manifest says — never
against a hex, which would make the suite the place a design decision has to be
changed. The default theme, the attribute, the storage key and the
custom-property name are IMPORTED from the client that owns them — the same
argument as `TESTID`, one level up: renaming any of them is a type error rather
than a timeout, and markup added so a test can read a constant back is markup
every reader ships. The only strings the feature spells are the two or three
themes a scenario asks for by name, which is the scenario saying what it wants.

Two of its scenarios are about what does NOT happen. One records every request
the page makes (`world.watchRequests`) and asserts a pick made none: "it works"
and "it works without asking anybody" look identical on screen. The other
installs a `MutationObserver` before any page script and reads
`document.readyState` at the moment `data-theme` appears — `loading` is the
parser still going, and it is the only evidence that a stored theme beat the
first paint rather than flashing the default at everybody on every load.

Its last scenario opens a SECOND page in the same context, which is what makes
it a second tab of the same browser rather than a second browser: one origin,
one `localStorage`, and a `storage` event fired in every document of it except
the one that wrote. The second tab is left open on purpose — a preference that
only crossed once the other tab was gone would pass a scenario that closed it.

The chips themselves are a ROW of the preferences panel
(`features/preferences.feature`), so every scenario here opens that panel to
reach one — `showPreferences` in `preferences_steps.ts` is shared for exactly
that. What the retired header pill promised, and what the theming feature still
asserts under a new name, is that something NAMES the theme in force: it is the
Theme row's hint now. Mutation-tested both times — hard-coding the name to
"chalk" passed every theming scenario until a step asked.

`features/preferences.feature` carries the same second-tab scenario for the
OTHER preference, and it is worth its own sentence because a reload cannot ask
the question: deleting `followDoneHidden()` outright passes every other Done
scenario in the file, and fails this one. The reload scenario is the boot
read, not the write: applying the default at module load
(`pref.set(SHOWN, { persist: false })` after the factory) reddens only
`It is remembered`. The write is the stored-key step on the hide scenario,
which master already shipped. It also holds the two ends of the panel's
TAB CYCLE — Shift+Tab out to the trigger, Tab back in to the first control —
which is the promise a portalled panel cannot get from document order.
Both were sabotage-checked against the fix they are the fence for.

## Breaking the client on purpose

`features/the_client_breaks.feature` is the one scenario whose subject is a bug
in olai rather than in an outline, and it is the only place in this suite that
reaches past the app's own surface. Every other error here is DATA — a fixture
that does not validate — while a fault in a render is not data, and the app
deliberately offers no way to ask for one: a fault switch shipped is a fault
switch in production.

So it is injected with `addInitScript`, into `String.prototype.padStart` and
only for the exact call the client's own date arithmetic makes, which every
page runs through before it can draw. Narrow because a builtin broken for
everybody would take out a dependency's module initialisation or the fault card
itself, and the scenario would be proving something else. The coupling is
answered rather than hidden: if that call stops happening the app draws itself
perfectly, and the step fails in a second saying exactly that instead of timing
out with nothing to say.

## The UI contract

Steps address the app through `data-testid` and `data-*` attributes, never a
CSS class — a class is a styling decision a refactor is entitled to change; a
`data-testid` is a promise. Every selector is a named constant at the top of
`support/world.ts`.

The names are not written down twice. `support/world.ts` imports the client's
own `TESTID` record and its `selector()` helper from
`packages/web/src/client/testids.ts` (the first reason `@olai/web` is a
dependency of this package), and builds every constant from it. The same rule
covers the handful of other constants a step would otherwise re-spell — the
day arithmetic in `clock.ts`, the theme table's attribute, storage key and
default — but never behaviour: these tests drive the client through a browser,
not through its modules. A renamed
testid is therefore a type error at `bun run typecheck`, not a thirty-second
timeout in a scenario that no longer says why it failed. `#root` stays spelled
out locally: it is `index.html`'s mount point, which the client does not own.

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
| `[data-testid="node-menu"]` | the `•••` menu trigger left of the triangle — pointer devices only (not laid out on a phone) |
| `[data-testid="node-menu-panel"]` | the open menu panel (`absolute` under the trigger) |
| `[data-testid="node-menu-item"][data-action]` | one verb in that panel: the reads (zoom, expand/collapse, expand/collapse all, copy link), then the writes it applies to (the marks, clear date, remove placement, archive) and `Copy as text`. The two buttons of a confirm are items too (`data-action="cancel"` is the way out) |
| `[data-testid="node-menu-confirm"]` | the question that panel asks before `Archive`, naming the row and how many rows go with it — present only while it is asking |
| `[data-testid="node-menu-said"][data-tone]` | what the last verb said, beside the `•••`: `alarm` for a refusal (the ops layer's own words, or a clipboard the browser refused), `aside` for a nudge from a write that landed |
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
| `[data-testid="commit-pill"][data-state][data-uncommitted][data-repo]` | the Commit pill, ALWAYS drawn, and the header's ONE indicator for git; `data-state` is the face — `off`, `no-repo`, `error`, `never`, `committed`, `waiting`, `blocked`, or `unknown` before the first frame. What git SAID is its `aria-label` and its tip, never a colour; the inert faces carry `aria-disabled` and stay focusable |
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
`add <title>`, `edit [file]`, `servers`, `slow`, `hold`, `model <id>`, `crash`),
so a scenario asks for what it needs.

`edit` is the one verb that deliberately does NOT reach the ops layer: it
reports a direct file edit the way a real adapter does, as a tool call carrying
a `diff` content block, and writes nothing to the disk. What is under test there
is the panel's reading of the protocol, and a scripted agent that also wrote the
file would be testing the store on the way past. The diff rides the
announcement and the completion carries only a status, which is the shape a real
one has and the one that catches the merge rule — a row that read a status-only
report as "no diffs now" would drop the change at the moment the call finished.

One behaviour is keyed on the prompt's SHAPE rather than its first word: a
prompt naming an attached FILE opens it and says how many bytes it
found. A scripted agent cannot look at a picture or parse a PDF and does not
have to — what an
e2e can prove is that the bytes the browser pasted are the bytes at the path the
agent was handed, and a size read off the disk is the only way to say so. The
paste itself is DISPATCHED rather than performed (`chat_steps.ts`): Playwright
cannot put an image on the system clipboard portably, so the step builds the
`ClipboardEvent` the browser would have built, with a real `File` in a real
`DataTransfer`, and everything after that line is the app.

A DROP is dispatched for the same reason — no portable way to make the desktop
drag a file into a headless browser — and the events are aimed at the
TRANSCRIPT, the part of the panel furthest from the composer: a drop that only
worked over the box would pass a test aimed at the box and fail the person
aiming at the panel. The `dragenter`/`dragover` pair with no drop after it is
what the drop-state affordance is asserted on.

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
It imports the other way round freely: `support/ndjson.ts` is a function and
nothing else, so there is nothing for Cucumber's import of it to start.

`@no-agent` is the other knob, and it starts the server with `OLAI_ACP_AGENT`
set to the EMPTY string — the same way a person turns chat off, rather than
through a hole in the harness. It is the one state no documented launch path
reaches, so the scenario that covers it is the only place the panel's no-agent
message is exercised.

`@agent-stored` is the second knob: with it, the agent answers `session/list`
with two stored conversations, so boot loads one and replays it. Without it,
nothing is stored and boot opens a fresh session. The two boot paths, chosen by
a property of the machine the agent woke up on rather than by anything the
client says.

WHICH of the two is loaded is the thing several of those scenarios are about.
A first boot has nothing written down, so it takes the most recently updated —
the fallback, and once the whole rule. After a conversation has been PICKED,
the server remembers it and a restart comes back to that one however much
fresher its sibling is (`chat-restore-wrong`), and falls back to the newest
again only when the remembered one has gone. A scenario takes one away with
`.agent-forgot-<sessionId>`, a dot-file in the served directory like the
`hold` release — the store's walk prunes those, so arming one is not an edit.

The real Claude adapter is for driving the panel by hand: `just serve` resolves
the pinned one on demand.

## The fake kolu

`agent/kolu/kolu` is an executable named exactly that, and its directory goes
FIRST on the PATH of every server this suite spawns. Olai looks for a `kolu`
when it opens a conversation and hands the session kolu's terminals if a padi
daemon answers it, so without this the suite would ask the laptop it is running
on — and a developer working inside a kolu terminal would get a different run
than a CI lane does.

It answers the probe two ways, and the DEFAULT is the unhelpful one: it speaks
the protocol and reaches no daemon, which is both "no kolu here" and what a
wrong build looks like (a padi-spawned terminal prepends its own bundled copy,
and one of those was an older build reporting the same version while missing
most of the verbs). `@kolu` is the knob that makes a daemon answer. So a
scenario that says nothing about kolu is one whose session gets olai's own tool
server and nothing else, deterministically.

`@kolu` needs `@scratch:<corpus>`, the same way `@agent-stored` does: what a
server finds on PATH is decided when it is started, and a `@corpus:` server is
running for every other scenario in the run — not this one's to repoint. The
`Before` hook says so by name rather than letting the scenario fail later about
a transcript.

Nothing about a terminal is simulated. What a scenario can ask is which MCP
servers the SESSION was given, and the scripted agent answers that when asked
(`servers`).

## Reading a pipe, once

Three things here speak newline-framed JSON-RPC down or up a pipe — the MCP
client, the scripted agent, the fake kolu — and each used to carry its own copy
of the same six lines: keep what has not ended in a buffer, cut on newlines,
parse each whole line. That is `support/ndjson.ts` now, and the copies were the
bug: a chunk boundary is not a message boundary, which is the one thing this is
easy to get wrong about, and getting it right in three places means fixing it in
three places.

It is framing and nothing more. Who a message is for and what to do about it is
each caller's own, which is why it takes a callback and knows no method names. A
line that will not parse goes to a caller's handler — and the MCP client passes
none on purpose, so a frame that is not one throws rather than being skipped:
that client is reading a protocol *we* serve.
