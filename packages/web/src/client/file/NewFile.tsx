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
 * ## What may judge a path: nothing here
 *
 * What is typed goes to the ops layer as it was typed. A path that is absolute,
 * climbs with `..`, has the wrong extension or names a file the set already
 * holds is refused by `create_outline` / `create_document` in its own words, and
 * that sentence is what is drawn. A browser that pre-checked any of it would be
 * a second rule, free to disagree with the one an agent meets — which is the
 * consistency rule read at the smallest scale there is.
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

import { Refused } from "../Refused.tsx"
import type { Making } from "./making.ts"

export function NewFile(props: {
  /** What this door is called, and the names the browser tests find it by. */
  readonly making: Making
  /** Mint it. Answers with the refusal to draw, verbatim, or `null` when the
   *  write landed — at which point the box puts itself away. */
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
    const file = path().trim()
    // An empty box is not a refusal to draw — nobody has asked for anything
    // yet.
    if (file === "") return
    const refused = await props.create(file)
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
            class="cursor-pointer rounded border-0 bg-transparent px-2 py-0.5 text-[0.8125rem] text-muted hover:bg-rule/50 hover:text-ink"
            data-testid={props.making.testids.open}
            onClick={(event) => {
              // The sidebar body closes the mobile drawer on any click that
              // bubbles to it; opening a box to type in is not leaving.
              event.stopPropagation()
              setOpen(true)
            }}
          >
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
