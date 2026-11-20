import type { Said } from "@olai/web/client/saying.ts"

export interface MenuAction {
  readonly id: string
  readonly label: string
  readonly confirm?: string
  readonly divider?: boolean
  readonly run: () => void | Promise<Said | void>
}

export interface MenuSub {
  readonly id: string
  readonly label: string
  readonly divider?: boolean
  readonly entries: ReadonlyArray<MenuEntry>
}

export type MenuEntry = MenuAction | MenuSub

export const isSub = (entry: MenuEntry): entry is MenuSub => "entries" in entry

export const asks = (action: MenuAction): boolean => action.confirm !== undefined
