import { TEST_CLAIMS } from "@olai/format/testlib"
import { Result } from "effect"

import type { Document } from "./document.ts"
import { errorLine } from "./errors.ts"
import { type Verdict, verdictOf } from "./verdict.ts"

import { type Corpus, corpusOf, editOf, FILES, pick } from "./corpora.testlib.ts"
import { fileKind } from "./kinds.ts"
import { byPath } from "./paths.ts"
import { decodedVault } from "./scope.testlib.ts"
import { findingsIn } from "./fixtures.testlib.ts"
import { assemble, nodesIn } from "./set.ts"
import { baseOf, type PropDeclarations } from "./typing.ts"

import type { Cold, Reached, Reading } from "./validate.ts"
import { ledgerOf, validate, watching } from "./validate.ts"

export type Revision = ReadonlyMap<string, string>

export interface Divergence {
  readonly why: "verdict" | "findings" | "order" | "ledger"
  readonly revision: number
  readonly touched: ReadonlyArray<string>
  readonly accepted: { readonly full: boolean; readonly incremental: boolean }
  readonly counts: { readonly full: number; readonly incremental: number }
  readonly missing: ReadonlyArray<string>
  readonly invented: ReadonlyArray<string>
  readonly elided: number
  readonly parted?: {
    readonly at: number
    readonly full: string
    readonly incremental: string
  }
}

const SAID = 12

export interface Report {
  readonly divergences: ReadonlyArray<Divergence>
  readonly narrowed: number
  readonly whole: number
  readonly declined: Readonly<Record<string, number>>
  readonly walked: number
  readonly degraded: number
  readonly unreadable: number
  readonly revisions: number
}

export const replay = (revisions: Iterable<Revision>): Report => {
  const reached: Array<Reached> = []
  const divergences: Array<Divergence> = []
  const account: Array<Reached> = []
  let degraded = 0
  let unreadable = 0
  let many = 0
  watching((one) => {
    account.push(one)
  })
  try {
    const decoded = new Map<string, Result.Result<Document, Verdict>>()
    let held: Revision = new Map()
    let published: Reading | null = null
    const changed = new Set<string>()
    const removed = new Set<string>()
    for (const revision of revisions) {
      many++
      for (const file of held.keys()) {
        if (!revision.has(file)) {
          decoded.delete(file)
          removed.add(file)
          changed.delete(file)
        }
      }
      const moved = new Map<string, string>()
      for (const [file, text] of revision) {
        if (held.get(file) !== text) moved.set(file, text)
      }
      for (const [file, one] of decodedVault(moved)) {
        decoded.set(file, one)
        changed.add(file)
        removed.delete(file)
      }
      held = revision
      const set = assemble(TEST_CLAIMS, decoded)
      if (set.broken.length > 0) unreadable++
      const touched = [...changed, ...removed]
      const verdict = validate(TEST_CLAIMS,
        set,
        published === null ? undefined : {
          read: published,
          delta: {
            upserts: [...changed].map(
              (file) => [file, { nodes: nodesIn(decoded.get(file)) }] as const,
            ),
            removes: [...removed],
          },
        },
      )
      reached.push(...account.splice(0))
      const whole = validate(TEST_CLAIMS, set)
      account.length = 0
      const found = parting(many, touched, whole, verdict)
      if (found !== null) divergences.push(found)
      if (Result.isFailure(verdict)) continue
      if (verdict.success.set.broken.length > 0) degraded++
      published = verdict.success
      changed.clear()
      removed.clear()
    }
  } finally {
    watching(null)
  }
  return {
    divergences,
    narrowed: reached.filter((one) => one.kind === "narrowed").length,
    whole: reached.filter((one) => one.kind === "whole").length,
    declined: reached.reduce<Record<string, number>>((held, one) => {
      if (one.kind !== "whole") return held
      const why: Cold | "unsaid" = one.why ?? "unsaid"
      return { ...held, [why]: (held[why] ?? 0) + 1 }
    }, {}),
    walked: reached.filter((one) => one.walked === true).length,
    degraded,
    unreadable,
    revisions: many,
  }
}

const parting = (
  revision: number,
  touched: ReadonlyArray<string>,
  whole: Result.Result<Reading, Verdict>,
  narrowed: Result.Result<Reading, Verdict>,
): Divergence | null => {
  const full = linesOf(whole)
  const said = linesOf(narrowed)
  const accepted = { full: Result.isSuccess(whole), incremental: Result.isSuccess(narrowed) }
  const counts = { full: full.length, incremental: said.length }
  const found = differing(full, said, accepted) ?? carried(whole, narrowed)
  return found === null ? null : raise(revision, touched, { ...found, accepted, counts })
}

