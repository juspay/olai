import { declarationsOf, isRegular, textDeclaredAs, yesNo, type Derived, type NodeAgent } from "@olai/format"
import { serviceTag } from "@olai/plugin-api/services"
import { INBOX_TYPE, ownKinds } from "./kinds.ts"
export type Seats = ReadonlyArray<Pick<NodeAgent, "id" | "file" | "title" | "engine" | "session">>
export const Seating = serviceTag<{ readonly in: (derived: Derived) => Seats }>("chat.seating")
export interface InboxBind {
  readonly node: string
  readonly file: string
  readonly title: string
  readonly engine: string
  readonly session: string
}
export interface InboxReading {
  readonly binds: ReadonlyArray<InboxBind>
  readonly named: ReadonlyArray<{ readonly node: string; readonly file: string }>
}
/** One snapshot, joined through chat's declared seating capability. Mirrors do not opt in. */
export const wakingIn = (derived: Derived, seated: Seats): InboxReading => {
  const declarations = declarationsOf(derived, ownKinds)
  const opted = new Set(derived.nodes.filter(isRegular).filter(at => yesNo(textDeclaredAs(declarations, at.node, INBOX_TYPE)) === true).map(at => at.node.id))
  const named: Array<{ node: string; file: string }> = []
  const binds: InboxBind[] = []
  const claimed = new Set<string>()
  for (const seat of seated) {
    if (!opted.has(seat.id)) continue
    named.push({ node: seat.id, file: seat.file })
    if (seat.session === null) continue
    const key = JSON.stringify([seat.engine, seat.session])
    if (claimed.has(key)) continue
    claimed.add(key)
    binds.push({ node: seat.id, file: seat.file, title: seat.title, engine: seat.engine, session: seat.session })
  }
  return { binds, named }
}
