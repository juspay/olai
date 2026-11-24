/**
 * THE RULE FOR A FAILURE THAT CAN REPEAT FOREVER, kept once for both ends of
 * a tab's connection: a dial that never opened, on the tab; an upgrade nobody
 * took, on the server. Said the first time, then at most once per
 * {@link SAY_AGAIN_AFTER_MS} with how many happened since it was last said.
 *
 * A factory, so each caller holds its own count in its own closure.
 */

/** How long a repeated failure waits before it is said again. */
export const SAY_AGAIN_AFTER_MS = 30_000

/** `heard` answers the count to say now, or `undefined` to hold it; `settle`
 *  hands back what is held and starts again, so the next one is a first. */
export const sparingly = () => {
  let saidAt: number | undefined
  let held = 0
  return {
    heard: (now: number): number | undefined => {
      held += 1
      if (saidAt !== undefined && now - saidAt < SAY_AGAIN_AFTER_MS) return undefined
      saidAt = now
      const count = held
      held = 0
      return count
    },
    settle: (): number => {
      const count = held
      held = 0
      saidAt = undefined
      return count
    },
  }
}
