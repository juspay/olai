/**
 * ⌘K command palette — the shell, jump-to-node search, and what it can WRITE.
 *
 * Navigation, panel toggles, reset widths, a `>` prefix that sends the rest to
 * the agent — and, under the shell rows, NODES: the query goes to the server's
 * search procedure as you type (debounced, latest-wins), and every hit is a
 * row that jumps to that node's page. The matching is entirely the server's —
 * the same reading an agent's `search_nodes` gets — so what this palette finds
 * and what an agent finds cannot drift (items.ts says why there is no local
 * matcher).
 *
 * Between the two: the directory's documents, which arrive as hits like
 * name and path against the served list this tab already holds, drawn with the
 * sidebar's own glyph, and opening the document's address the router has served
 * all along. They are keyed on the NAME and nowhere near a body — the grammar
 * above still selects nodes, and a document is prose.
 *
 * ## The two things it writes
 *
 * **OP ROWS**, about the node the reader has ZOOMED (`./ops.ts`): the same
 * verbs the `•••` menu offers, from the same pure catalog, through the same
 * write gate (`../writes.ts`) — so `Complete` chosen here and `Complete`
 * chosen there are one op, one refusal and one undo entry. There are none of
 * them on a page that is not one node, because a command list read out of
 * context must never be aimed at a node the reader cannot see.
 *
 * **QUICK CAPTURE**, on a `+` prefix — racket's `olai add`, and the one write
 * in this app whose whole promise is that nothing moves: the page, the scroll
 * and the caret stay where they are, the line goes to the directory's inbox,
 * and the box empties for the next one. Where the inbox IS is the server's
 * (`../../../../server/src/edit.ts`), for the same reason every placement is.
 *
 * ## What it says afterwards
 *
 * ONE line, in the two moods a write has (`../edit/undoing.ts`'s `Said`), and
 * the palette STAYS OPEN whenever there is one: a refusal is why nothing
 * happened, and a modal that closed on top of it would be the silent failure
 * HACKING.md's error rule is about. A write that landed with nothing to add
 * closes the palette, which is what choosing a command means.
 *
 * `>` ask and the search both use `run` with a real failure handler for the
 * same reason (run.ts forbids a silent handler).
 */

