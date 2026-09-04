/**
 * THE VAULT HALF of the attention watcher — what `_olai/Kolu.olai` says.
 *
 * HERE rather than in `@olai/kolu-client` for `./claimants.ts`'s reason,
 * one shelf below: the config file is a reading of the SET and nothing
 * to do with kolu. The package that dials padi gets the derived
 * intervals — the held-for and the heartbeat as numbers, the nag as one
 * `{ ms, count? }` pair — and never learns that an outline record
 * exists.
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
 * `_olai/Kolu.olai` reads as), one titled node under it, and everything
 * else left alone. FINDING the file is a question about the served
 * outline paths rather than the nodes — `koluFileIn` below, so a config
 * that parses to nothing still has the wrench that opens it — and the
 * reading then walks the nodes that file contributes.
 *
 *   # Kolu
 *
 *   - watch                            ← the knobs, properties:
 *     - held-for: "60s"                ← debounce before a held state fires
 *     - nag: "30m/3"                   ← re-fire while a fired state holds,
 *                                        three reminders, then quiet
 *     - heartbeat: "30m"               ← the window a silent watch is judged by
 *
 * IT USED TO READ A SECOND NODE, `mutes`, whose children named terminals
 * the watcher was to keep quiet about — values verbatim for the timers'
 * gate, titles beside them for the events drawer's foot. Both went with
 * the second doorbell (2026-08-31), and the argument is that there is one
 * silence control now and it is not in this file: a conversation is
 * scoped to a FILTER FILE, and a terminal no un-done node of that file
 * claims wakes nobody. Two mechanisms aimed at one fleet, one of them
 * global and one of them per-conversation, is one mechanism too many —
 * and the global one was the weaker, because it could only ever say
 * "never" where the filter says "not for this seat".
 *
 * The knobs are DURATIONS, read with KOLU'S OWN PARSERS
 * (`@kolu/padi-client`'s `parseDuration`, and `parseNag` for the one knob
 * that is an interval AND its cap — `nag: 30m/3`) so a `kolu watch` hand
 * and a vault writer read one grammar, taught in one spelling. A value
 * that is not one is a malformed value: the default stands and the line
 * it earns is returned, for the caller to SAY (`koluHalf`'s `revision`,
 * which is where the "log line" the brief promises lives). The vault
 * text is authoritative-as-written rather than repaired: olai does not
 * edit the person's file.
 *
 * One file decides THE WHOLE reading: a `watch` in one file and a
 * `watch` in another would be two minds, so the walk reads inside the
 * one file it is handed and no other — and the SECOND of them is the
 * owner's mistake, not a precedence question.
 *
 * The VALUES also answer padi's grammar, besides the vault's: `held-for`
 * accepts `0` the way padi's own `heldForMs` does — the instant report,
 * which the doorbell e2e's gesture depends on — and `nag` and `heartbeat`
 * do not, because an interval of 0 ms is the spin padi itself refuses.
 * Every duration is capped at the timer ceiling kolu's parser itself
 * enforces.
 *
 * WHAT THIS WALK DOES NOT ANSWER is which file it read. That is the
 * CALLER's question (`koluFileIn`, below, over the SERVED outline paths)
 * and the caller keeps its own answer: the drawer's wrench must draw over
 * a config the codec tore apart, and a file that contributes no records
 * cannot name itself out of them.
 */

import { customText, isRegular, type Located } from "@olai/format"
import { Schema } from "effect"
import { DEFAULT_WATCH, parseDuration, parseNag, type WatchConfig } from "olai-plugin-kolu/appliance"

/** The basename the convention answers to, case-folded at the caller's end. */
const FILE_BASENAME = "kolu.olai"

/** The one node title, exact and case-sensitive, `outlineCalled`'s rule. */
const WATCH_TITLE = "watch"

/** Schema defaults, as the panel draws them. */
export const DEFAULT_FIELDS = {
  "held-for": "60s",
  nag: "10m",
  heartbeat: "30m",
} as const

/** Kolu's settings section — duration strings in padi's grammar. */
export const WatchSettings = Schema.Struct({
  "held-for": Schema.optionalKey(Schema.String),
  nag: Schema.optionalKey(Schema.String),
  heartbeat: Schema.optionalKey(Schema.String),
})
export type WatchSettings = typeof WatchSettings.Type

/** What {@link watchConfigIn} returns — the config itself plus the malformed
 *  VALUE LINES, said by the caller so a vault typo is a sentence on the
 *  server's console exactly once per new shape, and not a silent default. */
