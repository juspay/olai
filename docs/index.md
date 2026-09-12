# olai docs

olai serves a directory of outlines and Markdown files as a web app that people and coding agents edit together. These pages explain how to use it. The public site, [olai.kolu.dev](https://olai.kolu.dev), is the pitch.

## Using olai

| Page | What it covers |
| --- | --- |
| [running.md](running.md) | Serving a directory: `olai web` and its flags, the home-manager module, vault policy, the MCP endpoint at `/mcp`, quick capture, and identity behind a reverse proxy. |
| [editing.md](editing.md) | Editing an outline by hand: keys, drag and drop, multi-select, drafts, undo, the sidebar, pinning, and writing a document. |
| [search.md](search.md) | The query language and its operators (`is:`, `has:`, `date:`, `created:`, `changed:`, `prop:`, `-`, quoted phrases, `OR`), what a result row shows, and the in-page filter. |
| [git.md](git.md) | The git integration: commit modes, automatic commits, the status pill, and the audit view. |
| [chat.md](chat.md) | The chat agent: which agents olai finds, binding a conversation to a node, ACP adapter overrides, node tools, pictures, and how a conversation wakes. |
| [live-properties.md](live-properties.md) | Properties whose value updates on its own, how a plugin turns one on, and the two shapes a live face takes. |
| [format.md](format.md) | The file format: record shapes, fields, status, references, days, the pinned shelf, which file types are served, and merge safety. |
| [dynamic-plugins.md](dynamic-plugins.md) | Writing a plugin into the served directory itself: the definition shape, allowed imports, approval, and worked examples. |

The [agents in the outline plan](agents-in-the-outline.plan.md) records the design and its implementation checklist.

## Plugins

Olai is a bundle of plugins running on [Cordis](https://github.com/cordiverse/cordis) ([arXiv:2608.25512](https://arxiv.org/abs/2608.25512)). Each plugin documents itself in its own package. The pages below are symlinks onto each plugin's `docs.md`, and `packages/tests/plugin_docs.test.ts` checks that every plugin has a page listed here.

### Engines

The four ACP agents the chat panel can run. What a conversation is, for all of them, is in [chat.md](chat.md).

| Page | What it covers |
| --- | --- |
| [plugins/claude.md](plugins/claude.md) | Claude Code: the pinned adapter, `OLAI_ACP_AGENT`, subagent lanes, tool naming, and the model and server readout. |
| [plugins/codex.md](plugins/codex.md) | Codex: the pinned adapter and CLI, `OLAI_ACP_CODEX`, full-access policy, and visible mode-selection failures. |
| [plugins/opencode.md](plugins/opencode.md) | opencode: the PATH probe, `--cwd`, tool naming, and the three things this wire lacks. |
| [plugins/pi.md](plugins/pi.md) | pi: `OLAI_ACP_PI`, the queued mid-turn message, and the bridge that gives pi olai's tools. |

### Server and transport

| Page | What it covers |
| --- | --- |
| [plugins/ws.md](plugins/ws.md) | The websocket the browser talks to the server over, registered on the shared listener. |
| [plugins/mcp.md](plugins/mcp.md) | The MCP server, its activation lifetime, and session tickets. |
| [plugins/web-app.md](plugins/web-app.md) | Serving the compiled browser app, independently of the websocket and MCP plugins. |
| [plugins/vault.md](plugins/vault.md) | The directory, write gate, lock, and format config. |
| [plugins/settings.md](plugins/settings.md) | Vault policy from one `Settings.olai` file. |
| [plugins/identity.md](plugins/identity.md) | Who is looking: trusted header names and the `captured-by` chip. |
| [plugins/git.md](plugins/git.md) | The commit ledger and its `commit` / `push` policy. |
| [plugins/search.md](plugins/search.md) | The query matcher, and what still works when it is switched off. |
| [plugins/vault-plugins.md](plugins/vault-plugins.md) | Discovery, approval, and activation of plugins defined in the vault. |

### Integrations

| Page | What it covers |
| --- | --- |
| [plugins/chat.md](plugins/chat.md) | The conversation as a row, the `chat-agent-session` kind, and the seats it reserves. |
| [plugins/kolu.md](plugins/kolu.md) | Terminals from kolu: the Dock row, the live pane, the events feed, and the doorbell. |
| [plugins/odu.md](plugins/odu.md) | CI from odu: the worktree chip, the run matrix, and the doorbell. |
| [plugins/xyne-spaces.md](plugins/xyne-spaces.md) | Mirroring doorbell digests into a Xyne Spaces channel. |
| [plugins/journal.md](plugins/journal.md) | The calendar, the day page, and the agenda of dated tasks. |

### Browser UI

| Page | What it covers |
| --- | --- |
| [plugins/ui-renderer.md](plugins/ui-renderer.md) | The Solid renderer and scope-owned extension locations. |
| [plugins/layout.md](plugins/layout.md) | The root page layout: panels, header, banner, and viewer slots. |
| [plugins/navigation.md](plugins/navigation.md) | Addresses, history, pane focus, and the command palette. |
| [plugins/sidebar.md](plugins/sidebar.md) | The directory column and the rail beside it, and their extension slots. |
| [plugins/outlines.md](plugins/outlines.md) | Outline pages, node editing, and contextual commands. |
| [plugins/markdown.md](plugins/markdown.md) | Document editing, frontmatter, and headings. |
| [plugins/files.md](plugins/files.md) | Browsing the served directory and creating new files from the UI. |
| [plugins/pins.md](plugins/pins.md) | The pinned shelf in the sidebar: ordering and the pin commands. |
| [plugins/capture.md](plugins/capture.md) | Quick capture into the inbox, and its command palette prefix. |
| [plugins/trash.md](plugins/trash.md) | Browsing trashed nodes, restoring them, and emptying the trash. |
| [plugins/alerts.md](plugins/alerts.md) | Notification permission, sound and badges owned by a tab-only channel row. |
| [plugins/preferences.md](plugins/preferences.md) | The preferences panel and the slot other plugins add controls to. |
| [plugins/theme.md](plugins/theme.md) | Light and dark appearance, stored per browser and exposed in preferences. |
| [plugins/plugin-inspector.md](plugins/plugin-inspector.md) | Plugin switches, activation reports, and retry. |

### File kinds

| Page | What it covers |
| --- | --- |
| [plugins/outline-olai.md](plugins/outline-olai.md) | Outline file claims, parsing, and canonical writing. |
| [plugins/hypertext.md](plugins/hypertext.md) | Saved HTML page claims and sealed previews. |
| [plugins/csv.md](plugins/csv.md) | Table file claims and reading tabular content. |
| [plugins/image.md](plugins/image.md) | Picture file claims and media access. |
| [plugins/pdf.md](plugins/pdf.md) | PDF file claims, browser viewing, and media access. |

### Test fixtures

| Page | What it covers |
| --- | --- |
| [plugins/test-layout.md](plugins/test-layout.md) | An alternate shell using the public navigation outlet. |
| [plugins/test-counter.md](plugins/test-counter.md) | A minimal plugin proving the host runs with no vault at all. |

## For people working on olai

Everything under `architecture/` is for developers.

| Page | What it covers |
| --- | --- |
| [architecture/overview.md](architecture/overview.md) | How the packages fit together and why they are layered that way. |
| [architecture/cordis.md](architecture/cordis.md) | The Cordis rules: declared dependencies, resource ownership, and safe removal. |
| [architecture/plugin-system.md](architecture/plugin-system.md) | How plugins work: vocabulary, the three import doors, the shared websocket, and how a property gets its face. |
| [architecture/slot-ownership.md](architecture/slot-ownership.md) | Which capability owns each extension location, and the registration lifecycle. |
| [architecture/e2e-coverage.md](architecture/e2e-coverage.md) | Which user workflows the browser suite covers, and the gaps found. |
| [architecture/e2e-economy.md](architecture/e2e-economy.md) | What the e2e suite consolidated, what overlap stayed, and the recorded cost. |

Roadmap, decisions, and root-cause analyses live in the orchestrator's own vault, [juspay/oss.olai](https://github.com/juspay/oss.olai), under [olai/roadmap](https://github.com/juspay/oss.olai/tree/main/projects/olai/roadmap), [olai/brainstorming](https://github.com/juspay/oss.olai/tree/main/projects/olai/brainstorming), and [olai/RCA](https://github.com/juspay/oss.olai/tree/main/projects/olai/RCA).
