# Search

One search, two faces. An agent asks `search_nodes` over MCP; a person types
into the `⌘K` palette, which asks the server's `search.nodes` procedure. Both
are callers of the same function over the same snapshot (`@olai/ops`'
`Query.searchWith`), so what an agent finds and what the palette finds cannot
drift — the browser holds every node and could grep them itself, and
deliberately does not.

## Exact matches are evidence

The base reading is case-folded substring over four fields — title, id,
inline `#tags`, note — every word of the query somewhere in the same node, no
operators. Title hits outrank id, tag, note; a field that starts with the
word beats one that buries it; a done node loses ties. Hits carry
`file:line`, ancestor titles, the mark if any, and the node's own `see` /
`after` edges. Mirrors are never hits — a placement is a second view of a
node, not a node.

## Paraphrase matches are resemblance

When the machine has a local embedder, hits with `matched: "meaning"` are
appended AFTER the exact ones: nodes whose title+note the index reads as
saying the same thing in other words. They never outrank an exact match —
the words being in the node is checkable, a similarity score is not — and a
query whose exact matches already fill the limit never consults the index at
all. In the palette a semantic hit wears `≈`.

The index is a **derived reading, never a second truth**:

- embeddings per node (title + note) live in a gitignored-by-location cache —
  `$XDG_CACHE_HOME/olai/recall/`, keyed by the served path — never inside the
  served directory, so nothing ever shows up in your pending commits and the
  file watcher never chases olai's own bytes;
- it is rebuilt incrementally off the store's own snapshot stream, by content
  hash: an unchanged node is never re-embedded, across edits and across
  serves;
- deleting the cache is always safe. Search answers substring immediately and
  paraphrases again once the rebuild lands — both halves are pinned in tests;
- nothing semantic ever touches a write. Embedding reads the words you wrote;
  no LLM sits in any write path, and your words are never rewritten.

## Turning it on (and off)

Run [Ollama](https://ollama.com) and pull the default model:

    ollama pull nomic-embed-text

That is the whole setup: the server probes Ollama at boot (`OLLAMA_HOST` is
honoured, loopback by default) and starts indexing when it finds the model.
`OLAI_EMBED_MODEL` names a different Ollama model; the embedder sits behind a
seam, so a configured API embedder can slot in later without the index
changing.

No Ollama — or Ollama without the model — means search is substring-only,
which is not an error and is reported nowhere but a boot log line. With the
embedder absent, results are **exactly** today's substring results: that
equality is the degradation contract, and CI (which has no Ollama) proves the
semantic path against a fake embedder behind the seam.
