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

import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js"

import type { Situated } from "@olai/format"
import type { Edit, OpFailure } from "@olai/surface"
import { Result as Outcome } from "effect"

import { releaseArmed, restoreArmed } from "../chat/armed.ts"

import { useDerived } from "../derived.tsx"
import { SaidLine } from "../edit/SaidLine.tsx"
import {
  resetPanelWidths,
  setChatOpen,
  toggleChat,
} from "../layout/prefs.ts"
import { LAYER, WITHIN } from "../layer.ts"
import { topmostWhileOpen } from "../topmost.ts"
import { only } from "../narrow.ts"
import { ALARM_PILL, QUIET_PILL } from "../pill.ts"
import type { Route } from "../routes.ts"
import { TESTID } from "../testids.ts"
import { olai } from "../wire.ts"
import { run } from "../run.ts"
import {
  CAPTURE_PREFIX,
  filterItems,
  modeOf,
  nodeItem,
  type PaletteItem,
  SHELL_ITEMS,
} from "./items.ts"
import { opItems } from "./ops.ts"
import { createCursor } from "../search/cursor.ts"
import { createNodeSearch } from "../search/nodes.ts"
import { Result } from "../search/Result.tsx"
import { paletteOpen, setPaletteOpen } from "./open.ts"
import { type Said, useUndo } from "../edit/undoing.ts"
import { applied, applying } from "../writes.ts"
import { isEditingTarget, listKey, matchKey } from "../keys.ts"
import { Shortcuts } from "./Shortcuts.tsx"

/**
 * A QUESTION THAT IS UP, and everything answering it needs — its words, the
 * verb's name for the button that goes ahead, and the edit that goes.
 *
 * Resolved at the ONE site that knows the row is a write with a question to
 * ask, rather than kept as the row itself. A row is a wider thing than this
 * panel can use: most of them are navigation, none of those has a question,
 * and holding one here would mean the panel asking `action.kind === "edit"`
 * again and needing an answer for the case it is never in. So the narrowing
 * happens once, where it is true, and the arm below cannot be entered with a
 * row that has nothing to confirm.
 */
