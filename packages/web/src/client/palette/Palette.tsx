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

import { releaseArmed, restoreArmed } from "../chat/armed.ts"

import { useDerived } from "../derived.tsx"
import {
  resetPanelWidths,
  setChatOpen,
  toggleChat,
} from "../layout/prefs.ts"
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
import { only } from "../narrow.ts"
import { opItems } from "./ops.ts"
import { QUIET_PILL } from "../pill.ts"
import { createNodeSearch } from "../search/nodes.ts"
import { Result } from "../search/Result.tsx"
import { paletteOpen, setPaletteOpen } from "./open.ts"
import { SaidLine } from "../edit/SaidLine.tsx"
import { type Said, useUndo } from "../edit/undoing.ts"
import { applying } from "../writes.ts"
import { isEditingTarget, matchKey } from "../keys.ts"
import { Shortcuts } from "./Shortcuts.tsx"

/**
 * NO ROW CHOSEN — what an untouched palette is standing on, and the reason the
 * op rows are allowed to be first.
 *
 * A highlight is a place the arrows start from, not a selection somebody made.
 * With an empty box nobody has said anything yet, so nothing is lit and Enter
 * does nothing at all: the palette can lead with the rows that are about the
 * open page without a stray keypress meaning `Mark todo`. The first character
 * typed is the choice, and it puts the highlight on the best match, which is
 * what a type-ahead is.
 */
const NOTHING = -1

/** Where the highlight goes when the box changes: nowhere while it is empty,
 *  and on the best match the moment it is not. */
