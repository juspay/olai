/** POLL UNTIL A BENCH HAS MOVED, or say what did not happen.
 *
 *  Both appliance benches watch a real websocket settle — the board's rows and
 *  the link's own cell — so neither can await a promise for it, and a test that
 *  slept a fixed span would be either slow or flaky on a busy builder. One
 *  spelling, so the deadline and the sentence are the same in both. */
export const waitUntil = async (
  ok: () => boolean,
  why: string,
  ms = 8_000,
): Promise<void> => {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (ok()) return
    await Bun.sleep(20)
  }
  throw new Error(why)
}
