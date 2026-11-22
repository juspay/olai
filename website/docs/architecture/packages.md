# Packages

Every package in the repository, what each is for, and the tools they are built from.

The repository is one Bun workspace covering `packages/*` and `packages/plugins/*`, and every package in it shares `tsconfig.base.json`.[^container] A package may depend on packages below it and never on one above it.[^downward] Each package's dependencies are written in its own manifest, and `bun install` checks them.[^linker] The `@kolu/*` packages are checked by a test instead.[^fence] A plugin is written against `@olai/plugin-api`.[^imports]

| Group | What it holds |
| --- | --- |
| General packages | each listed below, with what it is |
| Plugin packages | one package per plugin, each with a row in the plugin registry and a page of its own |
| The stack | TypeScript on Bun, Effect 4, SolidJS and Tailwind, Nix, the tests |

How the parts fit together while olai runs is in [overview.md](overview.md); the rules a change has to keep are in [cordis.md](cordis.md).

[^container]: The two paths: `packages/plugins/` is only a folder holding the plugin packages, and is not a package itself.

[^downward]: What sits where: `server` and `web` sit on top, so nothing depends on them. The packages at the bottom, which name no `@olai/*` sibling at all, are `prose`, `store`, `log`, `state`, `sigterm`, `fonts`, `ui-primitives`, `plugin-kit` and `effect-cordis`. `format` sits one step above them and names `prose` alone. The subprocess socket is kolu's `@kolu/child`, copied in from the kolu pin like every other `@kolu/*` package, so it is not a package here.

[^linker]: How the dependencies are checked: Bun's isolated linker (`bunfig.toml`) gives each package only the siblings its own manifest names, so importing one it did not name fails to resolve.

[^fence]: Checking the `@kolu/*` packages: they are copied in as plain TypeScript from the Nix store, where `bun install` cannot check them. A test does it instead (`packages/bundle/src/fence.test.ts`), and `scripts/check-hydrated-deps.sh` checks that each version matches its pin. See [cordis.md](cordis.md) for what that test guarantees.

[^imports]: What a plugin may import: from another plugin, only the subpaths that plugin's manifest offers. `@olai/bundle` names every plugin, and is the one package a plugin may not import.

<details>
<summary>Every general package, and what it is</summary>

| Package | What it is |
| --- | --- |
| `appearance` | The palette, type-size and text-scale tables, the CSS generated from them, and the contrast arithmetic. Importing it creates no state. |
| `bundle` | The plugin registry: the catalogue of plugins, the modules generated from it, profiles, assets and write policy, plus the test that checks imports. |
| `edit-history` | Undo, kept as the edits that reverse a write, and the component that says what was taken back. |
| `edit-intents` | What a key press or a menu entry meant, turned into exactly one request to `ops`, worked out from the server's own reading of the file. |
| `effect-cordis` | Cordis, the plugin engine, written in Effect's vocabulary: activation scopes, dispatch gates, teardown order, and the import check. The only package that names Cordis. |
| `fonts` | The catalogue of typefaces, in two entry points: the choices a page reads, and the generated stylesheet and file list a build takes. |
| `format` | The file format: its contracts, the validator, the wording it refuses in, and the values derived from a file. Depends on `prose` alone, so every layer can read it. |
| `log` | How olai says what it is doing: the two output streams, how each line is drawn, and the lowest level that is printed. No logger of its own. |
| `markdown-ui` | The remark and rehype pipeline, in a chunk of its own, and the components that draw a note, a document or a title. |
| `ops` | The only code that writes to the served directory, and the only reader an agent gets: the semantic edits, how they are encoded, and the grammar a tool is built in. |
| `plugin-api` | What a plugin is programmed against: the generic services, registering a surface within a scope, loading a plugin's own modules, and a typed wrapper for referring to a slot. |
| `plugin-build` | The compiler behind a plugin the served directory defines. Text in, text out, with imports bound to the host's own modules. |
| `plugin-kit` | What a plugin shows inside a conversation: its logo, how it spells a reference to a row, and the SVG transform Nix runs. |
| `prose` | How a text is read: the one Markdown parser, the tag and wikilink grammar, heading slugs, and the reading of one text every other package asks. Depends on nothing in the workspace. |
| `server` | The `olai` executable. Starts the host, composes what each plugin declares, binds the transports, and exposes management. |
| `sigterm` | The Linux `SIGTERM` guard `olai web` starts with: it names the sender and refuses a signal from anybody else. On macOS it does nothing. |
| `state` | State kept on the machine, never in the served directory: the two per-user state homes, one file per served directory, guarded reads and atomic writes. |
| `store` | Files as a snapshot tagged with a revision, plus the `commit` write gate. Generic over what a file holds, so it carries no outline types. |
| `surface` | The schemas both sides of the connection share, and the spec for managing processes. What each feature declares lives with the plugin that implements it. |
| `tests` | The browser suite's harness: the world, the hooks, the scratch corpora, the scripted agents, and the features no single plugin owns. |
| `ui-primitives` | Controls that hold no state, the touch-target rules, and the helper for reading a service held elsewhere. Owns no subscription and no application state. |
| `web` | Mounts the renderer, follows the live list of running plugins, builds the browser bundle, and holds the client code the plugins share. |

