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
import { DEFAULT_WATCH, type WatchConfig } from "olai-plugin-kolu/appliance"

import { Config, configuredWatch, watchProblem, type WatchKey } from "./settings.ts"
import { Schema } from "effect"

/** The basename the convention answers to, case-folded at the caller's end. */
const FILE_BASENAME = "kolu.olai"

/** The one node title, exact and case-sensitive, `outlineCalled`'s rule. */
const WATCH_TITLE = "watch"

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
 * What the vault says the watcher's knobs are, read off one revision's
 * nodes, inside the file the convention named (`koluFileIn`, above — the
 * caller computes it off the SERVED outlines and hands it in, so a file
 * that parses to nothing still feeds the foot its wrench while handing
 * this walk an empty inside).
 *
 * ABSENT uses the supplied fallback, derived from the schema configuration.
 *
 * Within the named file the FIRST `watch` node decides; a second is the
 * owner's mistake, not a precedence question.
 */
export const watchConfigIn = (
  nodes: ReadonlyArray<Located>,
  file: string | null,
  fallback: WatchConfig = DEFAULT_WATCH,
): WatchReading => {
  if (file === null) return { config: fallback, malformed: [] }
  const inside = nodes.filter(isRegular).filter((located) => located.file === file)
  const watch = inside.find(({ node }) => node.title === WATCH_TITLE)
  const malformed: Array<string> = []
  const defaults = Schema.decodeUnknownSync(Config)({}).watch
  const values = { ...defaults }
  const said = new Set<WatchKey>()
  for (const key of Object.keys(defaults) as WatchKey[]) {
    const value = watch === undefined ? undefined : customText(watch.node, key)
    if (value === undefined) continue
    const problem = watchProblem(key, value)
    if (problem !== undefined) {
      malformed.push(`kolu: \`${key}: ${value}\` in ${watch?.file}: ${problem}`)
    } else {
      values[key] = value
      said.add(key)
    }
  }
  if (said.size === 0) return { config: fallback, malformed }
  const read = configuredWatch({ watch: values })
  // Only valid properties override the activation's policy. Missing and bad
  // properties retain it, including when the legacy file has a partial node.
  return {
    config: {
      heldForMs: said.has("held-for") ? read.heldForMs : fallback.heldForMs,
      nagMs: said.has("nag") ? read.nagMs : fallback.nagMs,
      heartbeatMs: said.has("heartbeat") ? read.heartbeatMs : fallback.heartbeatMs,
    },
    malformed,
  }
}
