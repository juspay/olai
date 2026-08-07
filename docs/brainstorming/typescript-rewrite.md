# olai in typescript: the rewrite (brainstorm)

Status: plan, ratified 2026-08-07, iterating. This repo (olai-racket) is
FROZEN — no further features; it stands as the reference implementation.
The rewrite happens at <https://github.com/juspay/olai>. The agent working
there reads this file first and treats its RULINGS as settled.

## Why

Racket was the right language for the idea (the outline IS a program; the
expander IS the validator) and the wrong language for the era: the compile
loop is too slow for AI-driven development, and the htmx/SSE web stack caps
out at a read-only view. The product needs a real editor. TypeScript gets
both: fast agent iteration, and Kolu's surface framework for the client.

## Rulings (settled 2026-08-07, don't relitigate)

- **Language**: TypeScript. **Runtime**: Bun, like odu — package manager,
  test runner (`bun test`), script runner; `tsc --noEmit` for types.
- **Format**: flat-record JSONL (candidate A below). An id-keyed git merge
  driver (candidate B) is an additive upgrade later, when team merge pain
  is real.
- **The CLI is gone.** Not ported, not optional. Two write surfaces: the
  web UI and agent MCP tools. One ops layer under both.
- **Hand-editing is dead.** No $EDITOR path. The server is the sole
  writer; git merges are the only out-of-band mutation, caught by
  validation on load.
- **Agents edit through the server**: ACP `session/new` passes an MCP
  server exposing ops as tools (add, mark, move, archive, queries). ACP's
  `fs/read_text_file`/`write_text_file` was rejected: not granular enough.
- **Web**: surface + SolidJS over WebSocket. Server-authoritative editing,
  no optimistic UI — a write mutates the file, the stream re-pushes.
- **Surface dependency**: pin the kolu repo via npins, hydrate `@kolu/*`
  from the Nix store — exactly odu's mechanism (see odu's
  `npins/sources.json` and `package.json` overrides note; mind the
  one-effect-instance invariant).
- **Sequencing**: vertical slice first — format core + ops + MCP tools +
  minimal surface view in one thin pass, every layer proven; then the
  editor.
- **This repo freezes.** PR #54 stays an unmerged demo.

## What survives the rewrite

Language-independent design wins. Losing any is a regression:

- ONE validator. Format rules checked in exactly one place — never in the
  reader, the store, or the web layer.
- Errors carry a precise location (`file:line` of the offending record).
  Error quality is the product; post-merge validation and agent tools
  lean on it.
- Derived state is never stored. A parent's done-ness is computed from
  children; storing it is an error (the refusal names the unfinished
  children — keep that).
- Node identity is set-scoped and stable: unique across the loaded set,
  survives renames and moves.
- Git is the history. No sync protocol, no CRDT. Writes are temp-file ->
  re-validate -> atomic rename -> commit.
- One ops layer; the server mediates every write. Error kinds (usage |
  validation | not-found | derived | busy) become a tagged union surfaced
  as MCP tool errors and HTTP codes.
- Markdown is render-time only. Stored strings stay verbatim.
- Layering is declared and checked (package boundaries + dependency
  rules), not described in prose.

## The format

One `.jsonl` file per outline; one JSON object per line; one line per
node. Parse with `JSON.parse` per line — there is no parser to write.

| field | rule |
|---|---|
| `id` | stable node identity. Human-chosen (the old `^anchor`) or minted short random. Unique across the loaded set |
| `parent` | parent node id; absent at top level |
| `ord` | fractional-index string ordering siblings — use a maintained library, string keys, never floats |
| `title` | verbatim text; inline `#tags` live here |
| `done` / `doing` | `true` or ISO timestamp; at most one; never stored when derivable from children |
| `date` | ISO date or datetime |
| `desc` | the note. PR #54 used one `\n`-joined string; long notes make ugly one-line diffs — array-of-lines is the likely fix (open question 1) |
| `doc` | relative path to an attached `.md` document |
| `after` / `blocks` / `see` | arrays of target ids; closed relation set; `after` acyclic |
| mirror record | `{"id","parent","ord","mirror":"<target id>"}` — same node, second site (DAG) |
| include record | `{"id","parent","ord","include":"<path or single-star glob>"}` — splice another file's top-level records |

