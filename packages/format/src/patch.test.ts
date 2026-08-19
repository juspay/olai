/**
 * The patcher against its oracle.
 *
 * `derive` IS the specification of what a view is, so this suite does not
 * assert what the patcher computes — it asserts that the patcher and the
 * rebuild cannot be told apart. Generated corpora, generated deltas, both views
 * built, compared whole:
 *
 *     patch(derive(before), delta) === derive(after)
 *
 * The generator writes the awkward sets on purpose — duplicate ids, mirrors of
 * mirrors, chains that dangle, edges that name a placement, parents in another
 * file, an `_olai/Trash.olai` — because those are exactly the corners where an
 * incremental index and a rebuilt one can quietly disagree, and because
 * `derive` itself is written to answer over sets the validator has condemned.
 * The corners it reaches only by luck are pinned by hand below, each with the
 * reason it could not be left to a seed.
 *
 * AND IT WRITES THE STRUCTURAL EDITS, which is the correction grok's review
 * forced: a generator that only ever changed a record's FIELDS could not reach
 * the case where the same ids arrive in a different order, and that was a real
 * bug in `byId`'s key order that these five hundred rounds went green over. It
 * swaps two records' lines, deletes one, and moves one from one file into
 * another verbatim — the three edits that change where a record IS without
 * changing which records there are.
 *
 * WHAT "the same" MEANS here is a decision, and it is made in {@link readable}
 * rather than left to a deep-equality helper: three of the eleven indexes promise
 * an ORDER their keys are read in, and the rest are asked one key at a time.
 * Comparing all ten by key order would hold the patcher to a promise no reader
 * spends; comparing none of them would let it silently reorder the two that a
 * reader does.
 *
 * AND IT MUST REALLY PATCH. A patcher that declined every time would satisfy
 * every assertion above and buy nothing, so {@link patched} — the incremental
 * answer with the fallback taken off — is what the property test calls, and a
 * decline is counted rather than tolerated.
 */

import { expect, test } from "bun:test"

import { derive, type Derived } from "./derive.ts"
import { FIXTURE_FILE, nodesOf, recordsOf, seeded, setOf } from "./fixtures.testlib.ts"
import { patch, patched, type SetDelta } from "./patch.ts"
import { nearestId } from "./suggest.ts"

/** A corpus as a fixture writes one: path → the file's JSONL. */
type Corpus = Record<string, string>

const viewOf = (corpus: Corpus): Derived => derive(recordsOf(setOf(corpus)))

/** What moved between two corpora, in the frame the wire already speaks: a
 *  file whose text changed is an upsert, a file that went away is a remove. */
const deltaOf = (before: Corpus, after: Corpus): SetDelta => ({
  upserts: Object.entries(after)
    .filter(([file, text]) => before[file] !== text)
    .map(([file, text]) => [file, { nodes: nodesOf(text, file) }] as const),
  removes: Object.keys(before).filter((file) => !(file in after)),
})

/**
 * A whole view, in the shape the comparison is about.
 *
 * KEY ORDER IS KEPT for the three indexes something reads in order:
 * `byId`, because the did-you-mean behind every unknown-target error walks its
 * keys; `namedBy`, because the validator walks it to report ids nothing
 * declares, and two findings at one site come out in the order the corpus first
 * named them; `byFile`, because the flat list of records IS that map read in
 * order, so a key in the wrong place is a corpus in the wrong order.
 *
 * The other eight are asked one key at a time — `derived.children.get(id)`,
 * `derived.status.get(id)` — and are sorted here so the comparison is about
 * what they ANSWER. Their values are compared in order all the same, including
 * the two that are sets: `mirrorsOf` and `edgesTo` promise corpus order to
 * whoever spreads them, and `toEqual` over a `Set` would only read membership.
 *
 * `taggedBy` is deliberately in the sorted half. It is the one reverse index
 * that promises its VALUES in corpus order and nothing about its keys, which is
 * exactly what lets the patcher add and drop keys in place — so comparing key
 * order here would be this test holding the patcher to a promise the index does
 * not make, and the two would have to be changed together to relax it.
 */