export interface WatchReading {
  readonly config: WatchConfig
  readonly malformed: ReadonlyArray<string>
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

/**
 * THE KNOBS, from a settings overlay rather than a `watch` node. Absent
 * fields are the defaults. A malformed value keeps the default and earns
 * a sentence, the way a hand-edited `_olai/Kolu.olai` did.
 */
export const watchFromFields = (
  fields: Readonly<Record<string, unknown>>,
  where = "_olai/Settings.olai",
): WatchReading => {
  const malformed: Array<string> = []
  const text = (key: string): string | undefined => {
    const value = fields[key]
    return typeof value === "string" ? value : undefined
  }
  /** THE VAULT'S OWN SHAPE GATE, before either parser: the grammar WITHOUT
   *  the bare-number arm — everything else with a bad shape is kolu's own
   *  sentence to spell. Its parsers take `10000` for 10000ms because the
   *  `kolu` binary's other four flags already mean ms — an argv-consistency
   *  argument. A hand-edited file reads the other way: a truncated `nag: 10`
   *  defaults into a 10-ms re-fire spin, which is the one mistake a property
   *  file must say rather than do. */
  const bareDigits = /^\d+$/
  const spellUnit = (key: "held-for" | "nag" | "heartbeat", value: string): void => {
    malformed.push(`kolu: \`${key}: ${value}\` in ${where}: spell a number and a unit (500ms, 30s, 10m, 2h, 1d)`)
  }
  /** KOLU'S OWN PARSERS, wrapped in the vault's own address. A value that is
   *  not the grammar names the file, the node and the sentence kolu itself
   *  composes (`parseDuration`/`parseNag`), so a `kolu watch` user and a
   *  vault writer are taught one rule in one spelling. The default stands;
   *  the vault is left with its word, and the sentence is the only penalty. */
  const readDuration = (
    key: "held-for" | "heartbeat",
    min: { readonly ms: number; readonly why: string },
    effect: string,
    fallback: number,
  ): number => {
    const value = text(key)
    if (value === undefined) return fallback
    // The GATE AND THE PARSE read one trimmed value: kolu's parser trims
    // before judging, so a `10 ` trailing the paper slips every check
    // that reads the property raw — both eyes agree; only the sentence
    // keeps the file's own spelling, with the whitespace that made it.
    const raw = value.trim()
    if (bareDigits.test(raw)) {
      spellUnit(key, value)
      return fallback
    }
    const read = parseDuration(key, raw, min, effect)
    if (read.kind === "error") {
      malformed.push(`kolu: \`${key}: ${value}\` in ${where}: ${read.message}`)
      return fallback
    }
    return read.value
  }
  /** The nag, one knock further: `parseNag` splits the interval from its
   *  CAP (`30m/3` — three reminders past the first report, then quiet), so
   *  the two can neither be spelled apart nor drift. */
  const readNag = (): WatchConfig["nagMs"] => {
    const value = text("nag")
    if (value === undefined) return DEFAULT_WATCH.nagMs
    const raw = value.trim()
    if (bareDigits.test(raw)) {
      spellUnit("nag", value)
      return DEFAULT_WATCH.nagMs
    }
    const read = parseNag("nag", raw)
    if (read.kind === "error") {
      malformed.push(`kolu: \`nag: ${value}\` in ${where}: ${read.message}`)
      return DEFAULT_WATCH.nagMs
    }
    return read.value
  }
  return {
    config: {
      heldForMs: readDuration(
        "held-for",
        { ms: 0, why: "unused — a hold of zero is padi's own legal instant report" },
        "its debounce fires",
        DEFAULT_WATCH.heldForMs,
      ),
      nagMs: readNag(),
      heartbeatMs: readDuration(
        "heartbeat",
        {
          ms: 1,
          why: "a heartbeat of zero paces nothing — the knob is the window a silent watch is judged against, not an interval padi is poked at.",
        },
        "the stamp ages out",
        DEFAULT_WATCH.heartbeatMs,
      ),
    },
    malformed,
  }
}

/**
 * The old walk, kept for the parser's own bench: a `watch` node in
 * `_olai/Kolu.olai` is no longer what the serve reads.
 */
export const watchConfigIn = (
  nodes: ReadonlyArray<Located>,
  file: string | null,
): WatchReading => {
  if (file === null) return watchFromFields({})
  const inside = nodes.filter(isRegular).filter((located) => located.file === file)
  const watch = inside.find(({ node }) => node.title === WATCH_TITLE)
  if (watch === undefined) return watchFromFields({}, file)
  const fields: Record<string, string> = {}
  for (const key of ["held-for", "nag", "heartbeat"] as const) {
    const value = customText(watch.node, key)
    if (value !== undefined) fields[key] = value
  }
  return watchFromFields(fields, file)
}
