/**
 * A SCOPE ITS DOORBELL CANNOT WATCH — the two causes, the two sentences, and
 * the silence over a pick that is fine.
 *
 * ## Where these came from, and what changed
 *
 * They were `@olai/server`'s `runtime.test.ts`, driven through a bound runtime
 * on a real temp directory: the case wrote files, published a revision, and read
 * what the fake chat's doorbell had been rung with. The walk was core's while
 * the picks were core's, and it is this plugin's now. What survives is every
 * claim; what changed is that the two readings the walk does not take for itself
 * — is this file still served, and what did each ringing plugin declare — are
 * handed in ({@link ./doorbell.ts}'s `World`) instead of being derived from a
 * store on disk.
 *
 * That is not a weaker bench. The disk was never the subject: every case here
 * asserts WHICH sentence went in, WHOSE name it went in under, that a healthy
 * pick was not mentioned at all, and that a broken row left its plugin's door.
 * The one thing the temp directory bought — that an EMPTY served file is not a
 * missing one — is held by the `served` predicate saying so, which is exactly
 * the distinction the production reading makes (`documentAt` over the SET, never
 * a grouping of parsed records).
 *
 * ## `rang` IS A QUEUE, and that is a barrier rather than a shape
 *
 * `deliver` answers `void` and its Effect is forked, so a case reading an array
 * would be asserting against whatever had happened to arrive by the time it
 * looked. A take waits for the delivery to actually be made — and a second pick
 * that IS broken is what gives a case something to wait for when its claim is
 * that a first pick was NOT mentioned.
 */

import { expect, test } from "bun:test"
import type { Wake } from "@olai/plugin-api/services"
import { Effect, Queue } from "effect"

import type { Chat } from "../scoped.ts"
import type { Faulted, Scoped } from "../scopes.ts"
import { faultedIn, scopeThrough, type World } from "./doorbell.ts"

/** The one conversation every case below is about — a PAIR, because a session id
 *  means nothing to the wrong agent (`../scopes.ts`). */
const TALKING = { agent: "claude", session: "s-1" }

/** What a ringing plugin declared: the kinds its doorbell can read, and one
 *  whole sentence per cause. Core composes no clause of either. */
const RINGING: Wake = {
  subject: "runs",
  from: "the coordinator",
  waiting: { one: "one run is waiting", many: "runs are waiting" },
  kinds: ["outline"],
  faults: {
    gone: "the file this doorbell watched is not here any more.",
    unwatchable: "this doorbell cannot read a file of that kind.",
  },
}

/** One kept pick, as the record hands it back. */
const scoped = (plugin: string, file: string): Scoped => ({ ...TALKING, plugin, file })

interface Rung {
  readonly to: { readonly agent: string; readonly session: string }
  readonly body: string
  readonly from: string
}

/**
 * A CHAT THAT IS NOTHING BUT ITS DOORBELL — the two members the walk reaches,
 * and a death for every other one.
 *
 * `faults` is a WRITE and the cases are about what it wrote: the mark, the
 * once-ness, and the row leaving the plugin's door. So the table MOVES here, the
 * way the real record's does.
 */
