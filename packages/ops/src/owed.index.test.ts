/**
 * THE TWO COUNTS, OFF THE INDEX AND OFF THE WALK, AFTER EVERY REAL WRITE.
 *
 * `perf-agenda-history-walk` split one reading in two. What is owed used to be
 * `owedOf(agendaOf(…))` — the whole agenda assembled, every overdue node in the
 * directory situated, and the answer counted and thrown away — and it is
 * `owedNow` over an index the patcher keeps now (`@olai/format`'s
 * `Derived.owedByDay`). Two spellings of one number where there was one, and
 * this door is where the second is read (`./query.ts`'s `owed`, per subscriber
 * per published revision).
 *
 * `@olai/format`'s `./occasion.test.ts` holds them to each other over GENERATED
 * corpora, which proves the fold. This file makes the same claim where the
 * writes are REAL — a temp directory, a store watching it, ops planning and
 * committing into it — and after every op it asks the question twice: once
 * through {@link Query.owed}, which is the index, and once through the corpus
 * walk that reading replaced (`@olai/format/testlib`'s `walkedAgenda`, kept
 * because the benchmark divides by it too).
 *
 * WHY A SECOND SUITE, in `./search.index.test.ts`'s own words one index over:
 * what a generated corpus cannot reach is the SEAM. The view a subscriber is
 * counted off came out of the PATCHER, through the store's stamp diff, the
 * codec's delta and the shared arrays a patch carries — and an index that is
 * one revision behind, or that a decline quietly rebuilt into agreement, shows
 * up here and nowhere else.
 *
 * THE OPS ARE CHOSEN FOR OVERDUENESS and not for coverage of the verb list:
 * what moves these two numbers is a DATE moving, a MARK arriving or leaving,
 * something being put AWAY or brought back, and a recurrence rolling — so those
 * are the writes, each in both directions, and each landing on days either side
 * of the todays below.
 *
 * THE TODAYS ARE THE BOUNDARY. The counts are asked at every day the corpus can
 * reach, because the two spellings can only part company at a comparison —
 * the day-rollover (`<` against `<=`) and the day today's own bucket is asked
 * for (the caller's value verbatim, instant and all). A single fixed today
 * would walk past both.
 */

