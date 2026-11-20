import { TEST_CLAIMS } from "./claims.testlib.ts"
import { addressOf, bodiedDocument, bodyKind, type BrokenFile, type Document, type KindVocabulary, type MovingRequest, type NarrowingRequest, NO_KINDS, type OutlineError, type PageRequest, type Reading, stillHolds, taping, type Verdict, verdictOf } from "@olai/format"
import { parseOutline } from "olai-plugin-outline-olai/format"
import { seeded } from "@olai/format/testlib"
import { Result } from "effect"

import { codecFor } from "./codec.ts"
import { type Asked, rebuilding, sameAnswer, type Standing, standing } from "./standing.ts"

export interface Modelled {
  readonly id: string
  title: string
  mark: "todo" | "doing" | "done" | null
  date: string | null
  tag: string | null
  after: string | null
  mirror: string | null
  readonly parent: string | null
}

export type Filed = Array<Modelled>

export interface Vault {
  readonly outlines: Map<string, Filed>
  readonly documents: Map<string, string>
  readonly torn: Set<string>
}

const DAYS: ReadonlyArray<string> = Array.from({ length: 3 * 28 }, (_, at) => {
  const month = Math.floor(at / 28)
  const printed = (value: number): string => String(value).padStart(2, "0")
  return `2026-${printed(month + 1)}-${printed((at % 28) + 1)}`
})

export const vaultFor = (
  { files, records, seed = 20260825 }: {
    readonly files: number
    readonly records: number
    readonly seed?: number
  },
): Vault => {
  const outlines = new Map<string, Filed>()
  const documents = new Map<string, string>()
  for (let at = 0; at < files; at++) {
    const path = at % 5 === 0 ? `area${at % 3}/note${at}.olai` : `note${at}.olai`
    const dated = at % 3 !== 0
    const own: Filed = [{
      id: `f${at}r`,
      title: `file ${at}`,
      mark: null,
      date: null,
      tag: null,
      after: null,
      mirror: null,
      parent: null,
    }]
    for (let which = 0; which < records; which++) {
      own.push({
        id: `f${at}n${which}`,
        title: `record ${which} of file ${at}`,
        mark: which % 3 === 0 ? "todo" : which % 7 === 0 ? "done" : null,
        date: dated && which % 4 === 0 ? (DAYS[(at * 5 + which) % DAYS.length] as string) : null,
        tag: which % 5 === 0 ? `#topic${at % 7}` : null,
        after: which % 6 === 0 && which > 0 ? `f${at}n0` : null,
        mirror: which % 11 === 0 && which > 1 ? `f${at}n1` : null,
        parent: which % 2 === 0 ? `f${at}r` : `f${at}n${which - 1}`,
      })
    }
    outlines.set(path, own)
    if (at % 4 === 0) {
      documents.set(
        at % 8 === 0 ? `area${at % 3}/doc${at}.md` : `doc${at}.md`,
        `# document ${at}\n\nWritten once.\n`,
      )
    }
  }
  return { outlines, documents, torn: new Set() }
}

const lineOf = (record: Modelled): string =>
  JSON.stringify({
    id: record.id,
    ...(record.parent === null ? {} : { parent: record.parent }),
    ord: record.id,
    ...(record.mirror === null
      ? {
        title: record.tag === null ? record.title : `${record.title} ${record.tag}`,
        ...(record.mark === null ? {} : { [record.mark]: true }),
        ...(record.date === null ? {} : { date: record.date }),
      }
      : { mirror: record.mirror }),
    ...(record.after === null ? {} : { after: [record.after] }),
  })

const textOf = (vault: Vault, path: string): string =>
  vault.torn.has(path)
    ? `{"id":"torn`
    : (vault.outlines.get(path) ?? []).map(lineOf).join("\n")

export interface Revision {
  readonly says: string
  readonly reading: Reading
}

type Decoded = Map<string, Result.Result<Document, Verdict>>

const decodeOne = (
  file: string,
  text: string,
): Result.Result<Document, Verdict> =>
  bodyKind(TEST_CLAIMS, file) === null
    ? Result.mapError(parseOutline(file, text, TEST_CLAIMS), verdictOf)
    : Result.succeed<Document>(bodiedDocument(TEST_CLAIMS, file, text))

