/** Scoped Surface composition with optional unprefixed capability contracts.
 *
 * Storage and handler lifetimes remain the framework's: every provider mounts
 * as a generation-isolated sibling, with its own sources, revocation and async
 * drop. Only the public routing table is adapted. A capability can preserve an
 * existing standalone wire contract without making that contract permanent.
 * Reserved system members remain the host's at the root; each sibling retains
 * its own reserved members. Collisions are rejected before acquiring a mount.
 *
 * ## NOTHING HERE REFUSES IN WORDS, and the two ways it does not are different
 *
 * `mount` THROWS. Its caller is the composition root's `recompose`
 * (`./runtime.ts`) and never a wire client, and everything it refuses is a fact
 * about the BINARY rather than about the machine or the request: two
 * capabilities in this build disagreeing on a tag's contract, its exposure, its
 * write authority, or which variants each owns. There is nobody to hand a typed
 * refusal to and nothing a running serve could do with one — the disagreement
 * was true before the process started and will be true after it restarts. What
 * the throw does buy is that an invalid mount acquires NOTHING: every check
 * runs before `runtime.mount`, so a refused capability leaves the roster
 * exactly as it was (`./composition.test.ts`, "conflicting root tags and
 * invalid exposures acquire no partial surface").
 *
 * The per-request dispatch miss is `Effect.die` for a different reason: it
 * CANNOT be a typed failure. A procedure's `Rpc` declares its own error schema,
 * and "this variant belongs to a provider that is not here" is not one of the
 * failures any of them declares — putting it there would mean every member's
 * schema learning about mounting. So it rides the defect channel, which is
 * exactly where kolu puts its own two refusals (`SurfaceMemberNotExposed` and
 * `SurfaceSiblingDropped`), and `surfaceRpcServerLayer` serves with
 * `disableFatalDefects` so it reaches the one caller that asked and leaves
 * every other subscription on that connection flowing.
 */
import { isReservedSurfaceTag, type Surface, type SurfaceSpec } from "@kolu/surface/define"
import { exposeFace, type ExposeMap, type FaceExposure } from "@kolu/surface/expose"
import { emptyHandlers, implementRootedSurfaces, SurfaceSiblingDropped, type ImplementSurfaceDeps, type SurfaceHandlers } from "@kolu/surface/server"
import { Effect } from "effect"
import { RpcGroup, Rpc } from "effect/unstable/rpc"

export interface Dispatch {
  readonly field: string
  readonly cases: ReadonlyArray<string>
}

