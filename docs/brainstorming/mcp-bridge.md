# What the bridge actually cost, and what it actually bought

The `mcp-bridge` node was deferred with a price attached rather than shrugged at
— 418 MB and 2099 open descriptors for two olai processes on a 1020-file vault,
measured in [surface-mcp-positions.md](./surface-mcp-positions.md) (c). This is
the same measurement taken again on both sides of the change, because a price
quoted once is a claim and a price quoted twice is a receipt.

**The headline is that one of the two numbers did not move, and the audit's
reading of it was wrong.** The descriptors halve and the second parse goes away
entirely; memory drops by about 2% of the pair, which is barely outside the
noise. What follows says why, and the experiment that settles it takes ten
seconds to repeat.

---

## The table

Same machine, same corpus, both binaries `nix build .#olai` — master at
`4d3ecff4` for the two-store row, this branch for the attached one. Linux,
`x86_64`, `ulimit -n` 524288. `OLAI_ACP_AGENT=` on every process, so the numbers
are the store and the surface and nothing else.

| | master: two stores | this branch: attached |
| --- | --- | --- |
| `olai web` RSS | 215.9 MiB | 223.1 MiB |
| `olai mcp` RSS | 225.8 MiB | **208.3 MiB** |
| **together** | **441.7 MiB** | **431.5 MiB** |
| `olai web` open fds | 1063 | 1065 |
| `olai mcp` open fds | 1062 | **14** |
| **together** | **2125** | **1079** (−49%) |
| of those, one per served file | 1048 + 1048 | 1048 + **0** |
| read + parse + validate, per revision | twice, on two clocks | **once** |

Re-sampled six seconds later and unchanged, which is the point about the
descriptors: they are HELD, not transient.

**Read the memory column with its noise**, because it is the smaller number of
the two and the honest way to report it. RSS moves a few MiB between runs of the
same binary — a second pass of both rows put master at 444.5 MiB together and
this branch at 430.2 — so the WEB row's apparent 7 MiB rise is nothing, and the
only figure that survives repetition is the `olai mcp` process being **~15 MiB
lighter** when it holds no store. The descriptor column has no such spread: it
is 1062 or it is 14.

The audit's own numbers on its own machine were 209 MB and 1050 fds per process.
The absolute memory differs (a different machine, a later Bun); the SHAPE is
identical, which is what the comparison rests on.

## Why memory barely moved, and why that is not a disappointment

The obvious reading of "418 MB for two processes" is that a store over a
thousand files is expensive and a second one doubles it. It is not, and the
cheapest experiment says so: an `olai mcp` over an **empty directory** — no
outlines, no documents, nothing to watch — is already most of it.

**Sampled at three points on the warmth curve**, because "how warm" is the
obvious way a single figure here could mislead, and a reviewer said so. Same
`/proc` sampler, same 8 s, same empty directory; the only difference is how many
frames the session had answered first:

| the session had | RSS | fds |
| --- | --- | --- |
| **cold** — no frames at all, stdin held open | 210.1 MiB | 15 |
| **handshaken** — one `initialize` | 215.3 MiB | 15 |
| **driven** — `initialize`, `tools/list`, a tool call, a resource read | 213.8 MiB | 15 |

Warmth is worth about **5 MiB** and the descriptors do not move at all. So the
number is not a warm-sample artefact, and it is not precise either: two
independent re-measures during review came in at 209.0 MiB and 194 MiB on other
machines. All of them are the same finding — **the floor is around 200 MiB and
it is the interpreter**, the Bun runtime plus the module graph (effect, the MCP
SDK, the hydrated `@kolu/*` sources). The 1020-file corpus adds roughly 13 MiB
of heap on top of that.

Attaching retires the corpus's share and cannot touch the interpreter's, because
an attached process is still a process: it still loads effect, the MCP SDK and
the surface.

