/**
 * THE VAULT HALF of the attention watcher — what `_olai/Kolu.olai` says.
 *
 * HERE rather than in `@olai/kolu-client` for `claimants.ts`'s reason,
 * one shelf below: the config file is reading of the SET and nothing to
 * do with kolu. The package that dials padi gets the derived intervals
 * and the mute VALUES, four words and a number twice, and never learns
 * that an outline record exists.
 *
 * This is `@olai`'s own judgement ABOUT kolu, and the structure is
 * borrowed outright: one file by convention (`kolu.olai`, which is what
 * `_olai/Kolu.olai` reads as, found the way every convention file is
 * found — shallowest first, ties by path), two titled nodes under it,
 * and everything else left alone.
 *
 *   # Kolu
 *
 *   - watch                            ← the knobs, properties:
 *     - held-for: "60s"                ← debounce before a held state fires
 *     - nag: "10m"                     ← re-fire while a fired state holds
 *     - heartbeat: "30m"               ← proof-of-life when nothing holds
 *   - mutes                            ← terminals that never fire, by
 *     - some note or nothing           ← child, with `terminal: <id-or-prefix>`
 *
 * The knobs are DURATIONS — `<n>s`, `<n>m` or `<n>h`, the same grammar
 * padi's `heldForMs` documents its own watch flags in — and a value that
 * is not one is a malformed value: the default stands and the line it
 * earns is returned, for the caller to SAY (`koluHalf`'s `revision`,
 * which is where the "log line" the brief promises lives). The vault
 * text is authoritative-as-written rather than repaired: olai does not
 * edit the person's file.
 *
 * The values are read across the whole file's nodes, and the FIRST
 * `watch` node decides, for the reason throttle decided the key: one
 * file is one decision, and a second `watch` node is the owner's mistake,
 * not a precedence question.
 *
 * WHAT IS NOT READ here is the mutes' resolution: a `terminal` value may
 * be a full id or a prefix of one, and which fleet ids it names is a
 * question only the watcher can answer (the roster lives in the mirror).
 * Values pass through verbatim.
 */

import { customText, isRegular, type Located } from "@olai/format"
import { DEFAULT_WATCH, type WatchConfig } from "@olai/kolu-client"
import { TERMINAL_KEY } from "@olai/surface"

/** The basename the convention answers to, case-folded at the caller's end. */
const FILE_BASENAME = "kolu.olai"

/** The two node titles, exact and case-sensitive, `outlineCalled`'s rule. */
const WATCH_TITLE = "watch"
const MUTES_TITLE = "mutes"

/** One duration written as the vault writes it, `<n>s|m|h`, in ms. */
const DURATION = /^(\d+)(s|m|h)$/
const UNIT_MS: Readonly<Record<string, number>> = { s: 1_000, m: 60_000, h: 3_600_000 }

/** The three props `watch` carries, in the order a reader sets them. */
const PROPS = ["held-for", "nag", "heartbeat"] as const

/** What {@link watchConfigIn} returns — the config itself plus the malformed
 *  VALUE LINES, said by the caller so a vault typo is a sentence on the
 *  server's console exactly once per new shape, and not a silent default. */
export interface WatchReading {
  readonly config: WatchConfig
  readonly malformed: ReadonlyArray<string>
}

/**
 * Whether a node lives in a file the convention could be — basename
 * case-folded, like every convention file's check (`@olai/format`'s
 * `inOlaiDir` does that one fold for `_olai/`).
 */
const inKoluFile = (located: Located): boolean => {
  const parts = located.file.split("/")
  const base = parts[parts.length - 1]
  return base !== undefined && base.toLowerCase() === FILE_BASENAME
}

/** Convention rank: shallowest first, ties by path — `@olai/format`'s
 *  argument for why depth is a convention's read. */
const byConvention = (a: Located, b: Located): number => {
  const da = a.file.split("/").length
  const db = b.file.split("/").length
  if (da !== db) return da - db
  return a.file.localeCompare(b.file)
}

/** One node's children, as lines' terminal values, verbatim. */
const mutesOf = (nodes: ReadonlyArray<Located>, parent: string): ReadonlyArray<string> => {
  const values: Array<string> = []
  for (const located of nodes) {
    if (!isRegular(located)) continue
    if (located.node.parent !== parent) continue
    const value = customText(located.node, TERMINAL_KEY)
    if (value === undefined || value.trim() === "") continue
    values.push(value)
  }
  return values
}

/**
 * What the vault says the watcher's knobs and mutes are, read off one
 * revision's nodes.
 *
 * ABSENT means the defaults. `DEFAULT_WATCH` returns as itself, not a copy:
 * there is exactly one "the vault said nothing" answer, so there is exactly
 * one object for it, and the check that catches it is a `===`.
 *
 * TWO FILES are the convention's tie, and it is decided the way every
 * convention decides: the shallowest, then the lowest path, then within a
 * file the FIRST `watch` node. A file with neither node is not a candidate.
 */
export const watchConfigIn = (nodes: ReadonlyArray<Located>): WatchReading => {
  const regulars = nodes.filter(isRegular).filter(inKoluFile).sort(byConvention)
  const watch = regulars.find(({ node }) => node.title === WATCH_TITLE)
  const mutes = regulars.find(({ node }) => node.title === MUTES_TITLE)
  if (watch === undefined && mutes === undefined) {
    return { config: DEFAULT_WATCH, malformed: [] }
  }
  const malformed: Array<string> = []
  /** One prop, defensively: the default stands, and a line names the file,
   *  the node, the value and the grammar it violated. */
  const readDuration = (key: (typeof PROPS)[number], fallback: number): number => {
    if (watch === undefined) return fallback
    const value = customText(watch.node, key)
    if (value === undefined) return fallback
    const match = DURATION.exec(value.trim())
    if (match === null) {
      malformed.push(
        `kolu: \`${key}: ${value}\` in ${watch.file} is not a duration — write <n>s, <n>m or <n>h.`,
      )
      return fallback
    }
    const [, amount, unit] = match
    if (amount === undefined || unit === undefined) return fallback
    return Number(amount) * (UNIT_MS[unit] ?? 1_000)
  }
  return {
    config: {
      heldForMs: readDuration("held-for", DEFAULT_WATCH.heldForMs),
      nagMs: readDuration("nag", DEFAULT_WATCH.nagMs),
      heartbeatMs: readDuration("heartbeat", DEFAULT_WATCH.heartbeatMs),
      muted: mutes === undefined ? [] : mutesOf(nodes, mutes.node.id),
    },
    malformed,
  }
}
