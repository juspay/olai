/**
 * What the composer is HOLDING: pictures uploaded and waiting for a message to
 * go with them.
 *
 * It lives here rather than inside {@link ./Composer.tsx} because the gesture
 * and the strip are no longer in the same component. A picture dragged at this
 * panel is aimed at the CONVERSATION, so the drop target is the panel's whole
 * body ({@link ./DropTarget.tsx}) — and the chips it lands in are a two-line
 * strip at the bottom of it. One owner above both: `Panel.tsx` makes this and
 * hands it to each.
 *
 * Three gestures arrive here and there is deliberately one way through: paste
 * (the desktop one), drop (for a file already on screen), and the picker (the
 * only one a phone has). What differs between them is which listener called
 * {@link Holding.take}; nothing below that line knows which it was.
 *
 * These chips refer to something the SERVER owns — files in the conversation's
 * tmp directory — so they are dropped when the conversation is. A chip left
 * over from the last one is a send the server would refuse, naming a file it
 * has already deleted.
 */

import type { Attached } from "@olai/surface"
import { type Accessor, createEffect, createSignal, on } from "solid-js"

import { refusalFor } from "./attach.ts"
import type { Chat } from "./state.ts"

/** A drop, split by the one gate: what will be offered, and what was turned
 *  down in the gate's own words. Both in the order they arrived. */
export interface Sorted {
  readonly taking: ReadonlyArray<File>
  readonly refusals: ReadonlyArray<string>
}

/**
 * Sort what was just dropped — or pasted, or picked — into the pictures this
 * app takes and the refusals it owes for the rest.
 *
 * The gate is {@link refusalFor}: the chunk loop's own, which is
 * `@olai/surface`'s, which is the server's — and it is asked about the name
 * the upload would SEND, because it is the upload that answers. This is not a
 * second opinion about what a picture is. It is the one opinion, asked one
 * step earlier, and asking it earlier is what makes a MIXED drop honest: offer
 * five files one at a time and each upload clears the last one's refusal off
 * the screen, so a drop of four screenshots and a PDF ends with the PDF gone
 * and nothing said about it. Sorted up front, the refusals survive the uploads
 * and are said together.
 */
export const sorting = (files: ReadonlyArray<File>): Sorted => {
  const taking: Array<File> = []
  const refusals: Array<string> = []
  for (const file of files) {
    const rejection = refusalFor(file)
    if (rejection === null) taking.push(file)
    else refusals.push(rejection)
  }
  return { taking, refusals }
}

export interface Holding {
  /** The pictures already on the server, in the order they were attached. */
  readonly pending: Accessor<ReadonlyArray<Attached>>
  /** How many uploads are in flight, so the composer can say so. A count
   *  rather than a flag: three pictures in one drop are three uploads. */
  readonly sending: Accessor<number>
  /** Attach every one of these, in order — whatever the gate takes of them. */
  readonly take: (files: ReadonlyArray<File>) => Promise<void>
  /** Take one back off the strip before it is sent. */
  readonly remove: (name: string) => void
  /** Hand over everything held and empty the strip: what a send does. */
  readonly release: () => ReadonlyArray<Attached>
  /** Put back what a REFUSED send threw away — and only into a strip that is
   *  still empty, so an attachment picked up while the answer was in flight
   *  wins over the one being restored. */
  readonly restore: (attachments: ReadonlyArray<Attached>) => void
}

export const createHolding = (chat: Chat): Holding => {
  const [pending, setPending] = createSignal<ReadonlyArray<Attached>>([])
  const [sending, setSending] = createSignal(0)

  // The conversation these belong to is over and the server has already
  // deleted the files: keeping the chips would offer a send it would refuse,
  // naming pictures that are gone.
  createEffect(
    on(() => chat.state().session?.id, () => setPending([]), { defer: true }),
  )

  return {
    pending,
    sending,
    take: async (files) => {
      const { taking, refusals } = sorting(files)
      setSending((count) => count + taking.length)
      // Sequential, and that is the promise: several pictures in one drop
      // attach in the order they were dropped, which is the order they will
      // ride the next message in.
      for (const file of taking) {
        const attached = await chat.attach(file)
        setSending((count) => count - 1)
        if (attached === null) continue
        setPending((already) => [...already, attached])
      }
      // Said AFTER the uploads, on the panel's one refusal line. Saying it
      // first would be saying it to nobody: `attach` clears the last refusal
      // as it starts, so it would flicker away on the first chunk of the
      // first picture that WAS taken.
      if (refusals.length > 0) chat.refuse(refusals.join("\n"))
    },
    remove: (name) =>
      setPending((already) => already.filter((attachment) => attachment.name !== name)),
    release: () => {
      const held = pending()
      setPending([])
      return held
    },
    restore: (attachments) => setPending((now) => (now.length === 0 ? attachments : now)),
  }
}
