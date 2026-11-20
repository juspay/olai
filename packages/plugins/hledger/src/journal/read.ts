import { type Amount } from "./amount.ts"
import { compareAccounts, type Movement, rollup } from "./balances.ts"
import { boundedBy, type Bounds, clip } from "./bounds.ts"
import { type EntryKind, group } from "./group.ts"
import { type Header } from "./header.ts"
import { infer } from "./infer.ts"
import { classify, type Line } from "./line.ts"
import { type Posting } from "./posting.ts"
import { type Tag, tagsIn } from "./tags.ts"

export type Transaction = Header & {
  readonly prose: string
  readonly postings: ReadonlyArray<Posting>
}

export interface Entry {
  readonly line: number
  readonly span: number
  readonly text: string
  readonly kind: EntryKind
}

export interface Balances {
  readonly accounts: ReadonlyArray<string>
  readonly of: ReadonlyMap<string, ReadonlyArray<Amount>>
}

export interface Journal {
  readonly transactions: ReadonlyArray<Transaction>
  readonly entries: ReadonlyArray<Entry>
  readonly balances: Balances
  readonly moreTransactions: boolean
  readonly truncated: boolean
  readonly longCells: boolean
  readonly lines: number
}

export const readJournal = (text: string, bounds?: Partial<Bounds>): Journal => {
  const limits = boundedBy(bounds)
  const rawLines = text.split("\n", limits.lines + 1)
  const logical = text === "" ? 0 : text.endsWith("\n") ? rawLines.length - 1 : rawLines.length
  const read = Math.min(logical, limits.lines)
  let consumed = 0
  for (let at = 0; at < read; at++) {
    const next = text.indexOf("\n", consumed)
    if (next < 0) {
      consumed = text.length
      break
    }
    consumed = next + 1
  }
  const truncated = consumed < text.length

  const lines: Array<Line> = []
  for (let at = 0; at < read; at++) {
    const raw = rawLines[at] as string
    lines.push(classify(raw.endsWith("\r") ? raw.slice(0, -1) : raw))
  }

  const witness = { cut: false }
  const cut = (field: string): string => clip(field, limits.cell, witness)
  const cutTags = (ones: ReadonlyArray<Tag>): ReadonlyArray<Tag> =>
    ones.map((one) => ({ key: cut(one.key), value: one.value === null ? null : cut(one.value) }))
  const cutAccount = (account: string): string => {
    const held = cut(account)
    const trimmed = held.replace(/:+$/, "")
    return trimmed === "" ? held : trimmed
  }
  const cutPosting = (one: Posting): Posting => ({
    ...one,
    account: cutAccount(one.account),
    cost: one.cost === null ? null : cut(one.cost),
    assertion: one.assertion === null ? null : cut(one.assertion),
    comment: one.comment === null ? null : cut(one.comment),
    prose: one.comment === null ? "" : cut(tagsIn(one.comment).prose),
    tags: cutTags(one.tags),
  })

  const transactions: Array<Transaction> = []
  const entries: Array<Entry> = []
  const movements: Array<Movement> = []
  let moreTransactions = false

  for (const block of group(lines)) {
    if (block.kind === "entry") {
      entries.push({ line: block.line, span: block.span, text: cut(block.text), kind: block.entry })
      continue
    }
    for (const bad of block.refused) entries.push({ line: bad.line, span: 1, text: cut(bad.text), kind: "unknown" })
    if (transactions.length >= limits.transactions) {
      moreTransactions = true
      continue
    }
    const header = block.header
    const postings = infer(block.postings, block.refused.length > 0).map(cutPosting)
    transactions.push({
      ...header,
      code: header.code === null ? null : cut(header.code),
      description: cut(header.description),
      payee: cut(header.payee),
      note: header.note === null ? null : cut(header.note),
      comment: header.comment === null ? null : cut(header.comment),
      prose: header.comment === null ? "" : cut(tagsIn(header.comment).prose),
      tags: cutTags(header.tags),
      postings,
    })
    for (const posting of postings) {
      const amount = posting.amount
      if (amount === null) continue
      movements.push({ account: posting.account, commodity: amount.commodity, value: amount.value })
    }
  }

  const rolled = rollup(movements)
  const of = new Map<string, ReadonlyArray<Amount>>()
  for (const [account, held] of rolled) {
    const amounts = [...held]
      .filter(([, value]) => value.value !== 0n)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([commodity, value]) => ({ commodity, value, style: null, written: null }))
    if (amounts.length > 0) of.set(account, amounts)
  }

  return {
    transactions,
    entries,
    balances: { accounts: [...rolled.keys()].sort(compareAccounts), of },
    moreTransactions,
    truncated,
    longCells: witness.cut,
    lines: read,
  }
}
