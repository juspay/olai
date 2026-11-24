/**
 * What a browser tab's connection to the server says about itself — the
 * vocabulary both ends of that connection share.
 *
 * A tab keeps a diary of its socket (dialled, opened, dropped and why, the
 * card over a frozen page going up and down) and posts it to the server, which
 * logs each entry beside its own account of the same socket. So the entry is a
 * VALUE that crosses HTTP ({@link Entry}, an Effect `Schema`), and how a value
 * reads is decided once, here ({@link describe}), rather than at each call site
 * that has something to say. A new event nobody described is a compile error:
 * `describe` is total over {@link LinkEvent}, with no default arm.
 *
 * Effect only, and no `process`: the browser imports this door, and the root
 * door pulls in the sinks, which read `process.stdout` when they load. The
 * door also carries the two other things both ends share: the tab's stamp on a
 * socket's URL (`./stamp.ts`) and the rule for a failure that can repeat
 * forever (`./sparing.ts`).
 *
 * Fields are sizes, codes, counts, tags and subscription labels. No frame's
 * content is ever an entry.
 */

import { Schema } from "effect"
import { Tab } from "./stamp.ts"

export { stamped, stampOf, Tab } from "./stamp.ts"
export { SAY_AGAIN_AFTER_MS, sparingly } from "./sparing.ts"

// ── Frames ──────────────────────────────────────────────────────────────────

/** A frame's size as the tab's decoder counts it: UTF-16 code units for text,
 *  bytes otherwise. The sizes on both ends' lines are counted this way, so
 *  they compare with each other and with the wire's cap. */
export const frameSize = (data: unknown): number =>
  typeof data === "string"
    ? data.length
    : data instanceof ArrayBuffer || ArrayBuffer.isView(data)
    ? data.byteLength
    : typeof Blob !== "undefined" && data instanceof Blob
    ? data.size
    : 0

// ── Close codes ─────────────────────────────────────────────────────────────

/** What a WebSocket close code means, in a word or two. One table for both
 *  ends: RFC 6455's codes olai's sockets actually see, and 4001, the code the
 *  server closes a tab bound to a previous process with. */
const CLOSE_CODES: Readonly<Record<number, string>> = {
  1000: "normal",
  1001: "going away",
  1005: "no status",
  1006: "abnormal",
  1009: "too big",
  1011: "internal",
  4001: "stale process",
}

export const closeMeans = (code: number): string => CLOSE_CODES[code] ?? "unlisted"

// ── Causes ──────────────────────────────────────────────────────────────────

/**
 * Why a socket that had opened ended. Closed, picked by the browser from typed
 * facts (never from an error's text):
 *
 * | cause | when |
 * | --- | --- |
 * | `peer-closed` | the page never called `close()`: the server or the network ended it |
 * | `frame-over-cap` | the page closed it after a frame larger than the wire's cap arrived |
 * | `half-open` | the page closed it because the heartbeat heard nothing back |
 * | `roster-refresh` | olai refreshed an open socket after the plugin roster moved |
 * | `redial` | olai dialled again with a new set of plugins |
 * | `unload` | the page was going away |
 * | `severed` | the page closed it and none of the above holds |
 */
export const Cause = Schema.Literals([
  "peer-closed",
  "frame-over-cap",
  "half-open",
  "roster-refresh",
  "redial",
  "unload",
  "severed",
])
export type Cause = typeof Cause.Type

/** The causes olai itself declares before it closes a socket. They are the
 *  ordinary life of a page, so they read at `debug`. */
const isDeclared = (cause: Cause): boolean => cause === "roster-refresh" || cause === "redial" || cause === "unload"

// ── Events ──────────────────────────────────────────────────────────────────

/** Bounded text: what a browser says can never be longer than this, so a
 *  refused or decoded body cannot grow a log line without limit. */
const Text = (max: number) => Schema.String.check(Schema.isMaxLength(max))
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
/** Milliseconds. */
const Ms = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))

/** A failure text heard on one dial, and how many times. */
export const Heard = Schema.Struct({ text: Text(200), count: Count })
export type Heard = typeof Heard.Type

/** How many failure texts and how many subscription labels a drop carries. */
export const HEARD_LIMIT = 5
export const STARVED_LIMIT = 10

/**
 * Every event the browser's diary records. One case per thing that happens to
 * the link, each with only the facts that event has.
 */
