/**
 * WHAT STATE A PLUGIN THE VAULT DEFINES IS IN, as a person reads it — one
 * reading, in one place, because three faces ask it and they may not disagree.
 *
 * The sidebar's mark, the page's status line and the alert that wakes somebody
 * are three drawings of ONE fact. Written per face they drift the way every
 * duplicated reading drifts: the row says `Review`, the page says *On*, and the
 * person who pressed the row is the one who finds out. So the question is asked
 * here, of the roster row and of nothing else, and each face draws the answer.
 *
 * ## It is a NARROWING of core's seven words, not a second vocabulary
 *
 * `@olai/surface`'s {@link pluginState} already answers which of the seven a
 * row is in, and `./runtime.ts` on the other side of the wire is what decides
 * them. What this adds is the two distinctions core cannot make, because both
 * of them are facts about a FOLDER rather than about a fiber:
 *
 *   - **`pending` is two mornings.** A plugin nobody has ever approved is
 *     waiting to be READ for the first time — *Ready for you*. A plugin whose
 *     approved code was then edited is PAUSED: the person's switch is still up
 *     (`source.on`), what is running stopped, and what the page owes them is a
 *     diff rather than the whole file again. One word on the wire, two
 *     sentences, and the switch is what tells them apart.
 *   - **`failed` is two mornings too.** A folder whose `server.ts` is not
 *     written yet fails the shape check, and so does a plugin whose `apply`
 *     died. The first is not a fault, it is an agent halfway through writing
 *     the folder — which is exactly the screen the mockup calls *Being built*.
 *     What tells them apart is the thing the fault is about: a bound builder
 *     conversation, and no server half on disk yet.
 *
 * **A roster cannot see an agent's keystrokes**, and this does not pretend to.
 * What it can see is which of the three files have landed, so *Being built*
 * ends when `server.ts` does. A folder whose halves are both written is
 * `pending` and is drawn as *Ready for you* even if the conversation is still
 * talking — which is the honest reading: the thing on disk is complete and a
 * person may decide about it.
 */

import { type BuiltPlugin, pluginState } from "@olai/surface"

/**
 * THE SIX WORDS A PLUGIN'S PAGE CAN BE HEADED WITH — the mockup's six screens,
 * and the whole of what the page's primary verb is chosen from.
 */
export type Stage = "building" | "review" | "paused" | "on" | "off" | "broken"

/** A roster row this row's page is about: one with a `source`, which is the
 *  presence that distinguishes a plugin the VAULT defines from one the build
 *  shipped (`@olai/surface`'s `BuiltPlugin.source`). */
export type VaultPlugin = BuiltPlugin & { readonly source: NonNullable<BuiltPlugin["source"]> }

/** Whether this row came out of the vault rather than out of the build. */
export const defined = (plugin: BuiltPlugin): plugin is VaultPlugin => plugin.source !== undefined

/** Every plugin THIS VAULT defines, in the order the roster lists them — which
 *  is folder order, so the sidebar and the page agree with the panel and with
 *  `ls`. */
export const vaultPlugins = (roster: { readonly built: ReadonlyArray<BuiltPlugin> } | undefined): ReadonlyArray<VaultPlugin> =>
  roster === undefined ? [] : roster.built.filter(defined)

/** The one whose page is open, or nothing — a word nobody has a folder for is
 *  a page too, and it is the page that says so. */
export const pluginNamed = (
  roster: { readonly built: ReadonlyArray<BuiltPlugin> } | undefined,
  word: string,
): VaultPlugin | undefined => vaultPlugins(roster).find((plugin) => plugin.name === word)

/**
 * WHICH OF THE SIX. The order of the tests is the order of the questions:
 * whether the folder is whole comes before whether it is approved, because an
 * unfinished folder is not something to decide about.
 */
export const stageOf = (plugin: VaultPlugin): Stage => {
  const source = plugin.source
  const state = pluginState(plugin)
  if (state === "failed") return building(plugin) ? "building" : "broken"
  if (state === "pending") return building(plugin) ? "building" : source.on ? "paused" : "review"
  if (state === "running") return "on"
  // `waiting` is a plugin that started and is short of a service it named. It
  // is drawn with the faults because that is what it is from here — nothing of
  // this plugin is running — and the sentence names what it is waiting for.
  if (state === "waiting") return "broken"
  return "off"
}

/** A folder an agent is still writing: a conversation is bound to it and the
 *  required half has not landed. `server.ts` is the whole test, because it is
 *  the one file a plugin cannot be without (`../source.ts`'s `faultOf`). */
const building = (plugin: VaultPlugin): boolean =>
  plugin.source.builder !== undefined && plugin.source.server.trim() === ""

