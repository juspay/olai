import type { Channel, NotifyClick } from "./contract.ts"

type Claim = { readonly name: string; readonly deliver: (value: NotifyClick) => void }
export const createPresses = () => {
  const claimByKind = new Map<NotifyClick["kind"], Claim>()
  const pendingByKind = new Map<NotifyClick["kind"], NotifyClick>()
  let active = true
  const onPress: Channel["onPress"] = (kind, press) => {
    if (!active) return () => {}
    const name = press.name || "anonymous handler"
    const previous = claimByKind.get(kind)
    if (previous) throw new Error(`Notification kind "${kind}" is claimed by ${previous.name}; ${name} cannot claim it`)
    const claim: Claim = { name, deliver: value => press(value as Parameters<typeof press>[0]) }
    claimByKind.set(kind, claim)
    const release = () => { if (claimByKind.get(kind) === claim) claimByKind.delete(kind) }
    const held = pendingByKind.get(kind)
    if (held) {
      pendingByKind.delete(kind)
      try { claim.deliver(held) } catch (cause) { release(); throw cause }
    }
    return release
  }
  return {
    onPress,
    receive: (value: NotifyClick) => {
      if (!active) return
      const claim = claimByKind.get(value.kind)
      if (claim) claim.deliver(value)
      else pendingByKind.set(value.kind, value)
    },
    dispose: () => { active = false; claimByKind.clear(); pendingByKind.clear() },
  }
}
