import { agoOf } from "@olai/web/client/ago.ts"
import { DAY, HOUR, MINUTE, SECOND, instantOf } from "@olai/web/client/clock.ts"
import type { Forecast, NodeAgentRow } from "../../wire.ts"
import type { Address } from "./address.ts"

export const nodeAgentOf = (
  rows: ReadonlyArray<NodeAgentRow>,
  to: Address | undefined,
): NodeAgentRow | undefined =>
  to === undefined
    ? undefined
    : rows.find((row) => row.kind === "node" && row.engine === to.agent && row.session === to.session)

export const sleepWords = (sleeps: boolean): "On" | "Off" => sleeps ? "On" : "Off"

export type SleepSaid = {
  readonly kind: Forecast["next"]["kind"] | "off"
  readonly switch: boolean
  readonly said: ReadonlyArray<string>
  readonly title: string
}

const SETTINGS = "_olai/Settings.olai"

const rhythmOf = (span: number): string => {
  if (span >= DAY) return `${Math.round(span / DAY)} d`
  if (span >= HOUR) return `${Math.round(span / HOUR)} h`
  if (span >= MINUTE) return `${Math.round(span / MINUTE)} min`
  return `${Math.round(span / SECOND)} s`
}

const inWords = (at: string, now: number): string | null => {
  const moment = instantOf(at)
  if (moment === null) return null
  const until = moment - now
  if (until <= 0) return null
  if (until < MINUTE) return `in ${Math.max(1, Math.floor(until / SECOND))}s`
  if (until < HOUR) return `in ${Math.floor(until / MINUTE)}m`
  if (until < DAY) return `in ${Math.floor(until / HOUR)}h`
  return `in ${Math.floor(until / DAY)}d`
}

const clockOf = (at: string): string | null => {
  const moment = instantOf(at)
  if (moment === null) return null
  const when = new Date(moment)
  return `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`
}

const lastOf = (lastSlept: string | null, now: number): string => {
  const ago = lastSlept === null ? "" : agoOf(lastSlept, now)
  return ago === "" ? "never" : `last ${ago}`
}

export const saidOf = (forecast: Forecast | null, now: number): SleepSaid => {
  const title = forecast === null
    ? `olai does not tidy this chat’s memory: sleep is off in ${SETTINGS}`
    : `olai tidies this chat’s memory after ${rhythmOf(forecast.after)} alone, once ` +
      `${forecast.floor} rows have moved since the last pass or any moved row has waited ` +
      `${rhythmOf(forecast.latest)} (sleep-after, sleep-floor, sleep-latest in ${SETTINGS})`
  if (forecast === null) {
    return { kind: "off", switch: false, said: [], title }
  }
  const { lastSlept, next } = forecast
  const last = lastOf(lastSlept, now)
  switch (next.kind) {
    case "unmarked":
      return { kind: next.kind, switch: true, said: last === "never" ? [] : [last], title }
    case "unbound":
      return { kind: next.kind, switch: true, said: ["no conversation yet"], title }
    case "unchanged":
      return { kind: next.kind, switch: true, said: [last, "nothing new to tidy"], title }
    case "little":
      return {
        kind: next.kind,
        switch: true,
        said: [last, `too little to tidy · ${next.rows} of ${forecast.floor} rows`],
        title,
      }
    case "busy":
      return { kind: next.kind, switch: true, said: [last, "when this chat is quiet"], title }
    case "running":
      return { kind: next.kind, switch: true, said: [last, "tidying now"], title }
    case "skipped": {
      const before = clockOf(next.until)
      return {
        kind: next.kind,
        switch: true,
        said: before === null ? ["last pass failed"] : ["last pass failed", `not before ${before}`],
        title,
      }
    }
    case "due": {
      const soon = inWords(next.at, now)
      return {
        kind: next.kind,
        switch: true,
        said: [last, soon === null ? "due now" : `next ${soon} if left alone`],
        title,
      }
    }
  }
}
