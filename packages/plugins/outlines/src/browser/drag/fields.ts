import type { Row } from "@olai/format"
import { type Accessor, createContext, createSignal, useContext } from "solid-js"

export interface Field {
  readonly file: string
  readonly within: ReadonlyArray<string>
  readonly rows: Accessor<ReadonlyArray<Row>>
  readonly collapsed: Accessor<ReadonlySet<string>>
  readonly element: () => Element | undefined
}

export interface Fields {
  readonly join: (field: Field) => () => void
  readonly all: () => ReadonlyArray<Field>
}

const FieldsContext = createContext<Fields>()

export const useFields = (): Fields => {
  const fields = useContext(FieldsContext) ?? ownedFields
  if (fields === undefined) throw new Error("a drag field outside <App>")
  return fields
}

export const FieldsProvider = FieldsContext.Provider

export const createFields = (): Fields => {
  const [joined, setJoined] = createSignal<ReadonlyArray<Field>>([])
  return {
    join: (field) => {
      setJoined((were) => [...were, field])
      return () => setJoined((were) => were.filter((one) => one !== field))
    },
    all: joined,
  }
}

let ownedFields: Fields | undefined
export const holdFields = (value: Fields): (() => void) => {
  ownedFields = value
  return () => { if (ownedFields === value) ownedFields = undefined }
}
