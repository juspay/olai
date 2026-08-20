/**
 * WHAT THE PAGE IN FRONT OF SOMEBODY SAYS — asked of the server, once per open
 * pane.
 *
 * This is the browser's half of `docs/brainstorming/vault-in-browser.md`'s PR
 * 10. A tab used to subscribe to every record of every outline and answer every
 * page out of that copy; it subscribes to ONE ADDRESS now and is handed what
 * that address draws (`@olai/surface`'s `page` stream). The walks did not move
 * — they are `@olai/format`'s still, called on the other side of the wire — and
 * neither did any component: what arrives is the same `Row`, `Zoomed`,
 * `DayGroup` and `Agenda` the tree, the heading, the day and the spine were
 * always drawn from.
 *
 * ## A subscription, not an ask
 *
 * A page is a STANDING view. An edit from an agent, a `git pull`, a keystroke
 * in another tab all have to reach the page somebody is looking at with no
 * reload — which is what this app has always promised and what four feature
 * files pin. So the member is a stream: the server re-reads the reading on
 * every published revision and sends a frame only when it changed BY VALUE
 * (`@olai/format`'s `samePageReading`). A procedure would need a GENERATION to
 * re-ask on, and the only generation a tab had was the identity of its own
 * derivation — the thing this change deletes.
 *
 * ## Three contexts, and why they are three
 *
 * {@link ReadingProvider} is ONE PANE's answer, read by everything drawn inside
 * that pane. It replaces `DerivedProvider`, which handed out the vault, and it
 * is the same argument in a smaller room: a row's `see` link, a heading's
 * crumbs and a menu's confirm are each a question one descendant asks, and
 * threading the answer through a thousand rows would make every component's
 * signature a function of what one of its children needs.
 *
 * {@link NamesProvider} is a narrow door onto one field of that answer — what
 * the ids this page points at are CALLED. It is separate because its readers
 * are the leaves: a title that turns out to be an address, and the strip of
 * links a `see` draws. Handing those the whole reading would hand a title
 * resolver a page.
 *
 * {@link ReadingsProvider} is the WORKSPACE's, and it exists for the chrome
 * that is about more than the pane it is drawn in — the sidebar entry that
 * lights up, the palette's write verbs, undo's idea of the open file. Those
 * have to agree with the FOCUSED pane, and a pane is where the subscription
 * lives, so each one joins as it mounts and leaves with itself. It is
 * `drag/fields.ts`'s register with a different subject, for that module's
 * reason word for word: what is on screen is a fact the PAGES have and the
 * address does not.
 */

import type { PageReading, PageRequest } from "@olai/format"
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"

import { createNames, type Names } from "./names.ts"
import { olai } from "./wire.ts"

/**
 * One page, asked and kept live — and a token that moves when its answer did.
 *
 * `undefined` is "nothing has been answered yet" and is the state every reader
 * below already handles: the pane draws its `Reading…` line, the chrome draws
 * no file, and nothing invents a page that has not arrived. It is also what a
 * caller with no question gets — a `null` input holds the subscription closed,
 * which is the framework's own way of saying "do not ask yet".
 *
 * THE INPUT IS A MEMO'S JOB, not this function's: a subscription re-opens
 * whenever its input NOTIFIES, so a caller handing over a fresh object per read
 * would tear the stream down on every frame. Every call site here passes a
 * `createMemo` over the route.
 *
 * ENROLLED (`.use()`), so a stream that stops is a fact the connection readout
 * carries and the offline overlay is drawn on — which is the whole of the error
 * handling this needs, and the reason the design could rule that a dead wire
 * freezes the app rather than half-drawing it.
 */
export interface Reading {
  readonly page: Accessor<PageReading | undefined>
  /**
   * A GENERATION: a number that moves exactly when this page's answer moved,
   * for the one reader that needs to know THAT rather than what changed — the
   * filter, whose answer about which nodes a query selects may not outlive the
   * set it was computed over (`./filter/asking.ts`'s `Ask.at`).
   *
   * IT CANNOT BE THE VALUE'S IDENTITY, which is what it was when the tab held
   * a derivation: a subscription's value is a RECONCILED STORE, so its identity
   * survives every frame and its fields move underneath — a reader comparing
   * two readings would be comparing one object with itself and concluding that
   * nothing had changed. `./dates.ts` states that rule for the two date
   * readings and answers it by handing out plain values; a page's reading is
   * too big to copy per frame, so this counts the frames instead.
   *
   * THE FRAMEWORK'S OWN CHANGE SIGNAL (`Subscription.updated`), which fires
   * under its change-iff-fired law: a first frame is a value rather than news,
   * a reconnect snapshot equal to what was already held is silent, and a frame
   * that DIFFERS fires once. That is precisely "the answer this page draws is
   * not the one it was drawing", which is precisely when a filter's answer
   * about it stopped being safe to trust.
   *
   * THE PAGE ITSELF is the right granularity, and narrower than what it
   * replaced: a revision that moved nothing on this page sends no frame at all
   * (the server's `samePageReading`), so it cannot invalidate an answer about
   * it — where the old token, the whole derivation's identity, moved on every
   * write anywhere in the vault.
   */
  readonly at: Accessor<number>
}