export function composeCapabilities<const S extends SurfaceSpec>(
  root: Surface<S>,
  deps: ImplementSurfaceDeps<S>,
  rootFaces: Readonly<Record<string, ExposeMap<S>>>,
) {
  const runtime = implementRootedSurfaces(root, {}, deps)
  const mounts = new Map<string, {
    readonly surface: Surface<SurfaceSpec>
    readonly root: boolean
    readonly writes: ReadonlyArray<string>
    readonly dispatch: Readonly<Record<string, Dispatch>>
    readonly faces: Readonly<Record<string, ExposeMap<SurfaceSpec>>>
    readonly scopedFaces: Readonly<Record<string, ExposeMap<SurfaceSpec>>>
  }>()
  let group = runtime.group
  let handlers = runtime.handlers
  let faces: Readonly<Record<string, FaceExposure>> = {}
  let dispatch: Readonly<Record<string, Dispatch>> = {}

  /**
   * ONE GENERATION, MINTED WHOLE, EVERY TIME — never patched.
   *
   * The four things this composer publishes are four views of one table:
   * `group` (the RPC descriptors), `handlers` (the record that answers them),
   * `faces` (each face's grant, carrying `universe` — the set it was built
   * from) and `dispatch` (which variants of a shared tag are live). They are
   * assigned together at the tail of this function, out of `next` and `rpcs`
   * filled in the same pass, which is the only reason they cannot disagree.
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
    const renamed = new Map<string, string>()
    const publicRpcs = new Map(root.group.requests)
    const routes = new Map<string, Array<{ tag: string, dispatch: Dispatch }>>()
    for (const [name, one] of mounts) {
      if (!one.root) continue
      for (const [tag, rpc] of one.surface.group.requests) {
        if (isReservedSurfaceTag(tag)) continue
        const scoped = `surface/${name}/${tag.slice("surface/".length)}`
        renamed.set(scoped, tag)
        publicRpcs.set(tag, rpc)
        const dispatch = one.dispatch[tag]
        if (dispatch) {
          const held = routes.get(tag) ?? []
          held.push({ tag: scoped, dispatch })
          routes.set(tag, held)
        }
      }
    }
    const next: SurfaceHandlers = emptyHandlers()
    const rpcs = new Map<string, typeof root.group.requests extends ReadonlyMap<string, infer R> ? R : never>()
    for (const [tag, rpc] of runtime.group.requests) {
      // Keep the provider's own contract for scoped clients. Compatibility
      // aliases are additional routes, never the browser's permanent spec.
      next[tag] = runtime.handlers[tag]!
      rpcs.set(tag, rpc)
      const alias = renamed.get(tag)
      if (alias) {
        // A SECOND WRITER OF ONE BARE TAG IS A COLLISION UNLESS THE TAG IS
        // DISPATCHED, and the `routes.has` half is what makes that distinction
        // rather than a hole in the guard. Every root mount aliases its scoped
        // handler onto the bare tag, so `outlines`, `markdown` and `pins` all
        // writing `surface/edit/apply` here is the ordinary case: the loop over
        // `routes` below replaces that entry with the envelope that picks an
        // owner by field, so whichever of them wrote it last is overwritten
        // before anything can read it. With no dispatch there is no envelope
        // coming, and last-write-wins is the entire failure — one provider's
        // clients silently reach another provider's handler for a tag whose
        // contract they were promised, with nothing anywhere saying so.
        // `mount` already refuses that claim before acquiring anything; this is
        // the same law where the table is actually written, because `rebuild`
        // also runs on a DROP and no mount-time check covers what the survivors
        // then alias onto each other.
        if (Object.hasOwn(next, alias) && !routes.has(alias)) throw new Error(`Surface tag collision: ${alias}`)
        next[alias] = runtime.handlers[tag]!
        rpcs.set(alias, publicRpcs.get(alias)!)
      }
    }
    for (const [tag, branches] of routes) {
      // Capture this generation's revoked handlers, never a live lookup that
      // could let an old connection reach a replacement provider.
      const cases = new Map(branches.flatMap(({tag, dispatch}) =>
        dispatch.cases.map(value => [value, runtime.handlers[tag]!] as const)))
      // THE FIRST MOUNT'S FIELD IS EVERY MOUNT'S FIELD, and that is a fact
      // `mount` below establishes rather than one this line hopes for. A root
      // claim on an already-served tag is refused unless the newcomer and every
      // current owner both declare dispatch, and the owners' loop then rejects
      // `previous.field !== requested.field` by name — so a `branches` array
      // with two fields in it cannot be assembled. Insertion order into `mounts`
      // is the dispatch order, and `[0]` is simply the earliest surviving owner.
      //
      // ONE FIELD PER TAG IS NOT COSMETIC. What reads it downstream compares it
      // against a constant: `olai-plugin-mcp`'s `catalog.ts` advertises a tool
      // only when `dispatch?.field === field && dispatch.cases.includes(value)`
      // for its own hard-coded `"op"` or `"verb"`. A second field arriving on a
      // later branch would not be a wrong answer, it would be a silent one —
      // every tool projected through that tag disappears from the agent's list
      // with no refusal to read. `./capability-dispatch.test.ts` holds the same
      // agreement at build time, over every variant of `WriteRequest.op` and
      // `Edit.verb`, across every module the bundle has.
      const field = branches[0]!.dispatch.field
      // TWO DOORS ONTO ONE ENVELOPE, and the per-branch one is not redundant
      // with the shared one below it.
      //
      // A root mount is reachable at both its qualified tag and the bare one,
      // and the qualified tag carries the SHARED contract — the descriptor is
      // the provider's own `Rpc`, which describes every variant of the envelope
      // because the envelope is one schema — and `mount` below asserts every
      // owner's payload AST is the same object, so it is literally one schema.
      // Without this guard, `verb: "toggle"` sent to
      // `surface/markdown/edit/apply` lands on markdown's own handler carrying
      // an outline's verb — not a refusal, an APPLICATION, by a provider that
      // claimed only `doc` and `docNew` and has no reason to recognise the
      // rest. The browser is handed exactly those qualified
      // tags through `scopedFaces`, so this is the reachable case rather than a
      // hypothetical one (`./composition.test.ts`, "qualified clients retain
      // provider authority without duplicating agent exposure").
      //
      // The shared envelope cannot cover it: it routes by field to whoever owns
      // the value, which is the right answer for a caller that asked the bare
      // tag and the wrong one for a caller that named a provider.
      for (const branch of branches) {
        const handler = runtime.handlers[branch.tag]!
        next[branch.tag] = (input: unknown) => {
          const value = input && typeof input === "object" ? (input as Record<string, unknown>)[field] : undefined
          return typeof value === "string" && branch.dispatch.cases.includes(value)
            ? handler(input)
            : Effect.die(new SurfaceSiblingDropped({ key: `${branch.tag}[${field}=${String(value)}]`, at: { face: "wire", tag: branch.tag } }))
        }
      }
      next[tag] = (input: unknown) => {
        const value = input && typeof input === "object" ? (input as Record<string, unknown>)[field] : undefined
        const handler = typeof value === "string" ? cases.get(value) : undefined
        return handler ? handler(input) : Effect.die(new SurfaceSiblingDropped({ key: `${tag}[${field}=${String(value)}]`, at: { face: "wire", tag } }))
      }
    }
    const universe = new Set(Object.keys(next))
    const grants = new Map<string, Set<string>>()
    const add = (key: string, exposure: FaceExposure, prefix = "surface/") => {
      let tags = grants.get(key)
      if (!tags) grants.set(key, tags = new Set())
      for (const tag of exposure.tags) tags.add(prefix + tag.slice("surface/".length))
    }
    for (const [key, map] of Object.entries(rootFaces)) add(key, exposeFace(root, map))
    for (const [name, one] of mounts) {
      for (const [key, map] of Object.entries(one.faces)) {
        add(key, exposeFace(one.surface, map), one.root ? "surface/" : `surface/${name}/`)
      }
      for (const [key, map] of Object.entries(one.scopedFaces)) {
        add(key, exposeFace(one.surface, map), `surface/${name}/`)
      }
    }
    // Publish one coherent generation after every descriptor and handler agrees
    // — these four assignments are the whole reason `rebuild` is not a patch;
    // the paragraph above the function argues what a mixed generation costs.
    //
    // The published `cases` are the concatenation across branches in mount
    // order, which is the reading `olai-plugin-mcp`'s `catalog.ts` advertises
    // tools from: a write tool is offered only while some live owner claims its
    // variant. Concatenation is safe because `mount` refuses an overlap, so no
    // value can appear twice; `field` is `[0]`'s for the reason spelled at the
    // envelope above.
    dispatch = Object.fromEntries([...routes].map(([tag, branches]) => [tag, { field: branches[0]!.dispatch.field, cases: branches.flatMap(branch => branch.dispatch.cases) }]))
    group = RpcGroup.make(...rpcs.values())
    handlers = next
    faces = Object.fromEntries([...grants].map(([key, tags]) => [key, { universe, tags }]))
  }
  rebuild()
  return {
    get group() { return group },
    get handlers() { return handlers },
    get faces() { return faces },
    get dispatch() { return dispatch },
    get roster() { return runtime.roster },
    /**
     * WHICH TAGS RECORD A WRITER — a ROOT mount's under BOTH its bare tag and
     * its scoped one, a scoped mount's under the scoped tag alone.
     *
     * This list is not a permission, it is an ATTRIBUTION table:
     * `@olai/plugin-api`'s `authorityAt` wraps exactly these tags to provide
     * `RequestAuthority` — the caller's writer and its door — and leaves every
     * other handler's identity untouched. A tag left off it does not refuse, it
     * runs on the Context default, `{ writer: "web" }`, with no session door.
     *
     * So listing only the bare tag would not close the qualified door, it would
     * silence it: an agent's write through `surface/outlines/edit/apply` would
     * land with the browser's word in git's `X-Olai-Writer` trailer and with no
     * remaining write rule. Both tags reach the same handler —
     * the alias in `rebuild` is the same function object — so both must carry
     * the same attribution or the pair is a way to launder one.
     * `./composition.test.ts` asserts the pair, and asserts a mount that claims
     * a shared tag's exposure without claiming its write authority is refused.
     */
    get writes() { return [...new Set([...mounts].flatMap(([name, one]) =>
      one.writes.flatMap(tag => {
        const scoped = `surface/${name}/${tag.slice("surface/".length)}`
        return one.root ? [tag, scoped] : [scoped]
      })))] },
    ctx: runtime.ctx,
    done: runtime.done,
    close: runtime.close,
    mount<const T extends SurfaceSpec>(name: string, surface: Surface<T>, deps: ImplementSurfaceDeps<T>, options: {
      readonly root?: boolean
      readonly writes?: ReadonlyArray<string>
      readonly dispatch?: Readonly<Record<string, Dispatch>>
      readonly faces?: Readonly<Record<string, ExposeMap<T>>>
      readonly scopedFaces?: Readonly<Record<string, ExposeMap<T>>>
    } = {}) {
      for (const tag of options.writes ?? []) {
        if (!surface.group.requests.has(tag) || isReservedSurfaceTag(tag)) {
          throw new Error(`Capability "${name}" declares an unknown write tag "${tag}"`)
        }
      }
      for (const [tag, dispatch] of Object.entries(options.dispatch ?? {})) {
        if (!options.root || !surface.group.requests.has(tag) || isReservedSurfaceTag(tag) ||
          !dispatch.field || dispatch.cases.length === 0 || new Set(dispatch.cases).size !== dispatch.cases.length) {
          throw new Error(`Capability "${name}" declares invalid dispatch for "${tag}"`)
        }
      }
      // A SECOND CLAIM ON A BARE TAG IS JUDGED AGAINST THE PUBLISHED
      // GENERATION, and the five refusals below are what `rebuild` then gets to
      // assume: one field per tag, disjoint cases, one payload/success/error
      // AST, one exposure verdict per face, one write-authority verdict. Every
      // one of them is a promise the envelope and the alias table rest on, and
      // each is checked against `group.requests` and `mounts` as they STAND —
      // which is why `./runtime.ts` composes arrivals before it drops
      // departures, and says so where it does it.
      if (options.root) {
        for (const tag of surface.group.requests.keys()) {
          if (isReservedSurfaceTag(tag) || !group.requests.has(tag)) continue
          const requested = options.dispatch?.[tag]
          const owners = [...mounts].filter(([, one]) => one.root && one.surface.group.requests.has(tag))
          if (!requested || owners.length === 0 || owners.some(([, one]) => !one.dispatch[tag])) {
            throw new Error(`Capability "${name}" cannot claim already served tag "${tag}"`)
          }
          const rpc = surface.group.requests.get(tag)! as Rpc.AnyWithProps
          for (const [owner, one] of owners) {
            const previous = one.dispatch[tag]!
            const other = one.surface.group.requests.get(tag)! as Rpc.AnyWithProps
            const faceNames = new Set([...Object.keys(one.faces), ...Object.keys(options.faces ?? {})])
            for (const face of faceNames) {
              const before = one.faces[face] && exposeFace(one.surface, one.faces[face]!).tags.has(tag)
              const after = options.faces?.[face] && exposeFace(surface, options.faces[face]!).tags.has(tag)
              if (Boolean(before) !== Boolean(after)) {
                throw new Error(`Capabilities "${owner}" and "${name}" disagree on exposure of "${tag}" to "${face}"`)
              }
            }
            if (one.writes.includes(tag) !== (options.writes ?? []).includes(tag)) {
              throw new Error(`Capabilities "${owner}" and "${name}" disagree on write authority for "${tag}"`)
            }
            if (previous.field !== requested.field || previous.cases.some(value => requested.cases.includes(value))) {
              throw new Error(`Capabilities "${owner}" and "${name}" overlap dispatch cases for "${tag}"`)
            }
            if (rpc.payloadSchema.ast !== other.payloadSchema.ast || rpc.successSchema.ast !== other.successSchema.ast || rpc.errorSchema.ast !== other.errorSchema.ast) {
              throw new Error(`Capabilities "${owner}" and "${name}" disagree on the contract for "${tag}"`)
            }
          }
        }
      }
      // Validate exposure before mount: an invalid grant must acquire nothing.
      for (const map of [...Object.values(options.faces ?? {}), ...Object.values(options.scopedFaces ?? {})]) exposeFace(surface, map)
      const mounted = runtime.mount(name, surface, deps)
      mounts.set(name, { surface, root: options.root ?? false, writes: options.writes ?? [], dispatch: options.dispatch ?? {}, faces: options.faces ?? {}, scopedFaces: options.scopedFaces ?? {} } as {
        surface: Surface<SurfaceSpec>, root: boolean, writes: ReadonlyArray<string>, dispatch: Readonly<Record<string, Dispatch>>, faces: Readonly<Record<string, ExposeMap<SurfaceSpec>>>, scopedFaces: Readonly<Record<string, ExposeMap<SurfaceSpec>>>
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
      // from the alias table and its cases from the envelope, while the
      // successor's own fibers went on running — a capability that is composed
      // and unreachable, with nothing failing.
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
