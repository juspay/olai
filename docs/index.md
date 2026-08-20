# olai docs

- [running.md](running.md) — how to serve a directory: `olai web` and its flags, one olai per directory, the home-manager module, and the HTTP MCP face at `/mcp`.
- [editing.md](editing.md) — changing an outline by hand: the keys, dragging a row, picking several at once, what a draft is, how ⌘Z takes an edit back, what the sidebar leaves out and the two doors under it, pinning a page to the sidebar, and writing a document.
- [search.md](search.md) — one query language, five doors: what matches, the operators (`is:`, `has:`, `date:`, the two stamps `created:` / `changed:`, `prop:`, and `-` to negate), the `"quoted phrase"` and the `OR` that compose them, what a result row shows, and the filter that narrows a page in place — every page that draws nodes, and what narrowing means on each.
- [git.md](git.md) — the git integration: commit modes, the pill, and the audit view.
- [chat.md](chat.md) — the chat agent: ACP and `OLAI_ACP_AGENT`, the node tools, pictures, and kolu.
- [format.md](format.md) — the file format and its rules: the record shapes, the fields, status, references (`see`, `@<id>` in prose, and what a zoomed node reads backwards), days, the pinned shelf (`Pins.olai`, and why a pin is an address rather than a field), which files a served directory is made of (`.olai`, `.md`, `.html`), and merge safety.
- [architecture.md](architecture.md) — how the packages fit, and the reasoning behind the layering.
- [roadmap.olai](roadmap.olai) — the plan, in the format itself.
- [brainstorming/](brainstorming) — the decisions, and why the alternatives lost.
- [RCA/](RCA) — root-cause analyses of things that went wrong.

Developing is [../HACKING.md](../HACKING.md), and the website is [olai.kolu.dev](https://olai.kolu.dev).
