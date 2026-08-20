/**
 * The completion over the message box — one list for both of the things the
 * composer completes.
 *
 * `/` offers the AGENT'S own commands (they arrive on the chat cell, so what
 * is offered is what that agent actually has and olai maintains no list of its
 * own to go stale) and `@` offers what the served directory holds under a word
 * — its files and its nodes, in two blocks under one cursor
 * ({@link ./naming.ts}). One component rather than two — three, now — for
 * `../complete/completing.tsx`'s reason one panel over:
 * they are one gesture — type a character, see a shortlist, walk it with the
 * arrows, press Enter — and two copies of the arrow keys is two chances for
 * the arrows to mean something slightly different depending on which character
 * opened the list. What differs between them is where the rows come from and
 * what taking one writes, and both of those are the composer's
 * ({@link ./Composer.tsx}).
 *
 * Keyboard first, because the whole point is not reaching for the mouse
 * mid-sentence: ↑/↓ walk, Enter and Tab accept, Escape closes. A click does the
 * same thing for the times a hand is already there.
 */

import { createEffect, Index, on, onCleanup, onMount, Show } from "solid-js"

import { listKey } from "../keys.ts"
import { WITHIN } from "../layer.ts"
import { createCursor } from "../search/cursor.ts"
import { TESTID } from "../testids.ts"
import { topmostWhileOpen } from "../topmost.ts"

/**
 * One row. `value` is what taking it is ABOUT — a command's name, a file's
 * path, a node's id — and it is what a scenario names the row by; `label` and
 * `hint` are what a person reads.
 *
 * `take` is what CHOOSING it does, carried on the row rather than reported
 * back as an index — the arrangement `../complete/completing.tsx`'s `Choice`
 * uses, and for a reason the index shape got wrong. A pointer takes THE ROW IT
 * PRESSED: an index handed back to the composer is resolved against whatever
 * the list holds by then, and this list is re-derived while it is on screen —
 * a directory frame, an agent's commands arriving — so a press could land on
 * the row that moved into that position. The keyboard is the other way round
 * and stays an index by nature: the cursor IS a position, and Enter takes the
 * row the arrows are on.
 *
 * The menu still knows nothing about commands or files: a closure is opaque.
 */
export interface MenuRow {
  readonly value: string
  readonly label: string
  readonly hint?: string
  /**
   * WHICH BLOCK this row belongs to, if the list has more than one kind of row
   * in it — `files` and `nodes` under an `@` ({@link ./naming.ts}), nothing at
   * all under a `/`.
   *
   * Drawn as a word above the first row that says it, and only there: rows
   * arrive grouped, so a heading is "this row starts a block" rather than a
   * second list to keep aligned with the first. It is deliberately NOT a row of
   * its own — the cursor counts takeable things (`../search/cursor.ts` over
   * `rows.length`), and a list where ↓ sometimes lands on a label would be the
   * one thing this component exists to prevent: arrows that mean two things.
   */
  readonly section?: string
  readonly take: () => void
}

