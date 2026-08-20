/**
 * The button that ends a page that is over.
 *
 * Two surfaces draw it and they are the two states a reload is the only way
 * out of: the server that served this page has been replaced — the one frozen
 * state with something to offer besides waiting, so the button rides the
 * offline overlay (./connection/Offline.tsx) — and this client threw while
 * drawing (./errors/Fault.tsx). They already share `TESTID.reload`, because to
 * a reader — and to a test — it is one control; this is the rest of that
 * sharing, so the label and the look cannot drift apart between two screens a
 * person will only ever see one of.
 *
 * A BUTTON, never automatic, and the argument came from the screen the overlay
 * replaced: a reload lands a different bundle and throws away what is on
 * screen, and doing that to somebody mid-sentence without asking is how a live
 * app becomes a rude one.
 *
 * WHAT it reloads is the caller's, not this component's. Both callers pass
 * `reloadForUpdate` today — the framework's, so the browser lands on the
 * `no-store` shell and the bundle it names rather than on whatever a cache
 * still remembers — but which recovery a screen offers is that screen's
 * decision, made where the screen knows what went wrong.
 */

import { TESTID } from "./testids.ts"
import { TARGET } from "./touch.ts"

export function Reload(props: { readonly onReload: () => void }) {
  return (
    <button
      type="button"
      class={`inline-flex ${TARGET} items-center rounded bg-accent px-4 py-1.5 text-sm font-semibold text-paper hover:opacity-90 md:min-h-0 md:px-3`}
      data-testid={TESTID.reload}
      onClick={() => props.onReload()}
    >
      Reload
    </button>
  )
}