const linesOf = (verdict: Result.Result<Reading, Verdict>): ReadonlyArray<string> =>
  Result.isFailure(verdict)
    ? verdict.failure.findings.map(errorLine)
    : findingsIn(verdict.success.set).map(errorLine)

type Told = Pick<Divergence, "why" | "missing" | "invented" | "parted">

export const differing = (
  full: ReadonlyArray<string>,
  said: ReadonlyArray<string>,
  accepted: Divergence["accepted"],
): Told | null => {
  const missing = held(full, said)
  const invented = held(said, full)
  if (accepted.full !== accepted.incremental) return { why: "verdict", missing, invented }
  if (missing.length > 0 || invented.length > 0) return { why: "findings", missing, invented }
  const at = full.findIndex((line, which) => line !== said[which])
  return at === -1 ? null : {
    why: "order",
    missing: [],
    invented: [],
    parted: { at, full: full[at] ?? "", incremental: said[at] ?? "" },
  }
}

const carried = (
  whole: Result.Result<Reading, Verdict>,
  narrowed: Result.Result<Reading, Verdict>,
): Told | null => {
  if (Result.isFailure(whole) || Result.isFailure(narrowed)) return null
  const walked = ledgerOf(whole.success.derived)
  const said = ledgerOf(narrowed.success.derived)
  if (walked === undefined || said === undefined) return null
  const missing = [
    ...held([...walked.known], [...said.known]),
    ...held(typings(walked.typing), typings(said.typing)),
  ]
  const invented = [
    ...held([...said.known], [...walked.known]),
    ...held(typings(said.typing), typings(walked.typing)),
  ]
  return missing.length === 0 && invented.length === 0
    ? null
    : { why: "ledger", missing, invented }
}

const typings = (said: PropDeclarations): ReadonlyArray<string> =>
  [...said].map(([key, declared]) => {
    const under = declared.type.kind === "ref" ? declared.type.under ?? "" : ""
    return `${key}=${declared.type.kind}${under === "" ? "" : ` under ${under}`}` +
      ` base ${baseOf(declared)} at ${declared.at}`
  }).sort()

const held = (
  said: ReadonlyArray<string>,
  against: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const left = new Map<string, number>()
  for (const line of against) left.set(line, (left.get(line) ?? 0) + 1)
  const only: Array<string> = []
  for (const line of said) {
    const many = left.get(line) ?? 0
    if (many === 0) only.push(line)
    else left.set(line, many - 1)
  }
  return only
}

const raise = (
  revision: number,
  touched: ReadonlyArray<string>,
  found: Told & Pick<Divergence, "accepted" | "counts">,
): Divergence => {
  const missing = found.missing.slice(0, SAID)
  const invented = found.invented.slice(0, SAID)
  return {
    why: found.why,
    revision,
    touched: touched.slice(0, SAID),
    accepted: found.accepted,
    counts: found.counts,
    missing,
    invented,
    elided: (touched.length - touched.slice(0, SAID).length) +
      (found.missing.length - missing.length) +
      (found.invented.length - invented.length),
    ...(found.parted === undefined ? {} : { parted: found.parted }),
  }
}

const DOCUMENTS = [
  "notes.md",
  "a/notes.md",
  "deep/notes.md",
  "_olai/notes.md",
  "page.html",
] as const

const LINK_TARGETS = ["notes.md", "../notes.md"] as const

const spread = (id: string): number => {
  let held = 0
  for (let at = 0; at < id.length; at++) held = (held * 31 + id.charCodeAt(at)) % 1009
  return held
}

const NOT_JSON = "\n{not json"

interface Claim {
  readonly file: string
  readonly at: number
  readonly mirror: boolean
}

const claimsIn = (files: Corpus): ReadonlyMap<string, Claim> => {
  const claims = new Map<string, Claim>()
  let at = 0
  for (const file of [...Object.keys(files)].sort(byPath)) {
    for (const line of (files[file] ?? "").split("\n").filter((one) => one !== "")) {
      const record = JSON.parse(line) as Record<string, unknown>
      const id = String(record["id"])
      at++
      if (!claims.has(id)) claims.set(id, { file, at, mirror: "mirror" in record })
    }
  }
  return claims
}

