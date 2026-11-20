import { type Accessor, createComputed, createSignal, onCleanup, type Setter } from "solid-js"

export type Previous = (key: string) => Accessor<string | undefined>

export const createPrevious = (order: Accessor<ReadonlyArray<string>>): Previous => {
  const slots = new Map<string, Setter<string | undefined>>()
  const above = new Map<string, string>()
  let previous: ReadonlyArray<string> = []
  createComputed(() => {
    const keys = order()
    let start = 0
    while (start < previous.length && start < keys.length && previous[start] === keys[start]) start++
    let oldEnd = previous.length, newEnd = keys.length
    while (oldEnd > start && newEnd > start && previous[oldEnd - 1] === keys[newEnd - 1]) { oldEnd--; newEnd-- }
    const retained = new Set(keys.slice(start, newEnd))
    for (let at = start; at < oldEnd; at++) {
      const key = previous[at]!
      if (!retained.has(key)) { above.delete(key); slots.get(key)?.(undefined) }
    }
    for (let at = start; at < Math.min(keys.length, newEnd + 1); at++) {
      const key = keys[at]!, before = keys[at - 1]
      if (before === undefined) above.delete(key)
      else above.set(key, before)
      slots.get(key)?.(before)
    }
    previous = keys
  })
  return (key) => {
    const [previous, set] = createSignal(above.get(key))
    slots.set(key, set)
    onCleanup(() => {
      if (slots.get(key) === set) slots.delete(key)
    })
    return previous
  }
}
