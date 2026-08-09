# Olai rewrite plan: Racket to TypeScript

Status: ratified 2026-08-07, committed 2026-08-09. This repo (olai-racket) is frozen and serves as the reference implementation. The rewrite happens at <https://github.com/juspay/olai>. The agent working there reads this file first and treats the decisions below as settled.

## Why rewrite

Racket's compile loop is too slow for AI-driven development, and the current htmx/SSE web stack cannot grow into a real editor. TypeScript fixes the iteration speed; Kolu's surface framework provides the live web client the product needs.

## Decisions (settled — do not relitigate)

1. **Language and runtime**: TypeScript on Bun, the same setup as odu.[^1]
2. **File format**: flat-record JSONL — one node per line, stable ids, parent pointers. A git merge driver keyed by node id can be added later if team merge conflicts become painful.[^2]
3. **No CLI.** There are two write surfaces: the web UI and agent MCP tools. Both call one ops layer.
4. **No hand-editing.** The server is the only writer. Git merges are the only edits that bypass it, and validation on load catches those.
5. **Agents edit through the server**: the ACP session is given an MCP server exposing the ops as tools (add, mark, move, archive, queries).[^3]
6. **Web**: surface + SolidJS over WebSocket. Server-authoritative editing, no optimistic UI — a write changes the file, and the live stream pushes the update.[^4]
7. **Surface dependency**: pin the kolu repo with npins and load `@kolu/*` packages from the Nix store, exactly as odu does.[^5]
8. **Build order**: a thin vertical slice first — format core, ops, MCP tools, minimal live view — then the editor.
9. **This repo freezes.** PR #54 stays open, unmerged, as a working demo of the format. Nothing migrates from it — the new project starts with empty data.
10. **Serve takes one directory, recursively monitored.** It picks up `.jsonl` outlines and `.md` documents as they appear. Every `.jsonl` file is an independent tree: no cross-file parents, no include records. Cross-file relations are mirrors and edges, by bare id.
11. **The journal is a query, not a structure.** Day nodes carry a `date`; the calendar, today view, and any year/month grouping are derived from dates at view time. No stored year/month hierarchy.
12. **A note is one string** with embedded newlines. Word-diff tooling handles review; no array-of-lines, no note-block records.
13. **All found `.md` files render as documents** in the UI; a node's `doc` field links to one.

## What must survive the rewrite

These are design wins independent of language. Losing any is a regression.

- One validator: format rules are checked in exactly one place, never in the reader, the store, or the web layer.
- Every error names its location (`file:line` of the bad record). Error quality is the product.[^6]
- Derived state is never stored: a parent's done-ness is computed from its children, and writing it is an error.
- Node ids are unique across the loaded set and survive renames and moves.
- Git is the only history. No sync protocol, no CRDT. A write goes: temp file, re-validate, atomic rename, commit.
- Markdown is rendered only at view time; stored text stays verbatim.
- Layering between packages is declared and machine-checked.

## The format

One `.jsonl` file per outline. One JSON object per line. One line per node. Parsing is `JSON.parse` per line — there is no parser to write.

```jsonl
{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","date":"2026-08-10","after":["demo"]}
```

The full field specification is in the footnote.[^7] Field order is fixed so diffs stay stable. One checker validates the loaded set — unique ids, no dangling references, no cycles, no stored derived state — on load and after every write.

The working reference is PR #54 on this repo: a complete Racket loader and writer for this format, plus the migration of every outline in `docs/olai/` and `examples/`. Read it; do not extend it.

## Why the alternatives lost

- **The current indented-text format**: its strength was pleasant hand-editing, which is no longer a requirement; its weakness is that line-based diffs cannot see a subtree move, so concurrent edits merge badly.[^8]
- **Markdown**: Logseq tried markdown as a data store at scale, hit years of corruption and data-loss bugs, and retreated to a database with markdown as export only. Markdown also has no invalid documents, so validation fights the format instead of leaning on it.[^9]
- **One file per node**: a real contender with the best PR review story for notes; lost on sheer file count. Revisit if reviewing note edits becomes a daily need.
- **CRDT files, git-objects, Dolt**: each gives up plain-git reviewability, which is a hard requirement.[^10]

