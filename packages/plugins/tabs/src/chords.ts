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
