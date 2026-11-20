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
