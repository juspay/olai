/**
 * What the composer is HOLDING: files uploaded and waiting for a message to
 * go with them.
 *
 * It lives here rather than inside {@link ./Composer.tsx} because the gesture
 * and the strip are no longer in the same component. A file dragged at this
 * panel is aimed at the CONVERSATION, so the drop target is the panel's whole
 * body ({@link ./DropTarget.tsx}) — and the chips it lands in are a two-line
 * strip at the bottom of it. One owner above both: `Panel.tsx` makes this and
 * hands it to each.
 *
 * Four gestures arrive here and there is deliberately one way through: paste
 * (the desktop one), drop (for a file already on screen), and the two doors a
 * phone has — the roll picker and the camera beside it. What differs between
 * them is which listener called {@link Holding.take}; nothing below that line
 * knows which it was. A camera's one-shot rhythm is no case of its own here:
 * each invocation is one file, like one file in a drop.
 *
 * These chips refer to something the SERVER owns — files in the conversation's
 * tmp directory — so they are dropped when the conversation is. A chip left
 * over from the last one is a send the server would refuse, naming a file it
 * has already deleted.
 */

import type { Attached } from "olai-plugin-chat/wire"
import { type Accessor, createMemo, createSignal } from "solid-js"

import { refusalFor } from "./attach.ts"
import type { Chat } from "./state.ts"

/** A drop, split by the one gate: what will be offered, and what was turned
 *  down in the gate's own words. Both in the order they arrived. */
export interface Sorted {
  readonly taking: ReadonlyArray<File>
  readonly refusals: ReadonlyArray<string>
}

/**
 * Sort what was just dropped — or pasted, or picked — into what this app takes
 * and the refusals it owes for the rest.
 *
 * The gate is {@link refusalFor}: the chunk loop's own, which is
 * `@olai/surface`'s, which is the server's — and it is asked about the name
 * the upload would SEND, because it is the upload that answers. This is not a
 * second opinion about what may be attached. It is the one opinion, asked one
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
  /** The files already on the server, in the order they were attached. */
  readonly pending: Accessor<ReadonlyArray<Attached>>
  /** How many uploads are in flight, so the composer can say so. A count
   *  rather than a flag: three files in one drop are three uploads. */
  readonly sending: Accessor<number>
  /** Attach every one of these, in order — whatever the gate takes of them,
   *  and one answer on the panel's refusal line for everything it did not. */
  readonly take: (files: ReadonlyArray<File>) => Promise<void>
  /** Take one back off the strip before it is sent. */
  readonly remove: (name: string) => void
  /** Hand over everything held and empty the strip: what a send does. */
  readonly release: () => ReadonlyArray<Attached>
  /** Restore refused files to their original lifetime, even after a switch. */
  readonly restore: (scope: string | null, attachments: ReadonlyArray<Attached>) => void
}

const bin = () => {
  const [pending, setPending] = createSignal<ReadonlyArray<Attached>>([])
  const [sending, setSending] = createSignal(0)
  return { pending, setPending, sending, setSending }
}
const held = new Map<string, ReturnType<typeof bin>>()

export const createHolding = (chat: Chat): Holding => {
  // A drawer mount is not an upload lifetime. The server's token survives
  // remounts and node switches, but changes when its temporary files go away,
  // even if a restart reopens the same durable harness session.
  const empty = bin()
  const current = createMemo(() => {
    const scope = chat.state().uploadScope
    if (scope == null) return empty
    let value = held.get(scope)
    if (value === undefined) {
      value = bin()
      held.set(scope, value)
    }
    return value
  })

  return {
    pending: () => current().pending(),
    sending: () => current().sending(),
    take: async (files) => {
      const owner = current()
      const scope = chat.state().uploadScope
      const { taking, refusals } = sorting(files)
      // One gesture, one answer: the last one's is cleared as this one starts,
      // and everything this one has to say is said when it ends. Said file by
      // file instead, each reason would be rubbed out by the next upload —
      // which is the drop losing a file with nothing on screen about it.
      const reasons = [...refusals]
      chat.refuse([])
      owner.setSending((count) => count + taking.length)
      // Sequential, and that is the promise: several files in one drop
      // attach in the order they were dropped, which is the order they will
      // ride the next message in.
      for (const [index, file] of taking.entries()) {
        if (chat.state().uploadScope !== scope) {
          owner.setSending((count) => count - (taking.length - index))
          break
        }
        const answer = await chat.attach(file)
        owner.setSending((count) => count - 1)
        if (answer._tag === "refused") reasons.push(answer.failure.reason)
        // `gone` is not a refusal and says nothing: the conversation this was
        // being attached to was left while it uploaded, so there is no chip to
        // draw and nothing anybody needs telling.
        if (answer._tag !== "stored") continue
        owner.setPending((already) => [...already, answer.stored])
      }
      if (chat.state().uploadScope === scope) chat.refuse(reasons)
    },
    remove: (name) =>
      current().setPending((already) => already.filter((attachment) => attachment.name !== name)),
    release: () => {
      const owner = current()
      const attachments = owner.pending()
      owner.setPending([])
      return attachments
    },
    restore: (scope, attachments) => {
      if (scope === null) return
      held.get(scope)?.setPending((now) => [
        ...attachments.filter((file) => !now.some((later) => later.path === file.path)),
        ...now,
      ])
    },
  }
}
