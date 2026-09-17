/** One activation-owned roster supplies every outline face, sidebar region and
 * palette adapter. Row lookups, engine choices and stored history share it.
 * Stored listings refresh at activation/session revisions and explicit history
 * opening; settled-turn filing is owned by the server. */

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

import {
  type AgentChoice,
  type Listed,
  NO_AGENT_ROSTER,
  type Unreachable,
} from "olai-plugin-chat/wire"
import { run } from "@olai/web/client/run.ts"
import type { Row } from "./roster.ts"
import { chatWire } from "../wire.ts"

import type { NotHere } from "@olai/acp/engine"

/** The shared roster, installed engines and stored history answer. */
export interface Roster {
  readonly rows: Accessor<ReadonlyArray<Row>>
  readonly at: (node: string) => Row | undefined
  /** The engines this serve mounted that this machine can start — the fold
   *  every "startable" consumer keeps: the verbs, the palette, the composer's
   *  select. A `not-here` row is NOT in it, on purpose ({@link standings}). */
  readonly engines: Accessor<ReadonlyArray<AgentChoice>>
  /** The WHOLE standing table, one row per mounted engine in bundle order —
   *  `here` rows pickable, `not-here` rows greyed with the engine's own
   *  sentence. The picker menu and the no-agent face read this rather than
   *  {@link engines}, because an engine a person enabled and cannot start is a
   *  row they are owed, not one that vanishes. */
  readonly standings: Accessor<ReadonlyArray<AgentChoice>>
  /** The sole startable engine, or null when starting needs a choice (or is
   * impossible). Missing siblings never turn a one-engine gesture into a menu. */
  readonly only: Accessor<AgentChoice | null>
  /** One indexed absence reading shared by the composer and inspector faces. */
  readonly missing: (engine: string | undefined) => NotHere | null
  /** Null until the first listing; a refused refresh keeps the last answer. */
  readonly chats: Accessor<Listed | null>
  readonly unreachable: Accessor<ReadonlyArray<Unreachable>>
  readonly chatsRefusal: Accessor<string | null>
  /** Refresh on an explicit history opening or a completed session revision. */
  readonly askChats: () => void
}

export function createAgents(): Roster {
  const engineCell = chatWire().cells.engines.use()
  const cell = chatWire().cells.agents.use()
  const rows = createMemo(() => cell.value() ?? NO_AGENT_ROSTER)
  const byNode = createMemo(() => new Map(rows().map(row => [row.id, row])))
  let active = true
  onCleanup(() => { active = false })
  // THE WHOLE TABLE FIRST ({@link Roster.standings}), then the fold: a reader
  // that greys an absence needs every row, and a reader that starts something
  // needs only the ones this machine can start. One memo over the cell for
  // each, so both answer from the same frame.
  const standings = createMemo(() => engineCell.value() ?? [])
  const engines = createMemo(() => standings().filter((engine) => engine.standing === "here"))
  const missing = createMemo(() => new Map(standings().map(row =>
    [row.id, row.standing === "not-here" ? row.missing : null],
  )))
  const only = createMemo((): AgentChoice | null => {
    const available = engines()
    return available.length === 1 ? available[0]! : null
  })

  /**
   * WHAT EVERY INSTALLED AGENT HAS STORED HERE, as this tab last heard it.
   *
   * `null` until the FIRST answer arrives, and never emptied afterwards: an ask
   * that did not land leaves the last list standing and puts its own sentence
   * beside it ({@link chatsRefusal}), because *we did not get to look* and
   * *there is nothing here* are different answers and this list is the only
   * place either is said.
   */
  const [chats, setChats] = createSignal<Listed | null>(null)
  const [chatsRefusal, setChatsRefusal] = createSignal<string | null>(null)
  /** An ask in flight right now, and whether an event queued one behind it.
   *  Not signals: which frame an ask settles on is bookkeeping, and painting
   *  it would redraw the page for a wire a reader never sees. */
  let asking = false
  let held = false
  const settleAsk = (apply: () => void): void => {
    if (!active) return
    // THE FLAGS GO DOWN BEFORE THE ANSWER IS APPLIED, and the queue drains
    // after: `run` rethrows a defect and a signal's subscribers run inside
    // `apply`, so either arm throwing would otherwise pass the release by and
    // wedge `asking` forever — taking the press with it, invisibly. A defect
    // may now cost the drain; it may never lock the door.
    const refire = held
    asking = false
    held = false
    apply()
    if (refire) askChats()
  }
  const askChats = (): void => {
    if (!active) return
    // COALESCED, not stacked: while one ask is in flight a second says nothing
    // the settle will not say fresher — and the settle RE-FIRES when anything
    // queued, because the queue is how an event that raced an in-flight ask
    // (a session revision during the mount ask, for example) still
    // gets its answer rather than a window nobody re-opens.
    if (asking) {
      held = true
      return
    }
    asking = true
    run(
      chatWire().procedures.conversation.sessions(),
      // A REFUSAL LEAVES THE LAST ANSWER STANDING rather than emptying the
      // list — a socket that dropped is not a directory whose chats were all
      // assigned — and it is KEPT, because the list is the one place those
      // conversations are now and a stale one with nothing said over it would
      // be the same lie the picker's own refusal arm exists to prevent.
      (failure) =>
        settleAsk(() => {
          setChatsRefusal(failure.message)
        }),
      (listed) =>
        settleAsk(() => {
          setChatsRefusal(null)
          setChats(listed)
        }),
    )
  }
  // On the frame this provider mounts: what it buys is the count on a
  // row nobody has pressed yet — see the header.
  askChats()

  // A sibling tab can replace a node session without running a turn. Wait
  // for the server's completed history write, not the earlier roster update.
  const sessionsRevision = chatWire().cells.sessionsRevision.use()
  let lastSessionsRevision: number | undefined
  createEffect(() => {
    const revision = sessionsRevision.value()
    if (revision === undefined) return
    const previous = lastSessionsRevision
    lastSessionsRevision = revision
    if (previous !== undefined && previous !== revision) askChats()
  })

  /** The answer's own arm, read once here — see {@link Roster.unreachable}. */
  const unreachable = createMemo((): ReadonlyArray<Unreachable> => chats()?.unreachable ?? [])


  return { rows, at: node => byNode().get(node), engines, standings, only,
    missing: engine => engine === undefined ? null : missing().get(engine) ?? null,
    chats,
    unreachable, chatsRefusal, askChats }
}

const AgentsContext = createContext<Roster>()

/** Each contribution carries the same activation-owned roster to its children. */
export function AgentsProvider(props: { readonly value: Roster; readonly children: JSX.Element }) {
  return <AgentsContext.Provider value={props.value}>{props.children}</AgentsContext.Provider>
}

/** The roster as the server last answered it — or a throw when a consumer is
 * drawn outside the provider, which is a bug rather than a reachable state. */
export const useAgents = (): Roster => {
  const roster = useContext(AgentsContext)
  if (roster === undefined) throw new Error("an agents lookup outside <AgentsProvider>")
  return roster
}
