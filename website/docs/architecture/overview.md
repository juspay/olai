# Architecture overview

olai serves one directory of files, to a browser and to agents. This page follows a change from a keystroke to disk and back, and names what owns each step.[^pages]

## One process, one entry point

`olai web <dir>` is the only command that opens a directory: it serves the browser over a websocket, on loopback by default, and `/mcp` on that same listener serves agents speaking HTTP.[^surface] One process writes the files, and one function judges every write.[^host]

## How a change travels

```
files on disk ── load + validate ──▶ snapshot ── surface collection ──▶ browser (SolidJS)
      ▲                                                          │           │
      │                                                    chat panel     keyboard
   commit(baseRev)                                               │           │
      │                                       ACP session ◀──────┘           │
      │                                            │                         │
      │                                       MCP tools           edit procedures
      │                                            │                         │
      └── ops (create, add, mark, move, trash, untrash, see) ◀───────────┘
                                                 ▲
                                                 └── stdio ── an agent in a terminal
```

1. A key in the row editor becomes an edit intent, sent over one procedure as a tagged union. The browser computes no placement.
2. `@olai/edit-intents` reads the server's own snapshot and turns the intent into exactly one request for the ops layer, so a keystroke and a tool call cannot disagree.
3. `@olai/ops` plans that request into file changes.
4. The store's write gate validates and renames, then publishes a new revision.
5. Each collection carries what moved to every subscribed tab as a delta.
6. The pane redraws, and the editor follows its node and asks for the caret back.

An agent enters at step 3 instead, over `/mcp`.

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

[^pages]: Two pages sit beside this one: [packages.md](packages.md) says what each package is for, and [cordis.md](cordis.md) holds the rules a change must keep.

[^surface]: `olai surface <verb>` opens nothing: it dials a running server over that route, which is why a terminal verb and an MCP tool fall out of one declaration.

[^host]: olai is a host plus plugins. The host loads modules, composes their declarations, serves transports and publishes management; it needs no directory of its own.

    Each capability declares its wire surface beside its provider, registers through `Surfaces`, and is acquired in the browser through `Wired` ([plugin-system.md](plugin-system.md)). `TransportSurface.register` takes scoped HTTP route layers and upgrade handlers. `packages/server/src/listener.ts` owns the one port and rebuilds dispatch from those registrations, with no transport-specific branch.

<details>
<summary>Words this page uses</summary>

| Word | Means |
| --- | --- |
| the set | the files under the served directory that olai treats as content |
| a door | a named interface a package exposes or calls through, such as `olai-plugin-git`'s `./state` subpath or the `Search` service |
| a face | one presentation of a thing that exists once, such as the browser and MCP over one surface |
| the wire | the websocket protocol between the server and the browser |
| a leaf | a package with no `@olai/*` dependency |
| a tenant | a plugin holding olai's whole judgement about one outside system, whose `./appliance` door is the only part that dials it |

</details>

<details>
<summary>Which plugins run, and what the vault provides</summary>

`--profile` picks the catalogue a serve mounts, and defaults to `web`.

| Profile | What mounts |
| --- | --- |
| `web` | every plugin in `packages/bundle/olai.yml` that is not marked off there |
| `surface` | only the plugins naming it: MCP, the vault, settings, the file kinds and the content plugins. No websocket and no browser app |
| `test-minimal` | only the plugins naming it: the vault, settings, outline files and the test fixtures. No transport at all |

A profile patches that one catalogue and inserts no second list. The served directory's own settings then patch the result, which is where an operator turns a plugin on or off ([../settings.md](../settings.md)).

- The `vault` plugin owns the store and offers `Vault`, `Directory` and `Ops`. Everything that reads or writes files declares one of them, so a serve without the vault leaves those consumers waiting rather than reading nothing.
- Teardown withdraws the offers, drains dependants, closes the gate to new calls, waits for accepted writes, then releases the store and the lock. A failed vault leaves the transports up.
- The host itself needs no directory. `test-counter` runs on the same host with no `Vault`, `Directory` or `Ops` at all.

</details>

<details>
<summary>What counts as content</summary>

A plugin claims suffixes with the vault's `vault.file-kinds` registry, which is minted in vault setup before the store opens. Anything unclaimed, such as a `README` or a source file, is not in the set.

