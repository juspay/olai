export interface Awaiting {
  readonly count: number
  readonly watched: boolean
}

export interface Alarm {
  readonly alert: boolean
  readonly badge: number
}

export const alarmFor = (was: Awaiting | undefined, now: Awaiting): Alarm => ({
  alert: was !== undefined && !now.watched && now.count > was.count,
  badge: now.watched ? 0 : now.count,
})
