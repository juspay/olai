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
import { pinnedVault, vaultAt } from "./scope.testlib.ts"

const holds = (report: Report, floors: {
  readonly narrowed: number
  readonly whole: number
  readonly degraded?: number
  readonly declined: Readonly<Record<string, number>>
}): void => {
  expect(report.divergences).toEqual([])
  expect(report.narrowed).toBeGreaterThan(floors.narrowed)
  expect(report.whole).toBeGreaterThan(floors.whole)
  if (floors.degraded !== undefined) {
    expect(report.degraded).toBeGreaterThan(floors.degraded)
  }
  for (const [why, many] of Object.entries(floors.declined)) {
    expect({ why, reached: (report.declined[why] ?? 0) >= many })
      .toEqual({ why, reached: true })
  }
  expect(report.walked).toBeLessThan(report.narrowed)
}

const ACCEPTED = { full: true, incremental: true }
const REFUSED = { full: false, incremental: false }

test("the comparator says nothing about two reports that are the same report", () => {
  expect(differing([], [], ACCEPTED)).toBeNull()
  expect(differing(["a.olai:1 one", "b.olai:2 two"], ["a.olai:1 one", "b.olai:2 two"], REFUSED))
    .toBeNull()
})

test("one arm accepting the set and the other refusing it is the worst kind", () => {
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
  expect(differing(["a.olai:1 one"], ["a.olai:1 one", "a.olai:1 one"], REFUSED)).toEqual({
    why: "findings",
    missing: [],
    invented: ["a.olai:1 one"],
  })
})

test("the same findings in a different order is a difference, and its own kind", () => {
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

const at = (files: Record<string, string>): Revision =>
  new Map([["keel.olai", KEEL], ...Object.entries(files)])

const KEEL = `{"id":"keel","ord":"a","title":"the file nobody edits"}`

const alone = (files: Record<string, string>): Revision => new Map(Object.entries(files))

interface Corner {
  readonly why: string
  readonly steps: ReadonlyArray<Revision>
  readonly narrows?: boolean
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
    declines: true,
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
    declines: true,
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
        "a.olai": `{"id":"one","ord":"a","title":"one","desc":"[document](notes.md)"}`,
        "b.olai": `{"id":"two","ord":"a","title":"two"}`,
        "notes.md": "# notes",
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","desc":"[document](notes.md)"}`,
        "b.olai": `{"id":"two","ord":"a","title":"two edited"}`,
      }),
    ],
  },
  {
    why:
      "the `.md` ARRIVES, and a note link resolves without its " +
      "record being edited",
    steps: [
      at({ "a.olai": `{"id":"one","ord":"a","title":"one"}` }),
      at({ "a.olai": `{"id":"one","ord":"a","title":"one","desc":"[document](notes.md)"}` }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","desc":"[document](notes.md)"}`,
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
        "a.olai": `{"id":"one","ord":"a","title":"one","desc":"[document](notes.md)"}`,
        "notes.md": "# notes",
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","desc":"[document](notes.md)"}`,
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
        "a.olai": `{"id":"one","ord":"a","title":"one","desc":"[document](notes.md)"}`,
        "notes.md": "# notes",
      }),
      at({
        "a.olai": `{"id":"one","ord":"a","title":"one","desc":"[document](notes.md)"}`,
        "notes.md": "# notes again",
        "b.olai": `{"id":"two","ord":"a","title":"two"}`,
      }),
    ],
  },
  {
    why:
      "a file stops parsing and starts again — the error scope, where a finding " +
      "is withheld and the file's own page is what degrades",
    declines: true,
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
    narrows: false,
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
    declines: true,
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
    declines: true,
    steps: [
      at({
        "_olai/Properties.olai":
          `{"id":"p","ord":"a","title":"agent","custom":{"type":"ref","under":"roster"}}`,
        "r.olai": `{"id":"roster","ord":"a","title":"the agents"}\n` +
          `{"id":"grok","ord":"b","title":"Grok","parent":"roster"}`,
        "a.olai": `{"id":"one","ord":"a","title":"one","custom":{"agent":"grok"}}`,
      }),
      at({
        "_olai/Properties.olai":
          `{"id":"p","ord":"a","title":"agent","custom":{"type":"ref","under":"roster"}}`,
        "r.olai": `{"id":"roster","ord":"a","title":"the agents"}\n` +
          `{"id":"grok","ord":"b","title":"Grok"}`,
        "a.olai": `{"id":"one","ord":"a","title":"one","custom":{"agent":"grok"}}`,
      }),
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
    expect({
      why,
      narrowed: report.narrowed > 0,
      declined: report.whole > 1,
    }).toEqual({ why, narrowed: narrows, declined: declines })
  }
})

const ROUNDS = 60
const DEEP = 25

test("the narrowed verdict is the full verdict, over generated edit sequences", () => {
  const random = seeded(20260825)
  const found: Array<Report> = []
  for (let round = 0; round < ROUNDS; round++) {
    found.push(replay(revisionsOf(random, DEEP)))
  }
  const report = summed(found)
  holds(report, {
    narrowed: ROUNDS * 4,
    whole: ROUNDS,
    degraded: ROUNDS * 4,
    declined: { first: ROUNDS, refused: ROUNDS, rebuilt: ROUNDS },
  })
  expect(Object.keys(report.declined).sort()).toEqual(["first", "rebuilt", "refused"])
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
  degraded: found.reduce((held, one) => held + one.degraded, 0),
  unreadable: found.reduce((held, one) => held + one.unreadable, 0),
  revisions: found.reduce((held, one) => held + one.revisions, 0),
})

test("the narrowed verdict is the full verdict, over the real vault", () => {
  const vault = vaultAt(pinnedVault())
  expect(vault.size).toBeGreaterThan(10)
  const report = replay(edited(vault, seeded(20260826), 120))
  holds(report, { narrowed: 60, whole: 0, declined: { first: 1 } })
}, 20_000)
