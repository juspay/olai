/**
 * THE INCREMENTAL VALIDATOR AGAINST THE FULL ONE.
 *
 * `perf-validate-incremental`'s claim is an equivalence — the same verdict,
 * reached from what an edit touched — so this suite asserts nothing about what
 * either arm SAYS. It replays sequences of revisions through the real
 * `validate` twice per revision — once with the reading it follows, which is
 * the narrowed arm and the product's own answer since `perf-validate-flip`,
 * and once with nothing to follow, which is the six whole-set rules by
 * construction — and asserts an EMPTY divergence list plus enough counting to
 * say the run was not vacuous ({@link ./incremental.testlib.ts} is the harness
 * and argues that shape; `./validate.test.ts` is where what a finding says is
 * pinned).
 *
 * IT IS THE SUITE THE FLIP RESTS ON, which is a change of weight and not of
 * code: while the narrowing was a shadow a wrong answer here cost a log line,
 * and now it is a write accepted or refused differently. What that bought is
 * one arm fewer to be wrong — the comparison used to be against a validator
 * only the shadow called, and it is now against the same exported function
 * under its other argument.
 *
 * THREE CORPORA, and each is here because the ones before it cannot reach what
 * it holds:
 *
 *   - the CORNERS, written by hand ({@link CORNERS}) — each one an edit that a
 *     lazier narrowing gets wrong, named with the rule it is about. A generator
 *     produces these at random or not at all, and every one of them is a
 *     sentence in `./incremental.ts`'s own argument that would otherwise be
 *     checked by nothing. THEY CARRY THE RULES THE GENERATED ARM CANNOT: the
 *     repair that makes a generated stream publishable takes duplicate ids,
 *     parent loops, foreign parents, placements-as-parents, mirror containment
 *     and ordering loops out of it on purpose
 *     (`./incremental.testlib.ts`'s `written`), so those classes are HERE and
 *     the refusal count over there is not a coverage figure for them;
 *   - GENERATED sequences, over the same corpora and the same edits the patcher
 *     is held to (`./corpora.testlib.ts`), with the documents beside them
 *     churning and a file breaking and mending — which is where the volume is,
 *     and what it drives is `unknown-target`, `missing-doc` and the unreadable
 *     file, at size and in sequence;
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
import {
  differing,
  edited,
  replay,
  type Report,
  type Revision,
  revisionsOf,
} from "./incremental.testlib.ts"
import { vaultAt } from "./scope.testlib.ts"

/** The gate, in one place: no divergence, and both arms of the thing under test
 *  were reached. A replay that never narrowed, or one that narrowed every time
 *  by walking the corpus anyway, proves the equivalence of nothing. */
const holds = (report: Report, floors: {
  readonly narrowed: number
  readonly whole: number
  readonly accepted: number
  /** Which DOORS the whole-corpus arm was reached through, and how many times
   *  each at least. A count of them is a sum over six different things
   *  ({@link ./validate.ts}'s `Cold`), and a run that met the sum by booting
   *  sixty times would have exercised nothing. */
  readonly declined: Readonly<Record<string, number>>
}): void => {
  expect(report.divergences).toEqual([])
  expect(report.narrowed).toBeGreaterThan(floors.narrowed)
  expect(report.whole).toBeGreaterThan(floors.whole)
  expect(report.accepted).toBeGreaterThan(floors.accepted)
  for (const [why, many] of Object.entries(floors.declined)) {
    // Named rather than counted, so a failure says WHICH door the corpus
    // stopped reaching rather than that a total moved.
    expect({ why, reached: (report.declined[why] ?? 0) >= many })
      .toEqual({ why, reached: true })
  }
  // The narrowing has to have NARROWED on most of them. Left unchecked, an
  // `incrementally` that answered `walked: true` every time — one that ran the
  // cycle walks and the doc walk on every edit — would agree with the full arm
  // on every revision here and buy nothing at all.
  expect(report.walked).toBeLessThan(report.narrowed)
}

// ── the comparator ─────────────────────────────────────────────────────

/**
 * THE GATE CAN SEE A DIFFERENCE.
 *
 * Everything below this section is a differential, and a differential whose
 * comparator is blind is a green suite that means nothing. The way to prove a
 * comparator is not blind is to hand it differences rather than to write a
 * validator that is wrong in exactly one way — which is why
 * {@link ./incremental.testlib.ts}'s `differing` is a function of two lists of
 * report lines and this is a table.
 *
 * These cases came over from the shadow's own suite unchanged, because the
 * comparator did: what moved at the flip is who runs the other arm, not what
 * counts as the two of them parting.
 */

