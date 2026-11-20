export interface Clock {
  readonly now: () => number
  readonly pass: (ms: number) => void
}

export const clock = (from: string | number): Clock => {
  let at = typeof from === "string" ? Date.parse(from) : from
  return { now: () => at, pass: (ms: number) => { at += ms } }
}