export const corpusOf = (
  vault: Vault,
  { steps, seed = 20260825 }: { readonly steps: number; readonly seed?: number },
): ReadonlyArray<Revision> => {
  const random = seeded(seed)
  const { publish, refusals, revisions } = publishing(vault)

  const pick = <T>(of: ReadonlyArray<T>): T | undefined =>
    of.length === 0 ? undefined : of[Math.floor(random() * of.length)]
  const someRecord = (own: Filed): Modelled | undefined =>
    pick(own.filter((one) =>
      one.parent !== null && one.mirror === null &&
      own.every((other) =>
        other.parent !== one.id && other.after !== one.id && other.mirror !== one.id
      )
    ))
  let born = 0

  for (let at = 0; at < steps; at++) {
    const roll = random()
    const path = pick([...vault.outlines.keys()])
    if (path === undefined) break
    const own = vault.outlines.get(path) as Filed
    const record = someRecord(own)
    const first = own[0] as Modelled

    if (roll < 0.22 && record !== undefined) {
      record.title = `${record.title.split(" [")[0] as string} [${at}]`
      publish(`retitle in ${path}`, [path], [])
    } else if (roll < 0.34 && record !== undefined) {
      record.mark = record.mark === "done" ? "todo" : record.mark === "todo" ? "done" : "todo"
      publish(`mark in ${path}`, [path], [])
    } else if (roll < 0.44 && record !== undefined) {
      record.date = record.date === null ? (DAYS[at % DAYS.length] as string) : null
      publish(`day in ${path}`, [path], [])
    } else if (roll < 0.50 && record !== undefined) {
      record.tag = record.tag === null ? `#topic${at % 7}` : null
      publish(`tag in ${path}`, [path], [])
    } else if (roll < 0.56 && record !== undefined) {
      const anchor = own[1] as Modelled | undefined
      record.after = record.after !== null || anchor === undefined || anchor.id === record.id
        ? null
        : anchor.id
      publish(`edge in ${path}`, [path], [])
    } else if (roll < 0.64) {
      own.push({
        id: `${first.id}b${at}`,
        title: `born at ${at}`,
        mark: "todo",
        date: at % 2 === 0 ? (DAYS[at % DAYS.length] as string) : null,
        tag: null,
        after: null,
        mirror: null,
        parent: first.id,
      })
      publish(`record born in ${path}`, [path], [])
    } else if (roll < 0.70 && own.length > 3 && record !== undefined) {
      vault.outlines.set(path, own.filter((one) => one !== record))
      publish(`record gone from ${path}`, [path], [])
    } else if (roll < 0.76) {
      born++
      const fresh = `born${born}.olai`
      vault.outlines.set(fresh, [
        {
          id: `b${born}r`,
          title: `born ${born}`,
          mark: null,
          date: null,
          tag: null,
          after: null,
          mirror: null,
          parent: null,
        },
        {
          id: `b${born}n0`,
          title: `first of born ${born}`,
          mark: "todo",
          date: DAYS[born % DAYS.length] as string,
          tag: "#born",
          after: null,
          mirror: null,
          parent: `b${born}r`,
        },
      ])
      publish(`file born ${fresh}`, [fresh], [])
    } else if (roll < 0.81 && vault.outlines.size > 3) {
      vault.outlines.delete(path)
      publish(`file gone ${path}`, [], [path])
    } else if (roll < 0.87) {
      vault.torn.add(path)
      publish(`torn ${path}`, [path], [])
      vault.torn.delete(path)
      publish(`mended ${path}`, [path], [])
    } else if (roll < 0.92) {
      const document = pick([...vault.documents.keys()])
      if (document === undefined) publish("nothing moved", [], [])
      else {
        vault.documents.set(document, `# rewritten ${at}\n\nBody as of step ${at}.\n`)
        publish(`document ${document}`, [document], [])
      }
    } else if (roll < 0.96) {
      born++
      const fresh = `born${born}.md`
      vault.documents.set(fresh, `# born ${born}\n`)
      publish(`document born ${fresh}`, [fresh], [])
    } else {
      publish(`re-read ${path}`, [path], [])
    }
  }
  if (refusals.length > 0) {
    throw new Error(
      `the corpus wrote ${refusals.length} set(s) the validator refuses, ` +
        `so those steps published nothing: ${refusals.slice(0, 3).join("; ")}`,
    )
  }
  return revisions
}

