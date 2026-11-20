import { TEST_CLAIMS } from "@olai/format/testlib"
import {
  assemble,
  bodiedIn,
  bodyKind,
  type BrokenFile,
  faceOf,
  isMarkdown,
  type Markdown,
  nodesOf,
  outlinesIn,
  type Reading,
  reading,
  textKind,
  type Verdict,
  verdictOf,
} from "@olai/format"
import { seeded } from "@olai/format/testlib"
import { decodedVault } from "@olai/format/testlib/scope"
import type { Snapshot } from "@olai/store"
import type { DocumentEntry } from "olai-plugin-markdown/wire"
import { documentProjection } from "olai-plugin-markdown/projection"
import type { OutlineEntry } from "olai-plugin-outlines/wire"
import { outlineProjection } from "olai-plugin-outlines/projection"
import type { Head } from "olai-plugin-vault/wire"
import { headProjection } from "olai-plugin-vault/projection"
import { Result } from "effect"

import type { Change } from "@olai/surface/projection"

export interface Published {
  readonly outlines: Change<OutlineEntry>
  readonly documents: Change<DocumentEntry>
  readonly heads: Change<Head>
}

export type Projection = (
  snapshot: Snapshot<Reading>,
  published: Published | null,
) => Published

export const publishedOf: Projection = (snapshot, published) => {
  const files = published === null ? undefined : new Set(published.heads.entries.keys())
  const documents = documentProjection(snapshot, files && { files, change: published!.documents })
  return {
    outlines: outlineProjection(snapshot, files && { files, change: published!.outlines }).change,
    documents: documents.change,
    heads: headProjection(snapshot, files && { files, change: published!.heads }).change,
  }
}

export const COLLECTIONS = ["outlines", "documents", "heads"] as const
export type Which = (typeof COLLECTIONS)[number]

export const publishedAsWalked: Projection = (snapshot, published) => {
  const { set, derived } = snapshot.value
  const broken = new Map(set.broken.map((file) => [file.file, file] as const))
  return {
    outlines: walkedChangeOf(
      outlinesIn(set),
      (outline) => outline.path,
      (outline) => ({
        rev: snapshot.rev,
        nodes: nodesOf(derived, outline.path),
        broken: broken.get(outline.path) ?? null,
        face: faceOf(outline),
      }),
      snapshot,
      published?.outlines,
    ),
    heads: walkedChangeOf(
      set.documents,
      (document) => document.path,
      (document) => ({
        rev: snapshot.rev,
        face: faceOf(document),
        broken: broken.get(document.path) ?? null,
      }),
      snapshot,
      published?.heads,
    ),
    ...walkedDocumentsOf(snapshot, published, broken),
  }
}

const walkedIsUnread = (file: BrokenFile | undefined): boolean =>
  file?.errors.some((error) => error.code === "unreadable-file") === true

const walkedDocumentsOf = (
  snapshot: Snapshot<Reading>,
  held: Published | null,
  broken: ReadonlyMap<string, BrokenFile>,
): Pick<Published, "documents"> => {
  const documents = bodiedIn(snapshot.value.set).filter(
    (document): document is Markdown => isMarkdown(document) && document.kind === "markdown",
  )
  const change = walkedChangeOf(
    documents,
    (document) => document.path,
    (document) => walkedIsUnread(broken.get(document.path))
      ? { rev: snapshot.rev, state: "refused" as const }
      : { rev: snapshot.rev, state: "served" as const, text: document.body },
    snapshot,
    held?.documents,
  )
  return { documents: change }
}

