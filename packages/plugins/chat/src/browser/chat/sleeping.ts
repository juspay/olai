/**
 * THE ITEM'S PURE QUESTIONS — which roster row a conversation is, what the switch
 * beside it says, and WHAT THE ITEM SAYS about when this chat last slept and when
 * it will next.
 *
 * WHICH CONVERSATION IS ON SCREEN is not one of them: that is the panel's own
 * address, and it lives in {@link ./address.ts} because the wake faces and the line
 * itself read it too.
 *
 * A PLAIN MODULE BESIDE THE COMPONENT rather than exports of it, because
 * `bun test` resolves SolidJS's server build (`justfile` says so where the
 * browser tests are counted) and a test that imported a `.tsx` for a predicate
 * would be pulling a renderer in to ask a question about an array.
 */

import { agoOf } from "@olai/web/client/ago.ts"
import { DAY, HOUR, MINUTE, SECOND, instantOf } from "@olai/web/client/clock.ts"
import type { Forecast, NodeAgentRow } from "../../wire.ts"
import type { Address } from "./address.ts"

/** WHICH ROW OF THE AGENTS ROSTER THIS CONVERSATION IS, or `undefined` — the
 *  node agent whose engine and conversation are the ones on screen.
 *
 *  A PLAIN CHAT HAS NO SUCH ROW, and that is the whole gate: a conversation
 *  nobody is seated on has no node to mark, so it gets no switch. Read off the
 *  agents reading the browser already holds — the rows `AgentPalette.ts` finds
 *  the shown conversation among — never by walking the vault from here.
 */
export const nodeAgentOf = (
  rows: ReadonlyArray<NodeAgentRow>,
  to: Address | undefined,
): NodeAgentRow | undefined =>
  to === undefined
    ? undefined
    : rows.find((row) => row.engine === to.agent && row.session === to.session)

/** THE SWITCH'S WORDS: `aria-checked` is the mark itself, and this is what a
 *  person reads beside it. */
export const sleepWords = (sleeps: boolean): "On" | "Off" => sleeps ? "On" : "Off"

/**
 * WHAT THE SLEEP ITEM SAYS, in a person’s words — the whole of what a reader
 * gets off a {@link Forecast}, and the reason the forecast is on the wire at all:
 * the browser renders it and re-derives nothing, so the strip and the pass can
 * never disagree about when a node is due.
 *
 * A PURE FUNCTION of the forecast and a clock, which is what makes the whole
 * table a unit test rather than something you have to wait six hours to see. Only
 * the component touches a clock, and it hands the same `now` down to every part.
 *
 * FIXED INSTANTS IN, WORDS OUT: every time here is the server’s, and the reader’s
 * clock is used for one thing only — turning an instant into "3h ago". That is
 * the same bargain `@olai/web/client/ago.ts` strikes with a stamp out of a git
 * repository, and it is struck for the same reason: timing from when this tab
 * began looking is not a smaller error, it is a systematic one.
 *
 * `null` IS A FORECAST TOO, and it means exactly one thing: there is no pass to
 * judge here — `sleep` is off in this directory’s settings, so no sleeper was
 * built. That is the state the switch cannot express and the words have to.
 */
export type SleepSaid = {
  /** The forecast’s own kind, so a scenario can assert the state as DATA — or
   *  `off`, which is the one state the WIRE cannot carry: `sleep: off` in the
   *  directory's settings is no sleeper at all, so it is a `null` forecast and
   *  there is no `off` arm on the wire to say so. This union is the words'. */
  readonly kind: Forecast["next"]["kind"] | "off"
  /** IS THERE A SWITCH TO PRESS — false only for `off in Settings`, where the
   *  answer is in a file a browser cannot write.
   *
   *  THE MARK IS NOT HERE, deliberately: whether this chat is tidied is the
   *  roster row's `sleeps`, and the switch's own `aria-checked` and its press read
   *  that and nothing else. This type is the FORECAST, and re-encoding the mark
   *  through a forecast kind would be two sources for one fact — they would
   *  disagree the first time one of them moved without the other. */
  readonly switch: boolean
  /** The words after the switch, in order. */
  readonly said: ReadonlyArray<string>
  /** The whole sentence, rhythm and all — what hovering the item gives. */
  readonly title: string
}

