/**
 * Phone news, under the header: connection or git, only when there is
 * something to interrupt the page for.
 *
 * WhatsApp's rule, not a rearrangement of the desktop pills. A healthy phone
 * does not advertise health — `live` and `✓ committed` stay off screen. A
 * dead wire is already the freeze overlay (`connection/Offline.tsx`); a
 * subscription that stopped while the socket is up, and git that has work
 * waiting, are banners a tap can act on. Desktop keeps the header pills,
 * which is a different argument (a bar of chips cannot be trusted if the
 * healthy ones disappear).
 *
 * In flow under the bar, not sticky with it: a banner that stayed in the
 * header's stacking context painted over the directory drawer. The drawer
 * and the chat sheet start at `--height-header` and cover it when they are
 * open, which is right — those are the directory and the agent. Scroll
 * takes the banner with the page, the way a WhatsApp banner leaves once
 * you have seen it.
 */

import { Show } from "solid-js"

import { Commit } from "./commit/Commit.tsx"
import { ConnectionNews } from "./connection/News.tsx"
import { desktop } from "./layout/media.ts"
import { connectionReadout } from "./wire.ts"

export function News() {
  return (
    <Show when={!desktop()}>
      <ConnectionNews readout={connectionReadout()} />
      <Commit />
    </Show>
  )
}