/** How each stage looks and reads: the dot's paint, the word beside it, and
 *  whether the word is an alarm. One table, so the sidebar's mark and the
 *  page's heading cannot say different things about one row. */
export const LOOK: { readonly [K in Stage]: { readonly dot: string; readonly word: string; readonly tone?: string } } = {
  building: { dot: "olai-tone-dot bg-done outline-2 outline-done/35 animate-pulse", word: "Being built", tone: "text-doing" },
  review: { dot: "olai-tone-dot bg-doing", word: "Ready for you", tone: "text-doing" },
  paused: { dot: "olai-tone-dot bg-doing", word: "Paused", tone: "text-doing" },
  on: { dot: "olai-tone-dot bg-done", word: "On" },
  off: { dot: "olai-tone-dot-quiet bg-line", word: "Off", tone: "text-muted" },
  broken: { dot: "olai-tone-dot bg-alarm", word: "Couldn't start", tone: "text-alarm" },
}

/**
 * THE SECOND HALF OF THE STATUS LINE — what is true about this plugin beyond
 * the word, or nothing at all.
 *
 * Nothing is drawn where there is nothing to say, rather than a padded phrase:
 * the line is read at a glance and a clause that is always there is a clause
 * nobody reads.
 */
export const metaOf = (plugin: VaultPlugin, stage: Stage): string => {
  const source = plugin.source
  if (stage === "review") return `${halves(source)} · nobody has read it yet`
  if (stage === "paused") return "changed since you turned it on"
  if (stage === "building") return "the files are still landing"
  if (stage === "off") return source.approved ? "approved, switched off" : "switched off"
  return ""
}

/** The size of what somebody is being asked to read: the two halves, which are
 *  the only files an approval is about. */
const halves = (source: VaultPlugin["source"]): string => {
  const files = source.browser === undefined ? 1 : 2
  const lines = count(source.server) + (source.browser === undefined ? 0 : count(source.browser))
  return `${files} ${files === 1 ? "file" : "files"}, ${lines} ${lines === 1 ? "line" : "lines"}`
}

const count = (text: string): number => (text.trim() === "" ? 0 : text.replace(/\n$/, "").split("\n").length)

/**
 * WHY A PLUGIN IS NOT RUNNING, in whole sentences — the plugin's own words
 * where it has any, and core's where the folder itself is the problem.
 *
 * `fault` is already a sentence somebody wrote (`./runtime.ts` carries it
 * verbatim); `missing` is a list of service keys, which is this tree's
 * vocabulary rather than anybody's prose, so it is the one this composes a
 * sentence around.
 */
export const faultSaid = (plugin: VaultPlugin): string | undefined => {
  if (plugin.fault !== undefined) return plugin.fault
  const missing = plugin.missing
  if (missing === undefined || missing.length === 0) return undefined
  return `It is waiting for ${missing.join(", ")}, which nothing on this serve provides.`
}

/**
 * THE STANDING SENTENCE, and it is a CONSTANT because it must never be
 * composed, shortened or made conditional.
 *
 * There is no sandbox. A plugin the vault defines is compiled and mounted in
 * this serve's own process, with everything olai can reach, and approving one
 * is the whole of the boundary. The page says that beside every verb that
 * starts one, in the same words every time, because a warning that varies is a
 * warning a reader learns to skim.
 */
export const TRUST_SAID = "A plugin runs on this computer with everything olai can reach. There is no sandbox; turning one on is trusting the code."

/** What the sidebar's row wears to the right of the title, or nothing. The
 *  three words are the three states somebody has to DO something about; a row
 *  that is simply on or simply off says it with its ink. */
export type Mark = "working" | "review" | "problem" | "none" | "quiet"

export const markOf = (stage: Stage): Mark =>
  stage === "building" ? "working"
    : stage === "review" || stage === "paused" ? "review"
      : stage === "broken" ? "problem"
        : stage === "off" ? "quiet"
          : "none"

/** The words on the two marks that are words. */
export const MARK_WORD: { readonly review: string; readonly problem: string } = {
  review: "Review",
  problem: "Problem",
}

/**
 * THE STATES THAT ARE WORTH WAKING SOMEBODY FOR — the two the alert claims,
 * and nothing else.
 *
 * A plugin going ON is not news: the person pressed the button. A plugin being
 * BUILT is not news either, they asked for it a minute ago and the conversation
 * is open beside them. What is news is the two moments where the thing is
 * waiting on a person who has walked away: it is ready to be read, or it could
 * not start.
 */
export const wakes = (stage: Stage): stage is "review" | "broken" => stage === "review" || stage === "broken"
