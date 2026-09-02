/**
 * WHAT THE PAGE IN FRONT OF SOMEBODY SAYS — asked of the server, once per open
 * pane.
 *
 * This is the browser's half of `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`'s PR
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
 * {@link useNames} is a narrow door onto one field of that answer — what
 * the ids this page points at are CALLED. It is separate because its readers
 * are the leaves: a title that turns out to be an address, and the strip of
 * links a `see` draws. Handing those the whole reading would hand a title
 * resolver a page. The table itself is derived ONCE, beside the reading
 * ({@link Reading.names}), so the chrome outside the panes reads the same
 * lookup the leaves do rather than building a second copy over the same
 * answer.
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

import { createDoors, type Doors } from "./doors.ts"
import { createLicences, type Licences } from "./licences.ts"
import { createNames, type Names } from "./names.ts"
import { olai } from "./wire.ts"

/**
 * One page, asked and kept live — and a token that moves when its answer did.
 *
 * `undefined` is "this pane has never been answered" and is the state every
 * reader below already handles: the pane draws its `Reading…` line, the chrome
 * draws no file, and nothing invents a page that has not arrived. It is also
 * what a caller with no question gets — a `null` input holds the subscription
 * closed, which is the framework's own way of saying "do not ask yet".
 *
 * NEVER "the answer to the question just asked has not landed yet", and that is
 * {@link createReading}'s one rule: the last answer STANDS while the next one is
 * in flight, so a navigation SWAPS this page for the next rather than tearing it
 * down to nothing and building one again.
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
   * row editor, which suppresses a blur while it waits for the frame that
   * redraws a row it just moved (`./edit/editing.tsx`'s `settling`).
   *
   * THE FILTER WAS THE SECOND until `filter-ask-carries-revision`: its answer
   * about which nodes a query selects may not outlive the set it was computed
   * over, and while that answer was a CALL the only way to say so was to re-ask
   * on this number. The answer is a reading of its own on the same pulse now
   * (`./filter/asking.ts`), so the browser holds no token about a set it does
   * not have — see https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/filter-rides-the-page.md.
   *
   * IT CANNOT BE THE VALUE'S IDENTITY, which is what it was when the tab held
   * a derivation: a subscription's value is a RECONCILED STORE, so its identity
   * survives every frame and its fields move underneath — a reader comparing
   * two readings would be comparing one object with itself and concluding that
   * nothing had changed. `./dates.ts` states that rule for the two date
   * readings and answers it by handing out plain values; a page's reading is
   * too big to copy per frame, so this counts the frames instead.
   *
   * COUNTED OFF `Subscription.changed`, which is the framework's own answer to
   * exactly this question (`@kolu/surface`, juspay/kolu#2190). It was not, for
   * two releases: registering an `updated` handler — the only change channel
   * there was — put two `structuredClone`s of the whole page on every frame to
   * hand over a `{prev, next}` pair this file discarded, two deep copies of a
   * hundred kilobytes per keystroke for an integer
   * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md §3.6). So the count was
   * taken off the STORE instead, by a module of this client's own
   * (`frames.ts`, deleted with this line), which said in its header that it was
   * a stand-in and named the upstream fact that would end it. `changed` is that
   * fact: the same change-iff-fired law, fired at the same moments, with no
   * snapshot taken for anybody who did not ask for one.
   *
   * THE LAW, in the three clauses its readers were written against: a FIRST
   * frame is a value rather than news; the blank a new question opens with
   * re-arms that rule rather than counting (the framework resets the tracker
   * when the input moves); and an equal reconnect snapshot is SILENT. The
   * stand-in kept the first two and could not keep the third — an identical
   * frame replaced every array element in the store, so a reader of the store
   * saw it. Since the `page` stream now declares what identifies a row
   * (`@olai/surface`'s `arrayKey`), an identical frame writes nothing either,
   * and the two readings agree.
   *
   * WHAT THE THIRD CLAUSE COSTS, named rather than implied, because the
   * paragraph above is about the CLONES and the clones are not the whole bill.
   * `createUpdatedTracker` short-circuits in O(1) only while NOBODY is
   * subscribed on either channel; registering here — `changed` or `updated`
   * alike — drops it through to `framesEqual` of the whole frame on every
   * changed frame, and kolu's own docstring says that compare "still runs, and
   * must", since it is what decides that an equal reconnect snapshot is silent.
   * So this is not free where the stand-in was: `frames.ts` walked the object
   * SPINE above the arrays, which for a page reading is a handful of nodes
   * whatever the page holds, where this is O(frame). What is bought for it is
   * the clause itself, plus never paying the two `structuredClone`s again — and
   * it is dwarfed by what the declaration beside it stops, which is every
   * per-row binding on the page re-running for a frame that said nothing.
   *
   * THE PAGE ITSELF is the right granularity, and narrower than what it
   * replaced: a revision that moved nothing on this page sends no frame at all
   * (the server's `samePageReading`), so it cannot invalidate an answer about
   * it — where the old token, the whole derivation's identity, moved on every
   * write anywhere in the vault.
   */
  readonly at: Accessor<number>
  /**
   * What the ids this page points at are CALLED — `./names.ts`'s table, derived
   * once here so the pane's leaves and the chrome outside it (the palette's pin
   * row) look up the same Map. A second `createNames` over this reading would
   * copy the array again on every navigation, which is the defect this field
   * closes (`https://github.com/juspay/oss.olai/blob/main/projects/olai/roadmap/deferred.org`'s `names-table-once`).
   */
  readonly names: Accessor<Names>
  /**
   * ...and what the property VALUES it draws name — `./doors.ts`'s table,
   * derived here for {@link Reading.names}' reason exactly: one table per
   * reading, so every chip inside the pane looks up the one Map the page
   * arrived with rather than a copy per component.
   */
  readonly doors: Accessor<Doors>
  /**
   * ...and which of them a running plugin's contributed KIND claims —
   * `./licences.ts`'s table, derived here for the same reason its two siblings
   * are. It is what a live FACE is looked up by (`./live/seam.ts`), where the
   * dressing table used to settle for the property key because the key was all
   * a tab had.
   */
  readonly licences: Accessor<Licences>
  /**
   * WHICH QUESTION the page in hand is an answer TO — `null` before the first
   * one, and the PREVIOUS address for as long as {@link page} is holding one.
   *
   * ONE READER, and it is the other half of the join {@link createReading}'s
   * `holding` is: a narrowed pane draws a page and a narrowing that are two
   * members and two frames, and holding the page covers only the order where the
   * PAGE lands first — which is the order that happens. The other one would
   * prune the page BEFORE by ids that name nothing on it, emptying the pane; it
   * is measured not to occur and is promised by nothing, so the pane spends an
   * answer only on the page it is ABOUT (`./pane/PageView.tsx`'s `together`) and
   * this is how it asks.
   */
  readonly about: Accessor<PageRequest | null>
}

