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
 * one. A plugin's enablement is the INSTANCE's: the answer is the same in every
 * browser pointed at this server, and a flip made here moves all of them.
 *
 * That argument SURVIVED the rows becoming live, and it is worth saying which
 * half of it was doing the work. It was never *these rows cannot be changed*; it
 * was *these rows are not about the reader*. A live switch on this panel changes
 * what the SERVE is running, for everybody looking at it — which is a different
 * kind of thing from a theme, and still wants a door of its own.
 *
 * The two git rows stay on preferences and are frozen the same way they always
 * were, which looks like the case this panel used to be and is not any more:
 * they are policy over THIS DIRECTORY, which is what the rest of that panel is
 * about, and they are still the server's alone.
 *
 * ## THE ROWS ARE A SWITCH NOW
 *
 * This file argued the opposite at length, and the paragraph is gone rather than
 * softened: *frozen in both directions, always: `--plugins` is CLI/nix only, so
 * there is no verb a press could call — the strip is a READOUT wearing a
 * control's shape.* The premise was true when it was written and the verb now
 * exists (`plugins.set`, the human's ruling of 2026-09-04). A readout wearing a
 * control's shape was always the least honest thing on this panel; it is a
 * control.
 *
 * What did NOT change is where a serve STARTS from. There is no settings file,
 * no CLI verb against a running serve, and `--plugins` and the nix module are
 * still the only things a restart reads. A flip is the running process's, and
 * this panel says so — once, at the foot ({@link PLUGINS_SESSION_ONLY}).
 *
 * ## ...WHICH IS WHY THIS PANEL HAS A PANEL-WIDE LINE, having argued it needed
 * none
 *
 * The old argument, in full: *nothing here is the reader's. Every row is the
 * instance's, and every row already says so on its own line — `./rows.ts`'s
 * `pluginSetBy` ends each one with the same clause. A panel-wide sentence would
 * be that clause a fourth time, under three rows that had each just said it,
 * which is how a caveat stops being read at all.*
 *
 * Every clause of that is true and the conclusion is backwards. If the same
 * sentence is on every row, the panel is ALREADY drawing the caveat N times;
 * the per-row placement is what makes it N rather than one. A serve started
 * with `--plugins=claude,codex,chat,kolu,odu` drew that flag, quoted in full and
 * wrapped over three lines, eight times — under a hint that was itself the same
 * sentence on six of the eight. The human, 2026-09-04, with the screenshot:
 * *portrait spammy*.
 *
 * So the rule did not change; which sentence is per-row and which is per-panel
 * did. What is the same for every row — how this serve was started, and that a
 * flip does not outlive it — is one line at the foot ({@link pluginsStarted}).
 * What actually differs stays on the row, and the opt-in row is exactly the
 * case the old paragraph was reaching for: under no flag, one row's built-in
 * default is ON and its neighbour's is OFF, and only the row can say which.
 *
 * ## What is on it, and what is NOT
 *
 * A WALK, not a list: what the `plugins` cell carries is a row per plugin the
 * BUILD has, each saying whether this serve runs it, which of six states it is
 * in, and — on a row that stands behind doors — which rows stop with it. So a
 * third plugin reaches this panel with no line here moving, and nothing in
 * `@olai/web` is the place a plugin's name is hardcoded. The fence one package
 * over holds that as an equality; this file is written so there is nothing for
 * it to catch.
 *
 * A ROW IS A NAME AND A SWITCH, and a sentence only where there is one. The
 * ordinary running row has nothing to add — the switch reads On — so
 * `pluginHint` answers `null` and `../settings/Row.tsx` draws no paragraph at
 * all. Eight rows read as a short list rather than a scroll, and the four rows
 * that DO carry a sentence (a failure, a wait, an absence, a row that carries
 * others) are the four a reader's eye lands on, because they are the only ones
 * with text under them.
 *
 * THE LABEL IS THE NAME, VERBATIM — not prettified into `Kolu`. It is the word
 * `--plugins` takes, the namespace its members are composed under and the docs
 * slug, and a label that title-cased it would be the one spelling of a plugin's
 * name coming apart on the one screen that tells you what to type.
 *
 * The ROW is the settings panel's own component and stays there: a row is a
 * label, a control, what the choice in force MEANS, and where it came from —
 * four parts that are the same four here, and a second one of them would be a
 * second thing to keep in step. What this file owns is which rows there are and
 * what they say ({@link ./rows.ts}).
 *
 * ## THE ONE SIGNAL, and why it is not a constructor
 *
 * `flipping` is the name of the row whose press is still in the air. It is not a
 * fact about the serve — it is about the button under this reader's finger,
 * which must not be pressed twice — which is exactly the line `../commit/state.ts`
 * draws for Commit and Push, and the reason those keep a signal each while
 * everything else about git rides on a cell.
 *
 * It stays HERE rather than moving into a constructor beside them because there
 * is still no second reader: one panel presses, one panel draws the answer, and
 * a factory would be an indirection whose only caller is the file that would
 * have held the signal anyway. What DID move out is the part a test can ask —
 * `./rows.ts`'s `pluginSwitch`, which is the whole decision the signal feeds.
 *
 * ## IT DOES NOT SURVIVE THE REBUILD, and that is the decision rather than the
 * leftover
 *
 * A successful flip moves the roster, which redials, which rebuilds this
 * component — so `flipping` comes back `null` and the strip un-freezes. That is
 * the right outcome and not an accident of where the signal sits: the freeze
 * exists to stop a SECOND press landing on a value the server has not answered
 * about yet, and by the time the tree is rebuilt the roster has moved, so the
 * strip is already drawing the new answer. Freezing past that would be a
 * control held shut after the thing it was waiting for arrived.
 *
 * It is the open state — {@link ./opened.ts} — that had to be hoisted, and only
 * that. The two are opposite cases on purpose: which door is open is a fact
 * about the page and must outlive the rebuild; whose press is in the air is a
 * fact about a request the rebuild is the ANSWER to, and must not.
 *
 * The `setFlipping(null)` in the callback below can therefore land on a
 * component that no longer exists, which costs nothing: it writes a signal
 * nobody is reading, on a disposed owner, and the rebuilt panel has its own.
 *
 * ## Where the panel goes is not this file's decision
 *
 * The bar is `sticky` with a z-index, which makes it a stacking context and a
 * 3rem-tall box, so the panel is portalled out of it and positioned against the
 * VIEWPORT (`../anchor.ts`) — exactly as the preferences panel beside it and
 * the Commit panel two chips along are.
 */

import { createSignal, For, Show } from "solid-js"

import { NO_ROSTER, type PluginRoster } from "@olai/surface"

import { type Anchor, styleOf } from "../anchor.ts"
import { PANEL_BOX } from "../readout.ts"
import { run } from "../run.ts"
import { Segmented } from "../settings/Segmented.tsx"
import { Row } from "../settings/Row.tsx"
import { pluginPref, TESTID } from "../testids.ts"
import { olai } from "../wire.ts"

import { type PluginPick, pluginHint, pluginRows, pluginsStarted, pluginSwitch } from "./rows.ts"

/** The two words a plugin's strip can read. LIVE in both directions now: a row
 *  that is off can be started and a row that is running can be stopped, and the
 *  one that will not come back keeps its strip drawn — see `./rows.ts`'s
 *  `pluginSwitch` for why the failed row is not the exception it looks like. */
const PLUGIN_CHOICES = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
] as const

