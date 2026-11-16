# The browser tests

olai's browser suite drives a real server and a real Chromium through Cucumber features, covering 2,379 entries in 302 feature files.

## Run the suite

```bash
just e2e                # every feature, against the nix-built binary
just e2e-fast-remote    # the same leaf on the remote Linux fleet
```

`just e2e` builds `.#olai` and runs the features against that binary, which is what a user runs.[^e2e] `just e2e-fast-remote` selects the `e2e` leaf through this tree's pinned Odu on `x86_64-linux`.[^remote] To drive one feature or one scenario yourself:[^vars]

```bash
export OLAI_BIN="$(nix build .#olai --no-link --print-out-paths)/bin/olai"
nix develop .#e2e -c bash
cd packages/tests

bun run test                                     # everything
bun run test ../plugins/outlines/e2e/features/see_the_outline.feature     # one feature
bun run test ../plugins/outlines/e2e/features/see_the_outline.feature:45  # one scenario
```

## What a failure leaves behind

A failed scenario keeps a note, the server's log and a full-page screenshot in one directory per attempt.[^evidence] The note carries the scenario, the step that failed, the address the page was on, and every error the page's console recorded.[^note]

## The fixtures

A scenario is served one of the corpora under `packages/tests/fixtures/`, picked by a `@corpus:<name>` tag.[^corpora] Those directories are read-only, and a scenario that writes asks for `@scratch:<name>` instead.[^scratch] No scenario talks to a real agent: each engine ships a scripted substitute.[^fakes]

## What the suite covers

Cucumber runs the 2,379 entries as about 2,533 cases.[^count] What each workflow proves, the overlaps with the unit suites, what a run costs and the gaps that stand are in the closed blocks at the foot of this page.

[^e2e]: `just e2e` is the leg `just check` runs. The suite sizes itself to the machine: cores minus one, capped at four, and from twenty cores up one worker per four cores, at most eight.

[^remote]: On the remote fleet, Odu borrows up to nine free execution slots and tells Cucumber how many it got, and Cucumber's own sharder splits the scenario list into that many slices. The watch stops after ten minutes, which stops watching rather than the remote work. `nix run .#odu -- ci cancel --run <id>` stops the run.

[^vars]: The variables a run reads are in the closed block at the foot of this page: `OLAI_BIN`, `OLAI_URL`, `HEADLESS`, `CUCUMBER_PARALLEL`, `CUCUMBER_TAGS`, `CUCUMBER_RETRY`, `OLAI_TEST_SLOW` and `OLAI_TEST_VERBOSE`.

[^evidence]: Evidence lands in `$XDG_STATE_HOME/olai/e2e-evidence/<attempt>`, which `OLAI_E2E_EVIDENCE` overrides. Each file is named for the worker, a counter, the feature, the scenario and the case, with the suffix `.txt`, `.server.log` or `.png`. The directory sits outside the run's own tree, so a second attempt on one commit keeps the first attempt's evidence.

[^note]: The note's lines also go to the run's output, each prefixed `olai-e2e-evidence:`, and `just e2e` prints the notes and lists the kept files when the run ends.

[^corpora]: The corpora are `good`, `broken`, `tangled`, `empty`, `typed`, `chat`, `journal`, `agenda`, `morning-agenda`, `lanes`, `legacy-pins`, `mail`, `odu-run`, `plugins`, `plugin-services`, `browser-services` and `browser-services-failed`.

[^scratch]: A scenario tagged `@scratch:<name>` is served a temp copy of that corpus, with `@share-scratch` sharing one copy per worker and restoring the fixture between scenarios.

[^fakes]: Each scripted substitute sits under `packages/plugins/<name>/e2e/fake/`, reached through the generated roster, on the engine-agnostic ACP core at `packages/tests/agent/`. The step `the harness keeps distinct sessions on disk` turns on the scripted agent's store, so ids are unique, only sessions that were prompted can be listed, and replay survives a restart. Under `@browsing-live` the row runs the real Playwright Chromium and the real Playwright MCP instead of the scripted one. `bin/broken-git/git` is a `git` that is found and fails.

[^count]: The count is Gherkin entries, where an outline counts once. `tabs/switch_benchmark.feature` carries `@skip` and stays out of the default run.

<details>
<summary>The variables a run reads</summary>

| Variable | What it does |
| --- | --- |
| `OLAI_BIN` | The executable the harness spawns, one server per corpus. Set this or `OLAI_URL`, never both. |
| `OLAI_URL` | A server you are already running, reused as it is, with `OLAI_CORPUS` naming what it serves. |
| `HEADLESS` | `false` opens a visible browser. Add `PWDEBUG=1` to step through. |
| `CUCUMBER_PARALLEL` | Worker count, `1` for a serial run. |
| `CUCUMBER_TAGS` | Replaces the default filter, `not @skip`. |
| `CUCUMBER_RETRY` | Retry budget, 0 by default. |
| `OLAI_TEST_SLOW` | The factor Chromium slows the renderer by, to reproduce a race a loaded machine loses. |
| `OLAI_TEST_VERBOSE` | Streams the server's own output into the test output. |

