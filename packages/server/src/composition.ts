/** Scoped Surface composition: a host root, and every capability beside it.
 *
 * Storage and handler lifetimes remain the framework's: every provider mounts
 * as a generation-isolated sibling, with its own sources, revocation and async
 * drop. What this adds is the FACE table — which of a sibling's members each
 * face may reach, under the sibling's own `surface/<name>/` prefix — and the
 * write-attribution list beside it.
 *
 * ## EVERY MEMBER HAS ONE TAG, and it names its owner
 *
 * This file used to hold a second routing table. Nine capabilities registered
 * `root: true`, which kept each of their members answering under a BARE tag as
 * well — `surface/edit/apply` beside `surface/outlines/edit/apply` — because
 * those tags were the monolith's before the rows were pulled out of it. Six
 * rows then shared `surface/edit/apply` and `surface/ops/run`, so the bare tag
 * needed an envelope that picked an owner by a payload field, the envelope
 * needed every owner to agree on that field and to claim disjoint values, and
 * the mount check needed five refusals to establish what the envelope assumed.
 * Roughly half of this module was that machinery.
 *
 * It is gone, and #546 is why: one member reachable under two names is one
 * permission typed in two places, and the second place was a hand-written table
 * in `@olai/bundle` that no row could edit. Outlines answers
 * `surface/outlines/edit/apply`, markdown answers `surface/markdown/edit/apply`,
 * and there is nothing left at composition to prove about whose variant is
 * whose. A capability's tags are disjoint from every other capability's by
 * CONSTRUCTION now, because the prefix is its mount name and kolu already
 * refuses two mounts under one name.
 *
 * ## NOTHING HERE REFUSES IN WORDS
 *
 * `mount` THROWS. Its caller is the composition root's `recompose`
 * (`./runtime.ts`) and never a wire client, and everything it refuses is a fact
 * about the BINARY rather than about the machine or the request: a capability
 * naming a write tag it does not declare, or a face map naming a member its own
 * spec does not have. There is nobody to hand a typed refusal to and nothing a
 * running serve could do with one — the disagreement was true before the
 * process started and will be true after it restarts. What the throw does buy
 * is that an invalid mount acquires NOTHING: every check runs before
 * `runtime.mount`, so a refused capability leaves the roster exactly as it was
 * (`./composition.test.ts`, "an invalid exposure acquires no partial surface").
 */
import { isReservedSurfaceTag, type Surface, type SurfaceSpec } from "@kolu/surface/define"
import { exposeFace, type ExposeMap, type FaceExposure } from "@kolu/surface/expose"
import { emptyHandlers, implementRootedSurfaces, type ImplementSurfaceDeps, type SurfaceHandlers } from "@kolu/surface/server"

