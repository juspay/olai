import { useShown } from "olai-plugin-navigation/routing"

import type { ChatEntry } from "olai-plugin-chat/wire"
import { createContext, type JSX, useContext } from "solid-js"

import { createNow, elapsedOf } from "./elapsed.ts"

type Elapsed = (entry: ChatEntry) => string | null

const ElapsedContext = createContext<Elapsed>()

export function ElapsedProvider(props: {
  readonly live: boolean
  readonly children: JSX.Element
}) {
  const shown = useShown()
  const now = createNow(() => shown() && props.live)
  return (
    <ElapsedContext.Provider value={(entry) => elapsedOf(entry, now)}>
      {props.children}
    </ElapsedContext.Provider>
  )
}

export const useElapsed = (): Elapsed => {
  const elapsed = useContext(ElapsedContext)
  if (elapsed === undefined) throw new Error("an elapsed lookup outside <ElapsedProvider>")
  return elapsed
}