const ACCEPTED = { full: true, incremental: true }
const REFUSED = { full: false, incremental: false }

test("the comparator says nothing about two reports that are the same report", () => {
  expect(differing([], [], ACCEPTED)).toBeNull()
  expect(differing(["a.olai:1 one", "b.olai:2 two"], ["a.olai:1 one", "b.olai:2 two"], REFUSED))
    .toBeNull()
})

test("one arm accepting the set and the other refusing it is the worst kind", () => {
  // The verdict, not the wording: this is a write landing or being turned away
  // differently, which is what a person would feel.
  expect(differing([], ["a.olai:1 one"], { full: true, incremental: false })).toEqual({
    why: "verdict",
    missing: [],
    invented: ["a.olai:1 one"],
  })
})

test("a finding one arm has and the other does not is named in the entry", () => {
  expect(differing(["a.olai:1 one", "b.olai:2 two"], ["a.olai:1 one"], REFUSED)).toEqual({
    why: "findings",
    missing: ["b.olai:2 two"],
    invented: [],
  })
  expect(differing(["a.olai:1 one"], ["a.olai:1 one", "b.olai:2 two"], REFUSED)).toEqual({
    why: "findings",
    missing: [],
    invented: ["b.olai:2 two"],
  })
})

test("a sentence said twice where the other arm said it once is a difference", () => {
  // A plain set difference would call these two lists equal, and the shape it
  // would hide is a rule asked about one record twice — which is exactly what a
  // narrowing that failed to dedupe its candidates would produce.
  expect(differing(["a.olai:1 one"], ["a.olai:1 one", "a.olai:1 one"], REFUSED)).toEqual({
    why: "findings",
    missing: [],
    invented: ["a.olai:1 one"],
  })
})

test("the same findings in a different order is a difference, and its own kind", () => {
  // Real, and quieter than the two above: the report is what a reader reads
  // down, and two loads of one directory promise each other the same order.
  //
  // WHAT THE ENTRY CARRIES IS WHERE: this case has nothing in `missing` or
  // `invented` by definition, so the first index they part at — with the line
  // each arm has there — is what a reader acts on, rather than both reports
  // whole, which on a badly broken directory is an assertion message the size
  // of the report.
  expect(differing(["a.olai:1 one", "a.olai:1 two"], ["a.olai:1 two", "a.olai:1 one"], REFUSED))
    .toEqual({
      why: "order",
      missing: [],
      invented: [],
      parted: { at: 0, full: "a.olai:1 one", incremental: "a.olai:1 two" },
    })
})

test("...and it names the first place they part, not the whole of both reports", () => {
  const full = ["a:1 x", "b:1 y", "c:1 z"]
  const said = ["a:1 x", "c:1 z", "b:1 y"]
  expect(differing(full, said, REFUSED)).toEqual({
    why: "order",
    missing: [],
    invented: [],
    parted: { at: 1, full: "b:1 y", incremental: "c:1 z" },
  })
})

// ── the corners ────────────────────────────────────────────────────────

