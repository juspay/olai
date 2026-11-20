import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { type Corpus, corpusOf, deltaOf, editOf } from "./corpora.testlib.ts"
import { byCorpus, derive, type Derived } from "./derive.ts"
import { decodedOf, recordsOf, seeded } from "./fixtures.testlib.ts"
import { fileKind } from "./kinds.ts"
import type { Located } from "./node.ts"
import { bySibling, patched, spliced, touchedBy } from "./patch.ts"
import { pinnedVault, vaultAt } from "./scope.testlib.ts"
import { assemble } from "./set.ts"

type Splice = <T>(
  held: ReadonlyArray<T>,
  arriving: ReadonlyArray<T>,
  left: (one: T) => boolean,
  order: (one: T, other: T) => number,
) => ReadonlyArray<T>

const rebuilt: Splice = (held, arriving, left, order) =>
  [...held.filter((one) => !left(one)), ...arriving].sort(order)

type Wrong = "one late" | "one early" | "before the equals"

const misplacing = (how: Wrong): Splice => <T>(
  held: ReadonlyArray<T>,
  arriving: ReadonlyArray<T>,
  left: (one: T) => boolean,
  order: (one: T, other: T) => number,
): ReadonlyArray<T> => {
  const kept = held.filter((one) => !left(one))
  const coming = [...arriving].sort(order)
  const own: Array<T> = []
  let from = 0
  for (const one of coming) {
    let to = from
    while (to < kept.length && order(kept[to] as T, one) <= 0) to++
    if (how === "one late" && to < kept.length) to++
    if (how === "one early" && to > from) to--
    if (how === "before the equals") {
      while (to > from && order(kept[to - 1] as T, one) === 0) to--
    }
    for (let at = from; at < to; at++) own.push(kept[at] as T)
    own.push(one)
    from = to
  }
  for (let at = from; at < kept.length; at++) own.push(kept[at] as T)
  return own
}

const ARRIVALS = ["as filed", "shuffled"] as const
type Arrivals = (typeof ARRIVALS)[number]

interface Case {
  readonly what: string
  readonly ran: (splice: Splice, arrivals: Arrivals) => ReadonlyArray<string>
  readonly derived: ReadonlyArray<string> | undefined
  readonly members: number
  readonly tied: number
  readonly shape: ReadonlySet<Shape>
}

type Shape = "born" | "emptied" | "first" | "last" | "cross-file" | "moved" | "popular"

const PRINTED = new WeakMap<object, string>()

const said = (one: unknown): string => {
  if (typeof one !== "object" || one === null) return JSON.stringify(one)
  const found = PRINTED.get(one)
  if (found !== undefined) return found
  const printed = JSON.stringify(one)
  PRINTED.set(one, printed)
  return printed
}

const casesIn = <T>(
  index: string,
  before: ReadonlyMap<string, ReadonlyArray<T>>,
  after: ReadonlyMap<string, ReadonlyArray<T>>,
  touched: ReadonlySet<string>,
  at: (one: T) => Located,
  order: (one: Located, other: Located) => number,
  random: () => number,
  into: Array<Case>,
): void => {
  const left = (one: T): boolean => touched.has(at(one).file)
  const inOrder = (one: T, other: T): number => order(at(one), at(other))
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const held = before.get(key) ?? []
    const landed = after.get(key) ?? []
    const arriving = landed.filter(left)
    if (arriving.length === 0 && !held.some(left)) continue
    const stirred = shuffled(arriving, random)
    let tied = 0
    for (const one of arriving) {
      for (const other of held) if (!left(other) && inOrder(other, one) === 0) tied++
    }
    const shape = new Set<Shape>()
    if (held.length === 0) shape.add("born")
    if (landed.length === 0) shape.add("emptied")
    if (arriving.length > 0 && held.some(left)) shape.add("moved")
    if (landed.length >= 20) shape.add("popular")
    if (arriving.length > 0 && landed.length > arriving.length) {
      if (left(landed[0] as T)) shape.add("first")
      if (left(landed[landed.length - 1] as T)) shape.add("last")
      if (new Set(landed.map((one) => at(one).file)).size > 1) shape.add("cross-file")
    }
    into.push({
      what: `${index} \`${key}\``,
      ran: (splice, arrivals) =>
        splice(held, arrivals === "shuffled" ? stirred : arriving, left, inOrder).map(said),
      derived: landed.map(said),
      members: landed.length,
      tied,
      shape,
    })
  }
}

