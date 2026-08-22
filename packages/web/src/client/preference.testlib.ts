/**
 * A browser's storage, for a test that has none.
 *
 * Bun's runner ships no `localStorage`, which is exactly what makes the whole
 * read→signal→write loop testable here: the storage is a `Map` the test can
 * inspect, and `./preference.ts`'s contract — a preference stands even when
 * storage throws — is the reason reading that absence is legal rather than a
 * setup failure.
 *
 * It lives here rather than in whichever test wrote it first because FIVE of
 * them want it, in four folders, and each had spelled the same four-line shim
 * and the same `try`/`finally` for itself — the fifth copy arriving with the
 * git-policy pin is what made it worth one function. The alternative-placement
 * test lands it beside `./preference.ts`: the shim exists to stand in for what
 * that module reaches for, so the concept's generative side is here rather than
 * in `fold/` or `settings/`.
 *
 * `preference.test.ts`'s own `wired` is deliberately NOT this: it fakes
 * `window` as well, so a sibling tab's `storage` event can be fired at the
 * listener, which is the one thing that file is about and nothing else needs.
 */

/** Run `body` with a `localStorage` backed by a fresh `Map`, and take it away
 *  afterwards however the body ends. The map is handed in, because what a test
 *  asserts is usually the bytes that landed under a key. */
export const remembering = (body: (store: Map<string, string>) => void): void => {
  const store = new Map<string, string>()
  const g = globalThis as Record<string, unknown>
  g.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  try {
    body(store)
  } finally {
    delete g.localStorage
  }
}
