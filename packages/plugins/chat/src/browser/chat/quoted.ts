export interface Run {
  readonly code: boolean
  readonly text: string
}

const SPAN = /`([^`\n]+)`/g

export const quotedRuns = (text: string): ReadonlyArray<Run> => {
  const runs: Array<Run> = []
  let at = 0
  for (const found of text.matchAll(SPAN)) {
    const said = found[1]
    if (said === undefined) continue
    const before = text.slice(at, found.index)
    if (before !== "") runs.push({ code: false, text: before })
    runs.push({ code: true, text: said })
    at = found.index + found[0].length
  }
  const rest = text.slice(at)
  if (rest !== "") runs.push({ code: false, text: rest })
  return runs
}