const shuffled = <T>(from: ReadonlyArray<T>, random: () => number): ReadonlyArray<T> => {
  const own = [...from]
  for (let at = own.length - 1; at > 0; at--) {
    const other = Math.floor(random() * (at + 1))
    const held = own[at] as T
    own[at] = own[other] as T
    own[other] = held
  }
  return own
}

const casesFor = (
  before: Derived,
  after: Derived,
  touched: ReadonlySet<string>,
  random: () => number,
  into: Array<Case>,
): void => {
  const over = <T>(
    index: string,
    of: (view: Derived) => ReadonlyMap<string, ReadonlyArray<T>>,
    at: (one: T) => Located,
    order: (one: Located, other: Located) => number,
  ): void => casesIn(index, of(before), of(after), touched, at, order, random, into)
  over("children", (view) => view.children, (one) => one, bySibling)
  over("namedBy", (view) => view.namedBy, (one) => one.at, byCorpus)
  over("taggedBy", (view) => view.taggedBy, (one) => one, byCorpus)
  over("byDay", (view) => view.byDay, (one) => one.at, byCorpus)
}

interface Divergence {
  readonly what: string
  readonly how: "set" | "order"
  readonly arrivals: Arrivals
  readonly found: string
  readonly reference: string
}

const divergences = (splice: Splice, cases: ReadonlyArray<Case>): ReadonlyArray<Divergence> => {
  const found: Array<Divergence> = []
  for (const one of cases) {
    for (const arrivals of ARRIVALS) {
      const mine = one.ran(splice, arrivals)
      const theirs = one.ran(rebuilt, arrivals)
      if (mine.join("\n") === theirs.join("\n")) continue
      found.push({
        what: one.what,
        how: [...mine].sort().join("\n") === [...theirs].sort().join("\n") ? "order" : "set",
        arrivals,
        found: shortly(mine),
        reference: shortly(theirs),
      })
    }
  }
  return found
}

const grounded = (cases: ReadonlyArray<Case>): ReadonlyArray<string> =>
  cases.filter((one) =>
    one.derived !== undefined &&
    one.ran(rebuilt, "as filed").join("\n") !== one.derived.join("\n")
  ).map((one) => one.what)

const shortly = (members: ReadonlyArray<string>): string => {
  const said = members.join(" | ")
  return said.length > 400 ? `${said.slice(0, 400)}… (${members.length} members)` : said
}

const viewOf = (corpus: Corpus): Derived =>
  derive(TEST_CLAIMS, recordsOf(assemble(TEST_CLAIMS,
    new Map(Object.entries(corpus).map(([file, text]) => [file, decoded(file, text)])),
  )))

type Decoded = ReturnType<typeof decodedOf> extends Map<string, infer V> ? V : never

const HELD = new Map<string, Decoded>()

const decoded = (file: string, text: string): Decoded => {
  const key = `${file}\0${text}`
  const found = HELD.get(key)
  if (found !== undefined) return found
  const parsed = decodedOf({ [file]: text }).get(file) as Decoded
  HELD.set(key, parsed)
  return parsed
}

const ROUNDS = 300

const generated = (): ReadonlyArray<Case> => {
  const random = seeded(20260825)
  const found: Array<Case> = []
  for (let round = 0; round < ROUNDS; round++) {
    const { files: before, used } = corpusOf(random)
    const after = editOf(random, before, used)
    casesFor(viewOf(before), viewOf(after), touchedBy(deltaOf(before, after)), random, found)
  }
  return found
}

const REAL = ((): Corpus => {
  const outlines: Corpus = {}
  for (const [file, text] of vaultAt(pinnedVault())) {
    if (TEST_CLAIMS.byKind.get(fileKind(TEST_CLAIMS, file) ?? "")?.holds === "nodes") outlines[file] = text
  }
  return outlines
})()

const TYPED = 60

const typing = (random: () => number): ReadonlyArray<Corpus> => {
  const files = Object.keys(REAL)
  const stream: Array<Corpus> = []
  let held = REAL
  while (stream.length < TYPED) {
    const file = files[Math.floor(random() * files.length)] as string
    const lines = (held[file] as string).split("\n").filter((line) => line !== "")
    if (lines.length === 0) continue
    const which = Math.floor(random() * lines.length)
    const record = JSON.parse(lines[which] as string) as Record<string, unknown>
    const title = record["title"]
    if (typeof title !== "string") continue
    record["title"] = `x${title}`
    lines[which] = JSON.stringify(record)
    const next: Corpus = { ...held, [file]: lines.join("\n") }
    stream.push(next)
    held = next
  }
  return stream
}

