/**
 * THE DECLARATION LICENCES THE PROBE — the walk's own bench.
 *
 * Every case here is `worktreesIn` over a whole vault built out of JSONL the real
 * parser accepts, because the claim under test is about what a vault SAYS: a
 * value becomes a path olai will dial a socket under only where the
 * declarations file declares its key a `worktree` — the KIND this plugin
 * contributes ({@link ./kinds.ts}), not the key's NAME and not the `path` the
 * licence used to settle for. The resolution of the value it yields is a
 * different subject with a bench of its own
 * (`@olai/odu-client`'s `resolve.test.ts`); what these ask is which records
 * cross at all.
 */

import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { worktreesIn } from "./worktrees.ts"
import { WORKTREE_TYPE } from "./kinds.ts"

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

/** The declarations file, saying what a key is — the key NAMED here is
 *  incidental and two cases below name a different one on purpose. */
const declaring = (type: string, key = "worktree"): string =>
  rec(`prop-${key}`, key, { type })

const worktreesOf = (files: Record<string, string>) => [
  ...worktreesIn(readingOf(setOf(files)).derived),
]

test("a vault that declares `worktree` a path yields the nodes that carry it, with the PR beside them", () => {
  expect(
    worktreesOf({
      "_olai/Properties.org": declaring(WORKTREE_TYPE),
      "board.org": rec("node-a", "the seam", {
        worktree: ".worktrees/live-properties",
        "pr-url": "https://github.com/juspay/olai/pull/433",
      }),
    }),
  ).toEqual([{
    node: "node-a",
    title: "the seam",
    value: ".worktrees/live-properties",
    prUrl: "https://github.com/juspay/olai/pull/433",
  }])
})

test("a node with no `pr-url` still crosses — where it RESOLVES is not this walk's question", () => {
  // The two facts have different owners: this walk says which records name a
  // worktree, and `worktreeAt` says which of those it can place. A node
  // dropped here for want of a URL would be a resolution rule spelled twice.
  expect(
    worktreesOf({
      "_olai/Properties.org": declaring(WORKTREE_TYPE),
      "board.org": rec("node-a", "the seam", { worktree: "/srv/checkout" }),
    }),
  ).toEqual([{
    node: "node-a",
    title: "the seam",
    value: "/srv/checkout",
    prUrl: undefined,
  }])
})

test("a vault that declares NOTHING gets the claim, on the key that carries odu's name", () => {
  // THE HUMAN'S RULING: enabling a plugin is the whole of turning its faces on,
  // and nothing writes anybody's vault to do it. The kind claims the key equal
  // to its own composed word.
  expect(
    worktreesOf({
      "board.org": rec("node-a", "the seam", { [WORKTREE_TYPE]: ".worktrees/a" }),
    }),
  ).toEqual([{ node: "node-a", title: "the seam", value: ".worktrees/a", prUrl: undefined }])
})

test("...and a PERSON'S OWN `worktree` column is never captured by enabling a plugin", () => {
  // The reason the word is prefixed. This board is the live one: its own
  // `worktree` column is declared `path` and means a directory on the
  // orchestrator's machine. A plugin that could take that over by being switched
  // on would be pointing a socket dial at a value nobody offered it.
  expect(
    worktreesOf({
      "board.org": rec("node-a", "the seam", { worktree: ".worktrees/a" }),
    }),
  ).toEqual([])
})

test("...and the SHORT key is one vault row away — the user's key, the plugin's kind", () => {
  expect(
    worktreesOf({
      "_olai/Properties.org": declaring(WORKTREE_TYPE, "worktree"),
      "board.org": rec("node-a", "the seam", { worktree: ".worktrees/a" }),
    }),
  ).toEqual([{ node: "node-a", title: "the seam", value: ".worktrees/a", prUrl: undefined }])
})

test("...and neither does one that declares the claimed key something else", () => {
  expect(
    worktreesOf({
      "_olai/Properties.org": declaring("text", WORKTREE_TYPE),
      "board.org": rec("node-a", "the seam", { [WORKTREE_TYPE]: ".worktrees/a" }),
    }),
  ).toEqual([])
})

test("a key declared `path` is NOT a worktree, which is the whole reason this kind exists", () => {
  // `brief` is a `path` too, on the very same rows. The licence used to be
  // "declared `path`" joined to the hardcoded key name `worktree`, which could
  // not tell a checkout from a document and could not have been asked about a
  // key called anything else.
  expect(
    worktreesOf({
      "_olai/Properties.org": declaring("path"),
      "board.org": rec("node-a", "the seam", { worktree: ".worktrees/a" }),
    }),
  ).toEqual([])
})

test("a key called anything at all is a worktree if the vault declares it one", () => {
  // THE REVERSAL, said as a case: the face follows the DECLARED KIND, so a
  // board whose column is `checkout` is probed and a board that declares
  // nothing is not — however many properties it happens to call `worktree`.
  expect(
    worktreesOf({
      "_olai/Properties.org": declaring(WORKTREE_TYPE, "checkout"),
      "board.org": rec("node-a", "the seam", { checkout: "/srv/x", worktree: "/srv/decoy" }),
    }),
  ).toEqual([{ node: "node-a", title: "the seam", value: "/srv/x", prUrl: undefined }])
})

test("a record with no `worktree` is not one, declaration or not", () => {
  expect(
    worktreesOf({
      "_olai/Properties.org": declaring(WORKTREE_TYPE),
      "board.org": rec("plain", "an ordinary bullet", { agent: "claude-opus" }),
    }),
  ).toEqual([])
})

test("a MIRROR is skipped — its target carries the property and is in the same walk", () => {
  // A placement holds no properties of its own, so asking it would be asking
  // the wrong record; two rows probing one checkout would also be two dials of
  // one socket.
  const named = worktreesOf({
    "_olai/Properties.org": declaring(WORKTREE_TYPE),
    "board.org": [
      rec("node-a", "the seam", { worktree: ".worktrees/a" }),
      `{"id":"m","ord":"a1","mirror":"node-a"}`,
    ].join("\n"),
  })
  expect(named.map((one) => one.node)).toEqual(["node-a"])
})
