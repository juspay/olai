/**
 * THE TWO MOMENTS A PLUGIN IS WORTH INTERRUPTING SOMEBODY FOR.
 *
 * Asking for a plugin is a thing you do and then walk away from: an agent
 * writes three files, checks that both halves compile and comes back a minute
 * or several later. The whole shape of this feature assumes nobody is watching
 * the page while that happens — the conversation is an ordinary chat, you can
 * close the panel and come back. So the two moments where the thing is waiting
 * on a PERSON have to reach that person wherever they are: it is ready to be
 * read, or it could not start.
 *
 * Nothing else is raised. A plugin going ON is not news, because the person
 * pressed the button; one being BUILT is not news, because they asked for it a
 * minute ago. `../state.ts`'s `wakes` is that judgement, and it is there rather
 * than here because the sidebar's mark is the same two words.
 *
 * ## Through the seam, not around it
 *
 * `olai-plugin-alerts` owns consent, the sound, the OS banner and the press
 * relay. This component composes a {@link Notice} and hands it over; it never
 * touches `Notification` itself. The press arm is `{ kind: "plugin", name }` —
 * the one arm in that union that NAMES a thing, because the app can derive
 * *the waiting question* and *today's agenda* at press time and cannot derive
 * WHICH plugin: two can go ready in the same minute, and a notification
 * outlives the state that raised it.
 *
 * THE TAG IS `olai:plugin:<word>`, one per plugin. The OS replaces a same-tag
 * banner rather than stacking one, which is what stops two tabs of one olai
 * from double-pinging, and the worker routes a press by that tag because at
 * press time it has nothing else.
 *
 * ## What it deliberately does NOT do
 *
 * It does not `wear` a badge. The app icon's count is ONE number with
 * last-writer-wins semantics on the seam, and chat already drives it from its
 * own map of conversations that need you; a second row writing it would make
 * the two overwrite each other on every frame. A plugin waiting to be read
 * says so in the sidebar, in the banner and on its own page, which is three
 * places more than it needs.
 *
 * ## The first reading is not an event
 *
 * A tab that opens on a vault with a plugin already waiting must not ping: the
 * state is not new, the reader is simply arriving. So the first roster frame
 * seeds the memory and raises nothing, and only a CHANGE afterwards is an
 * event.
 */

import type { Channel, Notice } from "olai-plugin-alerts/contract"
import type { BrowserManagement } from "@olai/surface/management"
import { createEffect, onCleanup } from "solid-js"

import { definedPlugins, faultSaid, stageOf, wakes, type Defined, type Stage } from "./state.ts"

/** The dedup key, and the only thing a press is routed by. */
export const tagOf = (name: string): string => `olai:plugin:${name}`

/**
 * What the banner says. Two lines on every platform that draws one: which
 * plugin, and what it is waiting for.
 *
 * THE SECOND LINE IS ABOUT HOW IT GOT THERE, and that is why *ready* has two
 * of them. "An agent finished building it" is true of a plugin somebody asked
 * for in the palette and false of a folder they copied in from another vault
 * or wrote by hand — which is the same screen reached without any agent at
 * all. A chat at the plugin's own address is what tells them apart, and it is
 * the same fact the page uses to decide whether there is anybody to ask.
 */
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

/**
 * One watch over the roster, owned by the activation that calls it. Every
 * listener and every piece of memory here goes with that owner.
 *
 * `go` is WHERE A PRESS LANDS, handed in rather than spelled here: the
 * component that declares navigation already holds this row's route
 * (`../browser.tsx`), and this module composing the URL itself put a page's
 * whole drawing — the route, its glyph — behind every reader of the two
 * sentences below.
 */
export const createPluginAlerts = (
  channel: Channel,
  management: BrowserManagement,
  go: (word: string) => void,
): void => {
  onCleanup(channel.onPress("plugin", (asked) => go(asked.name)))
  const roster = management.roster()
  // WHAT EACH PLUGIN WAS DOING LAST TIME. A plain table rather than a signal:
  // nothing draws it, it is the effect's own memory of the frame before.
  const before = new Map<string, Stage>()
  let seeded = false
  createEffect(() => {
    const now = roster()
    // A ROSTER THAT HAS NOT ARRIVED IS NOT AN EMPTY ONE. The wire's reading is
    // `undefined` until the first snapshot lands, and seeding off that marked
    // the memory as seeded over a table with nothing in it — so the FIRST real
    // roster read as *every waiting plugin just arrived* and rang for each of
    // them, which is exactly the ping this whole module exists not to send.
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
    // A plugin whose folder was deleted is forgotten, so putting the same
    // folder back is a fresh event rather than a silence.
    for (const name of [...before.keys()]) if (!names.has(name)) before.delete(name)
    seeded = true
  })
}
