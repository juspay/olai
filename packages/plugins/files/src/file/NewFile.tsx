/**
 * The sidebar's way to a file that does not exist yet — ONE box, for both kinds
 * of file the directory holds.
 *
 * It was one component and then, three days later, two: `+ New outline` was
 * written by copying `+ New document`, which is the concept-multiplication
 * every review catches (`parity-create-outline`). What the two actually differ
 * about is FOUR WORDS and where a landed write goes; everything else — the
 * menu item that opens a path box, the caret arriving in it, Enter,
 * Escape, the empty box that asks for nothing, the refusal drawn verbatim
 * underneath, the click that must not close the mobile drawer — was the same
 * decision twice, free to drift the day one of them grew a fifth.
 *
 * ## Nothing here judges a path, and one thing completes one
 *
 * A path that is absolute, climbs with `..` or names a file the set already
 * holds is refused by `files_create` / `markdown_create` in its own words,
 * and that sentence is what is drawn. A browser that pre-checked any of it
 * would be a second rule, free to disagree with the one an agent meets — which
 * is the consistency rule read at the smallest scale there is.
 *
 * What this box does do to what was typed is COMPLETE it: a door knows which
 * kind of file it makes and the wire deliberately does not, so `Foo` at the
 * outline door is asked for as `Foo.olai` (`./completing.ts` holds that rule,
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
import { servedDirectory } from "../vault.ts"
import { createSignal,Show } from "solid-js"

import { meantAt } from "olai-plugin-files/completing"
import { Refused } from "@olai/web/client/Refused.tsx"
import type { Making } from "olai-plugin-files/making"

const newDraft = () => ({
  open: createSignal(false),
  path: createSignal(""),
  said: createSignal<string | null>(null),
  sending: createSignal(false),
  revision: 0,
})

// Sidebar components rebuild when plugins change. Each file kind keeps its
// draft and pending response identity until the user closes or submits it.
const drafts = new Map<Making["of"], ReturnType<typeof newDraft>>()
const draftOf = (of: Making["of"]) => {
  const draft = drafts.get(of) ?? newDraft()
  drafts.set(of, draft)
  return draft
}

/** OPEN THE BOX for one kind of file — what the Outlines heading's `+` menu
 *  does when a reader picks `New outline` or `New document` (`../NewMenu.tsx`).
 *  The box itself is still the kind's own `Create`, drawn under the heading;
 *  this only says it is asked for. A box already open keeps what it holds. */
export const openNewFile = (of: Making["of"]): void => {
  draftOf(of).open[1](true)
}

export function NewFile(props: {
  /** What this door is called, and the names the browser tests find it by. */
  readonly making: Making
  /** Mint it, at the path the box completed ({@link meantAt}) rather than at
   *  the characters that were typed. Answers with the refusal to draw,
   *  verbatim, or `null` when the write landed — at which point the box puts
   *  itself away. */
  readonly create: (file: string) => Promise<string | null>
}) {
  const draft = draftOf(props.making.of)
  const [open, setOpen] = draft.open
  const [path, setPath] = draft.path
  const [said, setSaid] = draft.said
  const [sending, setSending] = draft.sending

  const close = (): void => {
    draft.revision++
    setOpen(false)
    setPath("")
    setSaid(null)
  }

  const send = async (): Promise<void> => {
    if (sending()) return
    // THREE THINGS the box does with what is in it, and which of them is
    // `./completing.ts`'s answer rather than a reading of its own: an empty box
    // is not a refusal to draw — nobody has asked for anything yet.
    const claims = servedDirectory()?.claims()
    if (claims === undefined) return
    const meant = meantAt(claims, props.making.of, path())
    if (meant === null) return
    // ONE LINE draws both sentences, and that is the point of drawing the box's
    // own one here rather than beside it: which layer refused a path is not a
    // difference the person who typed it should have to see.
    if ("refused" in meant) {
      setSaid(meant.refused)
      return
    }
    setSending(true)
    const submitted = draft.revision
    try {
      const refused = await props.create(meant.file)
      // Typing another name, or dismissing and reopening the box, gives it
      // a new draft. An earlier response cannot clear or annotate that draft.
      if (draft.revision !== submitted) return
      if (refused === null) close()
      else setSaid(refused)
    } finally {
      setSending(false)
    }
  }

  // CLOSED, IT DRAWS NOTHING: the way in is the Outlines heading's `+` menu
  // (`../NewMenu.tsx`), which opens this draft by kind ({@link openNewFile}).
  // The quiet `+ New …` row each kind used to draw under the tree left with
  // the 2026-09 simplification.
  return (
    <Show when={open()}>
      <div class="mb-1 px-1">
        <input
          type="text"
          class="w-full rounded border border-rule bg-panel px-2 py-1 font-mono text-[0.8125rem] text-ink outline-none focus:border-accent"
          data-testid={props.making.testids.path}
          aria-label={props.making.aria}
          aria-busy={sending()}
          placeholder={props.making.placeholder}
          spellcheck={false}
          value={path()}
          // The caret in the box the moment it is drawn, on the microtask the
          // date picker's own field uses — a timer here would be a third
          // spelling of one gesture.
          ref={(box) => queueMicrotask(() => box.focus())}
          onClick={(event) => event.stopPropagation()}
          onInput={(event) => {
            draft.revision++
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
          <Show when={sending()}><span role="status" class="text-xs text-muted">Creating…</span></Show>
          <Refused said={said()} testid={props.making.testids.said} compact />
        </div>
      </div>
    </Show>
  )
}

export function clearNewFileMemory():void { drafts.clear() }