const written = (
  text: string,
  file: string,
  claims: ReadonlyMap<string, Claim>,
): string => {
  const own: Array<string> = []
  return text
    .split("\n")
    .filter((line) => line !== "")
    .flatMap((line) => {
      const record = JSON.parse(line) as Record<string, unknown>
      const id = String(record["id"])
      const claim = claims.get(id)
      if (claim === undefined || claim.file !== file || own.includes(id)) return []
      own.push(id)
      const written: Record<string, unknown> = { ...record }
      if ("mirror" in written) {
        const target = [...claims].find(([, one]) => !one.mirror && one.file !== file)
        if (target !== undefined) written["mirror"] = target[0]
      } else {
        for (const [field, keep] of [
          ["after", (one: Claim) => one.at < claim.at],
          ["blocks", (one: Claim) => one.at > claim.at],
          ["see", () => true],
        ] as const) {
          const targets = written[field]
          if (!Array.isArray(targets)) continue
          const held = targets.filter((target) => {
            const one = claims.get(String(target))
            return one !== undefined && keep(one)
          })
          if (held.length === 0) delete written[field]
          else written[field] = held
        }
        if (spread(id) % 12 === 0) {
          written["title"] = String(written["title"] ?? "") + " [document](" + (LINK_TARGETS[spread(id) % LINK_TARGETS.length]) + ")"
        }
      }
      const parent = written["parent"]
      if (parent !== undefined) {
        const above = own
          .slice(0, -1)
          .filter((one) => claims.get(one)?.mirror === false)
        const held = above[spread(String(parent)) % Math.max(above.length, 1)]
        if (held === undefined) delete written["parent"]
        else written["parent"] = held
      }
      return [JSON.stringify(written)]
    })
    .join("\n")
}

export const revisionsOf = (
  random: () => number,
  many: number,
): ReadonlyArray<Revision> => {
  const { files: first, used } = corpusOf(random)
  let raw: Corpus = first
  const held = new Map<string, string>()
  const documents = new Map<string, string>(
    DOCUMENTS.slice(0, 3).map((file) => [file, `# ${file}`]),
  )
  let broken: string | null = null
  const stream: Array<Revision> = []
  for (let at = 0; at < many; at++) {
    const before = raw
    raw = at === 0 ? raw : editOf(random, raw, used)
    const claims = claimsIn(raw)
    for (const file of held.keys()) if (!(file in raw)) held.delete(file)
    for (const [file, text] of Object.entries(raw)) {
      if (before[file] !== text || !held.has(file)) held.set(file, written(text, file, claims))
    }
    const roll = random()
    if (roll < 0.1) {
      documents.set(pick(random, DOCUMENTS), `# arrived ${at}`)
    } else if (roll < 0.2) {
      const there = [...documents.keys()]
      if (there.length > 0) documents.delete(pick(random, there))
    } else if (roll < 0.32) {
      const there = [...documents.keys()]
      if (there.length > 0) documents.set(pick(random, there), `# rewritten ${at}`)
    }
    if (random() < 0.06) broken = broken === null ? pick(random, FILES) : null
    const revision = new Map<string, string>()
    for (const [file, text] of held) {
      revision.set(file, text + (file === broken ? NOT_JSON : ""))
    }
    for (const [file, text] of documents) revision.set(file, text)
    stream.push(revision)
  }
  return stream
}

export const edited = (
  vault: Revision,
  random: () => number,
  many: number,
): ReadonlyArray<Revision> => {
  const outlines = [...vault.keys()].filter((file) => TEST_CLAIMS.byKind.get(fileKind(TEST_CLAIMS, file) ?? "")?.holds === "nodes")
  const documents = [...vault.keys()].filter((file) => fileKind(TEST_CLAIMS, file) === "markdown")
  let held = new Map(vault)
  const stream: Array<Revision> = [held]
  for (let at = 0; at < many; at++) {
    const next = new Map(held)
    const roll = random()
    if (roll < 0.12 && documents.length > 0) {
      const file = pick(random, documents)
      if (next.has(file)) next.delete(file)
      else next.set(file, vault.get(file) ?? "")
    } else if (outlines.length > 0) {
      const file = pick(random, outlines)
      const lines = (next.get(file) ?? "").split("\n").filter((line) => line !== "")
      if (lines.length > 0) {
        const which = Math.floor(random() * lines.length)
        const record = JSON.parse(lines[which] as string) as Record<string, unknown>
        if (!("mirror" in record)) record["title"] = `edited ${at}`
        lines[which] = JSON.stringify(record)
        next.set(file, lines.join("\n"))
      }
    }
    held = next
    stream.push(held)
  }
  return stream
}