/** The file a person changes `sleep` and `sleep-after` in, named in the title
 *  because that is where the words above come from. */
const SETTINGS = "_olai/Settings.olai"

/** HOW LONG THE PASS WAITS, in a person’s words — `6 h` for the product’s own
 *  span, and the same words at whatever a test writes. */
const rhythmOf = (after: number): string => {
  if (after >= HOUR) return `${Math.round(after / HOUR)} h`
  if (after >= MINUTE) return `${Math.round(after / MINUTE)} min`
  return `${Math.round(after / SECOND)} s`
}

/** WHEN A DUE INSTANT ARRIVES, or `null` for one that has already arrived — the
 *  pass takes a node the moment its quiet window closes, so "next in 0s" is not
 *  a thing that can be true. */
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

/** A CLOCK TIME, for the backoff a failed pass leaves — the reader’s own
 *  hours and minutes, because "not before 14:05" is a statement about the
 *  clock on the wall in front of them. */
const clockOf = (at: string): string | null => {
  const moment = instantOf(at)
  if (moment === null) return null
  const when = new Date(moment)
  return `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`
}

/** WHEN IT LAST SLEPT, as a part — `last 3h ago`, or `never`. The word "last" is
 *  here rather than in the item because "3h ago" alone reads as when anything
 *  happened, and this is about one thing. */
const lastOf = (lastSlept: string | null, now: number): string => {
  const ago = lastSlept === null ? "" : agoOf(lastSlept, now)
  return ago === "" ? "never" : `last ${ago}`
}

/**
 * THE ITEM’S WORDS, by the state the pass is in.
 *
 * ONE KIND IS NOT A FORECAST AT ALL: `off` is the directory’s own setting, read
 * before a sleeper exists, and it is why the switch is `null` there — a person
 * changes that in {@link SETTINGS}, and offering them a switch that could only
 * fail would be worse than telling them where the answer lives.
 */
export const saidOf = (forecast: Forecast | null, now: number): SleepSaid => {
  const title = forecast === null
    ? `olai does not tidy this chat’s memory: sleep is off in ${SETTINGS}`
    : `olai tidies this chat’s memory after ${rhythmOf(forecast.after)} alone and when it has changed since the last pass (sleep-after in ${SETTINGS})`
  if (forecast === null) {
    // THE WORDS LIVE WHERE THE SWITCH WOULD BE, so this arm has nothing after it:
    // a person reads `Sleep · off in Settings` and the sentence is complete.
    return { kind: "off", switch: false, said: [], title }
  }
  const { lastSlept, next } = forecast
  const last = lastOf(lastSlept, now)
  switch (next.kind) {
    // NOBODY HAS ASKED FOR THIS ONE — the mark is off, so there is nothing to
    // say about when it will sleep. What it did say is when it last did, which
    // is the fact a person deciding whether to turn it on wants.
    case "unmarked":
      return { kind: next.kind, switch: true, said: last === "never" ? [] : [last], title }
    // A NODE WITH NO CONVERSATION is not asleep, it is unbound: there is nothing
    // to hand a turn to, and the pass cannot act however due it is.
    case "unbound":
      return { kind: next.kind, switch: true, said: ["no conversation yet"], title }
    case "unchanged":
      return { kind: next.kind, switch: true, said: [last, "nothing new to tidy"], title }
    // NOT ENOUGH HAS MOVED — the pressure half of the rule, and the reason this
    // state exists: a node that is not being tidied looks exactly like a node
    // that has nothing to tidy, so the item says how many rows did move and what
    // the floor is.
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
    // `off` IS ALREADY ANSWERED, and TypeScript knows it: the guard above narrows
    // this switch to the seven kinds a JUDGEMENT can return, so the table is
    // exhaustive here and a kind added to the wire is a decision rather than a
    // silent `undefined` — the arm below would not compile if it were not.
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
