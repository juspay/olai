import type { Channel, Notice } from "olai-plugin-alerts/contract"
import type { BrowserManagement } from "@olai/surface/management"
import { createEffect, onCleanup } from "solid-js"

import { definedPlugins, faultSaid, stageOf, wakes, type Defined, type Stage } from "./state.ts"

export const tagOf = (name: string): string => `olai:plugin:${name}`

export const noticeOf = (plugin: Defined, stage: "review" | "paused" | "broken"): Notice => ({
  tag: tagOf(plugin.name),
  title: stage === "review"
    ? `${plugin.source.title} is ready for you`
    : stage === "paused"
      ? `${plugin.source.title} is paused`
      : `${plugin.source.title} couldn't start`,
  body: stage === "review"
    ? plugin.source.chat !== true
      ? "It is in your vault and nobody has read it yet. Read what it does and turn it on."
      : "An agent finished building it. Read what it does and turn it on."
    : stage === "paused"
      ? "Its code changed since you turned it on, so it stopped. Read what changed and turn it on again."
      : faultSaid(plugin) ?? "It could not start, and gave no message.",
  data: { kind: "plugin", name: plugin.name },
})

export const createPluginAlerts = (
  channel: Channel,
  management: BrowserManagement,
  go: (word: string) => void,
): void => {
  onCleanup(channel.onPress("plugin", (asked) => go(asked.name)))
  const roster = management.roster()
  const before = new Map<string, Stage>()
  let seeded = false
  createEffect(() => {
    const now = roster()
    if (now === undefined) return
    const rows = definedPlugins(now)
    const names = new Set<string>()
    for (const plugin of rows) {
      names.add(plugin.name)
      const stage = stageOf(plugin)
      const was = before.get(plugin.name)
      before.set(plugin.name, stage)
      if (!seeded || was === stage || !wakes(stage)) continue
      void channel.notify(noticeOf(plugin, stage))
      channel.chime()
    }
    for (const name of [...before.keys()]) if (!names.has(name)) before.delete(name)
    seeded = true
  })
}
