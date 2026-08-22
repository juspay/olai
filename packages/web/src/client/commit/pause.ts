/**
 * WHY AUTO-COMMIT STOPPED, as a thing two surfaces can both reach.
 *
 * The pause is runtime STATE and not a preference: git refused something, so
 * the loop stopped and will not go round again until a person says they have
 * dealt with it (`./auto.ts` argues why nothing clears it on olai's own
 * initiative). It used to be a signal inside the loop, which was right while
 * the only way to clear it was to turn Auto-commit off and on again — that
 * gesture is the preference moving, and the loop could watch the preference.
 *
 * `vault-level-settings` took that gesture away in the case it matters most.
 * A server started with `--commit=auto` pins the row read-only in every
 * browser, so there is no toggle to flip, and a loop that stops there stops for
 * good — silently, which is the one thing Auto-commit may never do. So the
 * frozen row carries a **Resume** button, and Resume is in the preferences
 * panel while the loop is in the header's commit pill. Two components, one
 * fact.
 *
 * A MODULE-LEVEL value with a factory beside it, which is this client's shape
 * for exactly this (`../pins/pinning.ts`, `../palette/open.ts`): {@link
 * autoPause} is the one the app runs on, and {@link createPause} is what a test
 * — or a second loop, if there is ever one — makes its own with.
 */

import { type Accessor, createRoot, createSignal } from "solid-js"

export interface Pause {
  /** What git said when it refused, or `null` while the loop is running. */
  readonly said: Accessor<string | null>
  /** Stop the loop, with the words that stopped it. */
  readonly stop: (said: string) => void
  /** Start it again — the person saying they have dealt with whatever git
   *  said. The ONE way out, whether it is pressed as Resume on a frozen row or
   *  reached by turning Auto-commit off and on again. */
  readonly resume: () => void
}

/** One pause, unattached to anything. */
export const createPause = (): Pause => {
  const [said, setSaid] = createSignal<string | null>(null)
  return {
    said,
    stop: (why) => setSaid(why),
    resume: () => setSaid(null),
  }
}

/** The one the app runs on. `createRoot` for the reason `../pins/pinning.ts`'s
 *  line takes one: it belongs to the document rather than to any component,
 *  since the loop that writes it and the Resume button that clears it are two
 *  different corners of the header. */
export const autoPause: Pause = createRoot(createPause)