/**
 * A revision from a plain object, so a corner reads as the directory it is —
 * with a KEEL under it, which is not decoration.
 *
 * A patch is only taken when something is left standing to patch ONTO
 * ({@link ./patch.ts} declines when the delta names every file that holds a
 * record), so a two-file corner whose edit touches both files rebuilds, walks
 * the whole corpus on both arms, and asserts that the full validator agrees
 * with itself. One record
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
      "a `blocks`-only loop — the same arrow the corner above writes as `after`, " +
      "read from the other end, and the one shape the generated stream cannot " +
      "reach because `written()` forces every edge into a DAG by corpus order",
    steps: [
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one"}\n` +
          `{"id":"two","ord":"b","title":"two"}`,
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","blocks":["two"]}\n` +
          `{"id":"two","ord":"b","title":"two","blocks":["one"]}`,
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
      "a DECLARATION changes type, so every value of that key in the directory " +
      "is back in question and no index says which records carry it",
    steps: [
      at({
        "_olai/Properties.olai": `{"id":"p","ord":"a","title":"pr","custom":{"type":"text"}}`,
        "a.olai": `{"id":"one","ord":"a","title":"one","custom":{"pr":"#193"}}`,
      }),
      at({
        "_olai/Properties.olai": `{"id":"p","ord":"a","title":"pr","custom":{"type":"int"}}`,
        "a.olai": `{"id":"one","ord":"a","title":"one","custom":{"pr":"#193"}}`,
      }),
      at({
        "_olai/Properties.olai": `{"id":"p","ord":"a","title":"pr","custom":{"type":"int"}}`,
        "a.olai": `{"id":"one","ord":"a","title":"one","custom":{"pr":"193"}}`,
      }),
    ],
  },
  {
    why:
      "a VARIANT leaves the roster a `ref` points at, so an untouched record's " +
      "value goes stale the way a dangling edge does",
    steps: [
      at({
        "_olai/Properties.olai":
          `{"id":"p","ord":"a","title":"agent","custom":{"type":"ref","under":"roster"}}`,
        "r.olai": `{"id":"roster","ord":"a","title":"the agents"}\n` +
          `{"id":"grok","ord":"b","title":"Grok","parent":"roster"}`,
        "a.olai": `{"id":"one","ord":"a","title":"one","custom":{"agent":"grok"}}`,
      }),
      // Reparented OUT of the roster — the id still exists, so nothing about
      // `byId` moved and the domain still shrank.
      at({
        "_olai/Properties.olai":
          `{"id":"p","ord":"a","title":"agent","custom":{"type":"ref","under":"roster"}}`,
        "r.olai": `{"id":"roster","ord":"a","title":"the agents"}\n` +
          `{"id":"grok","ord":"b","title":"Grok"}`,
        "a.olai": `{"id":"one","ord":"a","title":"one","custom":{"agent":"grok"}}`,
      }),
      // ...and put back, which has to take the finding away again.
      at({
        "_olai/Properties.olai":
          `{"id":"p","ord":"a","title":"agent","custom":{"type":"ref","under":"roster"}}`,
        "r.olai": `{"id":"roster","ord":"a","title":"the agents"}\n` +
          `{"id":"grok","ord":"b","title":"Grok","parent":"roster"}`,
        "a.olai": `{"id":"one","ord":"a","title":"one","custom":{"agent":"grok"}}`,
      }),
    ],
  },
  {
    why:
      "a `doc`-typed value's document goes away, which only the `.md` carry can " +
      "notice",
    steps: [
      at({
        "_olai/Properties.olai": `{"id":"p","ord":"a","title":"brief","custom":{"type":"doc"}}`,
        "a.olai": `{"id":"one","ord":"a","title":"one","custom":{"brief":"b.md"}}`,
        "b.md": "a brief",
      }),
      at({
        "_olai/Properties.olai": `{"id":"p","ord":"a","title":"brief","custom":{"type":"doc"}}`,
        "a.olai": `{"id":"one","ord":"a","title":"one","custom":{"brief":"b.md"}}`,
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
    // narrowing has to ANSWER: a corner where the narrowing declined every time
    // would be asserting that the full validator equals itself. The first
    // revision of each always declines, having nothing to follow, so a corner
    // that is about a decline asks for a SECOND one.
    expect({
      why,
      narrowed: report.narrowed > 0,
      declined: report.whole > 1,
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
  // 884 narrowed, 616 whole (128 first loads, 488 rebuilds), 678 accepted of
  // 1,500 revisions as this is written.
  holds(report, {
    narrowed: ROUNDS * 4,
    whole: ROUNDS,
    accepted: ROUNDS * 4,
    declined: { first: ROUNDS, rebuilt: ROUNDS * 3 },
  })
  // THE OTHER THREE DOORS STAY SHUT when the caller drives this the way the
  // store does, and that is a claim rather than an absence. `refused` is the
  // dirty-ledger door and cannot fire: `Previous` is the last PUBLISHED reading,
  // so the ledger a validation follows is always clean. `duplicates` cannot
  // either: a corpus with two claims on one id is declined one step earlier, by
  // the patcher, and arrives here as `rebuilt`. `documents` is the delta's own
  // honesty about `.md` membership, and this harness computes its deltas from
  // the revisions it wrote. Any of them appearing is news — either the store's
  // discipline changed or the harness stopped reproducing it.
  expect(Object.keys(report.declined).sort()).toEqual(["first", "rebuilt"])
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
  whole: found.reduce((held, one) => held + one.whole, 0),
  declined: found.reduce<Record<string, number>>((held, one) => {
    for (const [why, many] of Object.entries(one.declined)) {
      held[why] = (held[why] ?? 0) + many
    }
    return held
  }, {}),
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
  // 120 narrowed, 1 whole (the load, which has nothing to follow), 11 of them
  // walking the corpus anyway — this vault is a directory that VALIDATES, so
  // nearly every revision here is one the narrowing was really asked about.
  holds(report, { narrowed: 60, whole: 0, accepted: 60, declined: { first: 1 } })
})
