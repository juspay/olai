/**
 * WHAT A FRAME COSTS THE TREE — the audit's 2.11, measured on both sides of the
 * declaration that ended it.
 *
 * `docs/brainstorming/reactivity-after-the-flip.md`'s 2.11 is the one finding of
 * that whole audit with no client-side fix. `./Tree.tsx` already draws its rows
 * with `<Key each={props.rows} by="key">`, so the DOM survives a frame — that
 * part was never the complaint. What did not survive was the ROW OBJECT: the
 * store merged every frame with `reconcile(next, { key: null })` and no `merge`,
 * so nothing off the wire was `===` what came before it, `keyArray` called
 * `setItem(newProxy)` for every row on every frame, and every `Branch` binding
 * that reads `props.row` — some twenty-five of them, plus `Glyph`, `NodeLine`,
 * `NodeTitle`, `Aside`, `customEntries`, `NodeBody`'s `plainLine` and
 * `doneUnder` — re-ran for EVERY row for a one-character change in ONE row.
 * The comment at `Tree.tsx:163-169` has said "fresh rows every frame" since the
 * flip.
 *
 * It is measured here rather than argued because the fix was upstream and this
 * is the side that has to show it landed: `@olai/surface`'s `page` stream
 * declares `arrayKey: "key"` (juspay/kolu#2190), and what that is worth is a
 * number.
 *
 * ## What stands in for what
 *
 *   - `keyArray` IS what `<Key>` is built on, imported rather than imitated, so
 *     "the row object was replaced" is asked of the primitive the tree actually
 *     uses;
 *   - ONE per-row memo reading `row()` stands for the twenty-five bindings a
 *     `Branch` has. It is a lower bound on purpose — the real number is this
 *     one times the bindings per row — and it is the honest unit, because they
 *     all re-run together or not at all;
 *   - `writeWrappedValue` IS the one merge `@kolu/surface` performs, imported
 *     rather than imitated, and it is called BOTH ways: with the key this
 *     surface declares, and with none, which is master's behaviour exactly. The
 *     undeclared arm is a test too — nobody may "fix" the declared case by
 *     making the merge silent everywhere.
 *
 * The KEY IS READ OFF THE SPEC rather than spelled here, so this measures what
 * the app ships. `packages/surface/src/surface.test.ts` is where the spelling
 * itself is pinned against the schema.
 *
 * WHAT IT DOES NOT COVER, so the name over the door is not read as a promise:
 * this file never imports `./Tree.tsx`. There is no DOM here to render one in,
 * and what is being asked is a question about the MERGE that `Tree.tsx` is
 * merely the biggest consumer of — so every case below would still pass if the
 * tree stopped keying its rows by `key` tomorrow. That claim's guard is the e2e
 * suite (`a_frame_leaves_it_standing.feature` and `the_chrome_holds_still.
 * feature`, over the real component in a real browser), and the twenty-five
 * bindings a `Branch` has is the audit's own count of what one reads, cited
 * rather than measured here.
 *
 * `.browsertest.ts` for `./settled.browsertest.ts`'s reason, which that file
 * argues in full: `bun test` resolves SolidJS's SERVER build, where a memo never
 * re-runs and an effect never runs at all — so every case below would PASS
 * having recomputed nothing. The second command of the same `just test` leg
 * names this path.
 */

import { keyArray } from "@solid-primitives/keyed"
import { expect, test } from "bun:test"
import { $TRACK, createEffect, createMemo, createRoot } from "solid-js"

import type { PageReading, Row } from "@olai/format"
import { surface } from "@olai/surface"

import { page, row, wired } from "./frame.testlib.ts"

/** What the app ships — see the header. */
const DECLARED = surface.spec.streams.page.arrayKey

/**
 * The page every case below starts from, and the three shapes a gesture leaves
 * it in — spelled ONCE and varied by argument.
 *
 * Four literals differing in one word would make "an IDENTICAL frame" a claim
 * about somebody's typing rather than a property of the value, and a stray
 * character in the part meant to be unchanged would read as a row that moved.
 *
 * A FUNCTION and never a shared value: a frame written into a store becomes
 * that store's reconcile target, so two writes of one object would be the
 * second one merging a value into itself.
 */
