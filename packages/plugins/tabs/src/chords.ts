/**
 * THE TAB CHORDS, registered in `app.keys` and dispatched by the palette's key
 * handler — which decides the modifier (⌘ on Apple, Ctrl elsewhere) once for
 * every chord in the app, so all this row chooses is a key and Shift.
 *
 * The browser keeps ⌘T, ⌘W, ⌘1–⌘9 and ⌘⇧[ ⌘⇧] for its own tabs, and the app's
 * core table holds `k`, `\`, `j`, `z`, `⇧z`, `⇧w` and `o`; these four are what
 * is left that says what it does. Every one is about the PAGE rather than the
 * caret, so it fires while typing, and every one does nothing while no strip
 * draws the tabs on a desktop.
 */
import type { AppChord } from "olai-plugin-navigation/slots"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { lone } from "olai-plugin-navigation/workspace"

import type { TabsState } from "./contract.ts"

export const chordsOf = (tabs: TabsState): ReadonlyArray<AppChord> => {
  const drawn = (press: () => void) => () => {
    if (tabs.drawn()) press()
  }
  return [
    { key: ".", shift: true, whileEditing: true, said: "Next tab", press: drawn(() => tabs.step(1)) },
    { key: ",", shift: true, whileEditing: true, said: "Previous tab", press: drawn(() => tabs.step(-1)) },
    { key: "o", shift: true, whileEditing: true, said: "New tab", press: drawn(() => { tabs.open(lone(HOME_ROUTE)) }) },
    { key: "x", shift: true, whileEditing: true, said: "Close tab", press: drawn(() => tabs.close(tabs.front())) },
  ]
}
