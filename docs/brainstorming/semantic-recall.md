# Semantic recall, nix-native — the design pass

Status: **GO**, on the numbers below. Measured 2026-08-14 on `x86_64-linux`,
16 cores, nixpkgs pinned at `afb4584a` (`npins/sources.json`).

This is the second part of the `search` roadmap item, returning on the terms
its parking verdict set. The first attempt shipped inside PR #149 and was
removed in full before that PR landed, for one reason: it embedded through a
running **Ollama**, which no user's machine has and which
[HACKING.md](../../HACKING.md) forbids — *olai continues to require **NO**
dependencies outside of Nix itself*. The verdict parked the feature rather
than killing it, and named the condition for its return: the embedder **and**
the model must be nix-native — inside olai's own closure, reproducible, no
network fetch at run time, no daemon the user is expected to have installed.

That condition is met. What follows is what it costs.

## What was kept from the prior art

The removed implementation (PR #149's history, commit `89323369`) is the
design baseline, and five of its decisions are re-adopted unchanged because
none of them were what broke:

- **The index is a derived reading, off the change stream.** One in-memory map
  of node id → vector, reconciled against every snapshot the store publishes,
  incremental by content hash. The files stay the single truth; the index is
  never consulted for what a node *says*, only for *which ids to look at*, and
  those ids are resolved against the snapshot in hand. An index that lags — it
  always lags, by the width of an embed batch — can only miss, never
  contradict.
- **It sleeps in the XDG cache dir**, `$XDG_CACHE_HOME/olai/recall/`, keyed by
  a hash of the served path. Never inside the served directory: the `commit`
  tool sweeps anything untracked that `.gitignore` does not cover, so a cache
  there would sit in everybody's pending panel; and the store *watches* that
  directory, so an index rewriting itself on every batch would wake the watcher
  on olai's own bytes forever.
- **A required embedder seam.** `Query.Recall` is an interface `@olai/ops`
  declares and never implements. It cannot fail by type: an embedder that is
  down, slow or wrong answers an empty list. Recall is a reading a search falls
  back *from*, never a dependency a search waits *on*.
- **Exact-first ranking.** Substring hits are evidence — the words are in the
  node and a reader can check. Semantic hits only *fill what is left* of the
  limit. The two are never interleaved by score, because a cosine similarity
  and a field weight are not commensurable and a merge pretending otherwise
  would push checkable hits below guessed ones.
- **The `≈` marker**, on a semantic hit's place line, and the **byte-for-byte
  degradation pin**: with recall off, `searchWith` returns exactly what
  `search` returns, and that equality is a test.

## What is revised, consciously

Four things change, and each is a consequence of the embedder no longer being
somebody else's daemon.

1. **Detection becomes a path, not a probe.** `detectOllama` asked the network
   whether a model server happened to exist. The nix-native embedder asks
   nothing: the wrapper `default.nix` builds bakes two store paths into the
   binary's environment, exactly the way it already bakes `OLAI_ACP_AGENT` —
   `OLAI_EMBED_SERVER` (a `llama-server` from `pkgs.llama-cpp`) and
   `OLAI_EMBED_MODEL` (the weights, a fixed-output derivation). Absent — a
   `bun` run straight out of a source checkout, which has no wrapper — is the
   same `null` the old probe returned on the ordinary machine, and means the
   same thing: substring search, and nothing anywhere reports a missing
   feature.
2. **olai owns a child process now.** `llama-server` has no batch CLI in this
   build (there is no `llama-embedding` binary; `llama --help` lists `serve`
   and `cli` only), so embedding is an HTTP call to a server. It is **olai's
   own child**, spawned **lazily** on the first text that needs embedding,
   listening on a **unix socket** in the runtime dir (no TCP port, no
   collision, nothing the world can reach), and killed when the serve's scope
   closes. It is named in [running.md](../running.md). This is the exact
   inverse of the incident this item carries: the previous lane started an
   `ollama serve` by hand and did not say so; this one ships the process, in
   the closure, in the docs, dying with its parent.
3. **The task prefix follows the model.** `nomic-embed-text` wanted
   `search_query:` / `search_document:`; `bge-small-en-v1.5` wants its own
   instruction on the query side and nothing on the document side. The
   `EmbedKind` seam is unchanged — it exists precisely so this is a detail of
   one file.
4. **The similarity floor is retuned, and the retuning found something.** See
   below; the prior art's `0.5` was tuned against nomic and would let noise
   through on this model.

## The candidates, and why `llama-cpp` won

| candidate | in nixpkgs? | verdict |
|---|---|---|
| **`llama-cpp` + a GGUF embedding model** | yes (`llama-cpp` 10273) | **chosen** — CPU-first, the model is one file, the closure delta is measured below |
| `onnxruntime` + an ONNX model | the runtime is packaged; the **Node binding is not** | `onnxruntime-node` ships prebuilt `.node` binaries fetched by npm postinstall — the build runs with `--ignore-scripts` and the sandbox has no network. Would need a hand-rolled nixpkgs binding. |
| `fastembed` | absent | not packaged |
| a pure-TypeScript transformer | n/a — no dependency at all | correct on purity, wrong on everything else: a from-scratch BERT forward pass in TS is a large amount of load-bearing numeric code to own, and slow |
| static word vectors (GloVe), averaged | n/a — weights FOD + pure TS math | genuinely the cheapest closure (~20–60 MB, no native code, microsecond queries) and the honest fallback if the numbers below had said NO-GO. Quality is materially worse than a sentence encoder on exactly the queries this feature exists for. Recorded here as the standing alternative, not adopted. |

Model: **`bge-small-en-v1.5`, `q8_0` GGUF** — 33 M parameters, 384 dimensions,
512-token window, MIT-licensed, and the conversion repo
(`CompendiumLabs/bge-small-en-v1.5-gguf`) has not been touched since 2024-02,
so pinning it by revision is pinning something that holds still. The
derivation names the revision, not `main`.

## The numbers

Baseline is `nix build .#olai` at `a677bcc5`, x86_64-linux.

### Closure

| | bytes on disk | note |
|---|---|---|
| `olai` closure today | **1,095 MB** | of which `olai-acp-agent` is 589 MB and `nodejs` 265 MB |
| `+ pkgs.llama-cpp` (stock) | **+159 MB** | llama-cpp 41 MB, `blas` 69 MB, `openblas` 34 MB, `gfortran-lib` 13 MB. Every other path it needs is already in olai's closure. |
| `+ bge-small-en-v1.5-q8_0.gguf` | **+37 MB** | the fixed-output derivation |
| **total after** | **1,291 MB** | **+17.9 %** |

There is a cheaper llama-cpp: `blasSupport = false` drops BLAS, OpenBLAS and
gfortran entirely and leaves a **+41 MB** delta — a total of +78 MB, +7.1 %.
It is **not** what this design takes, and the reason is a measurement too:
that override is not in any binary cache, so every user (and every CI lane)
would compile llama.cpp locally. Timed here: **3 m 27 s** on 16 cores. Trading
118 MB of disk for a three-and-a-half-minute build on every machine that has
never seen this exact derivation is the wrong trade for a feature that is
supposed to arrive without ceremony. The override is a one-line lever in
`nix/embed.nix` if the priority ever inverts.

### Latency, CPU only, idle machine

| | measured |
|---|---|
| cold start — spawn → `/health` 200, warm page cache | **68–98 ms** (3 runs) |
| cold start — first ever, weights not in page cache | **~490 ms** |
| query embed, warm server, n=100 | **p50 3.6 ms · p95 4.4 ms · max 6.5 ms** |
| scan 148 vectors (naive JS `reduce`) | **0.40 ms** |
| resident memory of the running `llama-server` | **66 MB** |

The palette debounces at 200 ms and the whole semantic leg is under 5 ms of
that, so recall costs a keystroke nothing it can feel.

**A correction worth recording**, because it is the difference between an
honest number and a scary one: the first pass at these timings was taken while
a 16-core llama.cpp compile was running in the same shell, and reported 490 ms
cold start, 10 ms p50 and a 34.8 s index build. Those are contention numbers,
not the feature's. They were re-taken on an idle machine and are the table
above; the compile that polluted them is the 3 m 27 s figure in the closure
section.

### Index build and size

Corpus: this repo's own `docs/roadmap.jsonl` — 148 nodes, 188 KB of prose,
notes truncated to the model's 512-token window.

| | measured |
|---|---|
| full cold build, title + note, batch 16 | **4.48 s** (30.3 ms/node, 34 k chars/s) |
| full cold build, titles only | **0.32 s** (2.2 ms/node) |
| index in memory / on disk | **222 KiB** f32 (56 KiB if ever quantised to int8) |

Extrapolating honestly to a corpus ten times olai's own roadmap and as
essay-heavy: ~45 s of one-time background work and ~2.2 MiB of cache. A
5,000-node corpus of ordinary short notes is ~11 s. Every one of those is paid
**once**, behind the boot, incrementally thereafter — an unchanged node is
never re-embedded, across serves, because the content hash sleeps in the cache
beside the vector.

### Quality — and the floor

The point of the feature, on the corpus it will actually be used against:

```
Q: "the first page load is too heavy"          substring: 0 hits
  ≈ 0.685  load-perf        Roadmap initial load feels very slow
  ≈ 0.630  snapshot-scale   First snapshot carries every document body …

Q: "how do I undo something"                   substring: 0 hits
  ≈ 0.724  undo             Undo
  ≈ 0.664  undo-feature-flaky

Q: "talking to an AI inside the app"           substring: 0 hits
  ≈ 0.692  form-elicitation  the agent's questions render as forms
  ≈ 0.677  chat-node-context Ask the agent about this node
```

The retuning that matters: **bge-small's cosine scale is compressed**, and the
prior art's floor of `0.5` is wrong for it. Measured against four deliberately
off-topic queries (a bread recipe, the treaty of Westphalia, changing a car
tyre, APAC revenue), the *best* score any of them drew from this corpus was
**0.599**. Real rank-one hits score **0.685–0.724**. So the floor is **0.62**:
above every junk ceiling observed, below every genuine top hit. It is a
conservative bias on purpose — semantic hits only fill the room substring
leaves, so dropping a weak true positive costs a row nobody was owed, while
keeping a strong false positive costs the reader's trust in the `≈`.

Caveat stated rather than buried: that floor is tuned on one corpus, olai's
own roadmap. It is a constant in one file with the measurement written beside
it.

## Why this is GO

+196 MB of closure, ~4 ms per query, 66 MB resident, a few seconds of one-time
background indexing, and 222 KiB of cache — for a search that finds the note
you cannot name. Nothing is fetched at run time, nothing is expected to be
installed, and with the feature off the substring reading is unchanged byte
for byte. The parking verdict's condition is met on its own terms.

## Deliberately not in this pass

- **Chunking long notes.** A note is embedded as its first 512 tokens. A
  paragraph buried in a long note is not separately findable. Chunking
  multiplies the index and the ranking question both; it is a second design.
- **A second embedder behind the seam** (a configured API). The seam supports
  it; nothing here needs it.
- **Approximate nearest neighbour.** A linear scan of 148 vectors is 0.4 ms
  and of 10,000 would be ~27 ms. An index structure earns its complexity
  somewhere past that, not here.
- **macOS.** The derivation is platform-generic and `pkgs.llama-cpp` evaluates
  on `aarch64-darwin`, but nothing on this lane was built or timed there.
