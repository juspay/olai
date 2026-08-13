# Olai vs Hindsight: what an agent-memory product knows that we don't (and vice versa)

Status: brainstorming, opened 2026-08-13 at the human's request. Researched from
[hindsight.vectorize.io](https://hindsight.vectorize.io/) and the
[vectorize-io/hindsight](https://github.com/vectorize-io/hindsight) repo (MIT,
self-hostable). A prior third-party comparison the human received is corrected
below where it was wrong.

## What Hindsight is

A memory system for AI agents (by Vectorize). Three verbs: `retain()` (an LLM
extracts facts, entities, temporal data, and relationships from whatever the
agent saw), `recall()` (four parallel retrievals — vector similarity, BM25
keyword, entity/temporal/causal graph links, time-range filtering — fused and
reranked), `reflect()` (an LLM reasons over stored memories to form new
connections). Facts consolidate automatically into "observations" that are
updated, not overwritten, with evidence history. Memory banks carry a mission,
hard directives, and disposition sliders. Storage is PostgreSQL (or embedded
pg0); every retain and reflect is an LLM call. Runs hosted or self-hosted;
clients for Python/TS/Go/CLI/HTTP; integrates with Claude Code, Cursor,
LangGraph, CrewAI, and friends.

**Corrections to the prior comparison**: Hindsight is not "locked inside Claw"
— it integrates with local Claude Code and anything speaking HTTP, and it is
MIT-licensed and self-hostable. Its storage is opaque *as a practical matter*
(rows in Postgres, embeddings, LLM-normalized entities), not proprietary.

## What olai is, in the same frame

An outline that is also the agent's memory. The files are the database —
`.jsonl` outlines and `.md` notes in a git repo — served live to a browser and
projected into MCP for agents. Writes go through one validated ops table
(web and MCP express the same verbs); every change is a git commit. Structure
is deliberate: hierarchy, marks, dates, `see`/`after` edges, mirrors, tags.
The human and the agent read and write *the same* memory through the same
server.

## Head to head

| | Hindsight | olai |
|---|---|---|
| Source of truth | Postgres rows, LLM-normalized | plain files in git |
| Who curates | the LLM (retain/consolidate) | the human and the agent, deliberately, via ops |
| Recall | semantic + BM25 + graph + temporal, reranked | substring search; structural reads (subtree, edges, journal) |
| Structure | extracted entities/relations, free-form facts | authored hierarchy, typed edges, marks, dates |
| History | observation evidence log | git — diff, blame, revert, the full story |
| Multi-agent | banks + tag scoping, many agents one service | one server, many MCP clients; single ACP session today |
| Human's face | a dashboard over agent memory | the app *is* the human's outliner |
| Runtime cost | an LLM call per retain and reflect | zero LLM in the loop; ops are mechanical |
| Offline / dependency | service + DB + LLM key must be up | files; the server is optional for reading |
| Inspection | SQL / API | `cat`, grep, `git log`, any editor |

## Where Hindsight is genuinely ahead (olai's cons, honestly)

1. **Semantic recall.** "Related facts even without keyword match." olai's
   `search_nodes` is case-folded substring; a paraphrase misses.
2. **Temporal and graph recall.** "What did Alice do last spring?" — olai has
   dates and edges but no retrieval that *uses* them together.
3. **Automatic capture.** Hindsight retains everything the agent saw; olai
   remembers only what someone deliberately wrote.
4. **Consolidation lifecycle.** Duplicate and drifting facts get merged with
   evidence; olai's outline accumulates until someone gardens it.
5. **Multi-agent scoping.** Banks and tags scope memory per agent; olai serves
   one directory to whoever connects, and chat is a singleton ACP session.
6. **Cross-machine share.** A hosted bank is reachable from anywhere; olai's
   repo syncs by git, with merge conflicts possible across machines.

## Where olai is genuinely ahead (keep these; do not trade them away)

- **Files are the database**: inspectable, diffable, portable, offline,
  editable with anything, and *owned*. No service dependency for the truth.
- **One memory for human and agent.** Hindsight's memory is agent-facing; the
  human gardens olai's outline as their own tool. Curated memory is trusted
  memory.
- **Deliberate structure beats extracted structure.** An authored `after` edge
  or mirror carries intent no entity extractor recovers.
- **Git history is a better evidence log** than an observation table: blame,
  revert, PRs, and the roadmap-as-ledger discipline this repo already runs.
- **No LLM in the write path**: no cost, no drift, no normalization rewriting
  what you said. (Hindsight's `retain` is an LLM call *every time*.)
- **Validated ops, not free-form facts**: a write is a typed verb against a
  schema, refused in words when wrong.

## Recommendations: address every con in olai's own grammar

The pattern for all of these: **the files stay the single source of truth;
anything smarter is a derived reading** — a cache the live store rebuilds,
never a second database that can disagree.

1. **Semantic search as a derived index.** A gitignored local index
   (embeddings per node/note paragraph) rebuilt incrementally off the live
   store's change stream; `search_nodes` grows a mode that merges substring
   hits with vector hits (local model via Ollama, or an API key when
   configured — degrade to substring when absent). Same reading on both faces:
   the palette and MCP. This upgrades the existing `search` roadmap item
   rather than adding a service.
2. **Temporal + graph recall as query, not extraction.** olai already *has*
   the graph (edges, mirrors, ancestors) and the time (dates, done instants,
   git timestamps). Teach search to use them: "touched last week", "connected
   to X within two hops", journal-aware filters. No LLM required — this is
   `Query` growing clauses, and it composes with (1)'s ranking.
3. **Capture as proposal, not auto-retain.** Keep deliberate memory as the
   stance — but lower its cost: a chat verb where the agent *proposes* a
   distilled note (into daily notes or a chosen node) at conversation end, and
   the human accepts in one press. The chat-diffs surface already renders
   proposed writes; #141's context loop makes the subject explicit. Auto-retain
   without review is how a memory fills with things nobody vouched for.
4. **Consolidation as gardening, agent-assisted.** A standing "stale reading":
   surface nodes untouched N days (the store-graduation stillness logic,
   generalized), duplicates by near-title, and orphaned edges — as a view, not
   a mutation. One button: "ask the agent to propose a consolidation" — the
   agent files archive/merge/rewrite ops as reviewable diffs. Evidence
   tracking is free: it is git blame.
5. **Multi-agent scoping via outlines and tags.** The server already mediates
   all writers through one ops table (no intra-machine conflicts by
   construction). Scoping maps to what exists: serve a subset (an outline, a
   tag) per MCP connection; lift the singleton ACP session (already filed as a
   known limit) so two agents can hold different conversations against the
   same truth.
6. **Cross-machine sync stays git — made boring.** Auto pull/rebase on the
   server with conflicts *surfaced* per the silent-errors doctrine (a strip,
   in git's own words), never auto-resolved silently. The `.jsonl`
   one-node-per-line format plus fractional ordering already minimizes
   textual collisions; write a short doc on the merge story and test the two
   ugliest cases (same node edited both sides; same position inserted).

## What we deliberately do not copy

- **retain()-style LLM normalization** — rewriting the user's words into
  canonical entities is the opposite of files-you-own.
- **Mission/directives/disposition** — olai's agent gets its identity from
  the repo it serves (CLAUDE.md, the outline itself), not from memory-bank
  configuration.
- **A hosted memory service** — the moment memory lives behind an API, every
  pro in olai's column dies at once.

## Open questions for ratification

1. Which of recommendations 1–6 become roadmap items now, and in what order?
   (1) and (3) look like the highest leverage-to-cost.
2. For (1): local embedding model (Ollama, zero-config cost) vs API-key
   embeddings (better, needs a key) vs both-with-degradation?
3. Is (3)'s accept-a-proposed-note the same surface as the chat-diffs already
   shipped, or a new affordance?
4. Does (5) wait on the multi-session ACP work, or is per-connection MCP
   scoping worth shipping alone?