export function CompletionMenu(props: {
  /** WHICH list this is, as a fact in the markup rather than as a guess from
   *  what is in it — the contract `../complete/Completions.tsx` keeps about
   *  its own three widgets, kept here for the two. */
  readonly kind: "command" | "name"
  readonly rows: ReadonlyArray<MenuRow>
  /** WHAT IS BEING ASKED — the armed kind and its query, as one string. The
   *  cursor goes back to the top when it changes, because a keystroke means a
   *  different question and the answer to the last one is not where somebody's
   *  eye is. It matters more here than it reads: the file rows are three
   *  buckets deep (`../file/matching.ts`), so a query that gains a character can
   *  REORDER them under a walked index, and Enter would take a row the arrows
   *  never landed on. Keyed on the question rather than on the rows, so
   *  walking the list does not reset it and a directory frame arriving does
   *  not either — `../complete/completing.tsx`'s rule, kept. */
  readonly asking: string
  /**
   * The BOX this list is completing, which is what makes it caret-scoped.
   *
   * The listener below is capture-phase on the document — it has to be, so the
   * composer's own Enter cannot send the message the reader was only
   * completing — and that reach is the whole trouble: it saw every keystroke on
   * the page, not only the ones aimed at the box. With a list up, pressing
   * Enter on the preferences trigger was answered HERE: `listKey` read it as
   * `take`, the completion was accepted, the key was stopped, and the panel the
   * reader asked for never opened (reported by review, reproducible on `master`
   * too). Being topmost does not answer that — a list is not the panel a
   * keystroke is for merely by being the last thing opened; it is the panel for
   * the keys aimed at the box it belongs to, which is what `../keys.ts` means
   * by its LIST layer.
   */
  readonly within: () => HTMLElement | undefined
  readonly onDismiss: () => void
}) {
  // WHICH row Enter takes — the one cursor every shortlist in this client
  // shares (`../search/cursor.ts`), so the arrows mean the same thing here, in
  // the ⌘K palette, in the header's box and in the row editor's completions.
  // It also keeps the cursor on a row that EXISTS when the list changes
  // underneath, which this menu had no answer for at all.
  const cursor = createCursor(() => props.rows.length)

  // A NEW QUESTION STARTS AT THE TOP — see `asking`.
  createEffect(on(() => props.asking, cursor.top))

  /**
   * This list on the client's one dismissal stack (`../topmost.ts`).
   *
   * `() => true` because BEING HERE is being open: the composer mounts this
   * component only while there is a list to draw, so the ticket is taken at
   * mount and given back at disposal. Every other layer holds a state its
   * caller owns; this one's state is its own existence.
   *
   * It matters because the listener below is capture-phase on the DOCUMENT and
   * takes the key outright — which is the stack's rule inverted when something
   * is over it. `../keys.ts`'s list layer says a shortlist is asked FIRST, and
   * that stays true; what this adds is that "first" means first among the
   * layers on screen, not first regardless of them.
   */
  const topmost = topmostWhileOpen(() => true)

  /**
   * Bound on the document, in the CAPTURE phase, because the input owns Enter
   * for sending: the menu has to see the key first and TAKE it when it is the
   * one being answered.
   *
   * `stopPropagation` as well as `preventDefault`, and the difference matters:
   * `preventDefault` only stops the browser's own behaviour, so the composer's
   * own handler would still run — and by then the menu is closed, so it would
   * read "no menu open" and send the message the reader was only completing.
   */
  const take = (event: KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const accept = (event: KeyboardEvent) => {
    const chosen = props.rows[cursor.at()]
    if (chosen === undefined) return
    take(event)
    chosen.take()
  }

  // WHICH key it is, is the registry's (`../keys.ts`'s list layer); what each
  // answer MEANS is this menu's. TAB is this surface's own extra — it accepts
  // here and means nothing to the other lists, so it stays a case of this
  // handler rather than an arm of the shared matcher.
  const onKey = (event: KeyboardEvent) => {
    // Aimed at the box this list completes, or it is not this list's (see
    // `within`). First, because it is the older and stronger of the two
    // questions: a key somewhere else is not this menu's however topmost the
    // menu is.
    if (event.target !== props.within()) return
    // Not while something is over it: a key belongs to the panel that was
    // opened last, and this handler is the one place on the page that could
    // take it before that panel is even asked.
    if (!topmost()) return
    if (event.key === "Tab") {
      accept(event)
      return
    }
    const action = listKey(event)
    if (action === null) return
    if (action === "next") {
      take(event)
      cursor.step(1)
    }
    if (action === "prev") {
      take(event)
      cursor.step(-1)
    }
    if (action === "take") accept(event)
    if (action === "dismiss") {
      take(event)
      props.onDismiss()
    }
  }

  onMount(() => {
    document.addEventListener("keydown", onKey, true)
    onCleanup(() => document.removeEventListener("keydown", onKey, true))
  })

  return (
    // `WITHIN.pop`, and it STAYS in this panel. The chat dock is already a
    // stacking context at {@link LAYER.page}, above every sticky section
    // heading (`../layer.ts`). Portalling this list to the document at
    // `z-3` would put it UNDER the page; raising it to a page layer would
    // be answering a question this list is not asked. The `•••` menu's
    // portal is the escape for overlays that live IN the outline.
    <ul
      class={`absolute bottom-full left-2 right-2 ${WITHIN.pop} mb-1 max-h-64 list-none overflow-y-auto rounded border border-rule/70 bg-panel p-1 shadow-lg`}
      data-testid={TESTID.chatCompletion}
      data-kind={props.kind}
    >
      {/* `<Index>` rather than `<For>`, which is `../search/Shortlist.tsx`'s
          rule over the identical rows: they are positional — the cursor above
          walks them by index, and the section heading is a comparison with the
          row ABOVE — and there are at most eight. What it costs here is the
          list's own shape: the composer answers it TWICE, the paths at once and
          the nodes a round trip later, so by reference the file rows a reader
          was already looking at were rebuilt the moment the second half landed
          beside them. */}
      <Index each={props.rows}>
        {(row, index) => (
          <>
            {/* The block's own word, over the row that opens it — which is
                any row whose section differs from the one above it, so a list
                of one kind (the `/` commands, whose rows carry none) draws no
                heading without being asked about. A `<li>` because a list's
                children are list items and a reader with a screen reader is
                told how many there are; not a cursor position, because it is a
                label rather than something to take. */}
            <Show when={row().section !== props.rows[index - 1]?.section}>
              <li
                class="px-2 pb-0.5 pt-1 font-mono text-[0.625rem] uppercase tracking-wide text-muted"
                data-testid={TESTID.chatCompletionSection}
                data-section={row().section}
              >
                {row().section}
              </li>
            </Show>
            <li>
              <button
                type="button"
                class={`block w-full truncate rounded px-2 py-1 text-left text-xs ${
                  index === cursor.at() ? "bg-rule" : ""
                }`}
                data-testid={TESTID.chatCompletionRow}
                data-value={row().value}
                data-active={index === cursor.at()}
                // THE ROW, not its position: see {@link MenuRow.take}.
                onClick={() => row().take()}
              >
                {/* The space between them is a real character as well as a
                    margin: what the eye reads as two words has to be two words
                    when the row is copied or read aloud, and `ml-2` is neither. */}
                <span class="font-mono">{row().label}</span>{" "}
                <span class="ml-1 text-muted">{row().hint}</span>
              </button>
            </li>
          </>
        )}
      </Index>
    </ul>
  )
}
