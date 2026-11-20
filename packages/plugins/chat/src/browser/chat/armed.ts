import { type Accessor, createSignal } from "solid-js"

export const createArmed = () => {
const [armed, setArmed] = createSignal<ReadonlyArray<string>>([])

const armedNodes: Accessor<ReadonlyArray<string>> = armed

const armNode = (id: string): void => {
  setArmed((already) => (already.includes(id) ? already : [...already, id]))
}

const disarmNode = (id: string): void => {
  setArmed((already) => already.filter((armed) => armed !== id))
}

const releaseArmed = (): ReadonlyArray<string> => {
  const held = armed()
  setArmed([])
  return held
}

const restoreArmed = (ids: ReadonlyArray<string>): void => {
  setArmed((now) => (now.length === 0 ? ids : now))
}

return { armedNodes, armNode, disarmNode, releaseArmed, restoreArmed }
}
