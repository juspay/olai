/**
 * THE INCREMENTAL VALIDATOR AGAINST THE FULL ONE.
 *
 * `perf-validate-incremental`'s claim is an equivalence — the same verdict,
 * reached from what an edit touched — so this suite asserts nothing about what
 * either arm SAYS. It replays sequences of revisions through the real
 * `validate`, with the real shadow running inside it, and asserts an EMPTY
 * divergence list plus enough counting to say the run was not vacuous
 * ({@link ./incremental.testlib.ts} is the harness; `./validate.test.ts` is
 * where what a finding says is pinned).
 *
 * THREE CORPORA, and each is here because the ones before it cannot reach what
 * it holds:
 *
 *   - the CORNERS, written by hand ({@link corners}) — each one an edit that a
 *     lazier narrowing gets wrong, named with the rule it is about. A generator
 *     produces these at random or not at all, and every one of them is a
 *     sentence in `./incremental.ts`'s own argument that would otherwise be
 *     checked by nothing;
 *   - GENERATED sequences, over the same corpora and the same edits the patcher
 *     is held to (`./corpora.testlib.ts`), with the documents beside them
 *     churning and a file breaking and mending;
 *   - THE REAL VAULT, this repository's `docs/`, edited: files people actually
 *     grew, in a directory with a trash in it and documents attached to real
 *     nodes.
 *
 * THE GATE IS AN EQUALITY TO THE EMPTY LIST rather than a count, so a failure
 * names the revision, what each arm said, and which findings one of them had
 * and the other did not — a differential whose failure message is
 * `expected 3 to be 0` is a differential nobody can act on at four in the
 * morning.
 */

import { expect, test } from "bun:test"

import { seeded } from "./fixtures.testlib.ts"
import { edited, replay, type Report, type Revision, revisionsOf } from "./incremental.testlib.ts"
import { vaultAt } from "./scope.testlib.ts"

/** The gate, in one place: no divergence, and both arms of the thing under test
 *  were reached. A replay that never narrowed, or one that narrowed every time
 *  by walking the corpus anyway, proves the equivalence of nothing. */
const holds = (report: Report, floors: {
  readonly narrowed: number
  readonly cold: number
  readonly accepted: number
}): void => {
  expect(report.divergences).toEqual([])
  expect(report.narrowed).toBeGreaterThan(floors.narrowed)
  expect(report.cold).toBeGreaterThan(floors.cold)
  expect(report.accepted).toBeGreaterThan(floors.accepted)
  // The narrowing has to have NARROWED on most of them. Left unchecked, an
  // `incrementally` that answered `walked: true` every time — one that ran the
  // cycle walks and the doc walk on every edit — would agree with the full arm
  // on every revision here and buy nothing at all.
  expect(report.walked).toBeLessThan(report.narrowed)
}

// ── the corners ────────────────────────────────────────────────────────

/**
 * A revision from a plain object, so a corner reads as the directory it is —
 * with a KEEL under it, which is not decoration.
 *
 * A patch is only taken when something is left standing to patch ONTO
 * ({@link ./patch.ts} declines when the delta names every file that holds a
 * record), so a two-file corner whose edit touches both files rebuilds, runs
 * cold, and asserts that the full validator agrees with itself. One record
 * nobody ever edits is what makes the corner a corner. {@link alone} is for the
 * two corners that are ABOUT the decline.
 */
const at = (files: Record<string, string>): Revision =>
  new Map([["keel.olai", KEEL], ...Object.entries(files)])

const KEEL = `{"id":"keel","ord":"a","title":"the file nobody edits"}`

/** ...and a revision with no keel under it, for a corner whose subject is a
 *  directory with nothing left standing. */
const alone = (files: Record<string, string>): Revision => new Map(Object.entries(files))

/**
 * Each entry is a SEQUENCE of directories and one sentence about the narrowing
 * it would catch — the edit where re-asking only the touched records, or
 * skipping a walk, gives the wrong answer.
 *
 * They are replayed as one stream each rather than all together, because what
 * is under test is what one revision carries into the next and a corner
 * followed by an unrelated corner is a different claim.
 */
