# Packages

Every package in the repository, what it is for, and the tools they are built from. For how the parts fit at runtime, read [overview.md](overview.md); for the rules a change must keep, [cordis.md](cordis.md).

## The workspace

A Bun workspace over two globs, `packages/*` and `packages/plugins/*`, sharing `tsconfig.base.json`. `packages/plugins/` is a container and holds no package of its own.

- The direction is downward. `server` and `web` sit on top. The leaves, which name no `@olai/*` sibling at all, are `format`, `store`, `child`, `log`, `state`, `sigterm`, `fonts`, `ui-primitives`, `plugin-kit` and `effect-cordis`.
- Layering is declared in workspace dependencies and machine-checked by `bun install`. The isolated linker (`bunfig.toml`) gives each member only the siblings its manifest names, so an undeclared one does not resolve.
- A plugin is written against `@olai/plugin-api`. It may reach another plugin only through a door that plugin's manifest declares.
- `@olai/bundle` names every plugin, and is the one package a plugin may not import.
- The `@kolu/*` tier hydrates as raw TypeScript from the Nix store, where `bun install` cannot check it. The import fence does, as a test (`packages/bundle/src/fence.test.ts`), and version agreement with each pin stays in `scripts/check-hydrated-deps.sh`. See [cordis.md](cordis.md) for what the fence claims.

## General packages

| Package | What it is |
| --- | --- |
| `appearance` | Palette, type-size and text-scale tables, the CSS they generate, and contrast arithmetic. Importing it creates no state. |
| `bundle` | The registry: the plugin catalogue, the generated modules, profiles, assets and write policy, plus the import fence. |
| `child` | One owner for a subprocess: spawn, the exec failure that arrives after spawn returns, drained stderr, and a kill with a grace period. |
| `edit-history` | The undo stack as the edits that reverse a write, and the face that says what was taken back. |
| `edit-intents` | What a key or a menu entry meant, as exactly one ops request, worked out over the server's own reading. |
| `effect-cordis` | Cordis in Effect's vocabulary: activation scopes, dispatch gates, teardown order, and the static fence. The only package that names Cordis. |
| `fonts` | The typeface catalogue, in two entry points: the picks a page reads, and the generated sheet and file list a build takes. |
| `format` | The format contracts, the set validator, the refusal vocabulary and the derivations. Depends on nothing, so every layer can read it. |
| `log` | How olai says what it is doing: the two streams, the face each line wears, and the minimum level. No logger of its own. |
| `markdown-ui` | The remark and rehype pipeline, split into its own chunk, and the components that draw a note, a document or a title. |
| `ops` | The only thing that writes, and the only reader an agent gets: the semantic edits, the codec and the grammar a tool is built in. |
| `plugin-api` | What a plugin programs against: generic services, scoped surface registration, owned module loading, and a typed location facade. |
| `plugin-build` | The compiler behind a plugin the served directory defines. Text in, text out, with imports bound to the host's own modules. |
| `plugin-kit` | What a plugin's face in a conversation is made of: the mark, the node reference spelling, and the SVG transform Nix runs. |
| `server` | The binary. Starts the host, composes capability declarations, binds transports, and exposes management. |
| `sigterm` | The Linux `SIGTERM` guard `olai web` boots with: it names the sender and refuses a signal from anybody else. On macOS it does nothing. |
| `state` | Machine-local state, never the served directory: the two per-user homes, one file per directory, guarded reads and atomic writes. |
| `store` | Files as a revision-tagged snapshot, plus the `commit` write gate. Generic over content, so it carries no outline types. |
| `surface` | The shared wire schemas and the process-management spec. Feature declarations live with the plugins that implement them. |
| `tests` | The browser suite harness: the world, the hooks, the scratch corpora, the scripted agents, and the features no single plugin owns. |
| `ui-primitives` | Stateless controls, touch-target rules and the held-service helper. Owns no subscription and no application state. |
| `web` | Mounts the renderer, follows the live plugin roster, builds the browser bundle, and holds the shared client primitives. |

## Plugin packages

Each is a package under `packages/plugins/`, an entry in `packages/bundle/olai.yml`, and a page of its own under `../plugins/`. `mail` and `xyne-spaces` are off until the served directory's settings turn them on, and the four test fixtures are off outside the test profile.

