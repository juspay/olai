import { createContext, type JSX, useContext } from "solid-js"

import type { OduClocks } from "./app.ts"

const ClocksContext = createContext<OduClocks>()

const SECOND = 1_000

const STILL: OduClocks = {
  SECOND,
  createTicking: () => {
    const at = Date.now()
    return () => at
  },
  createNow: () => {
    const at = Date.now()
    return () => at
  },
  wordsOf: (seconds) => `${Math.max(0, Math.round(seconds))}s`,
  exactOf: (seconds) => `${Math.max(0, Math.round(seconds))}s`,
  tickingOf: (elapsedMs) => `${Math.max(0, Math.round(elapsedMs / SECOND))}s`,
}

export const useClocks = (): OduClocks => useContext(ClocksContext) ?? STILL

export function ClocksProvider(props: {
  readonly clocks: OduClocks
  readonly children: JSX.Element
}): JSX.Element {
  return (
    <ClocksContext.Provider value={props.clocks}>
      {props.children}
    </ClocksContext.Provider>
  )
}