const readable = (derived: Derived): unknown => ({
  nodes: derived.nodes,
  byId: [...derived.byId],
  byFile: [...derived.byFile],
  namedBy: [...derived.namedBy],
  children: byKey(derived.children),
  status: byKey(derived.status),
  after: byKey(derived.after),
  blocked: byKey(derived.blocked),
  mirrorsOf: byKey(spread(derived.mirrorsOf)),
  edgesTo: byKey(spread(derived.edgesTo)),
  taggedBy: byKey(derived.taggedBy),
})

const byKey = <V>(map: ReadonlyMap<string, V>): ReadonlyArray<readonly [string, V]> =>
  [...map].sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0))

const spread = (
  index: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlyMap<string, ReadonlyArray<string>> =>
  new Map([...index].map(([id, members]) => [id, [...members]]))

/** The two views, compared — and, when they differ, the corpus that did it,
 *  because a property test that says only "not equal" over generated input is
 *  a test nobody can act on. */
const same = (found: Derived, oracle: Derived, story: () => string): void => {
  try {
    expect(readable(found)).toEqual(readable(oracle) as never)
  } catch (cause) {
    throw new Error(`${cause instanceof Error ? cause.message : String(cause)}\n\n${story()}`)
  }
}

// ── the property ───────────────────────────────────────────────────────

const pick = <T>(random: () => number, from: ReadonlyArray<T>): T =>
  from[Math.floor(random() * from.length)] as T

/** Five paths, and each of them says something: two plain outlines, one in a
 *  directory (so path order is not file-name order), one in a directory NAMED
 *  after a file beside it (so the two readings of path order — a plain string
 *  compare and a walk that descends — disagree about which comes first, which
 *  is slice 4's landmine and is now one answer, `byPath`), and the archive,
 *  whose records are exempt from blockedness at both ends of an arrow. */
const FILES = ["a.olai", "a/inner.olai", "b.olai", "deep/c.olai", "_olai/Trash.olai"] as const
/** The names records are drawn from — small enough that a target often names a
 *  record that is really there, and often one that is not. */
const IDS = Array.from({ length: 24 }, (_, at) => `n${at}`)
/** Three of them, so siblings tie on `ord` and the tie-break gets exercised. */
const ORDS = ["a", "b", "c"] as const

/**
 * An id for the next record: a fresh one nearly always, one already claimed
 * now and then.
 *
 * Deliberately not uniform. Drawing ids uniformly from a pool makes a duplicate
 * the RULE at these corpus sizes, and a duplicate is the one corner the patcher
 * hands straight back to the rebuild — so a uniform generator would have
 * measured the fallback five hundred times and the patcher hardly at all. This
 * writes the corpora a directory actually holds, with the corner still turning
 * up often enough to be tested.
 */
const idFor = (random: () => number, used: Set<string>): string => {
  const free = IDS.filter((id) => !used.has(id))
  const id = random() < 0.08 || free.length === 0
    ? pick(random, [...used, ...free])
    : pick(random, free)
  used.add(id)
  return id
}

/**
 * A tag for prose to write, or nothing — what `taggedBy` is keyed by.
 *
 * Mostly an `@` on an id the corpus really uses, so a mention is usually a
 * REFERENCE the reading over this index would draw; sometimes a word nothing
 * declares, which is a person tag and has to file exactly the same way, since
 * the index is about what prose says rather than about what exists.
 *
 * BOTH SIGILS, and the `#` half draws from the SAME pool of ids on purpose:
 * `#n3` and `@n3` are two keys of one map that a sigil-stripped index would
 * have collided, and the only way a generated corpus reaches that pair is by
 * spelling topics the way it spells mentions.
 */
const tagged = (random: () => number): string => {
  const roll = random()
  if (roll < 0.55) return ""
  if (roll < 0.8) return ` @${pick(random, IDS)}`
  if (roll < 0.92) return ` #${pick(random, IDS)}`
  return roll < 0.96 ? " @nobody" : " #topic"
}

const fileOf = (random: () => number, used: Set<string>): string => {
  const lines: Array<string> = []
  const own: Array<string> = []
  const many = Math.floor(random() * 5)
  for (let at = 0; at < many; at++) {
    const id = idFor(random, used)
    const record: Record<string, unknown> = { id, ord: pick(random, ORDS) }
    // Same-file usually, and now and then a parent in ANOTHER file — a set the
    // validator condemns and `derive` still answers, and the only way to get
    // two siblings whose `ord` tie has to break on corpus order rather than on
    // line number alone (`bySibling`).
    if (own.length > 0 && random() < 0.4) {
      record["parent"] = random() < 0.7 ? pick(random, own) : pick(random, [...used])
    }
    if (random() < 0.25) record["mirror"] = pick(random, IDS)
    else {
      record["title"] = `line ${at}${tagged(random)}`
      if (random() < 0.4) record[pick(random, ["done", "doing", "todo"])] = true
      if (random() < 0.3) record["after"] = [pick(random, IDS)]
      if (random() < 0.3) record["blocks"] = [pick(random, IDS)]
      if (random() < 0.2) record["see"] = [pick(random, IDS)]
      // A note, sometimes with a tag in it — the second half of what
      // `taggedBy` files, and the reason a title alone would not do: a
      // record writing one tag in BOTH is one entry, so the fold's
      // once-per-record rule is only reachable from here.
      if (random() < 0.3) record["desc"] = `a note${tagged(random)}${tagged(random)}`
    }
    own.push(id)
    lines.push(JSON.stringify(record))
  }
  return lines.join("\n")
}

/** A corpus, and the ids it has spent — the delta below draws from the same
 *  pool, so a rewritten file goes on naming records its neighbours hold. */
const corpusOf = (random: () => number): { files: Corpus; used: Set<string> } => {
  const files: Corpus = {}
  const used = new Set<string>()
  // A file the directory does not hold at all, so a delta can bring one in and
  // the flat list has to find its place in path order.
  for (const file of FILES) if (random() < 0.75) files[file] = fileOf(random, used)
  return { files, used }
}

/**
 * One file, edited the way a person edits one: the same records, one of them
 * changed. This is the delta the patcher is FOR — a keystroke, a mark, an edge
 * — and a generator that only ever replaced whole files would have tested the
 * arriving-corpus path over and over and the keystroke path never.
 */
const tweak = (random: () => number, text: string): string => {
  const lines = text.split("\n").filter((line) => line !== "")
  if (lines.length === 0) return text
  const at = Math.floor(random() * lines.length)
  const roll = random()
  // Two records SWAP LINES. No id is minted and none is dropped, and every
  // index keyed by where a record IS has to move — which is the case the
  // patcher got wrong until grok reproduced it, precisely because a generator
  // that only ever edited fields could not reach it.
  if (roll < 0.1 && lines.length > 1) {
    const other = Math.floor(random() * lines.length)
    const held = lines[at] as string
    lines[at] = lines[other] as string
    lines[other] = held
    return lines.join("\n")
  }
  // The record goes away, which is the delete a patcher has to answer for: an
  // id leaves the corpus and whatever named it is left naming nothing.
  if (roll < 0.2) {
    lines.splice(at, 1)
    return lines.join("\n")
  }
  const record = JSON.parse(lines[at] as string) as Record<string, unknown>
  if ("mirror" in record) record["mirror"] = pick(random, IDS)
  else if (roll < 0.4) record["title"] = `edited ${Math.floor(random() * 100)}${tagged(random)}`
  else if (roll < 0.45) {
    // The note rewritten — the edit this whole feature is about, since a
    // reference somebody adds in prose is a keystroke in a `desc` and nothing
    // else about the record moves.
    const written = `edited note${tagged(random)}`
    if (written === "edited note" && random() < 0.5) delete record["desc"]
    else record["desc"] = written
  } else if (roll < 0.65) {
    for (const mark of ["done", "doing", "todo"]) delete record[mark]
    if (random() < 0.75) record[pick(random, ["done", "doing", "todo"])] = true
  } else if (roll < 0.85) {
    if (random() < 0.5) record["after"] = [pick(random, IDS)]
    else delete record["after"]
  } else {
    if (random() < 0.5) record["blocks"] = [pick(random, IDS)]
    else delete record["blocks"]
  }
  lines[at] = JSON.stringify(record)
  return lines.join("\n")
}

/**
 * One record moved OUT of a file and INTO another, verbatim.
 *
 * An archive, a reparent across outlines — and the second case the property
 * test could not reach, because it is two files in one delta and nothing minted
 * or dropped between them. The record keeps whatever it said, so a `parent` it
 * carries becomes a foreign one: a set the validator condemns and `derive` is
 * written to answer over.
 */
const relocated = (random: () => number, corpus: Corpus): Corpus => {
  const holding = FILES.filter((file) => (corpus[file] ?? "") !== "")
  if (holding.length === 0) return corpus
  const from = pick(random, holding)
  const lines = (corpus[from] as string).split("\n").filter((line) => line !== "")
  if (lines.length === 0) return corpus
  const [record] = lines.splice(Math.floor(random() * lines.length), 1)
  const to = pick(random, FILES.filter((file) => file !== from))
  const held = corpus[to] ?? ""
  return {
    ...corpus,
    [from]: lines.join("\n"),
    [to]: held === "" ? (record as string) : `${held}\n${record}`,
  }
}

const editOf = (
  random: () => number,
  before: Corpus,
  used: Set<string>,
): Corpus => {
  let after = { ...before }
  const many = 1 + Math.floor(random() * 2)
  for (let at = 0; at < many; at++) {
    const roll = random()
    if (roll < 0.15) {
      after = relocated(random, after)
      continue
    }
    const file = pick(random, FILES)
    const held = after[file]
    if (roll < 0.25) delete after[file]
    else if (roll < 0.45 || held === undefined) after[file] = fileOf(random, used)
    else after[file] = tweak(random, held)
  }
  return after
}

const ROUNDS = 500

test("the patched view is the derived view, for any corpus and any delta", () => {
  const random = seeded(20260816)
  let declined = 0
  for (let round = 0; round < ROUNDS; round++) {
    const { files: before, used } = corpusOf(random)
    const after = editOf(random, before, used)
    const delta = deltaOf(before, after)
    const view = viewOf(before)
    const oracle = viewOf(after)
    const story = () =>
      `round ${round}\nbefore: ${JSON.stringify(before, null, 2)}\n` +
      `after: ${JSON.stringify(after, null, 2)}`

    const incremental = patched(view, delta)
    if (incremental === undefined) declined++
    else same(incremental, oracle, story)
    // The total function answers the same thing whichever way it got there.
    same(patch(view, delta), oracle, story)
    // A REVISION IS ATOMIC: the view handed in is the view it was, still, with
    // nothing of the patch showing through a shared map, array or set.
    same(view, viewOf(before), story)
  }
  // Not a performance assertion — a claim that the assertions above are about
  // the patcher at all. Left unchecked, a patcher that declined everything
  // would pass this whole file.
  // 86 of 500 as this is written, and BOTH bounds are the claim. The ceiling is
  // what fails when the patcher stops patching — the whole suite would go on
  // passing otherwise, since a decline is answered by `derive` and `derive` is
  // the oracle. The floor is what fails when the generator stops writing the
  // corners that decline (a duplicate id, a directory of one file), which is
  // what would make the ceiling meaningless. The slack in each is for a
  // generator that grows another arm, not for a patcher that loses one.
  expect(declined).toBeGreaterThan(ROUNDS / 20)
  expect(declined).toBeLessThan(ROUNDS / 4.5)
})

// ── what the reverse indexes are for ───────────────────────────────────

const KITCHEN: Corpus = {
  "a.olai": `{"id":"cook","ord":"a","title":"cook","todo":true}\n` +
    `{"id":"eat","ord":"b","title":"eat","after":["cook"]}`,
  "b.olai": `{"id":"m","ord":"a","mirror":"cook"}`,
  "deep/c.olai": `{"id":"m2","ord":"a","mirror":"m"}`,
}

/** The delta one file's new text makes — the shape a probe tick produces for a
 *  single edited outline. */
const editing = (file: string, text: string): SetDelta => ({
  upserts: [[file, { nodes: nodesOf(text, file) }]],
  removes: [],
})

test("a mark flips, and the placements standing for it two files away say so", () => {
  const view = viewOf(KITCHEN)
  const done = `{"id":"cook","ord":"a","title":"cook","done":true}\n` +
    `{"id":"eat","ord":"b","title":"eat","after":["cook"]}`
  const next = patched(view, editing("a.olai", done))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...KITCHEN, "a.olai": done }), () => "mark flip")
  // The whole point of the walk: a mirror OF A MIRROR, in a file the delta
  // never named, shows the mark that moved.
  expect((next as Derived).status.get("m2")).toBe("done")
  // And what was waiting on it is no longer waiting — the reverse edge index
  // read as "who has to be looked at again".
  expect((next as Derived).blocked.has("eat")).toBe(false)
})