interface Corner {
  readonly why: string
  readonly steps: ReadonlyArray<Revision>
  /** Whether the narrowing is expected to ANSWER at all. False for the one
   *  corner whose subject is a directory with nothing left standing, where
   *  "it narrowed" would be the failure. */
  readonly narrows?: boolean
  /** Whether some revision of this corner has to DECLINE — the first one always
   *  does, having nothing to follow, so this asks for a second. It is how the
   *  duplicate-id corner says what it is about: the patcher hands a corpus with
   *  two claims on one id back to `derive`, and the narrowing has to go with
   *  it rather than answer over a view whose `byId` kept one of the two. */
  readonly declines?: boolean
}

const CORNERS: ReadonlyArray<Corner> = [
  {
    why:
      "a parent's claimant moves to another file, so its children turn foreign " +
      "without being edited themselves",
    steps: [
      at({
        "a.olai": `{"id":"top","ord":"a","title":"top"}\n` +
          `{"id":"kid","ord":"b","title":"kid","parent":"top"}`,
      }),
      at({
        "a.olai": `{"id":"kid","ord":"b","title":"kid","parent":"top"}`,
        "b.olai": `{"id":"top","ord":"a","title":"top"}`,
      }),
    ],
  },
  {
    why:
      "the id a record's parent names goes away, so an untouched child is left " +
      "pointing at nothing",
    steps: [
      at({
        "a.olai": `{"id":"top","ord":"a","title":"top"}\n` +
          `{"id":"kid","ord":"b","title":"kid","parent":"top"}`,
        "b.olai": `{"id":"other","ord":"a","title":"other"}`,
      }),
      at({
        "a.olai": `{"id":"top","ord":"a","title":"top"}\n` +
          `{"id":"kid","ord":"b","title":"kid","parent":"top"}`,
      }),
      at({
        "a.olai": `{"id":"kid","ord":"b","title":"kid","parent":"top"}`,
      }),
    ],
  },
  {
    why:
      "a parent becomes a MIRROR in place, which is a finding about the child " +
      "and a field on the parent",
    steps: [
      at({
        "a.olai": `{"id":"top","ord":"a","title":"top"}\n` +
          `{"id":"kid","ord":"b","title":"kid","parent":"top"}`,
        "b.olai": `{"id":"far","ord":"a","title":"far"}`,
      }),
      at({
        "a.olai": `{"id":"top","ord":"a","mirror":"far"}\n` +
          `{"id":"kid","ord":"b","title":"kid","parent":"top"}`,
        "b.olai": `{"id":"far","ord":"a","title":"far"}`,
      }),
    ],
  },
  {
    why:
      "an edge target leaves, so a record nobody edited is naming an id nothing " +
      "declares",
    steps: [
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","after":["two"]}`,
        "b.olai": `{"id":"two","ord":"a","title":"two"}`,
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","after":["two"]}`,
      }),
    ],
  },
  {
    why:
      "an edge target ARRIVES, so a finding that stood has to go away",
    steps: [
      at({ "a.olai": `{"id":"one","ord":"a","title":"one"}` }),
      at({ "a.olai": `{"id":"one","ord":"a","title":"one","see":["two"]}` }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","see":["two"]}`,
        "b.olai": `{"id":"two","ord":"a","title":"two"}`,
      }),
    ],
  },
  {
    why:
      "one record names TWO ids nothing declares, so two findings sit at one " +
      "site and their order is the order the corpus FIRST named them, which is " +
      "not the order the record writes its fields",
    steps: [
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one"}`,
        "b.olai": `{"id":"two","ord":"a","title":"two"}\n` +
          `{"id":"three","ord":"b","title":"three"}`,
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","after":["two"],"blocks":["three"],"see":["two"]}`,
        "b.olai": `{"id":"other","ord":"a","title":"other","see":["three"]}`,
      }),
    ],
  },
  {
    why:
      "a reparent closes a PARENT LOOP through records the edit did not name",
    steps: [
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one"}\n` +
          `{"id":"two","ord":"b","title":"two","parent":"one"}\n` +
          `{"id":"three","ord":"c","title":"three","parent":"two"}`,
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","parent":"three"}\n` +
          `{"id":"two","ord":"b","title":"two","parent":"one"}\n` +
          `{"id":"three","ord":"c","title":"three","parent":"two"}`,
      }),
    ],
  },
  {
    why:
      "an `after` edge closes an ORDERING LOOP through a mirror in a third file",
    steps: [
      at({
        "a.olai": `{"id":"cook","ord":"a","title":"cook"}\n` +
          `{"id":"eat","ord":"b","title":"eat","after":["cook"]}`,
        "b.olai": `{"id":"m","ord":"a","mirror":"eat"}`,
      }),
      at({
        "a.olai": `{"id":"cook","ord":"a","title":"cook","after":["m"]}\n` +
          `{"id":"eat","ord":"b","title":"eat","after":["cook"]}`,
        "b.olai": `{"id":"m","ord":"a","mirror":"eat"}`,
      }),
    ],
  },
  {
    why:
      "a mirror is moved INTO the subtree it shows, which only the downward walk " +
      "finds",
    steps: [
      at({
        "a.olai": `{"id":"top","ord":"a","title":"top"}\n` +
          `{"id":"kid","ord":"b","title":"kid","parent":"top"}`,
        "b.olai": `{"id":"m","ord":"a","mirror":"top"}`,
      }),
      at({
        "a.olai": `{"id":"top","ord":"a","title":"top"}\n` +
          `{"id":"kid","ord":"b","title":"kid","parent":"top"}\n` +
          `{"id":"m","ord":"c","mirror":"top","parent":"kid"}`,
      }),
    ],
  },
  {
    why:
      "a TITLE is edited and nothing else moves — the keystroke, which must not " +
      "cost a cycle walk and must not change a finding either",
    steps: [
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one"}\n` +
          `{"id":"two","ord":"b","title":"two","parent":"one"}`,
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one edited"}\n` +
          `{"id":"two","ord":"b","title":"two","parent":"one"}`,
      }),
    ],
  },
  {
    why:
      "two records SWAP LINES, which moves every site without moving the graph " +
      "— so two findings have to change places and nothing else may",
    steps: [
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","after":["keel"]}\n` +
          `{"id":"two","ord":"b","title":"two","after":["keel"]}`,
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","after":["gone"]}\n` +
          `{"id":"two","ord":"b","title":"two","after":["gone"]}`,
      }),
      at({
        "a.olai": `{"id":"two","ord":"b","title":"two","after":["gone"]}\n` +
          `{"id":"one","ord":"a","title":"one","after":["gone"]}`,
      }),
    ],
  },
  {
    why:
      "the `.md` a record's `doc` names is DELETED, and the record naming it is " +
      "in a file the edit never touched",
    steps: [
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","doc":"notes.md"}`,
        "b.olai": `{"id":"two","ord":"a","title":"two"}`,
        "notes.md": "# notes",
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","doc":"notes.md"}`,
        "b.olai": `{"id":"two","ord":"a","title":"two edited"}`,
      }),
    ],
  },
  {
    why:
      "the `.md` ARRIVES, so a `missing-doc` that stood goes away without its " +
      "record being edited",
    steps: [
      at({ "a.olai": `{"id":"one","ord":"a","title":"one"}` }),
      at({ "a.olai": `{"id":"one","ord":"a","title":"one","doc":"notes.md"}` }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","doc":"notes.md"}`,
        "notes.md": "# notes",
      }),
    ],
  },
  {
    why:
      "a `.md` is REWRITTEN, which names a path in the delta and moves no " +
      "membership at all",
    steps: [
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","doc":"notes.md"}`,
        "notes.md": "# notes",
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","doc":"notes.md"}`,
        "notes.md": "# notes, edited",
      }),
    ],
  },
  {
    why:
      "a `.md` is deleted and written back in ONE revision, which is a path in " +
      "both halves of the delta",
    steps: [
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","doc":"notes.md"}`,
        "notes.md": "# notes",
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","doc":"notes.md"}`,
        "notes.md": "# notes again",
        "b.olai": `{"id":"two","ord":"a","title":"two"}`,
      }),
    ],
  },
  {
    why:
      "a file stops parsing and starts again — the error scope, where a finding " +
      "is withheld and the next reading to follow is several revisions back",
    steps: [
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","after":["two"]}`,
        "b.olai": `{"id":"two","ord":"a","title":"two"}`,
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","after":["two"]}`,
        "b.olai": `{not json`,
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","after":["two"]}\n` +
          `{"id":"three","ord":"b","title":"three"}`,
        "b.olai": `{not json`,
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","after":["two"]}\n` +
          `{"id":"three","ord":"b","title":"three"}`,
        "b.olai": `{"id":"two","ord":"a","title":"two"}`,
      }),
    ],
  },
  {
    why:
      "a DUPLICATE id arrives and then leaves — the corner the patcher declines " +
      "on, so the narrowing must decline with it rather than answer over a view " +
      "whose `byId` kept one of two claims",
    declines: true,
    steps: [
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one"}`,
        "b.olai": `{"id":"two","ord":"a","title":"two"}`,
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one"}`,
        "b.olai": `{"id":"one","ord":"a","title":"also one"}`,
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one"}`,
        "b.olai": `{"id":"two","ord":"a","title":"two"}`,
      }),
    ],
  },
  {
    why:
      "every file the directory holds is rewritten at once — a `git pull`, where " +
      "nothing of the old view is left to patch onto",
    narrows: false,
    declines: true,
    steps: [
      alone({
        "a.olai": `{"id":"one","ord":"a","title":"one"}`,
        "b.olai": `{"id":"two","ord":"a","title":"two","parent":"one"}`,
      }),
      alone({
        "a.olai": `{"id":"three","ord":"a","title":"three"}`,
        "b.olai": `{"id":"four","ord":"a","title":"four","parent":"three"}`,
      }),
    ],
  },
]

