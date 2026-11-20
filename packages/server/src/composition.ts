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
      for (const [key, map] of Object.entries(one.faces)) add(key, exposeFace(one.surface, map), `surface/${name}/`)
    }
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
      for (const map of Object.values(options.faces ?? {})) exposeFace(surface, map)
      const mounted = runtime.mount(name, surface, deps)
      mounts.set(name, { surface, writes: options.writes ?? [], faces: options.faces ?? {} } as {
        surface: Surface<SurfaceSpec>, writes: ReadonlyArray<string>, faces: Readonly<Record<string, ExposeMap<SurfaceSpec>>>
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