</details>

<details>
<summary>Each agent's scripted substitute</summary>

| Fake | Stands in for |
| --- | --- |
| `claude` | the Claude Code ACP adapter, with its sign-in and stored sessions |
| `codex` | `codex-acp`, its native activity messages and its steering refusal |
| `opencode` | opencode's version 2 frames, found by a probe on the agent path |
| `omp` | Oh My Pi, found the same probe way |
| `pi` | both halves of pi: the probe that offers the link flow, and `pi-acp` |
| `kolu` | kolu's padi socket, placed on the server's `PATH` |
| `browsing` | the Playwright MCP a conversation's browser attaches to |

</details>

<details>
<summary>What each workflow proves</summary>

One row per group of feature files.

| Workflow | Entries | What it proves |
| --- | --- | --- |
| Serving a directory | 37 | A directory of outlines, one with none, one whose first outline is broken, and a page read over plain HTTP from another machine. |
| Making files, and capture | 57 | New outlines and documents from each entry point, name collisions, deletion, quick capture, and the names olai gives its own files. |
| Typing an outline | 140 | Keys, parked rows, the caret and the selection, fast typing, paste, IME composition, and a save held back mid-edit. |
| Moving rows about | 97 | Split and merge, indent, duplicate, move to another file, multi-selection, and drag between panes. |
| Undo and redo | 32 | Text, structure and notes undone in turn, history across a plugin rebuild, and history cleared on navigation. |
| Marks and the Trash | 34 | Marking work, refusing to complete a parent, trashing and restoring, and a confirmation that arrives late. |
| Properties, references and backlinks | 82 | Adding and correcting properties, typed values, two writers at once, prerequisites, mirrors, and backlinks after a rename. |
| Zoom, breadcrumbs and folds | 50 | Zooming into a node, folds remembered across a visit, and a permalink whose node is deleted or moved. |
| The row menu | 53 | The `•••` groups and submenus by mouse, keyboard and touch, and the order in which overlays dismiss. |
| Search and filtering | 70 | Queries through the real boxes, results that change while the query is open, and narrowing a page in place. |
| The palette | 70 | Levels and crumbs, value levels, validation, a refused second submit, modality, and a write whose answer is late. |
| Tabs | 77 | Opening, closing, reordering, pinning, per-tab history and scroll, phones, and panes retained across a switch. |
| Panes, the sidebar and pins | 81 | A second pane with its own navigation, resizing, pinning a file, and renaming or removing a pinned file. |
| Addresses and links | 57 | What a click, a modifier click and the link menu do with every kind of link, missing targets, and plugin routes in history. |
| Documents | 109 | Editing markdown, headings and fragments, drafts across a plugin rebuild, dead links, and a document that will not read. |
| Saved pages | 50 | A `.html` file sealed in its frame: what it may load, what its own scripts do, how it is sized, and what an unreadable file says. |
| Pictures, PDF, CSV and the kind rows | 23 | Each kind's page, when a picture is fetched, a table wider than its lane, and a kind switched off. |
| Days, the agenda and reminders | 134 | Setting and clearing dates, repeating work, the agenda and its menu, the Today row, daily notes, and a reminder that rings once. |
| The ledger | 38 | A `.journal` page whose arithmetic adds up by hand, odd lines, a broken or empty file, and one rewritten under an open page. |
| Mail | 40 | Connecting a mailbox, listing threads, inbox wakes for a conversation, and the tools an agent calls on it. |
| Git | 40 | The Commit readout, choosing files, auto-commit and pause, push policy, and the provider absent and back. |
| Choosing an agent, and signing in | 142 | Where an agent is offered with none, one or several installed, the sign-in card, each engine's own wire, and a shutdown mid-turn. |
| A conversation | 158 | Sending, streaming, tool rows and diffs, refused writes, the panel beside the page, and a restart with chats still live. |
| Drafts, completions and context | 89 | Completion in the composer, node chips, rows, files and transcript lines dropped in, and context across a remount. |
| Attachments | 18 | The picker and the drop, the 50 MiB cap, two files of one name, and an upload across a dropped connection. |
| Questions and attention | 25 | A question with choices or free text, drafts kept per node, unread conversations, and what rings and what does not. |
| Node agents | 171 | A conversation bound to a node: folds, the node's page, fresh sessions, capacity and sleep, reconnection and filing. |
| Tool servers | 37 | Which servers a conversation names, one that fails to start, and an agent outside olai reaching it over `/mcp`. |
| The agent's browser | 16 | The agent attaching to the Chromium olai launched, the address bar, and what a tool call does to the page. |
| Terminals and CI runs | 34 | A property that opens a live terminal, its target changing, kolu switched off with a screen open, and a lane's run. |
| Plugins, settings and doors | 74 | Rows switched off and on, settings files and their policy, transports, and failures. |
| A plugin the directory defines | 58 | Asking for one and watching it built, its page in every state, turning it on, trust and delete, its knobs, the sidebar section and what rings. |
| Preferences, theme and identity | 68 | The three headings, theme and font, promoted plugin settings, forced colours, and who the proxy says you are. |
| The shell, on desk and phone | 60 | The header, the health dot, the thumb bar, chords, reduced motion, and an entry point that fails to load. |
| Staying live | 23 | Going offline and reconnecting, writes from outside, a half-open socket, and drafts that survive an outage. |
| Link previews | 35 | The hover card for a node, a document and a conversation link, and the kinds that offer none. |

