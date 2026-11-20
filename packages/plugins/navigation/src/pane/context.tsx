import { createContext,type JSX,useContext } from "solid-js"
import { randomUuid } from "@olai/web/client/uuid.ts"

export interface PaneHere {
  readonly id: string
  readonly element?: HTMLElement
  readonly index: number
}

const PaneContext = createContext<PaneHere>()

export function PaneProvider(props: {
  readonly id?: string
  readonly element?: HTMLElement
  readonly index: number
  readonly children: JSX.Element
}) {
  const parent = useContext(PaneContext)
  const fallbackId = parent?.id ?? randomUuid()
  const here: PaneHere = {
    get id() { return props.id ?? fallbackId },
    get element() { return props.element ?? parent?.element },
    get index() {
      return props.index
    },
  }
  return (
    <PaneContext.Provider value={here}>
      {props.children}
    </PaneContext.Provider>
  )
}

export const usePane = (): PaneHere | undefined => useContext(PaneContext)