interface Asking {
  /** The verb's own words, on the button that goes ahead. */
  readonly label: string
  readonly question: string
  readonly edit: Edit
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
   * Handed down rather than zoomed again from the route: `App.tsx` has already
   * resolved the address into a page, and a second `zoom()` here would be a
   * second answer to "what is open" that could differ from the one on screen.
   */
  readonly zoomed: Situated | undefined
}) {
  // ⌘Z / ⌘⇧Z belong to the outline's undo stack; what this file owns is the
  // ONE window listener the global layer has (../keys.ts), and a second one
  // for two more chords would be exactly the disagreement that registry exists
  // to make impossible. Reached the way the row editor reaches it rather than
  // handed down as two props — same object, one access path.
  const undo = useUndo()
  const derived = useDerived()
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
  const [askError, setAskError] = createSignal<string | null>(null)
  /** What the last write had to say — a refusal in the ops layer's own words,
   *  or a remark about one that landed. */
  const [said, setSaid] = createSignal<Said | null>(null)
  /** The question that is up, RESOLVED — its words and the edit answering it
   *  sends, taken off the row when it was raised. It replaces the list in the
   *  same box, exactly as the `•••` menu's confirm does rather than as browser
   *  chrome olai does not own. */
  const [asking, setAsking] = createSignal<Asking | null>(null)
  /**
   * A WRITE IS IN FLIGHT — the date picker's rule, in the surface that needed
   * it most: "the gate is a round trip, and a second Enter while the first is
   * in flight is two writes for one intention" ({@link ../date/DatePicker.tsx}).
   *
   * The capture is what makes it load-bearing rather than tidy. It keeps the
   * box AND the palette, so nothing visible has happened while the round trip
   * is out — which is exactly the moment a hand repeats the key. The second
   * send is judged against the reading the first has not landed in yet, so on
   * a directory with no inbox both resolve to the same `create Inbox.jsonl`,
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

  /** What the box is doing — one value, so "showing the list" and "composing a
   *  line" cannot disagree ({@link ./items.ts}'s `Mode`). */
  const mode = createMemo(() => modeOf(query()))
  const listing = () => mode().kind === "filter"

  // The nodes, from the server — one primitive, its own failure, and no
  // request bookkeeping in this component ({@link ./search.ts}). It is asked
  // only while the palette is open and the box is not carrying a prefix:
  // neither `>` nor `+` is a search, and asking for one would spend a round
  // trip per keystroke on a sentence nobody is looking things up with.
  const nodes = createNodeSearch(() =>
    paletteOpen() && listing() ? query() : null
  )

  /**
   * The zoomed node's verbs — its OWN memo, and guarded on the palette being
   * open, which is what keeps them from being rebuilt for nobody.
   *
   * Both halves of that matter. `opItems` walks the node's subtree to count
   * what an archive would move (`../menu/subtree.ts`), and everything it reads
   * — `props.zoomed`, the indexes — is minted afresh on every revision the
   * store publishes, so a memo that read them beside the query would do that
   * walk on every write to the directory with the modal shut, and again on
   * every keystroke typed into it. Solid re-tracks per run, so while the
   * palette is closed this depends on `paletteOpen()` and nothing else.
   */
  const opRows = createMemo(() =>
    paletteOpen() ? opItems(props.zoomed, derived()) : []
  )

  const items = createMemo(() => {
    if (!listing()) return [] as ReadonlyArray<PaletteItem>
    // THE OP ROWS FIRST, because they are the only rows that are about what
    // the reader is looking at — a list whose contextual half is below the
    // fold is a list nobody finds them in. What makes that safe is
    // {@link chosen}: an untouched palette has no row chosen, so being at the
    // top is not being one keystroke from a write.
    const commands = [...opRows(), ...SHELL_ITEMS]
    return [...filterItems(query(), commands), ...nodes.hits().map(nodeItem)]
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
    setAsking(null)
  }

  const close = () => {
    setPaletteOpen(false)
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
      setAsking({ label: item.label, question: action.confirm, edit: action.edit })
      return
    }
    if (action.kind === "prefix") {
      setSaid(null)
      prime(action.prefix)
      return
    }
    if (action.kind === "route") props.go(action.route)
    else if (action.kind === "shortcuts") setKeys(true)
    else if (action.kind === "toggle-sidebar") props.toggleDirectory()
    else if (action.kind === "toggle-chat") toggleChat()
    else if (action.kind === "reset-widths") resetPanelWidths()
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

  /** The question answered: it goes, and the verb behind it does. */
  const answer = (question: Asking) => {
    setAsking(null)
    sendEdit(question.edit)
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
   * and wrong out loud for a directory that keeps `notes/inbox.jsonl`.
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
    const question = asking()
    if (question !== null) {
      answer(question)
      return
    }
    const box = mode()
    if (box.kind === "ask") {
      sendAsk(box.text)
      return
    }
    if (box.kind === "capture") {
      sendCapture(box.text)
      return
    }
    // Nothing lit is nothing chosen — see {@link chosen}. No `?? list[0]`
    // fallback: that is exactly the keystroke this palette must not turn into
    // a write nobody aimed.
    if (!chosen()) return
    const item = items()[cursor.at()]
    if (item !== undefined) runItem(item)
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
    if (asking() !== null) {
      setAsking(null)
      input?.focus()
      return
    }
    close()
  }

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
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
          if (asking() === null) input?.focus()
          else if (document.activeElement === go) cancel?.focus()
          else go?.focus()
        }
        return
      }
      if (!match.whileEditing && isEditingTarget(event.target)) return
      event.preventDefault()
      if (match.action === "palette") {
        if (paletteOpen()) close()
        else setPaletteOpen(true)
        return
      }
      if (match.action === "sidebar") props.toggleDirectory()
      if (match.action === "chat") toggleChat()
      // Reached only with the caret nowhere — both chords are
      // `whileEditing: false`, so a draft keeps the platform's own undo and
      // Escape keeps abandoning.
      if (match.action === "undo") undo.undo()
      if (match.action === "redo") undo.redo()
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  return (
    <>
    <Shortcuts open={keys()} onClose={() => setKeys(false)} />
    <Show when={paletteOpen()}>
      <div
        class={`fixed inset-0 ${LAYER.over} flex items-start justify-center bg-ink/40 px-4 pt-[min(20vh,8rem)]`}
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
          onClick={close}
        />
        <div
          class={`relative ${WITHIN.raised} w-full max-w-lg overflow-hidden rounded-lg border border-rule/70 bg-panel shadow-lg`}
        >
          <input
            ref={input}
            type="text"
            class="w-full border-b border-rule bg-transparent px-4 py-3 font-mono text-sm text-ink outline-none placeholder:text-muted"
            data-testid={TESTID.paletteInput}
            placeholder="Jump, toggle, > ask the agent, + capture a line…"
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
              <div
                class="border-b border-alarm/40 bg-alarm/5 px-4 py-2 font-mono text-xs text-alarm"
                data-testid={TESTID.paletteAskError}
                role="alert"
              >
                {err()}
              </div>
            )}
          </Show>
          {/* The SEARCH's own refusal, in its own row: it is a different
              question from the `>` ask, so it gets a different answer slot
              rather than overwriting one the reader may still be reading. */}
          <Show when={nodes.failure()}>
            {(err) => (
              <div
                class="border-b border-alarm/40 bg-alarm/5 px-4 py-2 font-mono text-xs text-alarm"
                data-testid={TESTID.paletteSearchError}
                role="alert"
              >
                {err()}
              </div>
            )}
          </Show>
          {/* …and the QUERY's own, which is a fourth question: the words were
              read and one of them is an operator with a value the grammar does
              not take. Without this a typo in `is:` looks exactly like an empty
              directory (`../search/nodes.ts`). */}
          <For each={[...nodes.refusals()]}>
            {(refusal) => (
              <div
                class="border-b border-alarm/40 bg-alarm/5 px-4 py-2 font-mono text-xs text-alarm"
                data-testid={TESTID.searchRefusal}
                role="alert"
              >
                {refusal.token} — {refusal.reason}
              </div>
            )}
          </For>
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
              // `overflow-x-hidden` is the doctrine, not a defence: a popover
              // scrolls down, never sideways. The rows are already built not
              // to overflow; this makes that a property of the container
              // rather than of every future row.
              <ul
                class="m-0 max-h-72 list-none overflow-x-hidden overflow-y-auto p-1"
                data-testid={TESTID.paletteList}
              >
                <For
                  each={[...items()]}
                  fallback={
                    <li class="px-3 py-2 font-mono text-xs text-muted">
                      no matches
                    </li>
                  }
                >
                  {(item, index) => (
                    <li>
                      <Result
                        label={item.label}
                        hint={item.hint}
                        place={item.place}
                        active={chosen() && index() === cursor.at()}
                        testid={TESTID.paletteItem}
                        placeTestid={TESTID.paletteItemPlace}
                        id={item.id}
                        onHover={() => {
                          setChosen(true)
                          cursor.to(index())
                        }}
                        onSelect={() => runItem(item)}
                      />
                    </li>
                  )}
                </For>
              </ul>
            }
          >
            {/* THE QUESTION FIRST, above both prefixes: it is up because
                somebody chose the verb that asks it, and nothing they type
                next may quietly become the answer. */}
            <Match when={asking()}>
              {(question) => (
                <div
                  class="px-4 py-3"
                  role="group"
                  aria-label={question().question}
                >
                  {/* ANNOUNCED, and not only drawn. The caret is in the box
                      when the verb is chosen, so without this a reader who
                      cannot see the panel is told nothing at all and their
                      next Enter archives a subtree. `alert` + `assertive` is
                      the same pair a refusal gets one row up — this is the
                      other sentence in this palette that must interrupt. */}
                  <p
                    class="m-0 text-xs leading-snug text-ink"
                    data-testid={TESTID.paletteConfirm}
                    role="alert"
                    aria-live="assertive"
                  >
                    {question().question}
                  </p>
                  <div class="mt-2 flex gap-2">
                    <button
                      type="button"
                      // AND THE CARET COMES IN, which is the `•••` menu's own
                      // confirm rule (`../menu/Confirm.tsx`): a question
                      // nobody's keyboard can reach is a question only a mouse
                      // may answer, and the Tab trap above made that literal.
                      // A microtask because the element is not in the document
                      // at the instant the ref runs.
                      ref={(element) => {
                        go = element
                        queueMicrotask(() => element.focus())
                      }}
                      class={`${ALARM_PILL} cursor-pointer`}
                      data-testid={TESTID.paletteItem}
                      data-id="go"
                      onClick={() => answer(question())}
                    >
                      {question().label}
                    </button>
                    <button
                      type="button"
                      ref={cancel}
                      class={`${QUIET_PILL} cursor-pointer`}
                      data-testid={TESTID.paletteItem}
                      data-id="cancel"
                      onClick={() => {
                        setAsking(null)
                        input?.focus()
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </Match>
            {/* Both prefixes preview the SAME way, because they are the same
                promise: these are the words Enter is about to send, and Enter
                is never a guess. Two arms rather than one because the two
                sentences and the two testids are all that differ, and the
                slot a scenario waits on has to say which prefix it is. */}
            <Match when={only(mode(), "ask")}>
              {(box) => (
                <Composing
                  text={box().text}
                  lead="send to agent"
                  empty="type a message after > to send to the agent"
                  testid={TESTID.paletteAsk}
                />
              )}
            </Match>
            <Match when={only(mode(), "capture")}>
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
