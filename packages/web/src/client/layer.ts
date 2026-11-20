export const LAYER = {
  row: "z-20",
  page: "z-30",
  strip: "z-[35]",
  chrome: "z-40",
  header: "z-[45]",
  over: "z-50",
} as const

export const WITHIN = {
  raised: "z-1",
  cover: "z-2",
  pop: "z-3",
} as const

export const enterTopLayer = (dialog: HTMLDialogElement): void => {
  if (!dialog.open) dialog.showModal()
}