export interface Publisher {
  readonly revisions: Array<Revision>
  readonly refusals: ReadonlyArray<string>
  readonly publish: (
    says: string,
    changed: ReadonlyArray<string>,
    gone: ReadonlyArray<string>,
  ) => Reading
}

export const publishing = (vault: Vault): Publisher => {
  const refusals: Array<string> = []
  const decoded: Decoded = new Map()
  const write = (path: string): void => {
    if (vault.outlines.has(path) || vault.torn.has(path)) {
      decoded.set(path, decodeOne(path, textOf(vault, path)))
    } else if (vault.documents.has(path)) {
      decoded.set(path, decodeOne(path, vault.documents.get(path) as string))
    } else decoded.delete(path)
  }
  for (const path of [...vault.outlines.keys(), ...vault.documents.keys()]) write(path)

  const first = published(decoded, undefined, [], [])
  if (Result.isFailure(first)) {
    throw new Error(
      `the harness's own vault does not validate: ${JSON.stringify(first.failure.findings.slice(0, 2))}`,
    )
  }
  let previous: Reading = first.success
  const revisions: Array<Revision> = [{
    says: "the directory as it stands",
    reading: previous,
  }]
  let owed = { changed: new Set<string>(), removed: new Set<string>() }

  const publish = (
    says: string,
    changed: ReadonlyArray<string>,
    gone: ReadonlyArray<string>,
  ): Reading => {
    for (const path of changed) {
      owed.changed.add(path)
      owed.removed.delete(path)
      write(path)
    }
    for (const path of gone) {
      owed.removed.add(path)
      owed.changed.delete(path)
      decoded.delete(path)
    }
    const next = published(decoded, previous as Reading, [...owed.changed], [...owed.removed])
    if (Result.isFailure(next)) {
      refusals.push(`${says}: ${next.failure.findings[0]?.code ?? "?"}`)
      return previous as Reading
    }
    owed = { changed: new Set(), removed: new Set() }
    previous = next.success
    revisions.push({ says, reading: next.success })
    return next.success
  }
  return { revisions, refusals, publish }
}

const published = (
  decoded: Decoded,
  previous: Reading | undefined,
  changed: ReadonlyArray<string>,
  removed: ReadonlyArray<string>,
): Result.Result<Reading, Verdict> =>
  codecFor(NO_KINDS, { current: TEST_CLAIMS }).validate(
    decoded,
    previous === undefined ? undefined : { value: previous, changed, removed },
  )

export type Question =
  | { readonly which: "page"; readonly request: PageRequest }
  | { readonly which: "narrowing"; readonly request: NarrowingRequest }
  | { readonly which: "moving"; readonly request: MovingRequest }

export interface Tab {
  readonly says: string
  readonly holds: ReadonlyArray<Question>
}

export interface Watched {
  readonly held: ReadonlyArray<unknown>
  readonly framed: ReadonlyArray<boolean>
}

export const asking = (views: Standing, at: Reading, question: Question): unknown => {
  switch (question.which) {
    case "page":
      return views.page(at, question.request)
    case "narrowing":
      return views.narrowing(at, question.request)
    case "moving":
      return views.moving(at, question.request)
  }
}

export const watching = (
  views: Standing,
  revisions: ReadonlyArray<Revision>,
  tabs: ReadonlyArray<Tab>,
): Driven => {
  const held: Array<Array<unknown>> = tabs.map((tab) => tab.holds.map(() => undefined))
  const seen: Array<Array<Array<unknown>>> = tabs.map((tab) => tab.holds.map(() => []))
  const framed: Array<Array<Array<boolean>>> = tabs.map((tab) => tab.holds.map(() => []))
  const carriedFrom = new Map<string, unknown>()
  let shared = 0
  let carried = 0
  let asks = 0
  for (const revision of revisions) {
    const answering = new Map<string, unknown>()
    for (const [which, tab] of tabs.entries()) {
      for (const [at, question] of tab.holds.entries()) {
        const key = `${question.which} ${JSON.stringify(question.request)}`
        const answer = asking(views, revision.reading, question)
        asks++
        if (answering.has(key)) {
          if (answering.get(key) === answer) shared++
        } else {
          answering.set(key, answer)
          if (carriedFrom.get(key) === answer) carried++
        }
        const before = (held[which] as Array<unknown>)[at]
        const moved = before === undefined ||
          !sameAnswer(question.which, before, answer)
        ;(held[which] as Array<unknown>)[at] = answer
        ;((seen[which] as Array<Array<unknown>>)[at] as Array<unknown>).push(answer)
        ;((framed[which] as Array<Array<boolean>>)[at] as Array<boolean>).push(moved)
      }
    }
    for (const [key, answer] of answering) carriedFrom.set(key, answer)
  }
  return {
    tabs: tabs.map((tab, which) =>
      tab.holds.map((_, at) => ({
        held: (seen[which] as Array<Array<unknown>>)[at] as ReadonlyArray<unknown>,
        framed: (framed[which] as Array<Array<boolean>>)[at] as ReadonlyArray<boolean>,
      }))
    ),
    asks,
    shared,
    carried,
  }
}

