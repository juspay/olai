import { TEST_CLAIMS } from "@olai/format/testlib"
import {
  byCorpus,
  derive,
  type Derived,
  type Index,
  mayHoldTag,
  READ,
  tagInto,
  tagText,
  titleParts,
  titleTagRe,
} from "./derive.ts"
import {
  alternating,
  median,
  nodesOf,
  retitled,
  retitledIn,
  runtimeSaid,
  timed,
  timesSaid,
  vaultOf,
} from "./fixtures.testlib.ts"
import { heapStats } from "bun:jsc"

import { isRegular, type Located, type LocatedRegular } from "./node.ts"
import { overlay, type Read } from "./overlay.ts"
import { bySibling, patched, type SetDelta, spliced } from "./patch.ts"
import { byPath } from "./paths.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
const EDITS = Number(process.env["OLAI_BENCH_EDITS"] ?? 40)

const corpus = vaultOf({ files: FILES, records: RECORDS })

const paths = [...corpus.keys()].sort(byPath)

const parsed = new Map<string, ReadonlyArray<Located>>(
  paths.map((file) => [file, nodesOf(corpus.get(file) as string, file)]),
)

const flat = (held: ReadonlyMap<string, ReadonlyArray<Located>>): ReadonlyArray<Located> =>
  paths.flatMap((file) => held.get(file) ?? [])

const fileFor = (which: number): string => paths[which % paths.length] as string

const editOf = (which: number): {
  readonly file: string
  readonly records: ReadonlyArray<Located>
  readonly delta: SetDelta
} => {
  const file = fileFor(which)
  const records = nodesOf(retitled(corpus.get(file) as string, which), file)
  return { file, records, delta: { upserts: [[file, { nodes: records }]], removes: [] } }
}

const edits = Array.from({ length: EDITS }, (_, which) => editOf(which))

const first = derive(TEST_CLAIMS, flat(parsed))
const records = first.nodes.length

let carried = first

const cloned: CopyOnWrite = (base, changes) => {
  const next = new Map(base)
  for (const [id, at] of changes) next.set(id, at)
  return next
}

type CopyOnWrite = (
  base: ReadonlyMap<string, Located>,
  changes: ReadonlyArray<readonly [string, Located]>,
) => ReadonlyMap<string, Located>

const said = (name: string, view: Derived, which: number): void => {
  const found = retitledIn(view.byFile.get(fileFor(which)) ?? [])
  if (found !== which) {
    throw new Error(
      `${name} is at edit ${found ?? "none"} after edit ${which} — the arm` +
        ` answered a view it never recomputed`,
    )
  }
  let held = 0
  for (const own of view.byFile.values()) held += own.length
  if (held !== records) {
    throw new Error(
      `${name} answered for ${held} records of ${records}` +
        ` — the arm is not measuring what it says`,
    )
  }
}

const rebuilt = edits.map(({ file, records: own }, which) => {
  const held = new Map(parsed)
  held.set(file, own)
  const nodes = flat(held)
  let view: Derived | undefined
  const ms = timed(() => {
    view = derive(TEST_CLAIMS, nodes)
  })
  said("rebuild", view as Derived, which)
  return ms
})

const patching = (name: string, alsoResidue: boolean): ReadonlyArray<number> => {
  const times: Array<number> = []
  let carrying = first
  for (const [which, { delta, records: own }] of edits.entries()) {
    const changes = own.map((at) => [at.node.id, at] as const)
    let next: Derived | undefined
    times.push(timed(() => {
      next = patched(carrying, delta)
      if (next !== undefined && alsoResidue) {
        next = { ...next, byId: cloned(carrying.byId, changes) }
      }
    }))
    if (next === undefined) {
      throw new Error(
        `${name} DECLINED edit ${which} — a benchmark of the incremental answer` +
          ` cannot be a benchmark of the rebuild it fell back to`,
      )
    }
    carrying = next
    said(name, carrying, which)
  }
  if (!alsoResidue) carried = carrying
  return times
}

patching("patch", false)
patching("patch+residue", true)
const patchedMs = patching("patch", false)
const patchedResidueMs = patching("patch+residue", true)

const oracle = derive(TEST_CLAIMS, flat(edits.reduce(
  (held, { file, records: own }) => held.set(file, own),
  new Map(parsed),
)))
const claims = (view: Derived): string =>
  [...view.byId].map(([id, at]) => `${id}@${at.file}:${at.line} ${JSON.stringify(at.node)}`)
    .join("\n")
