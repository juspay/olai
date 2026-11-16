# olai docs

olai serves a directory of outlines and Markdown files as a web app that you and your coding agents edit together. These pages say how to use it. The pitch is at [olai.page](https://olai.page).

New here? [Start](start.md) gets you running on your own notes in about five minutes.

## Get started

Run olai on a directory of your own, and keep it running.

| Page | What it covers |
| --- | --- |
| [Start](start.md) | From nothing to a running olai with a first row in it, and git recording the change. |
| [Serve a directory](running.md) | Serving a directory: `olai web`, its flags, one olai per directory, the health dot and the log. |
| [Keep olai running](deploying.md) | Keeping it running: the home-manager module, the same launch without it, a reverse proxy and who is looking. |
| [Choose what runs](settings.md) | Choosing what runs: `_olai/Settings.olai`, the Plugins panel, environment variables, and what being off means. |

## Write and organise

Type rows, move them, give them days and marks, and find them again.

| Page | What it covers |
| --- | --- |
| [Typing an outline](editing.md) | Typing an outline: the keys, the marks, splitting and joining rows, notes, and undo. |
| [Moving work about](organising.md) | Moving work about: dragging, picking several rows, days, repeating, Trash, and deleting a file. |
| [Marks, days and repeating](dates-and-status.md) | Marks, days and repeating rows. |
| [Finding your way](getting-around.md) | Finding your way: the sidebar, pins, tabs, the palette and quick capture. |
| [Search](search.md) | The query language: every operator, what it matches, and what a result row shows. |
| [Filtering a page](filtering.md) | Narrowing the page in front of you, and sending the narrowed page to someone. |

## Work with agents

Talk to a coding agent beside your notes, and hand it work.

| Page | What it covers |
| --- | --- |
| [Talking to an agent](chat.md) | Talking to an agent inside olai: which agent, signing in, the controls and the context. |
| [Giving an agent work](giving-an-agent-work.md) | Handing it a file, a row or a picture, and reading what it changed. |
| [Node agents](node-agents.md) | Binding a conversation to a row, and living with the agent that stands behind it. |
| [What olai tells you about](attention.md) | What olai tells you about: what is waiting on you, and what you have not read. |
| [Point an agent at a running olai](connecting-agents.md) | Pointing an agent outside olai at a running one: `/mcp`, `olai surface`, and capture from a terminal. |

### Each agent

The five agents the chat panel can run.

| Page | What it covers |
| --- | --- |
| [Claude Code, as a chat agent](plugins/claude.md) | Claude Code: the pinned adapter, `KOLU_ACP_AGENT`, subagent lanes, tool naming, and the model and server readout. |
| [Codex, as a chat agent](plugins/codex.md) | Codex: the pinned adapter and CLI, `OLAI_ACP_CODEX`, full-access policy, and visible mode-selection failures. |
| [opencode, as a chat agent](plugins/opencode.md) | opencode: the `PATH` probe, the Code Mode script every MCP tool arrives inside, child-session lanes, and which versions work. |
| [pi, as a chat agent](plugins/pi.md) | pi: `OLAI_ACP_PI`, the queued mid-turn message, and the bridge that gives pi olai's tools. |
| [Oh My Pi, as a chat agent](plugins/omp.md) | Oh My Pi: the `PATH` probe, the approval mode, the call dispatched through omp's own `write`, and the mid-turn send. |

## Your files and git

What olai keeps on disk, what it refuses to write, and how git records it.

| Page | What it covers |
| --- | --- |
| [The outline format](format.md) | The outline format: the two record shapes, their fields, and properties. |
| [Typed properties](properties.md) | Typed properties: what a declaration says, and how a value resolves. |
| [Documents, references and the kinds olai shows](documents-and-kinds.md) | Documents, references, pins, and the file kinds olai only shows. |
| [Validation, errors and writing](validation.md) | What a write is refused for, and what each error says. |
| [Live properties](live-properties.md) | Properties whose value updates on its own, and the two shapes a live face takes. |
| [Git](git.md) | Committing and pushing: the Commit readout, the commit panel, the modes, and the audit view. |

## Plugins

Ask for a plugin of your own, and look up the ones olai ships. olai is a bundle of plugins running on [Cordis](https://github.com/cordiverse/cordis) ([arXiv:2608.25512](https://arxiv.org/abs/2608.25512)), and every plugin has a page here.

| Page | What it covers |
| --- | --- |
| [Plugins the directory defines](dynamic-plugins.md) | Asking for a plugin of your own: the folder under `plugins/`, turning it on, and writing one. |
| [Two plugins to write into your directory](dynamic-plugins-examples.md) | Two worked plugins, start to finish: a morning agenda, and a face. |

### Server and transport

| Page | What it covers |
| --- | --- |
| [ws](plugins/ws.md) | The websocket the browser talks to the server over, registered on the shared listener. |
| [mcp](plugins/mcp.md) | The MCP server, its activation lifetime, and session tickets. |
| [web-app](plugins/web-app.md) | Serving the compiled browser app, independently of the websocket and MCP plugins. |
| [vault](plugins/vault.md) | The directory, the write gate, the lock, and the format config. |
| [settings](plugins/settings.md) | Policy for the whole directory, from one `Settings.olai` file. |
| [identity](plugins/identity.md) | Who is looking: trusted header names and the `captured-by` chip. |
| [git](plugins/git.md) | The commit ledger and its `commit` / `push` policy. |
| [search](plugins/search.md) | The query matcher, and what still works when it is switched off. |
| [vault-plugins](plugins/vault-plugins.md) | The plugin folders a directory holds: reading them, approving them, and their pages. |

### Integrations

| Page | What it covers |
| --- | --- |
| [The conversation](plugins/chat.md) | The conversation as a row, the `chat-agent-session` kind, and the seats it reserves. |
| [Kolu integration](plugins/kolu.md) | Terminals from kolu: the Dock row, the live pane, the events feed, and the doorbell. |
| [Your browser, shared with your agents](plugins/browsing.md) | The browser olai runs for your agents: the pane, shared sign-ins, ownership, overrides and safety. |
| [CI on the board](plugins/odu.md) | CI from odu: the run chip, the run matrix, and the doorbell. |
| [Spaces integration](plugins/xyne-spaces.md) | Mirroring doorbell digests into a Xyne Spaces channel. |
| [Gmail](plugins/mail.md) | Gmail: connecting an account, reading and filing mail from a conversation, and acting on threads. |
| [The journal](plugins/journal.md) | The calendar, the day page, and the agenda of dated rows. |

### Browser UI

| Page | What it covers |
| --- | --- |
| [UI renderer](plugins/ui-renderer.md) | The Solid renderer and scope-owned extension locations. |
| [Layout](plugins/layout.md) | The root page layout: panels, the header and its health dot, banners, and viewer slots. |
| [Navigation](plugins/navigation.md) | Addresses, history, pane focus, and the command palette. |
| [Tabs](plugins/tabs.md) | Several pages open as tabs above the panes, each with its own Back and Forward. |
| [Sidebar](plugins/sidebar.md) | The directory column and the rail beside it, and their extension slots. |
| [Outlines](plugins/outlines.md) | Outline pages, editing a row, and the commands on its menu. |
| [Markdown](plugins/markdown.md) | Document editing, frontmatter, and headings. |
| [Files](plugins/files.md) | Browsing the served directory and creating new files from the UI. |
| [Pins](plugins/pins.md) | The pinned shelf in the sidebar: ordering and the pin commands. |
| [Capture](plugins/capture.md) | Quick capture into the inbox, and its command palette prefix. |
| [Trash](plugins/trash.md) | Browsing trashed rows, restoring them, and emptying Trash. |
| [Alerts](plugins/alerts.md) | Asking for notification permission, the sound, and the mark on the tab. |
| [Preferences](plugins/preferences.md) | The preferences panel: what it holds, and how far each choice reaches. |
| [Theme](plugins/theme.md) | Palette, typeface and page size, stored per browser and set under Appearance. |
| [Plugin inspector](plugins/plugin-inspector.md) | Plugin switches, activation reports, and retry. |
| [Link previews](plugins/link-preview.md) | Live read-only previews of internal links. |

### File kinds

| Page | What it covers |
| --- | --- |
| [Outline files](plugins/outline-olai.md) | Outline file claims, parsing, and canonical writing. |
| [HTML files](plugins/hypertext.md) | Saved HTML page claims and sealed previews. |
| [CSV files](plugins/csv.md) | Table file claims and reading tabular content. |
| [hledger journals](plugins/hledger.md) | Ledger journal claims and the transaction, balance and source views. |
| [Images](plugins/image.md) | Picture file claims and media access. |
| [PDF files](plugins/pdf.md) | PDF file claims, browser viewing, and media access. |

### Test fixtures

Off by default. Each one exists to prove something about the host.

| Page | What it covers |
| --- | --- |
| [Test layout fixture](plugins/test-layout.md) | An alternate shell using the public navigation outlet. |
| [Test counter fixture](plugins/test-counter.md) | A minimal plugin proving the host runs with no served directory at all. |
| [Test palette fixture](plugins/test-palette.md) | A fixture contributing palette levels through the public adapter location. |
| [Test page fixture](plugins/test-page.md) | A fixture registering a self-drawn plugin page in the route slot. |

## Build olai

How olai is put together, for people working on it. The writing standard these pages are held to is `dev/skills/docs-writing/SKILL.md`, and `packages/tests/docs_lint.test.ts` enforces its shape rules per page.

| Page | What it covers |
| --- | --- |
| [Architecture overview](architecture/overview.md) | How the parts fit together, and how one change travels from a keystroke to disk and back. |
| [Packages](architecture/packages.md) | What each package is for, and the stack underneath. |
| [Cordis: dependencies, ownership and removal](architecture/cordis.md) | The Cordis rules: declared dependencies, resource ownership, and safe removal. |
| [The plugin system](architecture/plugin-system.md) | What a plugin is, how the runtime mounts one, and what crosses the wire. |
| [The words a plugin manifest uses](architecture/plugin-vocabulary.md) | Every word a plugin manifest uses, with one entry each. |
| [Adding a plugin](architecture/adding-a-plugin.md) | The steps and files for adding a plugin to the bundle. |
| [Who owns each extension location](architecture/slot-ownership.md) | Which capability owns each extension location, and the registration lifecycle. |
| [The browser tests](architecture/browser-tests.md) | What the browser suite covers, how to run it, and the gaps that remain. |

This index is also the site's page map: its `##` groups and `###` subgroups are the sidebar, and a page it does not list fails the site build.

Roadmap, decisions and root-cause analyses live in the orchestrator's own vault, [juspay/oss.olai](https://github.com/juspay/oss.olai), under [olai/roadmap](https://github.com/juspay/oss.olai/tree/main/projects/olai/roadmap), [olai/brainstorming](https://github.com/juspay/oss.olai/tree/main/projects/olai/brainstorming) and [olai/RCA](https://github.com/juspay/oss.olai/tree/main/projects/olai/RCA).