| Claimed by | Suffixes | How it travels |
| --- | --- | --- |
| outline-olai | `.olai` | parsed records, inside the snapshot |
| markdown | `.md` | text, inside the snapshot |
| csv | `.csv` | path only, body read on demand |
| hledger | `.journal`, `.hledger`, `.ledger` | path only, body read on demand |
| hypertext | `.html` | path only, fetched from `/media/` as a sealed preview |
| image | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.ico`, `.svg` | path only, fetched from `/media/` |
| pdf | `.pdf` | path only, fetched from `/media/` |

Only the first two ride the snapshot, because the rest are large and nothing in the set reads their bytes. Viewers key their media address to the file revision, so a restored file gets a new revision and reloads.

- A plugin registers one claim, checked for suffix collisions before it is published: a refused registration installs nothing, and cleanup withdraws only the departing owner's claim.
- Switching a plugin off removes its files from the set and their access through `/media/`. A published reading keeps the claims it was validated against, so an older snapshot does not change under a withdrawal.

</details>

<details>
<summary>The store, the write gate and ops</summary>

`packages/store` turns files into a revision-tagged snapshot. It is generic: the caller supplies the codec, so it carries no olai types. Editing a file outside olai, or running `git pull`, updates the open page without a reload.

- Errors travel on a second channel, so a broken file does not blank the screen. A published snapshot names which paths moved, so consumers publish per file without diffing two snapshots.
- It stays current by probe: re-list the tree, re-stat everything, diff against a table of mtime and size stamps. A watcher only triggers the probe and its payloads are dropped unread. A settle delay turns a `git pull` into one probe, and a slow backstop catches lost events.
- The walk arms a watcher on every directory created after boot, and prunes dot-directories and `node_modules`.
- Every read carries a vintage: how old the answer is, and on whose word (`store/src/vintage.ts`). A caller states a freshness class, never a means. `cheap` returns the standing answer with its earned age; `verified` walks the tree on the asker's own fiber.
- A vintage is confirmed, held on the loop's word, diverged (naming the files the disk disagrees about), or unchecked (with the reason nobody could look). MCP reads carry `vintage` beside `root`.

> Two olai processes cannot serve one directory. `packages/plugins/vault/src/lock.ts` takes `flock` at `$XDG_RUNTIME_DIR/olai/<digest>.lock`, keyed on the directory's realpath, so a second olai refuses to boot and names the holding process. A share mounted on two hosts is beyond what `flock` can exclude.

### The write gate

The write gate is the one function every edit goes through: `commit({baseRev, changes})` in `store/src/store.ts`. It takes the probe's permit, so a write and a `git pull` cannot interleave.

1. Probe, then check `baseRev`. A stale one returns a typed `StaleWrite{currentRev}`, and the caller re-derives.
2. Decode the write's own changed files. A write may not produce a file olai cannot read back, so this runs before anything else and before any bytes move.
3. Validate the whole set the write would produce. A set the codec refuses is an answer: the caller renders the errors rather than retrying.
4. Stage each file beside its destination, rename them all, re-probe, publish.

- Changed files are re-read because the gate says so, not because a stat noticed, since stamps cannot see a write landing in the same second at the same length. Bytes are compared against what the write promised.
- A rebase can replace a file at the same length with the mtime restored, so the gate compares the write's own paths by bytes and answers `StaleWrite`. A refusal reached from drifted evidence opens one verified refresh.
- Validation is incremental. The store hands the codec its last published value and every path that moved, and `format/src/patch.ts` swaps changed entries into the indexes, leaving the rest standing. It may decline, which costs a rebuild and never an answer.
- Nothing rides the gate. Committing to git is a separate quiet window over the whole repository, and the store never learns what git is.

### Ops, the only writer

`packages/ops` sits between `format` and `store`. It is the only thing that writes, and the only reader an agent gets.

- Every request names a node, a document, or a relative path judged segment by segment. There is no free-form byte range, so a retry against a newer snapshot lands cleanly and a malformed file is unrepresentable.
- A refusal carries the validator's rows, each pinned to `file:line`. A write that landed may carry a `nudge`: advice, never a reason nothing happened.
- `split` and `merge` are single requests, because each changes an outline several ways at once and must not half-land. `outlines_update` and `outlines_apply` fold several fields, or an ordered list of verbs, into one plan and one published revision.
- Ops owns the codec joining `format` to `store`, and the grammar a tool is built in. The tool list is not here: each plugin owns its verbs in `packages/plugins/<name>/src/tools.ts`, so a plugin switched off withdraws them.
- Documents go through the same gate and come back through the same snapshot. A write carries the whole new text and may carry `was`, what the caller read, refused on mismatch with the draft kept.

</details>

<details>
<summary>The wire</summary>

Outlines, documents and heads are three collections of kolu's surface framework, keyed by root-relative path.

- `outlines` uses batched deltas, one entry per file. `documents` uses keys and `get` only, so bodies stay off the first paint; the server still validates every document.
- `heads` is every served file with content left off: one revision, one face, one answer to "did it parse". A reader learns the file list and every revision on one stream, and asks for content only when it will draw it.
- A published revision costs what moved. Each collection's map is carried from the previous revision and rebuilt only where that collection's membership moved.
- The `manifest` cell carries no value: it is the `null` that says a directory never loaded, which an empty collection cannot say. Error state is a cell, and git state is another.
- Editing is exactly one procedure over a tagged union of intents. Collections stay read-only on the wire, because an edit changes a file, and a file reaches every tab the way a `git pull` does.
- Every subscription sends a full snapshot then deltas, and a reconnect is a fresh snapshot. There is no resume protocol and no optimistic drawing.
- No raw wire code exists outside the surface API, with five exceptions: everything an MCP client speaks, `/media/*`, `GET /olai/who`, the agent socket, and `POST /olai/resync`, which only asks the store to look at the disk.

</details>

<details>
<summary>The browser, and split panes</summary>

`packages/web` owns the tab's boot, its build and the shared primitives, and draws no feature of its own.

```
web/src/client/main.tsx   mounts the app
web/src/client/wire.ts    dials management, fetches each plugin's browser half
web/src/host/             what an activation costs, what a failed one is owed
web/src/build.ts          assembles the bundle
```

- Every face belongs to a plugin, and no production module in `web` names one.
- A tab holds the page in front of somebody, never the whole directory. It subscribes to `heads`, to each pane's address, and, when a pane is narrowed, to the query.
- Page readings are computed on the server by `@olai/format`'s `page.ts`: `rowsOf`, `zoom`, `datedOn`, `agendaOf` and `referencesOf`.
- The client reads what it is sent and never writes to it. The only client state in an edit is the draft, committed on blur, `Enter` or idle; a refused commit keeps the draft and shows the reason under the row.
- Records on the wire are borrowed objects and Solid's `reconcile` mutates what it is given, so there is no client store above the framework's. Identity across frames is a keying question.
- Undo replays the inverse edits through the same procedure against the current snapshot, and the server derives the inverse.
- Client-local state is folds, done-visibility, the calendar month and layout widths. A preference belongs to the browser rather than the tab, through `createPreference`.
- The three surfaces in the top layer are the palette, the shortcuts sheet and the offline freeze. All three are modal dialogs entered through `web/src/client/layer.ts`, so none of them spells a stacking order.

### Split panes

A pane is a route: the same page, the same filter, the same chrome as a lone page.

- The workspace is a layout tree: a leaf (one route) or a split (an axis and children with fractions, where `0` is collapsed).
- It serializes as the flat `/s/<encoded-route>/…` list, with `?w=` fractions and `?f=` focus, so every plain link stays valid. Reload restores the layout, Back walks it, and sharing the address shares the workspace.
- Exactly one pane is focused, with a visible ring when there are two or more. Shortcuts, the palette and filter typing act on that pane.
- A plain click navigates the pane the link was in. `Alt` + click opens the target in the pane to the right, reusing one already there; `Alt` + `Shift` + click forces a new one.
- Closing the second-to-last pane returns to a plain page. Below a minimum width a pane collapses to a labelled rail, and collapse and close are different verbs. On a narrow screen the list is a tab strip over one column.
- Each column's title and close control stay above its own content scroller, so resizing or reaching a pane's end never scrolls the window.

</details>

<details>
<summary>Errors, and what a refusal says</summary>

Error kinds are tagged error schemas: they travel the wire, decode as themselves, and surface as MCP tool errors and HTTP codes. The four kinds are `usage`, `validation`, `not-found` and `busy`.

- Every validation error names `file:line`. A refused write carries the verdict as structured data, whose rows are the rows a broken file is explained by.
- Validation is staged, and the stage is part of the taxonomy. A file decodes whole or not at all, then the set-wide rules run over the outlines that parsed.
- Error scope is per file, at boot and at runtime alike. An implicated file keeps its place in the sidebar, shows its errors where its tree would be, and refuses writes, while every other outline stays live and writable.
- A finding naming two files takes both, because a duplicate id has no single culprit. One failure cannot be per file: when the directory cannot be read at all, the codec translates it into a banner over the last-good tree.
- A guess is withheld. While any outline is unreadable, an unresolved `mirror`, `after`, `blocks` or `see` target is not reported, because the line declaring the target may be the line that failed to parse.
- Not every failure is one of the four kinds. A git command that refuses is not a validation failure, so it travels as two ordinary values: `why` on the write's reply, and the `git` cell the header draws. Never ignore an error silently.

</details>
