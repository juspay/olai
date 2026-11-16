# olai docs

olai serves a directory of outlines and Markdown files as a web app that you and your coding agents edit together. These pages say how to use it. The pitch is at [olai.page](https://olai.page).

New here? [start.md](start.md) gets you running on your own notes in about five minutes.

## Using olai

| Page | What it covers |
| --- | --- |
| [start.md](start.md) | From nothing to a running olai with a first row in it, and git recording the change. |
| [running.md](running.md) | Serving a directory: `olai web`, its flags, one olai per directory, the health dot and the log. |
| [deploying.md](deploying.md) | Keeping it running: the home-manager module, the same launch without it, a reverse proxy and who is looking. |
| [settings.md](settings.md) | Choosing what runs: `_olai/Settings.olai`, the Plugins panel, environment variables, and what being off means. |
| [connecting-agents.md](connecting-agents.md) | Pointing an agent outside olai at a running one: `/mcp`, `olai surface`, and capture from a terminal. |
| [editing.md](editing.md) | Typing an outline: the keys, the marks, splitting and joining rows, notes, and undo. |
| [organising.md](organising.md) | Moving work about: dragging, picking several rows, days, repeating, Trash, and deleting a file. |
| [getting-around.md](getting-around.md) | Finding your way: the sidebar, pins, tabs, the palette and quick capture. |
| [search.md](search.md) | The query language: every operator, what it matches, and what a result row shows. |
| [filtering.md](filtering.md) | Narrowing the page in front of you, and sending the narrowed page to someone. |
| [git.md](git.md) | Committing and pushing: the Commit readout, the commit panel, the modes, and the audit view. |
| [chat.md](chat.md) | Talking to an agent inside olai: which agent, signing in, the controls and the context. |
| [giving-an-agent-work.md](giving-an-agent-work.md) | Handing it a file, a row or a picture, and reading what it changed. |
| [node-agents.md](node-agents.md) | Binding a conversation to a row, and living with the agent that stands behind it. |
| [attention.md](attention.md) | What olai tells you about: what is waiting on you, and what you have not read. |

## The files underneath

| Page | What it covers |
| --- | --- |
| [format.md](format.md) | The outline format: the two record shapes, their fields, and properties. |
| [properties.md](properties.md) | Typed properties: what a declaration says, and how a value resolves. |
| [dates-and-status.md](dates-and-status.md) | Marks, days and repeating rows. |
| [documents-and-kinds.md](documents-and-kinds.md) | Documents, references, pins, and the file kinds olai only shows. |
| [validation.md](validation.md) | What a write is refused for, and what each error says. |
| [live-properties.md](live-properties.md) | Properties whose value updates on its own, and the two shapes a live face takes. |
| [dynamic-plugins.md](dynamic-plugins.md) | Writing a plugin into the served directory: the shape, the imports allowed, and approval. |
| [dynamic-plugins-examples.md](dynamic-plugins-examples.md) | Two worked examples, start to finish: a morning agenda, and a face. |

## Plugins

olai is a bundle of plugins running on [Cordis](https://github.com/cordiverse/cordis) ([arXiv:2608.25512](https://arxiv.org/abs/2608.25512)). Each plugin documents itself in its own package. The pages below are symlinks onto each plugin's `docs.md`, and `packages/tests/plugin_docs.test.ts` checks that every plugin has a page listed here.

### Agents

The five agents the chat panel can run. What a conversation is, for all of them, is in [chat.md](chat.md).

| Page | What it covers |
| --- | --- |
| [plugins/claude.md](plugins/claude.md) | Claude Code: the pinned adapter, `KOLU_ACP_AGENT`, subagent lanes, tool naming, and the model and server readout. |
| [plugins/codex.md](plugins/codex.md) | Codex: the pinned adapter and CLI, `OLAI_ACP_CODEX`, full-access policy, and visible mode-selection failures. |
| [plugins/opencode.md](plugins/opencode.md) | opencode: the `PATH` probe, the Code Mode script every MCP tool arrives inside, child-session lanes, and which versions work. |
| [plugins/pi.md](plugins/pi.md) | pi: `OLAI_ACP_PI`, the queued mid-turn message, and the bridge that gives pi olai's tools. |
| [plugins/omp.md](plugins/omp.md) | Oh My Pi: the `PATH` probe, the approval mode, the call dispatched through omp's own `write`, and the mid-turn send. |

### Server and transport

| Page | What it covers |
| --- | --- |
| [plugins/ws.md](plugins/ws.md) | The websocket the browser talks to the server over, registered on the shared listener. |
| [plugins/mcp.md](plugins/mcp.md) | The MCP server, its activation lifetime, and session tickets. |
| [plugins/web-app.md](plugins/web-app.md) | Serving the compiled browser app, independently of the websocket and MCP plugins. |
| [plugins/vault.md](plugins/vault.md) | The directory, the write gate, the lock, and the format config. |
| [plugins/settings.md](plugins/settings.md) | Policy for the whole directory, from one `Settings.olai` file. |
| [plugins/identity.md](plugins/identity.md) | Who is looking: trusted header names and the `captured-by` chip. |
| [plugins/git.md](plugins/git.md) | The commit ledger and its `commit` / `push` policy. |
| [plugins/search.md](plugins/search.md) | The query matcher, and what still works when it is switched off. |
| [plugins/vault-plugins.md](plugins/vault-plugins.md) | Discovery, approval, and activation of plugins defined in the served directory. |

### Integrations

| Page | What it covers |
| --- | --- |
| [plugins/chat.md](plugins/chat.md) | The conversation as a row, the `chat-agent-session` kind, and the seats it reserves. |
| [plugins/kolu.md](plugins/kolu.md) | Terminals from kolu: the Dock row, the live pane, the events feed, and the doorbell. |
| [plugins/browsing.md](plugins/browsing.md) | The browser olai runs for your agents: the pane, shared sign-ins, ownership, overrides and safety. |
| [plugins/odu.md](plugins/odu.md) | CI from odu: the run chip, the run matrix, and the doorbell. |
| [plugins/xyne-spaces.md](plugins/xyne-spaces.md) | Mirroring doorbell digests into a Xyne Spaces channel. |
| [plugins/mail.md](plugins/mail.md) | Gmail: connecting an account, reading and filing mail from a conversation, and acting on threads. |
| [plugins/journal.md](plugins/journal.md) | The calendar, the day page, and the agenda of dated rows. |

### Browser UI

| Page | What it covers |
| --- | --- |
| [plugins/ui-renderer.md](plugins/ui-renderer.md) | The Solid renderer and scope-owned extension locations. |
| [plugins/layout.md](plugins/layout.md) | The root page layout: panels, the header and its health dot, banners, and viewer slots. |
| [plugins/navigation.md](plugins/navigation.md) | Addresses, history, pane focus, and the command palette. |
| [plugins/tabs.md](plugins/tabs.md) | Several pages open as tabs above the panes, each with its own Back and Forward. |
| [plugins/sidebar.md](plugins/sidebar.md) | The directory column and the rail beside it, and their extension slots. |
| [plugins/outlines.md](plugins/outlines.md) | Outline pages, editing a row, and the commands on its menu. |
| [plugins/markdown.md](plugins/markdown.md) | Document editing, frontmatter, and headings. |
| [plugins/files.md](plugins/files.md) | Browsing the served directory and creating new files from the UI. |
| [plugins/pins.md](plugins/pins.md) | The pinned shelf in the sidebar: ordering and the pin commands. |
| [plugins/capture.md](plugins/capture.md) | Quick capture into the inbox, and its command palette prefix. |
| [plugins/trash.md](plugins/trash.md) | Browsing trashed rows, restoring them, and emptying Trash. |
| [plugins/alerts.md](plugins/alerts.md) | Notification permission, sound and badges owned by a tab-only channel row. |
| [plugins/preferences.md](plugins/preferences.md) | The preferences panel and the slot other plugins add controls to. |
| [plugins/theme.md](plugins/theme.md) | Palette, typeface and page size, stored per browser and set under Appearance. |
| [plugins/plugin-inspector.md](plugins/plugin-inspector.md) | Plugin switches, activation reports, and retry. |
| [plugins/link-preview.md](plugins/link-preview.md) | Live read-only previews of internal links. |

### File kinds

| Page | What it covers |
| --- | --- |
| [plugins/outline-olai.md](plugins/outline-olai.md) | Outline file claims, parsing, and canonical writing. |
| [plugins/hypertext.md](plugins/hypertext.md) | Saved HTML page claims and sealed previews. |
| [plugins/csv.md](plugins/csv.md) | Table file claims and reading tabular content. |
| [plugins/hledger.md](plugins/hledger.md) | Ledger journal claims and the transaction, balance and source views. |
| [plugins/image.md](plugins/image.md) | Picture file claims and media access. |
| [plugins/pdf.md](plugins/pdf.md) | PDF file claims, browser viewing, and media access. |

### Test fixtures

Off by default. Each one exists to prove something about the host.

| Page | What it covers |
| --- | --- |
| [plugins/test-layout.md](plugins/test-layout.md) | An alternate shell using the public navigation outlet. |
| [plugins/test-counter.md](plugins/test-counter.md) | A minimal plugin proving the host runs with no served directory at all. |
| [plugins/test-palette.md](plugins/test-palette.md) | A fixture contributing palette levels through the public adapter location. |
| [plugins/test-page.md](plugins/test-page.md) | A fixture registering a self-drawn plugin page in the route slot. |

## For people working on olai

| Page | What it covers |
| --- | --- |
| [architecture/overview.md](architecture/overview.md) | How the parts fit together, and how one change travels from a keystroke to disk and back. |
| [architecture/packages.md](architecture/packages.md) | What each package is for, and the stack underneath. |
| [architecture/cordis.md](architecture/cordis.md) | The Cordis rules: declared dependencies, resource ownership, and safe removal. |
| [architecture/plugin-system.md](architecture/plugin-system.md) | What a plugin is, how the runtime mounts one, and what crosses the wire. |
| [architecture/plugin-vocabulary.md](architecture/plugin-vocabulary.md) | Every word a plugin manifest uses, with one entry each. |
| [architecture/adding-a-plugin.md](architecture/adding-a-plugin.md) | The steps and files for adding a plugin to the bundle. |
| [architecture/slot-ownership.md](architecture/slot-ownership.md) | Which capability owns each extension location, and the registration lifecycle. |
| [architecture/browser-tests.md](architecture/browser-tests.md) | What the browser suite covers, how to run it, and the gaps that remain. |

The writing standard these pages are held to is `dev/skills/docs-writing/SKILL.md`, and `packages/tests/docs_lint.test.ts` enforces its shape rules per page.

Roadmap, decisions and root-cause analyses live in the orchestrator's own vault, [juspay/oss.olai](https://github.com/juspay/oss.olai), under [olai/roadmap](https://github.com/juspay/oss.olai/tree/main/projects/olai/roadmap), [olai/brainstorming](https://github.com/juspay/oss.olai/tree/main/projects/olai/brainstorming) and [olai/RCA](https://github.com/juspay/oss.olai/tree/main/projects/olai/RCA).
