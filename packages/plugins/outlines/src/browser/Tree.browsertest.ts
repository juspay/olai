import { keyArray } from "@solid-primitives/keyed"
import { expect, test } from "bun:test"
import { $TRACK, createEffect, createMemo, createRoot } from "solid-js"

import type { PageReading, Row } from "@olai/format"
import { surface } from "../surface.ts"

import { createDoneRows, createMatchedRows } from "./pruning.ts"
import { page, row, wired } from "./frame.testlib.ts"

const DECLARED = surface.spec.streams.page.arrayKey

const THREE = (
  moved: {
    readonly order?: string
    readonly child?: string
    readonly rotated?: boolean
  } = {},
): PageReading => {
  const rows = [
    row("/kitchen", "kitchen", "kitchen remodel", [
      row("/kitchen/handles", "handles", moved.child ?? "choose the handles"),
    ]),
    row("/order", "order", moved.order ?? "order the new cabinets"),
    row("/herbs", "herbs", "the herb bed"),
  ] as const
  return page(moved.rotated === true ? [rows[2], rows[0], rows[1]] : rows)
}

interface Drive {
  readonly write: (next: PageReading) => void
  readonly bindings: () => number
  readonly tracks: () => number
  readonly titles: () => ReadonlyArray<string>
  readonly stop: () => void
}

const driving = (arrayKey: string | undefined, prune = false): Drive =>
  createRoot((dispose) => {
    const store = wired(arrayKey)
    const shows = (): { rows: ReadonlyArray<Row> } | undefined => {
      const held = store.reading()?.shows
      return held !== undefined && held.kind === "outline" ? held : undefined
    }
    const raw = (): ReadonlyArray<Row> => shows()?.rows ?? []
    const done = createDoneRows(raw, () => true, () => undefined)
    const matched = createMatchedRows(done, () => ({ has: () => true }))
    const rows = prune ? matched : raw

    let bindings = 0
    let tracks = 0
    const mapped = keyArray(
      rows,
      (one) => one.key,
      (one) =>
        createMemo(() => {
          bindings += 1
          const held = one()
          return held.kind === "node" || held.kind === "mirror"
            ? held.shows.node.title
            : held.key
        }),
    )
    const titles: Array<string> = []
    createEffect(() => {
      titles.length = 0
      for (const one of mapped()) titles.push(one())
    })
    createEffect(() => {
      void (rows() as unknown as Record<symbol, unknown>)[$TRACK]
      tracks += 1
    })

    return {
      write: store.write,
      bindings: () => bindings,
      tracks: () => tracks,
      titles: () => [...titles],
      stop: dispose,
    }
  })

const cost = (
  arrayKey: string | undefined,
  next: PageReading,
): { bindings: number; tracks: number; titles: ReadonlyArray<string> } => {
  const drive = driving(arrayKey)
  try {
    drive.write(THREE())
    const wasBindings = drive.bindings()
    const wasTracks = drive.tracks()
    drive.write(next)
    return {
      bindings: drive.bindings() - wasBindings,
      tracks: drive.tracks() - wasTracks,
      titles: drive.titles(),
    }
  } finally {
    drive.stop()
  }
}

test("UNDECLARED: a repeated frame re-runs every row's bindings — the defect", () => {
  const was = cost(undefined, THREE())
  expect(was.bindings).toBe(3)
  expect(was.tracks).toBe(1)
})

test("DECLARED: a repeated frame re-runs nothing at all", () => {
  const now = cost(DECLARED, THREE())
  expect(now.bindings).toBe(0)
  expect(now.tracks).toBe(0)
})

const RETITLED = ["kitchen remodel", "order the new cabinets today", "the herb bed"]

test("UNDECLARED: one row's title re-runs every row's bindings", () => {
  const was = cost(undefined, THREE({ order: "order the new cabinets today" }))
  expect(was.bindings).toBe(3)
  expect(was.titles).toEqual(RETITLED)
})

test("DECLARED: one row's title re-runs that row's bindings and no other", () => {
  const now = cost(DECLARED, THREE({ order: "order the new cabinets today" }))
  expect(now.bindings).toBe(1)
  expect(now.titles).toEqual(RETITLED)
})

test("a reorder MOVES the rows rather than rewriting them", () => {
  expect(cost(undefined, THREE({ rotated: true })).bindings).toBe(3)
  const now = cost(DECLARED, THREE({ rotated: true }))
  expect(now.bindings).toBe(0)
  expect(now.titles).toEqual([
    "the herb bed",
    "kitchen remodel",
    "order the new cabinets",
  ])
})

test("a row's CHILDREN are keyed by the same field, at every depth", () => {
  const child = { child: "choose the handles today" }
  expect(cost(undefined, THREE(child)).bindings).toBe(3)
  expect(cost(DECLARED, THREE(child)).bindings).toBe(0)
})

test("the key this measures is the key the app declares", () => {
  expect(DECLARED).toBe("key")
})

test("PageView done and filter pipeline updates only the changed row binding", () => {
  const drive = driving(DECLARED, true)
  try {
    drive.write(THREE())
    const before = drive.bindings()
    drive.write(THREE({ order: "order the new cabinets today" }))
    expect(drive.bindings() - before).toBe(1)
    expect(drive.titles()).toEqual(RETITLED)
    const updated = drive.bindings()
    drive.write(THREE({ order: "order the new cabinets today", child: "changed child" }))
    expect(drive.bindings()).toBe(updated)
  } finally { drive.stop() }
})
