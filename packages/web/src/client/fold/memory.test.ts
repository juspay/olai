/**
 * The shape this browser keeps folds in, as a pure question: what the entry
 * says, what a fold does to it, and what a write drops on the way past.
 *
 * The circuit over it is `createPreference`'s (../preference.ts, tested
 * beside it); what is pinned HERE is the arithmetic — plus the one wiring
 * fact that is this file's own to hold: a write starts from the STORED ENTRY
 * unioned with what the tab holds, which the last test drives through
 * `setFolded` against real (shimmed) storage, because no pure test of
 * `combined` can notice `setFolded` forgetting to call it. The e2e feature is
 * what says a fold survives a reload.
 *
 * PRUNING IS ASKED NOW, not walked (`./refiling.ts`), and the laws below are
 * the same three they always were — a node that moved keeps its fold under the
 * file it moved to, gone means gone from the SET, and a file nothing can speak
 * about keeps its folds. What changed is their INPUT: the whole id→file map of
 * a copy of the directory became the answer to a question about the ids this
 * browser actually remembers. {@link answering} below is what the server does
 * with such a question, so each law still reads as "the set says this, the
 * memory becomes that". The fourth law is new and is the one the question
 * brought with it: an id nobody asked about is not an id the set denied.
 */

import { expect, test } from "bun:test"

import { remembering } from "../preference.testlib.ts"

import {
  combined,
  type Folds,
  FOLDS_KEY,
  type Homes,
  homesOf,
  memoryOf,
  parseFolds,
  printFolds,
  pruned,
  setFolded,
  withFolds,
} from "./memory.ts"

const foldsOf = (entry: Record<string, ReadonlyArray<string>>) =>
  new Map(Object.entries(entry).map(([file, ids]) => [file, new Set(ids)]))

/**
 * The server's side of the question, in four lines — `@olai/ops`' `homes`
 * over a `live` map instead of over a derivation (its own test is beside it,
 * on a real one).
 *
 * It is here so that the laws below can be stated the way they were before the
 * walk became a question: this is what the set SAYS, and the assertion is what
 * the memory does about it. It answers the WIRE shape and hands it to
 * {@link homesOf} exactly as the door does, so this stand-in cannot invent a
 * reading of its own — what it stands in for is the walk, not the rule.
 */
const answering = (
  folds: Folds,
  live: ReadonlyMap<string, ReadonlySet<string>>,
): Homes => {
  // The set's own `byId`, in one line: an id names one record, so what the
  // server does with an index this stand-in has to build first.
  const at = new Map<string, string>()
  for (const [file, ids] of live) for (const id of ids) at.set(id, file)
  return homesOf(memoryOf(folds), {
    homes: [...folds.values()]
      .flatMap((ids) => [...ids])
      .flatMap((id) => {
        const file = at.get(id)
        return file === undefined ? [] : [{ id, file }]
      }),
    loaded: [...folds.keys()].filter((file) => live.has(file)),
  })
}

test("what is stored is collapsed ids, grouped by file", () => {
  const folds = withFolds(new Map(), [
    { id: "kitchen", file: "house.olai" },
    { id: "herbs", file: "garden.olai" },
  ], true)
  expect(printFolds(folds)).toBe(
    `{"garden.olai":["herbs"],"house.olai":["kitchen"]}`,
  )
  expect(parseFolds(printFolds(folds))).toEqual(
    foldsOf({ "garden.olai": ["herbs"], "house.olai": ["kitchen"] }),
  )
})

test("a node folded while another file is open is remembered under ITS file", () => {
  // The mirrors ruling, in the store: `herbs` lives in garden.olai, so folding
  // the mirror of it that hangs in house.olai is a fact about garden.olai —
  // which is what makes both placements read as folded.
  const folds = withFolds(new Map(), [{ id: "herbs", file: "garden.olai" }], true)
  expect(folds.get("house.olai")).toBeUndefined()
  expect([...(folds.get("garden.olai") ?? [])]).toEqual(["herbs"])
})

test("unfolding removes the id, and the last one takes the file with it", () => {
  const folded = foldsOf({ "house.olai": ["kitchen", "install"] })
  const one = withFolds(folded, [{ id: "install", file: "house.olai" }], false)
  expect([...(one.get("house.olai") ?? [])]).toEqual(["kitchen"])

  const none = withFolds(one, [{ id: "kitchen", file: "house.olai" }], false)
  expect(none.size).toBe(0)
  // ...and nothing at all is a key REMOVED, not an empty object left behind.
  expect(printFolds(none)).toBeNull()
})