export function composeCapabilities<const S extends SurfaceSpec>(
  root: Surface<S>,
  deps: ImplementSurfaceDeps<S>,
  rootFaces: Readonly<Record<string, ExposeMap<S>>>,
) {
  const runtime = implementRootedSurfaces(root, {}, deps)
  const mounts = new Map<string, {
    readonly surface: Surface<SurfaceSpec>
    readonly writes: ReadonlyArray<string>
    readonly faces: Readonly<Record<string, ExposeMap<SurfaceSpec>>>
  }>()
  let group = runtime.group
  let handlers = runtime.handlers
  let faces: Readonly<Record<string, FaceExposure>> = {}

  /**
   * ONE GENERATION, MINTED WHOLE, EVERY TIME — never patched.
   *
   * The three things this composer publishes are three views of one table:
   * `group` (the RPC descriptors), `handlers` (the record that answers them)
   * and `faces` (each face's grant, carrying `universe` — the set it was built
   * from). They are assigned together at the tail of this function, out of a
   * `next` filled in the same pass, which is the only reason they cannot
   * disagree.
   *
   * A PATCH WOULD BE REFUSED AS A SOCKET, not as a member. kolu's
   * `restrictHandlers` compares an exposure's `universe` with the group it is
   * asked to gate as a set EQUALITY and THROWS on any difference, and
   * `restrictServedGeneration` runs it at every accept as well as at bind — so
   * a `handlers` record updated for a departed sibling while `faces` still
   * described it does not deny that member, it terminates the connection. The
   * failure is not local to the mistake either: every tab of every other tenant
   * of this wire is refused at the handshake, with a message about a tag nobody
   * asked for. `./runtime.test.ts`'s "the browser gate names exactly what the
   * group serves, and is one value per generation" holds the pairing through
   * the same call the transport makes.
   *
   * IT IS ALSO THE CHEAPER SHAPE TO BE RIGHT ABOUT. The runtime underneath
   * already re-claims every tag across the root and all siblings on every mount
   * and drop — kolu's `implementRootedSurfaces` calls that proof full rather
   * than incremental on purpose — so an incremental republish here would be a
   * second, weaker discipline layered over one that already pays for itself.
   * What survives a recompose is STATE, not work: a sibling that did not move
   * keeps its handler values, stores, channels and running sources, because
   * `runtime.handlers[tag]` hands back the same function object.
   */
  const rebuild = () => {
    const next: SurfaceHandlers = emptyHandlers()
    for (const tag of runtime.group.requests.keys()) next[tag] = runtime.handlers[tag]!
    const universe = new Set(Object.keys(next))
    const grants = new Map<string, Set<string>>()
    const add = (key: string, exposure: FaceExposure, prefix: string) => {
      let tags = grants.get(key)
      if (!tags) grants.set(key, tags = new Set())
      for (const tag of exposure.tags) tags.add(prefix + tag.slice("surface/".length))
    }
    for (const [key, map] of Object.entries(rootFaces)) add(key, exposeFace(root, map), "surface/")
    for (const [name, one] of mounts) {
      // A CAPABILITY'S GRANT IS ALWAYS UNDER ITS OWN NAME. There is no second
      // prefix to choose between any more, which is the whole of #546 at this
      // line: `faces` and `scopedFaces` used to be the bare grant and the
      // qualified one, and a member could be on one and not the other.
      for (const [key, map] of Object.entries(one.faces)) add(key, exposeFace(one.surface, map), `surface/${name}/`)
    }
    // Publish one coherent generation after every descriptor and handler agrees
    // — these three assignments are the whole reason `rebuild` is not a patch;
    // the paragraph above the function argues what a mixed generation costs.
    group = runtime.group
    handlers = next
    faces = Object.fromEntries([...grants].map(([key, tags]) => [key, { universe, tags }]))
  }
  rebuild()
  return {
    get group() { return group },
    get handlers() { return handlers },
    get faces() { return faces },
    get roster() { return runtime.roster },
    /**
     * WHICH TAGS RECORD A WRITER, each under its owner's scoped name.
     *
     * This list is not a permission, it is an ATTRIBUTION table:
     * `@olai/plugin-api`'s `authorityAt` wraps exactly these tags to provide
     * `RequestAuthority` — the caller's writer and its session rule — and leaves every
     * other handler's identity untouched. A tag left off it does not refuse, it
     * runs on the Context default, `{ writer: "web" }`, with no session rule.
     *
     * A capability declares the tag as its OWN surface spells it — `writes:
     * ["surface/ops/run"]`, checked against that capability's own group in
     * `mount` below — and this getter is the one place that becomes
     * `surface/outlines/ops/run`. Four rows declaring the identical string is
     * four rows each naming their own member, not a shared claim.
     *
     * This used to emit a PAIR per root mount, the bare tag beside the scoped
     * one, because both reached the same handler and attribution had to hold on
     * whichever door was used. With one tag per member there is one entry, and
     * no way left to launder a write through the other name.
     * `./composition.test.ts` asserts the scoped form.
     */
    get writes() { return [...new Set([...mounts].flatMap(([name, one]) =>
      one.writes.map(tag => `surface/${name}/${tag.slice("surface/".length)}`)))] },
    ctx: runtime.ctx,
    done: runtime.done,
    close: runtime.close,
    mount<const T extends SurfaceSpec>(name: string, surface: Surface<T>, deps: ImplementSurfaceDeps<T>, options: {
      readonly writes?: ReadonlyArray<string>
      readonly faces?: Readonly<Record<string, ExposeMap<T>>>
    } = {}) {
      for (const tag of options.writes ?? []) {
        if (!surface.group.requests.has(tag) || isReservedSurfaceTag(tag)) {
          throw new Error(`Capability "${name}" declares an unknown write tag "${tag}"`)
        }
      }
      // Validate exposure before mount: an invalid grant must acquire nothing.
      for (const map of Object.values(options.faces ?? {})) exposeFace(surface, map)
      const mounted = runtime.mount(name, surface, deps)
      mounts.set(name, { surface, writes: options.writes ?? [], faces: options.faces ?? {} } as {
        surface: Surface<SurfaceSpec>, writes: ReadonlyArray<string>, faces: Readonly<Record<string, ExposeMap<SurfaceSpec>>>
      })
      // THE REGISTRATION OBJECT IS THE GENERATION'S IDENTITY, held so `drop`
      // can compare it. The map is keyed by NAME, and a name is reusable — a
      // plugin switched off and on again mounts under the same word — so
      // `mounts.delete(name)` on its own would let a stale handle delete
      // somebody else's mount. The holder of a dropped mount is not
      // hypothetical here: `./runtime.ts` keeps a departing mount's drain in
      // `leaving` and defers a same-key arrival behind it, so a late `drop()`
      // landing after the successor has mounted is the ordinary shape of a
      // flip, not a mistake. What it would take away is the successor's row
      // from the face table while the successor's own fibers went on running —
      // a capability that is composed and unreachable, with nothing failing.
      //
      // Identity rather than a generation counter for the reason kolu gives
      // `MountedSurface.drop` one wall down: the mount handle IS the right to
      // retract, so a holder can retract its own sibling and cannot retract a
      // stranger's, and a stale holder's `drop()` is a no-op instead.
      const registration = mounts.get(name)!
      rebuild()
      return {
        ...mounted,
        drop: () => {
          const dropping = mounted.drop()
          if (mounts.get(name) === registration) {
            mounts.delete(name)
            rebuild()
          }
          return dropping
        },
      }
    },
  }
}