export interface Driven {
  readonly tabs: ReadonlyArray<ReadonlyArray<Watched>>
  readonly asks: number
  readonly shared: number
  readonly carried: number
}

export interface Report {
  readonly revisions: number
  readonly asks: number
  readonly divergences: ReadonlyArray<string>
  readonly frames: ReadonlyArray<string>
  readonly reuse: {
    readonly rebuilt: Pick<Driven, "shared" | "carried">
    readonly shared: Pick<Driven, "shared" | "carried">
  }
}

export const differential = (
  revisions: ReadonlyArray<Revision>,
  tabs: ReadonlyArray<Tab>,
  { shared = standing, now = () => FIXED }: {
    readonly shared?: (now: () => string, kinds: KindVocabulary) => Standing
    readonly now?: () => string
  } = {},
): Report => {
  const rebuilt = watching(rebuilding(now, NO_KINDS), revisions, tabs)
  const answered = watching(shared(now, NO_KINDS), revisions, tabs)
  const divergences: Array<string> = []
  const frames: Array<string> = []
  let asks = 0
  for (const [which, tab] of tabs.entries()) {
    for (const [at, question] of tab.holds.entries()) {
      const one = (rebuilt.tabs[which] as ReadonlyArray<Watched>)[at] as Watched
      const other = (answered.tabs[which] as ReadonlyArray<Watched>)[at] as Watched
      for (const [revision, value] of one.held.entries()) {
        asks++
        const said = other.held[revision]
        if (!sameAnswer(question.which, value, said)) {
          divergences.push(
            `${tab.says} / ${question.which} @ rev ${revision} (${
              revisions[revision]?.says ?? "?"
            })`,
          )
        }
        if (one.framed[revision] !== other.framed[revision]) {
          frames.push(
            `${tab.says} / ${question.which} @ rev ${revision} (${
              revisions[revision]?.says ?? "?"
            }): rebuilt ${one.framed[revision] === true ? "sent" : "held"}, shared ${
              other.framed[revision] === true ? "sent" : "held"
            }`,
          )
        }
      }
    }
  }
  return {
    revisions: revisions.length,
    asks,
    divergences,
    frames,
    reuse: {
      rebuilt: { shared: rebuilt.shared, carried: rebuilt.carried },
      shared: { shared: answered.shared, carried: answered.carried },
    },
  }
}

export const FIXED = "2026-02-14T09:00:00-05:00"

export interface Negative {
  readonly asked: number
  readonly held: number
  readonly wrong: ReadonlyArray<string>
  readonly cautious: number
}

export const negativeSpace = (
  revisions: ReadonlyArray<Revision>,
  questions: ReadonlyArray<Question>,
  now: () => string = () => FIXED,
): Negative => {
  const rebuild = rebuilding(now, NO_KINDS)
  const wrong: Array<string> = []
  let asked_ = 0
  let held = 0
  let cautious = 0
  for (const question of questions) {
    let last: { reading: Reading; answer: unknown; tape: ReturnType<typeof taping>["tape"] } | null =
      null
    for (const revision of revisions) {
      const taped = taping(revision.reading)
      const fresh = asking(rebuild, taped.reading, question)
      if (last !== null) {
        asked_++
        const said = stillHolds(last.tape, last.reading, revision.reading)
        const moved = !sameAnswer(question.which, last.answer, fresh)
        if (said) {
          held++
          if (moved) {
            wrong.push(
              `${question.which} ${JSON.stringify(question.request)} @ ${revision.says}`,
            )
          }
        } else if (!moved) cautious++
      }
      last = { reading: revision.reading, answer: fresh, tape: taped.tape }
    }
  }
  return { asked: asked_, held, wrong, cautious }
}