Two late candidates were evaluated on 2026-08-09 and rejected:

- **Rust instead of TypeScript**: Rust wins on everything except the product. Agent-written PRs iterate best against rustc (SWE-bench Multilingual reports Rust with the highest resolution rate of nine languages), the cargo workspace DAG makes layering a compile error rather than a lint, and the official ACP and MCP Rust SDKs are first-class. But there is no maintained server-authoritative live-web story: Leptos went "lightly maintained" in May 2026 with the snapshot-plus-deltas sync living in a third-party crate, and every other path means hand-wiring the layer surface provides.[^11] The live web editor is the product, so TypeScript stands.
- **No standalone app — kolu hosts the UI**: kolu's canvas tile model is built to grow non-terminal tiles, and one kolu instance would cover every repo's outlines without per-repo servers. Rejected for now: teammates who don't run kolu would have no UI at all, and nothing in the standalone design prevents kolu from becoming a second consumer later. Standalone stands.

## Architecture

- **Store**: files on disk load into a validated snapshot. Staleness is detected by a probe (file stamps plus re-asked questions like directory listings); a file watcher only triggers the probe. A file arriving via `git pull` appears without a restart.
- **Surface mapping**: the snapshot is a `stream`; ops are `procedures`; error state is a `cell`; collapse and view toggles are local `cells`; chat rides `events`. Reconnect recovery comes free from surface's snapshot-then-deltas rule.[^4]
- **Chat**: ACP via the official TypeScript SDK, `@agentclientprotocol/sdk`.[^3]
- **Details**: remark + rehype-sanitize for rendering; Temporal for dates; shell out to `git`; Effect throughout — Kolu's whole stack is Effect now (kolu PR #2112), so schemas at process boundaries are Effect Schema, and the `effect` version must match the pinned kolu's exactly (footnote 5's single-instance invariant); Cucumber + Playwright e2e (this repo's feature files port as-is); nix flake + npins + justfile, same shape as odu.

## PR phases

One PR per phase; every phase leaves the repo working and CI green, and every phase after the scaffold ships a user-visible change. The browser is the visibility vehicle from day one — there is no CLI to demo through.

1. **Scaffold** (the exception: no user-visible change): flake + npins (kolu, nixpkgs), Bun, `tsconfig`, `bunfig.toml` (isolated linker), the `@kolu/*` hydrate script, justfile, CI. Gate: `just check` green in CI on an empty-but-typed workspace.
2. **See your outline**: serve a directory, parse and validate the `.jsonl` files (format core: unique ids, dangling refs, cycles, stored derived state), render the tree read-only in the browser via a minimal surface view. Visible: your outline in a browser tab — or the validation error, with `file:line`.
3. **It stays live**: probe-based staleness over the recursive directory, snapshot `stream`, error `cell`. Visible: edit a file or `git pull`, the page updates without reload; break a file, the page keeps last-good and shows the error banner.
4. **An agent can edit it**: ops (add, mark, move, archive; fractional-ord insertion; temp-file → re-validate → rename → commit) exposed as MCP tools over the ACP wiring (`@agentclientprotocol/sdk`). Visible: tell a coding agent to check something off and watch the browser update; a refused write (derived state, listing the unfinished children) shows in the agent's tool output.
5. **Talk to it in the UI**: the chat panel — ACP session projected into surface events; send, stream, cancel. Visible: full chat-driven editing loop inside the web app.
6. **Edit it yourself**: keyboard-driven outline editing — add, check off, reorder, move — through the same procedures. Visible: the Workflowy loop without the agent.
7. **Editor growth**: drag-drop, `.md` document rendering, views, command palette — each its own PR against the new repo's roadmap, each user-visible by nature.

## Open questions

None right now. The 2026-08-07 round resolved: notes are single strings (decision 12); the journal is derived from dates, no cross-file structure (decisions 10–11); architecture checks beyond package boundaries are not ported; there is no data to migrate (decision 9).

