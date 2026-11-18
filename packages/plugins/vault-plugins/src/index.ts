import { PLUGIN_FOLDER, PLUGIN_README_FILE } from "@olai/surface"
import { serviceTag } from "@olai/plugin-api/services"
import type { Effect } from "effect"
export const name = "vault-plugins"
export const chunks = serviceTag<{ readonly chunk: (path: string) => string | null }>("vault-plugins.chunks")

/**
 * A TITLE, AS A FOLDER NAME — the one rule that turns what a person typed into
 * the word a plugin is known by.
 *
 * It is here, in the package's own door, because BOTH ends spell it: the
 * palette draws `Kept in your vault as plugins/<word>/` under the name box
 * while somebody is still editing it, and the serve takes the same title and
 * creates the folder. Two slug rules that agreed until they did not would show
 * a person one folder and make another.
 *
 * Lowercase, letters and digits kept, everything else a hyphen, no run of
 * hyphens and none at either end — which is `WORD`'s grammar (`./source.ts`)
 * reached by construction rather than checked afterwards. It can still answer
 * something `WORD` refuses — a title of nothing but punctuation slugs to the
 * empty string — so the caller checks; what it cannot do is surprise the caller
 * with a shape neither of them expected.
 *
 * THE ENDS ARE TRIMMED BY INDEX AND NOT BY A SECOND PATTERN. `/^-+|-+$/` reads
 * perfectly and is quadratic on the one input this function is actually given:
 * a sentence a person typed, where a long run of punctuation becomes a long
 * run of hyphens and the `-+$` arm then backtracks over it from every position
 * (CodeQL's `js/polynomial-redos`, and it is right — this runs on each
 * keystroke in the palette's name box). Two walks from the ends are linear and
 * say the same thing.
 */
export const slugOf = (title: string): string => {
  const hyphenated = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-")
  let from = 0
  let to = hyphenated.length
  while (from < to && hyphenated[from] === "-") from += 1
  while (to > from && hyphenated[to - 1] === "-") to -= 1
  return hyphenated.slice(from, to)
}

/** The prefix one plugin's page claims. Here rather than in the route module
 *  for the reason {@link slugOf} is: both halves spell it now. */
export const PLUGIN_PATH = "/plugins/"

/**
 * WHERE A PLUGIN'S README IS — `plugins/<word>/README.md`, the first file a
 * mint writes and the one a person reads.
 *
 * It is what a plugin's BUILDER CHAT is about: a chat belongs to a node or a
 * note, one each, and a plugin's note is its README. The tie lives in that
 * file's own front matter, so nothing is written on the plugin's folder to say
 * which conversation is building it and nothing has to be kept in step with
 * the folder's name. The serve spells this when it opens a conversation and
 * when it speaks into one, and the runtime spells it when it asks chat which
 * plugins have one.
 *
 * THE PATH IS SPELLED HERE AND NOWHERE ELSE — composed from the folder and the
 * file name a plugin's halves are already named by (`@olai/surface`), so the
 * CREATE that makes the folder and every reader that asks for the note cannot
 * come to spell one file two ways. `mint` wrote its own
 * `${PLUGIN_FOLDER}${word}/${PLUGIN_README_FILE}` beside this, which is the
 * same string until the day one of them moves.
 */
export const pluginReadme = (word: string): string => `${PLUGIN_FOLDER}${word}/${PLUGIN_README_FILE}`

/** One definition, at one version, as the panel asks about it. */
export interface ApprovalRequest {
  readonly name: string
  readonly version: string
  /** Whether every later version is approved too, or only this one. */
  readonly forever: boolean
}

/**
 * SAYING YES TO CODE — the one verb the plugins panel needs of this row, and
 * the whole of what it may reach.
 *
 * The inspector used to import this row's `./client` and call
 * `procedures.plugins.approve` on it: one plugin holding another plugin's WIRE,
 * which is the thing `Wired` exists to make unspellable (a client is keyed by
 * the asking fiber's own name, so there is no argument anywhere for another
 * plugin's members). The module holder was the way around it, and it was
 * undeclared besides — the audit's §12.
 *
 * A SERVICE with one verb on it instead. The inspector declares this key on a
 * component of its own, so the runtime knows who is asking, the plugins panel
 * can say when the provider is absent, and what the inspector can reach is one
 * verb rather than every member this row composes.
 *
 * ABSENCE IS THE CONSUMER'S TO DRAW and is unchanged: with no vault-plugins row
 * mounted the panel refuses in its own words rather than disappearing.
 */
export interface Approvals {
  readonly approve: (request: ApprovalRequest) => Effect.Effect<unknown, { readonly message: string }>
}
export const approvals = serviceTag<Approvals>("vault-plugins.approval")

/**
 * ASKING FOR ONE, AS A VERB ANOTHER ROW MAY SPEND — the second and last thing
 * this row offers across the wall, and the reason the plugins panel has a
 * **New plugin** door on it.
 *
 * WHY THE PANEL NEEDS ONE AT ALL. A person who wants a plugin looks where
 * plugins are: the health dot, then **Plugins**. That panel is the inspector's
 * — it lists what this serve is running, built rows and vault folders alike —
 * and until now it was the one place in the app that showed you every plugin
 * you have and no way to ask for another. The sidebar's section is the other
 * door and is not enough on its own: a reader who has collapsed the column, or
 * is on a phone with the drawer shut, is in the panel.
 *
 * WHY A SERVICE RATHER THAN AN IMPORT. The verb is a press on a palette this
 * row holds for its own faces (`./browser/doors.ts`), and the inspector may
 * not hold another row's live state — that is the whole argument {@link
 * Approvals} makes one paragraph up. So the gesture crosses as a declared key
 * on a component of its own at each end: this row offers it only while a
 * palette is there to open, the inspector declares it on a component of its
 * own, and the panel draws the door only while something is holding it. With
 * `vault-plugins` off, with navigation off, or with the renderer gone, the
 * door is simply absent and the panel is otherwise unchanged.
 */
export interface NewPlugin {
  /** Open the palette at *New plugin*. Nothing comes back: what a person is
   *  owed is the box, and where they go from there is the palette's own two
   *  levels. */
  readonly open: () => void
}
export const newPlugin = serviceTag<NewPlugin>("vault-plugins.new-plugin")
