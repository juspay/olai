import { type Accessor, createEffect, createSignal } from "solid-js"

export type Asked = "offered" | "asking" | "working"

export interface Confirming {
  readonly where: Accessor<Asked>
  readonly ask: () => void
  readonly drop: () => void
  readonly begin: () => void
  readonly done: () => void
}

export const createConfirming = (
  subject: () => unknown,
): Confirming => {
  const [where, setWhere] = createSignal<Asked>("offered")

  createEffect(() => {
    subject()
    setWhere((was) => (was === "asking" ? "offered" : was))
  })

  return {
    where,
    ask: () => setWhere("asking"),
    drop: () => setWhere("offered"),
    begin: () => setWhere("working"),
    done: () => setWhere("offered"),
  }
}