test("an edit keeps the files it did not touch, entry by entry", () => {
  const view = viewOf(KITCHEN)
  const next = patch(view, editing("a.olai", `{"id":"cook","ord":"a","title":"cook again"}`))
  // Not equality — IDENTITY. What a patch does not touch is the very array the
  // previous view was holding, which is what makes patching worth doing at all.
  expect(next.byFile.get("b.olai")).toBe(view.byFile.get("b.olai"))
  expect(next.byId.get("m")).toBe(view.byId.get("m"))
})

test("an edit does not copy the id map — it layers over it", () => {
  // The economy of the patch, said about the index that used to break it: `byId`
  // has an entry per record in the DIRECTORY, and cloning it was the single
  // largest cost in a patch (`./overlay.ts`, `./patch.bench.ts`). Nothing else
  // in the tree can tell a layer from a map — that is the whole contract, and
  // every assertion above holds either way — so this is the one place the
  // difference is visible, and it is asserted here rather than measured in a
  // benchmark nobody runs on a lane.
  const before: Corpus = {
    "a.olai": `{"id":"p","ord":"a","title":"p"}\n{"id":"q","ord":"b","title":"q"}`,
    "b.olai": `{"id":"r","ord":"a","title":"r"}\n{"id":"s","ord":"b","title":"s"}`,
    "deep/c.olai": `{"id":"t","ord":"a","title":"t"}\n{"id":"u","ord":"b","title":"u"}`,
  }
  const typed = `{"id":"p","ord":"a","title":"p again"}\n{"id":"q","ord":"b","title":"q"}`
  const view = viewOf(before)
  const next = patched(view, editing("a.olai", typed))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "a.olai": typed }), () => "a title typed")
  expect((next as Derived).byId instanceof Map).toBe(false)
  // And the view a reader was already holding still answers with what it held.
  expect(view.byId.get("p")?.node).toMatchObject({ title: "p" })
})