const walkedChangeOf = <S, T>(
  sources: ReadonlyArray<S>,
  keyOf: (source: S) => string,
  build: (source: S) => T,
  moved: Pick<Snapshot<unknown>, "changed" | "removed">,
  previous: Change<T> | undefined,
): Change<T> => {
  const held = previous?.entries
  const changed = new Set(moved.changed)
  const named = new Set(moved.removed)
  const entries = new Map<string, T>()
  for (const source of sources) {
    const key = keyOf(source)
    const publishedEntry = changed.has(key) ? undefined : held?.get(key)
    entries.set(key, publishedEntry ?? build(source))
  }
  return {
    entries,
    upserts: moved.changed.flatMap((path) => {
      const entry = entries.get(path)
      return entry === undefined ? [] : [[path, entry] as const]
    }),
    removes: [
      ...moved.removed.filter((path) => held?.has(path) === true),
      ...held === undefined ? [] : [...held.keys()].filter(
        (key) => !entries.has(key) && !named.has(key),
      ),
    ],
  }
}

export interface Step {
  readonly writes?: ReadonlyArray<readonly [file: string, text: string]>
  readonly deletes?: ReadonlyArray<string>
  readonly forgotten?: ReadonlyArray<string>
}

export const REFUSED = "\u0000refused"

export const revisionsOf = (
  vault: ReadonlyMap<string, string>,
  steps: ReadonlyArray<Step>,
): ReadonlyArray<Snapshot<Reading>> => {
  const held = new Map(vault)
  const revisions: Array<Snapshot<Reading>> = [{
    rev: 1,
    value: readingOf(held),
    changed: [...held.keys()],
    removed: [],
  }]
  for (const step of steps) {
    const changed: Array<string> = []
    const removed: Array<string> = []
    for (const [file, text] of step.writes ?? []) {
      held.set(file, text)
      changed.push(file)
    }
    for (const file of step.deletes ?? []) {
      if (held.delete(file)) removed.push(file)
    }
    const forgot = (step.forgotten ?? []).filter((file) => held.delete(file))
    if (forgot.length > 0) {
      for (const file of held.keys()) if (!changed.includes(file)) changed.push(file)
    }
    revisions.push({
      rev: revisions.length + 1,
      value: readingOf(held),
      changed,
      removed,
    })
  }
  return revisions
}

const readingOf = (vault: ReadonlyMap<string, string>): Reading => {
  const decoded = decodedVault(vault)
  for (const [file, text] of vault) {
    if (text !== REFUSED) continue
    decoded.set(
      file,
      Result.fail<Verdict>(verdictOf([{
        file,
        line: 0,
        code: "unreadable-file",
        message: "EACCES — this file is in the directory and will not open.",
      }])),
    )
  }
  return reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded))
}

class Subscriber {
  readonly held = new Map<string, unknown>()
  readonly offered: Array<string> = []
  readonly kept: Array<string> = []

  fold(rev: number, which: Which, change: Change<unknown>): void {
    for (const [key, value] of change.upserts) {
      this.offered.push(`rev ${rev} ${which} +${key} ${spelled(value)}`)
      if (this.held.get(key) === value) continue
      this.held.set(key, value)
      this.kept.push(`rev ${rev} ${which} +${key} ${spelled(value)}`)
    }
    for (const key of change.removes) {
      this.offered.push(`rev ${rev} ${which} -${key}`)
      if (!this.held.delete(key)) continue
      this.kept.push(`rev ${rev} ${which} -${key}`)
    }
  }
}

const spellings = new WeakMap<object, string>()
const spelled = (value: unknown): string => {
  if (typeof value !== "object" || value === null) return JSON.stringify(value) ?? "undefined"
  const held = spellings.get(value)
  if (held !== undefined) return held
  const said = JSON.stringify(value) ?? "undefined"
  spellings.set(value, said)
  return said
}

interface Side {
  readonly projection: Projection
  held: Published | null
  readonly readers: ReadonlyMap<Which, Subscriber>
  readonly offered: Array<string>
  readonly kept: Array<string>
  reused: number
  rebuilt: number
  upserts: number
  removes: number
  minted: number
}

const sideOf = (projection: Projection): Side => ({
  projection,
  held: null,
  readers: new Map(COLLECTIONS.map((which) => [which, new Subscriber()] as const)),
  offered: [],
  kept: [],
  reused: 0,
  rebuilt: 0,
  upserts: 0,
  removes: 0,
  minted: 0,
})

