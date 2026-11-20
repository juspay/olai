import { type BuiltPlugin, pluginState } from "@olai/surface"

export type Stage = "building" | "review" | "paused" | "on" | "off" | "broken"

export type Defined = BuiltPlugin & { readonly source: NonNullable<BuiltPlugin["source"]> }

export const defined = (plugin: BuiltPlugin): plugin is Defined => plugin.source !== undefined

export const definedPlugins = (roster: { readonly built: ReadonlyArray<BuiltPlugin> } | undefined): ReadonlyArray<Defined> =>
  roster === undefined ? [] : roster.built.filter(defined)

export const pluginNamed = (
  roster: { readonly built: ReadonlyArray<BuiltPlugin> } | undefined,
  word: string,
): Defined | undefined => definedPlugins(roster).find((plugin) => plugin.name === word)

export const stageOf = (plugin: Defined, read = false): Stage => {
  const source = plugin.source
  const state = pluginState(plugin)
  const waiting = !read && source.building === true
  if (state === "failed") return waiting ? "building" : "broken"
  if (state === "pending") return waiting ? "building" : source.decided === true ? "paused" : "review"
  if (state === "running") return "on"
  if (state === "waiting") return "broken"
  return "off"
}

export const LOOK: { readonly [K in Stage]: { readonly dot: string; readonly word: string; readonly tone?: string } } = {
  building: { dot: "olai-tone-dot bg-done outline-2 outline-done/35 animate-pulse", word: "Being built", tone: "text-doing" },
  review: { dot: "olai-tone-dot bg-doing", word: "Ready for you", tone: "text-doing" },
  paused: { dot: "olai-tone-dot bg-doing", word: "Paused", tone: "text-doing" },
  on: { dot: "olai-tone-dot bg-done", word: "On" },
  off: { dot: "olai-tone-dot-quiet bg-line", word: "Off", tone: "text-muted" },
  broken: { dot: "olai-tone-dot bg-alarm", word: "Couldn't start", tone: "text-alarm" },
}

export const metaOf = (plugin: Defined, stage: Stage): string => {
  const source = plugin.source
  if (stage === "review") return `${halves(source)} · nobody has read it yet`
  if (stage === "paused") return "changed since you turned it on"
  if (stage === "building") return "the files are still landing"
  if (stage === "off") return source.approved || source.decided === true ? "approved, switched off" : "switched off"
  return ""
}

const halves = (source: Defined["source"]): string => {
  const written = source.browser === undefined ? 1 : 2
  const lines = count(source.server) + (source.browser === undefined ? 0 : count(source.browser))
  return `${written} ${written === 1 ? "file" : "files"}, ${lines} ${lines === 1 ? "line" : "lines"}`
}

const count = (text: string): number => (text.trim() === "" ? 0 : text.replace(/\n$/, "").split("\n").length)

export const faultSaid = (plugin: Defined): string | undefined => {
  if (plugin.fault !== undefined) return plugin.fault
  const missing = plugin.missing
  if (missing === undefined || missing.length === 0) return undefined
  return `It is waiting for ${missing.join(", ")}, which nothing on this serve provides.`
}

/** It is a CONSTANT because it must never be composed, shortened or made conditional. */
export const TRUST_SAID = "A plugin runs on this computer with everything olai can reach. There is no sandbox; turning one on is trusting the code."

export type Mark = "working" | "review" | "problem" | "none" | "quiet"

export const markOf = (stage: Stage): Mark =>
  stage === "building" ? "working"
    : stage === "review" || stage === "paused" ? "review"
      : stage === "broken" ? "problem"
        : stage === "off" ? "quiet"
          : "none"

export const MARK_WORD: { readonly review: string; readonly problem: string } = {
  review: "Review",
  problem: "Problem",
}

export const wakes = (stage: Stage): stage is "review" | "paused" | "broken" =>
  stage === "review" || stage === "paused" || stage === "broken"
