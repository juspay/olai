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
