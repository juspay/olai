/**
 * THE LINKS INDEX, HELD TO THE WALK IT REPLACED — the reference arm, the
 * corpora that move links, and the addresses to ask about.
 *
 * `./pointing.ts` is an INDEX where `referrersTo` was a scan, and the claim it
 * makes is an equivalence: the same referrers, in the same order, for every
 * address, at every revision. So what holds it is a differential and not a
 * table of expectations, which is the arrangement `./patch.ts` has with
 * `derive` one value over.
 *
 * TWO ARMS AND ONE COPY OF EACH. The reference arm below is the walk as it
 * STOOD before `perf-doc-backlinks-index`, written out once and read by the
 * differential (`./pointing.test.ts`) and by the benchmark
 * (`./pointing.bench.ts`) alike — `./fixtures.testlib.ts`'s own argument for
 * keeping the deleted day walks in one place, and it matters more here: two
 * reconstructions of one deleted scan could disagree, and then the ratio the
 * bench printed would be about the difference between them while the property
 * test went on passing against the other one.
 *
 * IT IS AN ORACLE AND NOT LEGACY, which is the line the no-legacy law draws:
 * nothing that ships calls any of it, and nothing here is in the package's
 * exports.
 *
 * WHAT THE CORPORA ARE FOR is the other half. `./corpora.testlib.ts` writes the
 * awkward sets the patcher is held to and writes no LINK at all — no `doc`, no
 * `[…](…)` in a title or a note, no markdown body with anything in it — because
 * the derivation it is about reads none of them. This index reads nothing else,
 * so it needs corpora of its own, and they are grown against the write shapes
 * that MOVE a link: a title that carries one, a note that carries one, a `see`,
 * a `doc` attachment, a document body rewritten, a file RENAMED that other
 * files' links name, and a file deleted.
 *
 * Nothing here has tests of its own — it is a helper module, not a suite, and
 * `bun test` collects only `*.test.ts`.
 */

import { type Address, addressOf } from "./address.ts"
import { type Referrer } from "./backlinks.ts"
import type { Derived } from "./derive.ts"
import { type Document, type Face, faceOf } from "./document.ts"
import { recordLinks } from "./documents.ts"
import { seeded } from "./fixtures.testlib.ts"
import { fileKind } from "./kinds.ts"
import { isPutAway, isRegular } from "./node.ts"
import type { OutlineSet } from "./set.ts"

// ── the reading as it STOOD, before the links index ────────────────────

/**
 * WHO POINTS AT AN ADDRESS, by WALKING every face of the directory — the
 * `referrersTo` of `packages/format/src/backlinks.ts` as it was written before
 * `perf-doc-backlinks-index`, verbatim but for the faces coming in as a list.
 *
 * This is the cost the roadmap node named: every link of every file, tested per
 * revision, per tab sitting on any page with a body. It is kept because the new
 * answer is defined as being this one.
 */
export const scannedReferrers = (
  address: Address,
  faces: ReadonlyArray<Face>,
  derived: Pick<Derived, "byFile">,
): ReadonlyArray<Referrer> => {
  const here = address.kind === "node" ? null : address.path
  const points = (link: Address): boolean => {
    if (address.kind === "node") return link.kind === "node" && link.id === address.id
    if (link.kind === "node" || link.path !== address.path) return false
    return address.kind === "document" || link.kind === "heading" &&
      link.slug === address.slug
  }
  const found: Array<Referrer> = []
  for (const face of faces) {
    if (face.path === here || isPutAway(face.path)) continue
    if (!face.links.some(points)) continue
    const records = derived.byFile.get(face.path)
    if (records === undefined) {
      found.push({ face })
      continue
    }
    for (const located of records) {
      if (!isRegular(located)) continue
      if (!recordLinks(located).some(points)) continue
      found.push({ face, at: located })
    }
  }
  return found
}

/** The set's faces, as the walk above takes them — the projection the index
 *  files, so the two arms are compared over one shape rather than over a face
 *  on one side and a whole document on the other. */
export const facesIn = (set: OutlineSet): ReadonlyArray<Face> => set.documents.map(faceOf)

// ── what to ask about ──────────────────────────────────────────────────

