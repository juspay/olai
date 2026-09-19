/** Union of external readers, owned by this chat activation. Only the state
 * cell is acquired; asleep/unbound rows cannot open a conversation through here.
 * Stable conversation keys avoid releasing a reading on unrelated roster frames. */
import { type Accessor, createComputed, createMemo, createRoot, createSignal, mapArray, onCleanup } from "solid-js"
import type { NodeAgentRow } from "../../wire/agents.ts"
import type { Conversing } from "../../sessions.ts"

type Row = Pick<NodeAgentRow, "id" | "engine" | "session" | "standing">

export const createKeeps = (
  agents: { readonly rows: Accessor<ReadonlyArray<Row>> },
  subscribe: (to: Conversing) => unknown,
): ((nodes: Accessor<ReadonlySet<string>>) => () => void) => {
  const [claims, setClaims] = createSignal<ReadonlyArray<Accessor<ReadonlySet<string>>>>([])
  const releases = new Set<() => void>()
  let alive = true
  const conversations = createMemo(() => {
    const ids = new Set(claims().flatMap(read => [...read()]))
    return [...new Set(agents.rows().filter(row => ids.has(row.id)
      && row.standing !== "asleep" && row.standing !== "unbound" && row.session !== null)
      .map(row => JSON.stringify([row.engine, row.session])))]
  })
  // mapArray's per-key owners dispose the state subscription when the last
  // claimant leaves or the roster changes its binding/standing.
  const held = mapArray(conversations, key => {
    const [agent, session] = JSON.parse(key) as [string, string]
    subscribe({ agent, session })
  })
  createComputed(held)
  onCleanup(() => {
    alive = false
    for (const release of [...releases]) release()
  })
  return nodes => {
    if (!alive) return () => {}
    return createRoot(dispose => {
      const read = createMemo(nodes)
      let released = false
      const release = () => {
        if (released) return
        released = true
        setClaims(before => before.filter(claim => claim !== read))
        releases.delete(release)
        dispose()
      }
      releases.add(release)
      setClaims(before => [...before, read])
      return release
    })
  }
}