Canonical field order (the table's order) for stable diffs. Validation
over the loaded set: unique ids, no dangling parent/mirror/edge targets,
no cycles, no stored-derived contradictions — one checker, run on load
and after every write.

Reference implementation: PR #54 on this repo — a complete Racket
loader/writer for this format plus the migration of every outline in
`docs/olai/` and `examples/`. Unmerged by ruling; read it, don't extend
it.

### Why not the alternatives

Researched 2026-08-07, primary sources; the losers and their one-line
verdicts:

- **Indentation outline text** (this repo's format): its virtue —
  hand-editability — was ruled out of the loop; its flaw is now the
  deciding criterion: line diffs can't see subtree moves (org-mode needed
  a custom heading-matching merge tool; Kleppmann's move-op paper explains
  why reparenting is a global-invariant op in a tree encoding and a
  one-field write in a flat record).
- **Markdown profile**: Logseq ran markdown-as-datastore at scale,
  accumulated indent-corruption and data-loss issues, and retreated to
  DB-canonical with markdown as export. Also: markdown has no invalid
  documents, so a profile validator fights every well-formed file; `.md`
  is a claimed namespace (formatters and Obsidian rewrite files they
  think they own).
- **File-per-node**: legitimate contender (TiddlyWiki adopted it to fix
  git merges; best PR review of notes). Lost to JSONL on file-count noise
  and load characteristics; revisit only if note-diff review becomes the
  team's daily pain.
- **CRDT binaries / git-objects / Dolt**: all abandon plain-git
  reviewability — Automerge files corrupt under conflict markers, git-bug
  needed GitHub "bridges", Dolt replaces git rather than living in it
  (its transferable insight — merge by primary key, not line — is what
  candidate B's merge driver implements in plain text).
- **Convergent evidence for flat records + stable ids**: Beads' JSONL
  era (hash ids so concurrent creators can't collide), Roam
  (`uid`/`order`/`parents`), Workflowy (`id`/`parent_id`), Dolt
  (primary-key diffs), nbdime (existence proof that nested-JSON documents
  don't line-merge).

## Architecture

- **Store**: outlines on disk -> loaded set -> validated snapshot. Reload
  staleness via the probe model (mtime+size stamps plus re-answerable
  questions — glob results, directory listings); a file watcher is a
  trigger, never the truth. A file appearing via `git pull` shows up
  without a restart — that is now the primary out-of-band path.
- **Surface mapping**: snapshot -> `stream` (derived view over state the
  server doesn't own); ops -> `procedures` (server-authoritative; the
  stream re-push is the confirmation); last-good + error banner -> `cell`
  `{snapshot, error}`; collapse/view toggles -> local-authority `cells`;
  chat -> `events` + procedures. Reconnect catch-up is free
  (snapshot-then-deltas). Raw oRPC/WebSocket outside surface's API is
  banned — the heir of this repo's raw-htmx ban.
- **Chat**: ACP via the official TypeScript SDK
  (`@zed-industries/agent-client-protocol`) — spawn the agent, adopt or
  create a session, project events into the chat surface. Kolu's
  `surface-mcp` is prior art for projecting ops as MCP tools.
- **Rendering**: unified/remark + rehype-sanitize, allowlist, render-time
  only. Dates: Temporal (polyfill until Bun/Node ship it). Git: shell out
  to the binary. Process-edge schemas: Zod; keep the model/reply split
  with separate version counters.
- **Testing**: `bun test` for units; Cucumber + Playwright e2e — this
  repo's `e2e/` feature files port with their runner intact.
- **Nix**: flake + npins (kolu, nixpkgs), justfile recipes, same shape as
  odu.

## Open questions (iterate here)

1. `desc` as `\n`-joined string vs array-of-lines. Leaning array.
2. Journal convention (`Daily.jsonl` + month fragments + include glob)
   ports as-is, or does the flat format want a different journal shape?
3. Layering enforcement: package boundaries cover direction; do the other
   arch checks (authority ownership, concept exclusivity, churn audit)
   get a TS reimplementation or die with the Racket repo?
4. Migration tooling for existing users' `.rkt` outlines: PR #54's
   converter logic, rewritten in TS, or a one-time script blessed here?
