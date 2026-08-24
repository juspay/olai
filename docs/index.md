# olai docs

- [running.md](running.md) — how to serve a directory: `olai web` and its flags, one olai per directory, the home-manager module, the git policy an instance can pin for every browser looking at it, the HTTP MCP face at `/mcp` — which is also what `olai surface` speaks, so a terminal is a client of it rather than a door of its own — quick capture, and who is looking behind a reverse proxy.
- [editing.md](editing.md) — changing an outline by hand: the keys, dragging a row, picking several at once, what a draft is, how ⌘Z takes an edit back, what the sidebar leaves out and the two doors under it, pinning a page to the sidebar, and writing a document.
- [search.md](search.md) — one query language, five doors: what matches, the operators (`is:`, `has:`, `date:`, the two stamps `created:` / `changed:`, `prop:`, and `-` to negate), the `"quoted phrase"` and the `OR` that compose them, what a result row shows, and the filter that narrows a page in place — every page that draws nodes, and what narrowing means on each.
- [git.md](git.md) — the git integration: commit modes, committing on its own, the pill, and the audit view.
- [chat.md](chat.md) — the chat agent: which agents olai finds and how a conversation is bound to one, ACP and `OLAI_ACP_AGENT`, the node tools, pictures, being told when the agent is waiting on you, and kolu.
- [format.md](format.md) — the file format and its rules: the record shapes, the fields, status, references (`see`, `@<id>` in prose, and what a zoomed node reads backwards), days, the pinned shelf (`Pins.olai`, and why a pin is an address rather than a field), which files a served directory is made of (`.olai`, `.md`, and the four kinds olai only shows — `.html`, `.csv`, the picture suffixes, `.pdf`), and merge safety.
- [architecture.md](architecture.md) — how the packages fit, and the reasoning behind the layering.
- [roadmap.olai](roadmap.olai) — the plan, in the format itself.
- [brainstorming/](brainstorming) — the decisions, and why the alternatives lost.
- [RCA/](RCA) — root-cause analyses of things that went wrong.

Developing is [../HACKING.md](../HACKING.md), and the website is [olai.kolu.dev](https://olai.kolu.dev).
