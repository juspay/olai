/**
 * WHERE A FACE CAN HANG — the slot catalog, as DATA.
 *
 * ## Why it is a file of its own, and it was `./browser.ts`'s
 *
 * Because two processes read it and only one of them draws. The tab reads it to
 * build the slot table a browser half registers into, which is what it has
 * always been for. The SERVE reads it to answer `plugins.inspect` — the verb an
 * agent asks *what may I name* before it writes a plugin into a vault (phase
 * 12) — and a serve may not open this package's browser door: that door carries
 * every face type in the app, and `@olai/server`'s manifest says out loud that
 * it opens `./services` and never the root.
 *
 * So the catalog moved to where both can reach it and NOTHING ELSE moved. The
 * types that say what a face IS — the chip, the block, the pane, the mark —
 * stay in `./browser.ts` with the components they describe; what is here is the
 * list of names and the one fact about each that is not a drawing.
 *
 * A COPY IN THE SERVER was the alternative and is the thing this refuses. The
 * catalog is what an agent is told it may register into; a second list that
 * agreed with this one until somebody added a slot would send an agent to write
 * a face into a name nothing reads, which lands as a plugin that mounts,
 * registers, and draws nothing anywhere.
 */

/** WHAT KEYS AN ENTRY, which is also what says how many fit — see
 *  {@link ./browser.ts}'s header on why that is one question and not two. */
export type SlotKey = "plugin" | "kind" | "app" | "nothing"

/**
 * WHERE A FACE CAN HANG — the sixteen, and what keys each.
 *
 * DATA rather than a union alone, because the key rule is the thing a reader
 * and the service both need and a union could only carry the names. The gloss
 * is on the row for the same reason a `PropKind`'s is: this is the list
 * somebody writing a plugin reads to find out what this app has room for.
 */
