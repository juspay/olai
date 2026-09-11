/** One upstream handshake, then one claim per kind. Pending presses belong to
 * this activation, not storage: the newest unclaimed press replaces its kind's
 * previous one. Removing a claim never disturbs another claimant's identity. */
import type { Channel, NotifyClick } from "./contract.ts"

type Claim = { readonly name: string; readonly deliver: (value: NotifyClick) => void }
export const createPresses = () => {
  const claims = new Map<NotifyClick["kind"], Claim>()
  const pending = new Map<NotifyClick["kind"], NotifyClick>()
  let active = true
  const onPress: Channel["onPress"] = (kind, press) => {
    if (!active) return () => {}
    const name = press.name || "anonymous handler"
    const previous = claims.get(kind)
    if (previous) throw new Error(`Notification kind "${kind}" is claimed by ${previous.name}; ${name} cannot claim it`)
    const claim: Claim = { name, deliver: value => press(value as Parameters<typeof press>[0]) }
    claims.set(kind, claim)
    const release = () => { if (claims.get(kind) === claim) claims.delete(kind) }
    const held = pending.get(kind)
    if (held) {
      pending.delete(kind)
      try { claim.deliver(held) } catch (cause) { release(); throw cause }
    }
    return release
  }
  return {
    onPress,
    receive: (value: NotifyClick) => {
      if (!active) return
      const claim = claims.get(value.kind)
      if (claim) claim.deliver(value)
      else pending.set(value.kind, value)
    },
    dispose: () => { active = false; claims.clear(); pending.clear() },
  }
}