export const LinkEvent = Schema.TaggedUnion({
  /** A socket was constructed. */
  Dialling: {},
  /** It opened. `recovered` is true when the dial before it ended by itself
   *  (not by olai's own redial) or never opened. */
  Opened: { took: Ms, recovered: Schema.Boolean },
  /** An opened socket ended. `code`, `reason` and `clean` are the close
   *  event's; absent when the page went away before one arrived. `silent` is
   *  how long nothing had arrived; `heard` the failure texts its
   *  subscriptions were told on this dial; `starved` the subscriptions that
   *  received nothing on it, and how many more there were. */
  Dropped: {
    cause: Cause,
    code: Schema.optionalKey(Count),
    reason: Schema.optionalKey(Text(200)),
    clean: Schema.optionalKey(Schema.Boolean),
    lived: Ms,
    silent: Ms,
    inFrames: Count,
    inBytes: Count,
    largestIn: Count,
    outFrames: Count,
    outBytes: Count,
    refusedSends: Count,
    heard: Schema.Array(Heard).check(Schema.isMaxLength(HEARD_LIMIT)),
    starved: Schema.Array(Text(200)).check(Schema.isMaxLength(STARVED_LIMIT)),
    starvedMore: Count,
    hidden: Schema.Boolean,
    online: Schema.Boolean,
  },
  /** Sockets ended without opening; `attempts` is how many since the last time
   *  this was said. */
  Unopened: { took: Ms, code: Schema.optionalKey(Count), attempts: Count, online: Schema.Boolean },
  /** The heartbeat's probe went unanswered, so the page is about to close an
   *  open socket. */
  Stale: { silent: Ms, hidden: Schema.Boolean },
  /** The server retired this tab: it was replaced by a newer process. */
  Retired: { code: Schema.optionalKey(Count) },
  /** The card over a frozen page went up or came down. `status` is the
   *  connection state that put it up (`connecting`, `reconnecting` or
   *  `retired`: a degraded connection still reaches the server, so it never
   *  freezes the page) and `urged` whether this page's own roster change did;
   *  both are the card's, on the way down too. `after` is how long it was up,
   *  on the way down. */
  Card: { shown: Schema.Boolean, status: Text(32), urged: Schema.Boolean, after: Schema.optionalKey(Ms) },
  /** The connection readout changed status. */
  Readout: { from: Text(32), to: Text(32), stopped: Schema.Array(Text(200)).check(Schema.isMaxLength(STARVED_LIMIT)) },
  /** olai redialled for a plugin roster change. */
  Roster: { restarting: Schema.Array(Text(64)).check(Schema.isMaxLength(64)) },
  /** …and could not follow it. */
  RosterRefused: { why: Text(200) },
  /** The page could not read which plugins to start before its socket
   *  answered. */
  BootFailed: { why: Text(200) },
})
export type LinkEvent = typeof LinkEvent.Type

/** A wall-clock instant, in milliseconds since the epoch, no later than the
 *  last one a JavaScript `Date` can hold, so every entry that decodes can be
 *  printed as a date. */
const At = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 8_640_000_000_000_000 }))

/**
 * One diary line. `seq` orders a tab's entries; `at` is the browser's wall
 * clock (comparable to a server log); `dial` the socket it is about (0 before
 * the first); `streak` how many dials in a row have dropped the same way (0
 * when there is none).
 */
export const Entry = Schema.Struct({
  seq: Count,
  at: At,
  dial: Count,
  streak: Count,
  event: LinkEvent,
})
export type Entry = typeof Entry.Type

/** What a tab posts: its id, a run of its entries, and how many entries its
 *  diary had to drop since the last post because nobody was taking them. */
export const Batch = Schema.Struct({
  tab: Tab,
  entries: Schema.Array(Entry).check(Schema.isMaxLength(500)),
  lost: Count,
})
export type Batch = typeof Batch.Type

// ── Loops ───────────────────────────────────────────────────────────────────

/** A dial that lived less than this and dropped the same way as the one before
 *  it continues a streak. */
const STREAK_LIVED_MS = 60_000

/** The next streak, given the last drop's and this one's. A drop that lived a
 *  minute or more, or ended differently, starts again at 1. */
export const nextStreak = (
  last: { readonly cause: Cause; readonly streak: number; readonly lived: number } | undefined,
  now: { readonly cause: Cause; readonly lived: number },
): number =>
  last !== undefined && last.cause === now.cause && last.lived < STREAK_LIVED_MS && now.lived < STREAK_LIVED_MS
    ? last.streak + 1
    : 1

/** Is this streak said at full level? The first three, then every tenth: a loop
 *  is visible as `streak=10`, `streak=20` and does not bury the log. */
