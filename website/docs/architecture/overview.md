# Architecture overview

olai serves one directory of files, to a browser and to agents. This page follows one edit from a keystroke to disk and back, naming what owns each step.

## One command, one process

`olai web <dir>` is the only command that opens a directory. It serves the browser over a websocket, on loopback by default, and serves agents over HTTP at `/mcp` on that same port.[^surface] One process writes the files, and one function checks every write before it lands.[^host]

## What happens when you type in a row

```
files on disk ── load + validate ──▶ snapshot ── surface collection ──▶ browser (SolidJS)
      ▲                                                          │           │
      │                                                   conversation    keyboard
   commit(baseRev)                                               │           │
      │                                       ACP session ◀──────┘           │
      │                                            │                         │
      │                                       MCP tools           edit procedures
      │                                            │                         │
      └── ops (create, add, mark, move, trash, untrash, see) ◀───────────┘
                                                 ▲
                                                 └── stdio ── an agent in a terminal
```

1. You press a key in the row editor. The browser sends what you meant, such as splitting a row in two, over one procedure, and works out no placement itself.
2. `@olai/edit-intents` reads the server's own snapshot and turns that message into exactly one request for the ops layer, so a keystroke and an agent's tool call go through the same code.
3. `@olai/ops` works out which files the request changes.
4. The store's write gate checks those changes, renames the new files into place, and publishes a new revision.
5. Each collection of files on the wire sends every subscribed tab only what changed.
6. The pane redraws. The editor follows the row it was editing and asks for the caret back.

An agent calling a tool over `/mcp` enters at step 3 instead.

## Where the rest lives

| Topic | Page |
| --- | --- |
| What each package is for, and the stack | [packages.md](packages.md) |
| Declared dependencies, ownership and cleanup | [cordis.md](cordis.md) |
| Manifests, capabilities and the plugin runtime | [plugin-system.md](plugin-system.md) |
| Which capability owns each extension location | [slot-ownership.md](slot-ownership.md) |
| What the browser suite covers | [browser-tests.md](browser-tests.md) |
| The file format and its rules | [../format.md](../format.md) |
| What a writer is told when a write is refused | [../validation.md](../validation.md) |
| Conversations, agents and what they may touch | [../chat.md](../chat.md) |
| Commits, pushes and the audit trail | [../git.md](../git.md) |

[^surface]: `olai surface <verb>` opens no directory of its own. It connects to a server that is already running, over that same `/mcp` route, which is why one declaration gives a plugin both a terminal command and an MCP tool.

[^host]: olai is a host plus plugins. The host loads the plugin modules, composes what they declare, serves the transports and publishes the management surface. The host itself needs no directory.

    Each capability declares its part of the wire beside the code that provides it, registers it through `Surfaces`, and the browser receives it through `Wired` ([plugin-system.md](plugin-system.md)). `TransportSurface.register` takes HTTP route layers and websocket upgrade handlers, each scoped to the plugin that registered it. `packages/server/src/listener.ts` owns the one port and rebuilds the routing table from those registrations, with no branch for a particular transport.

<details>
<summary>Words this page uses</summary>

| Word | Means |
| --- | --- |
| the set | the content files under the served directory, such as outlines and documents |
| a door | a subpath a package exposes for import, such as `olai-plugin-git`'s `./state`, or a named service such as `Search` |
| a face | one kind of caller a surface serves, such as the browser or an MCP client |
| the wire | the websocket protocol between the server and the browser |
| a leaf | a package depending on no other `@olai/*` package |
| a tenant | a plugin holding everything olai knows about one outside system, such as kolu or Gmail. Only its `./appliance` subpath connects to it |

</details>

<details>
<summary>Which plugins run, and what the vault provides</summary>

`--profile` picks which catalogue of plugins a run mounts. It defaults to `web`.

| Profile | What mounts |
| --- | --- |
| `web` | every plugin in `packages/bundle/olai.yml` that is not marked off there |
| `surface` | only the plugins naming it: MCP, the vault, settings, the file kinds and the content plugins. No websocket and no browser app |
| `test-minimal` | only the plugins naming it: the vault, settings, outline files and the test fixtures. No transport at all |

A profile patches that one catalogue rather than adding a second list. The served directory's own settings then patch the result, which is where an operator turns a plugin on or off ([../settings.md](../settings.md)).

- The `vault` plugin owns the store and provides the `Vault`, `Directory` and `Ops` services. Everything that reads or writes files declares one of them, so a run without the vault leaves those plugins waiting rather than reading an empty directory.
- When the vault stops, it withdraws those services, waits for the plugins that used them to clean up, refuses new calls, waits for writes it already accepted, then releases the store and the lock. If the vault fails, the transports stay up.
- The host needs no directory. The `test-counter` plugin runs on the same host with no `Vault`, `Directory` or `Ops`.

</details>

<details>
<summary>What counts as content</summary>

A plugin claims file suffixes in the vault's `vault.file-kinds` registry, which the vault creates during setup, before the store opens. A file nobody claims, such as a `README` or a source file, is not content.