const chatKeeping = (kept: ReadonlyArray<Scoped>): {
  readonly chat: Chat
  /** The next body that reached the chat, with the name the DOOR stamped on it
   *  rather than any the walk offered. */
  readonly rang: Effect.Effect<Rung>
  /** How many are waiting RIGHT NOW, for the cases whose claim is that something
   *  was NOT said. Only ever asked after a take that acts as the barrier. */
  readonly waiting: Effect.Effect<number>
  /** What is still on one plugin's door. */
  readonly scopesOf: (plugin: string) => ReadonlyArray<Scoped>
} => {
  let rows: ReadonlyArray<Scoped> = kept
  const rang = Effect.runSync(Queue.unbounded<Rung>())
  const elsewhere = Effect.die(new Error("this stub chat answers its doorbell and nothing else"))
  const doorFor = (plugin: string) => ({
    // ... AND A FAULTED ROW IS NOT ON IT, which is the real chat's own filter and
    // is load-bearing here: it is what the thunk reads to decide whether the
    // sentence is still owed.
    scopes: () =>
      rows
        .filter((row) => row.plugin === plugin && row.fault === undefined)
        .map(({ agent, file, session }) => ({ agent, file, session })),
    ringing: (file: string) =>
      rows
        .filter((row) => row.plugin === plugin && row.fault === undefined && row.file === file)
        .map(({ agent, file, session }) => ({ agent, file, session })),
    deliver: (
      to: { readonly agent: string; readonly session: string },
      say: () => string | null,
    ) =>
      Effect.suspend(() => {
        // THE THUNK IS ASKED HERE, at the moment the words would enter the
        // conversation — `null` is a body that has lost its subject and is simply
        // not said, which is the arm the fault's own thunk takes when the file
        // has come back in the meantime.
        const body = say()
        return body === null ? Effect.void : Queue.offer(rang, { to, body, from: plugin })
      }),
  })
  const chat = {
    doorFor,
    faults: (
      judge: (plugin: string, file: string) => Faulted["fault"] | null,
      sayable: (plugin: string) => boolean,
    ) =>
      Effect.sync(() => {
        const fell: Array<Faulted> = []
        rows = rows.map((row) => {
          if (!sayable(row.plugin)) return row
          const wrong = judge(row.plugin, row.file)
          if (wrong === (row.fault ?? null)) return row
          if (wrong === null) {
            return { agent: row.agent, session: row.session, plugin: row.plugin, file: row.file }
          }
          const broken: Faulted = { ...row, fault: wrong }
          if (row.fault === undefined) fell.push(broken)
          return broken
        })
        return fell as ReadonlyArray<Faulted>
      }),
    entries: () => new Map(),
    live: () => new Map(),
    overheard: () => [],
    reread: () => {},
    send: () => elsewhere,
    start: Effect.void,
    stop: Effect.void,
  } as unknown as Chat
  return {
    chat,
    rang: Queue.take(rang),
    waiting: Queue.size(rang),
    scopesOf: (plugin) => rows.filter((row) => row.plugin === plugin && row.fault === undefined),
  }
}

/** A world where these files are served, and these plugins ring. */
const world = (
  served: ReadonlyArray<string>,
  ringing: ReadonlyArray<string>,
): World => ({
  served: (file) => served.includes(file),
  declared: new Map(ringing.map((one) => [one, RINGING])),
})

/**
 * A SCOPE WHOSE FILE IS NOT SERVED is told, in the plugin's own words and
 * nobody else's.
 *
 * Two picks in one conversation: one on a file this directory serves, one on a
 * file it does not. Only the second is a fault — and the rows are in this order,
 * so a delivery for the healthy one would arrive FIRST. That is what makes the
 * silence readable off the queue rather than off a timer.
 */
test("a scope whose file is not served is told, in the plugin's own words and nobody else's", async () => {
  const it = chatKeeping([scoped("ringer", "a.olai"), scoped("other", "lanes.olai")])
  await Effect.runPromise(faultedIn(it.chat, world(["a.olai"], ["ringer", "other"])))
  // WHAT THE CONVERSATION GOT: the declared sentence, whole. Nothing composes a
  // clause of it — a sentence with core's hole punched in it is the shape the
  // whole `wake` split refuses.
  expect(await Effect.runPromise(it.rang)).toEqual({
    to: TALKING,
    body: RINGING.faults.gone,
    from: "other",
  })
  // ... and the healthy pick was not mentioned, which is the half that says this
  // is a fault and not a heartbeat.
  expect(await Effect.runPromise(it.waiting)).toBe(0)
  // THE BROKEN ROW IS OFF ITS PLUGIN'S DOOR, and the healthy one is still on its
  // own. There is nothing to watch, so the doorbell does not ring for it — and
  // neither does anything else a plugin does per scope, which is how "alive and
  // quiet" is kept apart from "watching nothing" by construction.
  expect(it.scopesOf("other")).toEqual([])
  expect(it.scopesOf("ringer")).toEqual([scoped("ringer", "a.olai")])
})

