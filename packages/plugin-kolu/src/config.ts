/**
 * THE VAULT HALF of the attention watcher — what `_olai/Kolu.olai` says.
 *
 * HERE rather than in `@olai/kolu-client` for `./claimants.ts`'s reason,
 * one shelf below: the config file is a reading of the SET and nothing
 * to do with kolu. The package that dials padi gets the derived
 * intervals and the mute VALUES, four words and a number twice, and
 * never learns that an outline record exists.
 *
 * ...and here rather than in `@olai/server`, where it was, under the
 * name `koluConfig.ts`. The name is the whole argument for the move: a
 * general package had a file with an appliance in its filename, which is
 * exactly the residue the plugin wall absorbs. Inside this package the
 * prefix says the word twice and the thing once — the same sentence the
 * `link` cell's rename is written under, one floor down — so the module
 * is `config.ts` and the package is what says whose config it is.
 *
 * This is `@olai`'s own judgement ABOUT kolu, and the structure is
 * borrowed outright: one file by convention (`kolu.olai`, which is what
 * `_olai/Kolu.olai` reads as), two titled nodes under it, and
 * everything else left alone. FINDING the file is a question about the
 * served outline paths rather than the nodes — `koluFileIn` below, so
 * a config that parses to nothing still has the wrench that opens it
 * — and the reading then walks the nodes that file contributes.
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
 * One file decides THE WHOLE reading: a `watch` in one file and a
 * `mutes` in another would be two minds the way two `watch` nodes
 * would, so the walk reads inside the one file it is handed and no
 * other — and the SECOND of any of them is the owner's mistake, not a
 * precedence question.
 *
 * The VALUES also answer padi's grammar, besides the vault's: `held-for`
 * accepts `0` the way padi's own `heldForMs` does — the instant report —
 * and `nag` and `heartbeat` do not, because a nag every 0 ms is the spin
 * padi itself refuses. Every duration is capped at `MAX_TIMER_MS`: past
 * that, the timer wrap fires near-instantly forever and it is the
 * malformed half rather than a knob.
 *
 * WHAT IS NOT READ here is the mutes' resolution: a `terminal` value may
 * be a full id or a prefix of one, and which fleet ids it names is a
 * question only the watcher can answer (the roster lives in the mirror).
 * Values pass through verbatim.
 *
 * WHAT IS READ BESIDE THE VALUES, since the events drawer grew a foot
 * (2026-08-29): the mutes' TITLES, beside the file the caller named.
 * The watcher gates on ids and prefixes, which tell a reader nothing; the
 * drawer's last line names WHO is silenced, and the wrench beside the
 * line opens the file itself — which is also why the deciding file is
 * part of the answer: a second spelling of the convention where the
 * footer lives is a second answer about one directory. ONE WALK FEEDS
 * BOTH MOUTHS: the values and the names come off the same children of
 * the same `mutes` node, so the timers and the line can never disagree
 * about what is muted.
 */

import { byOrd, customText, isRegular, type Located } from "@olai/format"
import { DEFAULT_WATCH, type WatchConfig } from "@olai/kolu-client"
// THE OWNED FILE'S OWN WORD, not the vault's typed vocabulary: a mute names a
// terminal by writing it under this key inside `_olai/Kolu.olai`, which is a
// convention this plugin owns end to end and a directory nobody declares types
// for. The declared KIND licences the DOOR on ordinary records
// ({@link ./claimants.ts}); it has no business inside this file.
import { TERMINAL_KEY } from "@olai/kolu-client/wire"

/** The basename the convention answers to, case-folded at the caller's end. */
const FILE_BASENAME = "kolu.olai"

/** The two node titles, exact and case-sensitive, `outlineCalled`'s rule. */
const WATCH_TITLE = "watch"
const MUTES_TITLE = "mutes"

/** One duration written as the vault writes it, `<n>s|m|h`, in ms. */
const DURATION = /^(\d+)(s|m|h)$/
const UNIT_MS: Readonly<Record<string, number>> = { s: 1_000, m: 60_000, h: 3_600_000 }

/** The timer ceiling padi's own schema documents: past it a `setTimeout`
 *  wraps to a near-instant fire-forever. Spelled locally: the `@kolu`
 *  product tier is confined by the repo's fence to the two kolu packages.
 */
const MAX_TIMER_MS = 2_147_483_647

/** Each prop's floor, in padi's own reading: `held-for` is a debounce and
 *  `0` is its legal "say it the instant it holds"; `nag` and `heartbeat`
 *  are INTERVALS, whose zero cannot be spelled into a loop the timers are
 *  then asked to hold. */
const FLOORS: Readonly<Record<WatchProp, number>> = {
  "held-for": 0,
  nag: 1,
  heartbeat: 1,
}

/** The three props `watch` carries, in the order a reader sets them. */
type WatchProp = "held-for" | "nag" | "heartbeat"

/** What {@link watchConfigIn} returns — the config itself plus the malformed
 *  VALUE LINES, said by the caller so a vault typo is a sentence on the
 *  server's console exactly once per new shape, and not a silent default. */
export interface WatchReading {
  readonly config: WatchConfig
  readonly malformed: ReadonlyArray<string>
  /** THE DRAWER'S FOOT, as the wire carries it (`@olai/kolu-client`'s
   *  `KoluMutes`): the file the convention decided, and the mutes' own
   *  titles in the outline's order. `file: null` and no names is the
   *  defaults' reading — nothing decided anything, and the drawer draws
   *  no foot. */
  readonly mutes: MutesReading
}