test("the narrowed verdict is the full verdict, on the edits that would break a lazier one", () => {
  for (const { why, steps, narrows = true, declines = false } of CORNERS) {
    const report = replay(steps)
    expect({ why, divergences: report.divergences }).toEqual({ why, divergences: [] })
    // Every corner is a SEQUENCE, and all but one of them is about an edit the
    // narrowing has to ANSWER: a corner that only ever ran cold would be
    // asserting that the full validator equals itself. The first revision of
    // each always declines, having nothing to follow, so a corner that is about
    // a decline asks for a SECOND one.
    expect({
      why,
      narrowed: report.narrowed > 0,
      declined: report.cold > 1,
    }).toEqual({ why, narrowed: narrows, declined: declines })
  }
})

// ── generated ──────────────────────────────────────────────────────────

const ROUNDS = 60
const DEEP = 25

test("the narrowed verdict is the full verdict, over generated edit sequences", () => {
  const random = seeded(20260825)
  const found: Array<Report> = []
  for (let round = 0; round < ROUNDS; round++) {
    found.push(replay(revisionsOf(random, DEEP)))
  }
  const report = summed(found)
  // 884 narrowed, 616 cold, 678 accepted of 1,500 revisions as this is written.
  holds(report, { narrowed: ROUNDS * 4, cold: ROUNDS, accepted: ROUNDS * 4 })
  // The corpora really did reach the shapes the arms are about: sets that were
  // REFUSED (so the next validation follows a reading several edits back, with
  // a delta spanning every one of them), and sets holding a file that would not
  // parse (so a finding was withheld rather than reported). 822 and 497 as this
  // is written — and both were ZERO for the first hour this file existed,
  // because a generator written for the patcher writes sets the validator
  // condemns and a stream that is always refused never publishes a reading for
  // anything to follow. A silent arm is an arm this file says nothing about.
  expect(report.refused).toBeGreaterThan(ROUNDS)
  expect(report.unreadable).toBeGreaterThan(ROUNDS / 4)
})

const summed = (found: ReadonlyArray<Report>): Report => ({
  divergences: found.flatMap((one) => one.divergences),
  narrowed: found.reduce((held, one) => held + one.narrowed, 0),
  cold: found.reduce((held, one) => held + one.cold, 0),
  walked: found.reduce((held, one) => held + one.walked, 0),
  accepted: found.reduce((held, one) => held + one.accepted, 0),
  refused: found.reduce((held, one) => held + one.refused, 0),
  unreadable: found.reduce((held, one) => held + one.unreadable, 0),
  revisions: found.reduce((held, one) => held + one.revisions, 0),
})

// ── the real vault ─────────────────────────────────────────────────────

test("the narrowed verdict is the full verdict, over this repository's own docs/", () => {
  const vault = vaultAt(new URL("../../../docs", import.meta.url).pathname)
  expect(vault.size).toBeGreaterThan(10)
  const report = replay(edited(vault, seeded(20260826), 120))
  // 120 narrowed, 1 cold (the load, which has nothing to follow), 11 of them
  // walking the corpus anyway — this vault is a directory that VALIDATES, so
  // nearly every revision here is one the narrowing was really asked about.
  holds(report, { narrowed: 60, cold: 0, accepted: 60 })
})
