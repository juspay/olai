/** One activation-owned roster supplies every outline face, sidebar region and
 * palette adapter. Row lookups, engine choices and stored history share it.
 * Stored listings refresh at activation/session revisions and explicit history
 * opening. */

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

/**
 * WHAT A CHAT IS CALLED wherever it is listed — the sidebar, the side panel's
 * title and picker, the palette.
 *
 * A node's chat is its row's title. A note's chat is the note's name (`plan`
 * for `notes/plan.md`), wearing the mark its kind of file wears, with the
 * note's path as the line under it.
 */
export interface Named {
  readonly name: string
  readonly mark?: () => JSX.Element
  /** Where a note is — the palette's second line. */
  readonly where?: string
}

/** The shared roster, installed engines and stored history answer. */
export interface Roster {
  readonly rows: Accessor<ReadonlyArray<Row>>
  /** A chat by its ITEM KEY — a node's id, or `/` and a note's path
   *  (`@olai/format`'s `itemKey`). It is what the wire, the seat and the side
   *  panel's memory address a conversation by, and a face holding the item
   *  itself asks {@link chatOf} instead. */
  readonly at: (key: string) => Row | undefined
  /**
   * THE CHAT OF AN ITEM — the one reading every face asks: the mark beside a
   * row, its fold and page, the seat under a note, the side panel, the
   * palette, the sidebar, link previews and the dot on a tab.
   *
   * Only a node and a note can have one, and each has at most one: the item
   * IS the key the roster is listed by, so this is a lookup and never a rule.
   */
  readonly chatOf: (item: AgentItem) => Row | undefined
  /** What a chat is called, and the mark it wears ({@link Named}). */
  readonly named: (row: Row) => Named
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
  /** Refresh on an explicit history opening or a completed session revision. */
  readonly askChats: () => void
}

export function createAgents(): Roster {
  const engineCell = chatWire().cells.engines.use()
  const cell = chatWire().cells.agents.use()
  // `unread` IS DERIVED HERE, once per frame — the wire carries the two
  // instants and nothing compares them for a reader
  // (`../../attention.ts`'s `unreadOf`). One map per roster frame, and a frame
  // that moved no row never arrives at all: the cell's `equals` is what keeps
  // this off the paint path of a directory whose agents are sitting still.
  const rows = createMemo(() => (cell.value() ?? NO_AGENT_ROSTER)
    .map(row => ({ ...row, unread: unreadOf(row) })))
  // THE SAME ROWS BY KEY, as a keyed projection rather than a fresh `Map` per
  // frame — `./table.ts` says why, and its browsertest holds the count. A
  // node's key is its id and a note's is `/` and its path, so one table
  // answers both.
  const byKey = createRosterTable(rows)
  // A NOTE IS NAMED BY ITS FILE, and the server has already done the naming:
  // the row's title is the note's name (`plan` for `notes/plan.md`) and its
  // `file` is the path. What is left for the browser is the MARK, which is a
  // reading only this tab holds — which kinds of file are served here and what
  // each is drawn with (`../kinds.ts`).
  const named = (row: Row): Named => {
    if (row.kind !== "note") return { name: row.title }
    const mark = fileMark(row.file)
    return { name: row.title, ...(mark === undefined ? {} : { mark }), where: row.file }
  }
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
   * that did not land leaves the last list standing, because *we did not get to
   * look* and *there is nothing here* are different answers and only one of
   * them is a fact about this directory.
   */
  const [chats, setChats] = createSignal<Listed | null>(null)
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
      // list — a socket that dropped is not a directory whose chats are gone
      // — because the list is the one place those conversations are now, and
      // emptying it would be the same lie the picker's own refusal arm exists
      // to prevent.
      () => settleAsk(() => {}),
      (listed) => settleAsk(() => setChats(listed)),
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

  return { rows, at: byKey.at, engines, standings, only,
    chatOf: item => byKey.at(itemKey(item)),
    named,
    missing: engine => engine === undefined ? null : missing().get(engine) ?? null,
    chats, askChats }
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
