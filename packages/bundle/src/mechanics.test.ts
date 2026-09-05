/**
 * THE FALSIFIER, kept as a test — olai names no wire MECHANICS.
 *
 * This file exists because a socket that was cut right can be re-cut wrong one
 * convenient line at a time, and nothing else in the tree would notice. It is
 * the acceptance test that travelled with olai's upstream ask (the seventh
 * lowy-electricity sitting, 2026-08-30), written down where it runs instead of
 * where it was agreed:
 *
 * > if any of `createSurfaceSocket` / `createLiveSignal` / `surfaceClientsHealth`
 * > / `createSurfaceReadout` / `fuseGroups` / `fuseFaces` survives in olai app
 * > code as MECHANICS after the seam lands, the socket was cut wrong.
 *
 * Six names, two provenances, one claim. The first four are `@kolu/surface`'s
 * own primitives, which olai chained by hand for one PR window because the
 * turnkey seam could not carry an unprefixed root; the last two are the helpers
 * olai wrote in this very package to fuse a sibling bundle onto its own surface.
 * juspay/kolu#2222 made all six unnecessary in one move — `connectSurfaces` grew
 * a `core` slot, and `mergeDisjointGroups` / `exposeRootedFaces` arrived beside
 * it — so an app that still spells one has either rebuilt a seam it was handed
 * or kept a copy of a proof the framework now performs.
 *
 * ## What "as mechanics" means, and why the sweep is of CALLS
 *
 * PROSE MAY NAME THEM. The whole argument for the arrangement is written in
 * `@olai/web`'s `wire.ts` header and in `@olai/server`'s `runtime.ts`, and a
 * sweep that forbade the words would be a sweep that deleted its own reasons —
 * the same trap `@olai/web`'s `claims.test.ts` names about `connectSurface`. So
 * the pattern hunts a CALL: the identifier followed by an open paren, which is
 * what "spelled as mechanics" actually looks like. A `{@link fuseGroups}` in a
 * comment is not a call and does not trip it.
 *
 * The sweep is DELIBERATELY DUMB about comments — it reads the file as text and
 * strips nothing — and the cost is one small rule on prose: do not write one of
 * these names with a paren straight after it, even inside a comment. That rule
 * is worth its inconvenience, because the alternative is a comment-stripping
 * pass, and a stripper that gets a string literal wrong (`"http://…"`, a `*​/`
 * inside a quote) removes the rest of a line — which is a FALSE NEGATIVE, the
 * one direction a falsifier may never fail in. A spurious failure is loud, is
 * fixed by rewording a sentence, and leaves the proof intact.
 *
 * ## Why the sweep is REPO-WIDE and lives here
 *
 * The four framework primitives were only ever reachable from `@olai/web`, and
 * its own claims sweep counts the seam call there. These two were `@olai/plugin-api`'s
 * exports, and a re-copy of them could land in `@olai/server`, in a plugin
 * package, or back here — so the claim has to be about every package or it is
 * about nothing. This is the package they lived in, which makes it the package
 * that owes the proof they are gone.
 *
 * The walk is every WORKSPACE MEMBER, whole — `./tree.testlib.ts`'s `MEMBERS`
 * and `sourcesUnder`, which is where the corpus rules live now. It was
 * `packages/*​/src` behind a one-level `readdir`, and the appliance fold made
 * both halves of that wrong: the tenants nest, so the readdir keyed their files
 * under `plugins`, and a package's sources are not all under `src` — `@olai/tests`
 * has none at all, which is the hole the fence's own header records. `node_modules`
 * stays out for the obvious reason (the framework is where these functions are
 * DEFINED and called, and a sweep that read the hydrated kolu sources would fail
 * on the first line of `connectSurfaces` itself) — and it stays out by `Bun.Glob`
 * declining to follow a symlinked directory rather than by a prune written here.
 */

import { readFileSync } from "node:fs"
import * as path from "node:path"

import { expect, test } from "bun:test"

import { MEMBERS, PACKAGES, sourcesUnder } from "./tree.testlib.ts"


/** This file, which quotes every name it forbids. Excluded by PATH rather than
 *  by a comment-stripping pass, because a sweep clever enough to know which of
 *  its own words are quotations is a sweep with a second bug. */
const SELF = path.relative(PACKAGES, import.meta.filename)

/**
 * THE SIX. Ordered as the falsifier orders them — the framework's four, then
 * olai's two — so the list reads as the ruling it is a copy of.
 *
 * A name is added here when the framework absorbs a mechanic olai used to
 * spell, and never removed to make a diff pass: a name on this list is a
 * capability somebody argued for upstream and got.
 */