export const createReading = (
  request: Accessor<PageRequest | null>,
): Reading => {
  const answer = olai.streams.page.use(request)
  const [at, moved] = createSignal(0)
  // Registered at creation, which is what the change-iff-fired law asks of a
  // consumer that wants every change: a handler added mid-stream sees only the
  // changes after it.
  const stop = answer.updated?.(() => moved((count) => count + 1))
  onCleanup(() => stop?.())
  return { page: answer, at }
}

const ReadingContext = createContext<Accessor<PageReading | undefined>>()
const FramesContext = createContext<Accessor<number>>()

export function ReadingProvider(props: {
  readonly reading: Reading
  readonly children: JSX.Element
}) {
  return (
    <ReadingContext.Provider value={props.reading.page}>
      <FramesContext.Provider value={props.reading.at}>
        <NamesProvider reading={props.reading.page}>{props.children}</NamesProvider>
      </FramesContext.Provider>
    </ReadingContext.Provider>
  )
}

/** This pane's reading, or a throw when a consumer is drawn outside the
 *  provider — which is a bug in this app, not a state a reader can reach. */
export const useReading = (): Accessor<PageReading | undefined> => {
  const reading = useContext(ReadingContext)
  if (reading === undefined) throw new Error("a page reading outside <ReadingProvider>")
  return reading
}

/**
 * HOW MANY FRAMES this pane's reading has moved on — see {@link Reading.at}.
 *
 * Its readers are the two that wait for a FRAME rather than for a value: the
 * filter, whose answer about the set may not outlive it, and the row editor,
 * which suppresses a blur while it is waiting for the frame that redraws a row
 * it just moved (`./edit/editing.tsx`'s `settling`). Both used to read the
 * derivation's identity, which was a fresh value per revision; neither can read
 * the reading's, because a subscription's value is a store whose identity
 * survives every frame.
 */
export const useFrames = (): Accessor<number> => {
  const frames = useContext(FramesContext)
  if (frames === undefined) throw new Error("a frame count outside <ReadingProvider>")
  return frames
}

/** The narrow door onto one field of a reading — what an id is CALLED. The
 *  table itself, and the rule about when it may move, are `./names.ts`'s. */
const NamesContext = createContext<Accessor<Names>>()

function NamesProvider(props: {
  readonly reading: Accessor<PageReading | undefined>
  readonly children: JSX.Element
}) {
  const named = createNames(() => props.reading())
  return <NamesContext.Provider value={named}>{props.children}</NamesContext.Provider>
}

/** What this page's ids name, for a leaf drawn inside a pane. A throw outside
 *  the provider, for {@link useReading}'s reason. */
export const useNames = (): Accessor<Names> => {
  const names = useContext(NamesContext)
  if (names === undefined) throw new Error("a name lookup outside <ReadingProvider>")
  return names
}

/** Every open pane's reading, for the chrome that has to agree with the focused
 *  one — see the header. */
export interface Readings {
  /** Draw this pane for as long as the component calling it lives. */
  readonly join: (pane: () => number, reading: Accessor<PageReading | undefined>) => void
  /** What the pane at `index` is showing, or `undefined` for a pane that has
   *  not mounted or has not been answered yet. */
  readonly at: (index: number) => PageReading | undefined
}

const ReadingsContext = createContext<Readings>()

export const ReadingsProvider = ReadingsContext.Provider

/** The workspace's readings. A throw outside the provider, for
 *  `drag/fields.ts`'s reason: a pane mounted where nobody meant to mount one. */
export const useReadings = (): Readings => {
  const readings = useContext(ReadingsContext)
  if (readings === undefined) throw new Error("a page reading outside <App>")
  return readings
}

/**
 * The register, made once per app.
 *
 * SUCCESSIVE VALUES rather than one array mutated in place, for the reason
 * `drag/fields.ts` gives: a pane mount is rare and a workspace is a handful of
 * pages, so the copy is not a cost anybody can measure, while an `at` that read
 * a live array would be a reader racing a mount.
 *
 * A PANE'S INDEX IS AN ACCESSOR, not a number taken at mount: panes are
 * reordered and closed, so the pane a page is IN moves under it and a captured
 * index would light the wrong sidebar entry after a drag of the tab strip.
 */
export const createReadings = (): Readings => {
  const [joined, setJoined] = createSignal<
    ReadonlyArray<{
      readonly pane: () => number
      readonly reading: Accessor<PageReading | undefined>
    }>
  >([])
  return {
    join: (pane, reading) => {
      const entry = { pane, reading }
      setJoined((were) => [...were, entry])
      onCleanup(() => setJoined((were) => were.filter((one) => one !== entry)))
    },
    at: (index) => joined().find((one) => one.pane() === index)?.reading(),
  }
}