/**
 * EVERY ADDRESS THIS DIRECTORY CAN BE ASKED ABOUT, and a few it cannot answer.
 *
 * The three arms of the grammar, each drawn from the set itself: every served
 * file as a document, every heading of every `.md` as a heading, and every id
 * any record claims as a node. Then the negatives, which are the half a
 * differential over a corpus would otherwise never reach — a path the directory
 * does not serve, a heading nothing spells, an id nobody claims — because
 * "nothing points here" is an answer an index can get wrong in exactly the same
 * way it can get a hit wrong.
 */
export const addressesIn = (set: OutlineSet): ReadonlyArray<Address> => {
  const found: Array<Address> = []
  const add = (address: Address | null): void => {
    if (address !== null) found.push(address)
  }
  for (const document of set.documents) {
    add(addressOf(document.path, null))
    if (document.kind === "document") {
      for (const slug of document.headings) add(addressOf(document.path, slug))
    }
    if (document.kind === "outline") {
      for (const located of document.nodes) add(addressOf("", located.node.id))
    }
  }
  add(addressOf("nowhere.md", null))
  add(addressOf("nowhere.md", "gone"))
  add(addressOf("", "nobody-claims-this"))
  return found
}

/** …and the same list capped, for a vault read off disk: `docs/` claims
 *  thousands of ids and hundreds of headings, and asking the WALK about every
 *  one of them at every revision is the cost this whole node is about, paid by
 *  the test rather than by the app. Every DOCUMENT path is kept whichever way —
 *  it is the arm a page asks — and the other two are sampled evenly so the
 *  sample is a fixture rather than the first `n` of a directory walk. */
export const sampledAddresses = (
  set: OutlineSet,
  every: number,
): ReadonlyArray<Address> => {
  const all = addressesIn(set)
  return all.filter((address, at) => address.kind === "document" || at % every === 0)
}

/** Which files a corpus holds as OUTLINES — the half a rename has to keep
 *  spelled the way the registry spells it. */
export const outlinesAmong = (paths: Iterable<string>): ReadonlyArray<string> =>
  [...paths].filter((path) => fileKind(path) === "outline")

/** …and its complement over the kinds that hold a body. */
export const documentsAmong = (paths: Iterable<string>): ReadonlyArray<string> =>
  [...paths].filter((path) => fileKind(path) === "document")


// ── the corpora, and the edits that move a link ────────────────────────

/**
 * One revision of the served directory: every path it holds and the bytes at
 * it — `./incremental.testlib.ts`'s own shape, so a generated corpus and a real
 * one are the same value here.
 */
export type Revision = ReadonlyMap<string, string>

/**
 * WHERE THE GENERATED OUTLINES GO.
 *
 * Mostly flat, and deliberately not entirely: two of every seven sit in a
 * directory, and one in seven in a directory NAMED after a file beside it —
 * the pair the two readings of path order used to disagree about, which is a
 * corner this index inherits because its members are in path order.
 */
const pathOf = (which: number): string => {
  const at = which % 7
  if (at === 6) return `wing/held${which}.olai`
  if (at === 5) return `deep/held${which}.olai`
  return `held${which}.olai`
}

/** …and the one FILE the directory called `wing/` also holds a file named
 *  after, so the separator-sorts-first rule has something to decide. */
const WING = "wing.olai"

/** The archive, whose referrers are left out at the READ — a rule only a corpus
 *  that has one can test. */
const TRASH = "_olai/Trash.olai"

/** The one file the set keeps the PATH of and not the bytes: its `links` are
 *  empty because nothing read it rather than because it points nowhere, so it
 *  is a face that files no key at all. */
const SHOWN = "page.html"

/** The headings the bodies write, which are what a `#slug` link lands on. */
const HEADINGS = ["scope", "risks"] as const

/**
 * HOW A FILE SPELLS A LINK to a target at the ROOT.
 *
 * Every generated target sits at the top of the directory and every link is
 * written from wherever its file is, so a nested file writes `../` for each
 * segment above it — which is what a person writes and what the format resolves
 * ({@link ./documents.ts}'s `resolveRelative`). Written rather than assumed:
 * a generator that spelled the bare path from a nested file would be writing
 * links that resolve into a directory nothing serves, and the whole corpus
 * would answer "nothing points anywhere" while passing.
 */