export function Panel(props: {
  /** Where to sit, in viewport pixels — see `../anchor.ts` for why this is not
   *  a matter of CSS alone. */
  readonly at: Anchor
  /** Register this surface with the click-away, since it is portalled and so is
   *  not a descendant of the control that opened it. */
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  /** THE ROSTER, read once for the whole panel.
   *
   *  A DIRECT `use()` rather than a constructor: the two things this panel holds
   *  beyond the cell are one signal and one message, both belonging to the press
   *  made on this panel, and neither has a second reader anywhere in the app.
   *  Before the first frame the cell is empty (`@olai/surface`'s `NO_ROSTER`),
   *  so the panel draws no rows at all rather than a set of rows claiming
   *  everything is off — which is the same reason that value exists at all. */
  const roster = olai.cells.plugins.use()
  const plugins = (): PluginRoster => roster.value() ?? NO_ROSTER
  const rows = () => pluginRows(plugins())

  /** WHOSE PRESS IS STILL IN THE AIR — the row's name, or `null`.
   *
   *  A NAME rather than a boolean, so the freeze lands on the row that was
   *  pressed and not on the panel: the other rows are still true, still live,
   *  and a person who pressed the wrong one should be able to press the right
   *  one without waiting for a settle they did not ask for. */
  const [flipping, setFlipping] = createSignal<string | null>(null)

  /** WHAT THE SERVER WOULD NOT TAKE, or `null` — the same arrangement the
   *  preferences panel keeps for Resume (`../settings/Panel.tsx`), and for the
   *  same reason: a call that never reached the loader happened to THIS
   *  request, nothing on the cell can say so, and a control that silently did
   *  nothing is the failure the whole feature is about.
   *
   *  Cleared when the next press starts, so what is on screen is about the
   *  press a reader just made. */
  const [refused, setRefused] = createSignal<string | null>(null)

  /** THE PRESS. `enabled` is where the switch is being PUT, never which way to
   *  move it: two tabs pressing at once should agree about where they were
   *  aiming, and a "flip" verb read against a roster either of them might have
   *  been drawn from could land on the state neither asked for. */
  const set = (name: string, pick: PluginPick): void => {
    if (flipping() !== null) return
    setFlipping(name)
    setRefused(null)
    run(
      olai.procedures.plugins.set({ name, enabled: pick === "on" }),
      (failure) => {
        setFlipping(null)
        setRefused(failure.message)
      },
      // THE ANSWER CARRIES NOTHING, and it does not need to: what a person is
      // owed is the roster, which the serve republishes once the bundle has
      // stopped moving. This only ever un-freezes the strip — by which time
      // the cell it draws from has already moved under it.
      () => setFlipping(null),
    )
  }

  return (
    <section
      ref={props.inside}
      class={`${PANEL_BOX} gap-4`}
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
        {(plugin) => {
          const strip = () => pluginSwitch(plugin, flipping() === plugin.name)
          return (
            <Row
              label={plugin.name}
              pref={pluginPref(plugin.name)}
              // `null` ON THE ORDINARY ROW, which draws no paragraph at all —
              // and NO `setBy` on any of them: where this serve was started is
              // one fact for the panel and is at the foot. Neither prop being
              // passed is why these rows are a name and a switch on one line.
              hint={pluginHint(plugin)}
            >
              <Segmented
                choices={PLUGIN_CHOICES}
                value={strip().value}
                frozen={strip().frozen}
                onPick={(value) => set(plugin.name, value)}
              />
            </Row>
          )
        }}
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

      {/* WHAT THE SERVER WOULD NOT TAKE, beside the rows that asked. One place
          rather than per row: a refusal is about the press just made, and the
          press just made is the only one whose row is not still live. */}
      <Show when={refused()}>
        {(said) => (
          <p class="wrap-anywhere text-xs text-alarm" data-testid={TESTID.pluginsRefused}>
            {said()}
          </p>
        )}
      </Show>

      {/* HOW THIS SERVE WAS STARTED, AND HOW LONG A FLIP LASTS — once, for the
          whole panel. This was a three-line block under every row; the header
          argues why the panel that spent its whole life insisting it needed no
          such line now has exactly one.

          Drawn only where there are rows, because the empty-build sentence
          above is a different fact and a serve with no plugins has nothing to
          say about how it started them. */}
      <Show when={rows().length > 0}>
        <p class="text-xs leading-relaxed text-muted" data-testid={TESTID.pluginsStarted}>
          {pluginsStarted(plugins())}
        </p>
      </Show>
    </section>
  )
}
