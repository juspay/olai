# The watcher's file descriptors are not the watcher's fault

Investigation of the `watcher-fd-cost` roadmap node, 2026-08-14. The node carries PR #167's finding: the store's recursive watcher holds one open file descriptor per served file, per store, for the process's lifetime — `watch: false` → 14 fds, `watch: true` → 1050, on a 1020-file corpus.

**The finding reproduces exactly. The cause is not in olai.** It is Bun 1.3.13's `fs.watch`, which routes through Bun's internal bundler watcher and opens a real descriptor for every path under the watched root. Bun 1.3.14 rewrote that backend to talk to inotify / FSEvents / kqueue directly, and the same store over the same corpus then holds **15 descriptors, none of them under the root**.

olai's call site is already the right one, and there is no cheaper spelling of it: watching per-DIRECTORY — the obvious fix, and the one the node's own brief proposed — costs *exactly the same* on 1.3.13, measured. So the choice is not "which watcher does olai build"; it is "which Bun does olai run", and that is a pin, not a design.

> **Update, 2026-08-24 (`bun-watcher-bump`).** The human ruled: take [NixOS/nixpkgs#556047](https://github.com/NixOS/nixpkgs/pull/556047). olai overlays bun **1.4.0** (`1.4.0+34cbb9a40`) from that PR's HEAD (`d2f0dc92`, branch `bun-1.4-update` recorded so `just update-pins` follows the PR and cannot drop the bump). The rest of nixpkgs stays on `nixpkgs-unstable`. Same recipe, same corpora, this machine, this pin:
>
> | store over … | bun 1.3.13 total | under root | bun 1.4.0 total | under root |
> | --- | --- | --- | --- | --- |
> | clean corpus, `watch: false` | 17 | 0 | 13 | 0 |
> | clean corpus, `watch: true` | **1053** | 1035 | **14** | **0** |
> | git-shaped corpus, `watch: true` | **2058** | 2040 | **14** | **0** |
>
> Under-root is the load-bearing number and matches the 2026-08-14 table exactly on 1.3.13 (`0 / 1035 / 2040`); the totals sit three fds above that day's process baseline, which is not under the root. 1.4.0 is one descriptor for the watch and none under the root, git-shaped or clean. All nine mutation shapes deliver, including a file created and then edited inside a directory made after boot — those two rows were `NO EVENT` on 1.3.13. Suites at 1.4.0: unit **3593 + 77** pass / 0 fail, e2e **913** passed of 914 (the one miss is an After-hook `fetch` on a shared-scratch resync; the scenario's 15 steps passed, and it passes 3/3 in isolation). Typecheck is the repair lane's (`master-red-meta-merge`); this pin does not carry a private cure. When #556047 merges, the extra pin and the overlay drop; that re-pin is `bun-nixpkgs-catchup`, parked for the human.
>
> **Update, 2026-08-15 (`watcher-postboot-blind`).** One half of this document has since been closed in olai rather than upstream: the [new-directory blind spot](#behaviour-across-the-version-boundary) below. `packages/store/src/disk.ts` now arms a watcher on each directory the walk finds that the root's own cannot reach — measured at one descriptor per path under the new directory and none per file added to it afterwards, so a folder made post-boot costs what it would have cost at boot, and a store over a tree that gains no directories is descriptor-for-descriptor what the table below reports. **Everything the ruling turns on is unchanged**: the cost is still O(every path under the root), the bump is still the only thing that moves it, and the recommendation at the end still stands.
>
> Two measurements were added on the way, both arguing the same direction as the rest of this document. The pinned runtime's watch registry is keyed **by path, process-wide, and it is sticky**: closing a watcher does not give its descriptors back, and a path that has been watched once, removed, and made again can never be armed again — no spelling of it gets a live watcher. So a directory that leaves and returns is still the backstop's to catch, and that residue is named in `disk.ts` where it lives.

---

## Reading the receipts

Every number below was taken on this machine — Linux 7.1.5 `x86_64`, `ulimit -n` 524288 — with the method written out verbatim in [surface-mcp-positions.md](./surface-mcp-positions.md#how-it-was-measured): that document's corpus generator, its `/proc/$PID/fd` sampler (never `ps`), and its isolated watcher probe, unmodified. The clean corpus regenerates byte-identical: 1020 files, 599568 bytes, 15 directories. (That count is the CLEAN corpus's; the git-shaped one below has 20.)

Two things a re-runner needs, both learned from re-running this against two independent fact-checks:

- **Descriptors are counted three ways and only one of them is stable.** A process's total, the subset resolving under the served root, and the number of DISTINCT paths among those. The store holds no duplicates, so its under-root count and its distinct count are the same number; a bare `fs.watch` in a throwaway script holds the root and each entry-bearing directory *twice* on this machine and not on the reviewers', which is a 13-fd swing on nothing that matters. So the raw comparisons below are quoted in **distinct watched paths**, which every run by every party agrees on, and the store table — the load-bearing one — is quoted as measured, where the two agree anyway.
- **The git-shaped corpus is a shape, not a size**, so its recipe is written down beside the clean one ([below](#the-git-shaped-corpus)). The totals move by tens if the bolt-on nests differently.

Two Bun binaries on 2026-08-14: the then-pinned one (`1.3.13+bf2e2cecf`, from the npins nixpkgs at `afb4584a`) and upstream's 1.3.14 release binary (`1.3.14+0d9b296af`), run against the same `node_modules` and the same worktree. A `file:line` names `master` at `bb927549`, which is where this was measured; master has since moved. The 2026-08-24 re-measure uses the same recipe on this machine against `1.3.13+bf2e2cecf` (still that nixpkgs) and the overlayed `1.4.0+34cbb9a40` from NixOS/nixpkgs#556047.

---

## What was measured

The isolated watcher probe from the method doc, unmodified, plus a variant that resolves each descriptor through `/proc/$PID/fd/*` and buckets it. "under root" counts descriptors whose target resolves inside the served directory.

| store over … | bun 1.3.13 total | under root | bun 1.3.14 total | under root |
| --- | --- | --- | --- | --- |
| clean corpus, `watch: false` | 14 | 0 | 14 | 0 |
| clean corpus, `watch: true` | **1050** | 1035 | **15** | **0** |
| git-shaped corpus, `watch: true` | **2055** | 2040 | **15** | **0** |

For the clean corpus, `1035 = 1020 files + 15 directories` — one descriptor per *path*, not per served file, and no path held twice. Sampled at 3 s and again at 20 s, unchanged: held, not transient, exactly as #167 reported. Flags on a sampled descriptor are `0300000` (`O_RDONLY|O_DIRECTORY|O_LARGEFILE`) — a real `open(2)`, not an `O_PATH` handle.

The third row is new here and is the sharper number. **The watcher opens descriptors for the paths the store's own walk refuses to enter.** `pruned()` (`packages/store/src/disk.ts:219`) exists because "`.git` alone is tens of thousands of entries that no `match` can ever claim" — that is the walk's own comment, at `disk.ts:127`. The walk stops there; the watcher does not.

The arithmetic is exact and worth doing rather than eyeballing: `2040 − 1035 = **1005**`, which is precisely what the recipe below bolts on — 1000 files plus the 5 directories holding them. **1000 of those descriptors are on files olai has already decided it will never read**, and every one of the 1005 is on a path `pruned()` refuses. So the cost is not O(served corpus). It is O(every path under the root), and a served directory is somebody's working tree by design.

For scale: the same measurement under Node 24.18.1 costs **1** descriptor for the whole recursive watch — `before=21 after=22`, none under the root, because libuv keeps one inotify instance per loop and inotify watch descriptors are not file descriptors. Bun 1.3.14 costs 1 as well. That is what the number is supposed to look like, and both fixed runtimes land on it.

### The git-shaped corpus

The clean corpus is the method doc's, unchanged. The git-shaped one is that tree plus a working-tree bolt-on, and it is written out because the totals are sensitive to how it nests — a flat 500 + 500 lands on a nearby but different triple:

```sh
cp -r corpus corpus-git
mkdir -p corpus-git/.git/objects/ab corpus-git/node_modules/pkg
for i in $(seq 1 500); do echo x > corpus-git/.git/objects/ab/obj-$i; done
for i in $(seq 1 500); do echo x > corpus-git/node_modules/pkg/f-$i.js; done
```

2020 files in 20 directories; the bolt-on contributes 1000 files and 5 directories (`.git`, `.git/objects`, `.git/objects/ab`, `node_modules`, `node_modules/pkg`) — the 1005 above.

---

## Where it comes from, verb by verb

Three layers, and only the third is doing anything wrong.

1. **olai** — `packages/store/src/disk.ts:180`: `fs.watch(root, { recursive: true })`, mapped to `Stream<void>` with the event payload dropped at the edge on purpose (`disk.ts:80-85`: "An event means 'probe soon' and the probe is what decides what happened"). One watcher per store; one store per process (`packages/server/src/directory.ts:40`, the single `Store.make` call site outside tests, shared by `olai web` and `olai mcp`). Nothing here holds a descriptor, and nothing here can close one.

2. **effect** — `@effect/platform-node-shared/src/NodeFileSystem.ts:634` resolves `FileSystem.WatchBackend` as a `serviceOption`; the `watch` function at `:598` falls back at `:607` to `watchNode` (`:553`), which is `node:fs.watch` with `recursive` passed through. `@effect/platform-node` ships no backend and olai provides none, so this is always the `watchNode` path. Effect adds no descriptors of its own.

3. **Bun 1.3.13** — `node:fs.watch` is Bun's own implementation. It opens one descriptor per watched path. Upstream's 1.3.14 notes say why, in as many words: *"Bun's `fs.watch()` implementation on POSIX platforms has been completely rewritten to talk directly to the OS file-watching APIs (inotify, FSEvents, kqueue) instead of routing through Bun's internal bundler watcher."* A bundler watcher needs a descriptor per module; a file watcher does not, and inotify never did.

---

## The fix that was proposed, and why it is not one

The node's brief named per-directory watching as the likely small fix — an inotify-style recursive watch *should* be per-directory on Linux. It is not small, because on 1.3.13 it is not a fix at all. Raw `fs.watch`, same corpus, descriptors resolving under the root:

| | watchers | distinct watched paths |
| --- | --- | --- |
| `fs.watch(root, { recursive: true })` | 1 | 1035 |
| one `fs.watch(dir)` per directory, non-recursive | 15 | 1035 |

Identical — the same 1020 files and 15 directories, reached either way. Bun 1.3.13 registers a descriptor for every *entry* of a watched directory whether or not recursion was asked for: a non-recursive watch on the corpus root alone, 21 entries, already holds 22 paths (the root and each of its entries).

Skipping the pruned directories while walking (`.git`, `node_modules`) does remove the amplification — 2040 → **1037** distinct paths on the git-shaped corpus, the 2 left over being the root's own `.git` and `node_modules` entries, which a watch on the root sees whether or not the walk descends into them. But it leaves the O(corpus) core exactly where it was: on the clean corpus it is **1035**, descriptor for descriptor what master already pays.

The other two spellings the node offered fare no better. **Closing per-file handles** is not available: the descriptors belong to Bun's watcher, and olai never sees one. **Deduplicating watchers** is already done: there is exactly one watcher per process, and it is `directory.ts:40` that guarantees it.

Building the per-directory walker anyway would mean new state in `disk.ts` — the watcher set, maintained as directories appear and vanish — to remove half the cost, and it would be dead code the day the runtime moves. Which is the recommendation against it.

---

## The platform trap, checked

The brief asked whether the per-file cost is inherent to some platform's watch backend, so that a Linux-only fix would silently change macOS. It is not, and the direction is the reassuring one: 1.3.14's rewrite is explicitly *"on Linux, macOS, and FreeBSD"*, and its macOS half "eliminated redundant watcher threads". Both platforms move the same way, for the same reason, in the same release. No divergence to hide.

What a per-directory rewrite in olai would have hit is the trap in its other form: a kqueue watch on a directory reports entries appearing and vanishing but NOT content changes to the files inside it, so the same code would have been correct on inotify and lossy on Darwin. Another reason it was not built.

---

## Behaviour, across the version boundary

A bump is only worth proposing if the watcher still behaves. Nine mutation shapes, each performed in isolation with 500 ms of quiet either side, against a recursive watch of a throwaway copy of the corpus.

One trap, caught by a fact-check and worth naming because it is the kind that survives: the first run edited `Daily/2026/04/note-3.md` as `Daily/2026/03/…`. The generator files note *n* under month `n % 12 + 1`, so note-3 lives in month **04** — meaning the "in-place edit" step was silently measuring a CREATE, and row 1 was reporting row 2's answer. The table below edits a file that provably pre-exists (the script asserts it), and row 1 changed as a result.

The script, run under the pinned bun against a throwaway copy of the corpus (`bun mutations.ts /path/to/copy`):

```ts
import * as fs from "node:fs"
import * as path from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

const root = path.resolve(process.argv[2]!)
type Ev = { t: number; event: string; filename: string | null }
const events: Ev[] = []
const t0 = Date.now()
const watcher = fs.watch(root, { recursive: true }, (event, filename) => {
  events.push({
    t: Date.now() - t0,
    event,
    filename: filename == null ? null : String(filename),
  })
})
const quiet = 500
const log = (label: string) => {
  const slice = events.splice(0)
  console.log(`--- ${label} ---`)
  if (slice.length === 0) console.log("NO EVENT")
  else for (const e of slice) console.log(`${e.t}ms ${e.event} ${e.filename}`)
}
console.log(`bun=${Bun.version} root=${root}`)
await sleep(quiet)
events.length = 0

const existing = path.join(root, "Daily/2026/04/note-3.md")
if (!fs.existsSync(existing)) throw new Error(`missing ${existing}`)
fs.appendFileSync(existing, "\nedited in place\n")
await sleep(quiet)
log("1 in-place edit of EXISTING file, 3 levels down")

const created = path.join(root, "Daily/2026/04/created-fresh.md")
fs.writeFileSync(created, "created by write\n")
await sleep(quiet)
log("2 create by write, 3 levels down")

fs.appendFileSync(created, "edited again\n")
await sleep(quiet)
log("3 edit that file again")

fs.unlinkSync(created)
await sleep(quiet)
log("4 delete it")

const src = path.join(root, "rename-src.md")
const dest = path.join(root, "Daily/2026/04/renamed.md")
fs.writeFileSync(src, "to be renamed\n")
await sleep(quiet)
events.length = 0
fs.renameSync(src, dest)
await sleep(quiet)
log("5 create by rename into a nested dir")

fs.appendFileSync(dest, "edited after rename\n")
await sleep(quiet)
log("6 edit the rename-published file")

const sub = path.join(root, "post-boot-dir")
fs.mkdirSync(sub)
await sleep(quiet)
log("7 mkdir a new subdirectory")

const inner = path.join(sub, "inside.md")
fs.writeFileSync(inner, "inside new dir\n")
await sleep(quiet)
log("8 create a file inside that new subdirectory")

fs.appendFileSync(inner, "edited inside\n")
await sleep(quiet)
log("9 edit the file inside that new subdirectory")
watcher.close()
```

| what happened | 1.3.13 | 1.3.14 | 1.4.0 (this pin) |
| --- | --- | --- | --- |
| in-place edit of an EXISTING file, 3 levels down | `change` | `change` | `change` |
| create by write, 3 levels down | `rename` + `change` | `rename` | `rename` + `change` |
| edit that file again | `change` | `change` | `change` |
| delete it | `rename` | `rename` | `rename` |
| create by rename into a nested dir | `rename` (destination) | `rename` (source) | `rename` (source) + `rename` (destination) |
| edit the rename-published file | `change` | `change` | `change` |
| `mkdir` a new subdirectory | `rename` | `rename` | `rename` |
| create a file inside that new subdirectory | **NO EVENT** | `rename` | `rename` + `change` |
| edit the file inside that new subdirectory | **NO EVENT** | `change` | `change` |

Every row delivers at least one event on 1.3.14 and on 1.4.0, and the two rows that deliver nothing at all are on 1.3.13. That was a live bug in what olai shipped the day this was written: **a directory created after the store started is invisible to the watcher until the 60-second backstop sweeps it.** Make a new folder in the vault, put a note in it, and the browser does not move for up to a minute. (Closed in-tree on 2026-08-15 under its own node — see the [2026-08-15 update](#the-watchers-file-descriptors-are-not-the-watchers-fault). Closed at the runtime on 2026-08-24 by the 1.4.0 pin: rows 8 and 9 fire without the backstop.) 1.4.0 is not byte-identical to the 1.3.14 event names (create-by-write and post-boot create also emit `change`; create-by-rename names both paths); the payload is still dropped at the edge, so one event either way is one probe.

The one row where the versions disagree in substance — create-by-rename, where 1.3.13 names the destination and 1.3.14 names the source — costs olai nothing, and `disk.ts:80-85` is why: the payload is dropped at the edge and an event means only "probe soon". One event either way, one probe either way, and the probe is what decides what happened. The payload-free contract, written for inotify overflow and FSEvents coalescing, turns out to have absorbed a backend rewrite too.

The suite agrees: `bun test` is **1597 pass / 0 fail** on both binaries, including the store's watcher tests (`packages/store/src/store.test.ts:529-585` — the burst-coalescing test and the backstop test). Same count, same files.

---

## The ask

The fix is one line of Nix and no lines of TypeScript, and it is still not the author's call, because the line is the runtime.

**What it would take.** nixpkgs shipped bun 1.3.13 on both `master` and `nixpkgs-unstable` as of 2026-08-14, so `just update-pins` did **not** reach 1.3.14; the bump PR then was NixOS/nixpkgs#519796. The PR that actually landed the binary is NixOS/nixpkgs#556047 (1.3.13 → 1.4.0), taken on 2026-08-24 as an overlay over the existing nixpkgs pin — see the update at the top. The day that PR merges, the overlay and the extra pin drop (`bun-nixpkgs-catchup`).

**Blast radius.** Every leg of `just check`, because bun is the runtime for all of them: `typecheck`, `test`, `e2e`, the `nix` build and its packaged binary. The unit suite is proven equal on this machine (1597/0, both binaries); the nix-built binary and the e2e leg are not, because they would need the override to exist first. And an override must pin release hashes for `aarch64-darwin` and `x86_64-darwin` alongside Linux's — hashes this lane cannot verify, on the platform the CI rule skips.

**The alternatives, ranked and priced.**

1. **Wait for nixpkgs.** Zero risk, zero work, unknown date. The cost of waiting is what master already pays: O(every path under the root) descriptors per store, doubled across `olai web` + `olai mcp`, plus the new-directory blind spot above. At a 1020-file vault that is 2099 descriptors and nothing notices. At tens of thousands it meets `ulimit -n`, and it meets it twice as fast with two stores.
2. **Carry a bun override now.** Buys 1050 → 15 and fixes the blind spot, at the price of a runtime forked from nixpkgs and darwin hashes taken on faith.
3. **Build the per-directory watcher.** Measured above: halves the git-shaped case, leaves O(corpus) standing, adds state to `disk.ts`, obsolete on the next runtime bump. Not recommended, and this is the option the node's brief assumed existed.
4. **Poll instead of watch.** Changes latency and granularity — the thing the ruling forbade — and trades descriptors for an O(corpus) stat storm on a clock.

The bridge in [surface-mcp-positions.md](./surface-mcp-positions.md) is worth naming beside these: it halves the count by collapsing two stores into one, and it is orthogonal to all four. Halving O(corpus) is still O(corpus).

**Recommendation (2026-08-14): (1), with (2) held ready.** Taken as (2) on 2026-08-24, once NixOS/nixpkgs#556047 existed to consume: see the update at the top. The residue this bump does not close is still a directory removed and made again under a path that has been watched before — the backstop's, named in `disk.ts`.

---

## What this node still owns

- ~~The measurement, repeated and sharpened: the cost is O(every path under the root) — files and directories alike — not O(served files), because the watcher does not honour `pruned()` (`disk.ts:219`). The `.git` of a real working tree is the multiplier that matters.~~ Closed by the 1.4.0 pin: same recipe, git-shaped corpus, **14** total / **0** under the root. The measurement stays as the receipt.
- ~~A latent bug in what ships today, worth its own node whichever way the ruling goes: **a directory created after boot is invisible to the watcher until the backstop** — 1.3.13 only, fixed by the same bump, measured in the table above.~~ It got its own node (`watcher-postboot-blind`) and was fixed in-tree on 2026-08-15 without touching the pin — see the 2026-08-15 update. Closed at the runtime on 2026-08-24. The 60-second backstop (`DEFAULT_BACKSTOP`, `store.ts:205`, reasoned at `store.ts:156-161`) is what kept it from being a correctness bug in the meantime, and it is still what covers a directory removed and made again under a path that has been watched before (measured on 1.3.13; not re-probed on 1.4.0).
- The follow-up `bun-nixpkgs-catchup`: when NixOS/nixpkgs#556047 merges, drop the `nixpkgs-bun` pin and the overlay in `nix/nixpkgs.nix`; bun then comes from `nixpkgs-unstable` at the merge commit. Parked for the human.
- No guard exists against the fd regression coming back. A test that asserts O(1) would need `/proc` (Linux-only). The receipt is the measurement in this document, re-runnable from the recipe; a skip-everywhere-but-Linux case was not added.

---

## What the fact-checks moved

Two independent reviewers (Grok 4.6, opencode kimi-k3) re-ran every reproducible claim here. **No blocking finding, and no decision-bearing number changed**: the store table, the identical-cost result, the blind spot and the causal chain all reproduced. Eight corrections landed, all of them arithmetic or citation, and all re-measured here on a freshly regenerated corpus rather than taken on report:

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

The duplicate-descriptor wrinkle is worth keeping, because it is why two honest runs of the same script disagree: a bare `fs.watch` in a throwaway script holds the root and each entry-bearing directory twice on this machine (13 extra, persisting past 12 s) and once on both reviewers'. The store holds no duplicates on any of the three. Counting DISTINCT paths makes every run agree, which is why the raw comparisons above are quoted that way.