if (carried.nodes.length !== oracle.nodes.length || claims(carried) !== claims(oracle)) {
  throw new Error(
    `${EDITS} patches deep, the carried view and a fresh derive disagree about the corpus`,
  )
}

const walked = (views: ReadonlyArray<Derived>): ReadonlyArray<number> => {
  const once = (view: Derived): number =>
    timed(() => {
      let found = 0
      for (const at of view.nodes) if (view.byId.get(at.node.id) !== undefined) found++
      if (found !== view.nodes.length) throw new Error("byId does not hold every record")
    })
  for (const view of views) once(view)
  const rounds = Array.from({ length: 10 }, (_, round) => {
    const order = [...views.keys()]
    if (round % 2 === 1) order.reverse()
    const times: Array<number> = []
    for (const which of order) times[which] = once(views[which] as Derived)
    return times
  })
  return views.map((_, which) => median(rounds.map((round) => round[which] as number)))
}

const layered: CopyOnWrite = (base, changes) => {
  const held = overlay(base, "by key")
  for (const [id, at] of changes) held.set(id, at)
  return held.sealed()
}

const handedOn = (
  apply: CopyOnWrite,
  stream: ReadonlyArray<{ readonly records: ReadonlyArray<Located> }>,
): {
  readonly times: ReadonlyArray<number>
  readonly held: ReadonlyMap<string, Located>
  readonly flattenedAt: ReadonlyArray<number>
} => {
  let held: ReadonlyMap<string, Located> = first.byId
  const times: Array<number> = []
  const flattenedAt: Array<number> = []
  stream.forEach(({ records: own }, which) => {
    const changes = own.map((at) => [at.node.id, at] as const)
    times.push(timed(() => {
      held = apply(held, changes)
    }))
    if (held instanceof Map) flattenedAt.push(which)
  })
  return { times, held, flattenedAt }
}

const typing = Array.from(
  { length: EDITS },
  (_, which) => ({
    records: nodesOf(retitled(corpus.get(paths[0] as string) as string, which), paths[0] as string),
  }),
)

const lever = (
  what: string,
  stream: ReadonlyArray<{ readonly records: ReadonlyArray<Located> }>,
): void => {
  handedOn(cloned, stream)
  handedOn(layered, stream)
  const rounds = Array.from({ length: 5 }, (_, round) => {
    const first = round % 2 === 0 ? cloned : layered
    const second = round % 2 === 0 ? layered : cloned
    const one = handedOn(first, stream)
    const other = handedOn(second, stream)
    return round % 2 === 0 ? [one, other] as const : [other, one] as const
  })
  const [asClone, asLayer] = [0, 1].map((which) =>
    median(rounds.map((round) => median(round[which as 0 | 1].times)))
  )
  const ends = rounds[0] as readonly [ReturnType<typeof handedOn>, ReturnType<typeof handedOn>]
  const sameAnswer = (one: ReadonlyMap<string, Located>, other: ReadonlyMap<string, Located>) =>
    one.size === other.size &&
    [...one].every(([id, at]) => other.get(id) === at) &&
    [...one.keys()].join("\n") === [...other.keys()].join("\n")
  if (!sameAnswer(ends[0].held, ends[1].held)) {
    throw new Error(
      `${what}: the cloned index and the layered one disagree after ${stream.length} edits` +
        ` — an arm that is cheaper by being wrong is not an arm`,
    )
  }
  const flattens = ends[1].flattenedAt
  console.log(
    `  ${what.padEnd(28)} ${(asClone as number).toFixed(3)}ms cloned,` +
      ` ${(asLayer as number).toFixed(3)}ms layered` +
      `   (layer flattened ${
        flattens.length === 0 ? "never" : `at ${flattens.map((at) => `edit ${at}`).join(", ")}`
      })`,
  )
}

const sides = (which: Read): ReadonlyArray<Index> =>
  (Object.keys(READ) as ReadonlyArray<Index>).filter((index) => READ[index] === which)
const LAYERED = sides("by key")
const CLONED = sides("whole")

const beside = (): readonly [layered: number, cloned: number] => {
  const mapsIn = (keys: ReadonlyArray<Index>) =>
    keys.map((key) => first[key] as ReadonlyMap<string, unknown>)
  const wasLayered = mapsIn(LAYERED)
  const stayCloned = mapsIn(CLONED)
  const arms = [
    () => {
      for (const map of wasLayered) new Map(map)
    },
    () => {
      for (const map of stayCloned) new Map(map)
    },
  ] as const
  return alternating(arms)
}

