import { TEST_CLAIMS } from "@olai/format/testlib"
import { type Address, addressOf } from "./address.ts"
import type { Reference, Way } from "./backlinks.ts"
import { tagsIn, type Derived } from "./derive.ts"
import { type Document, type Face, faceOf, type FaceHead } from "./document.ts"
import { linksIn, recordLinks } from "./documents.ts"
import { seeded } from "./fixtures.testlib.ts"
import { fileKind } from "./kinds.ts"
import { isMirror, isPutAway, isRegular, type Located } from "./node.ts"
import type { OutlineSet } from "./set.ts"

export const scannedReferrers = (
  address: Address,
  faces: ReadonlyArray<Face>,
  derived: Pick<Derived, "byFile">,
): ReadonlyArray<Reference> => {
  const found = new Map<object, { source: Reference["source"]; ways: Set<Way> }>()
  const add = (source: Reference["source"], ...ways: ReadonlyArray<Way>): void => {
    const key: object = source
    const held = found.get(key)
    if (held === undefined) found.set(key, { source, ways: new Set(ways) })
    else for (const way of ways) held.ways.add(way)
  }
  if (address.kind === "node") {
    const asked = new Set([address.id, ...mirrorsOf(address.id, faces, derived)])
    for (const face of faces) {
      if (isPutAway(TEST_CLAIMS, face.path)) continue
      const records = derived.byFile.get(face.path)
      if (records === undefined) {
        const ways = bodyWays(face, asked)
        if (ways.length > 0) add(headOf(face), ...ways)
        continue
      }
      for (const located of records) {
        if (!isRegular(located) || located.node.id === address.id) continue
        const ways = recordWays(located, asked)
        if (ways.length > 0) add(located, ...ways)
      }
    }
  } else {
    const here = address.path
    const points = (link: Address): boolean => {
      if (link.kind === "node" || link.path !== here) return false
      if (address.kind === "heading") return link.kind === "heading" && link.slug === address.slug
      if (address.kind === "row") return link.kind === "row" && link.id === address.id
      return true
    }
    for (const face of faces) {
      if (face.path === here || isPutAway(TEST_CLAIMS, face.path)) continue
      if (!face.links.some(points)) continue
      const records = derived.byFile.get(face.path)
      if (records === undefined) {
        add(headOf(face), "link")
        continue
      }
      for (const located of records) {
        if (!isRegular(located)) continue
        if (!recordLinks(TEST_CLAIMS, located).some(points)) continue
        add(located, "link")
      }
    }
  }
  return [...found.values()].map(({ source, ways }) => ({
    source,
    ways: ["see", "mention", "link"].filter((way) => ways.has(way as Way)) as ReadonlyArray<Way>,
  }))
}

const mirrorsOf = (
  id: string,
  faces: ReadonlyArray<Face>,
  derived: Pick<Derived, "byFile">,
): ReadonlyArray<string> => {
  const asked: Array<string> = []
  const seen = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const face of faces) {
      for (const located of derived.byFile.get(face.path) ?? []) {
        if (isMirror(located.node) && seen.has(located.node.mirror) && !seen.has(located.node.id)) {
          seen.add(located.node.id)
          asked.push(located.node.id)
          grew = true
        }
      }
    }
  }
  return asked
}

const bodyWays = (face: Face, asked: ReadonlySet<string>): ReadonlyArray<Way> => {
  const ways = new Set<Way>()
  for (const link of face.links) {
    if (link.kind === "node" && asked.has(link.id)) ways.add("link")
  }
  for (const tag of face.tags) {
    if (tag.charAt(0) === "@" && asked.has(tag.slice(1))) ways.add("mention")
  }
  return [...ways] as ReadonlyArray<Way>
}

const recordWays = (located: Located, asked: ReadonlySet<string>): ReadonlyArray<Way> => {
  if (!isRegular(located)) return []
  const node = located.node
  const ways = new Set<Way>()
  for (const id of node.see ?? []) {
    if (asked.has(id)) ways.add("see")
  }
  for (const address of linksIn(TEST_CLAIMS, located.file, node.title)) {
    if (address.kind === "node" && asked.has(address.id)) ways.add("link")
  }
  if (node.desc !== undefined) {
    for (const address of linksIn(TEST_CLAIMS, located.file, node.desc)) {
      if (address.kind === "node" && asked.has(address.id)) ways.add("link")
    }
  }
  for (const tag of tagsIn(node.title)) {
    if (tag.charAt(0) === "@" && asked.has(tag.slice(1))) ways.add("mention")
  }
  if (node.desc !== undefined) {
    for (const tag of tagsIn(node.desc)) {
      if (tag.charAt(0) === "@" && asked.has(tag.slice(1))) ways.add("mention")
    }
  }
  return [...ways] as ReadonlyArray<Way>
}

