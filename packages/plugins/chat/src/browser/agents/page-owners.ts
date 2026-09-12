import { createRoot, onCleanup } from "solid-js"

/** Two page slots lease one owner. A pane identity and node together distinguish
 * a page from another pane drawing that same node. The activation is the final
 * backstop; ordinary navigation releases the last lease first. */
export const createPageOwners = <A>() => {
  const pages = new Map<object, Map<string, { value: A; stop: () => void; leases: number }>>()
  onCleanup(() => {
    for (const nodes of pages.values()) {
      for (const page of nodes.values()) page.stop()
      nodes.clear()
    }
    pages.clear()
  })
  return (pane: object, node: string, make: () => A): A => {
    let nodes = pages.get(pane)
    if (nodes === undefined) { nodes = new Map(); pages.set(pane, nodes) }
    let page = nodes.get(node)
    if (page === undefined) {
      page = createRoot(stop => ({ value: make(), stop, leases: 0 }))
      nodes.set(node, page)
    }
    const held = page
    const group = nodes
    held.leases++
    onCleanup(() => {
      if (--held.leases !== 0 || group.get(node) !== held) return
      group.delete(node)
      if (group.size === 0 && pages.get(pane) === group) pages.delete(pane)
      held.stop()
    })
    return held.value
  }
}
