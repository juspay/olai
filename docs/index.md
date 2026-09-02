# olai docs

- [running.md](running.md) — how to serve a directory: `olai web` and its flags, one olai per directory, the home-manager module, the git policy an instance can pin for every browser looking at it, the HTTP MCP face at `/mcp` — which is also what `olai surface` speaks, so a terminal is a client of it rather than a door of its own — quick capture, and who is looking behind a reverse proxy.
- [editing.md](editing.md) — changing an outline by hand: the keys, dragging a row, picking several at once, what a draft is, how ⌘Z takes an edit back, what the sidebar leaves out and the two doors under it, pinning a page to the sidebar, and writing a document.
- [search.md](search.md) — one query language, five doors: what matches, the operators (`is:`, `has:`, `date:`, the two stamps `created:` / `changed:`, `prop:`, and `-` to negate), the `"quoted phrase"` and the `OR` that compose them, what a result row shows, and the filter that narrows a page in place — every page that draws nodes, and what narrowing means on each.
- [git.md](git.md) — the git integration: commit modes, committing on its own, the pill, and the audit view.
- [chat.md](chat.md) — the chat agent: which agents olai finds and how a conversation is bound to one, ACP and `OLAI_ACP_AGENT`, the node tools, pictures, being told when the agent is waiting on you, what a conversation wakes on, and kolu and odu.
- [live-properties.md](live-properties.md) — the one seam both integrations hang off: a property whose value is a name and whose face updates on its own, the DECLARATION in `_olai/Properties.olai` that turns one on rather than the key's name, the two shapes a face takes (a block that owns a row, a chip beside the value), what a live face is allowed to be, and what a property whose plugin is switched off is.
- [format.md](format.md) — the file format and its rules: the record shapes, the fields, status, references (`see`, `@<id>` in prose, and what a zoomed node reads backwards), days, the pinned shelf (`Pins.olai`, and why a pin is an address rather than a field), which files a served directory is made of (`.olai`, `.md`, and the four kinds olai only shows — `.html`, `.csv`, the picture suffixes, `.pdf`), and merge safety.
- [architecture.md](architecture.md) — how the packages fit, and the reasoning behind the layering.
- [internal/plugin-system.md](internal/plugin-system.md) — a tour of the plugin system for people working on olai: what a plugin is, the vocabulary (probes, kinds, dressings, faces, the roster, the doorbell a plugin speaks into a conversation through), the three doors and why there are three, how core and a plugin share one wire, and the path a declaration takes to become a face on a row.

Each integration documents itself, in its own package, and this list is the door to it. A page here is a symlink onto the plugin's own `docs.md`, so what is served and what sits beside the code are one file rather than two that can drift; `packages/tests/plugin_docs.test.ts` holds every line below to a page that is actually there.

- [plugins/kolu.md](plugins/kolu.md) — the kolu integration: what olai does with a padi when one is running (the Dock row a `terminal` property draws, and the live read-only pane it opens), what it says when there is none, the header readout's three states, the events feed and the watch knobs behind it, the doorbell that wakes a scoped conversation when a claimed terminal goes quiet, the chat panel's `kolu mcp`, and which slice of the Orchestrator this is.
- [plugins/odu.md](plugins/odu.md) — CI on the board: the chip a `worktree` wears while odu is running in that checkout, the run matrix it opens, what a settled run leaves behind, the two facts on the board that turn it on, the doorbell that wakes a scoped conversation when a claimed run goes red or settles, the chat panel's `odu mcp`, and what the watching costs.

The development docs — the roadmap in the format itself, the decisions and why the alternatives lost, and the root-cause analyses — live in the orchestrator's own vault, [juspay/oss.olai](https://github.com/juspay/oss.olai), under its `olai/` folder:

- [olai/roadmap/](https://github.com/juspay/oss.olai/tree/main/projects/olai/roadmap) — the plan, in the format itself.
- [olai/brainstorming/](https://github.com/juspay/oss.olai/tree/main/projects/olai/brainstorming) — the decisions, and why the alternatives lost.
- [olai/RCA/](https://github.com/juspay/oss.olai/tree/main/projects/olai/RCA) — root-cause analyses of things that went wrong.

The public site, [olai.kolu.dev](https://olai.kolu.dev), is the pitch; these pages are how to use it.