const startAt = (query: string): number => (query.trim() === "" ? NOTHING : 0)

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
  const [active, setActive] = createSignal(NOTHING)
  const [askError, setAskError] = createSignal<string | null>(null)
  /** What the last write had to say — a refusal in the ops layer's own words,
   *  or a remark about one that landed. */
  const [said, setSaid] = createSignal<Said | null>(null)
  /** The question that is up, RESOLVED — its words and the edit answering it
   *  sends, taken off the row when it was raised. It replaces the list in the
   *  same box, exactly as the `•••` menu's confirm does rather than as browser
   *  chrome olai does not own. */
  const [asking, setAsking] = createSignal<Asking | null>(null)
  let input: HTMLInputElement | undefined
  let previousFocus: HTMLElement | null = null

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

  const items = createMemo(() => {
    if (!listing()) return [] as ReadonlyArray<PaletteItem>
    // THE OP ROWS FIRST, because they are the only rows that are about what
    // the reader is looking at — a list whose contextual half is below the
    // fold is a list nobody finds them in. What makes that safe is {@link
    // NOTHING}: an untouched palette has no row chosen, so being at the top is
    // not being one keystroke from a write.
    const commands = [...opItems(props.zoomed, derived()), ...SHELL_ITEMS]
    return [...filterItems(query(), commands), ...nodes.hits().map(nodeItem)]
  })

  const close = () => {
    setPaletteOpen(false)
    setQuery("")
    setActive(NOTHING)
    setAskError(null)
    setSaid(null)
    setAsking(null)
    const back = previousFocus
    previousFocus = null
    queueMicrotask(() => back?.focus())
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
    setQuery("")
    setActive(NOTHING)
    setAskError(null)
    setSaid(null)
    setAsking(null)
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
      setQuery(action.prefix)
      setActive(NOTHING)
      setSaid(null)
      input?.focus()
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
    setSaid(null)
    void applying(edit, undo.record).then((said) => {
      if (said === undefined) {
        close()
        return
      }
      setSaid(said)
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
   * commit makes to a draft — so a blank line, or an inbox whose file will not
   * parse, is something to fix rather than something to retype.
   */
  const sendCapture = (text: string) => {
    if (text.trim() === "") return
    setSaid(null)
    void applying({ verb: "capture", title: text }, undo.record).then((answer) => {
      if (answer?.tone === "alarm") {
        setSaid(answer)
        return
      }
      setQuery(`${CAPTURE_PREFIX} `)
      setActive(NOTHING)
      input?.focus()
      // The op's own remark if it made one, and otherwise this app's: a write
      // whose whole point is that nothing on screen moves has to say that it
      // happened, or it is indistinguishable from a key that did nothing.
      setSaid(answer ?? { tone: "aside", text: `captured “${text}” to the Inbox` })
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
    const box = mode()
    if (box.kind === "ask") {
      sendAsk(box.text)
      return
    }
    if (box.kind === "capture") {
      sendCapture(box.text)
      return
    }
    // The question, if one is up: Enter is the second press that answers it,
    // which is the two-step the `•••` menu asks for and the same two calls an
    // agent makes.
    const question = asking()
    if (question !== null) {
      answer(question)
      return
    }
    // Nothing lit is nothing chosen — see {@link NOTHING}. No `?? list[0]`
    // fallback: that is exactly the keystroke this palette must not turn into
    // a write nobody aimed.
    const item = items()[active()]
    if (item !== undefined) runItem(item)
  }

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
        if (paletteOpen() && event.key === "Escape") {
          event.preventDefault()
          escape()
        }
        // Simple focus trap: keep Tab inside the dialog while open.
        if (paletteOpen() && event.key === "Tab" && input) {
          event.preventDefault()
          input.focus()
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

  // The list shrank under the highlight — a hit that stopped matching, a verb
  // the write it just made took away. It walks back to the last row rather
  // than off the end, and to NOTHING when there are no rows left, which is
  // where an unchosen palette already stands.
  createEffect(() => {
    const n = items().length
    if (active() >= n) setActive(n - 1)
  })

  return (
    <>
    <Shortcuts open={keys()} onClose={() => setKeys(false)} />
    <Show when={paletteOpen()}>
      <div
        class="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[min(20vh,8rem)]"
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
        <div class="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-rule/70 bg-panel shadow-lg">
          <input
            ref={input}
            type="text"
            class="w-full border-b border-rule bg-transparent px-4 py-3 font-mono text-sm text-ink outline-none placeholder:text-muted"
            data-testid={TESTID.paletteInput}
            placeholder="Jump, toggle, > ask the agent, + capture a line…"
            value={query()}
            onInput={(e) => {
              setQuery(e.currentTarget.value)
              setActive(startAt(e.currentTarget.value))
              setAskError(null)
            }}
            onKeyDown={(e) => {
              // The arrows are the other way IN to the list: from nowhere,
              // down lands on the first row and up on the last, which is what
              // a keyboard walking an unchosen list expects.
              if (e.key === "ArrowDown") {
                e.preventDefault()
                const n = items().length
                if (n > 0) setActive((i) => (i + 1) % n)
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                const n = items().length
                if (n > 0) setActive((i) => (i <= NOTHING ? n : i) - 1)
              } else if (e.key === "Enter") {
                e.preventDefault()
                confirm()
              } else if (e.key === "Escape") {
                e.preventDefault()
                escape()
              }
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
                        active={index() === active()}
                        testid={TESTID.paletteItem}
                        placeTestid={TESTID.paletteItemPlace}
                        id={item.id}
                        onHover={() => setActive(index())}
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
                <div class="px-4 py-3" role="group" aria-label={question().question}>
                  <p
                    class="m-0 text-xs leading-snug text-ink"
                    data-testid={TESTID.paletteConfirm}
                  >
                    {question().question}
                  </p>
                  <div class="mt-2 flex gap-2">
                    <button
                      type="button"
                      class="cursor-pointer rounded border border-alarm bg-transparent px-2 py-1 text-xs text-alarm hover:bg-alarm/10"
                      data-testid={TESTID.paletteItem}
                      data-id="go"
                      onClick={() => answer(question())}
                    >
                      {question().label}
                    </button>
                    <button
                      type="button"
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