That is worth stating plainly rather than quietly reporting a 2% win, because it
corrects what the number was ever evidence FOR. **The second store was never
mostly a memory cost.** It was a descriptor cost, a parse cost, and a
consistency cost, and those are the three that moved.

## What actually moved

**Descriptors — halved, and the halving is the whole 1048.** The recursive
watcher holds one open descriptor per served file for the process's lifetime
(`watcher-fd-cost`, which is `@olai/store`'s problem and not MCP's). An attached
session opens no store, so it holds none: 14 descriptors, none of them under the
corpus. At 1020 files nothing on a modern Linux notices 2125; at the tens of
thousands a real vault reaches it is the number that meets `ulimit -n` first,
and it met it twice as fast.

**The second parse — gone.** Each store re-reads and re-validates the whole set
on every trigger and on its own 60-second backstop, so a directory being edited
paid for two parses of everything. One store, one parse. This is structural
rather than sampled: the attached process holds no descriptor under the corpus,
which is the same fact from the other end.

**The skew — gone, and this is the correctness-shaped one.** Two stores are at
different revisions between probes, so an agent reading a node through `olai mcp`
and a person looking at the same row in a browser could be seconds apart with no
revision either could compare to notice. Nothing broke — the write gate handles
it — but "the same live rows the browser draws", which is `surface-mcp`'s own
promise, was true only up to that skew. Attached, there is one store and one
revision, so it is true without qualification.

## How it was measured

The corpus generator is [the audit's](./surface-mcp-positions.md#how-it-was-measured),
unchanged and byte-for-byte reproduced: 1000 `.md` in a `Daily/YYYY/MM/` shape
plus 20 outlines of 100 nodes, 1020 files, 599568 bytes.

The two processes, on that one directory:

```sh
OLAI_ACP_AGENT= olai web corpus --port 0 --host 127.0.0.1 --no-commit &   # WEB=$!
OLAI_ACP_AGENT= olai mcp corpus --no-commit < a-fifo-held-open &          # MCP=$!
```

`olai mcp` needs its stdin held open or it drains and exits — a fifo carrying
one `initialize` frame, with the writer sleeping, is enough.

The samplers, both `/proc`, never `ps` (which reports its own rounding):

```sh
awk '/VmRSS/ {print $2}' /proc/$PID/status   # RSS, kB
ls /proc/$PID/fd | wc -l                     # open descriptors
ls -l /proc/$PID/fd | grep -c corpus         # how many of them are served files
```

Sampled eight seconds after each process starts, then again six seconds later.
MiB is `kB / 1024`.

The empty-directory baseline — the load-bearing one, and the cheapest to
repeat — is the same `olai mcp` invocation against a directory holding nothing,
sampled at the three warmth points above by varying only what the fifo writes
before it sleeps. The fifo is a SEPARATE process, so its pipe ends are not in
the server's own `/proc/<pid>/fd`; a harness that holds the write end in the
same process as the sampler will read two or three fds more than these.

**And the face was driven by hand over that socket**, because a measurement of a
process that answers nothing would be a measurement of nothing: the same
attached session advertises all 25 tools and all five resources, reads
`surface://collections/outlines` back as the serving store's real key set, and
lands a `set_title` in a `.jsonl` on the serving process's disk. Both halves —
the resources and the tools — over a wire, from a process holding 14 descriptors.

## What this does not measure

- **Latency.** A tool call attached crosses a unix socket and an ndjson frame
  where a fresh one is a function call. It was not measured because nothing in
  this product is latency-bound at the scale of one local socket hop, and a
  number nobody could act on is worse than no number.
- **A vault at the scale where the fd count matters.** 1020 files is the audit's
  corpus and the comparison's whole point is that it is the SAME one. The
  descriptor argument is O(corpus) arithmetic, not an extrapolation from this
  row.
- **Two `olai web`s on one directory.** The second one finds the socket taken
  and says so; an agent attaches to whichever bound first, which holds a store
  over the same files and judges writes through the same gate.
