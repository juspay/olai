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
its isolated watcher probe, unmodified. The clean corpus regenerates
byte-identical: 1020 files, 599568 bytes, 15 directories. (That count is the
CLEAN corpus's; the git-shaped one below has 20.)

Two things a re-runner needs, both learned from re-running this against two
independent fact-checks:

- **Descriptors are counted three ways and only one of them is stable.** A
  process's total, the subset resolving under the served root, and the number
  of DISTINCT paths among those. The store holds no duplicates, so its
  under-root count and its distinct count are the same number; a bare
  `fs.watch` in a throwaway script holds the root and each entry-bearing
  directory *twice* on this machine and not on the reviewers', which is a 13-fd
  swing on nothing that matters. So the raw comparisons below are quoted in
  **distinct watched paths**, which every run by every party agrees on, and the
  store table — the load-bearing one — is quoted as measured, where the two
  agree anyway.
- **The git-shaped corpus is a shape, not a size**, so its recipe is written
  down beside the clean one ([below](#the-git-shaped-corpus)). The totals move
  by tens if the bolt-on nests differently.

Two Bun binaries: the pinned one (`1.3.13+bf2e2cecf`, from the npins nixpkgs at
`afb4584a`) and upstream's 1.3.14 release binary (`1.3.14+0d9b296af`), run
against the same `node_modules` and the same worktree. A `file:line` names
`master` at `bb927549`, which is where this was measured; master has since
moved to `ed3b6d68` and `packages/store` is still byte-identical to it.

---

## What was measured

The isolated watcher probe from the method doc, unmodified, plus a variant that
resolves each descriptor through `/proc/$PID/fd/*` and buckets it. "under root"
counts descriptors whose target resolves inside the served directory.

| store over … | bun 1.3.13 total | under root | bun 1.3.14 total | under root |
| --- | --- | --- | --- | --- |
| clean corpus, `watch: false` | 14 | 0 | 14 | 0 |
| clean corpus, `watch: true` | **1050** | 1035 | **15** | **0** |
| git-shaped corpus, `watch: true` | **2055** | 2040 | **15** | **0** |

For the clean corpus, `1035 = 1020 files + 15 directories` — one descriptor per
*path*, not per served file, and no path held twice. Sampled at 3 s and again
at 20 s, unchanged: held, not transient, exactly as #167 reported. Flags on a
sampled descriptor are `0300000` (`O_RDONLY|O_DIRECTORY|O_LARGEFILE`) — a real
`open(2)`, not an `O_PATH` handle.

The third row is new here and is the sharper number. **The watcher opens
descriptors for the paths the store's own walk refuses to enter.** `pruned()`
(`packages/store/src/disk.ts:219`) exists because "`.git` alone is tens of
thousands of entries that no `match` can ever claim" — that is the walk's own
comment, at `disk.ts:127`. The walk stops there; the watcher does not.

The arithmetic is exact and worth doing rather than eyeballing: `2040 − 1035 =
**1005**`, which is precisely what the recipe below bolts on — 1000 files plus
the 5 directories holding them. **1000 of those descriptors are on files olai
has already decided it will never read**, and every one of the 1005 is on a
path `pruned()` refuses. So the cost is not O(served corpus). It is O(every
path under the root), and a served directory is somebody's working tree by
design.

For scale: the same measurement under Node 24.18.1 costs **1** descriptor for
the whole recursive watch — `before=21 after=22`, none under the root, because
libuv keeps one inotify instance per loop and inotify watch descriptors are not
file descriptors. Bun 1.3.14 costs 1 as well. That is what the number is
supposed to look like, and both fixed runtimes land on it.

### The git-shaped corpus

The clean corpus is the method doc's, unchanged. The git-shaped one is that
tree plus a working-tree bolt-on, and it is written out because the totals are
sensitive to how it nests — a flat 500 + 500 lands on a nearby but different
triple:

```sh
cp -r corpus corpus-git
mkdir -p corpus-git/.git/objects/ab corpus-git/node_modules/pkg
for i in $(seq 1 500); do echo x > corpus-git/.git/objects/ab/obj-$i; done
for i in $(seq 1 500); do echo x > corpus-git/node_modules/pkg/f-$i.js; done
```

2020 files in 20 directories; the bolt-on contributes 1000 files and 5
directories (`.git`, `.git/objects`, `.git/objects/ab`, `node_modules`,
`node_modules/pkg`) — the 1005 above.

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

2. **effect** — `@effect/platform-node-shared/src/NodeFileSystem.ts:634`
   resolves `FileSystem.WatchBackend` as a `serviceOption`; the `watch`
   function at `:598` falls back at `:607` to `watchNode` (`:553`), which is
   `node:fs.watch` with `recursive` passed through. `@effect/platform-node`
   ships no backend and olai provides none, so this is always the `watchNode`
   path. Effect adds no descriptors of its own.

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

| | watchers | distinct watched paths |
| --- | --- | --- |
| `fs.watch(root, { recursive: true })` | 1 | 1035 |
| one `fs.watch(dir)` per directory, non-recursive | 15 | 1035 |

Identical — the same 1020 files and 15 directories, reached either way. Bun
1.3.13 registers a descriptor for every *entry* of a watched directory whether
or not recursion was asked for: a non-recursive watch on the corpus root alone,
21 entries, already holds 22 paths (the root and each of its entries).

Skipping the pruned directories while walking (`.git`, `node_modules`) does
remove the amplification — 2040 → **1037** distinct paths on the git-shaped
corpus, the 2 left over being the root's own `.git` and `node_modules` entries,
which a watch on the root sees whether or not the walk descends into them. But
it leaves the O(corpus) core exactly where it was: on the clean corpus it is
**1035**, descriptor for descriptor what master already pays.

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
shapes, each performed in isolation with 500 ms of quiet either side, against a
recursive watch of a throwaway copy of the corpus.

One trap, caught by a fact-check and worth naming because it is the kind that
survives: the first run edited `Daily/2026/04/note-3.md` as `Daily/2026/03/…`.
The generator files note *n* under month `n % 12 + 1`, so note-3 lives in month
**04** — meaning the "in-place edit" step was silently measuring a CREATE, and
row 1 was reporting row 2's answer. The table below edits a file that provably
pre-exists (the script asserts it), and row 1 changed as a result:

| what happened | 1.3.13 | 1.3.14 |
| --- | --- | --- |
| in-place edit of an EXISTING file, 3 levels down | `change` | `change` |
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
   waiting is what master already pays: O(every path under the root)
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

- The measurement, repeated and sharpened: the cost is O(every path under the
  root) — files and directories alike — not O(served files), because the
  watcher does not honour `pruned()` (`disk.ts:219`). The `.git` of a real
  working tree is the multiplier that matters.
- A latent bug in what ships today, worth its own node whichever way the ruling
  goes: **a directory created after boot is invisible to the watcher until the
  backstop** — 1.3.13 only, fixed by the same bump, measured in the table
  above. The 60-second backstop (`DEFAULT_BACKSTOP`, `store.ts:205`, reasoned
  at `store.ts:156-161`) is what keeps it from being a
  correctness bug, which is the design earning its keep.
- No guard exists against the regression coming back. A test that asserts the
  watcher's descriptor cost is O(1) would need `/proc`, so it is Linux-only and
  would have to be skipped elsewhere — worth doing only if (2) is taken.

---

## What the fact-checks moved

Two independent reviewers (Grok 4.6, opencode kimi-k3) re-ran every
reproducible claim here. **No blocking finding, and no decision-bearing number
changed**: the store table, the identical-cost result, the blind spot and the
causal chain all reproduced. Eight corrections landed, all of them arithmetic
or citation, and all re-measured here on a freshly regenerated corpus rather
than taken on report:

| was | is | why |
| --- | --- | --- |
| per-directory pair quoted as `1050` "under root" | `1035` distinct paths, both | a total, mislabelled — and taken on a corpus two earlier probe scripts had dirtied by 2 files |
| "on the clean corpus, per-dir+pruned is 15 descriptors *worse*" | identical — `1035` either way | same mislabel; there was never a penalty |
| `1004` pruned descriptors of 2040 | `1005` paths, of which `1000` are files | `2040 − 1035`, and it matches the recipe by construction |
| in-place-edit row: 1.3.13 `rename`+`change` | `change`, same as 1.3.14 | the edited path did not exist — note-3 is in month 04, not 03. Row 1 was reporting row 2's answer |
| Node 24 costs `2` descriptors | `1` | `before`/`after` were sampled asymmetrically |
| git-corpus recipe unwritten | written out | the totals are shape-sensitive; a flat 500+500 lands elsewhere |
| "15 directories" unscoped | scoped to the clean corpus | the git-shaped one has 20 |
| root-only watch holds `23`; backstop at `store.ts:157`; `WatchBackend` at `:598` | `22` distinct; `store.ts:205`; `:634` resolves, `:607` falls back | counted duplicates as distinct paths; two citations pointed at the JSDoc rather than the value |

The duplicate-descriptor wrinkle is worth keeping, because it is why two
honest runs of the same script disagree: a bare `fs.watch` in a throwaway
script holds the root and each entry-bearing directory twice on this machine
(13 extra, persisting past 12 s) and once on both reviewers'. The store holds
no duplicates on any of the three. Counting DISTINCT paths makes every run
agree, which is why the raw comparisons above are quoted that way.
