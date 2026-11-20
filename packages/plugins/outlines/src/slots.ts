import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

export type RowActions = (node: string) => ReadonlyArray<RowAction>

export type RowAction = RowVerb | RowChoice

export interface RowVerb {
  readonly id: string
  readonly label: string
  readonly confirm?: string
  readonly writes: boolean
  readonly run: (node: string) => string | void | Promise<string | void>
}

export interface RowChoice {
  readonly id: string
  readonly label: string
  readonly writes: boolean
  readonly choices: ReadonlyArray<RowVerb>
}

export interface PropEntry {
  readonly key: string
  readonly value: string
  readonly values: ReadonlyArray<string>
  readonly system: boolean
}

export interface BlockChrome {
  readonly Handle: (props: {
    readonly label: string
    readonly onOpen?: () => void
  }) => JSX.Element
  readonly factId: string
  readonly valueId: string
}

export interface BlockContext {
  readonly entry: PropEntry
  readonly onOpen?: () => void
  readonly chrome: BlockChrome
}

export interface ChipContext extends BlockContext {
  readonly opened: boolean
  readonly onToggle?: () => void
}

export type PropChip = (context: ChipContext) => JSX.Element

export type PropPane = (context: BlockContext) => JSX.Element

export type PropBlock = (context: BlockContext) => JSX.Element

export type NodeFace = (props: { readonly node: string; readonly record?: string }) => JSX.Element

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "outline.row.aside": SlotDefinition<NodeFace, "nothing">
    "outline.crumb.aside": SlotDefinition<NodeFace, "nothing">
    "outline.row.fold": SlotDefinition<NodeFace, "nothing">
    "outline.page.head": SlotDefinition<NodeFace, "nothing">
    "outline.page.foot": SlotDefinition<NodeFace, "nothing">
    "outline.row.placement": SlotDefinition<{ readonly inRows: boolean }, "kind">
    "outline.row.chip": SlotDefinition<PropChip, "kind">
    "outline.row.pane": SlotDefinition<PropPane, "kind">
    "outline.row.block": SlotDefinition<PropBlock, "kind">
    "outline.row.action": SlotDefinition<RowActions, "nothing">
  }
}

export const slotContracts = {
  "outline.row.aside": slotContract<NodeFace>("outline.row.aside", "nothing"),
  "outline.crumb.aside": slotContract<NodeFace>("outline.crumb.aside", "nothing"),
  "outline.row.fold": slotContract<NodeFace>("outline.row.fold", "nothing"),
  "outline.page.head": slotContract<NodeFace>("outline.page.head", "nothing"),
  "outline.page.foot": slotContract<NodeFace>("outline.page.foot", "nothing"),
  "outline.row.placement": slotContract<{ readonly inRows: boolean }>("outline.row.placement", "kind"),
  "outline.row.chip": slotContract<PropChip>("outline.row.chip","kind"),
  "outline.row.pane": slotContract<PropPane>("outline.row.pane","kind"),
  "outline.row.block": slotContract<PropBlock>("outline.row.block","kind"),
  "outline.row.action": slotContract<RowActions>("outline.row.action","nothing"),
} as const
