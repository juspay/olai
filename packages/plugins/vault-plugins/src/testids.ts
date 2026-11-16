/**
 * STABLE DOM IDENTIFIERS OWNED BY THIS ROW'S BROWSER HALF.
 *
 * A static contract and nothing else: importing this loads no activation, no
 * client and no Solid owner, which is why a scenario package may open it while
 * the faces it names are drawn by a plugin that may not even be mounted.
 *
 * The names are grouped the way the surface is — the sidebar's section, the
 * plugin's own page, the two palette levels and the alert — because that is
 * the order somebody debugging a failing scenario walks them in, and a flat
 * alphabetical list is a list you have to already know to read.
 */

export const TESTID = {
  /** The sidebar's Plugins region, and one row of it. The region is in the DOM
   *  whenever this row's `section` component is up, including on a vault that
   *  defines no plugin — which is where the feature is found. */
  section: "plugins-section",
  sectionNew: "plugins-section-new",
  sectionRow: "plugins-section-row",
  /** ...and the one row an empty vault draws instead: the press that opens
   *  the palette at *New plugin*, or the same words as a sentence where there
   *  is no palette to open. */
  sectionEmpty: "plugins-section-empty",
  /** The state mark a row wears: `Review`, `Problem`, the working dot. */
  sectionMark: "plugins-section-mark",

  /** The page itself, keyed by the word in `data-plugin`. */
  page: "plugin-page",
  /** ...and the page for a word no plugin in this vault has. */
  pageMissing: "plugin-page-missing",
  /** The state line under the title: dot, word, meta. */
  pageState: "plugin-page-state",
  /** The one primary verb, whatever this state's verb is. */
  pageVerb: "plugin-page-verb",
  /** The `•••` beside it, and the rows inside it. */
  pageMore: "plugin-page-more",
  pageTrustAlways: "plugin-page-trust-always",
  /** ...and the way back out of it, drawn in its place while it is in force. */
  pageTrustStop: "plugin-page-trust-stop",
  /** *Delete…*, and the two buttons of the confirmation it opens. The verb is
   *  the page's because the halves are reachable from nowhere else. */
  pageDelete: "plugin-page-delete",
  pageDeleteConfirm: "plugin-page-delete-confirm",
  pageDeleteKeep: "plugin-page-delete-keep",
  pageAskChange: "plugin-page-ask-change",
  /** The link to the conversation's own page, drawn where this viewport has
   *  no seat to dock it in — a phone, or a serve with no shell. */
  pageAskOpen: "plugin-page-ask-open",
  /** What came of a press that spoke to the builder: it went, or there was
   *  nobody there. */
  pageAskSaid: "plugin-page-ask-said",
  /** *I'll read it now* — the way past a build whose agent never said it had
   *  finished. */
  pageReadAnyway: "plugin-page-read-anyway",
  /** The phone's foot, where the primary verb sits below `md`. */
  pageFoot: "plugin-page-foot",
  /** The standing sentence about what running a plugin costs. It is asserted
   *  by its own id because it may never quietly stop being drawn. */
  pageTrustSaid: "plugin-page-trust",
  /** *What it does* — the README, rendered. */
  pageReadme: "plugin-page-readme",
  /** *What it uses* — one row per reading of the code's imports. */
  pageUses: "plugin-page-uses",
  /** *Ask for a change* — the section, which also holds the sentence said
   *  where no agent is available to ask. */
  pageAsk: "plugin-page-ask",
  /** *The code* — the tab strip, one tab, the body, and the folder path. */
  pageCode: "plugin-page-code",
  pageCodeTab: "plugin-page-code-tab",
  pageFolder: "plugin-page-folder",
  /** ...and the same block drawn as a diff against the approved version. */
  pageDiff: "plugin-page-diff",
  /** The banner over a paused or broken plugin. */
  pageBanner: "plugin-page-banner",
  /** *Settings* — one knob per leaf the plugin declared. */
  pageKnob: "plugin-page-knob",
  /** The disarmed state: the version moved while somebody was reading it. */
  pageMoved: "plugin-page-moved",
  pageMovedRead: "plugin-page-moved-read",
  /** What the page says when a call came back refused. */
  pageRefused: "plugin-page-refused",

  /**
   * ⌘K → **New plugin** HAS NO IDS HERE, and that is the honest table rather
   * than an omission: both of its levels are drawn by the palette, out of the
   * row and the two level values this row contributes
   * (`./browser/new-plugin.ts`). The box, the crumb, the rows, the one option
   * carrying `Kept in your vault as plugins/<word>/`, the submit and the line a
   * refusal lands on are all `olai-plugin-navigation/testids`' — a scenario
   * names them there, and this row names the ROW ID it contributes,
   * `NEW_PLUGIN_ROW`, which is also the palette path the sidebar's `+` opens.
   */
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/vault-plugins": OwnedTestIds }
}
