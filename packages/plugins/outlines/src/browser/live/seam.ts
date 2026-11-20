import type { JSX } from "solid-js"

import type { Entry } from "olai-plugin-outlines/property-values"

export interface BlockContext {
  readonly entry: Entry
  readonly onOpen?: () => void
  readonly chrome: BlockChrome
}

export interface BlockChrome {
  readonly Handle: (props: {
    readonly label: string
    readonly onOpen?: () => void
  }) => JSX.Element
  readonly factId: string
  readonly valueId: string
}

export interface ChipContext extends BlockContext {
  readonly opened: boolean
  readonly onToggle?: () => void
}

export type PropChip = (context: ChipContext) => JSX.Element
export type PropPane = (context: BlockContext) => JSX.Element
export type PropBlock = (context: BlockContext) => JSX.Element

export interface Dressing {
  readonly Chip?: PropChip
  readonly Pane?: PropPane
  readonly Block?: PropBlock
}

export type Dressings = (word: string) => Dressing | undefined

export type Licensed = (key: string, value: string) => string | undefined

export const dressingFor = (
  entry: Entry,
  licensed: Licensed,
  dressings: Dressings,
): Dressing | undefined => {
  if (entry.system) return undefined
  const [value, ...rest] = entry.values
  if (value === undefined || rest.length > 0) return undefined
  const word = licensed(entry.key, value)
  return word === undefined ? undefined : dressings(word)
}

export interface Laid {
  readonly run: ReadonlyArray<{
    readonly entry: Entry
    readonly chip?: PropChip
    readonly pane?: PropPane
  }>
  readonly blocks: ReadonlyArray<{ readonly entry: Entry; readonly block: PropBlock }>
}

export const layOut = (
  entries: ReadonlyArray<Entry>,
  editing: string | undefined,
  licensed: Licensed,
  dressings: Dressings,
): Laid => {
  const run: Laid["run"][number][] = []
  const blocks: { entry: Entry; block: PropBlock }[] = []
  for (const entry of entries) {
    const dressing = entry.key === editing
      ? undefined
      : dressingFor(entry, licensed, dressings)
    if (dressing?.Block !== undefined) blocks.push({ entry, block: dressing.Block })
    else run.push({ entry, chip: dressing?.Chip, pane: dressing?.Pane })
  }
  return { run, blocks }
}
