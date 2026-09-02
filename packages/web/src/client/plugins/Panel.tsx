/**
 * WHAT THIS INSTANCE IS RUNNING — one row per plugin the build has, and the
 * panel is its own now rather than a section at the foot of preferences.
 *
 * ## Why it left the preferences panel
 *
 * Because the two panels answer two different questions, and one of them is not
 * a preference at all. Preferences is HOW THIS BROWSER READS — the theme, the
 * type, how much of a row is drawn, whether finished work shows — and every row
 * on it is this browser's to change, kept in this browser, different in the next
 * one. A plugin's enablement is the INSTANCE's: `--plugins` is CLI/nix only,
 * there is no settings file and no verb a press could call, and the answer is
 * the same in every browser pointed at this server.
 *
 * Mixing them cost the frozen rows their meaning. A read-only strip at the foot
 * of a panel of live ones reads as a preference somebody has disabled — a thing
 * that would move if you had permission — where what it actually is is a FACT
 * about the serve, with the same standing as the connection dot. Its own door
 * says that before a reader has read a word of it.
 *
 * The two git rows stay on preferences and are frozen the same way, which looks
 * like the same case and is not: they are policy over THIS DIRECTORY, which is
 * what the rest of that panel is about, and a person setting how their pages
 * read is in the right place to be told what happens when they write one.
 *
 * ## What is on it
 *
 * A WALK, not a list: what the `plugins` cell carries is a row per plugin the
 * BUILD has, each saying whether this serve runs it and which of five states it
 * is in — so a third plugin reaches this panel with no line here moving, and
 * nothing in `@olai/web` is the place a plugin's name is hardcoded. The fence
 * one package over holds that as an equality; this file is written so there is
 * nothing for it to catch.
 *
 * THE LABEL IS THE NAME, VERBATIM — not prettified into `Kolu`. It is the word
 * `--plugins` takes, the namespace its members are composed under and the docs
 * slug, and a label that title-cased it would be the one spelling of a plugin's
 * name coming apart on the one screen that tells you what to type.
 *
 * The ROW is the settings panel's own component and stays there: a row is a
 * label, a control, what the choice in force MEANS, and who set it — four parts
 * that are the same four here, and a second one of them would be a second thing
 * to keep in step. What this file owns is which rows there are and what they
 * say ({@link ./rows.ts}).
 *
 * ## Where the panel goes is not this file's decision
 *
 * The bar is `sticky` with a z-index, which makes it a stacking context and a
 * 3rem-tall box, so the panel is portalled out of it and positioned against the
 * VIEWPORT (`../anchor.ts`) — exactly as the preferences panel beside it and
 * the Commit panel two chips along are.
 */

import { For, Show } from "solid-js"

import { NO_ROSTER, type PluginRoster } from "@olai/surface"

import { styleOf } from "../anchor.ts"
import { LAYER } from "../layer.ts"
import { Segmented } from "../settings/Segmented.tsx"
import { Row } from "../settings/Row.tsx"
import { pluginPref, TESTID } from "../testids.ts"
import { olai } from "../wire.ts"

import { pluginHint, pluginRows, pluginSetBy } from "./rows.ts"

/** The two words a plugin's strip can read. FROZEN in both directions, always:
 *  `--plugins` is CLI/nix only, so there is no verb a press could call —
 *  the strip is a READOUT wearing a control's shape, which is what the two git
 *  rows on the panel beside this already are. */
const PLUGIN_CHOICES = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
] as const

export function Panel(props: {
  readonly at: ReturnType<typeof styleOf> extends infer _ ? Parameters<typeof styleOf>[0]
    : never
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  /** THE ROSTER, read once for the whole panel.
   *
   *  A DIRECT `use()` rather than a constructor: there is nothing to press,
   *  nothing to remember and no second reader in the app. Before the first
   *  frame it is empty (`@olai/surface`'s `NO_ROSTER`), so the panel draws no
   *  rows at all rather than a set of rows claiming everything is off — which
   *  is the same reason that value exists at all. */
  const roster = olai.cells.plugins.use()
  const plugins = (): PluginRoster => roster.value() ?? NO_ROSTER
  const rows = () => pluginRows(plugins())
  return (
    <section
      ref={props.inside}
      class={`fixed ${LAYER.over} flex min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border-0 bg-panel p-4 text-sm shadow-xl ring-1 ring-rule/40 focus:outline-none`}
      style={styleOf(props.at)}
      // Focusable, and never in the tab order: opening puts the caret here so a
      // keyboard is standing IN the panel rather than beside it
      // (`../popover.ts` says why a portal needs that), and Tab from here is
      // the first control. No ring on it, because it is a waypoint rather than
      // a control.
      tabindex="-1"
      data-testid={TESTID.pluginsPanel}
      aria-label="plugins"
    >
      <For each={rows()}>
        {(plugin) => (
          <Row
            label={plugin.name}
            pref={pluginPref(plugin.name)}
            hint={pluginHint(plugin)}
            setBy={pluginSetBy(plugins(), plugin)}
          >
            <Segmented
              choices={PLUGIN_CHOICES}
              value={plugin.running ? "on" : "off"}
              frozen
            />
          </Row>
        )}
      </For>

      {/* A BUILD WITH NO PLUGINS SAYS SO, where on the preferences panel it
          drew nothing at all and could: there, the rows had six neighbours and
          an empty section was simply an absent one. A panel of its own that
          opened onto nothing is a control that looks broken, so the degenerate
          case gets the one sentence it needs — and it is the same sentence for
          a page that has not heard from the server yet, because `NO_ROSTER` is
          deliberately those two states in one value and neither has a row to
          draw. */}
      <Show when={rows().length === 0}>
        <p class="text-xs text-ink/70">
          This build has no plugins, or this page has not heard from the server yet.
        </p>
      </Show>
    </section>
  )
}
