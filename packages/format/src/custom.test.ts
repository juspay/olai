/**
 * The two orders a `custom` map has, and the difference between them.
 *
 * A WRITER spends `customKeys`, which is canonical and alphabetical, because
 * two files that mean the same thing must not differ byte for byte. A DRAWER
 * spends `customOrder`, which is the order the map itself holds — and for a
 * record read off disk that is the order the bytes have it, which is the whole
 * claim worth pinning: the file's own order survives the parse, so a view that
 * does not sort is a view showing what was written.
 */

import { expect, test } from "bun:test"
import { Result } from "effect"

import { customKeys, customOf, customOrder, withCustom } from "./custom.ts"
import { isMirror } from "./node.ts"
import { parseOutline } from "./parse.ts"
import { serializeNode } from "./write.ts"

/** A map built in an order no sort would produce. */
const LANE = withCustom(
  withCustom(withCustom({}, "worktree", ".worktrees/pda"), "agent", "claude-opus"),
  "brief",
  "briefs/pda.md",
)

test("the writer's order is alphabetical, whatever order the map was built in", () => {
  expect(customKeys(LANE)).toEqual(["agent", "brief", "worktree"])
})

test("the drawer's order is the map's own, and it does not sort", () => {
  expect(customOrder(LANE)).toEqual(["worktree", "agent", "brief"])
})

test("a hand-written file's key order survives the parse — what a drawer draws", () => {
  const parsed = parseOutline(
    "lanes.olai",
    `{"id":"lane","ord":"a","title":"a lane",` +
      `"custom":{"worktree":".worktrees/pda","agent":"claude-opus","brief":"briefs/pda.md"}}\n`,
  )
  const outline = Result.getOrThrow(parsed)
  const node = outline.nodes[0]?.node
  expect(node === undefined || isMirror(node) ? [] : customOrder(customOf(node)))
    .toEqual(["worktree", "agent", "brief"])
})

test("...and what OLAI writes is alphabetical, so the two orders agree on its own files", () => {
  const written = serializeNode({ id: "lane", ord: "a", title: "a lane", custom: LANE })
  const outline = Result.getOrThrow(parseOutline("lanes.olai", `${written}\n`))
  const node = outline.nodes[0]?.node
  expect(node === undefined || isMirror(node) ? [] : customOrder(customOf(node)))
    .toEqual(["agent", "brief", "worktree"])
})
