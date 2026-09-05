/** A row form's pending write and response outlive its rendered controls. */
import { createSignal } from "solid-js"
import type { Said } from "../saying.ts"

export const createSubmission = () => {
  const [said, setSaid] = createSignal<Said | null>(null)
  const [sending, setSending] = createSignal(false)
  let revision = 0
  return {
    said, setSaid, sending, setSending,
    revision: () => revision,
    dismiss: () => { revision++; setSaid(null) },
  }
}
export type Submission = ReturnType<typeof createSubmission>