/** The page in hand and the question it answers, held as ONE value — two memos
 *  would be two moments, which is the whole thing this pair exists to close. */
interface Answered {
  readonly page: PageReading
  readonly about: PageRequest | null
}

export const createReading = (
  request: Accessor<PageRequest | null>,
  /**
   * WHILE THIS IS TRUE, WHAT IS IN HAND STAYS IN HAND — the pane's own answer
   * to "is there a second reading about this page that has not arrived yet".
   *
   * ONE CALLER and one reason: a NARROWED pane (`./filter/asking.ts`'s
   * `Asked.awaiting`). A page and its narrowing are two members read on one
   * pulse and delivered as two frames, and the page's lands first — so a pane
   * arriving at a `?q=` address would draw the page WHOLE for a frame before
   * the query the address spelled took rows off it. Held, what was on screen
   * stays on screen and a pane with nothing on screen yet draws its `Reading…`
   * line, which is the beat `vault-in-browser` §5a already licenses.
   *
   * IT IS THE CALLER'S PREDICATE and not a rule about filters, because this
   * seam has no business knowing what a filter is: what it is asked is whether
   * to hold, and the one thing it promises in return is that a hold is never
   * permanent — the caller drops it when its own reading fails, exactly as it
   * drops it when one arrives.
   *
   * Absent for every other pane, which is what an unheld reading has always
   * been.
   */
  holding?: Accessor<boolean>,
): Reading => {
  const answer = olai.streams.page.use(request)
  /** The generation — see {@link Reading.at}. `changed` rather than `updated`
   *  because the payload is the one thing this does not want, and the handler
   *  survives an input change (the framework resets the tracker, which re-arms
   *  the first-frame rule; the handlers belong to the caller). The `?.` is the
   *  channel's own optionality: a hand-assembled `Subscription`-shaped value
   *  may omit it, and every subscription the framework mints provides it. */
  const [at, setAt] = createSignal(0)
  const stop = answer.changed?.(() => setAt((was) => was + 1))
  if (stop !== undefined) onCleanup(stop)
  /**
   * THE LAST ANSWER, HELD ACROSS THE NEXT QUESTION.
   *
   * A subscription blanks its value the moment its INPUT moves: the framework
   * writes `undefined`, resets the tracker, closes the old stream and opens the
   * new one. So a reader taking the value raw sees `A → undefined → B` on every
   * navigation. That beat is honest for a pane with nothing on screen yet, and
   * it is a LIE for every other reader — what is on screen while B is in flight
   * is still A, and the chrome that believed the blank spent one round trip per
   * navigation saying no file is open, no day is open, no node is zoomed
   * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md §3.1: the folder chain
   * folded and was rebuilt, the current wash went out, the page and its filter
   * bar were torn down to `Reading…`).
   *
   * HELD HERE, at the seam that owns the subscription, rather than in each
   * reader: the pane, the sidebar's active entry, the calendar's open day, the
   * palette's names and undo's file all read this one answer, and a hold spelled
   * per reader is one rule kept in five places.
   *
   * A MEMO OVER ITS OWN LAST VALUE, not a signal an effect writes: an effect
   * runs AFTER the render that saw the blank, so the blank would be on screen
   * for a frame before anything put it back — `./stamped.ts` makes that argument
   * about the same frame from the other side. And holding is returning the same
   * REFERENCE, so a blank notifies nobody at all.
   *
   * IT COSTS the previous page's value kept alive while the next is asked for,
   * which is the page the pane is drawing anyway. The wire is untouched: the old
   * stream is closed by the framework either way, and this is a reference to
   * what it left behind.
   *
   * {@link holding} EXTENDS THE SAME HOLD, and nothing else about it: a caller
   * with a second reading of this page still in flight says so, and the answer
   * in hand goes on being the answer.
   */
  const held = createMemo<Answered | undefined>((was) => {
    if (holding?.() === true) return was
    const arrived = answer()
    // WHICH QUESTION THIS ANSWER IS TO, captured as it lands: the framework
    // delivers a frame for the input the subscription is open on, so the
    // request read here is the one that produced it.
    return arrived === undefined ? was : { page: arrived, about: request() }
  }, undefined)
  const page = createMemo(() => held()?.page)
  return {
    page,
    at,
    names: createNames(page),
    doors: createDoors(page),
    licences: createLicences(page),
    about: () => held()?.about ?? null,
  }
}

