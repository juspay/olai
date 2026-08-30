/**
 * COMPOSITION — how core serves its own surface AND every enabled plugin's,
 * over one transport, without ever spelling a plugin's member.
 *
 * ## Core does not become a sibling
 *
 * The obvious reading of `composeSurfaceContracts` is that everything becomes
 * a sibling and core's tags gain a segment — `surface/olai/outlines/get` where
 * they said `surface/outlines/get`. That would move an address an MCP client
 * already writes, every tag assertion in the suite, and every accessor in the
 * browser, and it is NOT what the framework requires. It was tried and
 * measured: core keeps `implementSurface` and its tags are byte-unchanged; the
 * plugins go through `implementSurfaces`, which prefixes each at
 * `surface/<key>/`; and the two are FUSED.
 *
 * The fusion is safe by construction rather than by luck. A core tag has three
 * segments (`surface/<member>/<verb>`) and a sibling tag has four
 * (`surface/<key>/<member>/<verb>`), and `assertTagSegment` forbids a `/`
 * inside any name — so the two sets cannot intersect. {@link fuseGroups}
 * asserts it anyway, because the merge underneath is a last-writer-wins
 * `Map.set` that would drop a collision silently, and a proof that rests on an
 * argument nobody re-checks is the class of thing this repo keeps turning into
 * a test.
 *
 * ## What the framework does not supply, and is therefore here
 *
 * Two small things, both named rather than quietly worked around:
 *
 *   - **no union constructor for `FaceExposure`.** There is `exposeFace` for a
 *     standalone surface and `exposeFaces` for a sibling bundle, and nothing
 *     that takes both. `FaceExposure` is documented as a structural interface
 *     and `restrictHandlers` documents a hand-assembled one as a supported
 *     argument, so {@link fuseFaces} is a supported spelling and not a
 *     reach-around. It matters that this is loud when wrong:
 *     `restrictHandlers` demands the exposure's universe EQUAL the served
 *     group's tags, so a face that forgot the plugins refuses to boot naming
 *     every tag it cannot describe.
 *   - **no group merge that proves disjointness.** `group.merge(other)` is the
 *     framework's own spelling and it counts nothing; the counted assembly is
 *     module-private. `@kolu/surface-app`'s own `connectSurfaces` re-implements
 *     the same count for the browser, which is the precedent this follows.
 *
 * ## What a DISABLED plugin is here
 *
 * Absent from the record. `composeSurfaceContracts` and `implementSurfaces`
 * take a plain object, so `--plugins` is a filter over it and nothing else —
 * an unenabled plugin contributes no tag, no handler and no expose row, and
 * the wire simply has no `surface/<name>/` on it. That is the same absent
 * state a machine without the tool shows, and it costs no mechanism: it is
 * data the composition already takes.
 */

import type { FaceExposure } from "@kolu/surface/expose"
import {
  assertHandlersMatchGroup,
  type SurfaceHandlers,
  type SurfaceRuntimeHandle,
} from "@kolu/surface/server"

/** The group, as the only two things this module asks of one: what tags it
 *  carries, and how to take another one on.
 *
 *  Named off `SurfaceRuntimeHandle` rather than imported from `@effect/rpc`
 *  deliberately — the RPC library is the framework's dependency and not
 *  olai's, and a package that reached past `@kolu/surface` for a type would be
 *  a package with an opinion about which RPC library the framework uses. */
type Served = SurfaceRuntimeHandle<unknown>["group"]

/** Two groups as one, with the count as the proof.
 *
 *  `merge` is a last-writer-wins `Map.set` — the framework says so about
 *  itself, in the paragraph explaining why sibling composition prefixes rather
 *  than merges. A dropped tag is therefore silent, and a silent dropped tag is
 *  a member that answers nothing with nobody told. The size check is the whole
 *  of the difference between a merge and a proof. */
export const fuseGroups = (core: Served, plugins: Served): Served => {
  const fused = core.merge(plugins) as Served
  const expected = core.requests.size + plugins.requests.size
  if (fused.requests.size !== expected) {
    throw new Error(
      `plugins: composing the plugin surfaces onto olai's dropped ${
        expected - fused.requests.size
      } wire tag(s) — a core member and a plugin sibling claimed one address, `
        + `which merge resolves silently in favour of whichever was written last.`,
    )
  }
  return fused
}

/** ...and the two handler records, with the same proof said the other way.
 *
 *  Spread would be enough if the groups agree, which {@link fuseGroups} has
 *  just established — but the handler record is what actually ANSWERS, so it
 *  is checked against the fused group rather than against the argument that
 *  the fused group is right. `assertHandlersMatchGroup` is the framework's own
 *  door for exactly that, and it names both directions: a tag with no handler,
 *  and a handler at a tag the group never minted. */
export const fuseHandlers = (
  group: Served,
  core: SurfaceHandlers,
  plugins: SurfaceHandlers,
): SurfaceHandlers => {
  const fused: SurfaceHandlers = { ...core }
  for (const [tag, handler] of Object.entries(plugins)) {
    if (tag in fused) {
      throw new Error(
        `plugins: two handlers claim the wire tag "${tag}" — one of olai's own `
          + `and one a plugin contributed.`,
      )
    }
    fused[tag] = handler
  }
  assertHandlersMatchGroup(group, fused, "plugins")
  return fused
}

/** One face over both — see the header for why the framework mints no such
 *  union and why hand-assembling one is nonetheless the supported spelling.
 *
 *  Both halves are unioned, and the `universe` half is the load-bearing one: it
 *  is what `restrictHandlers` compares against the served group, so a face
 *  built from core's exposure alone over a fused group is a boot-time refusal
 *  naming every plugin tag it could not describe — which is the right failure,
 *  and is why nothing here tries to be clever about a missing half. */
export const fuseFaces = (core: FaceExposure, plugins: FaceExposure): FaceExposure => ({
  universe: new Set([...core.universe, ...plugins.universe]),
  tags: new Set([...core.tags, ...plugins.tags]),
})