import { Key } from "@solid-primitives/keyed"
import {
  createEffect,
  createMemo,
  createSelector,
  createSignal,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js"

import type { Zoomed } from "@olai/format"
import type { Edit, OpFailure } from "@olai/surface"
import { Result as Outcome } from "effect"

import { releaseArmed, restoreArmed } from "../chat/armed.ts"

import type { Names } from "../names.ts"
import { ALARM_BAND, SaidLine } from "../edit/SaidLine.tsx"
import { desktop } from "../layout/media.ts"
import {
  resetPanelWidths,
  setChatOpen,
  toggleChat,
} from "../layout/prefs.ts"
import { LAYER, WITHIN } from "../layer.ts"
import { topmostWhileOpen } from "../topmost.ts"
import { only } from "../narrow.ts"
import { Refusals } from "../refusals.tsx"
import type { Route } from "../routes.ts"
import { TESTID } from "../testids.ts"
import { olai } from "../wire.ts"
import { run } from "../run.ts"
import {
  boxOf,
  CAPTURE_PREFIX,
  filterItems,
  hitItems,
  type PaletteItem,
  SHELL_ITEMS,
} from "./items.ts"
import { opItems } from "./ops.ts"
import { usePins } from "../pins/answered.tsx"
import { askName, namingFor } from "../pins/naming.ts"
import { pinnedAt } from "../pins/pins.ts"
import { pinItem } from "../pins/palette.ts"
import { sayPin, togglePin } from "../pins/pinning.ts"
import { nameOf, shownIn } from "../address/address.ts"
import { type Asking } from "./asking.ts"
import { Question } from "./Question.tsx"
import { SearchCount } from "../search/Count.tsx"
import { createCursor } from "../search/cursor.ts"
import { createSearch } from "../search/nodes.ts"
import { Result, type RowTestids } from "../search/Result.tsx"
import { spend } from "../settled.ts"
import {
  askInPalette,
  closePalette,
  dropQuestion,
  openPalette,
  paletteAsking,
  paletteOpen,
} from "./open.ts"
import { type Said, useUndo } from "../edit/undoing.ts"
import { applied, applying } from "../writes.ts"
import { isEditingTarget, listKey, matchKey, paneKey } from "../keys.ts"
import { useRouter } from "../router.tsx"
import { isLone } from "../workspace.ts"
import { Shortcuts } from "./Shortcuts.tsx"

/** WHERE an alarm sits in this panel: a full-width band between the box and
 *  the list, at this door's own gutter. The alarm's SKIN is
 *  `../edit/SaidLine.tsx`'s (`ALARM_BAND`, shared with the two narrower
 *  panels); the `px-4` is the palette's, because its rows set it. Three things
 *  this panel can alarm about — a refused ask, a search that fell over, a
 *  token the grammar cannot read — and one band. */
const ALERT_ROW = `${ALARM_BAND} px-4`

/** What this door calls its rows — see `../search/Result.tsx`'s `RowTestids`
 *  for why the three travel as one value. */
const PALETTE_ROW: RowTestids = {
  row: TESTID.paletteItem,
  place: TESTID.paletteItemPlace,
  prop: TESTID.paletteItemProp,
}

export function Palette(props: {
  readonly go: (route: Route) => void
  /**
   * Toggle the directory panel in a mode-aware way: desktop sidebar open/rail,
   * or the mobile drawer. Owned by App because the mobile state is ephemeral.
   */
  readonly toggleDirectory: () => void
  /**
   * The node this tab has ZOOMED, and the whole of what the op rows are about
   * — `undefined` on every other page, which is what makes them absent there.
   *
   * Handed down rather than zoomed again from the route: the FOCUSED pane's
   * reading has already resolved the address into a page (`App.tsx`), and a
   * second answer to "what is open" could differ from the one on screen. It
   * carries `under` with it, which is the number the archive row's confirm
   * names — counted where the set is, like every other fact on a reading.
   */
  readonly zoomed: Extract<Zoomed, { readonly kind: "node" }> | undefined
  /** What the ids the FOCUSED page points at are called — the one thing the
   *  shelf's row needs that an address cannot say (`../pins/palette.ts`). */
  readonly names: Names
}) {
  // ⌘Z / ⌘⇧Z belong to the outline's undo stack; what this file owns is the
  // ONE window listener the global layer has (../keys.ts), and a second one
  // for two more chords would be exactly the disagreement that registry exists
  // to make impossible. Reached the way the row editor reaches it rather than
  // handed down as two props — same object, one access path.
  const undo = useUndo()
  const pins = usePins()
  const router = useRouter()
  const [keys, setKeys] = createSignal(false)
  const [query, setQuery] = createSignal("")
  // WHICH row Enter takes, and the arrows that walk it — the one cursor every
  // shortlist in this client shares (`../search/cursor.ts`).
  const cursor = createCursor(() => items().length)
  /**
   * WHETHER THE HIGHLIGHT IS A CHOICE, and the reason the op rows are allowed
   * to be first.
   *
   * The cursor answers "which row is the walk on"; this answers a different
   * question it deliberately does not — "has anybody chosen anything yet?" An
   * untouched palette has not: nothing is lit, and Enter does nothing at all,
   * so the list can LEAD with the rows that write the directory without a
   * stray ⌘K-then-Enter meaning `Mark todo`. The first character typed is the
   * choice, and so is the first arrow or hover.
   *
   * It is the palette's own rather than a state on the shared cursor because
   * the other two surfaces that walk a list want the opposite: a completion
   * popup and the header's results open with their best match already lit,
   * which is what a type-ahead is. This modal opens with an EMPTY box, which
   * is what makes it the one list nobody has asked a question of yet.
   */
  const [chosen, setChosen] = createSignal(false)
  /**
   * WHICH ROW IS LIT, asked per row — Solid's own primitive for exactly this
   * shape, the way the sidebar already asks which entry is the open one.
   *
   * Read as `chosen() && index() === cursor.at()` it was O(rows) work per
   * change: `cursor.at()` reads `items().length`, so every row of the list
   * re-evaluated its `active` binding whenever the list moved OR the cursor
   * did, where at most two rows can have changed
   * (docs/brainstorming/reactivity-after-the-flip.md §4.6). `createSelector`
   * keeps one signal per subscribed key and wakes only the row that was lit
   * and the row that now is.
   *
   * The UNCHOSEN state is folded in as `-1` rather than left as a second
   * condition per row, because it is the same question: an untouched palette
   * has no row lit ({@link chosen}), and a row asking twice is a row that can
   * be woken twice.
   */
  const lit = createSelector(() => (chosen() ? cursor.at() : -1))
  const [askError, setAskError] = createSignal<string | null>(null)
  /** What the last write had to say — a refusal in the ops layer's own words,
   *  or a remark about one that landed. */
  const [said, setSaid] = createSignal<Said | null>(null)
  /**
   * A WRITE IS IN FLIGHT — the date picker's rule, in the surface that needed
   * it most: "the gate is a round trip, and a second Enter while the first is
   * in flight is two writes for one intention" ({@link ../date/DatePicker.tsx}).
   *
   * The capture is what makes it load-bearing rather than tidy. It keeps the
   * box AND the palette, so nothing visible has happened while the round trip
   * is out — which is exactly the moment a hand repeats the key. The second
   * send is judged against the reading the first has not landed in yet, so on
   * a directory with no inbox both resolve to the same `create _olai/Inbox.olai`,
   * and the write gate re-plans that REQUEST rather than re-resolving the
   * edit: the second comes back refused in the words `create_outline` gets —
   * *already an outline … capture into this one with `add_node`* — over a line
   * that DID land, and the refusal overwrites the remark saying so. Found by
   * review, 2026-08-14.
   *
   * It guards every write this palette makes, not just that one, because the
   * argument is about the gate rather than about the verb: two `Complete`s for
   * one press are two ops, and the second is refused for asking about nothing.
   * The `>` ask is deliberately not on it — that is a message to the agent
   * rather than a write to the directory, it closes the palette on its way
   * out, and the composer beside it has always let a person send twice.
   */
  const [sending, setSending] = createSignal(false)
  let input: HTMLInputElement | undefined
  let previousFocus: HTMLElement | null = null
  /** The confirm's own buttons while a question is up — where the caret goes
   *  when the question is raised, and what Tab cycles between. */
  let go: HTMLButtonElement | undefined
  let cancel: HTMLButtonElement | undefined

  /**
   * WHAT THE BOX IS DOING — one value, so "showing the list", "composing a
   * line" and "answering a question" cannot disagree ({@link ./items.ts}'s
   * `Box`). A question that OWNS the box takes it out of both prefixes and out
   * of the list by construction rather than by the order four readers ask in.
   */
  const box = createMemo(() => boxOf(query(), paletteAsking()))
  const listing = () => box().kind === "filter"

  /** What the box is FOR, said in it while it is empty — or, while a typed
   *  question has borrowed it, what that door does with nothing typed, which
   *  is how "Enter with nothing" becomes something a reader can see rather
   *  than a promise. */
  const boxSays = () => {
    const it = box()
    if (it.kind === "answering" && it.question.kind === "line") {
      return it.question.placeholder
    }
    // The full teaching line is wider than a 360pt box at this type size,
    // and a placeholder that ends `agent, -` is worse than a shorter one.
    return desktop()
      ? "Jump, toggle, > ask the agent, + capture a line…"
      : "Jump, toggle, ask…"
  }

  /**
   * WHAT THIS BOX IS ASKING — the query, or `null` while it is asking nothing:
   * the palette is shut, or the line carries a prefix. Neither `>` nor `+` is a
   * lookup, and asking for one would spend a round trip per keystroke on a
   * sentence nobody is looking things up with.
   *
   * ONE accessor, because two lists are answered from it — the nodes over the
   * wire and the documents in this tab — and "when is this box asking" is a
   * different question from "what does that list do with the answer". Spelled
   * per consumer, the two would be free to gate differently: a prefix that took
   * the node search away and left the file rows standing is a list answering a
   * line nobody is searching with.
   */
  const asked = () => (paletteOpen() && listing() ? query() : null)

  /**
   * WHAT THE FOCUSED PAGE IS CALLED — asked once, here, because two things
   * want the same answer: the shelf's row draws it on its second line, and the
   * box that asks for a pin's name wears it as the placeholder
   * (`../pins/naming.ts`). It is the one fact about a page an address cannot
   * say on its own, and it rides on that page's own reading (`../reading.tsx`).
   */
  const called = createMemo(() =>
    nameOf(router.route(), shownIn(props.names, router.route()))
  )

  // The nodes, from the server — one primitive, its own failure, and no
  // request bookkeeping in this component ({@link ../search/nodes.ts}).
  const nodes = createSearch(asked)
  /**
   * The zoomed node's verbs — its OWN memo, and guarded on the palette being
   * open, which is what keeps them from being rebuilt for nobody.
   *
   * Both halves of that matter. `props.zoomed` is minted afresh on every
   * revision the server publishes a new reading for, so a memo that read it
   * beside the query would rebuild this catalog on every write to the page with
   * the modal shut, and again on every keystroke typed into it. Solid re-tracks
   * per run, so while the palette is closed this depends on `paletteOpen()` and
   * nothing else.
   */
  const opRows = createMemo(() =>
    paletteOpen() ? opItems(props.zoomed, props.zoomed?.under) : []
  )

  const items = createMemo(() => {
    // NOTHING FOR A MODAL NOBODY CAN SEE, and it is the first line for the
    // reason `opRows` above is guarded: everything below reads values that move
    // on their own. `pins()` moves whenever anything pinned is retitled
    // anywhere, `router.route()` on every navigation, and `props.names` twice
    // per navigation — so a shut palette rebuilt its whole list, re-parsing the
    // shelf for `pinnedAt` each time, on every one of them
    // (docs/brainstorming/reactivity-after-the-flip.md §4.5). Solid re-tracks
    // per run, so while the palette is shut this depends on `paletteOpen()`
    // and nothing else.
    if (!paletteOpen() || !listing()) return [] as ReadonlyArray<PaletteItem>
    // THE OP ROWS FIRST, because they are the only rows that are about what
    // the reader is looking at — a list whose contextual half is below the
    // fold is a list nobody finds them in. What makes that safe is
    // {@link chosen}: an untouched palette has no row chosen, so being at the
    // top is not being one keystroke from a write.
    // THE SHELF'S ROW sits with the commands: it is about the page rather than
    // about the zoomed node, so it belongs with the contextual half and not
    // with the fixed ones — and it is the one door a document or a filtered
    // page has that a reader can find by looking (../pins/palette.ts).
    const commands = [
      ...opRows(),
      pinItem(router.route(), pins(), called()),
      ...SHELL_ITEMS,
    ]
    // THEN THE HITS, which is the order they can be ANSWERED in: the commands
    // are matched in this tab off a list it already holds, and a hit is a
    // debounce and a round trip away. A block that arrives late must not push
    // the rows a reader is already walking down the list under their cursor,
    // so the local block sits above it and the list only ever grows at the
    // bottom.
    //
    // THE FILES ARE IN THAT SECOND BLOCK NOW. They were a third, matched here
    // over the served paths by a matcher of this palette's own — which was the
    // right shape while a search could not see a document at all, and is a
    // second index the day one can (`@olai/format`'s `matchingDocuments`). One
    // reading answers both kinds, so a row is drawn from the same hit whichever
    // it is, and typing a word that is in a document's PROSE finds it here
    // exactly as it does in the header's box.
    // THE HITS CARRY THE SEARCH THEY CAME OUT OF (`../settled.ts`'s `Taking`),
    // which is what lets `Enter` be refused for a row of a query the reader
    // has typed past WITHOUT being refused for the command rows above it —
    // those are matched in this tab and are never behind anything.
    return [
      ...filterItems(query(), commands),
      ...hitItems(nodes),
    ]
  })

  /** Everything this modal is holding, put down — one spelling, because the
   *  two moments that need it (opening, and closing) are the same list, and a
   *  list kept at two sites is a signal somebody forgets to add to one of
   *  them. `text` is what the box starts with: empty, or a primed prefix. */
  const blank = (text = "") => {
    setQuery(text)
    cursor.top()
    setChosen(false)
    setAskError(null)
    setSaid(null)
  }

  const close = () => {
    // The question goes with it, because the question is PART of what the
    // palette is showing (`./open.ts`) rather than a second thing this
    // component has to remember to put down.
    closePalette()
    blank()
    const back = previousFocus
    previousFocus = null
    queueMicrotask(() => back?.focus())
  }

  /** The box, primed with a prefix and the caret after it — what the capture
   *  row does, and what a capture that landed leaves behind for the next line.
   *  Whatever was said stays: a prime is not an answer to it. */
  const prime = (prefix: string) => {
    setQuery(prefix)
    cursor.top()
    setChosen(false)
    input?.focus()
  }

  /**
   * Opening is an EFFECT of the signal rather than something a door does, so
   * every door opens the same palette: the chord below, and the header's
   * magnifier on a phone, which sets the signal and knows nothing about a
   * caret or a remembered focus. Whoever opens it, the box is empty and the
   * caret is in it.
   */
  createEffect(() => {
    if (!paletteOpen()) return
    previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    blank()
    // The element is not attached at the instant the signal flips.
    queueMicrotask(() => input?.focus())
  })

  /**
   * …and a question that OWNS the box arrives with the words it starts with.
   *
   * Its own effect, on its own dependency, which is what keeps the two apart:
   * opening is about the modal (blank the box, take the caret, remember where
   * the reader came from) and this is about one question. Folded into the one
   * above, a question raised over an ALREADY-OPEN palette would re-run the
   * open — re-blanking the box it is about to fill and forgetting the focus to
   * go back to — and a CONFIRM raised over a typed filter would wipe the
   * filter it is drawn over, which is not what backing out of one has ever
   * done.
   */
  createEffect(
    on(paletteAsking, (question) => {
      if (question?.kind !== "line") return
      blank(question.initial)
    }),
  )

  const runItem = (item: PaletteItem) => {
    const action = item.action
    // The two that do not finish: a write may have something to say and a
    // prefix has not been typed yet, so neither of them reaches the `close()`
    // at the bottom.
    if (action.kind === "edit") {
      if (action.confirm === undefined) {
        sendEdit(action.edit)
        return
      }
      // ASKING is all this does. What ANSWERING it does is `answer`, called
      // from the question's own button and from Enter — the `•••` menu's rule
      // word for word: "ask, then do" stays two call sites rather than one
      // function telling them apart by which row it was handed.
      setSaid(null)
      askInPalette({
        kind: "confirm",
        label: item.label,
        question: action.confirm,
        edit: action.edit,
      })
      return
    }
    if (action.kind === "prefix") {
      setSaid(null)
      prime(action.prefix)
      return
    }
    if (action.kind === "pin") {
      // The palette STAYS UP while this one is in flight, exactly as an op row
      // does, because the answer belongs in the box the reader is looking at.
      pinPage((line) => {
        if (line === undefined) close()
        else setSaid(line)
      })
      return
    }
    if (action.kind === "route") props.go(action.route)
    else if (action.kind === "shortcuts") setKeys(true)
    else if (action.kind === "toggle-sidebar") props.toggleDirectory()
    else if (action.kind === "toggle-chat") toggleChat()
    else if (action.kind === "reset-widths") resetPanelWidths()
    else if (action.kind === "close-pane") router.close()
    close()
  }

  /**
   * One op, at the write gate — and the palette stays up if there is anything
   * to say about it.
   *
   * `applying` is the pointer's own write (`../writes.ts`), so a refusal comes
   * back in the ops layer's own words and a nudge from a write that landed
   * comes back too. It records on the SAME undo stack a keystroke and a `•••`
   * entry record on, so ⌘Z does not mean something different depending on
   * which surface made the edit.
   */
  const sendEdit = (edit: Edit) => {
    if (sending()) return
    setSending(true)
    setSaid(null)
    void applying(edit, undo.record).then((line) => {
      setSending(false)
      if (line === undefined) {
        close()
        return
      }
      setSaid(line)
    })
  }

  /**
   * THE PAGE, PINNED OR UNPINNED — the one gesture behind two doors: the ⌘⇧P
   * chord below, and the palette row that names it.
   *
   * It is about `router.route()` — the FOCUSED pane's address, filter and all
   * — because that is what "this page" means in a workspace that may be split,
   * and it is the same reading the sidebar lights an entry from (`../App.tsx`).
   * Which of the two writes it is is the shelf's answer rather than a state
   * here (`../pins/pinning.ts`), and WHETHER it writes at all before asking
   * what to call it is `../pins/naming.ts`'s.
   *
   * ONE FUNCTION for both doors, because that second decision is one rule and
   * a rule spelled at two call sites is a rule that eventually differs — the
   * chord would go on asking after the row stopped, or the other way round.
   * What genuinely differs between them is only WHERE THE ANSWER GOES, which
   * is why that is the parameter: a chord has nothing on screen but the line
   * under the header, and a row chosen in this palette has this box.
   */
  const pinPage = (said: (line: Said | undefined) => void): void => {
    // A QUESTION OWNS THIS MODAL, so the chord is dead while one is up — which
    // is the same rule the caret, Tab and Escape already keep here: a question
    // is answered or backed out of, and nothing pressed elsewhere becomes its
    // answer or writes past it. Read forwards it is the fix for what a REPEAT
    // press did: this gesture's own question is already on screen, so raising
    // it again is asking a second time, and the effect that raises one hands
    // the box back its opening words — wiping the name half-typed into it
    // (opencode, on #282). Read backwards it also keeps a chord from writing
    // the directory while some OTHER question stands unanswered.
    //
    // Silent, deliberately: the question the press would have asked is the
    // thing on screen, and a line saying so under the header would be this app
    // telling a reader what they are looking at.
    if (paletteAsking() !== null) return
    // ASKED ONCE and read twice: whether this page is already a door is a
    // parse of every row on the shelf, and both halves of the gesture — does
    // it ask for a name, and which write does it send — are readings of that
    // one answer (`../pins/pins.ts`).
    const already = pinnedAt(pins(), router.route())
    const naming = namingFor(router.route(), already, called())
    if (naming !== null) {
      askName(naming)
      return
    }
    void togglePin(router.route(), already, undo.record).then(said)
  }

  /**
   * The question answered: it goes, and the verb behind it does.
   *
   * A TYPED question is resolved into its op HERE rather than when it was
   * raised, because the words do not exist yet then — and the refusal that
   * resolution can carry keeps the question UP with the words still in the
   * box, which is the same promise a refused capture makes to its line. The
   * write that lands closes the palette through {@link sendEdit}, which is
   * what takes the question down.
   *
   * What the answer MEANS is the asker's, carried on the question
   * (`./asking.ts`): this knows that a typed one resolves to a write or to a
   * sentence, and nothing about pins.
   */
  const answer = (question: Asking) => {
    if (question.kind === "confirm") {
      dropQuestion()
      sendEdit(question.edit)
      return
    }
    const outcome = question.resolve(query())
    if (Outcome.isFailure(outcome)) {
      setSaid({ tone: "alarm", text: outcome.failure })
      return
    }
    sendEdit(outcome.success)
  }

  /**
   * The captured line, and then the box empties for the next one.
   *
   * STAYING OPEN is the gesture rather than a convenience: capture is what a
   * person does when several things arrive at once, and a modal that shut
   * after each of them would ask for the chord again every time. A REFUSAL
   * keeps the text exactly where it is — the same promise a refused title
   * commit makes to a draft — so an inbox whose file will not parse is
   * something to fix rather than something to retype.
   *
   * A BLANK LINE IS SENT LIKE ANY OTHER, and that is deliberate: the resolver
   * declines to fence it ("a fence there would be a fence one face has"), so
   * the ops layer refuses it in the words an agent's `add_node` gets — *a node
   * needs a title* — and they land in the slot below. A guard here would have
   * been a rule only this face has AND an Enter that did nothing and said
   * nothing, which is the failure this slot exists to prevent.
   *
   * WHERE IT LANDED comes off the ANSWER. The whole argument for the `capture`
   * verb is that only the server knows which file the inbox is; a sentence
   * naming one from here would be that argument contradicted one line later,
   * and wrong out loud for a directory that keeps `notes/inbox.olai`.
   */
  const sendCapture = (text: string) => {
    if (sending()) return
    setSending(true)
    setSaid(null)
    void applied({ verb: "capture", title: text }, undo.record).then((outcome) => {
      setSending(false)
      if (Outcome.isFailure(outcome)) {
        setSaid({ tone: "alarm", text: outcome.failure.message })
        return
      }
      prime(`${CAPTURE_PREFIX} `)
      // The op's own remark if it made one, and otherwise this app's: a write
      // whose whole point is that nothing on screen moves has to say that it
      // happened, or it is indistinguishable from a key that did nothing.
      const landed = outcome.success
      setSaid({
        tone: "aside",
        text: landed.nudge ?? `captured “${landed.title}” to ${landed.file}`,
      })
    })
  }

  /**
   * `>` sends, and it sends what the COMPOSER is holding as well.
   *
   * This is the second door to one message. A node armed from a row
   * (`../chat/armed.ts`) is part of the message being written, not part of the
   * box it is being written in — so a send from here that ignored the strip
   * would ask the agent a question with the subject left off, and leave the
   * chip sitting in a composer whose message has already gone.
   *
   * It follows the composer's own order for the same reason
   * (`../chat/Composer.tsx`): release before the call, put back what a refusal
   * threw away, and only into a strip nobody has armed since.
   */
  const sendAsk = (text: string) => {
    if (text.trim() === "") return
    setAskError(null)
    const context = releaseArmed()
    run(
      olai.procedures.chat.send({ text, context }),
      (failure: OpFailure) => {
        setAskError(failure.message)
        restoreArmed(context)
        // Leave the palette open so the refusal is visible; open the panel
        // so the reader can also recover there.
        setChatOpen(true)
      },
      () => {
        setChatOpen(true)
        close()
      },
    )
  }

  const confirm = () => {
    // THE QUESTION FIRST, above both prefixes, for the reason the Switch draws
    // it first: it is up because somebody chose the verb that asks it, and
    // nothing they type next may quietly become the answer — nor may Enter
    // quietly become something ELSE while it is standing there. Read the other
    // way round, `+ …` typed into a box behind the question sent a capture on
    // an Enter the reader aimed at the question (review, 2026-08-14): the
    // layout kept the promise and the key did not.
    //
    // Reaching this from the BOX at all takes a deliberate click back into it,
    // because raising the question moves the caret onto its own button — so
    // the ordinary path is the button's own Enter, and this is the belt.
    const it = box()
    if (it.kind === "answering") {
      answer(it.question)
      return
    }
    if (it.kind === "ask") {
      sendAsk(it.text)
      return
    }
    if (it.kind === "capture") {
      sendCapture(it.text)
      return
    }
    // Nothing lit is nothing chosen — see {@link chosen}. No `?? list[0]`
    // fallback: that is exactly the keystroke this palette must not turn into
    // a write nobody aimed.
    if (!chosen()) return
    // ...and neither is a row of an answer the reader has typed past, which is
    // the same sentence one turn on: the hits HOLD STILL through the settle
    // and the round trip after it, so for a moment after every keystroke the
    // row under the cursor is the last query's. `spend` asks the ROW rather
    // than this door, because the command rows above the hits are this tab's
    // own and are never behind anything (`../settled.ts`).
    //
    // The key is claimed either way — the handler below preventDefaults every
    // list key — and a POINTER does not come through here at all: `onSelect`
    // runs the row it pressed, which is the row the hand can see.
    spend(items()[cursor.at()], runItem)
  }

  /**
   * The arrows, and the way IN to a list nobody has chosen from yet.
   *
   * From nowhere, down lands on the FIRST row and up on the LAST — which is
   * what a keyboard walking an unchosen list expects, and what `cursor.step`
   * cannot express on its own: it wraps from wherever it is standing, and
   * where it is standing before anybody has chosen is the top.
   */
  const walk = (by: 1 | -1) => {
    const many = items().length
    if (many === 0) return
    if (!chosen()) {
      setChosen(true)
      cursor.to(by === 1 ? 0 : many - 1)
      return
    }
    cursor.step(by)
  }

  /**
   * The palette on the client's one dismissal stack (`../topmost.ts`).
   *
   * It is a layer like any other — it answers Escape (below) and a press on its
   * own scrim — and being off that stack was the same bug the `•••` menu had
   * against the header's popovers: `⌘K` is `whileEditing: true`, so it opens
   * with the caret inside an open popover and WITHOUT a press anywhere, which
   * leaves both up. One Escape then ran the popover's handler (on the document)
   * and this one (on the window, which is later in the same bubble) — two
   * panels, one keystroke. The ticket is what makes the popover defer; the
   * guard below is the other direction, for whatever opens over this one next.
   */
  const topmost = topmostWhileOpen(paletteOpen)

  /** Escape backs out of the question first and closes the palette second —
   *  one key, the nearest thing it can dismiss, which is what it means
   *  everywhere else in this app. */
  const escape = () => {
    const question = paletteAsking()
    if (question === null) {
      close()
      return
    }
    dropQuestion()
    // A TYPED question hands the box back empty: the words were about the
    // question, and a name backed out of must not become the filter over the
    // list underneath it. A confirm never took the box, so what was typed
    // behind it is still there — which is what backing out of one has always
    // left.
    if (question.kind === "line") setQuery("")
    input?.focus()
  }

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      const pane = paneKey(event)
      if (pane !== null && !isLone(router.workspace())) {
        event.preventDefault()
        router.stepFocus(pane === "focusLeft" ? -1 : 1)
        return
      }
      const match = matchKey(event)
      if (match === null) {
        if (paletteOpen() && topmost() && event.key === "Escape") {
          event.preventDefault()
          escape()
        }
        // Simple focus trap: keep Tab inside the dialog while open — and
        // inside the QUESTION while one is up, which is the part that stopped
        // being simple when the confirm moved in here. Sending Tab back to the
        // box then would have been a trap that made the two buttons it draws
        // unreachable by keyboard (review, 2026-08-14), so while the question
        // is standing Tab cycles its two ways out and nothing else.
        if (paletteOpen() && event.key === "Tab") {
          event.preventDefault()
          const question = paletteAsking()
          if (question === null) input?.focus()
          else if (document.activeElement === go) cancel?.focus()
          // A TYPED question's answer is written in the box, so the box is one
          // of its ways out and the cycle goes back through it. A confirm's is
          // not: there is nothing to type, and Tab there is the two buttons.
          else if (document.activeElement === cancel && question.kind === "line") {
            input?.focus()
          } else go?.focus()
        }
        return
      }
      if (!match.whileEditing && isEditingTarget(event.target)) return
      event.preventDefault()
      if (match.action === "palette") {
        if (paletteOpen()) close()
        else openPalette()
        return
      }
      if (match.action === "sidebar") props.toggleDirectory()
      if (match.action === "chat") toggleChat()
      // Reached only with the caret nowhere — both chords are
      // `whileEditing: false`, so a draft keeps the platform's own undo and
      // Escape keeps abandoning.
      if (match.action === "undo") undo.undo()
      if (match.action === "redo") undo.redo()
      if (match.action === "closePane") router.close()
      // The shelf, from wherever the reader is standing. Its answer goes to
      // the line under the header rather than to this component's, which is
      // the one this palette can draw and is not on screen when the chord is
      // pressed with the modal shut (`../pins/pinning.ts`).
      //
      // A NARROWED page is the one press that asks first: the chord is live in
      // the filter box, which is exactly where "keep this, narrowed like this"
      // is meant — and it is the one address nothing in the set can name
      // (`../pins/naming.ts`). Asking opens this palette with the box holding
      // the question, so Enter alone still writes the bare pin the chord always
      // wrote.
      if (match.action === "pin") pinPage(sayPin)
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  return (
    <>
    <Shortcuts open={keys()} onClose={() => setKeys(false)} />
    <Show when={paletteOpen()}>
      {/* On a phone this is a sheet under the header, not a card hanging in
          20vh of empty air: a `max-h-72` list under that padding sliced the
          last row through the rounded clip, and the teaching placeholder
          ended `agent, -`. Desktop keeps the floating card. */}
      <div
        class={`fixed inset-0 ${LAYER.over} flex items-stretch justify-center bg-ink/40 px-3 pt-[calc(var(--height-header)+0.5rem)] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:items-start md:px-4 md:pb-4 md:pt-[min(20vh,8rem)]`}
        data-testid={TESTID.palette}
        role="dialog"
        aria-modal="true"
        aria-label="command palette"
      >
        <button
          type="button"
          class="absolute inset-0 cursor-default"
          aria-label="close the palette"
          data-testid={TESTID.paletteScrim}
          // Asked of the stack like the key is, and for the same reason: this
          // is the palette's other dismissal, and a press on a full-screen
          // scrim is a press outside every panel underneath as well. Nothing
          // stands over the palette today (a row that opens another surface
          // calls `close` on its way through, and the scrim covers the page),
          // so this guard changes no pixel now — it is the pointer half of the
          // rule the Escape above keeps, left unguarded once and worth exactly
          // one line to not leave unguarded twice.
          onClick={() => {
            if (topmost()) close()
          }}
        />
        <div
          class={`relative ${WITHIN.raised} flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border-0 bg-panel shadow-xl ring-1 ring-rule/40 md:h-auto`}
        >
          <input
            ref={input}
            type="text"
            class="w-full shrink-0 border-b border-rule bg-transparent px-4 py-3 font-serif text-base italic text-ink outline-none placeholder:text-muted md:px-5 md:py-4 md:text-lg"
            data-testid={TESTID.paletteInput}
            placeholder={boxSays()}
            value={query()}
            onInput={(e) => {
              setQuery(e.currentTarget.value)
              cursor.top()
              // The first character typed IS the choice — it lights the best
              // match, which is what a type-ahead is. An emptied box goes back
              // to having chosen nothing.
              setChosen(e.currentTarget.value.trim() !== "")
              setAskError(null)
            }}
            // WHICH key is the registry's (`../keys.ts`'s list layer, the same
            // one the row editor's completions ask); what each answer MEANS is
            // this dialog's — `take` runs a row, and the arrows walk it.
            //
            // `dismiss` is deliberately NOT answered here, and it is a rule
            // rather than an omission: this handler is on the BOX, so it runs
            // at the target, before anything listening on the document — and a
            // panel that shuts itself that early promotes whatever is under it
            // to topmost inside the same keystroke, which is how one Escape
            // took the palette AND the popover it was opened over. Escape is
            // answered once, on the window, where every layer has already been
            // asked (`onMount` above, and `../topmost.ts`).
            onKeyDown={(e) => {
              const action = listKey(e)
              if (action === null || action === "dismiss") return
              e.preventDefault()
              if (action === "next") walk(1)
              if (action === "prev") walk(-1)
              if (action === "take") confirm()
            }}
          />
          <Show when={askError()}>
            {(err) => (
              <SaidLine
                said={{ tone: "alarm", text: err() }}
                class={ALERT_ROW}
                testid={TESTID.paletteAskError}
              />
            )}
          </Show>
          {/* The SEARCH's own refusal, in its own row: it is a different
              question from the `>` ask, so it gets a different answer slot
              rather than overwriting one the reader may still be reading. */}
          <Show when={nodes.failure()}>
            {(err) => (
              <SaidLine
                said={{ tone: "alarm", text: err() }}
                class={ALERT_ROW}
                testid={TESTID.paletteSearchError}
              />
            )}
          </Show>
          {/* …and the QUERY's own, which is a fourth question: the words were
              read and one of them is an operator with a value the grammar does
              not take. Without this a typo in `is:` looks exactly like an empty
              directory (`../search/nodes.ts`). Drawn by `../refusals.tsx`,
              which is where that sentence and the ear it is read to live. */}
          <Refusals
            of={nodes.refusals()}
            class={ALERT_ROW}
            testid={TESTID.searchRefusal}
          />
          {/* WHAT A WRITE SAID, in a row of its own for the same reason the
              two above have theirs: it is a third question. The mood — its
              colour, its `data-tone`, whether a screen reader is interrupted —
              is `../edit/SaidLine.tsx`'s, once, for every surface that says
              something about a write. */}
          <Show when={said()}>
            {(message) => (
              <SaidLine
                said={message()}
                class="m-0 border-b border-rule px-4 py-2 font-mono text-xs"
                testid={TESTID.paletteSaid}
              />
            )}
          </Show>
          <Switch
            fallback={
              <>
                {/* `overflow-x-hidden` is the doctrine, not a defence: a popover
                    scrolls down, never sideways. The rows are already built not
                    to overflow; this makes that a property of the container
                    rather than of every future row. */}
                <ul
                  class="m-0 min-h-0 flex-1 list-none overflow-x-hidden overflow-y-auto p-1 md:max-h-72 md:flex-none"
                  data-testid={TESTID.paletteList}
                >
                  {/* `<Key>` rather than `<For>`, for the reason the tree uses it
                      (`../Tree.tsx`): the rows are minted fresh on every read, so
                      every keystroke during the 200 ms settle rebuilt a list whose
                      hits had not changed, under a cursor somebody was walking
                      down. `<Key>` and not `<Index>`, unlike the shortlists, for
                      the same reason the tree is keyed: these rows MOVE — the
                      hits arrive under the commands and rank against each other —
                      and {@link PaletteItem.id} already promises the id is unique
                      in this list, which is what makes it a key. */}
                  <Key
                    each={items()}
                    by="id"
                    fallback={
                      <li class="px-3 py-2 font-mono text-xs text-muted">
                        no matches
                      </li>
                    }
                  >
                    {(item, index) => (
                      <li>
                        <Result
                          label={item().label}
                          of={item().of}
                          hint={item().hint}
                          place={item().place}
                          props={item().props}
                          active={lit(index())}
                          testids={PALETTE_ROW}
                          id={item().id}
                          onHover={() => {
                            setChosen(true)
                            cursor.to(index())
                          }}
                          onSelect={() => runItem(item())}
                        />
                      </li>
                    )}
                  </Key>
                </ul>
                {/* WHAT IS BEHIND THE HITS, and only ever about them: the rows
                    above the hits are this tab's own (the zoomed node's verbs,
                    the shelf's row, the shell), so the count is taken off the
                    ANSWER rather than off the list it is drawn under — which is
                    also why the sentence names its subject (`../search/count.ts`).
                    Under the list rather than inside it, so it stays put while
                    the eight rows scroll, and absent when eight was all there
                    was. */}
                <SearchCount
                  of={nodes}
                  class="m-0 shrink-0 border-t border-rule px-4 py-2 font-mono text-xs text-muted"
                />
              </>
            }
          >
            {/* THE QUESTION FIRST, above both prefixes: it is up because
                somebody chose the verb that asks it, and nothing they type
                next may quietly become the answer. */}
            <Match when={only(box(), "answering")}>
              {(it) => (
                <Question
                  asking={it().question}
                  onGo={() => answer(it().question)}
                  onCancel={escape}
                  setGo={(element) => (go = element)}
                  setCancel={(element) => (cancel = element)}
                />
              )}
            </Match>
            {/* Both prefixes preview the SAME way, because they are the same
                promise: these are the words Enter is about to send, and Enter
                is never a guess. Two arms rather than one because the two
                sentences and the two testids are all that differ, and the
                slot a scenario waits on has to say which prefix it is. */}
            <Match when={only(box(), "ask")}>
              {(box) => (
                <Composing
                  text={box().text}
                  lead="send to agent"
                  empty="type a message after > to send to the agent"
                  testid={TESTID.paletteAsk}
                />
              )}
            </Match>
            <Match when={only(box(), "capture")}>
              {(box) => (
                <Composing
                  text={box().text}
                  lead="capture to the Inbox"
                  empty="type a line after + to capture it to the Inbox"
                  testid={TESTID.paletteCapture}
                />
              )}
            </Match>
          </Switch>
        </div>
      </div>
    </Show>
    </>
  )
}

/**
 * What a prefix is ABOUT to send, in the slot the list would be in.
 *
 * One component for both prefixes: an ask and a capture make the same promise
 * to the reader — these are the words, verbatim, that Enter will send — and
 * two spellings of that promise would be two chances for one of them to stop
 * showing what it is going to do.
 */
function Composing(props: {
  /** The line as it stands, after the prefix. */
  readonly text: string
  /** What the words are FOR, said before them. */
  readonly lead: string
  /** What to say while there is nothing to send yet. */
  readonly empty: string
  readonly testid: string
}) {
  return (
    <div class="px-4 py-3 font-mono text-xs text-muted" data-testid={props.testid}>
      <Show when={props.text.trim() !== ""} fallback={<span>{props.empty}</span>}>
        <span>
          {props.lead}: <span class="text-ink">{props.text}</span>
        </span>
      </Show>
    </div>
  )
}
