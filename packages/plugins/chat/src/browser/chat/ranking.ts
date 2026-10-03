/** An indexed maximum heap. Transcript membership owns entries; replacing or
 * removing one entry touches its path to the root, not the entire transcript. */
export const createRanking = <T>() => {
  type Entry = { key: string; seq: number; position: number; value: T }
  const heap: Entry[] = []
  const indices = new Map<string, number>()
  const later = (a: Entry, b: Entry) => a.seq > b.seq || (a.seq === b.seq && a.position > b.position)
  const swap = (a: number, b: number) => {
    const one = heap[a]!
    heap[a] = heap[b]!
    heap[b] = one
    indices.set(heap[a]!.key, a)
    indices.set(one.key, b)
  }
  const repair = (index: number) => {
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (!later(heap[index]!, heap[parent]!)) break
      swap(index, parent)
      index = parent
    }
    for (;;) {
      const left = index * 2 + 1
      if (left >= heap.length) break
      const right = left + 1
      const child = right < heap.length && later(heap[right]!, heap[left]!) ? right : left
      if (!later(heap[child]!, heap[index]!)) break
      swap(index, child)
      index = child
    }
  }
  return {
    top: () => heap[0]?.value,
    put: (key: string, seq: number, position: number, value: T) => {
      const index = indices.get(key) ?? heap.length
      heap[index] = { key, seq, position, value }
      indices.set(key, index)
      repair(index)
    },
    drop: (key: string) => {
      const index = indices.get(key)
      if (index === undefined) return
      indices.delete(key)
      const last = heap.pop()!
      if (index === heap.length) return
      heap[index] = last
      indices.set(last.key, index)
      repair(index)
    },
  }
}