[^1]: Bun is the package manager, test runner (`bun test`), and script runner; types are checked separately with `tsc --noEmit`. Working examples on this machine: `~/code/odu` (single package) and `~/code/drishti` (workspace with `packages/` and `tsconfig.base.json`). Copy odu's `bunfig.toml`: the isolated linker, with the comment explaining why hoisted cannot work.

[^2]: The merge driver idea comes from Dolt: merge structured data by primary key and field, not by line. A `.gitattributes` merge driver can do this over JSONL; without it installed, files still merge line-by-line, which is safe because each node is one line.

[^3]: ACP (`@agentclientprotocol/sdk`; the older `@zed-industries/agent-client-protocol` is outdated) is JSON-RPC over stdio; `session/new` accepts MCP server configs, which is how the ops tools reach the agent. ACP's file-read/write capability was considered and rejected: whole-file writes are not granular enough for mediated editing. Kolu's `surface-mcp` package is prior art for exposing a surface as MCP tools.

[^4]: Surface primitives: `cell` (one value), `collection` (keyed values), `stream` (read-only view over state the server does not own, e.g. files), `event`, `procedure`. Every subscription sends a full snapshot first, then deltas; a reconnect just re-sends the snapshot. Rule carried over from this repo's htmx ban: no raw oRPC/WebSocket code outside surface's API.

[^5]: Both odu and drishti pin the kolu repo at a revision in `npins/sources.json`. odu then hydrates `@kolu/*` as raw TypeScript from the Nix store (`scripts/hydrate-kolu-packages.sh`) instead of installing them from `bun.lock`; their imports resolve by walking up to the root `node_modules`, which works because each of their dependencies is also a direct dependency of the app — that is the invariant to protect (odu's `bunfig.toml` documents it). Also copy the `package.json` overrides note: exactly one copy of `effect` may exist, or tag-based error narrowing breaks across class realms.

[^6]: The error kinds (usage, validation, not-found, derived, busy) become a tagged union, surfaced as MCP tool errors and HTTP codes. Keep the detail where a refusal to store derived state lists the unfinished children — errors that teach are what make agents effective.

[^7]: Fields, in canonical order: `id` (stable identity; a chosen name — the old `^anchor` — or a minted short random string; unique across the loaded set), `parent` (parent id; absent at top level), `ord` (fractional-index string for sibling order; use a maintained library; string keys, never floats), `title` (verbatim; inline `#tags` live here), `done`/`doing` (`true` or ISO timestamp; at most one; never stored when derivable), `date` (ISO), `desc` (the note: one string, embedded newlines), `doc` (relative path to an attached `.md`), `after`/`blocks`/`see` (arrays of target ids; closed set; `after` must stay acyclic). One special record shape: a mirror `{"id","parent","ord","mirror":"<target id>"}` shows an existing node at a second location; the target may live in any file of the set. There are no include records — the served directory is the only composition mechanism.

[^8]: Evidence: the org-mode community built a dedicated heading-matching merge tool because generic line diff loses subtree moves; Kleppmann's move-op paper shows a move in a tree encoding is a global-invariant operation, while in a flat record it is a one-field write.

[^9]: Logseq's pivot rationale (sync, collaboration, "less data loss") is documented in their forum and `db-version.md`. Supporting pattern: everything that works in git converges on stable ids plus record-level granularity — Beads' JSONL era, TiddlyWiki's file-per-node, Roam's `uid`/`order`/`parents`, Workflowy's `id`/`parent_id`.

[^10]: Automerge's checksummed binary format is corrupted by git conflict markers; git-bug stores data in git objects GitHub cannot render and ships "bridges" to compensate; Dolt is a version-controlled database that replaces git rather than living inside it.

[^11]: The Rust survey (August 2026): Leptos core is feature-complete and "lightly maintained" per its maintainer (leptos-rs/leptos#4707), with WebSocket signal sync in the third-party `leptos_ws` crate; Dioxus ships only a raw `use_websocket` primitive; axum plus a TypeScript frontend means hand-rolling the whole live protocol. Meanwhile `agent-client-protocol` (Rust) is at 2.0 under Zed+JetBrains governance and `rmcp` is the mature official MCP SDK — Rust would be the better plan for a headless daemon, and remains the fallback if the product ever sheds its UI.
