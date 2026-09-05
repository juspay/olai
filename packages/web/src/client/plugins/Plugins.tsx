/**
 * The way into the plugins: one control in the app header, and the panel it
 * opens.
 *
 * ## Why it is a control of its own and not a section of preferences
 *
 * The rows were at the foot of the preferences panel, and they answered a
 * different question from everything above them. Preferences is HOW THIS
 * BROWSER READS — the theme, the type, how much of a row is drawn — and every
 * row on it is this browser's to change, kept in this browser, different in the
 * next. A plugin's enablement is the INSTANCE's: `--plugins` is CLI/nix only,
 * there is no settings file and no verb a press could call, and the answer is
 * the same in every browser pointed at this server.
 *
 * Mixed together, the frozen rows read as preferences somebody had disabled —
 * a thing that would move if you had permission — where what they are is a fact
 * about the serve, with the same standing as the connection dot. Its own door
 * says that before a reader has read a word.
 *
 * ## What it costs, and why that is affordable here
 *
 * A seat in the bar, which this app does not hand out lightly: the theme pill
 * was RETIRED into the preferences panel on exactly this argument — *a bar that
 * has five things in it at 390pt cannot spend one of them on a second door to a
 * panel that is already there*. This is not that case. It is not a second door
 * to the same panel; it is the only door to a different one.
 *
 * And what is behind it has nowhere else to be asked. This is the argument the
 * preferences panel used to carry for these rows, moved here with them, because
 * it is the reason they are worth a control rather than the reason they were
 * worth a section: the question they answer — *why is the integration the docs
 * describe not on this screen* — cannot be asked anywhere else, because what a
 * plugin that is off leaves behind is NOTHING AT ALL. No chip, no pane, no
 * error. A product that drew only the settings a reader can change would answer
 * that question by staying silent.
 *
 * DESKTOP ONLY, which is how the seat is afforded. On a phone it is a row at
 * the foot of the directory drawer beside preferences, because the phone bar is
 * the wordmark, the burger and search and has no room for a fifth chip. That is
 * the arrangement `../settings/Preferences.tsx` already keeps, and this follows
 * it rather than inventing a second one.
 *
 * WHAT A DOOR IN THIS BAR IS — the two shapes, the portal out of a stacking
 * context, and the focus cycle it shares with the panels along from it — is
 * `../BarDoor.tsx`, and this file is four strings and a panel. It was a copy of
 * `../settings/Preferences.tsx` with those four changed, which is what a second
 * instance of an affordance looks like when it is written rather than reused.
 * That the two panels answer different questions is the argument for two DOORS
 * and no argument at all for two implementations of one.
 */

import { BarDoor } from "../BarDoor.tsx"
import { TESTID } from "../testids.ts"

import { pluginsDoor } from "./opened.ts"
import { Panel } from "./Panel.tsx"

export function Plugins(props: {
  /** `closet` is the phone drawer row. Default is the header chip. */
  readonly where?: "header" | "closet"
}) {
  return (
    <BarDoor
      where={props.where}
      glyph="⧉"
      header="plugins"
      closet="plugins"
      testid={TESTID.pluginsTrigger}
      title="plugins: which integrations this server is running, and why"
      // Keep this door open when its switch removes a plugin provider.
      held={pluginsDoor}
      panel={(at, inside) => <Panel at={at} inside={inside} />}
    />
  )
}