</details>

<details>
<summary>Every plugin package, and what it is</summary>

Each is a package under `packages/plugins/`, a row in `packages/bundle/olai.yml`, and a page of its own under `../plugins/`. `mail` and `xyne-spaces` stay off until the served directory's settings turn them on, and the four test fixtures stay off outside the test profile.

| Plugin | What it is |
| --- | --- |
| `alerts` | Permission to notify you, the sound, and the badge on the icon, owned by a channel that belongs to one browser tab. |
| `browsing` | The web browser olai runs for your agents: the pane it draws, shared sign-ins and per-conversation overrides. |
| `capture` | Capturing a row into the inbox, and the command palette prefix that does it. |
| `chat` | Conversations with coding agents: the chat pages, the scheduler for agents bound to a row, and the slots it reserves. |
| `claude` | Running Claude Code, with the pinned adapter and patches it needs. |
| `codex` | Running Codex, with the pinned adapter and CLI it needs. |
| `csv` | Table files (`.csv`): claiming that file kind, and reading the table out of one. |
| `files` | Browsing the served directory, and creating files from the browser. |
| `git` | The list of files waiting to be committed, the commit and push policy, and the Commit readout in the header. |
| `hledger` | Ledger journals (`.journal`): claiming that file kind, and reading its transactions, balances and source lines. |
| `hypertext` | Saved web pages (`.html`): claiming that file kind, and the preview drawn in a locked-down frame. |
| `identity` | Who is looking: the family of trusted headers, and the order of places a profile picture is looked for. |
| `image` | Picture files: claiming those file kinds, and serving them under `/media/`. |
| `journal` | The calendar, the page for one day, the agenda of dated work, and reminders. |
| `kolu` | Working with kolu: its terminals, the live pane, the feed of events, and sending those events into a conversation. |
| `layout` | The app frame: the sidebar column, the header and its health dot, banners and the places a file viewer draws in. |
| `link-preview` | A read-only preview of a link that points at something in the served directory. |
| `mail` | Working with Gmail: connecting an account, and reading and filing mail from a conversation. |
| `markdown` | Documents: editing them, their frontmatter and their headings. |
| `mcp` | The `/mcp` address: the protocol server, the tools it offers and the tickets a session needs. |
| `navigation` | Addresses, history, which pane has focus, and the command palette. |
| `odu` | Working with odu: the chip for a run, the matrix of runs, and sending run events into a conversation. |
| `omp` | Running Oh My Pi, found on the search path agents are looked for on. |
| `opencode` | Running opencode, found on the same search path. |
| `outline-olai` | Outline files: claiming that file kind, the parser, and the writer that puts a file back in canonical form. |
| `outlines` | Outline pages: the rows, the editor, folds, the filter and the menu on a row. |
| `pdf` | PDF files: claiming that file kind, the viewer, and serving them under `/media/`. |
| `pi` | Running pi, which comes in two parts: an adapter olai pins, and the agent itself, which the machine supplies. |
| `pins` | The shelf of pinned files in the sidebar, and the palette commands that pin and unpin. |
| `plugin-inspector` | The plugins panel: the switches, the reports of what happened at start-up, and retrying a plugin that failed. |
| `preferences` | The preferences panel, and the section other plugins add their own controls to. |
| `search` | What search runs on: a trigram index in `bun:sqlite`, kept level with the store's revisions. |
| `settings` | Policy for the served directory, read from one `Settings.olai` file. |
| `sidebar` | The column of files on the left, and the strip of icons beside it. |
| `tabs` | Several pages open as tabs above the panes, each tab with its own Back and Forward. |
| `theme` | The palette, typeface and page size, stored per browser. |
| `trash` | Browsing trashed rows, restoring them, and emptying Trash. |
| `ui-renderer` | The SolidJS renderer, and the slots whose contents are owned by a scope. |
| `vault` | The served directory: the store, the lock, the `Vault`, `Directory` and `Ops` services, and the register of file kinds. |
| `vault-plugins` | Finding, approving and running the plugins the served directory itself defines. |
| `web-app` | Serving the compiled browser app, whether or not the websocket and MCP plugins are running. |
| `ws` | The websocket the browser talks over, registered on the listener every transport shares. |
| `xyne-spaces` | Working with Xyne Spaces, reading only: one link cell that copies summaries of delivered events into a channel. |
| `test-counter` | A fixture plugin showing that the host runs with no served directory at all. |
| `test-layout` | A fixture plugin that draws a different app frame, taking page content from navigation's public `content` slot. |
| `test-page` | A fixture plugin that registers a page it draws itself, in the `app.route` slot. |
| `test-palette` | A fixture plugin that adds command palette levels through the public palette-adapter slot. |

