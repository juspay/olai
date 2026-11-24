# olai docs

olai serves a directory of outlines and Markdown files as a web app that you and your coding agents edit together. These pages say how to use it. The pitch is at [olai.page](https://olai.page).

New here? [Start](start.md) gets you running on your own notes in about five minutes.

## Get started

Install olai, open a folder of your notes in the browser, and keep it running.

| Page | What it covers |
| --- | --- |
| [Set up olai and write your first line](start.md) | From nothing to olai running on your notes, with a first row typed and the change recorded by git. |
| [Serve a directory with olai web](running.md) | The `olai web` command and its flags, why one folder has one olai, the coloured health dot in the header, and the log. |
| [Keep olai running in the background](deploying.md) | Running olai all the time: the home-manager module, the same setup without it, a reverse proxy, and how olai knows who is looking. |
| [Switch olai's plugins on and off](settings.md) | Turning plugins on and off: the `_olai/Settings.olai` file, the Plugins panel, environment variables, and what a switched-off plugin stops doing. |

## Write and organise

Type the rows of an outline, move them, give them dates and to-do marks, and find them again.

| Page | What it covers |
| --- | --- |
| [Typing an outline](editing.md) | The keys for writing an outline: new rows, to-do marks, splitting and joining rows, a note under a row, and undo. |
| [Moving rows about, and the Trash](organising.md) | Dragging rows, picking several at once, dates and repeating tasks, the Trash, and deleting a file. |
| [Marks, days and repeating](dates-and-status.md) | The to-do marks (**To do**, **Doing**, **Done**, **Cancelled**), dates on rows, and tasks that repeat. |
| [The sidebar, tabs and the palette](getting-around.md) | The sidebar of files, pinned pages, panes and tabs, the command palette, and quick capture into the inbox. |
| [Search](search.md) | How to write a search: every operator, what it matches, and what each result shows. |
| [Filtering a page](filtering.md) | Hiding the rows on the current page that don't match, and sending the filtered page to someone as a link. |

## Work with agents

Chat with a coding agent, such as Claude Code, beside your notes, and give it work.

| Page | What it covers |
| --- | --- |
| [Talking to an agent](chat.md) | Picking an agent, signing in, the chat page and its agent line, the controls while it works, and how full its context is. |
| [Giving an agent work](giving-an-agent-work.md) | Handing an agent a file, a row or a picture, and reading what it changed. |
| [Node agents: giving a row or a document its own agent](node-agents.md) | A chat that belongs to one row or one Markdown document: starting it, reading it in a pane, and managing the agent behind it. |
| [When olai interrupts you, and what it marks unread](attention.md) | How olai tells you an agent is waiting on you, and which messages you have not read. |
| [Point an agent at a running olai](connecting-agents.md) | Letting an agent that runs outside olai use a running olai: `/mcp`, `olai surface`, and capture from a terminal. |

### Each agent

The five coding agents olai can run.

| Page | What it covers |
| --- | --- |
| [Claude Code, as a chat agent](plugins/claude.md) | Claude Code in olai: the adapter olai ships, `KOLU_ACP_AGENT`, how the agents it starts are shown, and the model and account it reports. |
| [Codex, as a chat agent](plugins/codex.md) | Codex in olai: the adapter and command-line tool olai ships, `OLAI_ACP_CODEX`, its full-access setting, and the error shown when a mode can't be set. |
| [opencode, as a chat agent](plugins/opencode.md) | opencode in olai: how olai finds it on the `PATH`, how its tool calls are wrapped, how its child sessions are shown, and which versions work. |
| [pi, as a chat agent](plugins/pi.md) | pi in olai: `OLAI_ACP_PI`, what a message sent while it works does, and how pi gets olai's tools. |
| [Oh My Pi, as a chat agent](plugins/omp.md) | Oh My Pi in olai: how olai finds it, its approval mode, how olai's tools reach it, and what a message sent while it works does. |

## Your files and git

What olai keeps on disk, what it refuses to write, and how git records it.

| Page | What it covers |
| --- | --- |
| [The outline file format](format.md) | How an outline is stored on disk: the two kinds of record, their fields, properties, and the keys that tie a chat to a row or a document. |
| [Property types](properties.md) | Giving a property a type, such as a date or a link to a row, and how its value is read. |
| [Documents, references and the kinds olai shows](documents-and-kinds.md) | Markdown documents, links between files, pins, and the kinds of file olai shows but does not edit. |
| [Wikilinks: link to a note by its name](wikilinks.md) | Writing `[[name]]`, how a name finds its file, what an unresolved link does, and pictures embedded by name. |
| [How olai checks your files, and how it writes them](validation.md) | What olai refuses to write, and what each error message says. |
| [Properties that show what is happening now](live-properties.md) | Properties whose value updates by itself, such as a terminal's status, and the two ways olai draws them. |
| [Git: how olai records what it writes](git.md) | Committing and pushing from olai: the Commit readout in the header, the commit panel, manual and automatic commits, and the audit view. |

## Plugins

Ask an agent for a plugin of your own, or look up the plugins olai comes with. olai is made of plugins running on [Cordis](https://github.com/cordiverse/cordis) ([arXiv:2608.25512](https://arxiv.org/abs/2608.25512)), and every plugin has a page here.

| Page | What it covers |
| --- | --- |
| [Ask an agent for a plugin of your own](dynamic-plugins.md) | Asking an agent to write a plugin for you: where its folder goes, turning it on, and writing one yourself. |
| [Where a plugin of your own can draw, and how it writes](dynamic-plugins-faces.md) | Every place a plugin in your directory can draw, and how its page asks its own server code to change your files. |
| [Three example plugins you can copy](dynamic-plugins-examples.md) | Three complete plugins, file by file: one sends the day's agenda to a chat every morning, one shows a colour square beside a row, one turns a French book into a vocabulary. |

### Server and transport

The parts that serve olai to your browser and to agents.

| Page | What it covers |
| --- | --- |
| [ws: the live connection between a browser tab and olai](plugins/ws.md) | The connection your browser tab uses to talk to the olai server. |
| [The MCP endpoint for agents outside olai](plugins/mcp.md) | The MCP server that coding agents connect to for olai's tools, how long it runs, and its session tickets. |
| [web-app: serving the browser app](plugins/web-app.md) | Serves the browser app's files, separately from the browser connection and the MCP server. |
| [vault: opening the directory olai serves](plugins/vault.md) | The directory olai serves: the one path every write goes through, the lock that keeps a second olai out, and the format settings. |
| [settings: reading the settings file](plugins/settings.md) | Settings for the whole directory, read from one `Settings.olai` file. |
| [identity: who is making a request](plugins/identity.md) | Who is looking at the page: which request headers olai trusts, and the `captured-by` chip. |
| [The git plugin: commits, pushes and its two settings](plugins/git.md) | Records commits, and holds the `commit` and `push` settings. |
| [The search plugin: the index and the Search button](plugins/search.md) | Matches search queries, and what still works when search is switched off. |
| [vault-plugins: running the plugins your directory defines](plugins/vault-plugins.md) | The plugins a directory keeps in its own `plugins/` folder: reading them, approving them, and their pages. |

### Integrations

Other tools olai connects to.

| Page | What it covers |
| --- | --- |
| [Talking to an agent from a row](plugins/chat.md) | How a conversation is stored as a row, the `chat-agent-session` property, and chat's settings. |
| [Watching kolu terminals from olai](plugins/kolu.md) | Terminals from kolu: a terminal's row, a live view of it, the feed of terminals waiting on you, and messages to a conversation. |
| [Your browser, shared with your agents](plugins/browsing.md) | A Chromium browser you and your agents share: the page that shows it, shared sign-ins, who owns it, settings and safety. |
| [odu: CI runs shown on your rows](plugins/odu.md) | CI runs from odu: a chip on the row naming the run, a grid of its jobs, and messages to a conversation about runs. |
| [Mirror a conversation into a Xyne Spaces channel](plugins/xyne-spaces.md) | Copies the messages plugins post into a conversation to a Xyne Spaces channel. |
| [Gmail](plugins/mail.md) | Gmail: connecting an account, reading and filing mail from a conversation, and acting on threads. |
| [The journal: a calendar, day pages and an agenda](plugins/journal.md) | The calendar, a page for each day, and the agenda of rows that have a date. |

### Browser UI

The parts of the page you see and use.

| Page | What it covers |
| --- | --- |
| [UI renderer: starting the browser app and its named places](plugins/ui-renderer.md) | Draws the browser app with Solid, and lets plugins add parts to named places on the page. |
| [Layout](plugins/layout.md) | The page's frame: the sidebar column, the header and its health dot, banners, and the places where file viewers sit. |
| [Addresses, panes and the command palette](plugins/navigation.md) | Page addresses, Back and Forward, which pane has focus, and the command palette. |
| [Tabs](plugins/tabs.md) | Several pages open as tabs in the header, each with its own Back and Forward. |
| [Sidebar](plugins/sidebar.md) | The column of files on the left, the narrow rail beside it, and the places plugins can add to them. |
| [Outlines](plugins/outlines.md) | Outline pages: editing a row, and the commands on a row's menu. |
| [Markdown documents: the page and the editor](plugins/markdown.md) | Editing Markdown documents, their front matter, and headings. |
| [The file list in the sidebar](plugins/files.md) | Browsing the files in the directory, and creating new files from the browser. |
| [Pins](plugins/pins.md) | The pinned pages in the sidebar: their order, and the commands to pin and unpin. |
| [Capture](plugins/capture.md) | Quick capture: typing a row straight into the inbox, and the palette's prefix for it. |
| [Trash](plugins/trash.md) | Browsing rows you threw away, restoring them, and emptying the Trash. |
| [Alerts](plugins/alerts.md) | Desktop notifications: asking for permission, the sound, and the mark on the browser tab. |
| [Preferences](plugins/preferences.md) | The Preferences panel: what it holds, and how far each choice reaches. |
| [Theme: colours, typeface and text size](plugins/theme.md) | Colours, typeface and text size, stored per browser and set under **Appearance**. |
| [The Plugins panel](plugins/plugin-inspector.md) | The Plugins panel: switching plugins on and off, why one failed to start, and trying again. |
| [Link previews](plugins/link-preview.md) | Read-only previews, kept up to date, of the pages that links inside olai point to. |

### File kinds

How olai reads and shows each kind of file.

| Page | What it covers |
| --- | --- |
| [Outline files](plugins/outline-olai.md) | Which files are outlines (`.olai`), how they are read, and the one way olai writes them. |
| [HTML files](plugins/hypertext.md) | Showing saved `.html` pages in a locked-down preview. |
| [CSV files](plugins/csv.md) | Showing a `.csv` file as a table, read-only, with its first row as the headings. |
| [Reading hledger journal files](plugins/hledger.md) | Showing hledger accounting journals as transactions, balances and source. |
| [Images](plugins/image.md) | Showing pictures, and serving the image file to the browser. |
| [PDF files](plugins/pdf.md) | Showing a `.pdf` file in your browser's own PDF viewer, read-only. |

### Test fixtures

Plugins used only by olai's own tests, off by default. Each one checks one thing the app must support.

| Page | What it covers |
| --- | --- |
| [Test layout fixture](plugins/test-layout.md) | A replacement page frame built only from the public navigation parts. |
| [Test counter fixture](plugins/test-counter.md) | A tiny plugin showing that olai runs with no directory served at all. |
| [Test palette fixture](plugins/test-palette.md) | Adds entries to the command palette through the public interface. |
| [Test page fixture](plugins/test-page.md) | Adds a page that the plugin draws itself. |

## Build olai

How olai is put together, for people working on it. The writing standard these pages are held to is `dev/skills/docs-writing/SKILL.md`, and `packages/tests/docs_lint.test.ts` enforces its shape rules per page.

| Page | What it covers |
| --- | --- |
| [Architecture overview](architecture/overview.md) | How the parts fit together, and the path one keystroke takes to disk and back to the screen. |
| [Packages](architecture/packages.md) | What each package is for, and the tools underneath. |
| [The Cordis rules: what a plugin needs, what it owns, and how it stops](architecture/cordis.md) | The rules for how a plugin declares what it needs, who owns each resource, and how a plugin is safely removed. |
| [The plugin system](architecture/plugin-system.md) | What a plugin is, how olai starts one, and what passes between the server and the browser. |
| [The words a plugin declares itself with](architecture/plugin-vocabulary.md) | Each word a plugin uses to declare what it does, with one entry per word. |
| [What chat offers other plugins](architecture/chat-services.md) | The seven services other plugins use to start, speak into or mirror a conversation, and what happens while chat is not running. |
| [Adding a plugin](architecture/adding-a-plugin.md) | The steps and files for adding a plugin to olai. |
| [Slots: where a plugin draws, and who owns each one](architecture/slot-ownership.md) | Which part of olai owns each place a plugin can add to the page, and how adding and removing works. |
| [The browser tests](architecture/browser-tests.md) | What the browser tests cover, how to run them, and the gaps that remain. |

This index is also the site's page map: its `##` groups and `###` subgroups are the sidebar, and a page it does not list fails the site build.

Roadmap, decisions and root-cause analyses live in the orchestrator's own vault, [juspay/oss.olai](https://github.com/juspay/oss.olai), under [olai/roadmap](https://github.com/juspay/oss.olai/tree/main/projects/olai/roadmap), [olai/brainstorming](https://github.com/juspay/oss.olai/tree/main/projects/olai/brainstorming) and [olai/RCA](https://github.com/juspay/oss.olai/tree/main/projects/olai/RCA).