const MECHANICS: ReadonlyArray<string> = [
  // `@kolu/surface-app` / `@kolu/surface`, chained by hand while the turnkey
  // seam could not carry a root. `connectSurfaces` wires all four.
  "createSurfaceSocket",
  "createLiveSignal",
  "surfaceClientsHealth",
  "createSurfaceReadout",
  // ...and `@olai/plugin-api`'s own, retired by `mergeDisjointGroups` and
  // `exposeRootedFaces` respectively.
  "fuseGroups",
  "fuseFaces",
  // ...and the FIVE the composition root spelled to fuse a root with a sibling
  // bundle, retired by `implementRootedSurfaces` (juspay/kolu#2223). `runtime.ts`
  // called `implementSurface` for the root, `implementSurfaces` over a keyed map
  // of every sibling, `mergeDisjointGroups` to fuse the two groups, a
  // `{...a, ...b}` spread with `assertHandlersMatchGroup` after it, and
  // `superviseTerminalSource` to fold the two runtimes' supervision. The spread
  // is the one worth naming: a handler record is keyed by nothing but tags, so
  // it is a last-writer-wins merge with the same silence `RpcGroup.merge` has,
  // and the assertion after it proved the route SET rather than which side won a
  // shared tag. The framework counts both axes.
  //
  // `implementSurface` and `implementSurfaces` are NOT on this list, and their
  // absence is deliberate rather than an oversight: both are still the right
  // door for a surface that is not a rooted bundle, and the tests in this
  // package that ask what a standalone or a fixed sibling map composes to are
  // asking a real question about the framework. What olai's own composition
  // root may not do is spell the FUSION, and these three are that fusion.
  "mergeDisjointGroups",
  "assertHandlersMatchGroup",
  "superviseTerminalSource",
]

/** Every MEMBER's own sources, root-relative, so a failure reads as a path
 *  somebody can open.
 *
 *  The walk and the member list are `./tree.testlib.ts`'s. This file used to
 *  carry its own copy of both — the same recursion, the same `node_modules`
 *  argument, written twice in one package with no wall between them — beside a
 *  one-level `readdirSync(PACKAGES)` which the appliance fold's nesting turned
 *  into a reading that keys a tenant's files under `plugins` rather than under
 *  its package. Sharing a READER is not sharing a CLAIM: the six names below
 *  and the equality they are held to are this file's alone, which is what its
 *  header means by owing the proof. */
const SOURCES: ReadonlyArray<{ file: string; code: string }> = MEMBERS
  .flatMap((member) => sourcesUnder(path.join(PACKAGES, member)))
  .filter((full) => /\.tsx?$/.test(full))
  .map((full) => ({ file: path.relative(PACKAGES, full), code: readFileSync(full, "utf8") }))
  .filter((one) => one.file !== SELF)

/**
 * THE SITES THAT MAY STILL DIAL RAW, and the reason they are not the seam
 * coming back.
 *
 * These are NODE-side benches that stand a real olai server up and speak to it
 * over a real websocket, which is the whole of what they are for: one asks what
 * the browser FACE refuses as deployed, the other what the upgrade's identity
 * headers reach; the profile bench tests transport removal and recovery.
 * The turnkey seam is `@kolu/surface-app/solid` — it mints memos
 * and wants a reactive owner — so it is not a thing a bun test running under
 * node resolution can call, and routing these through it would replace the
 * subject (a socket at a listener) with a different one (a Solid client bundle).
 *
 * Written as an EQUALITY below rather than as an exclusion pattern, so a third
 * site is a failure naming itself. Adding a line here is a decision somebody
 * makes on purpose; a glob that said `*.test.ts` would have let the seam back in
 * through any file with `test` in its name.
 */
const HARNESSES: ReadonlyArray<string> = [
  "createSurfaceSocket @ server/src/faces.test.ts",
  "createSurfaceSocket @ server/src/who.test.ts",
  "createSurfaceSocket @ server/src/profiles.test.ts",
]

// A LIST, not a boolean, and one test rather than six: what a reader of a
// failure needs is which mechanic came back and in which file, and six tests
// that each say "false" would report the first one and stop.
test("no olai source calls a wire mechanic the framework performs", () => {
  const found = MECHANICS.flatMap((name) => {
    const call = new RegExp(`\\b${name}\\s*\\(`)
    return SOURCES.filter((one) => call.test(one.code)).map((one) => `${name} @ ${one.file}`)
  })
  expect(found.sort()).toEqual([...HARNESSES].sort())
})

// ...and the other direction, which is what stops the case above from passing
// on a tree that simply deleted the wire: the mechanics are gone BECAUSE the
// seam that performs them is called. Which file calls it is `@olai/web`'s own
// claim to keep (`client/claims.test.ts` — "the only file in the client that
// knows a websocket exists"); what this one asks is that there is exactly one.
test("...because the seam that performs them is called, exactly once", () => {
  const seam = SOURCES.filter((one) => /\bconnectSurfaces\s*\(/.test(one.code))
  expect(seam.map((one) => one.file)).toHaveLength(1)
})