const flatly = (): readonly [built: number, counted: number] => {
  const byFile = first.byFile
  return alternating([
    () => {
      const flat = [...byFile.values()].flat()
      if (flat.length !== records) throw new Error("the flat list is not the corpus")
    },
    () => {
      let held = 0
      for (const own of byFile.values()) held += own.length
      if (held !== records) throw new Error("the count is not the corpus")
    },
  ] as const)
}

const wholly = (): readonly [asMap: number, asLayer: number] => {
  const base = first.namedBy
  const keys = [...base.keys()].slice(0, 20)
  const held = overlay(base, "by key")
  for (const key of keys) held.set(key, base.get(key) as NonNullable<ReturnType<typeof base.get>>)
  const layer = held.sealed()
  if (layer instanceof Map) throw new Error("the layer flattened — this measures one map twice")
  const sweep = (map: ReadonlyMap<string, unknown>) => () => {
    let seen = 0
    for (const [, namings] of map) seen += (namings as ReadonlyArray<unknown>).length
    return seen
  }
  const [one, other] = [sweep(base)(), sweep(layer)()]
  if (one !== other) throw new Error("the map and the layer walk to different answers")
  return alternating([sweep(base), sweep(layer)] as const)
}

const KEPT = 20

const unwritten = (): void => {
  const base = first.byId
  const ids = [...base.keys()]
  const half = ids.slice(0, Math.floor(ids.length / 2))
  const growing = overlay(base, "by key")
  for (const id of half) growing.set(id, base.get(id) as Located)
  const layer = growing.sealed()
  if (layer instanceof Map) {
    throw new Error("the layer flattened — this would measure a map and call it a carry")
  }
  const changed = new Map(half.map((id) => [id, base.get(id) as Located]))
  const appended = new Set<string>()
  const gone = new Set<string>()
  const eager = () => {
    const held = overlay(layer, "by key")
    const three = [new Map(changed), new Set(appended), new Set(gone)] as const
    held.sealed()
    return three
  }
  const lazy = () => overlay(layer, "by key").sealed()
  if (lazy() !== layer) {
    throw new Error("the lazy arm did not hand its layer back — it wrote to something")
  }
  if (layer.size !== base.size) {
    throw new Error(
      `the layer holds ${layer.size} of ${base.size} keys — it added or dropped one,` +
        " so the empty sets this arm copies are not the ones the constructor did",
    )
  }
  const [asEager, asLazy] = alternating([eager, lazy] as const)
  const made = (arm: () => unknown): { readonly maps: number; readonly sets: number } => {
    const kept: Array<unknown> = []
    Bun.gc(true)
    const before = heapStats().objectTypeCounts
    for (let round = 0; round < KEPT; round++) kept.push(arm())
    const after = heapStats().objectTypeCounts
    if (kept.length !== KEPT) throw new Error("the count dropped what it was keeping")
    const each = (what: "Map" | "Set") => ((after[what] ?? 0) - (before[what] ?? 0)) / KEPT
    return { maps: each("Map"), sets: each("Set") }
  }
  const [eagerMade, lazyMade] = [made(eager), made(lazy)]
  console.log(
    `  a layer of ${changed.size} over ${base.size} keys, carried and not written:` +
      ` ${asEager.toFixed(3)}ms eager, ${asLazy.toFixed(3)}ms lazy` +
      ` (${eagerMade.maps} map + ${eagerMade.sets} sets against` +
      ` ${lazyMade.maps} + ${lazyMade.sets}, per index per patch)`,
  )
}

const untouched = (): void => {
  const never = new Map<Index, number>()
  let view = first
  for (const [which, { delta }] of edits.entries()) {
    const next = patched(view, delta)
    if (next === undefined) throw new Error(`the patcher declined edit ${which}`)
    for (const index of LAYERED) {
      const was = view[index] as ReadonlyMap<string, unknown>
      if ((next[index] as ReadonlyMap<string, unknown>) === was) {
        never.set(index, (never.get(index) ?? 0) + 1)
      }
    }
    view = next
  }
  for (const index of LAYERED) {
    const held = (view[index] as ReadonlyMap<string, unknown>).size
    console.log(
      `  ${index.padEnd(10)} ${String(held).padStart(6)} keys —` +
        ` carried without a write on ${never.get(index) ?? 0} of ${EDITS} edits`,
    )
  }
}

