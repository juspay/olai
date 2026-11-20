import { type Accessor, createSignal } from "solid-js"

export interface Cursor {
  readonly at: Accessor<number>
  readonly to: (index: number) => void
  readonly step: (by: 1 | -1) => void
  readonly top: () => void
}

export const createCursor = (count: Accessor<number>): Cursor => {
  const [wanted, setWanted] = createSignal(0)

  const at: Accessor<number> = () => {
    const many = count()
    return many === 0 ? 0 : Math.min(wanted(), many - 1)
  }

  return {
    at,
    to: setWanted,
    step: (by) => {
      const many = count()
      if (many === 0) return
      setWanted((at() + by + many) % many)
    },
    top: () => setWanted(0),
  }
}
