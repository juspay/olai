import { type Accessor, createMemo, onCleanup } from "solid-js"

let opened = 0

const layers = new Set<Accessor<number>>()

export const topmostWhileOpen = (open: Accessor<boolean>): Accessor<boolean> => {
  const ticket = createMemo<number>((held) => (open() ? held || ++opened : 0), 0)
  layers.add(ticket)
  onCleanup(() => {
    layers.delete(ticket)
  })

  return () => {
    const mine = ticket()
    if (mine === 0) return false
    for (const other of layers) if (other() > mine) return false
    return true
  }
}
