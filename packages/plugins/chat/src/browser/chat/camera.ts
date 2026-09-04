/**
 * Whether this device may offer a CAMERA beside the roll, and the one line
 * that decides it.
 *
 * The entry exists for a phone: the browser sees the form's `capture`
 * attribute and opens the camera itself, so the button says "take a photo"
 * and means it. Everywhere else the SAME markup is a lie: the attribute is
 * ignored and the button opens an ordinary file dialog, in front of no
 * camera it could name. So the question is about the POINTER, not the
 * layout — a laptop's window dragged narrow is still a mouse machine whose
 * camera button would open a picker, and a phone held sideways is still a
 * phone.
 *
 * `pointer: coarse` is the proxy, and it is worth saying why it is the right
 * one, since there is no true probe for `capture` (the attribute has no API
 * behind it) and sniffing the user agent is the worse answer. Every device
 * whose camera this is for is coarse-FIRST: a phone, a tablet. The device
 * class that has both a touchscreen and a lens but must NOT get the button —
 * the touchscreen laptop — reports its PRIMARY pointer as fine (`any-pointer`
 * is where its screen shows up), so it is excluded by definition rather than
 * by a list of models somebody has to keep.
 *
 * module-scoped like `../layout/media.ts`, and for that file's reason: one
 * listener for the document's life, shared by every reader.
 */

import { type Accessor, createSignal } from "solid-js"

/** The platform's own answer to "is the primary pointer a finger". */
const COARSE_MQ = "(pointer: coarse)"

const [offered, setOffered] = createSignal(
  typeof window !== "undefined" && window.matchMedia(COARSE_MQ).matches,
)

let watching = false

/** Start the listener. Idempotent; called from this plugin's own `apply`
 *  (`../../browser.tsx`) — it was the app's entry when the panel was core's. */
export const trackCamera = (): void => {
  if (watching || typeof window === "undefined") return
  watching = true
  const mq = window.matchMedia(COARSE_MQ)
  const apply = () => setOffered(mq.matches)
  apply()
  mq.addEventListener("change", apply)
}

/** Whether the composer may draw the camera's door. */
export const camera: Accessor<boolean> = offered