test("a mirror chain that dangled resolves the moment its target arrives", () => {
  // `mirrorsOf` files a chain under the node it ENDS at, and this one ends
  // nowhere — so nothing but the raw index can find these two placements when
  // `far` turns up.
  const before: Corpus = {
    "a.olai": `{"id":"here","ord":"a","title":"here"}`,
    "b.olai": `{"id":"one","ord":"a","mirror":"two"}\n{"id":"two","ord":"b","mirror":"far"}`,
  }
  const view = viewOf(before)
  expect(view.status.has("one")).toBe(false)
  const arrived = `{"id":"here","ord":"a","title":"here"}\n{"id":"far","ord":"b","title":"far","doing":true}`
  const next = patched(view, editing("a.olai", arrived))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "a.olai": arrived }), () => "a target arrives")
  expect((next as Derived).status.get("one")).toBe("doing")
  expect([...((next as Derived).mirrorsOf.get("far") ?? [])]).toEqual(["one", "two"])
})

test("an edge written at a placement moves with the placement", () => {
  // `wait after m`, where `m` mirrors `cook`, is an edge to COOK — so pointing
  // the placement somewhere else re-points an edge in a file nothing touched.
  const before: Corpus = {
    "a.olai": `{"id":"cook","ord":"a","title":"cook","todo":true}\n` +
      `{"id":"wash","ord":"b","title":"wash","todo":true}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"cook"}`,
    "deep/c.olai": `{"id":"wait","ord":"a","title":"wait","todo":true,"after":["m"]}`,
  }
  const view = viewOf(before)
  expect(view.after.get("wait")).toEqual(["cook"])
  const moved = `{"id":"m","ord":"a","mirror":"wash"}`
  const next = patched(view, editing("b.olai", moved))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "b.olai": moved }), () => "a placement moves")
  expect((next as Derived).after.get("wait")).toEqual(["wash"])
  expect([...((next as Derived).edgesTo.get("wash") ?? [])]).toEqual(["wait"])
})

