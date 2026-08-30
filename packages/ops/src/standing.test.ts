/**
 * THE STANDING VIEWS, ONE CLAIM AT A TIME.
 *
 * `./standing.equivalence.test.ts` is the gate — a corpus, a room of tabs, and
 * the sharing held to what rebuilding says. This file is the other half of the
 * evidence and it is the readable one: each of the module's claims made against
 * exactly the revision that tests it, so a failure names the claim rather than a
 * revision number in a two-hundred-step replay.
 *
 * THE PRE-CHECK'S POSITIVE SPACE IS HERE TOO, and it is the pairing that
 * matters: for each of the five, an edit that MUST move the answer, and the
 * assertion that the answer moved. The differential proves the pre-check never
 * held over a moved answer across a whole corpus; these say that the five
 * particular movements everybody would think of are among them, by name, so a
 * pre-check that quietly stopped noticing marks would fail a sentence rather
 * than a statistic.
 */

import { expect, test } from "bun:test"

import {
  FIXED,
  type Modelled,
  publishing,
  type Vault,
  vaultFor,
} from "./standing.testlib.ts"
import { standing } from "./standing.ts"
import { addressOf, NO_KINDS, type PageRequest, type Reading } from "@olai/format"

/** A directory, its publisher, and the handful of things every case below
 *  addresses: the first outline, a record in it, and a day something is on. */
const directory = (): {
  readonly vault: Vault
  readonly publish: (says: string, changed: ReadonlyArray<string>) => Reading
  readonly first: Reading
  readonly path: string
  readonly record: Modelled
  /** A record nothing hangs under and nothing points at — the one a revision
   *  may take away without leaving a reference dangling, which the validator
   *  would refuse (and a refused revision publishes nothing, so a test built on
   *  one would be asserting about a directory that never moved). */
  readonly leaf: Modelled
  readonly day: string
} => {
  const vault = vaultFor({ files: 6, records: 6 })
  const { publish, revisions } = publishing(vault)
  const first = (revisions[0] as { reading: Reading }).reading
  // A file that HAS a day on it, so the two date readings have something in
  // this file to be about — a third of the generated files deliberately have
  // none (`./standing.testlib.ts`).
  const path = [...vault.outlines.keys()].find((one) =>
    (vault.outlines.get(one) ?? []).some((record) => record.date !== null)
  ) as string
  const own = vault.outlines.get(path) as ReadonlyArray<Modelled>
  const record = own.find((one) => one.date !== null) as Modelled
  const leaf = own.findLast((one) =>
    one.parent !== null &&
    own.every((other) =>
      other.parent !== one.id && other.after !== one.id && other.mirror !== one.id
    )
  ) as Modelled
  return {
    vault,
    publish: (says, changed) => publish(says, changed, []),
    first,
    path,
    record,
    leaf,
    day: record.date as string,
  }
}

const pageAt = (path: string): PageRequest => ({ kind: "at", address: addressOf(path, null) })

test("two tabs on one question at one revision are handed the same object", () => {
  const { first, path } = directory()
  const views = standing(() => FIXED, NO_KINDS)
  const one = views.page(first, pageAt(path))
  const two = views.page(first, pageAt(path))
  // NOT `toEqual`: the claim is that the answer was computed once, and only
  // identity says that.
  expect(two).toBe(one)
})

test("two tabs on DIFFERENT questions of one member share nothing", () => {
  const { vault, first } = directory()
  const [one, two] = [...vault.outlines.keys()]
  const views = standing(() => FIXED, NO_KINDS)
  expect(views.page(first, pageAt(one as string)))
    .not.toBe(views.page(first, pageAt(two as string)))
})

test("the clock is sampled once per question per revision", () => {
  const { first, path } = directory()
  // A clock that MOVES on every read: two asks of one question at one revision
  // must still be one answer, which is only true if the second ask never
  // reached the clock at all.
  let ticks = 0
  const views = standing(() => {
    ticks++
    return FIXED
  }, NO_KINDS)
  const request = { page: pageAt(path), text: "created:1h" }
  const one = views.narrowing(first, request)
  const two = views.narrowing(first, request)
  expect(two).toBe(one)
  expect(ticks).toBe(1)
})

test("a file RE-READ is conservatively rebuilt, and its neighbours are not", () => {
  // THE PRE-CHECK'S HONEST LIMIT, said out loud as behaviour. The store
  // publishes a revision when a probe RE-DECODES a file, whether or not its
  // bytes moved — and a re-decoded file's records are new objects even when
  // they say exactly what they said. So a question about that file is rebuilt
  // (which is the conservative direction, and costs what every revision used to
  // cost), and a question about any other file carries.
  //
  // Closing it would mean the decode carrying a record forward when its line is
  // unchanged, which is a change to the store and a lane of its own; the tape
  // would spend it the day it arrives without a line moving here.
  const { vault, first, path, publish } = directory()
  const elsewhere = [...vault.outlines.keys()].find((one) => one !== path) as string
  const views = standing(() => FIXED, NO_KINDS)
  const own = views.page(first, pageAt(path))
  const other = views.page(first, pageAt(elsewhere))
  const next = publish(`re-read ${path}`, [path])
  expect(next).not.toBe(first)
  expect(views.page(next, pageAt(path))).not.toBe(own)
  // …and it is the same VALUE, which is what keeps a frame off the wire: the
  // framework's own equality is what decides that, and it says nothing moved.
  expect(views.page(next, pageAt(path))).toEqual(own)
  expect(views.page(next, pageAt(elsewhere))).toBe(other)
})

