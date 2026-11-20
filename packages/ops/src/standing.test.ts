import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import { expect, test } from "bun:test"

import {
  FIXED,
  type Modelled,
  publishing,
  type Vault,
  vaultFor,
} from "./standing.testlib.ts"
import { standing } from "./standing.ts"
import { addressOf, NO_KINDS, type PageRequest, type Reading } from "@olai/format"

const directory = (): {
  readonly vault: Vault
  readonly publish: (says: string, changed: ReadonlyArray<string>) => Reading
  readonly first: Reading
  readonly path: string
  readonly record: Modelled
  readonly leaf: Modelled
} => {
  const vault = vaultFor({ files: 6, records: 6 })
  const { publish, revisions } = publishing(vault)
  const first = (revisions[0] as { reading: Reading }).reading
  const path = [...vault.outlines.keys()].find((one) =>
    (vault.outlines.get(one) ?? []).some((record) => record.date !== null)
  ) as string
  const own = vault.outlines.get(path) as ReadonlyArray<Modelled>
  const record = own.find((one) => one.date !== null) as Modelled
  const leaf = own.findLast((one) =>
    one.parent !== null &&
    own.every((other) =>
      other.parent !== one.id && other.after !== one.id && other.mirror !== one.id
    )
  ) as Modelled
  return {
    vault,
    publish: (says, changed) => publish(says, changed, []),
    first,
    path,
    record,
    leaf,
  }
}

const pageAt = (path: string): PageRequest => ({ kind: "at", address: addressOf(TEST_CLAIMS, path, null) })

test("two tabs on one question at one revision are handed the same object", () => {
  const { first, path } = directory()
  const views = standing(() => FIXED, NO_KINDS)
  const one = views.page(first, pageAt(path))
  const two = views.page(first, pageAt(path))
  expect(two).toBe(one)
})

test("two tabs on DIFFERENT questions of one member share nothing", () => {
  const { vault, first } = directory()
  const [one, two] = [...vault.outlines.keys()]
  const views = standing(() => FIXED, NO_KINDS)
  expect(views.page(first, pageAt(one as string)))
    .not.toBe(views.page(first, pageAt(two as string)))
})

test("the clock is sampled once per question per revision", () => {
  const { first, path } = directory()
  let ticks = 0
  const views = standing(() => {
    ticks++
    return FIXED
  }, NO_KINDS)
  const request = { page: pageAt(path), text: "created:1h" }
  const one = views.narrowing(first, request)
  const two = views.narrowing(first, request)
  expect(two).toBe(one)
  expect(ticks).toBe(1)
})

test("a file RE-READ is conservatively rebuilt, and its neighbours are not", () => {
  const { vault, first, path, publish } = directory()
  const elsewhere = [...vault.outlines.keys()].find((one) => one !== path) as string
  const views = standing(() => FIXED, NO_KINDS)
  const own = views.page(first, pageAt(path))
  const other = views.page(first, pageAt(elsewhere))
  const next = publish(`re-read ${path}`, [path])
  expect(next).not.toBe(first)
  expect(views.page(next, pageAt(path))).not.toBe(own)
  expect(views.page(next, pageAt(path))).toEqual(own)
  expect(views.page(next, pageAt(elsewhere))).toBe(other)
})

test("an edit in another file leaves this page's answer alone", () => {
  const { vault, first, path, publish } = directory()
  const elsewhere = [...vault.outlines.keys()].find((one) => one !== path) as string
  const views = standing(() => FIXED, NO_KINDS)
  const before = views.page(first, pageAt(path))
  const record = (vault.outlines.get(elsewhere) as Array<Modelled>).find((one) =>
    one.parent !== null
  ) as Modelled
  record.title = `${record.title} — typed into`
  const next = publish(`retitle in ${elsewhere}`, [elsewhere])
  expect(views.page(next, pageAt(path))).toBe(before)
})

const noticed = <A>(
  edit: (vault: Vault, one: Subject) => void,
  ask: (views: ReturnType<typeof standing>, at: Reading, one: Subject) => A,
): { readonly before: A; readonly after: A } => {
  const { vault, first, path, record, leaf, publish } = directory()
  const views = standing(() => FIXED, NO_KINDS)
  const subject: Subject = { path, record, leaf }
  const before = ask(views, first, subject)
  edit(vault, subject)
  const next = publish("the edit", [path])
  expect(next).not.toBe(first)
  return { before, after: ask(views, next, subject) }
}

interface Subject {
  readonly path: string
  readonly record: Modelled
  readonly leaf: Modelled
}

test("a title that moved is noticed by the page it is on", () => {
  const { before, after } = noticed(
    (_vault, one) => {
      one.record.title = "written just now"
    },
    (views, at, one) => views.page(at, pageAt(one.path)),
  )
  expect(after).not.toBe(before)
})

test("a title that moved is noticed by the filter over that page", () => {
  const { before, after } = noticed(
    (_vault, one) => {
      one.record.title = "zzz nothing else in this vault says this"
    },
    (views, at, one) => views.narrowing(at, { page: pageAt(one.path), text: "zzz" }),
  )
  expect(after).not.toBe(before)
  expect(after).not.toEqual(before)
})

test("a record that went away is noticed by the move picker", () => {
  const { before, after } = noticed(
    (vault, one) => {
      const own = vault.outlines.get(one.path) as ReadonlyArray<Modelled>
      vault.outlines.set(one.path, own.filter((record) => record !== one.leaf))
    },
    (views, at, one) => views.moving(at, { record: one.leaf.id, to: [one.record.id] }),
  )
  expect(after).not.toBe(before)
  expect(after).not.toEqual(before)
})

test("a question nobody asks any more is not kept", () => {
  const { vault, first, path, publish } = directory()
  const elsewhere = [...vault.outlines.keys()].find((one) => one !== path) as string
  const views = standing(() => FIXED, NO_KINDS)
  const before = views.page(first, pageAt(path))
  for (const says of ["a revision", "and another"]) {
    views.page(publish(says, [path]), pageAt(elsewhere))
  }
  const after = views.page(
    publish("a third, still not asked about", [path]),
    pageAt(path),
  )
  expect(after).not.toBe(before)
  expect(after).toEqual(before)
})