export const facesIn = (set: OutlineSet): ReadonlyArray<Face> => set.documents.map(faceOf)

const headOf = (face: Face): FaceHead => ({ path: face.path, title: face.title })

export const addressesIn = (set: OutlineSet): ReadonlyArray<Address> => {
  const found: Array<Address> = []
  const add = (address: Address | null): void => {
    if (address !== null) found.push(address)
  }
  for (const document of set.documents) {
    add(addressOf(TEST_CLAIMS, document.path, null))
    if (document.holds === "text" && document.kept) {
      for (const slug of document.headings) add(addressOf(TEST_CLAIMS, document.path, slug))
    }
    if (document.holds === "nodes") {
      for (const located of document.nodes) {
        add(addressOf(TEST_CLAIMS, "", located.node.id))
        add(addressOf(TEST_CLAIMS, document.path, located.node.id))
      }
    }
  }
  add(addressOf(TEST_CLAIMS, "nowhere.md", null))
  add(addressOf(TEST_CLAIMS, "nowhere.md", "gone"))
  add(addressOf(TEST_CLAIMS, "", "nobody-claims-this"))
  return found
}

export const sampledAddresses = (
  set: OutlineSet,
  every: number,
): ReadonlyArray<Address> => {
  const all = addressesIn(set)
  return all.filter((address, at) => address.kind === "document" || at % every === 0)
}

export const outlinesAmong = (paths: Iterable<string>): ReadonlyArray<string> =>
  [...paths].filter((path) => TEST_CLAIMS.byKind.get(fileKind(TEST_CLAIMS, path) ?? "")?.holds === "nodes")

export const documentsAmong = (paths: Iterable<string>): ReadonlyArray<string> =>
  [...paths].filter((path) => fileKind(TEST_CLAIMS, path) === "markdown")


export type Revision = ReadonlyMap<string, string>

const pathOf = (which: number): string => {
  const at = which % 7
  if (at === 6) return `wing/held${which}.olai`
  if (at === 5) return `deep/held${which}.olai`
  return `held${which}.olai`
}

const WING = "wing.olai"

const TRASH = "_olai/Trash.olai"

const SHOWN = "page.html"

const HEADINGS = ["scope", "risks"] as const

const spelled = (from: string, to: string): string =>
  `${"../".repeat(from.split("/").length - 1)}${to}`

const targetsIn = (bodies: ReadonlyArray<string>): ReadonlyArray<string> => [
  ...bodies,
  ...bodies.map((body) => `${body}#${HEADINGS[0]}`),
  ...bodies.map((body) => `${body}#${HEADINGS[1]}`),
  "gone.md",
  SHOWN,
  "#n0",
  "#nobody",
]

const pick = <T>(random: () => number, from: ReadonlyArray<T>): T =>
  from[Math.floor(random() * from.length)] as T

const linked = (
  random: () => number,
  from: string,
  targets: ReadonlyArray<string>,
): string => `[see](${spelled(from, pick(random, targets))})`

const outlineWritten = (
  random: () => number,
  file: string,
  ids: ReadonlyArray<string>,
  targets: ReadonlyArray<string>,
): string =>
  ids
    .map((id, at) => {
      if (at > 0 && random() < 0.1) {
        return JSON.stringify({ id, ord: `a${at}`, mirror: ids[0] })
      }
      const record: Record<string, unknown> = {
        id,
        ord: `a${at}`,
        title: random() < 0.3 ? `row ${id} ${linked(random, file, targets)}` : `row ${id}`,
      }
      if (random() < 0.25) {
        record["title"] = String(record["title"]) + " [document](" + (spelled(file, pick(random, targets).split("#")[0] as string)) + ")"
      }
      if (random() < 0.2) record["see"] = [pick(random, ids)]
      if (random() < 0.25) record["desc"] = `a note ${linked(random, file, targets)}`
      return JSON.stringify(record)
    })
    .join("\n")

const bodyOf = (
  random: () => number,
  file: string,
  headings: ReadonlyArray<string>,
  targets: ReadonlyArray<string>,
): string =>
  [
    `# ${file}`,
    "",
    ...headings.flatMap((heading) => [
      `## ${heading}`,
      "",
      `prose ${linked(random, file, targets)}`,
      "",
    ]),
    `and ${linked(random, file, targets)} at the end`,
    "",
  ].join("\n")

const idsFor = (which: number, many: number): ReadonlyArray<string> =>
  Array.from({ length: many }, (_, at) => `n${which}x${at}`)