const ReadingContext = createContext<Accessor<PageReading | undefined>>()
const FramesContext = createContext<Accessor<number>>()
const NamesContext = createContext<Accessor<Names>>()
const DoorsContext = createContext<Accessor<Doors>>()
const LicencesContext = createContext<Accessor<Licences>>()

export function ReadingProvider(props: {
  readonly reading: Reading
  readonly children: JSX.Element
}) {
  return (
    <ReadingContext.Provider value={props.reading.page}>
      <FramesContext.Provider value={props.reading.at}>
        <NamesContext.Provider value={props.reading.names}>
          <DoorsContext.Provider value={props.reading.doors}>
            <LicencesContext.Provider value={props.reading.licences}>
              {props.children}
            </LicencesContext.Provider>
          </DoorsContext.Provider>
        </NamesContext.Provider>
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
 * Its reader is the one that waits for a FRAME rather than for a value: the row
 * editor, which suppresses a blur while it is waiting for the frame that
 * redraws a row it just moved (`./edit/editing.tsx`'s `settling`). It was two
 * until the filter stopped being a call and became a reading of its own
 * ({@link Reading.at}). It used to read the derivation's identity, which was a
 * fresh value per revision, and cannot read the reading's, because a
 * subscription's value is a store whose identity survives every frame — and
 * since the `page` stream declares what identifies a row, its ELEMENTS'
 * identities survive one too, so there is nothing left down there for a reader
 * to mistake for news.
 */
export const useFrames = (): Accessor<number> => {
  const frames = useContext(FramesContext)
  if (frames === undefined) throw new Error("a frame count outside <ReadingProvider>")
  return frames
}

/** What this page's ids name, for a leaf drawn inside a pane. A throw outside
 *  the provider, for {@link useReading}'s reason. The table itself is derived
 *  beside the reading ({@link Reading.names}); this hands that one lookup to
 *  the leaves. The rule about when it may move is `./names.ts`'s. */
export const useNames = (): Accessor<Names> => {
  const names = useContext(NamesContext)
  if (names === undefined) throw new Error("a name lookup outside <ReadingProvider>")
  return names
}

/** ...and what this page's property values name, for the chips that draw them.
 *  Its sibling above's shape, its sibling above's throw, and the rule about
 *  when the table may move is `./doors.ts`'s. */
export const useDoors = (): Accessor<Doors> => {
  const doors = useContext(DoorsContext)
  if (doors === undefined) throw new Error("a door lookup outside <ReadingProvider>")
  return doors
}

/** ...and which of this page's property values a contributed kind claims, for
 *  the drawer that dresses them. Its two siblings' shape, its two siblings'
 *  throw, and the rule about when the table may move is `./licences.ts`'s. */
export const useLicences = (): Accessor<Licences> => {
  const licences = useContext(LicencesContext)
  if (licences === undefined) throw new Error("a licence lookup outside <ReadingProvider>")
  return licences
}

/** Every open pane's reading, for the chrome that has to agree with the focused
 *  one — see the header. */
export interface Readings {
  /** Draw this pane for as long as the component calling it lives. */
  readonly join: (pane: () => number, reading: Reading) => void
  /** What the pane at `index` is showing, or `undefined` for a pane that has
   *  not mounted or has not been answered yet. */
  readonly at: (index: number) => PageReading | undefined
  /** What the ids that pane's page points at are called — the same table the
   *  pane's leaves read. An empty lookup for a pane that has not mounted,
   *  which is what `createNames` hands back for an unanswered reading. */
  readonly names: (index: number) => Names
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

/** No pane has joined yet — every id is unnamed. */
const unnamed: Names = () => undefined

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
      readonly reading: Reading
    }>
  >([])
  return {
    join: (pane, reading) => {
      const entry = { pane, reading }
      setJoined((were) => [...were, entry])
      onCleanup(() => setJoined((were) => were.filter((one) => one !== entry)))
    },
    at: (index) => joined().find((one) => one.pane() === index)?.reading.page(),
    names: (index) =>
      joined().find((one) => one.pane() === index)?.reading.names() ?? unnamed,
  }
}