export const deaf = (now: () => string): Standing => reusing(now, () => true)

export const crossed = (now: () => string): Standing => keyed(now, (which) => which)

export const frozen = (now: () => string): Standing => reusing(now, () => true, true)

const reusing = (
  now: () => string,
  holds: () => boolean,
  never = false,
): Standing => {
  const rebuild = rebuilding(now, NO_KINDS)
  const answers = new Map<string, unknown>()
  const ask = (which: Asked, at: Reading, request: unknown, run: () => unknown): unknown => {
    const key = `${which} ${JSON.stringify(request)}`
    const before = answers.get(key)
    if (before !== undefined && (never || holds())) return before
    const fresh = run()
    answers.set(key, fresh)
    return fresh
  }
  return {
    page: (at, request) => ask("page", at, request, () => rebuild.page(at, request)) as never,
    narrowing: (at, request) =>
      ask("narrowing", at, request, () => rebuild.narrowing(at, request)) as never,
    moving: (at, request) => ask("moving", at, request, () => rebuild.moving(at, request)) as never,
  }
}

const keyed = (now: () => string, key: (which: Asked) => string): Standing => {
  const rebuild = rebuilding(now, NO_KINDS)
  const answers = new Map<string, { reading: Reading; answer: unknown }>()
  const ask = (which: Asked, at: Reading, run: () => unknown): unknown => {
    const held = answers.get(key(which))
    if (held !== undefined && held.reading === at) return held.answer
    const fresh = run()
    answers.set(key(which), { reading: at, answer: fresh })
    return fresh
  }
  return {
    page: (at, request) => ask("page", at, () => rebuild.page(at, request)) as never,
    narrowing: (at, request) => ask("narrowing", at, () => rebuild.narrowing(at, request)) as never,
    moving: (at, request) => ask("moving", at, () => rebuild.moving(at, request)) as never,
  }
}

export const tabsOver = (at: Reading): ReadonlyArray<Tab> => {
  const files = at.set.documents.map((one) => one.path).filter((path) =>
    bodyKind(TEST_CLAIMS, path) === null
  )
  const first = files[0] as string
  const second = files[1] as string
  const node = at.derived.nodes.find((one) => one.node.id.includes("n1"))?.node.id as string
  const day = [...at.derived.byDay.keys()][0] as string
  const pageAt = (path: string): PageRequest => ({ kind: "at", address: addressOf(TEST_CLAIMS, path, null) })
  const one: Question = { which: "page", request: pageAt(first) }
  const two: Question = { which: "page", request: pageAt(second) }
  return [
    { says: "tab one (the first outline)", holds: [one] },
    { says: "tab two (the same outline)", holds: [one] },
    {
      says: "tab three (another outline, filtered)",
      holds: [
        two,
        { which: "narrowing", request: { page: pageAt(second), text: "record" } },
      ],
    },
    {
      says: "tab four (a day, the agenda, the trash and a move)",
      holds: [
        { which: "page", request: { kind: "day", date: day } },
        { which: "page", request: { kind: "agenda", today: day } },
        { which: "page", request: { kind: "trash" } },
        { which: "page", request: { kind: "at", address: addressOf(TEST_CLAIMS, null, node) } },
        { which: "moving", request: { record: node, to: [first, "nowhere"] } },
        { which: "narrowing", request: { page: pageAt(first), text: "is:todo" } },
      ],
    },
  ]
}

export const questionsOf = (tabs: ReadonlyArray<Tab>): ReadonlyArray<Question> => {
  const seen = new Map<string, Question>()
  for (const tab of tabs) {
    for (const question of tab.holds) {
      seen.set(`${question.which} ${JSON.stringify(question.request)}`, question)
    }
  }
  return [...seen.values()]
}

export const tornIn = (revisions: ReadonlyArray<Revision>): ReadonlyArray<BrokenFile> =>
  revisions.flatMap((revision) => revision.reading.set.broken)