export const loudAt = (streak: number): boolean => streak <= 3 || streak % 10 === 0

// ── Reading ─────────────────────────────────────────────────────────────────

export type Field = string | number | boolean
/** The four levels a link line is ever said at: Effect's own names. */
export type Level = "Debug" | "Info" | "Warn" | "Error"
export interface Described {
  readonly level: Level
  readonly message: string
  readonly fields: Readonly<Record<string, Field>>
}

/** Milliseconds as a person reads them in a log: `850ms`, `1.9s`, `64s`. */
export const duration = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)}ms` : ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`

/** Text cut to `max` characters, so it fits the field it is said in. */
export const clip = (text: string, max: number): string => text.length > max ? `${text.slice(0, max - 1)}…` : text

const quieted = (level: Level, streak: number): Level => loudAt(streak) ? level : "Debug"

/** How one entry reads: its level, its sentence, its fields. Total over
 *  {@link LinkEvent}; the fields that place an entry (`tab`, `dial`, `seq`,
 *  `at`) are the caller's to add. */
export const describe = (entry: Entry): Described => {
  const { event, streak } = entry
  switch (event._tag) {
    case "Dialling":
      return { level: "Debug", message: "wire dialling", fields: {} }
    case "Opened":
      return {
        level: event.recovered ? quieted("Info", streak) : "Debug",
        message: "wire opened",
        fields: { took: duration(event.took) },
      }
    case "Dropped":
      return {
        level: isDeclared(event.cause) ? "Debug" : quieted("Warn", streak),
        message: "wire dropped",
        fields: {
          cause: event.cause,
          by: event.cause === "peer-closed" ? "peer" : "page",
          ...(event.code === undefined ? {} : { code: event.code, means: closeMeans(event.code) }),
          ...(event.reason ? { reason: event.reason } : {}),
          ...(event.clean === undefined ? {} : { clean: event.clean }),
          lived: duration(event.lived),
          silent: duration(event.silent),
          inFrames: event.inFrames,
          inBytes: event.inBytes,
          largestIn: event.largestIn,
          outFrames: event.outFrames,
          outBytes: event.outBytes,
          refusedSends: event.refusedSends,
          ...(event.heard.length === 0
            ? {}
            : { heard: event.heard.map(({ text, count }) => count > 1 ? `${text} ×${count}` : text).join("; ") }),
          ...(event.starved.length === 0
            ? {}
            : { starved: event.starved.join(", ") + (event.starvedMore > 0 ? ` +${event.starvedMore}` : "") }),
          hidden: event.hidden,
          online: event.online,
          streak,
        },
      }
    case "Unopened":
      return {
        level: "Warn",
        message: "dial did not open",
        fields: {
          took: duration(event.took),
          ...(event.code === undefined ? {} : { code: event.code, means: closeMeans(event.code) }),
          attempts: event.attempts,
          online: event.online,
        },
      }
    case "Stale":
      return { level: "Warn", message: "heartbeat gave up", fields: { silent: duration(event.silent), hidden: event.hidden } }
    case "Retired":
      return {
        level: "Warn",
        message: "wire retired",
        fields: event.code === undefined ? {} : { code: event.code, means: closeMeans(event.code) },
      }
    // News only when nobody asked for it and it is not the first connection:
    // the card a page load draws while it connects, and the one a page's own
    // plugin switch draws, are the ordinary life of a page.
    case "Card":
      return {
        level: event.urged || event.status === "connecting" ? "Debug" : quieted("Info", streak),
        message: event.shown ? "connection card shown" : "connection card lifted",
        fields: {
          status: event.status,
          urged: event.urged,
          ...(event.after === undefined ? {} : { after: duration(event.after) }),
        },
      }
    case "Readout":
      return {
        level: event.to === "degraded" ? "Warn" : event.from === "degraded" ? "Info" : "Debug",
        message: "readout changed",
        fields: {
          from: event.from,
          to: event.to,
          ...(event.stopped.length === 0 ? {} : { stopped: event.stopped.join(", ") }),
        },
      }
    case "Roster":
      return {
        level: "Debug",
        message: "roster redial",
        fields: event.restarting.length === 0 ? {} : { restarting: event.restarting.join(", ") },
      }
    case "RosterRefused":
      return { level: "Error", message: "roster redial refused", fields: { why: event.why } }
    case "BootFailed":
      return { level: "Warn", message: "browser bootstrap could not be read", fields: { why: event.why } }
  }
}