| Plugin | What it is |
| --- | --- |
| `alerts` | Notification permission, sound and the icon badge, owned by a tab-only channel. |
| `browsing` | The browser olai runs for your agents: the pane, shared sign-ins and overrides. |
| `capture` | Quick capture into the inbox, and its palette prefix. |
| `chat` | Conversations over ACP sessions: the panel, the node-agent scheduler, and the seats it reserves. |
| `claude` | The Claude Code engine, with its pinned adapter and patches. |
| `codex` | The Codex engine, with its pinned adapter and CLI. |
| `csv` | Table files: the claim, and the reading of tabular content. |
| `files` | Browsing the served directory, and creating files from the browser. |
| `git` | The commit ledger, the commit and push policy, and the Commit readout. |
| `hledger` | Ledger journals: the claim, and the transaction, balance and source readings. |
| `hypertext` | Saved pages: the claim, and the sealed preview. |
| `identity` | Who is looking: the trusted header family and the picture ladder. |
| `image` | Picture files: the claim, and access through `/media/`. |
| `journal` | The calendar, the day page, the agenda of dated work, and reminders. |
| `kolu` | The kolu tenant: terminals, the live pane, the events feed and the doorbell. |
| `layout` | The frame: panels, the header and its health dot, banners and viewer slots. |
| `link-preview` | A read-only preview of a link that points into the set. |
| `mail` | The Gmail tenant: connecting an account, and reading and filing mail from a conversation. |
| `markdown` | Documents: editing, frontmatter and headings. |
| `mcp` | The `/mcp` route: the protocol server, the tool projection and the session tickets. |
| `navigation` | Addresses, history, pane focus and the palette. |
| `odu` | The odu tenant: the run chip, the run matrix and the doorbell. |
| `omp` | The Oh My Pi engine, found on the agent search path. |
| `opencode` | The opencode engine, found on the agent search path. |
| `outline-olai` | Outline files: the claim, the parser and the canonical writer. |
| `outlines` | Outline pages: rows, the editor, folds, the filter and the row menu. |
| `pdf` | PDF files: the claim, the viewer and access through `/media/`. |
| `pi` | The pi engine, the one that is a pair: an adapter olai pins and an agent the machine supplies. |
| `pins` | The pinned shelf in the sidebar, and the pin commands. |
| `plugin-inspector` | The plugins panel: the switches, the activation reports and retry. |
| `preferences` | The preferences panel, and the section other plugins add their controls to. |
| `search` | The matcher's plumbing: a trigram table in `bun:sqlite`, kept level with the store's revisions. |
| `settings` | Policy for the served directory, read from one `Settings.olai` file. |
| `sidebar` | The directory column, and the rail beside it. |
| `tabs` | Several pages open as tabs above the panes, each with its own Back and Forward. |
| `theme` | Palette, typeface and page size, stored per browser. |
| `trash` | Browsing trashed rows, restoring them, and emptying Trash. |
| `ui-renderer` | The Solid renderer, and the scope-owned extension locations. |
| `vault` | The served directory: the store, the lock, the `Vault`, `Directory` and `Ops` doors, and the file-kind registry. |
| `vault-plugins` | Discovery, approval and activation of plugins the served directory defines. |
| `web-app` | Serving the compiled browser app, independently of the websocket and MCP plugins. |
| `ws` | The websocket the browser talks over, registered on the shared listener. |
| `xyne-spaces` | The Spaces tenant, watch-only: one link cell mirroring doorbell digests into a channel. |
| `test-counter` | A fixture proving the host runs with no served directory at all. |
| `test-layout` | A fixture shell built on the public navigation outlet. |
| `test-page` | A fixture registering a self-drawn page in the route slot. |
| `test-palette` | A fixture contributing palette levels through the public adapter location. |

## The stack

### Runtime

TypeScript on Bun. Bun is the package manager, the test runner and the script runner; types are checked separately with `tsc --noEmit`. TypeScript is `^5.8.0`.

### Effect

The whole stack is Effect 4: Effect Schema at process boundaries, `RpcGroup` on the wire, `HttpRouter` layers for HTTP, and `Schedule` for reconnection.

- `effect`, `@effect/platform-node` and `@effect/platform-browser` are pinned to `4.0.0` in the root manifest's `overrides`, because the version must match the pinned kolu's exactly.
- On Bun it runs as `@effect/platform-node` under Node compatibility.
- `zod` is in the tree and is not olai's. `@agentclientprotocol/sdk` declares it a peer dependency and imports it at runtime, so `packages/plugins/chat` and the root manifest declare it at the same version. No olai module imports it, and the format has exactly one validator, Effect Schema in `format`.

### The browser

SolidJS 1.9 for the renderer, and Tailwind 4 for styling, with utilities inline in components and a CSS entry holding only `@theme` tokens and rules for markup this codebase does not author. There is no `@apply`.

- A palette is eleven tokens, tabled in `appearance/src/palettes.ts`. The build generates one `:root[data-theme="…"]` block per palette, so adding a palette is adding a row to that table.
- A typeface is three tokens, catalogued in `packages/fonts`. The default is Literata for titles and documents, Inter for the interface, and iA Writer Mono for code.
- Markdown is remark plus rehype, rendered at view time through one pipeline for a note, a document, an agent's words and a title. The sanitiser's allowlist is its default plus two named additions in `markdown-ui/src/sanitise.ts`.

### Nix

A flake, npins and a justfile. The pins are `kolu`, `nixpkgs`, `oss-olai`, `cordis`, `odu`, `fenix`, `himalaya`, `pimalaya`, `agent-distro` and `osfacts`; `just update-pins` moves them. The `@kolu/*` packages hydrate as source from the Nix store.

- `oss-olai` is a corpus rather than code: four differential test legs read a real directory at `OSS_OLAI_VAULT`, and throw naming that variable when it is unset.
- The build is two derivations. `olai-deps` is what `bun install` makes, keyed on the manifests and `bun.lock` alone. `olai-base` is the source tree with a `node_modules` of symlinks into it, the plugin hydrate, the generated catalogues and the browser bundle. A commit touching no manifest rebuilds only the second.

### Tests

Unit tests and benchmarks are `bun test`, beside the code they cover. The browser suite is Cucumber and Playwright, and it is not one directory. A plugin keeps the features it promises, and the steps that drive its own surface, under `packages/plugins/<name>/e2e/`, while `packages/tests` keeps the harness and the features no single plugin owns. One profile globs both, so it stays one process. See [browser-tests.md](browser-tests.md).
