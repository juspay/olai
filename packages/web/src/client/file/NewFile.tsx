/**
 * The sidebar's way to a file that does not exist yet — ONE box, for both kinds
 * of file the directory holds.
 *
 * It was one component and then, three days later, two: `+ New outline` was
 * written by copying `+ New document`, which is the concept-multiplication
 * every review catches (`parity-create-outline`). What the two actually differ
 * about is FOUR WORDS and where a landed write goes; everything else — the
 * quiet affordance that becomes a path box, the caret arriving in it, Enter,
 * Escape, the empty box that asks for nothing, the refusal drawn verbatim
 * underneath, the click that must not close the mobile drawer — was the same
 * decision twice, free to drift the day one of them grew a fifth.
 *
 * ## Nothing here judges a path, and one thing completes one
 *
 * A path that is absolute, climbs with `..` or names a file the set already
 * holds is refused by `create_outline` / `create_document` in its own words,
 * and that sentence is what is drawn. A browser that pre-checked any of it
 * would be a second rule, free to disagree with the one an agent meets — which
 * is the consistency rule read at the smallest scale there is.
 *
 * What this box does do to what was typed is COMPLETE it: a door knows which
 * kind of file it makes and the wire deliberately does not, so `Foo` at the
 * outline door is asked for as `Foo.org` (`./completing.ts` holds that rule,
 * the argument for it, and the one refusal that is the box's own rather than
 * the ops layer's). Every other verdict is still the ops layer's, over the path
 * this hands it.
 *
 * ## The two halves that differ
 *
 * {@link Making} is the WORDS — a value, so the two doors cannot end up called
 * different things by two components — and `create` is the write, handed in
 * because the two really do land differently: a minted document opens its
 * editor through a one-shot hand-off (`../document/minted.ts`), and a minted
 * outline opens its page, where the first row is already offered. Both answer
 * the same way: the refusal to draw, or `null` for a write that landed.
 */

import { createSignal, Show } from "solid-js"

import { ENTRY_SHAPE, ROW_GAP } from "../layout/entry.ts"
import { Refused } from "../Refused.tsx"
import { CONTROL } from "../touch.ts"
import { meantAt } from "./completing.ts"
import { Glyph } from "./icons.tsx"
import type { Making } from "./making.ts"

export function NewFile(props: {
  /** What this door is called, and the names the browser tests find it by. */
  readonly making: Making
  /** Mint it, at the path the box completed ({@link meantAt}) rather than at
   *  the characters that were typed. Answers with the refusal to draw,
   *  verbatim, or `null` when the write landed — at which point the box puts
   *  itself away. */
  readonly create: (file: string) => Promise<string | null>
}) {
  const [open, setOpen] = createSignal(false)
  const [path, setPath] = createSignal("")
  const [said, setSaid] = createSignal<string | null>(null)

  const close = (): void => {
    setOpen(false)
    setPath("")
    setSaid(null)
  }

  const send = async (): Promise<void> => {
    // THREE THINGS the box does with what is in it, and which of them is
    // `./completing.ts`'s answer rather than a reading of its own: an empty box
    // is not a refusal to draw — nobody has asked for anything yet.
    const meant = meantAt(props.making.of, path())
    if (meant === null) return
    // ONE LINE draws both sentences, and that is the point of drawing the box's
    // own one here rather than beside it: which layer refused a path is not a
    // difference the person who typed it should have to see.
    if ("refused" in meant) {
      setSaid(meant.refused)
      return
    }
    const refused = await props.create(meant.file)
    if (refused === null) close()
    else setSaid(refused)
  }

  return (
    <div class="mt-1">
      <Show
        when={open()}
        fallback={
          <button
            type="button"
            class={`${ENTRY_SHAPE} ${ROW_GAP} w-full cursor-pointer border-0 bg-transparent text-left`}
            data-testid={props.making.testids.open}
            onClick={(event) => {
              // The sidebar body closes the mobile drawer on any click that
              // bubbles to it; opening a box to type in is not leaving.
              event.stopPropagation()
              setOpen(true)
            }}
          >
            {/* The fold-control's box, empty, so this glyph sits in the tree's
                column rather than where a folder's triangle sits. */}
            <span class={CONTROL} aria-hidden="true" />
            <Glyph of={props.making.of} />
            {props.making.label}
          </button>
        }
      >
        <input
          type="text"
          class="w-full rounded border border-rule bg-panel px-2 py-1 font-mono text-[0.8125rem] text-ink outline-none focus:border-accent"
          data-testid={props.making.testids.path}
          aria-label={props.making.aria}
          placeholder={props.making.placeholder}
          spellcheck={false}
          value={path()}
          // The caret in the box the moment it is drawn, on the microtask the
          // date picker's own field uses — a timer here would be a third
          // spelling of one gesture.
          ref={(box) => queueMicrotask(() => box.focus())}
          onClick={(event) => event.stopPropagation()}
          onInput={(event) => {
            setPath(event.currentTarget.value)
            setSaid(null)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              void send()
            }
            if (event.key === "Escape") {
              event.preventDefault()
              close()
            }
          }}
        />
        <div class="mt-1">
          <Refused said={said()} testid={props.making.testids.said} compact />
        </div>
      </Show>
    </div>
  )
}