const REPEATS = 200

const resorting = <T>(
  what: string,
  index: ReadonlyMap<string, ReadonlyArray<T>>,
  at: (one: T) => Located,
  order: (one: Located, other: Located) => number,
): void => {
  const [key, held] = biggest(index)
  const file = at(held[0] as T).file
  const left = (one: T): boolean => at(one).file === file
  const arriving = held.filter(left)
  const inOrder = (one: T, other: T): number => order(at(one), at(other))
  const arms = [
    () => {
      for (let round = 0; round < REPEATS; round++) {
        [...held.filter((one) => !left(one)), ...arriving].sort(inOrder)
      }
    },
    () => {
      for (let round = 0; round < REPEATS; round++) spliced(held, arriving, left, inOrder)
    },
  ] as const
  const said = (own: ReadonlyArray<T>): string =>
    own.map((one) => `${at(one).file}:${at(one).line}`).join("|")
  const asRebuilt = said([...held.filter((one) => !left(one)), ...arriving].sort(inOrder))
  if (asRebuilt !== said(spliced(held, arriving, left, inOrder))) {
    throw new Error(`${what}: the rebuilt key and the spliced one are not the same key`)
  }
  const [rebuild, splice] = alternating(arms)
  console.log(
    `  ${what.padEnd(12)} \`${key}\``.padEnd(34) +
      ` ${held.length} members, ${arriving.length} from the touched file:` +
      ` ${((rebuild as number) / REPEATS * 1000).toFixed(1)}µs rebuilt,` +
      ` ${((splice as number) / REPEATS * 1000).toFixed(1)}µs spliced`,
  )
}

const biggest = <T>(
  index: ReadonlyMap<string, ReadonlyArray<T>>,
): readonly [string, ReadonlyArray<T>] => {
  let found: readonly [string, ReadonlyArray<T>] = ["", []]
  for (const entry of index) if (entry[1].length > found[1].length) found = entry
  if (found[1].length === 0) throw new Error("the vault holds no key to re-file")
  return found
}

const folds = (): readonly [narrow: number, wide: number] => {
  const arms = [
    () => {
      const index = new Map<string, Array<LocatedRegular>>()
      for (const at of first.nodes) mentionOnlyInto(index, at)
      return index
    },
    () => {
      const index = new Map<string, Array<LocatedRegular>>()
      for (const at of first.nodes) tagInto(index, at)
      return index
    },
  ] as const
  const narrow = arms[0]()
  const wide = arms[1]()
  if (narrow.size === 0) {
    throw new Error("the vault holds no `@` prose — the narrow arm measures nothing")
  }
  if (wide.size <= narrow.size) {
    throw new Error("the wide arm files no more keys than the narrow one — check the vault")
  }
  return alternating(arms)
}

const mentionOnlyInto = (
  index: Map<string, Array<LocatedRegular>>,
  located: Located,
): void => {
  if (!isRegular(located)) return
  mentionsFrom(index, located, located.node.title)
  if (located.node.desc !== undefined) mentionsFrom(index, located, located.node.desc)
}

const mentionsFrom = (
  index: Map<string, Array<LocatedRegular>>,
  regular: LocatedRegular,
  text: string,
): void => {
  if (!text.includes("@")) return
  for (const part of titleParts(text)) {
    if (part.kind !== "tag" || part.sigil !== "@") continue
    const held = index.get(part.tag)
    if (held === undefined) index.set(part.tag, [regular])
    else if (held[held.length - 1] !== regular) held.push(regular)
  }
}