const step = (side: Side, snapshot: Snapshot<Reading>): Published => {
  const before = new Map<Which, unknown>(
    COLLECTIONS.map((which) => [which, side.held?.[which].entries] as const),
  )
  const revision = side.projection(snapshot, side.held)
  for (const which of COLLECTIONS) {
    const change = revision[which] as Change<unknown>
    if (before.get(which) !== undefined && before.get(which) === change.entries) {
      side.reused += 1
    } else side.rebuilt += 1
    side.upserts += change.upserts.length
    side.removes += change.removes.length
    for (const key of change.removes) {
      if (!snapshot.removed.includes(key)) side.minted += 1
    }
    const reader = side.readers.get(which)!
    const wasOffered = reader.offered.length
    const wasKept = reader.kept.length
    reader.fold(snapshot.rev, which, change)
    side.offered.push(...reader.offered.slice(wasOffered))
    side.kept.push(...reader.kept.slice(wasKept))
  }
  side.held = revision
  return revision
}

const snapshotOf = (revision: Published, which: Which): ReadonlyArray<string> =>
  [...(revision[which] as Change<unknown>).entries].map(
    ([key, value]) => `${key} ${spelled(value)}`,
  )


export interface Report {
  readonly divergences: ReadonlyArray<string>
  readonly revisions: number
  readonly upserts: number
  readonly removes: number
  readonly phantom: number
  readonly minted: number
  readonly reused: number
  readonly rebuilt: number
}

export const differential = (
  vault: ReadonlyMap<string, string>,
  steps: ReadonlyArray<Step>,
  candidate: Projection,
  reference: Projection = publishedAsWalked,
): Report => {
  const revisions = revisionsOf(vault, steps)
  const was = sideOf(reference)
  const now = sideOf(candidate)
  const divergences: Array<string> = []
  for (const snapshot of revisions) {
    const before = step(was, snapshot)
    const after = step(now, snapshot)
    if (divergences.length >= LINES) continue
    for (const which of COLLECTIONS) {
      divergences.push(
        ...differing(
          `\`readAll\` of ${which} at revision ${snapshot.rev}`,
          snapshotOf(before, which),
          snapshotOf(after, which),
        ),
      )
    }
  }
  divergences.push(
    ...differing("the delta a reader was offered", was.offered, now.offered),
    ...differing("the delta a reader accepted", was.kept, now.kept),
  )
  for (const which of COLLECTIONS) {
    for (const [side, run] of [["the walk", was], ["the carried map", now]] as const) {
      if (which !== "documents") {
        divergences.push(
          ...unheard(
            `${side}: what a fresh reader of ${which} reads, against what an open one was told`,
            run,
            which,
          ),
        )
      }
      divergences.push(
        ...heldOnes(
          `${side}: what an open reader of ${which} still holds that a fresh one no longer reads`,
          run,
          which,
        ),
      )
    }
  }
  return {
    divergences,
    revisions: revisions.length,
    upserts: now.upserts,
    removes: now.removes,
    phantom: COLLECTIONS.reduce(
      (count, which) => count + phantomsOf(now, which).length,
      0,
    ),
    minted: now.minted,
    reused: now.reused,
    rebuilt: now.rebuilt,
  }
}


const unheard = (
  what: string,
  side: Side,
  which: Which,
): ReadonlyArray<string> => {
  const folded = side.readers.get(which)!.held
  const out: Array<string> = []
  for (const line of side.held === null ? [] : snapshotOf(side.held, which)) {
    const key = line.slice(0, line.indexOf(" "))
    const held = folded.has(key) ? spelled(folded.get(key)) : undefined
    if (held === line.slice(key.length + 1)) continue
    out.push(
      `${what}: ${key} — the snapshot says ${line.slice(key.length + 1)}` +
        ` and the open reader holds ${held ?? "nothing"}`,
    )
    if (out.length >= LINES) {
      out.push(`${what}: ...and more after ${key}`)
      break
    }
  }
  return out
}

const phantomsOf = (side: Side, which: Which): ReadonlyArray<string> => {
  const fresh = new Set(
    side.held === null ? [] : (side.held[which] as Change<unknown>).entries.keys(),
  )
  return [...side.readers.get(which)!.held.keys()].filter((key) => !fresh.has(key)).sort()
}

