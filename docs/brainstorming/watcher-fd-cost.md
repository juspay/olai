# The watcher's file descriptors are not the watcher's fault

Investigation of the `watcher-fd-cost` roadmap node, 2026-08-14. The node
carries PR #167's finding: the store's recursive watcher holds one open file
descriptor per served file, per store, for the process's lifetime — `watch:
false` → 14 fds, `watch: true` → 1050, on a 1020-file corpus.

**The finding reproduces exactly. The cause is not in olai.** It is Bun
1.3.13's `fs.watch`, which routes through Bun's internal bundler watcher and
opens a real descriptor for every path under the watched root. Bun 1.3.14
rewrote that backend to talk to inotify / FSEvents / kqueue directly, and the
same store over the same corpus then holds **15 descriptors, none of them
under the root**.

olai's call site is already the right one, and there is no cheaper spelling of
it: watching per-DIRECTORY — the obvious fix, and the one the node's own brief
proposed — costs *exactly the same* on 1.3.13, measured. So the choice is not
"which watcher does olai build"; it is "which Bun does olai run", and that is a
pin, not a design. **Nothing landed. The ruling belongs to the human**; the
decision and its blast radius are [at the end](#the-ask).

---

## Reading the receipts

Every number below was taken on this machine — Linux 7.1.5 `x86_64`, `ulimit
-n` 524288 — with the method written out verbatim in
[surface-mcp-positions.md](./surface-mcp-positions.md#how-it-was-measured):
that document's corpus generator, its `/proc/$PID/fd` sampler (never `ps`), and
its isolated watcher probe, unmodified. The corpus regenerates byte-identical:
1020 files, 599568 bytes, 15 directories.

Two Bun binaries: the pinned one (`1.3.13+bf2e2cecf`, from the npins nixpkgs at
`afb4584a`) and upstream's 1.3.14 release binary, run against the same
`node_modules` and the same worktree. A `file:line` names `master` at
`bb927549`, where `packages/store` is byte-identical to `origin/master`.

---

## What was measured

The isolated watcher probe from the method doc, unmodified, plus a variant that
resolves each descriptor through `/proc/$PID/fd/*` and buckets it. "under root"
counts descriptors whose target resolves inside the served directory.

| store over … | bun 1.3.13 total | under root | bun 1.3.14 total | under root |
| --- | --- | --- | --- | --- |
| corpus, `watch: false` | 14 | 0 | 14 | 0 |
| corpus, `watch: true` | **1050** | 1035 | **15** | **0** |
| corpus + `.git` + `node_modules`, `watch: true` | **2055** | 2040 | **15** | **0** |

`1035 = 1020 files + 15 directories` — one descriptor per *path*, not per
served file. Sampled at 2 s and again at 20 s, unchanged: held, not transient,
exactly as #167 reported. Flags on a sampled descriptor are `0300000`
(`O_RDONLY|O_DIRECTORY|O_LARGEFILE`) — a real `open(2)`, not an `O_PATH`
handle.

The third row is new here and is the sharper number. **The watcher opens
descriptors for the paths the store's own walk refuses to enter.** `pruned()`
(`packages/store/src/disk.ts:219`) exists because "`.git` alone is tens of
thousands of entries that no `match` can ever claim" — that is the walk's own
comment, at `disk.ts:127`. The walk stops there; the watcher does not. On a
corpus with a 500-entry `.git` and a 500-entry `node_modules` bolted on, 1004
of the 2040 descriptors are on files olai has decided it will never read. So
the cost is not O(served corpus). It is O(every file under the root), and a
served directory is somebody's working tree by design.

For scale: the same measurement under Node 24 costs **2** descriptors for the
whole recursive watch, because libuv keeps one inotify instance per loop and
inotify watch descriptors are not file descriptors. That is what the number is
supposed to look like.

---

## Where it comes from, verb by verb

Three layers, and only the third is doing anything wrong.

1. **olai** — `packages/store/src/disk.ts:180`:
   `fs.watch(root, { recursive: true })`, mapped to `Stream<void>` with the
   event payload dropped at the edge on purpose (`disk.ts:80-85`: "An event
   means 'probe soon' and the probe is what decides what happened"). One
   watcher per store; one store per process (`packages/server/src/directory.ts:40`,
   the single `Store.make` call site outside tests, shared by `olai web` and
   `olai mcp`). Nothing here holds a descriptor, and nothing here can close
   one.

2. **effect** — `@effect/platform-node-shared/src/NodeFileSystem.ts:598`
   resolves `FileSystem.WatchBackend` from the context and falls back to
   `watchNode` (`:553`), which is `node:fs.watch` with `recursive` passed
   through. `@effect/platform-node` ships no backend and olai provides none, so
   this is always the `watchNode` path. Effect adds no descriptors of its own.

3. **Bun 1.3.13** — `node:fs.watch` is Bun's own implementation. It opens one
   descriptor per watched path. Upstream's 1.3.14 notes say why, in as many
   words: *"Bun's `fs.watch()` implementation on POSIX platforms has been
   completely rewritten to talk directly to the OS file-watching APIs
   (inotify, FSEvents, kqueue) instead of routing through Bun's internal
   bundler watcher."* A bundler watcher needs a descriptor per module; a file
   watcher does not, and inotify never did.

---

## The fix that was proposed, and why it is not one

The node's brief named per-directory watching as the likely small fix — an
inotify-style recursive watch *should* be per-directory on Linux. It is not
small, because on 1.3.13 it is not a fix at all. Raw `fs.watch`, same corpus,
descriptors resolving under the root:

| | watchers | under root |
| --- | --- | --- |
| `fs.watch(root, { recursive: true })` | 1 | 1050 |
| one `fs.watch(dir)` per directory, non-recursive | 15 | 1050 |

Identical. Bun 1.3.13 registers a descriptor for every *entry* of a watched
directory whether or not recursion was asked for — a non-recursive watch on the
corpus root alone, 21 entries, already holds 23. Skipping the pruned
directories while walking (`.git`, `node_modules`) does remove that
amplification — 2040 → 1050 on the git-shaped corpus — but leaves the O(corpus)
core untouched, and on the clean corpus it is 15 descriptors *worse* than what
master does today.

The other two spellings the node offered fare no better. **Closing per-file
handles** is not available: the descriptors belong to Bun's watcher, and olai
never sees one. **Deduplicating watchers** is already done: there is exactly
one watcher per process, and it is `directory.ts:40` that guarantees it.

Building the per-directory walker anyway would mean new state in `disk.ts` —
the watcher set, maintained as directories appear and vanish — to remove half
the cost, and it would be dead code the day the runtime moves. Which is the
recommendation against it.

---

## The platform trap, checked

The brief asked whether the per-file cost is inherent to some platform's watch
backend, so that a Linux-only fix would silently change macOS. It is not, and
the direction is the reassuring one: 1.3.14's rewrite is explicitly *"on Linux,
macOS, and FreeBSD"*, and its macOS half "eliminated redundant watcher
threads". Both platforms move the same way, for the same reason, in the same
release. No divergence to hide.

What a per-directory rewrite in olai would have hit is the trap in its other
form: a kqueue watch on a directory reports entries appearing and vanishing but
NOT content changes to the files inside it, so the same code would have been
correct on inotify and lossy on Darwin. Another reason it was not built.

---

## Behaviour, across the version boundary

A bump is only worth proposing if the watcher still behaves. Nine mutation
shapes, each performed in isolation with 400 ms of quiet either side, against a
recursive watch of the corpus:

| what happened | 1.3.13 | 1.3.14 |
| --- | --- | --- |
| in-place edit, 3 levels down | `rename` + `change` | `change` |
| create by write, 3 levels down | `rename` + `change` | `rename` |
| edit that file again | `change` | `change` |
| delete it | `rename` | `rename` |
| create by rename into a nested dir | `rename` (destination) | `rename` (source) |
| edit the rename-published file | `change` | `change` |
| `mkdir` a new subdirectory | `rename` | `rename` |
| create a file inside that new subdirectory | **NO EVENT** | `rename` |
| edit the file inside that new subdirectory | **NO EVENT** | `change` |

Every row delivers at least one event on 1.3.14, and the two rows that deliver
nothing at all are on the *pinned* version. That is a live bug in what olai
ships today: **a directory created after the store started is invisible to the
watcher until the 60-second backstop sweeps it.** Make a new folder in the
vault, put a note in it, and the browser does not move for up to a minute.

The one row where the versions disagree in substance — create-by-rename, where
1.3.13 names the destination and 1.3.14 names the source — costs olai nothing,
and `disk.ts:80-85` is why: the payload is dropped at the edge and an event
means only "probe soon". One event either way, one probe either way, and the
probe is what decides what happened. The payload-free contract, written for
inotify overflow and FSEvents coalescing, turns out to have absorbed a backend
rewrite too.

The suite agrees: `bun test` is **1597 pass / 0 fail** on both binaries,
including the store's watcher tests (`packages/store/src/store.test.ts:529-585`
— the burst-coalescing test and the backstop test). Same count, same files.

---

## The ask

The fix is one line of Nix and no lines of TypeScript, and it is still not the
author's call, because the line is the runtime.

**What it would take.** nixpkgs ships bun 1.3.13 on both `master` and
`nixpkgs-unstable` as of this writing, so `just update-pins` does **not** reach
1.3.14; the bump PR (NixOS/nixpkgs#519796) has been open and conflicting since
2026-05-13. Landing this today therefore means carrying a bun override in
`nix/` — a hand-maintained runtime pin, reverted the day nixpkgs catches up.

**Blast radius.** Every leg of `just check`, because bun is the runtime for all
of them: `typecheck`, `test`, `e2e`, the `nix` build and its packaged binary.
The unit suite is proven equal on this machine (1597/0, both binaries); the
nix-built binary and the e2e leg are not, because they would need the override
to exist first. And an override must pin release hashes for
`aarch64-darwin` and `x86_64-darwin` alongside Linux's — hashes this lane
cannot verify, on the platform the CI rule skips.

**The alternatives, ranked and priced.**

1. **Wait for nixpkgs.** Zero risk, zero work, unknown date. The cost of
   waiting is what master already pays: O(every file under the root)
   descriptors per store, doubled across `olai web` + `olai mcp`, plus the
   new-directory blind spot above. At a 1020-file vault that is 2099
   descriptors and nothing notices. At tens of thousands it meets `ulimit -n`,
   and it meets it twice as fast with two stores.
2. **Carry a bun override now.** Buys 1050 → 15 and fixes the blind spot, at
   the price of a runtime forked from nixpkgs and darwin hashes taken on faith.
3. **Build the per-directory watcher.** Measured above: halves the git-shaped
   case, leaves O(corpus) standing, adds state to `disk.ts`, obsolete on the
   next runtime bump. Not recommended, and this is the option the node's brief
   assumed existed.
4. **Poll instead of watch.** Changes latency and granularity — the thing the
   ruling forbade — and trades descriptors for an O(corpus) stat storm on a
   clock.

The bridge in [surface-mcp-positions.md](./surface-mcp-positions.md) is worth
naming beside these: it halves the count by collapsing two stores into one, and
it is orthogonal to all four. Halving O(corpus) is still O(corpus).

**Recommendation: (1), with (2) held ready.** The pressure is real but not
urgent, the fix is upstream and already written, and a forked runtime is a
worse thing to carry than a known number. Revisit when nixpkgs moves — or
sooner, if a real vault meets its limit first, at which point (2) is the answer
and this document is the evidence.

---

## What this node still owns

- The measurement, repeated and sharpened: the cost is O(every file under the
  root), not O(served files), because the watcher does not honour `pruned()`
  (`disk.ts:219`). The `.git` of a real working tree is the multiplier that
  matters.
- A latent bug in what ships today, worth its own node whichever way the ruling
  goes: **a directory created after boot is invisible to the watcher until the
  backstop** — 1.3.13 only, fixed by the same bump, measured in the table
  above. The 60-second backstop (`store.ts:157`) is what keeps it from being a
  correctness bug, which is the design earning its keep.
- No guard exists against the regression coming back. A test that asserts the
  watcher's descriptor cost is O(1) would need `/proc`, so it is Linux-only and
  would have to be skipped elsewhere — worth doing only if (2) is taken.
