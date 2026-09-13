/** Static carry contracts. Each app owns a table; each activation owns a scope. */
export interface Carried { readonly kind: string }
export interface Box { readonly top: number; readonly left: number; readonly bottom: number; readonly right: number }
export interface Receiver {
  /** A live document-coordinate box, including scrolling inside panes. */
  readonly lift: (carried: Carried) => Box | null
  readonly aim: (carried: Carried, x: number, y: number) => void
  readonly leave: () => void
  readonly drop: (carried: Carried, x: number, y: number) => Promise<string | null>
}
export interface Lifted { readonly receiver: Receiver; readonly box: Box }
export interface Landings {
  readonly register: (receiver: Receiver) => () => void
  readonly lift: (carried: Carried) => ReadonlyArray<Lifted>
  readonly standing: (receiver: Receiver) => boolean
}
export const createLandings = (): Landings => {
  const entries = new Map<Receiver, object>()
  return {
    register: receiver => {
      const token = {}
      entries.set(receiver, token)
      return () => {
        if (entries.get(receiver) !== token) return
        entries.delete(receiver)
        receiver.leave()
      }
    },
    lift: carried => [...entries.keys()].flatMap(receiver => {
      const box = receiver.lift(carried)
      return box === null ? [] : [{ receiver, box }]
    }),
    standing: receiver => entries.has(receiver),
  }
}
/** Registration wrappers make an old snapshot distinct from a replacement. */
export const scopedLandings = (table: Landings): Landings & { readonly dispose: () => void } => {
  const releases = new Set<() => void>()
  let disposed = false
  return {
    ...table,
    register: receiver => {
      if (disposed) return () => {}
      const release = table.register({ ...receiver })
      const stop = () => { releases.delete(stop); release() }
      releases.add(stop)
      return stop
    },
    dispose: () => { disposed = true; for (const stop of releases) stop() },
  }
}
export const innermost = (lifted: ReadonlyArray<Lifted>, x: number, y: number): Lifted | null => {
  let best: Lifted | null = null
  const area = (box: Box) => (box.right - box.left) * (box.bottom - box.top)
  for (const entry of lifted) {
    const b = entry.box
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) continue
    if (best === null || area(b) < area(best.box)) best = entry
  }
  return best
}