/**
 * A FILE THAT IS SERVED AND EMPTY IS NOT A FILE THAT IS GONE.
 *
 * The honest source is the SET, which holds a place for every served file
 * including the ones that hold no records. A reading off a grouping of parsed
 * records would call this one missing — and the person who emptied it for a
 * minute would be told, once and never corrected, that their doorbell had
 * broken.
 *
 * THE SECOND PICK IS THE BARRIER. A delivery is forked, so an empty queue proves
 * nothing on its own; a pick on a file that really is missing gives this case
 * something to WAIT for, and the empty file's row sits ahead of it.
 */
test("a file that is served and EMPTY is not a file that is gone", async () => {
  const it = chatKeeping([scoped("ringer", "empty.olai"), scoped("other", "lanes.olai")])
  await Effect.runPromise(
    faultedIn(it.chat, world(["a.olai", "empty.olai"], ["ringer", "other"])),
  )
  expect((await Effect.runPromise(it.rang)).from).toBe("other")
  expect(await Effect.runPromise(it.waiting)).toBe(0)
  // ... and the empty file's scope is still on the door, where the plugin can go
  // on watching a file somebody is in the middle of rewriting.
  expect(it.scopesOf("ringer")).toEqual([scoped("ringer", "empty.olai")])
})

/**
 * ...AND A SCOPE ON A FILE THAT IS SERVED AND CANNOT BE READ — the second cause,
 * and the one a picker-only fix would have left silent.
 *
 * The picker offered every file the directory serves, documents included. A
 * document has no NODES, so a wake that derives its set from a file's records
 * watches the empty set for ever — no wake, no digest, and a heartbeat still
 * reporting a live watcher. Filtering the picker stops NEW picks; it does
 * nothing about the ones already on the disk, so those are judged per revision
 * here exactly as a rename is.
 *
 * WHAT IS UNDER TEST IS THE COMPOSITION: that the walk compares the plugin's
 * declared `kinds` against the reading for the path, and that the sentence which
 * reaches the conversation is the OTHER declared string — `unwatchable`, not
 * `gone`. Getting that wrong would tell somebody their file had been renamed
 * while it sat in front of them.
 */
test("a scope on a served file its doorbell cannot read is told, in the OTHER declared sentence", async () => {
  const it = chatKeeping([scoped("ringer", "a.olai"), scoped("other", "notes.md")])
  await Effect.runPromise(
    faultedIn(it.chat, world(["a.olai", "notes.md"], ["ringer", "other"])),
  )
  expect(await Effect.runPromise(it.rang)).toEqual({
    to: TALKING,
    body: RINGING.faults.unwatchable,
    from: "other",
  })
  expect(await Effect.runPromise(it.waiting)).toBe(0)
  // ... and the row is off the door for the same reason a renamed one is:
  // nothing is being watched, so nothing this plugin does per scope may go on
  // happening — a heartbeat over it most of all.
  expect(it.scopesOf("other")).toEqual([])
  expect(it.scopesOf("ringer")).toEqual([scoped("ringer", "a.olai")])
})

/**
 * A ROW WHOSE TENANT CANNOT SPEAK IS NOT MARKED — a serve run without the plugin
 * that rings leaves its rows alone rather than burning their one signal unheard.
 *
 * The barrier is a second pick whose plugin IS composed and IS broken, so this
 * case has something to wait for before it can say the first was silent.
 */
test("a scope for a plugin this serve did not compose is left alone, not marked", async () => {
  const it = chatKeeping([scoped("absent", "lanes.olai"), scoped("other", "lanes.olai")])
  await Effect.runPromise(faultedIn(it.chat, world(["a.olai"], ["other"])))
  expect((await Effect.runPromise(it.rang)).from).toBe("other")
  expect(await Effect.runPromise(it.waiting)).toBe(0)
  expect(it.scopesOf("absent")).toEqual([scoped("absent", "lanes.olai")])
})

/**
 * A SCOPE THAT HEALED BEFORE THE WORDS WENT IN SAYS NOTHING — the thunk's whole
 * reason for being a thunk.
 *
 * The delivery may wait out a running turn, or wait for somebody to open the
 * conversation at all, and by then the file may be back. A scope that healed is
 * on its plugin's door again, so its absence from that list is what "still
 * broken" means — and answering `null` keeps the sentence out of the transcript
 * rather than telling a person their doorbell is broken over a strip that is
 * already drawing it fine.
 */