</details>

<details>
<summary>Where the browser repeats a unit test</summary>

A scenario has to earn the browser: grammar, semantics and pure logic belong in the unit suites. These overlaps are kept on purpose, because the browser path is where the behaviour has broken.

| The unit tests pin | The browser adds |
| --- | --- |
| Shared readings and page lease lifetimes | Two tabs and several folds, a plugin rebuild, a server restart, and one reader leaving while another stays. |
| Idle and capacity eviction | The refusal visible in the row menu, the **Needs you** and **Chats** standings, clicking to resume, and prompts after recovery. |
| Session succession and agent boundaries | Real distinct sessions, choosing a fresh, historical or current one, and the identity on the agent line. |
| Attachment chunking and the cumulative cap | The real picker and drop, asynchronous reads, previews and drafts surviving, and the bytes the agent reads back. |
| Unique question ids, and late answers refused | Draft answers staying apart across node selection, a drawer remount and an agent restart. |
| Pending undo entries and failed replay | The real order of blur-save and key events, retained text, and Undo and Redo pressed in the browser. |
| Gap and neighbour arithmetic for pins | Held mouse gestures, `Escape`, the shelf changing under the gesture, and a later reorder with Undo. |
| Title and property preconditions on a write | The browser sending the baseline it read, the refusal staying visible, and the draft staying correctable. |
| Navigation lanes: apply, seek and bounce | An asynchronous `history.go`, a popstate landing on another tab's entry, and Back after a reload. |
| The tab store, its list verbs and persistence | The strip's gestures through a real layout shell, real `localStorage` across a reload, and the address winning over the stored front tab. |
| Deriving the selected files for a commit | The prepared state surviving a plugin rebuild, and the commit holding exactly the reviewed files. |

Similar wording is not a reason to delete a scenario. Removing a drag's source against removing its destination, pin lists of one size against reordered ones, phone against desktop entry points, and a reload against a server restart each drive different data, handlers or lifetimes.

</details>

<details>
<summary>What a run costs</summary>

Timings come from reports of past runs, so they bound the cost loosely rather than benchmarking it.

- A remote run's logical duration is the slowest slice's, and each slice dispatches its own `install` prerequisite in parallel, reported as a node such as `e2e[2-of-3]::install`.
- The attachment workflow that uploads and hashes 50 MiB takes 4.11 seconds.
- Navigating nine nodes with every scope taken takes 16.71 seconds.
- The three idle-timer cases take 9.20 to 10.01 seconds each.
- A reconnect scenario spends about ten seconds waiting for the production connection state to read `reconnecting`, which is a wait doing real work.

</details>

<details>
<summary>What no scenario drives</summary>

A passing suite is necessary, and it does not show that an untested workflow works. These are the gaps that stand.

- A second browser window: live sync between two of them, and an unread conversation acknowledged in one.
- `Shift` with the secondary button on a tab, falling through to the browser's own menu.
- `ArrowLeft` and `ArrowRight` inside a focused tab strip.
- A stored tab set naming a route whose plugin has left.
- The drop bar drawn while a tab is dragged.
- A question another plugin raises while a palette level is open.
- The **Page not found** view of a departed self-drawn route, and a self-drawn page's own loading state.
- The operating system's own IME candidate picker.
- An unreadable `.html` page becoming readable again.
- `Escape` inside an open submenu of the row menu, and typeahead in it.
- Two machines sharing one directory invalidating each other's session references.
- A conversation whose node agent is evicted between a line being heard and the tab acknowledging it.
- Live model output: every scenario drives a scripted agent.
- A live `claude auth login` or Codex device-code sign-in, and the sign-in card's colours and phone layout.
- A live `omp` process, whose fake is the whole wire.
- The memory-tidying pass against a real engine.
- A host that refuses Chromium's sandbox, and a Chromium that crashes under a running browsing row.
- The browsing row switched off while a conversation's own browser is attached, and composition, drag-and-drop or file upload inside a browsed page.
- macOS beyond the build check: the aarch64-darwin Chromium path runs only there.

</details>