test("a word typed into a note reaches the index, and taking it out empties the key", () => {
  // The edit `backlinks` is for, at the size it really is: one `desc` rewritten
  // in one file, and a key that has to appear in an index nothing else in the
  // delta mentions.
  const before: Corpus = {
    "a.olai": `{"id":"cook","ord":"a","title":"cook"}`,
    "b.olai": `{"id":"note","ord":"a","title":"a note"}`,
  }
  const view = viewOf(before)
  expect(view.taggedBy.has("@cook")).toBe(false)

  const said = `{"id":"note","ord":"a","title":"a note","desc":"see @cook first"}`
  const next = patched(view, editing("b.olai", said))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "b.olai": said }), () => "a note names a node")
  expect((next as Derived).taggedBy.get("@cook")?.map((at) => at.node.id)).toEqual(["note"])

  // ...and out again. A key nothing says any more GOES, rather than standing
  // empty where a rebuild would have had no key at all.
  const quiet = patched(next as Derived, editing("b.olai", before["b.olai"] as string))
  expect(quiet).toBeDefined()
  same(quiet as Derived, viewOf(before), () => "the word is deleted")
  expect((quiet as Derived).taggedBy.has("@cook")).toBe(false)
})

test("one record writing a tag twice is one entry, in the title and in the note", () => {
  const before: Corpus = {
    "a.olai": `{"id":"cook","ord":"a","title":"cook"}`,
    "b.olai": `{"id":"note","ord":"a","title":"a note"}`,
  }
  const both = `{"id":"note","ord":"a","title":"about @cook","desc":"and again: @cook"}`
  const view = viewOf(before)
  const next = patched(view, editing("b.olai", both))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "b.olai": both }), () => "said twice")
  expect((next as Derived).taggedBy.get("@cook")?.length).toBe(1)
})