const heldOnes = (
  what: string,
  side: Side,
  which: Which,
): ReadonlyArray<string> => {
  const out: Array<string> = []
  for (const key of phantomsOf(side, which)) {
    out.push(`${what}: ${key}`)
    if (out.length >= LINES) {
      out.push(`${what}: ...and more after ${key}`)
      break
    }
  }
  return out
}

const differing = (
  what: string,
  was: ReadonlyArray<string>,
  now: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const out: Array<string> = []
  for (let at = 0; at < Math.max(was.length, now.length); at++) {
    if (was[at] === now[at]) continue
    out.push(
      `${what}, at position ${at}: the walk says ${was[at] ?? "nothing"}` +
        ` and the carried map says ${now[at] ?? "nothing"}`,
    )
    if (out.length >= LINES) {
      out.push(`${what}: ...and the rest of it past position ${at}`)
      break
    }
  }
  if (out.length === 0 && was.length !== now.length) {
    out.push(`${what}: the walk has ${was.length} lines and the carried map ${now.length}`)
  }
  return out
}

const LINES = 5

export const swallowing = (projection: Projection): Projection => (snapshot, published) => {
  const before = published === null ? null : new Map(published.heads.entries)
  const revision = projection(snapshot, published)
  const first = revision.heads.upserts[0]
  if (before === null || first === undefined) return revision
  const stale = before.get(first[0])
  if (stale === undefined) return revision
  revision.heads.entries.set(first[0], stale)
  return {
    ...revision,
    heads: { ...revision.heads, upserts: revision.heads.upserts.slice(1) },
  }
}

export const misplacing = (projection: Projection): Projection => (snapshot, published) => {
  const before = published === null ? null : [...published.heads.entries.keys()]
  const revision = projection(snapshot, published)
  if (before === null) return revision
  const held = new Set(before)
  const entries = new Map<string, Head>()
  for (const key of before) {
    const entry = revision.heads.entries.get(key)
    if (entry !== undefined) entries.set(key, entry)
  }
  for (const [key, entry] of revision.heads.entries) {
    if (!held.has(key)) entries.set(key, entry)
  }
  return { ...revision, heads: { ...revision.heads, entries } }
}

export const unminting = (projection: Projection): Projection => (snapshot, published) => {
  const revision = projection(snapshot, published)
  const named = new Set(snapshot.removed)
  const filtered = <T>(change: Change<T>): Change<T> => ({
    ...change,
    removes: change.removes.filter((key) => named.has(key)),
  })
  return {
    ...revision,
    outlines: filtered(revision.outlines),
    documents: filtered(revision.documents),
    heads: filtered(revision.heads),
  }
}