const spelled = (from: string, to: string): string =>
  `${"../".repeat(from.split("/").length - 1)}${to}`

/** The addresses a corpus's links draw from: every body it holds, both as the
 *  document and as one of its headings, plus a `.md` the directory has NOT got
 *  and a node id — because a link that names nothing is a link all the same,
 *  and the reader who asks about that path later has to be told about it. */
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

/** A markdown link, written the way prose writes one, from the file that holds
 *  it. */
const linked = (
  random: () => number,
  from: string,
  targets: ReadonlyArray<string>,
): string => `[see](${spelled(from, pick(random, targets))})`

/** One outline, written with links in every field that can hold one: the `doc`
 *  attachment, the `see` edge, a link inside the TITLE, and a link inside the
 *  NOTE. Those four are the whole of `recordLinks`, which is what makes a
 *  corpus that writes all four a corpus the record half of the answer is really
 *  exercised over. */
const outlineWritten = (
  random: () => number,
  file: string,
  ids: ReadonlyArray<string>,
  targets: ReadonlyArray<string>,
): string =>
  ids
    .map((id, at) => {
      // A PLACEMENT now and then: it carries no prose and no `see`, so it files
      // nothing here — which is a claim the record half of the answer makes
      // (`isRegular`) and one only a corpus with mirrors in it can break.
      if (at > 0 && random() < 0.1) {
        return JSON.stringify({ id, ord: `a${at}`, mirror: ids[0] })
      }
      const record: Record<string, unknown> = {
        id,
        ord: `a${at}`,
        title: random() < 0.3 ? `row ${id} ${linked(random, file, targets)}` : `row ${id}`,
      }
      if (random() < 0.25) {
        record["doc"] = spelled(file, pick(random, targets).split("#")[0] as string)
      }
      if (random() < 0.2) record["see"] = [pick(random, ids)]
      if (random() < 0.25) record["desc"] = `a note ${linked(random, file, targets)}`
      return JSON.stringify(record)
    })
    .join("\n")

/** One `.md` body: a title line, the headings a `#slug` lands on, and prose
 *  with links in it — the arm of the answer that has no record to attribute a
 *  link to and comes back as the document's own. */
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

/** The ids one file claims — spelled from its own position, so a file nobody
 *  edited is written byte for byte the same every revision and its records are
 *  the same objects one decode later. */
const idsFor = (which: number, many: number): ReadonlyArray<string> =>
  Array.from({ length: many }, (_, at) => `n${which}x${at}`)

/**
 * A GENERATED DIRECTORY with links in every shape the format has — the first
 * revision of the stream below, and the benchmark's corpus.
 *
 * SEEDED, so the corpus is a fixture rather than a lottery, and the seed is a
 * parameter so a caller that wants a second, different vault of the same shape
 * can have one.
 */
export const linkyVault = (
  { outlines = 4, bodies = 4, records = 6, seed = 20260825 }: {
    readonly outlines?: number
    readonly bodies?: number
    readonly records?: number
    readonly seed?: number
  } = {},
): Revision => {
  const random = seeded(seed)
  // The bodies' PATHS first, because every link in the directory is drawn from
  // them: a corpus whose targets were minted as it went would point mostly at
  // files written after the pointer, and the first revision would be a
  // directory of links that name nothing.
  const bodyPaths = Array.from({ length: bodies }, (_, at) => `note${at}.md`)
  const targets = targetsIn(bodyPaths)
  const vault = new Map<string, string>()
  for (let at = 0; at < outlines; at++) {
    const file = at === 0 ? WING : at === 1 ? TRASH : pathOf(at)
    vault.set(file, outlineWritten(random, file, idsFor(at, records), targets))
  }
  for (const file of bodyPaths) vault.set(file, bodyOf(random, file, HEADINGS, targets))
  // A file the set holds the path of and not the bytes.
  vault.set(SHOWN, "")
  return vault
}

