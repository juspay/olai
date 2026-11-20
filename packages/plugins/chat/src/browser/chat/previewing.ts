import { createSignal, createSelector } from "solid-js"

export const createPreviewing = () => {
const [open, setOpen] = createSignal<string | null>(null)

const previewing = open

const isPreviewing = createSelector(open)

const togglePreview = (row: string): void => {
  setOpen((was) => (was === row ? null : row))
}

const closePreview = (): void => {
  setOpen(null)
}

return { previewing, isPreviewing, togglePreview, closePreview }
}