export const SLOTS = {
  /** A face beside the value, in the property run — drawn only while the
   *  plugin has something to say about it. */
  "outline.row.chip": { keyedBy: "kind" },
  /** ...and what that chip's press opens, under the run. */
  "outline.row.pane": { keyedBy: "kind" },
  /** A face that OWNS the property's row, whether or not anything is
   *  happening. A block wins where a plugin registers both. */
  "outline.row.block": { keyedBy: "kind" },
  /**
   * A DOOR ON A ROW — drawn under the property run, on every row, and answering
   * nothing on nearly all of them.
   *
   * A LIST rather than keyed by kind, and the reason is what the face actually
   * reads. The plan named this slot `keyed`, on the shape the three
   * `outline.row.*` faces above have: a chip is drawn per VALUE, so the value's
   * kind is what selects it. A door is not — it is drawn per ROW, and what
   * decides whether it says anything is a lookup in a table the plugin already
   * subscribes to once for the whole app (the agents roster is one
   * subscription and a map read per row, which is what its own module argues at
   * length). Keying by kind would need the row's LICENCE at the place the door
   * is drawn, which is a reading `@olai/web`'s property run has and the row
   * around it does not — and it would buy nothing, because the face's answer is
   * the same map read either way.
   *
   * So the app draws every door and each answers for the node it is handed.
   * What that costs is one closure per registered plugin per drawn row; what a
   * kind key would cost is the licence resolution moved up a level for a face
   * whose own answer is already a `null` on nearly every row.
   */
  "outline.row.door": { keyedBy: "nothing" },
  /** A VERB on the row's ••• menu, as words and a press rather than a drawing —
   *  "ask agent" is the first. A list, because a plugin with two verbs is
   *  ordinary and a plugin that landed `failed` for having two is not.
   *
   *  WHERE plugin verbs sit is core's and stays core's: that menu's reads come
   *  above its writes on purpose ("a person reaching for Collapse all and
   *  hitting Move to Trash is a mistake the ORDER can prevent"), and a plugin
   *  that could place its row anywhere in that list could place it under a
   *  reader's thumb. */
  "outline.row.action": { keyedBy: "nothing" },
  /** A PAGE KIND which owns an address grammar, a standing reading and the
   * drawing of that reading. Several kinds may come from one plugin. */
  "app.route": { keyedBy: "nothing" },
  /** A directory door above the app's own entries. Placement is deliberately
   * a small vocabulary interpreted by the shell, never arbitrary ordering. */
  "sidebar.entry": { keyedBy: "nothing" },
  /** A SECTION IN THE SIDEBAR, under the app's own — the agents section is the
   *  first. A list, and ordered by the bundle's rank at the read, so two plugins
   *  with a section are in the order `olai.yml` names them rather than in the
   *  order the roster happened to mount them.
   *
   *  Core keeps the BOX (the region, its heading's shape, and the height budget
   *  `layout/entry.ts` argues for with an e2e scenario behind it) and the plugin
   *  brings the heading's words and what is under it — the `engine.install`
   *  split exactly, and for that split's reason: a face here would put core's
   *  own class vocabulary inside every tenant that wants a section. */
  "sidebar.section": { keyedBy: "nothing" },
  /** THE PANEL ON THE RIGHT OF THIS APP, and there is one — see the header on
   *  why this is keyed by the app rather than by the plugin.
   *
   *  What this slot hands over is the SEAT and not the geometry: the width the
   *  page reserves, the open/closed preference and the drag handle stay the
   *  shell's, because they are facts about the page's layout that survive
   *  whichever plugin is in the dock. A panel positions itself inside what it is
   *  given. */
  "app.panel": { keyedBy: "app" },
  /** A readout in the app's bar. WHERE it sits in the cluster is the app's
   *  decision and always was; what a plugin gets is a seat.
   *
   *  ONE SEAT PER PLUGIN, and it stays one seat in the lane that added the five
   *  above. The plan for the chat panel asks for TWO entries here — the wake
   *  strip and the bar's chat door — which this rule refuses by landing that
   *  plugin in `failed`. It is not widened yet because neither of the two is a
   *  bar seat in this app's geometry to begin with: the wake strip draws INSIDE
   *  the panel, and the minimized strip is a viewport-fixed overlay the panel
   *  itself puts up. Both travel with `app.panel`, which is one face, and the
   *  question this row would answer is whether a plugin ever wants two READOUTS
   *  in the bar — a different question, asked by whatever wants that, against the
   *  cluster's own width. */
  "app.header": { keyedBy: "plugin" },
  /** A KEYBOARD CHORD and what it does — ⌘J, "show or hide the agent". A list,
   *  because a plugin with three chords is one plugin.
   *
   *  THE COLLISION IS THE READER'S TO REFUSE, and it is the whole reason
   *  `client/keys.ts` is one file: "a chord and an editing key that both claim
   *  Ctrl+Enter disagree silently, in a browser, at the moment somebody is
   *  typing". This table cannot see that map, so it cannot check anything; what
   *  it can do is refuse to pretend, which is why the check is named here and
   *  owed by whoever reads this slot — a registration that collides with a
   *  chord the app already answers is refused there, in the app's own words, the
   *  way a duplicate key is refused here. */
  "app.keys": { keyedBy: "nothing" },
  /**
   * A VERB IN THE COMMAND PALETTE, behind a prefix of the plugin's own — `>`,
   * and what `>` does is send the line to the agent.
   *
   * ## The one this phase's plan did not have a name for
   *
   * The design named five slots the shell had to declare before chat could move
   * — the panel, the sidebar section, the row door, the row verb and the chords
   * — and said the rest would be "named as it is found". This is the one that was
   * found. The palette's `>` is not a chord, not a row verb and not a face in the
   * bar: it is a LINE somebody typed, sent somewhere, and the somewhere is a
   * conversation.
   *
   * A LIST, and the prefix is the key a reader dispatches on rather than a key
   * this table holds — two plugins claiming `>` is the same silent disagreement
   * `app.keys` describes one row up, and it is refused the same way: by the
   * READER, in the palette's own words, because this table cannot see what
   * prefixes core already answers.
   *
   * Core keeps the BOX — the input, the prefix strip, the shortlist under it,
   * where a refusal is drawn — and the plugin brings the word, the placeholder
   * and what a press does. What it does NOT get is the palette's own state: a
   * verb answers a refusal and the palette decides whether to stay open, because
   * "did that work" is a thing the palette says in one voice for every prefix.
   */
  "app.command": { keyedBy: "nothing" },
  /** A navigation row in the ordinary command-palette list. */
  "app.palette": { keyedBy: "nothing" },
  /** The tab's own half of this plugin, wrapped ONCE around the page — one
   *  subscription however many leaves draw. These NEST; the app folds them. */
  "app.mount": { keyedBy: "plugin" },
  /** The shapes drawn over a sentence this plugin delivered into somebody's
   *  conversation — a `<g>` in a sixteen-unit box, never a whole `<svg>`. */
  "delivery.mark": { keyedBy: "plugin" },
  /** THIS ENGINE'S ROW on the face drawn when the machine has NO agent at all:
   *  how a person gets it, as a `NotHere` rather than a drawing. Core owns the
   *  list, the mark and whether the name is a link; the plugin owns every word,
   *  and core composes no clause of them.
   *
   *  The panel's *which agent?* question has no slot beside this one, and the
   *  asymmetry is the ruling: a picker row's words are the engine's `name`,
   *  which the SERVER already sends per installed agent (`AgentChoice`), so a
   *  face for it would be a second author for one string. This face has no such
   *  source — the machine has no agent, so there is no roster to have carried
   *  one — which is exactly what makes it a slot. */
  "engine.install": { keyedBy: "plugin" },
} as const satisfies Readonly<Record<string, { readonly keyedBy: SlotKey }>>
