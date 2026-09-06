/** Static extension contracts owned by the outlines capability. */
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

export type RowActions = (node: string) => ReadonlyArray<RowAction>

export interface RowAction {
  /** This plugin's own word for the verb — a testid and a list key, never an
   *  address. Two plugins may spell it the same: what a reader keys the list by
   *  is this beside the plugin's own name, which {@link Hung} carries and this
   *  row deliberately does not repeat. */
  readonly id: string
  /** The words on the row. */
  readonly label: string
  /**
   * Does it change the DIRECTORY? A verb that arms a composer, opens a panel or
   * moves this tab says `false` and sits with core's reads; one that writes a
   * property, a record or a file says `true` and sits with core's writes, under
   * the same rule.
   *
   * REQUIRED, with no default, because both answers are ordinary and the wrong
   * one is silent: a default of `false` would put a destructive verb among the
   * reads and a default of `true` would put a harmless one under Trash, and
   * neither would say anything at the moment it was written.
   */
  readonly writes: boolean
  /** Act on the node shown; return a sentence when the action is refused. */
  readonly run: (node: string) => string | void | Promise<string | void>
}

export interface PropEntry {
  readonly key: string
  /** What it says, as ONE string — a list joined by commas, exactly as the
   *  drawer has always drawn it. */
  readonly value: string
  /** ...and its MEMBERS, which is one element for a value that is text. */
  readonly values: ReadonlyArray<string>
  /** A fact the record carries in a field of its own: drawn, never edited. */
  readonly system: boolean
}

export interface BlockChrome {
  /** The key half of the fact line, with the drawer's editor gesture on it. */
  readonly Handle: (props: {
    readonly label: string
    readonly onOpen?: () => void
  }) => JSX.Element
  /** `data-testid` for the fact line — the drawer's contract, spelled once. */
  readonly factId: string
  /** `data-testid` for the value half. */
  readonly valueId: string
}

export interface BlockContext {
  readonly entry: PropEntry
  /** Open this property's editor — `undefined` where the run is read-only, and
   *  then no half of the face is a button. */
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

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "outline.row.chip": SlotDefinition<PropChip, "kind">
    "outline.row.pane": SlotDefinition<PropPane, "kind">
    "outline.row.block": SlotDefinition<PropBlock, "kind">
    "outline.row.door": SlotDefinition<(props: {readonly node: string}) => JSX.Element, "nothing">
    "outline.row.action": SlotDefinition<RowActions, "nothing">
  }
}

export const slotContracts = {
  "outline.row.chip": slotContract<PropChip>("outline.row.chip","kind"),
  "outline.row.pane": slotContract<PropPane>("outline.row.pane","kind"),
  "outline.row.block": slotContract<PropBlock>("outline.row.block","kind"),
  "outline.row.door": slotContract<(props: {readonly node: string}) => JSX.Element>("outline.row.door","nothing"),
  "outline.row.action": slotContract<RowActions>("outline.row.action","nothing"),
} as const