/**
 * THE EDITS THAT MOVE A LINK, one revision at a time.
 *
 * Every arm here is a write shape a person or an agent really makes, and each
 * of them moves this index in a different way — which is the whole point of the
 * list being written out rather than "rewrite a random file":
 *
 *   - a plain KEYSTROKE: a title rewritten with no link in it at all, which is
 *     most of what anybody types and which must move this index NOT AT ALL —
 *     the arm that makes "an edit costs what it touched" a thing a run can
 *     count rather than a sentence;
 *   - a TITLE rewritten with a different link in it, which is what `set_title`
 *     does to a row somebody wrote a `[…](…)` into;
 *   - a NOTE rewritten, which is `set_desc` and is the edit a reference somebody
 *     adds in prose actually is;
 *   - a `doc` ATTACHED, re-pointed or taken away, which is the one field of a
 *     record that names a file;
 *   - a `see` EDGE moved, which is the format's own free cross-reference;
 *   - a DOCUMENT BODY written, which moves links this index holds and which the
 *     delta the wire carries names no records for at all;
 *   - a HEADING added or taken away, which moves the heading half of a key and
 *     must leave the document half exactly where it was;
 *   - a FILE RENAMED — gone from one path and written at another, byte for
 *     byte — which is the edit that moves an entry between two keys AND leaves
 *     every link that named the old path pointing at nothing;
 *   - a FILE DELETED and one ARRIVING BACK, which are the two ends of a key's
 *     life.
 *
 * A REVISION IS THE WHOLE DIRECTORY, and a file the edit did not name is handed
 * on with the very bytes the last one held — which is what lets the caller's
 * decode cache hand the same objects back, and therefore what makes "nothing
 * moved, nothing cloned" a claim a case can check rather than a hope.
 */
export const linkyRevisions = (
  first: Revision,
  random: () => number,
  many: number,
): ReadonlyArray<Revision> => {
  let held = new Map(first)
  const stream: Array<Revision> = [held]
  /** Where a file that left was taken from, so one can come back and the
   *  directory does not drain. */
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

/** One record of one outline, rewritten in one of the four fields that can hold
 *  a link — the first four arms of {@link linkyRevisions}' list. */
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
  // A PLACEMENT carries none of these fields, so an edit that gave it one would
  // be writing a record the format does not have.
  if ("mirror" in record) return
  const roll = random()
  if (roll < 0.3) record["title"] = `row ${at} plainly retitled`
  else if (roll < 0.42) record["title"] = `row ${at} ${linked(random, file, targets)}`
  else if (roll < 0.55) {
    if (random() < 0.8) record["desc"] = `a note ${linked(random, file, targets)}`
    else delete record["desc"]
  } else if (roll < 0.82) {
    if (random() < 0.75) {
      record["doc"] = spelled(file, pick(random, targets).split("#")[0] as string)
    } else delete record["doc"]
  } else {
    const ids = lines.map((line) => String((JSON.parse(line) as { id: string }).id))
    if (random() < 0.75) record["see"] = [pick(random, ids)]
    else delete record["see"]
  }
  lines[which] = JSON.stringify(record)
  vault.set(file, lines.join("\n"))
}

/** One `.md` body, rewritten — with its headings sometimes moved, which is the
 *  edit that takes a heading key away while the document key it shares stays
 *  exactly where it was. */
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

/** A file RENAMED: taken from one path and written at another, byte for byte.
 *  Both kinds, because the two halves of the answer part company here — an
 *  outline's entries are attributed to its records and a body's are the
 *  document's own. */
const renamed = (
  random: () => number,
  vault: Map<string, string>,
  away: Map<string, string>,
): void => {
  const there = [...vault.keys()].filter((file) => !isPutAway(file))
  if (there.length === 0) return
  const from = pick(random, there)
  const to = fileKind(from) === "outline"
    ? `renamed${away.size}.olai`
    : `renamed${away.size}.md`
  if (vault.has(to)) return
  const text = vault.get(from) as string
  vault.set(to, text)
  away.set(from, text)
  vault.delete(from)
}

/** A file GONE — the end of every key its links held it under. */
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

/** …and one ARRIVING BACK, which is a key being minted and, for a path
 *  something already links to, a run of links that stopped naming nothing. */
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