| Claimed by | Suffixes | How it travels |
| --- | --- | --- |
| outline-olai | `.olai` | parsed records, inside the snapshot |
| markdown | `.md` | text, inside the snapshot |
| csv | `.csv` | path only, body read on demand |
| hledger | `.journal`, `.hledger`, `.ledger` | path only, body read on demand |
| hypertext | `.html` | path only, fetched from `/media/` as a sealed preview |
| image | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico`, `.svg` | path only, fetched from `/media/` |
| pdf | `.pdf` | path only, fetched from `/media/` |

Only `.olai` and `.md` files travel inside the snapshot: the rest are large, and nothing reads their bytes. A viewer puts the file's revision into the `/media/` address it loads, so a restored file reloads under its new revision.

- The registry checks a claim for suffix collisions before publishing it. A refused registration installs nothing, and cleanup removes only the claim of the plugin that left.
- Switching a plugin off takes its files out of the set and out of `/media/`. A snapshot already published keeps the claims it was validated against, so an older snapshot does not change.

</details>

<details>
<summary>The store, the write gate and ops</summary>

`packages/store` turns the files on disk into a snapshot tagged with a revision number. The caller supplies the codec that reads the file format, so the store carries no olai types. Editing a file outside olai, or running `git pull`, updates the open page without a reload.

- Errors travel on a second channel, so one broken file does not blank the screen. A published snapshot names which paths changed, so a consumer publishes per file without comparing two snapshots.
- The store keeps up with the disk by probing: list the tree again, stat every file again, and compare that against a table of each file's modification time and size. A file watcher only triggers a probe, and what it reports is dropped unread. A settle delay turns a `git pull` into one probe, and a probe repeated on a slow timer catches events the watcher lost.
- While walking the tree, the store starts watching every directory created since boot, and skips `node_modules` and directories whose name starts with a dot.
- Every read says how old its answer is and who vouches for it, which `store/src/vintage.ts` calls its vintage. A caller asks for a level of freshness, not a way of getting it: `cheap` returns the answer the store already has, and `verified` walks the tree first. An MCP read carries `vintage` beside `root`.

| Vintage | Means |
| --- | --- |
| confirmed | the store looked at the disk for this answer |
| held | the watching loop's word, with no new look at the disk |
| diverged | the disk disagrees, and the vintage names the files |
| unchecked | nobody could look, and the vintage says why |

> Two olai processes cannot serve one directory. `packages/plugins/vault/src/lock.ts` takes `flock` at `$XDG_RUNTIME_DIR/olai/<digest>.lock`, keyed on the directory's realpath, so a second olai refuses to boot and names the holding process. A share mounted on two hosts is beyond what `flock` can exclude.

### The write gate

The write gate is the one function every edit goes through: `commit({baseRev, changes})` in `store/src/store.ts`. It holds the same permit the probe takes, so a write and a `git pull` never interleave.

1. Probe, then check `baseRev`, the revision the caller based its changes on. If that revision is out of date, the gate returns `StaleWrite{currentRev}` and the caller works its changes out again.
2. Read the files this write changes back through the codec. A write may not produce a file olai cannot read again, so this check runs first, before any bytes are written.
3. Validate the whole set of files the write would produce. If the codec refuses that set, that is the answer: the caller shows the errors instead of retrying.
4. Write each file beside its destination, rename them all into place, probe again, and publish the new revision.

- The gate always re-reads the files a write touches, because a modification time and a length cannot show a write that landed in the same second at the same length. It compares those bytes with what the write promised.
- A rebase can replace a file with one of the same length and restore the old modification time, so the gate compares the write's own paths byte by byte and answers `StaleWrite`. When it refuses on evidence that may have drifted, it walks the tree once to check.
- Validation is incremental. The store hands the codec its last published value and every changed path, and `format/src/patch.ts` swaps the changed entries into the indexes. The codec may decline, which costs a rebuild but never a wrong answer.
- Nothing else is bundled into the gate. Committing to git happens separately, over the whole repository, and the store never learns that git exists.

### Ops, the only writer

`packages/ops` sits between `format` and `store`. It is the only code that writes files, and the only way an agent reads them.

- Every request names a node, a document, or a relative path checked segment by segment. There is no free-form byte range, so retrying against a newer snapshot still lands correctly, and no request can express a malformed file.
- A refusal carries the validator's findings, each pinned to a `file:line`. A write that did land may carry a `nudge`: advice about what to do next, never an explanation of a failure.
- `split` and `merge` are each one request, because each changes an outline in several ways at once and must not half-land. `outlines_update` and `outlines_apply` fold several fields, or an ordered list of verbs, into one published revision.
- Ops owns the codec joining `format` to `store`, and the grammar an agent tool is built in. Each plugin keeps its own verbs in `packages/plugins/<name>/src/tools.ts`, so switching a plugin off withdraws them.
- Documents go through the same gate. A write carries the whole new text, and may carry `was`, the text the caller read before editing. The gate refuses the write if `was` does not match the disk, and the browser keeps the draft.

</details>

<details>
<summary>The wire</summary>

`outlines`, `documents` and `heads` are three collections of kolu's surface framework, each keyed by a path relative to the served directory.

| Collection | What it carries |
| --- | --- |
| `outlines` | batched deltas, one entry per file |
| `documents` | bodies, read by key with `get` only, so they are not in the first paint. The server still validates every document |
| `heads` | every served file with its content left out: its revision, which kind of file it is, and whether it parsed |

- A tab learns the file list and every revision from the `heads` stream alone, and asks for a file's content when it is about to draw it.
- Publishing a revision costs only what changed. Each collection's map is carried over from the previous revision and rebuilt only where that collection gained or lost files.
- The `manifest` cell can hold `null`, which means no directory was ever loaded; an empty collection cannot say that. Errors are a cell of their own, and git state is another.
- Editing is exactly one procedure, taking any of the edit messages. The collections are read-only on the wire, because an edit changes a file, and a changed file reaches every tab the way a `git pull` does.
- Every subscription starts with a full snapshot and continues with deltas, and a reconnect starts again with a full snapshot. There is no resume protocol, and the browser draws nothing before the server answers.
- No code outside the surface API writes wire messages by hand, with five exceptions: everything an MCP client speaks, `/media/*`, `GET /olai/who`, the agent socket, and `POST /olai/resync`, which asks the store to look at the disk.

</details>

<details>
<summary>The browser, and split panes</summary>

`packages/web` boots the tab, builds the browser bundle and holds the shared building blocks. It draws no feature of its own.

```
web/src/client/main.tsx   mounts the app
web/src/client/wire.ts    dials management, fetches each plugin's browser half
web/src/host/             what starting a plugin costs, and what a failed one is owed
web/src/build.ts          assembles the bundle
```

- Every component on screen belongs to a plugin, and no production module in `web` names a plugin.
- A tab subscribes only to what it draws: `heads`, each pane's address, and, when a pane is filtered, the query. It never subscribes to the whole directory.
- The server works out what a page shows, in `@olai/format`'s `page.ts`: `rowsOf`, `zoom`, `datedOn`, `agendaOf` and `referencesOf`.
- The browser reads what it is sent and never writes into it. The only browser-side state during an edit is the draft, sent when the row loses focus, when you press `Enter`, or after a pause. A refused write keeps the draft and shows why under the row.
- Records arriving on the wire are borrowed objects, and Solid's `reconcile` mutates the object it is given, so there is no client store above the framework's. Keeping a row's identity between frames is a question of keys.
- Undo sends the edits that reverse the write through the same procedure, against the current snapshot. The server works out what reverses a write.
- The browser keeps only folds, whether done rows are shown, the calendar month and the pane widths. A setting belonging to the browser rather than one tab is stored with `createPreference`.
- Three things draw above everything else: the palette, the shortcuts sheet and the frozen screen shown while the connection is down. All three are modal dialogs opened through `web/src/client/layer.ts`, so none writes its own stacking order.

### Split panes

A pane is a route: it shows the same page, with the same filter and the same surrounding controls, as a window holding one page.

- The workspace is a tree of panes: either one route, or a split with an axis and children holding fractions of the space, where a fraction of `0` means collapsed.
- That tree is written into the address as `/s/<encoded-route>/…`, with `?w=` for the fractions and `?f=` for the focused pane, so every plain link still works. Reloading restores the layout, Back walks it, and the address shares it.
- Exactly one pane is focused, with a ring around it when two or more are open. Shortcuts, the palette and filter typing act on that pane.

| Click on a link | What it does |
| --- | --- |
| a plain click | navigates the pane the link is in |
| `Alt` + click | opens the target in the pane to the right, reusing one already there |
| `Alt` + `Shift` + click | always opens a new pane |

- Closing the second-to-last pane leaves a single page. A pane narrower than its minimum width collapses to a labelled rail, and collapsing is not closing. On a narrow screen the panes become a tab strip over one column.
- Each pane's title and close control sit above its own scrolling content, so resizing a pane never scrolls the window.

</details>

<details>
<summary>Errors, and what a refusal says</summary>

An error kind is a schema the error travels in: it crosses the wire, decodes as itself, and comes out as an MCP tool error or an HTTP status code. The four kinds are `usage`, `validation`, `not-found` and `busy`.

- Every validation error names a `file:line`. A refused write carries the verdict as structured data, and its rows explain the broken file.
- Validation runs in two stages, and the stage is part of the error. A file either decodes whole or not at all, and then the rules spanning the whole set run over the outlines that did parse.
- An error belongs to one file, at boot and while running alike. That file keeps its place in the sidebar, shows its errors where its outline would be, and refuses writes, while every other outline stays readable and writable.
- A finding naming two files belongs to both, because a duplicate id has no single culprit. When the directory cannot be read at all, that failure belongs to no file, and the codec turns it into a banner over the last tree that loaded.
- olai does not guess. While any outline is unreadable, a `mirror`, `after`, `blocks` or `see` target that resolves to nothing is not reported, because the line declaring it may be the line that failed to parse.
- Not every failure is one of the four kinds. A git command that refuses is not a validation failure, so it travels as two ordinary values: `why` on the write's reply, and the `git` cell the header draws. Never ignore an error silently.

</details>