const real = (): ReadonlyArray<Case> => {
  const random = seeded(20260825)
  const found: Array<Case> = []
  let before = REAL
  let view = viewOf(before)
  for (const after of typing(random)) {
    const next = viewOf(after)
    casesFor(view, next, touchedBy(deltaOf(before, after)), random, found)
    before = after
    view = next
  }
  return found
}

const HARVESTED = [...generated(), ...real()]

const TIED: ReadonlyArray<Case> = ((): ReadonlyArray<Case> => {
  interface Row {
    readonly file: string
    readonly line: number
    readonly mark: string
  }
  const left = (one: Row): boolean => one.file === "touched.olai"
  const byLineAlone = (one: Row, other: Row): number => one.line - other.line
  const written = (
    what: string,
    held: ReadonlyArray<Row>,
    arriving: ReadonlyArray<Row>,
    shape: ReadonlyArray<Shape>,
  ): Case => ({
    what,
    ran: (splice) => splice(held, arriving, left, byLineAlone).map(said),
    derived: undefined,
    members: held.filter((one) => !left(one)).length + arriving.length,
    tied: arriving.length * held.filter((one) => !left(one)).length,
    shape: new Set(shape),
  })
  const stood = (file: string, mark: string): Row => ({ file, line: 1, mark })
  return [
    written(
      "written `every member ties, nothing leaves`",
      [stood("a.olai", "stood first"), stood("b.olai", "stood second")],
      [stood("touched.olai", "arrived")],
      ["last"],
    ),
    written(
      "written `every member ties, one leaves from the middle`",
      [
        stood("a.olai", "stood first"),
        stood("touched.olai", "left"),
        stood("b.olai", "stood second"),
      ],
      [stood("touched.olai", "arrived")],
      ["moved", "last"],
    ),
  ]
})()

const CASES = [...HARVESTED, ...TIED]

const many = (shape: Shape): number => CASES.filter((one) => one.shape.has(shape)).length

test("a spliced key is the key the rebuild built, member for member and in order", () => {
  expect(divergences(spliced, CASES)).toEqual([])
})

test("...and the rebuild it is compared against is what `derive` itself holds", () => {
  expect(grounded(CASES)).toEqual([])
})

test("the run reached the corners a splice can only be wrong at", () => {
  expect(CASES.length).toBeGreaterThan(2000)
  for (const shape of ["born", "emptied", "moved", "first", "last", "cross-file"] as const) {
    expect([shape, many(shape) > 100]).toEqual([shape, true])
  }
  expect(CASES.filter((one) => one.shape.has("popular") && one.shape.has("moved")).length)
    .toBeGreaterThan(100)
  expect(Math.max(...CASES.map((one) => one.members))).toBeGreaterThan(50)
})

test("a splice landing one position off is caught, in both directions", () => {
  for (const how of ["one late", "one early"] as const) {
    const found = divergences(misplacing(how), CASES)
    expect([how, found.length > 100]).toEqual([how, true])
    expect([how, found.every((one) => one.how === "order")]).toEqual([how, true])
  }
})

test("a splice that puts an arrival before the members it ties with is caught", () => {
  const found = divergences(misplacing("before the equals"), CASES)
  expect([...new Set(found.map((one) => one.what))])
    .toEqual(TIED.map((one) => one.what) as never)
  expect(found.every((one) => one.how === "order")).toBe(true)
})

test("no key a real index produces can tie a survivor with an arrival", () => {
  expect(HARVESTED.reduce((held, one) => held + one.tied, 0)).toBe(0)
})

test("the patched view is the derived view over the real vault", () => {
  const random = seeded(20260826)
  let before = REAL
  let view = viewOf(before)
  let folded = 0
  for (const after of typing(random)) {
    const next = patched(view, deltaOf(before, after))
    expect([folded, next !== undefined]).toEqual([folded, true])
    same(next as Derived, viewOf(after))
    folded++
    before = after
    view = next as Derived
  }
  expect(folded).toBe(TYPED)
})

const same = (found: Derived, oracle: Derived): void => {
  for (const index of ["children", "namedBy", "taggedBy", "byDay"] as const) {
    expect([index, entries(found[index])]).toEqual([index, entries(oracle[index])])
  }
  expect([...found.byDay.keys()]).toEqual([...oracle.byDay.keys()])
  expect([...found.namedBy.keys()]).toEqual([...oracle.namedBy.keys()])
  expect([...found.owedByDay]).toEqual([...oracle.owedByDay])
  expect(found.days).toEqual(oracle.days as never)
}

const entries = (map: ReadonlyMap<string, ReadonlyArray<unknown>>): ReadonlyArray<string> =>
  [...map].map(([key, own]) => `${key}\n${own.map(said).join("\n")}`).sort()
