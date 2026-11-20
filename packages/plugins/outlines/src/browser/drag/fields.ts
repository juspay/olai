import type { Row } from "@olai/format"
import { type Accessor, createContext, createSignal, onCleanup, useContext } from "solid-js"

export interface Field {
  readonly file: string
  readonly within: ReadonlyArray<string>
  readonly rows: Accessor<ReadonlyArray<Row>>
  readonly collapsed: Accessor<ReadonlySet<string>>
  readonly element: () => Element | undefined
}

export interface Fields {
  readonly join: (field: Field) => void
  readonly all: () => ReadonlyArray<Field>
}

const FieldsContext = createContext<Fields>()

export const useFields = (): Fields => {
  const fields = useContext(FieldsContext) ?? ownedFields
  if (fields === undefined) throw new Error("a drag field outside <App>")
  return fields
}

export const FieldsProvider = FieldsContext.Provider

/**
 * {@link Fields.join} MUST be called during a component's setup, because that is
 * where its `onCleanup` finds an owner.
 */
export const createFields = (): Fields => {
  const [joined, setJoined] = createSignal<ReadonlyArray<Field>>([])
  return {
    join: (field) => {
      setJoined((were) => [...were, field])
      onCleanup(() => setJoined((were) => were.filter((one) => one !== field)))
    },
    all: joined,
  }
}

let ownedFields: Fields | undefined
export const holdFields = (value: Fields): (() => void) => {
  ownedFields = value
  return () => { if (ownedFields === value) ownedFields = undefined }
}