test("a node nobody has touched is simply absent, and therefore open", () => {
  // The default is the SHAPE, not a value: an expand-all over a page nobody
  // has folded writes nothing at all.
  const folds = withFolds(new Map(), [{ id: "kitchen", file: "house.olai" }], false)
  expect(printFolds(folds)).toBeNull()
})

test("collapse-all is one write, not one per node", () => {
  const folds = withFolds(new Map(), [
    { id: "kitchen", file: "house.olai" },
    { id: "install", file: "house.olai" },
    { id: "herbs", file: "garden.olai" },
  ], true)
  expect([...(folds.get("house.olai") ?? [])].sort()).toEqual(["install", "kitchen"])
  expect([...(folds.get("garden.olai") ?? [])]).toEqual(["herbs"])
})

test("a value this app did not write is nothing, and the reader gets the default", () => {
  // Every one of these is "everything is open" rather than an error to report:
  // an older olai, a console, a half-written entry.
  expect(parseFolds(null).size).toBe(0)
  expect(parseFolds("hello").size).toBe(0)
  expect(parseFolds(`["house.olai"]`).size).toBe(0)
  expect(parseFolds(`{"house.olai":"kitchen"}`).size).toBe(0)
  // ...and a bad member does not condemn the good ones beside it.
  expect(parseFolds(`{"house.olai":["kitchen",7,null]}`)).toEqual(
    foldsOf({ "house.olai": ["kitchen"] }),
  )
})

test("a node that MOVED to another file keeps its fold, under the new file", () => {
  // The case pruning by bucket alone gets wrong, and it is the ordinary one:
  // `archive` keeps the id and moves the record to `_olai/Trash.olai`, leaving the
  // source file served with the rest of its nodes. Read as "not declared by
  // house.olai any more" that is indistinguishable from a deletion — and the
  // whole point of keying by id is that a fold survives a move.
  const live = new Map([
    ["house.olai", new Set(["kitchen", "order"])],
    ["_olai/Trash.olai", new Set(["install"])],
  ])
  const folds = foldsOf({ "house.olai": ["kitchen", "install"] })
  expect(pruned(folds, answering(folds, live))).toEqual(
    foldsOf({ "house.olai": ["kitchen"], "_olai/Trash.olai": ["install"] }),
  )
})

test("the fold of a node that is gone is dropped", () => {
  // Gone means gone from the whole SET, not from the file it used to be in —
  // which is what the move above is the other side of.
  const live = new Map([
    ["house.olai", new Set(["kitchen"])],
    ["garden.olai", new Set(["herbs"])],
  ])
  const folds = foldsOf({ "house.olai": ["kitchen", "deleted"] })
  expect(pruned(folds, answering(folds, live))).toEqual(
    foldsOf({ "house.olai": ["kitchen"] }),
  )
})

test("a file this browser cannot see keeps its folds", () => {
  // The whole reason the memory is grouped by file. A file that will not parse,
  // or that this directory is not serving right now, says nothing about whether
  // its nodes exist — and pruning against a set that does not contain it would
  // throw away the folds of every outline the reader is not looking at.
  const live = new Map([["house.olai", new Set(["kitchen"])]])
  const unseen = foldsOf({ "garden.olai": ["herbs"] })
  expect(pruned(unseen, answering(unseen, live))).toEqual(
    foldsOf({ "garden.olai": ["herbs"] }),
  )
  // Nothing loaded at all prunes nothing.
  const nothing = foldsOf({ "house.olai": ["gone"] })
  expect(pruned(nothing, answering(nothing, new Map()))).toEqual(
    foldsOf({ "house.olai": ["gone"] }),
  )
})

test("an id lives in ONE bucket: folding it where it moved to clears the old one", () => {
  // The write half of the same rule. A stale copy would win anyway — the set
  // every row reads is the union — so "one node, one fold state" has to hold in
  // the storage and not only in the id.
  const stale = foldsOf({ "house.olai": ["install"] })
  expect(withFolds(stale, [{ id: "install", file: "_olai/Trash.olai" }], true))
    .toEqual(foldsOf({ "_olai/Trash.olai": ["install"] }))
  // ...and unfolding finds it wherever it is, not only under the file named.
  expect(withFolds(stale, [{ id: "install", file: "_olai/Trash.olai" }], false))
    .toEqual(new Map())
})