// A patch that moved `#cook` and `@cook` as one key would answer both of these
// with the same list, and the oracle would agree with it — `derive` would have
// collided them too. So the assertion is on the KEYS, and it is here rather
// than left to the generator because it is the whole reason this index is keyed
// by the written form.
test("the two sigils are two keys, and an edit moves only the one it wrote", () => {
  const before: Corpus = {
    "a.olai": `{"id":"cook","ord":"a","title":"cook"}`,
    "b.olai": `{"id":"topic","ord":"a","title":"about #cook"}`,
    "deep/c.olai": `{"id":"note","ord":"a","title":"ask @cook"}`,
  }
  const view = viewOf(before)
  expect(view.taggedBy.get("#cook")?.map((at) => at.node.id)).toEqual(["topic"])
  expect(view.taggedBy.get("@cook")?.map((at) => at.node.id)).toEqual(["note"])

  const quiet = `{"id":"topic","ord":"a","title":"about nothing"}`
  const next = patched(view, editing("b.olai", quiet))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "b.olai": quiet }), () => "the topic goes")
  expect((next as Derived).taggedBy.has("#cook")).toBe(false)
  // The mention is in a file the delta never named, and it is still filed.
  expect((next as Derived).taggedBy.get("@cook")?.map((at) => at.node.id)).toEqual(["note"])
})

// ── where the key ORDER is the answer ──────────────────────────────────
//
// Two cases grok reproduced on review, and they are here by hand because the
// generator could not reach them: `byId`'s key order is READ — the did-you-mean
// behind every unknown-target error walks it and promises that ties go to the
// first candidate offered — and both of these move a key's place without
// minting or dropping a single id, which is what the patcher used to treat as
// "nothing to redo". The values were right, the order was the old one, and the
// view was returned rather than declined.

test("two records swapping lines are two keys swapping places", () => {
  const before: Corpus = {
    "a.olai": `{"id":"p","ord":"a","title":"p"}\n{"id":"q","ord":"b","title":"q"}`,
    "b.olai": `{"id":"r","ord":"a","title":"r"}`,
  }
  const swapped = `{"id":"q","ord":"b","title":"q"}\n{"id":"p","ord":"a","title":"p"}`
  const view = viewOf(before)
  const next = patched(view, editing("a.olai", swapped))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "a.olai": swapped }), () => "lines swapped")
  expect([...(next as Derived).byId.keys()]).toEqual(["q", "p", "r"])
})

