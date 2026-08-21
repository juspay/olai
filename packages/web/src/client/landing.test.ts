/**
 * Whose arrival it is, and whether it has happened — the landing rules, done as
 * arithmetic.
 *
 * They lived inside `./router.tsx` until this file, where the only way to reach
 * them was to drive a browser at a two-pane address and read where a heading
 * ended up. Those scenarios still hold what only a browser can say — that a
 * reader really is in front of the section (`second_pane.feature`,
 * `html_previews.feature`) — but which pane is owed what, and what a navigation
 * next door does to it, is a question about a map, and a question about a map
 * should be answered by asking one.
 *
 * The four claims:
 *
 *   - **every pane that named a section is owed one**, which is what a two-pane
 *     link is and what one slot for the workspace could never pay;
 *   - **a pane's landing is only ever news about that pane**, so a navigation
 *     next door leaves it exactly as it was;
 *   - **spending names what it spends** — the pane, the page and the place —
 *     because an act is performed a frame after it is decided on and a
 *     navigation can arrive in between;
 *   - **nothing to say is said with the same map**, because the signal these
 *     live on compares by identity and a fresh empty map would wake every pane
 *     to tell it nothing.
 */

import { describe, expect, test } from "bun:test"

import { landingOf, landingsOf, marked, NOWHERE, spent } from "./landing.ts"
import { routeOf } from "./routes.ts"
import { lone, workspaceOf } from "./workspace.ts"

/** A two-pane address whose panes both name a heading — the shape the whole
 *  per-pane rule exists for. */
const BOTH = workspaceOf("/s/notes%2Fbeds.md%23slats/notes%2Fdeep.html%23beds")

describe("what an address is owed", () => {
  test("a heading address is a landing; a whole page is not", () => {
    expect(landingOf(routeOf("/notes/beds.md#slats"))).toEqual({
      file: "notes/beds.md",
      at: "slats",
      spent: false,
    })
    expect(landingOf(routeOf("/notes/beds.md"))).toBeUndefined()
  })

  test("every pane that named a section is owed one, not just the focused", () => {
    const owed = landingsOf(BOTH)
    expect(owed.get(0)).toEqual({ file: "notes/beds.md", at: "slats", spent: false })
    expect(owed.get(1)).toEqual({ file: "notes/deep.html", at: "beds", spent: false })
  })

  test("a pane at a whole page is owed nothing, beside one that is", () => {
    const owed = landingsOf(workspaceOf("/s/house.olai/notes%2Fbeds.md%23slats"))
    expect(owed.has(0)).toBe(false)
    expect(owed.get(1)?.at).toBe("slats")
  })

  test("a lone page is the same question with one pane", () => {
    expect([...landingsOf(lone(routeOf("/notes/beds.md#slats"))).keys()]).toEqual([0])
    expect(landingsOf(lone(routeOf("/house.olai"))).size).toBe(0)
  })
})

describe("one pane's news is one pane's", () => {
  test("marking a pane leaves the others exactly as they were", () => {
    const owed = landingsOf(BOTH)
    const after = marked(owed, 0, landingOf(routeOf("/notes/other.md#top")))
    expect(after.get(0)?.file).toBe("notes/other.md")
    expect(after.get(1)).toBe(owed.get(1))
  })

  test("a pane navigated to a whole page is owed nothing, and nobody else moves", () => {
    const owed = landingsOf(BOTH)
    const after = marked(owed, 1, undefined)
    expect(after.has(1)).toBe(false)
    expect(after.get(0)).toBe(owed.get(0))
  })

  test("nothing to say is said with the same map", () => {
    const owed = landingsOf(BOTH)
    expect(marked(owed, 4, undefined)).toBe(owed)
    expect(marked(NOWHERE, 0, undefined)).toBe(NOWHERE)
  })
})

describe("spending an arrival", () => {
  test("the act is performed once, and the slug is still readable after", () => {
    const owed = landingsOf(BOTH)
    const after = spent(owed, 0, "notes/beds.md", "slats")
    // Still there to be READ, slug and all: the preview builds its frame's URL
    // out of it, so a landing that VANISHED when it was spent would re-point
    // the frame at the file for nobody's reason.
    expect(after.get(0)).toEqual({ file: "notes/beds.md", at: "slats", spent: true })
    // …and not spendable twice.
    expect(spent(after, 0, "notes/beds.md", "slats")).toBe(after)
  })

  test("an act about the landing before this one spends nothing", () => {
    const owed = landingsOf(BOTH)
    expect(spent(owed, 0, "notes/beds.md", "somewhere-else")).toBe(owed)
    expect(spent(owed, 0, "notes/gone.md", "slats")).toBe(owed)
    // …including one aimed at the pane next door's page.
    expect(spent(owed, 0, "notes/deep.html", "beds")).toBe(owed)
  })

  test("a pane owed nothing cannot be spent", () => {
    expect(spent(NOWHERE, 0, "notes/beds.md", "slats")).toBe(NOWHERE)
  })

  test("spending one pane leaves the other owed", () => {
    const after = spent(landingsOf(BOTH), 1, "notes/deep.html", "beds")
    expect(after.get(1)?.spent).toBe(true)
    expect(after.get(0)?.spent).toBe(false)
  })
})