</details>

<details>
<summary>The stack: Bun, Effect, the browser, Nix and the tests</summary>

### Runtime

TypeScript on Bun. Bun is the package manager, the test runner and the script runner; types are checked separately with `tsc --noEmit`. TypeScript is `^5.8.0`.

### Effect

The whole stack is Effect 4: Effect Schema wherever data enters or leaves the process, `RpcGroup` for the calls between browser and server, `HttpRouter` layers for HTTP, and `Schedule` for reconnecting.

- `effect`, `@effect/platform-node` and `@effect/platform-browser` are pinned to `4.0.0` in the root manifest's `overrides`, because the version must match the pinned kolu's exactly.
- On Bun it runs as `@effect/platform-node` under Node compatibility.
- `zod` is in the tree and is not olai's. `@agentclientprotocol/sdk` declares it a peer dependency and imports it at runtime, so `packages/plugins/chat` and the root manifest declare it at the same version. No olai module imports it, and the format has exactly one validator, Effect Schema in `format`.

### The browser

SolidJS 1.9 draws the pages, and Tailwind 4 styles them, with utility classes written inline in the components and a CSS entry file holding only `@theme` tokens and rules for markup this codebase does not write itself. There is no `@apply`.

- A palette is eleven tokens, tabled in `appearance/src/palettes.ts`. The build generates one `:root[data-theme="…"]` block per palette, so adding a palette is adding a row to that table.
- A typeface is three tokens, catalogued in `packages/fonts`. The default is Literata for titles and documents, Inter for the interface, and iA Writer Mono for code.
- Markdown is remark plus rehype, rendered at view time through one pipeline for a note, a document, an agent's words and a title. The sanitiser's allowlist is its default plus two named additions in `markdown-ui/src/sanitise.ts`.

### Nix

A flake, npins and a justfile. The pinned sources are `kolu`, `nixpkgs`, `oss-olai`, `cordis`, `odu`, `fenix`, `himalaya`, `pimalaya`, `agent-distro` and `osfacts`, and `just update-pins` moves them to newer versions. The `@kolu/*` packages are copied in as source from the Nix store.

- `oss-olai` is a directory of real files rather than code: four test runs read it at the path `OSS_OLAI_VAULT` gives, and throw an error naming that variable when it is unset.
- The build is two derivations. `olai-deps` is what `bun install` makes, and depends on the manifests and `bun.lock` alone. `olai-base` is the source tree with a `node_modules` of symlinks into that, plus the sources copied in from the Nix store, the generated catalogues and the browser bundle. A commit that touches no manifest rebuilds only the second.

### Tests

Unit tests and benchmarks run under `bun test`, in the same folders as the code they cover. The browser suite runs under Cucumber and Playwright, and it is not one directory. Each plugin keeps the features it promises, and the steps that exercise its own calls, under `packages/plugins/<name>/e2e/`, while `packages/tests` keeps the harness and the features no single plugin owns. One profile matches both, so the suite stays one process. See [browser-tests.md](browser-tests.md).

</details>