test("a write starts from the ENTRY unioned with what this tab holds", () => {
  // Two tabs are not making rival picks the way two theme presses are: they are
  // each adding a different fact. Starting from the held map alone is how one
  // tab's fold disappears when the other writes from a map that predates it.
  const stored = foldsOf({ "house.olai": ["kitchen"] })
  const held = foldsOf({ "garden.olai": ["herbs"] })
  expect(combined(stored, held)).toEqual(
    foldsOf({ "house.olai": ["kitchen"], "garden.olai": ["herbs"] }),
  )
  // The same file from both sides is one bucket, not two.
  expect(combined(stored, foldsOf({ "house.olai": ["order"] }))).toEqual(
    foldsOf({ "house.olai": ["kitchen", "order"] }),
  )
  // A browser that will not give its storage back reads as nothing, and then
  // the union is exactly what this tab is holding.
  expect(combined(parseFolds(null), held)).toEqual(held)
})

test("an unfold still removes, because the change goes on after the union", () => {
  const base = combined(
    foldsOf({ "house.olai": ["kitchen", "order"] }),
    foldsOf({ "house.olai": ["kitchen"] }),
  )
  expect(withFolds(base, [{ id: "kitchen", file: "house.olai" }], false)).toEqual(
    foldsOf({ "house.olai": ["order"] }),
  )
})

test("a write starts from the ENTRY: a sibling tab's fold this tab never saw survives", () => {
  // The wiring fact, driven end to end through `setFolded` and the factory's
  // storage, because every test above exercises `combined` as a pure function
  // and a `setFolded` that stopped calling it — base of what this tab holds
  // alone, classic last-write-wins, the exact flattening #138 exists to
  // forbid — would leave all of them green while a sibling tab's fold is
  // thrown away.
  remembering((store) => {
    // This tab folds herbs; the signal now holds it.
    setFolded([{ id: "herbs", file: "garden.olai" }], true)
    // A sibling tab rewrites the entry with a fold of its own. No `storage`
    // event reaches this tab (`followFolds` was never started), so the signal
    // still knows only about herbs — exactly the window the union covers.
    store.set(FOLDS_KEY, `{"house.olai":["kitchen"]}`)
    // This tab's next write must not throw the sibling's fold away.
    setFolded([{ id: "install", file: "house.olai" }], true)
    expect(store.get(FOLDS_KEY)).toBe(
      `{"garden.olai":["herbs"],"house.olai":["install","kitchen"]}`,
    )
    // Unfold everything so the module signal is empty for whoever runs next.
    setFolded(
      [
        { id: "herbs", file: "garden.olai" },
        { id: "install", file: "house.olai" },
        { id: "kitchen", file: "house.olai" },
      ],
      false,
    )
  })
})

test("an id the question did not name is left exactly where it is", () => {
  // The law the ROUND TRIP brought with it, and the one a walk never needed: a
  // reader goes on folding while a question is out, and a sibling tab may write
  // in the meantime. The set said nothing about `fresh` because nobody asked it
  // — which is not the same as saying it does not have it, and reading the two
  // the same way would drop a fold made a moment ago.
  const asked = foldsOf({ "house.olai": ["kitchen"] })
  const live = new Map([["house.olai", new Set(["kitchen"])]])
  const since = foldsOf({ "house.olai": ["kitchen", "fresh"] })
  expect(pruned(since, answering(asked, live))).toEqual(since)
})

test("the answer is read against the question, never on its own", () => {
  // What `homesOf` is for, and why it takes both. The set says NOTHING about an
  // id it has no record for, so an answer read alone cannot tell "the set denies
  // this" from "nobody mentioned it" — the folds that were sent say which, and
  // the file a fold is under says whether the silence is evidence at all.
  const asked = foldsOf({
    "house.olai": ["kitchen", "deleted"],
    "garden.olai": ["herbs"],
  })
  expect(
    homesOf(memoryOf(asked), {
      homes: [{ id: "kitchen", file: "_olai/Trash.olai" }],
      // garden.olai is not here: it parses no more, so it testifies about
      // nothing and `herbs` gets no entry at all.
      loaded: ["house.olai"],
    }),
  ).toEqual(
    new Map([
      // where it is now...
      ["kitchen", "_olai/Trash.olai"],
      // ...gone, said by a file that can say it...
      ["deleted", null],
      // ...and `herbs` absent, which is the third answer.
    ]),
  )
})