const THREE = (
  moved: {
    /** One top-level row's title, changed. */
    readonly order?: string
    /** ...or one row three levels down. */
    readonly child?: string
    /** ...or nothing changed and the rows arrive in a different order. */
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

/** The tree's own reading of a store, with the two counters the finding is
 *  about: how many times a per-row binding re-ran, and how many times the rows
 *  array itself said it had moved. */
interface Drive {
  readonly write: (next: PageReading) => void
  readonly bindings: () => number
  readonly tracks: () => number
  readonly titles: () => ReadonlyArray<string>
  readonly stop: () => void
}

/** RETURNED from the root rather than driven inside it, which is not a style:
 *  Solid queues effects and flushes them when the enclosing update completes,
 *  so a body running inside `createRoot` would take its readings before a
 *  single effect had run and report nothing happening, whatever happened. */
const driving = (arrayKey: string | undefined): Drive =>
  createRoot((dispose) => {
    const store = wired(arrayKey)
    const shows = (): { rows: ReadonlyArray<Row> } | undefined => {
      const held = store.reading()?.shows
      return held !== undefined && held.kind === "outline" ? held : undefined
    }
    const rows = (): ReadonlyArray<Row> => shows()?.rows ?? []

    let bindings = 0
    let tracks = 0
    const mapped = keyArray(
      rows,
      (one) => one.key,
      (one) =>
        createMemo(() => {
          bindings += 1
          const held = one()
          // What `NodeTitle` reads, narrowed the way `Branch` narrows it: a
          // dangling or cyclic place shows no node and has no title to draw.
          return held.kind === "node" || held.kind === "mirror"
            ? held.shows.node.title
            : held.key
        }),
    )
    // A SUBSCRIBER, because a memo nobody reads is one Solid is free to leave
    // cold — and every binding this stands for is drawn.
    const titles: Array<string> = []
    createEffect(() => {
      titles.length = 0
      for (const one of mapped()) titles.push(one())
    })
    // `[$TRACK]` on the array is what a keyed list's own diff wakes on: it fires
    // when an element was REPLACED, which under an undeclared merge is every
    // element on every frame.
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

/** What ONE frame cost, counted from the page it landed on. */
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
  // Master, exactly: `reconcile(next, { key: null })` with no `merge`. The same
  // page said again — every object of it new, as every frame's is — and three
  // top-level rows re-run three bindings for it.
  const was = cost(undefined, THREE())
  expect(was.bindings).toBe(3)
  expect(was.tracks).toBe(1)
})

test("DECLARED: a repeated frame re-runs nothing at all", () => {
  const now = cost(DECLARED, THREE())
  expect(now.bindings).toBe(0)
  expect(now.tracks).toBe(0)
})

/** The keystroke the finding is written about: one row's title, nothing else. */
const RETITLED = ["kitchen remodel", "order the new cabinets today", "the herb bed"]

test("UNDECLARED: one row's title re-runs every row's bindings", () => {
  // The finding in one line: a one-character change in ONE row is O(rows).
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
  // The half a positional merge could not give, and the one a `move_node`
  // landing under somebody's page is about: the row objects a keyed view is
  // following go WITH their rows, so nothing re-runs for a gesture that changed
  // no row's content. Undeclared, every row was rewritten in place.
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
  // One key per member, reaching every array at every depth — so the subtree
  // `<Key each={props.row.children} by="key">` draws is keyed too. Undeclared,
  // a child's title replaced its parent's row object and every sibling's with
  // it; declared, it reaches the one binding that draws it and no other.
  const child = { child: "choose the handles today" }
  expect(cost(undefined, THREE(child)).bindings).toBe(3)
  expect(cost(DECLARED, THREE(child)).bindings).toBe(0)
})

test("the key this measures is the key the app declares", () => {
  // The numbers above are about `@olai/surface`'s spec and not about a string
  // spelled in a test: a declaration lost in a refactor makes every DECLARED
  // case here read exactly like its UNDECLARED twin, which would otherwise be a
  // suite quietly measuring master.
  expect(DECLARED).toBe("key")
})
