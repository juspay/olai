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
 *     What tells them apart is the thing the fault is about: a chat at the
 *     plugin's own address, and no server half on disk yet.
 *
 * **A roster cannot see an agent's keystrokes**, and this does not pretend to.
 * What it CAN see is the agent saying it is done: `vault-plugins_run` at the
 * version on disk, which the authoring guide already requires as the last act
 * of a build (`@olai/surface`'s `source.checked`). *Being built* ends there
 * and not at a file landing — the guide has the builder write the README,
 * then `server.ts`, then `browser.tsx`, so a page that called the folder
 * finished when its server half arrived rang *Ready for you* at a plugin whose
 * face was still being written, and a person who pressed **Turn on** was
 * paused by the very next write.
 *
 * THE READER CAN GO PAST IT ANYWAY, which is the other half of the same
 * honesty: the signal is written down on the plugin's settings node, so a
 * reboot does not lose it, but an agent that gave up mid-build never sends one
 * at all. {@link stageOf} takes that decision as an argument — the page's
 * *I'll read it now* — rather than guessing at a timeout.
 *
 * ...AND IT ONLY APPLIES BEFORE THE FIRST APPROVAL. Once somebody has said yes
 * to a version, an agent editing the folder again is not a build in progress:
 * it is the plugin they approved, changed, which is *Paused* with a diff.
 */

import { type BuiltPlugin, codeFilesOf, pluginState } from "@olai/surface"

/**
 * THE SIX WORDS A PLUGIN'S PAGE CAN BE HEADED WITH — the mockup's six screens,
 * and the whole of what the page's primary verb is chosen from.
 */
export type Stage = "building" | "review" | "paused" | "on" | "off" | "broken"

/** A roster row this row's page is about: one with a `source`, which is the
 *  presence that distinguishes a plugin somebody's DIRECTORY defines from one
 *  the build shipped (`@olai/surface`'s `BuiltPlugin.source`). The word is the
 *  server half's own for the same reading (`../source.ts`'s `Defined`). */
export type Defined = BuiltPlugin & { readonly source: NonNullable<BuiltPlugin["source"]> }

/** One code file of the folder as the page draws it ({@link codeFiles}). */
export type CodeFile = NonNullable<Defined["source"]["code"]>[number]

/**
 * EVERY CODE FILE THE ROW CARRIES, in the page's order (`@olai/surface`'s
 * `codeFilesOf`). A file removed since the approval is still here, with its
 * approved text and no `text`, so the diff can show it go.
 */
export const codeFiles = (source: Defined["source"]): ReadonlyArray<CodeFile> => codeFilesOf(source)

/** Whether this row was written into the directory rather than compiled in. */
export const defined = (plugin: BuiltPlugin): plugin is Defined => plugin.source !== undefined

/** Every plugin this directory defines, in the order the roster lists them —
 *  which is folder order, so the sidebar and the page agree with the panel and
 *  with `ls`. */
export const definedPlugins = (roster: { readonly built: ReadonlyArray<BuiltPlugin> } | undefined): ReadonlyArray<Defined> =>
  roster === undefined ? [] : roster.built.filter(defined)

/** The one whose page is open, or nothing — a word nobody has a folder for is
 *  a page too, and it is the page that says so. */
export const pluginNamed = (
  roster: { readonly built: ReadonlyArray<BuiltPlugin> } | undefined,
  word: string,
): Defined | undefined => definedPlugins(roster).find((plugin) => plugin.name === word)

/**
 * WHICH OF THE SIX. The order of the tests is the order of the questions:
 * whether the folder is whole comes before whether it is approved, because an
 * unfinished folder is not something to decide about.
 */
export const stageOf = (plugin: Defined, read = false): Stage => {
  const source = plugin.source
  const state = pluginState(plugin)
  // THE SERVE'S ANSWER, and this tab's decision to go past it. Whether an
  // agent is still writing the folder is the authoring protocol's question —
  // which call means *done*, in what order a build writes files — and the
  // serve ships both halves of that contract (`source.building`). *I'll read
  // it now* is the only part of this that is the reader's.
  const waiting = !read && source.building === true
  if (state === "failed") return waiting ? "building" : "broken"
  // PAUSED IS AN APPROVAL THAT MOVED, and the switch cannot tell that from a
  // plugin nobody has read: a folder copied in with `on: yes` and no approval
  // read as *changed since you turned it on*, and an approved plugin somebody
  // switched off and then edited read as *nobody has read it yet*. `decided`
  // is the fact both of those sentences are actually about.
  if (state === "pending") return waiting ? "building" : source.decided === true ? "paused" : "review"
  if (state === "running") return "on"
  // `waiting` is a plugin that started and is short of a service it named. It
  // is drawn with the faults because that is what it is from here — nothing of
  // this plugin is running — and the sentence names what it is waiting for.
  if (state === "waiting") return "broken"
  return "off"
}

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
export const metaOf = (plugin: Defined, stage: Stage): string => {
  const source = plugin.source
  if (stage === "review") return `${halves(source)} · nobody has read it yet`
  if (stage === "paused") return "changed since you turned it on"
  if (stage === "building") return "the files are still landing"
  if (stage === "off") return source.approved || source.decided === true ? "approved, switched off" : "switched off"
  return ""
}

/** The size of what somebody is being asked to read: every code file, which
 *  are the files an approval is about. */
const halves = (source: Defined["source"]): string => {
  const texts = codeFiles(source).flatMap((one) => (one.text === undefined ? [] : [one.text]))
  const lines = texts.reduce((sum, text) => sum + count(text), 0)
  return `${texts.length} ${texts.length === 1 ? "file" : "files"}, ${lines} ${lines === 1 ? "line" : "lines"}`
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
export const faultSaid = (plugin: Defined): string | undefined => {
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
 * THE STATES THAT ARE WORTH WAKING SOMEBODY FOR — the three the alert claims,
 * and nothing else.
 *
 * A plugin going ON is not news: the person pressed the button. A plugin being
 * BUILT is not news either, they asked for it a minute ago and the conversation
 * is open beside them. What is news is every moment where the thing is waiting
 * on a person who has walked away: it is ready to be read, it STOPPED because
 * its code changed, or it could not start.
 *
 * *Paused* is on this list because it is the one a person most needs told: a
 * plugin that was working is not working now, and nothing on screen says so
 * unless they happen to be looking at the sidebar.
 */
export const wakes = (stage: Stage): stage is "review" | "paused" | "broken" =>
  stage === "review" || stage === "paused" || stage === "broken"