export const linkyVault = (
  { outlines = 4, bodies = 4, records = 6, seed = 20260825 }: {
    readonly outlines?: number
    readonly bodies?: number
    readonly records?: number
    readonly seed?: number
  } = {},
): Revision => {
  const random = seeded(seed)
  const bodyPaths = Array.from({ length: bodies }, (_, at) => `note${at}.md`)
  const targets = targetsIn(bodyPaths)
  const vault = new Map<string, string>()
  for (let at = 0; at < outlines; at++) {
    const file = at === 0 ? WING : at === 1 ? TRASH : pathOf(at)
    vault.set(file, outlineWritten(random, file, idsFor(at, records), targets))
  }
  for (const file of bodyPaths) vault.set(file, bodyOf(random, file, HEADINGS, targets))
  vault.set(SHOWN, "")
  return vault
}

export const linkyRevisions = (
  first: Revision,
  random: () => number,
  many: number,
): ReadonlyArray<Revision> => {
  let held = new Map(first)
  const stream: Array<Revision> = [held]
  const away = new Map<string, string>()
  const targets = targetsIn(documentsAmong(first.keys()))
  for (let at = 0; at < many; at++) {
    const next = new Map(held)
    const roll = random()
    if (roll < 0.5) editedRecord(random, next, at, targets)
    else if (roll < 0.72) editedBody(random, next, at, targets)
    else if (roll < 0.84) renamed(random, next, away)
    else if (roll < 0.92) removed(random, next, away)
    else restored(random, next, away)
    held = next
    stream.push(held)
  }
  return stream
}

const editedRecord = (
  random: () => number,
  vault: Map<string, string>,
  at: number,
  targets: ReadonlyArray<string>,
): void => {
  const files = outlinesAmong(vault.keys()).filter((file) => (vault.get(file) ?? "") !== "")
  if (files.length === 0) return
  const file = pick(random, files)
  const lines = (vault.get(file) as string).split("\n").filter((line) => line !== "")
  if (lines.length === 0) return
  const which = Math.floor(random() * lines.length)
  const record = JSON.parse(lines[which] as string) as Record<string, unknown>
  if ("mirror" in record) return
  const roll = random()
  if (roll < 0.3) record["title"] = `row ${at} plainly retitled`
  else if (roll < 0.42) record["title"] = `row ${at} ${linked(random, file, targets)}`
  else if (roll < 0.55) {
    if (random() < 0.8) record["desc"] = `a note ${linked(random, file, targets)}`
    else delete record["desc"]
  } else if (roll < 0.82) {
    if (random() < 0.75) {
      record["title"] = String(record["title"]) + " [document](" + (spelled(file, pick(random, targets).split("#")[0] as string)) + ")"
    } else record["title"] = `row ${at}`
  } else {
    const ids = lines.map((line) => String((JSON.parse(line) as { id: string }).id))
    if (random() < 0.75) record["see"] = [pick(random, ids)]
    else delete record["see"]
  }
  lines[which] = JSON.stringify(record)
  vault.set(file, lines.join("\n"))
}

const editedBody = (
  random: () => number,
  vault: Map<string, string>,
  at: number,
  targets: ReadonlyArray<string>,
): void => {
  const files = documentsAmong(vault.keys())
  if (files.length === 0) return
  const roll = random()
  const headings = roll < 0.3
    ? HEADINGS.slice(0, 1)
    : roll < 0.5
    ? [...HEADINGS, `extra${at % 3}`]
    : HEADINGS
  const file = pick(random, files)
  vault.set(file, bodyOf(random, file, headings, targets))
}

const renamed = (
  random: () => number,
  vault: Map<string, string>,
  away: Map<string, string>,
): void => {
  const there = [...vault.keys()].filter((file) => !isPutAway(TEST_CLAIMS, file))
  if (there.length === 0) return
  const from = pick(random, there)
  const to = TEST_CLAIMS.byKind.get(fileKind(TEST_CLAIMS, from) ?? "")?.holds === "nodes"
    ? `renamed${away.size}.olai`
    : `renamed${away.size}.md`
  if (vault.has(to)) return
  const text = vault.get(from) as string
  vault.set(to, text)
  away.set(from, text)
  vault.delete(from)
}

const removed = (
  random: () => number,
  vault: Map<string, string>,
  away: Map<string, string>,
): void => {
  const there = [...vault.keys()]
  if (there.length <= 2) return
  const file = pick(random, there)
  away.set(file, vault.get(file) as string)
  vault.delete(file)
}

const restored = (
  random: () => number,
  vault: Map<string, string>,
  away: Map<string, string>,
): void => {
  const gone = [...away.keys()]
  if (gone.length === 0) return
  const file = pick(random, gone)
  vault.set(file, away.get(file) as string)
  away.delete(file)
}