test("a record moved to another file takes its key to the end of the corpus", () => {
  // The id set does not change: nothing is minted, nothing is dropped. What
  // changes is where the record IS — which is where its key is.
  const before: Corpus = {
    "a.olai": `{"id":"x","ord":"a","title":"x"}\n{"id":"keep","ord":"b","title":"keep"}`,
    "b.olai": `{"id":"y","ord":"a","title":"y"}`,
    "c.olai": `{"id":"z","ord":"a","title":"z"}`,
  }
  const emptied = `{"id":"keep","ord":"b","title":"keep"}`
  const landed = `{"id":"z","ord":"a","title":"z"}\n{"id":"x","ord":"a","title":"x"}`
  const view = viewOf(before)
  const next = patched(view, {
    upserts: [
      ["a.olai", { nodes: nodesOf(emptied, "a.olai") }],
      ["c.olai", { nodes: nodesOf(landed, "c.olai") }],
    ],
    removes: [],
  })
  expect(next).toBeDefined()
  const after = { ...before, "a.olai": emptied, "c.olai": landed }
  same(next as Derived, viewOf(after), () => "a record moves file")
  expect([...(next as Derived).byId.keys()]).toEqual(["keep", "y", "z", "x"])
  // What the order is FOR: an id nothing declares is answered with the first
  // candidate within the budget, so a stale order is a different answer about
  // the same bytes on disk.
  expect(nearestId("aa", (next as Derived).byId.keys()))
    .toBe(nearestId("aa", viewOf(after).byId.keys()))
})

test("siblings in two files with one `ord` and one line break the same way", () => {
  // The tie `derive` never has to think about: it sorts a list already in
  // corpus order, so two records with the same `ord` on the same LINE keep the
  // order they were walked in. A patcher merges what STAYED with what ARRIVED
  // and has to say that out loud (`bySibling`), which is why this is written by
  // hand rather than left to a generator that reaches it three times in five
  // hundred rounds. A parent in another file is a set the validator condemns
  // and `derive` is written to answer over.
  const before: Corpus = {
    "a.olai": `{"id":"one","parent":"p","ord":"a","title":"first file"}`,
    "b.olai": `{"id":"two","parent":"p","ord":"a","title":"second file"}`,
    "deep/c.olai": `{"id":"p","ord":"a","title":"the parent"}`,
  }
  const view = viewOf(before)
  expect(view.children.get("p")?.map((at) => at.node.id)).toEqual(["one", "two"])

  // BOTH DIRECTIONS, and only the second one is the test — grok's note on the
  // first pass at this. Editing the LATER file leaves the merge already in
  // corpus order (what stayed is `a.olai`'s, what arrives is `b.olai`'s), so it
  // passes for a comparator that never looks at the file at all.
  const later = `{"id":"two","parent":"p","ord":"a","title":"edited"}`
  const afterLater = patched(view, editing("b.olai", later))
  expect(afterLater).toBeDefined()
  same(afterLater as Derived, viewOf({ ...before, "b.olai": later }), () => "the later file")
  expect((afterLater as Derived).children.get("p")?.map((at) => at.node.id))
    .toEqual(["one", "two"])

  // Editing the EARLIER file is the one that bites: what stayed is `b.olai`'s
  // record and what arrives is `a.olai`'s, so the merge is `[two, one]` and the
  // `ord` and the line are both ties. Nothing but corpus order puts it back,
  // which is exactly what `bySibling` adds to `byOrd`.
  const earlier = `{"id":"one","parent":"p","ord":"a","title":"edited"}`
  const afterEarlier = patched(view, editing("a.olai", earlier))
  expect(afterEarlier).toBeDefined()
  same(afterEarlier as Derived, viewOf({ ...before, "a.olai": earlier }), () => "the earlier file")
  expect((afterEarlier as Derived).children.get("p")?.map((at) => at.node.id))
    .toEqual(["one", "two"])
})

// ── files coming and going ─────────────────────────────────────────────

test("a file that arrives takes its place in path order", () => {
  const before: Corpus = {
    "a.olai": `{"id":"one","ord":"a","title":"one"}`,
    "z.olai": `{"id":"three","ord":"a","title":"three"}`,
  }
  const view = viewOf(before)
  const added = { ...before, "b.olai": `{"id":"two","ord":"a","title":"two"}` }
  const next = patch(view, editing("b.olai", added["b.olai"] as string))
  same(next, viewOf(added), () => "a file arrives")
  expect(next.nodes.map((at) => at.node.id)).toEqual(["one", "two", "three"])
})

