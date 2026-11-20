import { TEST_CLAIMS } from "@olai/format/testlib"
import {
  derive,
  type Derived,
  mayHoldTag,
  tagText,
  titleParts,
} from "./derive.ts"
import {
  median,
  recordsOf,
  runtimeSaid,
  setOf,
  timed,
  timesSaid,
  vaultOf,
} from "./fixtures.testlib.ts"
import { isLeftoverArchive, isMirror, isTrashed } from "./node.ts"
import { type TagUse, vocabularyOf } from "./vocabulary.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
const ROUNDS = Number(process.env["OLAI_BENCH_ROUNDS"] ?? 20)

const view = derive(TEST_CLAIMS, recordsOf(setOf(Object.fromEntries(vaultOf({ files: FILES, records: RECORDS })))))

const rowFor = (sigil: TagUse["sigil"], name: string, count: number): TagUse => ({
  sigil,
  name,
  folded: name.toLowerCase(),
  count,
})

const ranked = (counts: ReadonlyMap<string, TagUse>): ReadonlyArray<TagUse> =>
  [...counts.values()].sort((one, other) =>
    other.count - one.count || one.name.localeCompare(other.name)
  )

const walked = (derived: Derived): ReadonlyArray<TagUse> => {
  const counts = new Map<string, TagUse>()
  for (const located of derived.nodes) {
    if (
      isMirror(located.node) || isTrashed(TEST_CLAIMS, located.file) ||
      isLeftoverArchive(located.file)
    ) continue
    const voted = new Set<string>()
    for (const text of [located.node.title, located.node.desc]) {
      if (text === undefined || !mayHoldTag(text)) continue
      for (const part of titleParts(text)) {
        if (part.kind !== "tag") continue
        const key = tagText(part)
        if (voted.has(key)) continue
        voted.add(key)
        const before = counts.get(key)
        counts.set(key, before === undefined ? rowFor(part.sigil, part.tag, 1) : {
          ...before,
          count: before.count + 1,
        })
      }
    }
  }
  return ranked(counts)
}

const titlesOnly = (derived: Derived): ReadonlyArray<TagUse> => {
  const counts = new Map<string, TagUse>()
  for (const located of derived.nodes) {
    if (
      isMirror(located.node) || isTrashed(TEST_CLAIMS, located.file) ||
      isLeftoverArchive(located.file)
    ) continue
    if (!mayHoldTag(located.node.title)) continue
    for (const part of titleParts(located.node.title)) {
      if (part.kind !== "tag") continue
      const key = tagText(part)
      const before = counts.get(key)
      counts.set(key, before === undefined ? rowFor(part.sigil, part.tag, 1) : {
        ...before,
        count: before.count + 1,
      })
    }
  }
  return ranked(counts)
}

const fresh = (): Derived => ({ ...view })

const arms = { index: vocabularyOf, walk: walked, titles: titlesOnly } as const

const spelling = (tags: ReadonlyArray<TagUse>): string =>
  tags.map((tag) => `${tagText({ sigil: tag.sigil, tag: tag.name })} ${tag.count}`)
    .join("\n")

const agreeing = (one: keyof typeof arms, other: keyof typeof arms): void => {
  const said = spelling(arms[one](fresh()))
  const alsoSaid = spelling(arms[other](fresh()))
  if (said === alsoSaid) return
  throw new Error(
    `the ${one} arm and the ${other} arm disagree about the set's tags, so neither` +
      ` number means anything:\n  ${one}: ${said.split("\n").length} tags` +
      `\n  ${other}: ${alsoSaid.split("\n").length}`,
  )
}

agreeing("index", "walk")
const tags = view.taggedBy.size
if (tags < 2) throw new Error(`the vault holds ${tags} tags — this measures nothing`)
const titlesFound = arms.titles(fresh()).length
if (titlesFound >= tags) {
  throw new Error(
    `the title-only arm found ${titlesFound} of ${tags} tags — it is supposed to` +
      ` miss the ones only a note writes`,
  )
}

const run = (name: keyof typeof arms): ReadonlyArray<number> => {
  const arm = arms[name]
  for (let round = 0; round < 3; round++) arm(fresh())
  return Array.from({ length: ROUNDS }, () => {
    const derived = fresh()
    return timed(() => {
      arm(derived)
    })
  })
}

console.log(
  `vault: ${view.byFile.size} files, ${view.nodes.length} records, ${tags} tags` +
    ` in the index — the completion asked ${ROUNDS} times\n` +
    `${runtimeSaid()}\n`,
)
const timings = new Map(
  (["index", "walk", "titles"] as const).map((name) => [name, run(name)]),
)
for (const [name, times] of timings) console.log(timesSaid(name, times, 7))
console.log(
  `\nthe index against the walk that answers the same ${tags} tags:` +
    ` ${
      (median(timings.get("walk") as ReadonlyArray<number>) /
        median(timings.get("index") as ReadonlyArray<number>)).toFixed(1)
    }×` +
    ` — and against the title-only walk this replaced, which answered ${titlesFound}:` +
    ` ${
      (median(timings.get("titles") as ReadonlyArray<number>) /
        median(timings.get("index") as ReadonlyArray<number>)).toFixed(1)
    }×`,
)