import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { NodeServices } from "@effect/platform-node"
import { type Owed, owedOf, type WriteRequest } from "@olai/format"
import { walkedAgenda, walkedDays } from "@olai/format/testlib"
import * as StoreModule from "@olai/store"
import { expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"

import { codec } from "./codec.ts"
import type { Store } from "./deps.ts"
import { fixedPolicy } from "./pending.ts"
import { steady } from "./fixtures.testlib.ts"
import * as Ops from "./ops.ts"
import * as Query from "./query.ts"

/** Work spread over days either side of the todays below, in two outlines so a
 *  count of NODES cannot be satisfied by a count of files — plus the shapes
 *  that must never be owed: an occurrence, work already finished, and a live
 *  head of a recurrence. */
const WORK = [
  `{"id":"deck","ord":"a0","title":"the deck"}`,
  `{"id":"posts","parent":"deck","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-03"}`,
  `{"id":"permit","parent":"deck","ord":"a1","title":"pull the permit","doing":true,"date":"2026-08-10"}`,
  `{"id":"delivery","parent":"deck","ord":"a2","title":"the timber arrives","date":"2026-08-04"}`,
  `{"id":"survey","ord":"a3","title":"the boundary survey","done":"2026-08-05T09:15:00-04:00","date":"2026-08-05"}`,
  `{"id":"bins","ord":"a4","title":"put the bins out","todo":true,"date":"2026-08-12","repeat":"every week on monday"}`,
  "",
].join("\n")

const LIFE = [
  `{"id":"trip","ord":"a0","title":"the coast trip"}`,
  `{"id":"ferry","parent":"trip","ord":"a0","title":"book the ferry","todo":true,"date":"2026-08-12"}`,
  `{"id":"pack","parent":"trip","ord":"a1","title":"pack the bags","todo":true,"date":"2026-08-14"}`,
  `{"id":"train","parent":"trip","ord":"a2","title":"the sleeper leaves","date":"2026-08-20T21:40"}`,
  "",
].join("\n")

/** Already put away before anything happens: what is in the trash is on no day
 *  and owes nothing, at the FOLD — so it has to be here from the first read
 *  rather than only arriving via the `trash` op below. */
const TRASH = [
  `{"id":"gate","ord":"a0","title":"the old gate","todo":true,"date":"2026-08-01"}`,
  "",
].join("\n")

/**
 * Every day this corpus can be read on, and the two shapes a day arrives in.
 *
 * Before it, on each of its own days, past the end of it — and one INSTANT,
 * because the day travels from a browser's clock and `"2026-08-12" <
 * "2026-08-12T09:00"` is the one comparison that turns work due today into work
 * that is late.
 */
const TODAYS = [
  "2026-07-31",
  "2026-08-01",
  "2026-08-03",
  "2026-08-04",
  "2026-08-05",
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-12T09:00:00-04:00",
  "2026-08-13",
  "2026-08-14",
  "2026-08-17",
  "2026-08-20",
  "2026-09-01",
] as const

/** The months the calendar's dots are asked for — the OTHER reading this node
 *  changed (`datedDays` jumps into its month now instead of stepping to it), so
 *  the jump is asked at the same seam and against the same walk. Two of them
 *  hold nothing, which is where a binary search that landed one key out would
 *  answer with a month it was not asked about. */
const MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09", "2027-01"] as const

/** The two answers, and the whole of what this file asserts. Both are asked of
 *  the SAME derivation — the one the door itself would read — so the only
 *  difference between them is the index. */
const same = (store: Store): Effect.Effect<number> =>
  Effect.gen(function*() {
    const snapshot = yield* SubscriptionRef.get(store.snapshot)
    if (snapshot === null) throw new Error("the fixture directory never loaded")
    const derived = snapshot.value.derived
    let counted = 0
    for (const today of TODAYS) {
      const indexed: Owed = Query.owed(derived, { today })
      const walked = owedOf(walkedAgenda(derived, today))
      // The day rides the comparison, so a failure names the boundary it
      // happened at rather than only the two numbers.
      expect([today, indexed]).toEqual([today, walked])
      counted += indexed.overdue + indexed.today
    }
    for (const month of MONTHS) {
      expect([month, Query.dated(derived, { month }).days])
        .toEqual([month, walkedDays(derived, month)])
    }
    return counted
  })

test("every write leaves the counted door answering what the corpus walk does", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-owed-")))
  const write = (file: string, contents: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  write("work.olai", WORK)
  write("life.olai", LIFE)
  write("_olai/Trash.olai", TRASH)

  /** The ops in order, each chosen for the shape of change it makes the count
   *  follow. The four the roadmap node names — a date moving, a mark arriving
   *  and leaving, a record put away and brought back, a recurrence rolling —
   *  each in both directions, because an index maintained on the way in and not
   *  on the way out is the failure that answers correctly until somebody
   *  undoes something. */
  const WRITES: ReadonlyArray<WriteRequest> = [
    // A DATE MOVES BACKWARD, across today: work that was coming up is late.
    { op: "date", id: "pack", date: "2026-08-11" },
    // ...and FORWARD again, over the same boundary the other way.
    { op: "date", id: "pack", date: "2026-08-17" },
    // A date moves onto a day that already owes something, so a key GAINS a
    // member without the key set moving at all.
    { op: "date", id: "pack", date: "2026-08-03" },
    // A DATE IS CLEARED: work with no WHEN is late against nothing, and the
    // day it leaves may have nothing left on it.
    { op: "date", id: "pack", date: null },
    // ...and given back, on a day nothing else is on — a key MINTED.
    { op: "date", id: "pack", date: "2026-08-08" },
    // A MARK ARRIVES on a dated bullet: an occurrence becomes owed work, which
    // is the one transition that does not touch the day index at all.
    { op: "todo", id: "delivery" },
    // ...and LEAVES, back to an occurrence.
    { op: "todo", id: "delivery", undo: true },
    // FINISHED, with the instant it was finished at — the record joins a
    // SECOND day (today's) and leaves the owed tally on its own.
    { op: "done", id: "posts" },
    // ...and UNDONE, which is where an index that only ever added would be
    // caught: the second day goes away and the first owes again.
    { op: "done", id: "posts", undo: true },
    // `doing` over `todo`: still owed, still one, and the record rewritten.
    { op: "doing", id: "posts" },
    // PUT AWAY: what is in the trash is on no day, so the count and the
    // calendar both lose it — and its day may empty.
    { op: "trash", id: "permit" },
    // ...and BROUGHT BACK, which is the same rule run backwards.
    { op: "untrash", id: "permit" },
    // A whole SUBTREE put away, so several days move on one write.
    { op: "trash", id: "trip" },
    { op: "untrash", id: "trip" },
    // A RECURRENCE ROLLS: finishing the live head mints the next occurrence
    // ahead of it and leaves the finished one behind, so one op moves two days
    // and the owed tally moves from one to the other.
    { op: "done", id: "bins" },
    // ...and the rule is taken OFF, which is how a recurrence stops.
    { op: "repeat", id: "bins", repeat: null },
    // A rule put back on the node that still has a date to repeat from.
    { op: "repeat", id: "bins", repeat: "every day" },
    // A NEW dated OCCURRENCE, on a day nothing is on: it mints a key in the
    // journal and in the day line and must mint none in the tally, which is
    // the two index key sets moving apart on one write.
    { op: "add", parent: "deck", title: "the sander arrives", date: "2026-08-02" },
    // A whole FILE minted, so the delta names a path the day index has never
    // had a record from.
    { op: "create", file: "shed.olai", seed: { title: "the shed" } },
    // ...and NEW OWED work on that same day, which is the tally's key arriving
    // one write after the journal's did.
    { op: "add", parent: "deck", title: "sand the rails", date: "2026-08-02", mark: "todo" },
    // A record MOVES under a new parent, so its whole outline is rewritten and
    // every dated row in it is re-filed for a change to one line.
    { op: "move", id: "pack", parent: "ferry" },
    // The trash EMPTIED: records leave the set outright, from a file the day
    // index has never had a key for.
    { op: "empty", file: "_olai/Trash.olai" },
  ]

  return Effect.gen(function*() {
    const store = yield* StoreModule.make({ root, codec, watch: false, settle: "10 millis" })
    const ops = Ops.make({
      store,
      root,
      policy: fixedPolicy({ commit: "off", push: null }),
      context: steady(),
    })

    // BEFORE anything is written — the view a cold DERIVE built, where every
    // one below came out of the patcher.
    let counted = yield* same(store)

    for (const request of WRITES) {
      yield* Effect.orDie(ops.run(request, "mcp"))
      counted += yield* same(store)
    }

    // The claim that any of the above was asked at all: a corpus that owed
    // nothing would compare two zeroes at every boundary of every round and
    // say nothing while doing it.
    expect(counted).toBeGreaterThan(100)
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
})
