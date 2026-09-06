/** Scoped Surface composition with optional unprefixed capability contracts.
 *
 * Storage and handler lifetimes remain the framework's: every provider mounts
 * as a generation-isolated sibling, with its own sources, revocation and async
 * drop. Only the public routing table is adapted. A capability can preserve an
 * existing standalone wire contract without making that contract permanent.
 * Reserved system members remain the host's at the root; each sibling retains
 * its own reserved members. Collisions are rejected before acquiring a mount.
 */
import { isReservedSurfaceTag, type Surface, type SurfaceSpec } from "@kolu/surface/define"
import { exposeFace, type ExposeMap, type FaceExposure } from "@kolu/surface/expose"
import { emptyHandlers, implementRootedSurfaces, type ImplementSurfaceDeps, type SurfaceHandlers } from "@kolu/surface/server"
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
  }>()
  let group = runtime.group
  let handlers = runtime.handlers
  let faces: Readonly<Record<string, FaceExposure>> = {}

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
      const alias = renamed.get(tag) ?? tag
      if (Object.hasOwn(next, alias) && !routes.has(alias)) throw new Error(`Surface tag collision: ${alias}`)
      next[alias] = runtime.handlers[tag]!
      rpcs.set(alias, renamed.has(tag) ? publicRpcs.get(alias)! : rpc)
    }
    for (const [tag, branches] of routes) {
      // Capture this generation's revoked handlers, never a live lookup that
      // could let an old connection reach a replacement provider.
      const cases = new Map(branches.flatMap(({tag, dispatch}) =>
        dispatch.cases.map(value => [value, runtime.handlers[tag]!] as const)))
      const field = branches[0]!.dispatch.field
      next[tag] = (input: unknown) => {
        const value = input && typeof input === "object" ? (input as Record<string, unknown>)[field] : undefined
        const handler = typeof value === "string" ? cases.get(value) : undefined
        return handler ? handler(input) : Effect.die(new Error(`No active capability handles ${tag} ${field}=${String(value)}`))
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
    }
    // Publish one coherent generation after every descriptor and handler agrees.
    group = RpcGroup.make(...rpcs.values())
    handlers = next
    faces = Object.fromEntries([...grants].map(([key, tags]) => [key, { universe, tags }]))
  }
  rebuild()
  return {
    get group() { return group },
    get handlers() { return handlers },
    get faces() { return faces },
    get roster() { return runtime.roster },
    get writes() { return [...new Set([...mounts].flatMap(([name, one]) =>
      one.writes.map(tag => one.root ? tag : `surface/${name}/${tag.slice("surface/".length)}`)))] },
    ctx: runtime.ctx,
    done: runtime.done,
    close: runtime.close,
    mount<const T extends SurfaceSpec>(name: string, surface: Surface<T>, deps: ImplementSurfaceDeps<T>, options: {
      readonly root?: boolean
      readonly writes?: ReadonlyArray<string>
      readonly dispatch?: Readonly<Record<string, Dispatch>>
      readonly faces?: Readonly<Record<string, ExposeMap<T>>>
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
      for (const map of Object.values(options.faces ?? {})) exposeFace(surface, map)
      const mounted = runtime.mount(name, surface, deps)
      mounts.set(name, { surface, root: options.root ?? false, writes: options.writes ?? [], dispatch: options.dispatch ?? {}, faces: options.faces ?? {} } as {
        surface: Surface<SurfaceSpec>, root: boolean, writes: ReadonlyArray<string>, dispatch: Readonly<Record<string, Dispatch>>, faces: Readonly<Record<string, ExposeMap<SurfaceSpec>>>
      })
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
