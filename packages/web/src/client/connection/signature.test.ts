/**
 * WHEN A ROSTER FRAME IS A REDIAL, and when it is a frame to keep the wire for.
 *
 * This is the rule `../wire.ts` compares against on every roster publication.
 * The failure it exists for: a config edit on a row that is not
 * `configUpdates: "live"` restarts the row's server fiber, the serve drops its
 * surface sibling and mounts a fresh one, and the roster can come back with the
 * same names, the same state and the same config. A signature of names alone
 * called that unchanged, the tab kept its wire, and every standing
 * subscription on the page went quiet while the socket stayed open.
 *
 * Pure, so it needs neither a socket nor a browser.
 */

import { expect, test } from "bun:test"

import { remountedRows, signatureOf, type Named } from "./signature.ts"

const git = (generation?: number): Named => ({ id: "git", chunk: null, generation })

/** One roster row plus a field the signature is deliberately blind to. */
const kolu = (commit: string): Named & { readonly config: { readonly commit: string } } =>
  ({ id: "kolu", chunk: null, generation: 1, config: { commit } })

test("a config-only frame with the same mount generation does not redial", () => {
  // The row restarted its fiber for a config it handles itself ("live"), or a
  // republish said nothing new: the wire this tab holds is still the right one.
  // The second frame carries a CONFIG that differs, which is the field the
  // signature must ignore — a value the row handles itself is not a move.
  const first = kolu("manual")
  const second = kolu("auto")
  expect(signatureOf([git(3), first])).toBe(signatureOf([git(3), second]))
  expect(remountedRows([git(3), first], [git(3), second])).toEqual([])
})

test("a new mount generation redials that row", () => {
  expect(signatureOf([git(4)])).not.toBe(signatureOf([git(3)]))
})

test("a browser-half URL and a reordered roster are both in the signature", () => {
  // The URL is the module this build loads, so a different one is different
  // code. Order is the registry's and stable; a reorder is still a different
  // joined list, which is what the comparison is about.
  expect(signatureOf([{ id: "defined", chunk: "/_olai/plugins/defined-1.js", generation: 1 }]))
    .not.toBe(signatureOf([{ id: "defined", chunk: "/_olai/plugins/defined-2.js", generation: 1 }]))
  const one: Named = { id: "one", chunk: null, generation: 2 }
  const two: Named = { id: "two", chunk: null, generation: 1 }
  expect(signatureOf([one, two])).not.toBe(signatureOf([two, one]))
})

test("an older serve's absent generation reads as the first mount", () => {
  expect(signatureOf([{ id: "git", chunk: null }])).toBe(signatureOf([git(0)]))
})

test("a row the tab has not heard a generation for is not restarted on the first roster", () => {
  // The bootstrap selection a slow first frame races onto the roster names no
  // mount at all. That is "unknown", not "mount zero" — restarting every
  // plugin to answer it would throw away state for a roster that has not moved.
  expect(remountedRows([{ id: "git", chunk: null }], [git(1)])).toEqual([])
  // A generation the tab HAS seen moving is a remount.
  expect(remountedRows([git(1)], [git(2)])).toEqual(["git"])
  // A browser half served from a new URL is new code, whatever its mount says
  // — the latent bug this arm fixes: a vault-defined half was re-imported but
  // its old activation stayed mounted.
  expect(remountedRows(
    [{ id: "defined", chunk: "/_olai/plugins/defined-1.js" }],
    [{ id: "defined", chunk: "/_olai/plugins/defined-2.js" }],
  )).toEqual(["defined"])
})

test("no plugins is the empty signature", () => {
  expect(signatureOf([])).toBe("")
})
