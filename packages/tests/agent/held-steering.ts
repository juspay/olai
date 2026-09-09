/** The fake's pending app-server replies, independent of compaction's tool
 * frames and filesystem release marker. Cancellation intentionally does not
 * retract these replies, matching the pinned adapter's steering method. */
export const heldSteering = () => {
  let held = false
  const pending: Array<() => void> = []
  return {
    hold: () => { held = true },
    defer: (reply: () => void): boolean => {
      if (!held) return false
      pending.push(reply)
      return true
    },
    release: () => {
      held = false
      for (const reply of pending.splice(0)) reply()
    },
  }
}