const walks = (): { parts: number; matchAll: number; loop: number } => {
  const prose: Array<string> = []
  for (const at of first.nodes) {
    if (!isRegular(at)) continue
    prose.push(at.node.title)
    if (at.node.desc !== undefined) prose.push(at.node.desc)
  }

  const viaParts = (): ReadonlyArray<string> => {
    const found: Array<string> = []
    for (const text of prose) {
      if (!mayHoldTag(text)) continue
      for (const part of titleParts(text)) if (part.kind === "tag") found.push(tagText(part))
    }
    return found
  }
  const viaMatchAll = (): ReadonlyArray<string> => {
    const found: Array<string> = []
    for (const text of prose) {
      if (!mayHoldTag(text)) continue
      let at = 0
      const parts: Array<{ kind: "text" | "tag"; written?: string }> = []
      for (const match of text.matchAll(titleTagRe())) {
        const start = match.index
        if (start > at) parts.push({ kind: "text" })
        parts.push({ kind: "tag", written: match[0] })
        at = start + match[0].length
      }
      if (at < text.length) parts.push({ kind: "text" })
      for (const part of parts) if (part.written !== undefined) found.push(part.written)
    }
    return found
  }
  const viaLoop = (): ReadonlyArray<string> => {
    const found: Array<string> = []
    for (const text of prose) {
      if (!mayHoldTag(text)) continue
      const tags = titleTagRe()
      let match: RegExpExecArray | null
      while ((match = tags.exec(text)) !== null) found.push(match[0])
    }
    return found
  }

  const answers = [viaParts(), viaMatchAll(), viaLoop()].map((tags) => tags.join(" "))
  if (answers[0] === "" ) throw new Error("the vault's prose holds no tags — this measures nothing")
  if (answers[0] !== answers[1] || answers[0] !== answers[2]) {
    throw new Error("the three walks disagree about the corpus's tags — none of them is a number")
  }
  const [parts, matchAll] = alternating([viaParts, viaMatchAll])
  const [again, loop] = alternating([viaParts, viaLoop])
  return { parts: median([parts, again]), matchAll, loop }
}

const say = (name: string, times: ReadonlyArray<number>): void => {
  console.log(timesSaid(name, times, 14))
}

console.log(
  `vault: ${corpus.size} files, ${records} records, ` +
    `${EDITS} one-file edits, each to a different file\n` +
    `${runtimeSaid()}\n`,
)
say("rebuild", rebuilt)
say("patch+residue", patchedResidueMs)
say("patch", patchedMs)
console.log(
  `\npatch is ${(median(rebuilt) / median(patchedMs)).toFixed(1)}× the rebuild's speed` +
    ` on one file's edit, and ${
      (median(patchedResidueMs) / median(patchedMs)).toFixed(1)
    }× the same patch paying the corpus-sized residue it used to owe`,
)
const [asMap, asLayer] = walked([oracle, carried])
console.log(
  `byId read, one lookup per record: ${(asMap as number).toFixed(2)}ms rebuilt,` +
    ` ${(asLayer as number).toFixed(2)}ms patched`,
)
console.log(`\nthe id map handed forward, per edit:`)
lever("a different file each time", edits)
lever("the same file every time", typing)
console.log(`\nthe index handed on and NOT written, per index per edit:`)
unwritten()
untouched()
console.log(`\nthe biggest key of each re-filed index, across one file's edit:`)
resorting("taggedBy", first.taggedBy, (one) => one, byCorpus)
resorting("byDay", first.byDay, (one) => one.at, byCorpus)
resorting("children", first.children, (one) => one, bySibling)
resorting("namedBy", first.namedBy, (one) => one.at, byCorpus)
const [wasLayered, stayCloned] = beside()
console.log(
  `\nthe indexes, cloned on their own: ${wasLayered.toFixed(3)}ms for the ${LAYERED.length}` +
    ` a patch layers now, ${stayCloned.toFixed(3)}ms for the ${CLONED.length} it still clones` +
    ` — the residue this took off, against what is left`,
)
const [flatBuilt, flatCounted] = flatly()
console.log(
  `the corpus read flat: ${flatBuilt.toFixed(3)}ms to build the list a patch used to hand on,` +
    ` ${flatCounted.toFixed(3)}ms to walk the grouping for the length it wanted it for`,
)
const [wholeMap, wholeLayer] = wholly()
console.log(
  `namedBy walked whole: ${wholeMap.toFixed(3)}ms as a map, ${wholeLayer.toFixed(3)}ms` +
    ` through a layer — which is why the four read whole are not layered`,
)
const [narrowFold, wideFold] = folds()
console.log(
  `\nthe tag fold over the whole corpus: ${narrowFold.toFixed(2)}ms filing \`@\` alone,` +
    ` ${wideFold.toFixed(2)}ms filing both sigils` +
    ` — the width this index pays per REBUILD (${first.taggedBy.size} keys)`,
)
const walked3 = walks()
console.log(
  `the tag walk over the same prose: ${walked3.parts.toFixed(2)}ms as \`titleParts\` is` +
    ` (\`exec\`), ${walked3.matchAll.toFixed(2)}ms as it was (\`matchAll\`),` +
    ` ${walked3.loop.toFixed(2)}ms for the private loop this tree declines to have`,
)