test("an edit in another file leaves this page's answer alone", () => {
  const { vault, first, path, publish } = directory()
  const elsewhere = [...vault.outlines.keys()].find((one) => one !== path) as string
  const views = standing(() => FIXED, NO_KINDS)
  const before = views.page(first, pageAt(path))
  const record = (vault.outlines.get(elsewhere) as Array<Modelled>).find((one) =>
    one.parent !== null
  ) as Modelled
  record.title = `${record.title} — typed into`
  const next = publish(`retitle in ${elsewhere}`, [elsewhere])
  expect(views.page(next, pageAt(path))).toBe(before)
})

// ── the pre-check's positive space: five edits that must be noticed ────

/** One case: make the edit, publish, and say whether the answer moved. Written
 *  once so the five below are a sentence each and the shape they share is not
 *  spelled five times. */
const noticed = <A>(
  edit: (vault: Vault, one: Subject) => void,
  ask: (views: ReturnType<typeof standing>, at: Reading, one: Subject) => A,
): { readonly before: A; readonly after: A } => {
  const { vault, first, path, record, leaf, day, publish } = directory()
  const views = standing(() => FIXED, NO_KINDS)
  const subject: Subject = { path, day, record, leaf }
  const before = ask(views, first, subject)
  edit(vault, subject)
  const next = publish("the edit", [path])
  // A REVISION THAT DID NOT LAND would make every case below pass by asking
  // one reading twice, which is the sharing working and nothing about the
  // pre-check at all.
  expect(next).not.toBe(first)
  return { before, after: ask(views, next, subject) }
}

/** What one of those cases addresses — the file, a day on it, the dated record
 *  and the one that can be taken away. */
interface Subject {
  readonly path: string
  readonly day: string
  readonly record: Modelled
  readonly leaf: Modelled
}

test("a mark that moved is noticed by what is owed", () => {
  const { before, after } = noticed(
    (_vault, one) => {
      one.record.mark = one.record.mark === "done" ? "todo" : "done"
    },
    (views, at, one) => views.owed(at, { today: one.day }),
  )
  expect(after).not.toBe(before)
})

test("a day that moved is noticed by the calendar", () => {
  const { before, after } = noticed(
    (_vault, one) => {
      one.record.date = null
    },
    (views, at, one) => views.dated(at, { month: one.day.slice(0, 7) }),
  )
  expect(after).not.toBe(before)
  expect(after).not.toEqual(before)
})

test("a title that moved is noticed by the page it is on", () => {
  const { before, after } = noticed(
    (_vault, one) => {
      one.record.title = "written just now"
    },
    (views, at, one) => views.page(at, pageAt(one.path)),
  )
  expect(after).not.toBe(before)
})

test("a title that moved is noticed by the filter over that page", () => {
  const { before, after } = noticed(
    (_vault, one) => {
      one.record.title = "zzz nothing else in this vault says this"
    },
    (views, at, one) => views.narrowing(at, { page: pageAt(one.path), text: "zzz" }),
  )
  expect(after).not.toBe(before)
  expect(after).not.toEqual(before)
})

test("a record that went away is noticed by the move picker", () => {
  const { before, after } = noticed(
    (vault, one) => {
      const own = vault.outlines.get(one.path) as ReadonlyArray<Modelled>
      vault.outlines.set(one.path, own.filter((record) => record !== one.leaf))
    },
    (views, at, one) => views.moving(at, { record: one.leaf.id, to: [one.record.id] }),
  )
  expect(after).not.toBe(before)
  expect(after).not.toEqual(before)
})

test("a question nobody asks any more is not kept", () => {
  // THE MEMORY BOUND, said as behaviour rather than as a comment: two
  // generations and no more, so a question that has sat out the last two
  // revisions ANYBODY asked about is built again rather than found. It is not a
  // correctness claim — the answer is the same either way — which is why it is
  // asserted by identity with the value asserted equal beside it.
  const { vault, first, path, publish } = directory()
  const elsewhere = [...vault.outlines.keys()].find((one) => one !== path) as string
  const views = standing(() => FIXED, NO_KINDS)
  const before = views.page(first, pageAt(path))
  // Two revisions somebody else's question was asked about, and this one was
  // not. What rolls the generations is a reading being ASKED about, not a
  // revision going by: a question nobody is holding does not keep an answer
  // alive, and a directory nobody is watching costs nothing at all.
  for (const says of ["a revision", "and another"]) {
    views.page(publish(says, [path]), pageAt(elsewhere))
  }
  const after = views.page(
    publish("a third, still not asked about", [path]),
    pageAt(path),
  )
  expect(after).not.toBe(before)
  expect(after).toEqual(before)
})