test("a file arriving in a directory named after its neighbour lands where a walk puts it", () => {
  // THE SLICE-4 LANDMINE, pinned. `a.olai` and `a/inner.olai` are the one pair
  // of paths the two readings of "path order" disagree about: a plain string
  // compare puts `a.olai` first (`.` is 0x2E, `/` is 0x2F), and a walk that
  // descends into `a` when it meets it puts the nested file first. `assemble`
  // and this patcher now answer with the walk's order (`byPath`) and so does
  // the browser's sidebar — one order, three readers, and the assertion below
  // is what says the patcher did not place an arriving file by the other one.
  const before: Corpus = {
    "a.olai": `{"id":"flat","ord":"a","title":"flat"}`,
    "b.olai": `{"id":"other","ord":"a","title":"other"}`,
  }
  const view = viewOf(before)
  const inner = `{"id":"nested","ord":"a","title":"nested"}`
  const next = patch(view, editing("a/inner.olai", inner))
  const after = { ...before, "a/inner.olai": inner }
  same(next, viewOf(after), () => "a nested file arrives")
  expect(next.nodes.map((at) => at.node.id)).toEqual(["nested", "flat", "other"])
  expect([...next.byFile.keys()]).toEqual(["a/inner.olai", "a.olai", "b.olai"])
})

test("a file that goes away takes its records with it", () => {
  const before: Corpus = {
    "a.olai": `{"id":"one","ord":"a","title":"one","todo":true,"after":["two"]}`,
    "b.olai": `{"id":"two","ord":"a","title":"two","todo":true}`,
    "deep/c.olai": `{"id":"three","ord":"a","mirror":"two"}`,
  }
  const view = viewOf(before)
  expect(view.blocked.has("one")).toBe(true)
  const { "b.olai": _gone, ...after } = before
  const next = patch(view, { upserts: [], removes: ["b.olai"] })
  same(next, viewOf(after), () => "a file leaves")
  // The edge is still written, so it is still in the graph — as the id it
  // names, which nothing declares now. What changes is that nothing is in the
  // way, because a target that is not there is not a task that is not done.
  expect(next.after.get("one")).toEqual(["two"])
  expect(next.blocked.has("one")).toBe(false)
  expect(next.status.has("three")).toBe(false)
})

test("an empty delta is the same view, and says so by being it", () => {
  const view = viewOf(KITCHEN)
  expect(patch(view, { upserts: [], removes: [] })).toBe(view)
})

// ── where it declines ──────────────────────────────────────────────────

test("a duplicate id is handed back to the rebuild, and answered anyway", () => {
  const before: Corpus = {
    "a.olai": `{"id":"x","ord":"a","title":"first"}`,
    "b.olai": `{"id":"y","ord":"a","title":"second"}`,
    "deep/c.olai": `{"id":"z","ord":"a","title":"third"}`,
  }
  const view = viewOf(before)
  // A second claim on an id a file the delta never named already holds: the
  // patcher would have to know which record loses, and losers are what this
  // index does not keep.
  const clash = `{"id":"x","ord":"a","title":"clash"}`
  expect(patched(view, editing("b.olai", clash))).toBeUndefined()
  same(patch(view, editing("b.olai", clash)), viewOf({ ...before, "b.olai": clash }), () => "clash")

  // And once the corpus HOLDS a duplicate, no patch is attempted onto it: the
  // first claim is a fact about corpus order, and promoting the next one is
  // exactly what an index without the losers cannot do.
  const clashed = viewOf({ ...before, "b.olai": clash })
  expect(patched(clashed, editing("deep/c.olai", `{"id":"z","ord":"a","title":"other"}`)))
    .toBeUndefined()
})

test("a delta that leaves nothing standing is a rebuild", () => {
  const before: Corpus = { [FIXTURE_FILE]: `{"id":"one","ord":"a","title":"one"}` }
  const view = viewOf(before)
  const text = `{"id":"one","ord":"a","title":"two"}`
  expect(patched(view, editing(FIXTURE_FILE, text))).toBeUndefined()
  same(patch(view, editing(FIXTURE_FILE, text)), viewOf({ [FIXTURE_FILE]: text }), () => "one file")
})
