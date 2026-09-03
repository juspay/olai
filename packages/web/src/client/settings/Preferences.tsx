/**
 * The way into the preferences: one control in the app header, and the panel it
 * opens.
 *
 * It is in the HEADER on desktop because the header carries what is about the
 * APP and the sidebar what is about the DIRECTORY (`../AppHeader.tsx`), and
 * how this browser reads is a fact about the app in every directory it is
 * pointed at. On a phone it is a row at the foot of the directory drawer —
 * the closet, not a fifth chip in a bar that has no room for four.
 *
 * It REPLACED the theme pill rather than joining it. The pill was a preference
 * with a control of its own outside the place preferences are set, and a bar
 * that has five things in it at 390pt cannot spend one of them on a second door
 * to a panel that is already there — the same argument `one-git-indicator`
 * settled for the two git chips. What the pill promised (it NAMED the theme in
 * force) is kept: the theme row's hint names it, one gesture further in, and
 * the page itself is painted in it — which is the difference from the
 * connection and the commit pill, whose facts are invisible unless a control
 * says them and which therefore may never be a gesture away.
 *
 * WHAT A DOOR IN THIS BAR IS — the two shapes, the portal out of a stacking
 * context, and the focus cycle it shares with the Commit panel two pills along
 * — is `../BarDoor.tsx` now. This was the canonical one and the plugins door
 * was written as a copy of it; the shared half moved out from under both.
 */

import { BarDoor } from "../BarDoor.tsx"
import { Panel } from "./Panel.tsx"
import { TESTID } from "../testids.ts"

export function Preferences(props: {
  /** `closet` is the phone drawer row. Default is the header chip. */
  readonly where?: "header" | "closet"
}) {
  return (
    <BarDoor
      where={props.where}
      glyph="⚙"
      header="prefs"
      closet="preferences"
      testid={TESTID.prefsTrigger}
      title="preferences: theme, type, finished work, and whether git commits and pushes on its own"
      panel={(at, inside) => <Panel at={at} inside={inside} />}
    />
  )
}
