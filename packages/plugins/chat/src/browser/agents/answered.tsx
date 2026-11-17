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
import { createRosterTable } from "./table.ts"


import {
  type AgentChoice,
  type Listed,
  NO_AGENT_ROSTER,
  type Unreachable,
} from "olai-plugin-chat/wire"
import { run } from "@olai/web/client/run.ts"
import { unreadOf } from "../../attention.ts"
import type { Row } from "./roster.ts"
import { chatWire } from "../wire.ts"

import type { NotHere } from "@kolu/acp/engine"
import { standIns, type Place } from "@olai/format"
import { addressIn, labelIn, nameOf } from "olai-plugin-navigation/address/address.ts"
import { navigation } from "../navigation.ts"
import { servedDirectory } from "../vault.ts"
import { createDeclared } from "../references.ts"
import { placeMark } from "../kinds.ts"
import { placeOfRoute, routeOfPlace } from "./place.ts"

/**
 * WHAT A CHAT IS CALLED wherever it is listed — the sidebar, the side panel's
 * title and picker, the palette.
 *
 * An ordinary chat row is its title. A chat row standing for a place is the
 * label written in its title, or the place's own name where the title is bare,
 * and it wears the place's mark: a file its kind's own, a plugin's page the
 * mark its route declares, anything else the pin every address wears. The raw
 * title (`[plan](/notes/plan.md)`) is never what a person reads.
 */
export interface Named {
  readonly name: string
  readonly mark?: () => JSX.Element
  /** Where the place is — the palette's second line. */
  readonly where?: string
}

/** The shared roster, installed engines and stored history answer. */
export interface Roster {
  readonly rows: Accessor<ReadonlyArray<Row>>
  /** A chat row by its own id — what the seat, the wire and the side panel's
   *  memory address a conversation by. A face asking which chat is ON a row
   *  asks {@link chatAt} instead. */
  readonly at: (node: string) => Row | undefined
  /**
   * THE CHAT AT A PLACE — the one reading every face asks: the mark beside a
   * row, its fold and page, the seat under a page, the side panel, the
   * palette, the sidebar, link previews and the dot on a tab.
   *
   * A chat row is the chat of its own row; a chat row titled with an address
   * is also the chat of that place (`@olai/format`'s `standIns` holds the
   * rule about who wins a place, `./place.ts` what a title stands for).
   */
  readonly chatAt: (place: Place) => Row | undefined
  /** The place a chat row stands for once that rule has run — its own row for
   *  every chat that is not a stand-in. */
  readonly placeOf: (row: { readonly id: string }) => Place
  /** Whether a chat row stands for a place other than its own row. */
  readonly standsIn: (row: { readonly id: string }) => boolean
  /** What a chat row is called, and the mark it wears ({@link Named}). */
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
  readonly unreachable: Accessor<ReadonlyArray<Unreachable>>
  readonly chatsRefusal: Accessor<string | null>
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
  // THE SAME ROWS BY NODE, as a keyed projection rather than a fresh `Map` per
  // frame — `./table.ts` says why, and its browsertest holds the count.
  const byNode = createRosterTable(rows)
  // WHAT EACH CHAT ROW STANDS FOR, read off its title with the router's own
  // grammar — held by chat's `navigation` component, so with no navigation
  // every chat stands for its own row and nothing else changes. Whether a
  // place is still there is two readings this row already holds: the served
  // files, and the outline's naming of a node (asked for the ids a title
  // names, once each).
  const declared = createDeclared()
  const written = createMemo(() => {
    const routes = navigation()?.routes
    return rows().map(row => {
      const route = routes === undefined ? undefined : addressIn(routes, row.title)
      return route === undefined ? null : placeOfRoute(routes!, route)
    })
  })
  createEffect(() => declared.want(written().flatMap(place => place?.kind === "row" ? [place.id] : [])))
  const served = createMemo(() => new Set(servedDirectory()?.paths() ?? []))
  const present = (place: Place): boolean => place.kind === "file"
    ? servedDirectory()?.kindOf(place.path) != null && served().has(place.path)
    : place.kind !== "row" || declared.told(place.id) !== null
  const places = createMemo(() => {
    const said = written()
    const all = rows()
    const of = new Map(all.map((row, index) => [row, said[index] ?? null]))
    return standIns(all, row => { const place = of.get(row) ?? null; return place !== null && present(place) ? place : null })
  })
  const named = (row: Row): Named => {
    const routes = navigation()?.routes
    const all = places()
    // A TITLE WRITTEN AS A NAMED LINK IS READ BY ITS LABEL whatever became of
    // the place: somebody named that chat, and a page that was deleted (or a
    // link to somewhere olai cannot open) is no reason to show them the
    // brackets. Only a chat standing for a place wears that place's mark; a
    // bare address is left as it was typed.
    if (routes === undefined || !all.standsIn(row)) return { name: labelIn(row.title) ?? row.title }
    const place = all.of(row)
    const route = routeOfPlace(routes, place)
    const own = place.kind === "file" ? routes.name(route) : place.kind === "row" ? declared.title(place.id) ?? undefined : undefined
    return {
      name: labelIn(row.title) ?? own ?? nameOf(routes, route, undefined),
      mark: placeMark(routes, place),
      ...(place.kind === "file" ? { where: place.path } : place.kind === "page" ? { where: place.href.replace(/^\//, "") } : {}),
    }
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


  return { rows, at: byNode.at, engines, standings, only,
    chatAt: place => places().at(place),
    placeOf: row => places().of(row),
    standsIn: row => places().standsIn(row),
    named,
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