/** One mute, as the vault wrote it — value verbatim (full id or
 *  prefix; WHICH fleet ids it names is the watcher's verdict, not
 *  this module's) and the title beside it. The drawer's filtering of
 *  them, per resolved verdict, is the cell's;
 *  `mutedVerdicts` in `@olai/kolu-client`'s watch is the fact it
 *  filters by. */
export interface MuteEntry {
  readonly value: string
  readonly title: string
}

/** The display half of one mute walk — derived into the wire's
 *  `KoluMutes` by the cell, re-said here so this module's answer is
 *  named for what it READS rather than for the cell it lands in. */
export interface MutesReading {
  /** The file the vault carries as the convention under its name, or
   *  `null` when no served file is named it — the foot's absence. A file
   *  that exists but parses to nothing still names itself (the wrench is
   *  how a broken config is opened to be fixed); it is the CALLER who
   *  answers that (`koluFileIn`, below), this reading only walks the
   *  nodes that survived the codec. */
  readonly file: string | null
  /** The `mutes` node children's own entries — only children carrying
   *  a `terminal` value, the same set the watcher gates on, in outline
   *  order (`byOrd`). An untitled child falls back to the value it
   *  mutes: a blank name on the foot says less than the prefix does. */
  readonly entries: ReadonlyArray<MuteEntry>
}

/**
 * THE WRENCH'S ANSWER — which served outline is `_olai/Kolu.olai`, asked
 * of the outline PATHS, not the nodes: a config that exists but parses
 * to nothing contributes no records, and the foot's only door onto it
 * (the wrench) would fall away with the nodes if both answered the same
 * question. The rider stays on the saddle-less parts of the horse
 * because the horse says where it GOES; to say where it IS, ask the
 * rider — served paths are `@olai/format`'s answer to the latter
 * (`conventionServed` is the connector's).
 *
 * Case-folded by basename, like every convention file's check
 * (`inOlaiDir` does the one fold for `_olai/`). Rank is the convention's
 * own: shallowest first, ties by path.
 */
export const koluFileIn = (paths: Iterable<string>): string | undefined => {
  return [...paths]
    .filter((path) => path.split("/").pop()?.toLowerCase() === FILE_BASENAME)
    .sort(
      (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b),
    )[0]
}

/** One `mutes` node's children, as ENTRIES: the terminal value verbatim,
 *  and the title the drawer's foot reads beside it — one walk, the two
 *  mouths fed from the same list, so the watcher's gate and the reader's
 *  line can never be two answers to "who is muted". */
const mutesOf = (
  nodes: ReadonlyArray<Located>,
  parent: string,
): ReadonlyArray<MuteEntry> => {
  const entries: Array<MuteEntry> = []
  const held = nodes
    .filter(isRegular)
    .filter((located) => located.node.parent === parent)
  // Outline order (`byOrd`, the derivation's own sibling order) and not
  // the flat list's: where a mute sits in the file is where it sits on
  // the line.
  held.sort(byOrd)
  for (const located of held) {
    const value = customText(located.node, TERMINAL_KEY)
    if (value === undefined || value.trim() === "") continue
    entries.push({
      value,
      // An untitled mute is named by what it mutes — the one name it
      // certainly has, and better on the foot than a gap.
      title: located.node.title.trim() === "" ? value : located.node.title,
    })
  }
  return entries
}

/**
 * What the vault says the watcher's knobs and mutes are, read off one
 * revision's nodes, inside the file the convention named
 * (`koluFileIn`, above — the caller computes it off the SERVED outlines
 * and hands it in, so a file that parses to nothing still feeds the
 * foot its wrench while handing this walk an empty inside).
 *
 * ABSENT means the defaults. `DEFAULT_WATCH` returns as itself, not a copy:
 * there is exactly one "the vault said nothing" answer, so there is exactly
 * one object for it, and the check that catches it is a `===`.
 *
 * Within the named file the FIRST `watch` node and the FIRST `mutes`
 * node decide; a second of either is the owner's mistake, not a
 * precedence question.
 */
export const watchConfigIn = (
  nodes: ReadonlyArray<Located>,
  file: string | null,
): WatchReading => {
  if (file === null) {
    return { config: DEFAULT_WATCH, malformed: [], mutes: { file, entries: [] } }
  }
  const inside = nodes.filter(isRegular).filter((located) => located.file === file)
  const watch = inside.find(({ node }) => node.title === WATCH_TITLE)
  const mutes = inside.find(({ node }) => node.title === MUTES_TITLE)
  const entries = mutes === undefined ? [] : mutesOf(nodes, mutes.node.id)
  const malformed: Array<string> = []
  /** One prop, defensively: the default stands, and a line names the file,
   *  the node, the value and the grammar it violated. The vault is left
   *  with its word — a repair is the editor's, not this reader's. */
  const readDuration = (key: WatchProp, fallback: number): number => {
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
    const ms = Number(amount) * (UNIT_MS[unit] ?? 1_000)
    if (ms < FLOORS[key]) {
      malformed.push(
        `kolu: \`${key}: ${value}\` in ${watch.file} is not an interval its timer allows — padi refuses a ${key} of 0 as the spin it is.`,
      )
      return fallback
    }
    if (ms > MAX_TIMER_MS) {
      malformed.push(
        `kolu: \`${key}: ${value}\` in ${watch.file} is past the ~24.8-day timer ceiling — it over-writes a setTimeout into a steady fire.`,
      )
      return fallback
    }
    return ms
  }
  return {
    config: {
      heldForMs: readDuration("held-for", DEFAULT_WATCH.heldForMs),
      nagMs: readDuration("nag", DEFAULT_WATCH.nagMs),
      heartbeatMs: readDuration("heartbeat", DEFAULT_WATCH.heartbeatMs),
      muted: entries.map((entry) => entry.value),
    },
    malformed,
    mutes: { file, entries },
  }
}
