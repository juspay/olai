/**
 * THE DECLARATION LICENCES THE PROBE — the walk's own bench.
 *
 * Every case here is `lanesIn` over a whole vault built out of JSONL the real
 * parser accepts, because the claim under test is about what a vault SAYS: a
 * `worktree` becomes a path olai will dial a socket under only where the
 * declarations file says that key holds paths. The resolution of the value it
 * yields is a different subject with a bench of its own
 * (`@olai/odu-client`'s `resolve.test.ts`); what these ask is which records
 * cross at all.
 */

import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { lanesIn } from "./lanes"

/** One record, as a file writes it. */
const rec = (
  id: string,
  title: string,
  custom?: Record<string, string>,
  extra = "",
): string =>
  `{"id":${JSON.stringify(id)},"ord":"a0","title":${JSON.stringify(title)}${extra}${
    custom === undefined ? "" : `,"custom":${JSON.stringify(custom)}`
  }}`

/** The declarations file, saying what `worktree` is. */
const declaring = (type: string): string =>
  rec("prop-worktree", "worktree", { type })

const lanesOf = (files: Record<string, string>) => [
  ...lanesIn(readingOf(setOf(files)).derived),
]

test("a vault that declares `worktree` a path yields its lanes, with the PR beside them", () => {
  expect(
    lanesOf({
      "_olai/Properties.olai": declaring("path"),
      "board.olai": rec("lane-a", "the seam", {
        worktree: ".worktrees/live-properties",
        "pr-url": "https://github.com/juspay/olai/pull/433",
      }),
    }),
  ).toEqual([{
    id: "lane-a",
    title: "the seam",
    worktree: ".worktrees/live-properties",
    prUrl: "https://github.com/juspay/olai/pull/433",
  }])
})

test("a lane with no `pr-url` still crosses — where it RESOLVES is not this walk's question", () => {
  // The two facts have different owners: this walk says which records name a
  // worktree, and `worktreeAt` says which of those it can place. A lane
  // dropped here for want of a URL would be a resolution rule spelled twice.
  expect(
    lanesOf({
      "_olai/Properties.olai": declaring("path"),
      "board.olai": rec("lane-a", "the seam", { worktree: "/srv/checkout" }),
    }),
  ).toEqual([{
    id: "lane-a",
    title: "the seam",
    worktree: "/srv/checkout",
    prUrl: undefined,
  }])
})

test("a vault that declares NOTHING probes nothing, however many worktrees it names", () => {
  // The licence, stated: an undeclared key is `text`, and nobody has promised
  // that these values are paths. A dozen lanes and no dials.
  expect(
    lanesOf({
      "board.olai": rec("lane-a", "the seam", { worktree: ".worktrees/a" }),
    }),
  ).toEqual([])
})

test("...and neither does one that declares the key something else", () => {
  expect(
    lanesOf({
      "_olai/Properties.olai": declaring("text"),
      "board.olai": rec("lane-a", "the seam", { worktree: ".worktrees/a" }),
    }),
  ).toEqual([])
})

test("a record with no `worktree` is not a lane, declaration or not", () => {
  expect(
    lanesOf({
      "_olai/Properties.olai": declaring("path"),
      "board.olai": rec("plain", "an ordinary bullet", { agent: "claude-opus" }),
    }),
  ).toEqual([])
})

test("a MIRROR is skipped — its target carries the property and is in the same walk", () => {
  // A placement holds no properties of its own, so asking it would be asking
  // the wrong record; two rows probing one checkout would also be two dials of
  // one socket.
  const lanes = lanesOf({
    "_olai/Properties.olai": declaring("path"),
    "board.olai": [
      rec("lane-a", "the seam", { worktree: ".worktrees/a" }),
      `{"id":"m","ord":"a1","mirror":"lane-a"}`,
    ].join("\n"),
  })
  expect(lanes.map((lane) => lane.id)).toEqual(["lane-a"])
})
