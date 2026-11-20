import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  useContext,
  onCleanup,
} from "solid-js"
import { createRosterTable } from "./table.ts"


import {
  type AgentChoice,
  type Listed,
  NO_AGENT_ROSTER,
} from "olai-plugin-chat/wire"
import { run } from "@olai/web/client/run.ts"
import { unreadOf } from "../../attention.ts"
import type { Row } from "./roster.ts"
import { chatWire } from "../wire.ts"

import type { NotHere } from "@kolu/acp/engine"
import { type AgentItem, itemKey } from "@olai/format"
import { fileMark } from "../kinds.ts"

export interface Named {
  readonly name: string
  readonly mark?: () => JSX.Element
  readonly where?: string
}

export interface Roster {
  readonly rows: Accessor<ReadonlyArray<Row>>
  readonly at: (key: string) => Row | undefined
  readonly chatOf: (item: AgentItem) => Row | undefined
  readonly named: (row: Row) => Named
  readonly engines: Accessor<ReadonlyArray<AgentChoice>>
  readonly standings: Accessor<ReadonlyArray<AgentChoice>>
  readonly only: Accessor<AgentChoice | null>
  readonly missing: (engine: string | undefined) => NotHere | null
  readonly chats: Accessor<Listed | null>
  readonly askChats: () => void
}

export function createAgents(): Roster {
  const engineCell = chatWire().cells.engines.use()
  const cell = chatWire().cells.agents.use()
  const rows = createMemo(() => (cell.value() ?? NO_AGENT_ROSTER)
    .map(row => ({ ...row, unread: unreadOf(row) })))
  const byKey = createRosterTable(rows)
  const named = (row: Row): Named => {
    if (row.kind !== "note") return { name: row.title }
    const mark = fileMark(row.file)
    return { name: row.title, ...(mark === undefined ? {} : { mark }), where: row.file }
  }
  let active = true
  onCleanup(() => { active = false })
  const standings = createMemo(() => engineCell.value() ?? [])
  const engines = createMemo(() => standings().filter((engine) => engine.standing === "here"))
  const missing = createMemo(() => new Map(standings().map(row =>
    [row.id, row.standing === "not-here" ? row.missing : null],
  )))
  const only = createMemo((): AgentChoice | null => {
    const available = engines()
    return available.length === 1 ? available[0]! : null
  })

  const [chats, setChats] = createSignal<Listed | null>(null)
  let asking = false
  let held = false
  const settleAsk = (apply: () => void): void => {
    if (!active) return
    const refire = held
    asking = false
    held = false
    apply()
    if (refire) askChats()
  }
  const askChats = (): void => {
    if (!active) return
    if (asking) {
      held = true
      return
    }
    asking = true
    run(
      chatWire().procedures.conversation.sessions(),
      () => settleAsk(() => {}),
      (listed) => settleAsk(() => setChats(listed)),
    )
  }
  askChats()

  const sessionsRevision = chatWire().cells.sessionsRevision.use()
  let lastSessionsRevision: number | undefined
  createEffect(() => {
    const revision = sessionsRevision.value()
    if (revision === undefined) return
    const previous = lastSessionsRevision
    lastSessionsRevision = revision
    if (previous !== undefined && previous !== revision) askChats()
  })

  return { rows, at: byKey.at, engines, standings, only,
    chatOf: item => byKey.at(itemKey(item)),
    named,
    missing: engine => engine === undefined ? null : missing().get(engine) ?? null,
    chats, askChats }
}

const AgentsContext = createContext<Roster>()

export function AgentsProvider(props: { readonly value: Roster; readonly children: JSX.Element }) {
  return <AgentsContext.Provider value={props.value}>{props.children}</AgentsContext.Provider>
}

export const useAgents = (): Roster => {
  const roster = useContext(AgentsContext)
  if (roster === undefined) throw new Error("an agents lookup outside <AgentsProvider>")
  return roster
}