export const stepsOver = (
  files: ReadonlyArray<string>,
  { steps, seed = 20260824 }: { readonly steps: number; readonly seed?: number },
): { readonly steps: ReadonlyArray<Step>; readonly resyncs: number } => {
  const random = seeded(seed)
  const outlines = files.filter((file) => bodyKind(TEST_CLAIMS, file) === null)
  const bodied = files.filter((file) => bodyKind(TEST_CLAIMS, file) !== null)
  const pick = (of: ReadonlyArray<string>): string | undefined =>
    of.length === 0 ? undefined : of[Math.floor(random() * of.length)]
  const gone = new Set<string>()
  const live = (of: ReadonlyArray<string>): ReadonlyArray<string> =>
    of.filter((file) => !gone.has(file))
  const out: Array<Step> = []
  let resyncs = 0
  for (let at = 0; at < steps; at++) {
    const roll = random()
    const outline = pick(live(outlines))
    const document = pick(live(bodied))
    if (roll < 0.34 && outline !== undefined) {
      out.push({ writes: [[outline, minted(at)]] })
    } else if (roll < 0.55 && document !== undefined) {
      out.push({ writes: [[document, `# document ${at}\n\nrewritten at step ${at}.\n`]] })
    } else if (roll < 0.62) {
      out.push({ writes: [[`${bornAt(random, at)}${OUTLINE}`, minted(at)]] })
    } else if (roll < 0.68) {
      out.push({ writes: [[`${bornAt(random, at)}${MARKDOWN}`, `# born ${at}\n`]] })
    } else if (roll < 0.74 && outline !== undefined) {
      gone.add(outline)
      out.push({ deletes: [outline] })
    } else if (roll < 0.78 && document !== undefined) {
      gone.add(document)
      out.push({ deletes: [document] })
    } else if (roll < 0.84 && outline !== undefined) {
      out.push({ writes: [[outline, `{"id":"torn ${at}`]] })
      out.push({ writes: [[outline, minted(at)]] })
    } else if (roll < 0.88 && document !== undefined) {
      out.push({ writes: [[document, REFUSED]] })
      out.push({ writes: [[document, `# mended ${at}\n`]] })
    } else if (roll < 0.92) {
      const writes: Array<readonly [string, string]> = [[
        `${bornAt(random, at)}${OUTLINE}`,
        minted(at),
      ]]
      for (const file of sampledFrom(random, live(outlines), 4)) writes.push([file, minted(at)])
      for (const file of sampledFrom(random, live(bodied), 2)) {
        writes.push([file, `# pulled ${at}\n`])
      }
      const leaving = pick(live(outlines))
      if (leaving !== undefined) gone.add(leaving)
      out.push({ writes, deletes: leaving === undefined ? [] : [leaving] })
    } else if (roll < 0.96) {
      const leaving = random() < 0.5 ? pick(live(outlines)) : pick(live(bodied))
      if (leaving === undefined) out.push({})
      else {
        gone.add(leaving)
        resyncs += 1
        if (random() < 0.5) out.push({ forgotten: [leaving] })
        else {
          const restored = pick(live(random() < 0.5 ? outlines : bodied))
          out.push(
            restored === undefined
              ? { forgotten: [leaving] }
              : {
                writes: [[
                  restored,
                  bodyKind(TEST_CLAIMS, restored) === null ? minted(at) : `# restored at ${at}\n`,
                ]],
                forgotten: [leaving],
              },
          )
        }
      }
    } else if (roll < 0.98) {
      const outward = random() < 0.5
      const leaving = pick(live(outward ? outlines : bodied))
      if (leaving === undefined) out.push({})
      else {
        gone.add(leaving)
        const arriving = `${bornAt(random, at)}${outward ? MARKDOWN : OUTLINE}`
        const writes = [[arriving, outward ? `# swapped in at ${at}\n` : minted(at)] as const]
        out.push(
          random() < 0.4 ? { writes, forgotten: [leaving] } : { writes, deletes: [leaving] },
        )
      }
    } else {
      out.push({})
    }
  }
  return { steps: out, resyncs }
}

const minted = (at: number): string =>
  [
    JSON.stringify({ id: `s${at}root`, ord: "a0", title: `written at step ${at}` }),
    JSON.stringify({
      id: `s${at}child`,
      parent: `s${at}root`,
      ord: "a1",
      title: `a child written at step ${at}`,
      ...(at % 3 === 0 ? { todo: true } : {}),
    }),
  ].join("\n")

const bornAt = (random: () => number, at: number): string => {
  const roll = random()
  if (roll < 0.3) return `0born${at}`
  if (roll < 0.5) return `zzz/born${at}`
  if (roll < 0.65) return `note0/born${at}`
  return `mid${at}`
}

const OUTLINE = TEST_CLAIMS.byKind.get("outline-olai")!.exts[0]
const MARKDOWN = TEST_CLAIMS.byKind.get("markdown")!.exts[0]

const sampledFrom = (
  random: () => number,
  of: ReadonlyArray<string>,
  count: number,
): ReadonlyArray<string> => {
  if (of.length <= count) return of
  const stride = of.length / count
  return Array.from(
    { length: count },
    (_, at) => of[Math.min(of.length - 1, Math.floor(at * stride + random() * stride))] as string,
  )
}
