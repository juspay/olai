export const waitingMark = (waiting: boolean): "waiting" | undefined =>
  waiting ? "waiting" : undefined

export const busyMark = (waiting: boolean): "true" | undefined =>
  waiting ? "true" : undefined