test("a scope that came back before the words went in is not told anything", async () => {
  const it = chatKeeping([scoped("other", "lanes.olai")])
  // The file is gone on THIS walk, so the row is marked...
  await Effect.runPromise(faultedIn(it.chat, world(["a.olai"], ["other"])))
  expect((await Effect.runPromise(it.rang)).body).toBe(RINGING.faults.gone)
  // ...and a second walk on a world where it is back takes the mark off and says
  // nothing, because the row is not a NEW fault and the thunk would answer null.
  await Effect.runPromise(faultedIn(it.chat, world(["a.olai", "lanes.olai"], ["other"])))
  expect(await Effect.runPromise(it.waiting)).toBe(0)
  expect(it.scopesOf("other")).toEqual([scoped("other", "lanes.olai")])
})

// ── whose doorbell a conversation may be pointed at ────────────────────

/** A chat whose only member is the one that writes a pick. */
const chatPicking = (): {
  readonly chat: Chat
  readonly picked: ReadonlyArray<{
    readonly to: { agent: string; session: string }
    readonly plugin: string
    readonly file: string | null
  }>
} => {
  const picked: Array<{
    readonly to: { agent: string; session: string }
    readonly plugin: string
    readonly file: string | null
  }> = []
  const chat = {
    scope: (
      to: { agent: string; session: string },
      plugin: string,
      file: string | null,
    ) => Effect.sync(() => void picked.push({ to, plugin, file })),
  } as unknown as Chat
  return { chat, picked }
}

const rings = (...names: ReadonlyArray<string>): ReadonlyMap<string, Wake> =>
  new Map(names.map((one) => [one, RINGING]))

/**
 * THE GATE'S FIRST ANSWER: a plugin this serve composed, whose half declares a
 * wake, gets the pick — whole, and with nothing about it re-decided here.
 *
 * The triple travels EXACTLY as it arrived, which is the half a reader should
 * check for a substitution rather than for an error: what this end must not do
 * is store "whichever conversation is open", because a picker somebody left open
 * can outlive the session under it and the chat is where that race is answered.
 */
test("a scope naming a composed plugin that rings is written through, whole", async () => {
  const it = chatPicking()
  await Effect.runPromise(
    scopeThrough(it.chat, rings("ringer"), { ...TALKING, plugin: "ringer", file: "notes.olai" }),
  )
  expect(it.picked).toEqual([{ to: TALKING, plugin: "ringer", file: "notes.olai" }])
})

/**
 * ...AND THE REFUSAL: this serve did not compose that plugin, or the half it
 * composed declares no wake. Both arms land here and both mean the same thing to
 * the person who pressed — nothing will read what you just asked for — so the
 * declarations table is the one question asked.
 *
 * The negative beside it is the one that matters: nothing was written. A gate
 * that refused and stored anyway would be a row nothing will ever read, kept
 * against the cap of a record that has one.
 */
test("a scope naming a plugin that does not ring here is refused, in words, and stores nothing", async () => {
  const it = chatPicking()
  const said = await Effect.runPromise(
    Effect.flip(
      scopeThrough(it.chat, rings("ringer"), { ...TALKING, plugin: "quiet", file: "notes.olai" }),
    ),
  )
  expect(said.reason).toContain("quiet")
  expect(it.picked).toEqual([])
  // ...and the one that DOES ring, through the same gate and the same
  // conversation, is written through — so what was refused was the declaration
  // and not the gate.
  await Effect.runPromise(
    scopeThrough(it.chat, rings("ringer"), { ...TALKING, plugin: "ringer", file: "notes.olai" }),
  )
  expect(it.picked).toEqual([{ to: TALKING, plugin: "ringer", file: "notes.olai" }])
})

/** ...AND CLEARING ONE IS THE SAME GATE, because `null` is a value rather than a
 *  second verb: a `forget` beside a `set` would be two ways to write one row and
 *  a question about which of them a fresh pick goes through. */
test("clearing a scope goes through the same gate, with the file as null", async () => {
  const it = chatPicking()
  await Effect.runPromise(
    scopeThrough(it.chat, rings("ringer"), { ...TALKING, plugin: "ringer", file: null }),
  )
  expect(it.picked).toEqual([{ to: TALKING, plugin: "ringer", file: null }])
})
