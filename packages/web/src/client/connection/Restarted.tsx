/**
 * The server was replaced. This page is over.
 *
 * A dot in the corner is the right weight for a drop that will heal itself; it
 * is the wrong weight for this one, because nothing here heals: the link has
 * been retired by the server's own handshake, and no amount of waiting brings
 * an update back. So this takes the screen — the one connection state that is
 * allowed to.
 *
 * A button, not an automatic reload. The reload lands a different bundle and
 * throws away whatever is on screen, and doing that to a page someone is
 * reading — mid-sentence, mid-scroll — without asking is how a live app becomes
 * a rude one. It is also what kolu does, and this is kolu's pattern. The button
 * itself is ../Reload.tsx, shared with the one other screen a reload is the
 * only way out of (../errors/Fault.tsx).
 *
 * The dim lets clicks through so the outline underneath stays readable and
 * scrollable while the reader finishes what they were doing; the card does not.
 */

import { Reload } from "../Reload.tsx"
import { RAISED } from "../surface.ts"
import { TESTID } from "../testids.ts"

export function Restarted(props: { readonly onReload: () => void }) {
  return (
    <div
      class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      data-testid={TESTID.restarted}
    >
      <div class={`pointer-events-auto max-w-sm rounded-2xl ${RAISED} px-6 py-5`}>
        <h2 class="m-0 mb-1 text-base font-bold text-ink">The server restarted</h2>
        <p class="m-0 mb-4 text-sm text-muted">
          This page came from a server process that is gone, so nothing on it
          will change again. Reloading connects to the one running now.
        </p>
        <Reload onReload={props.onReload} />
      </div>
    </div>
  )
}
