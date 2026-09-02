/**
 * SPACES' OWN SURFACE — one cell, and one cell is a whole surface.
 *
 * The cell is the LINK: whether this serve can post to Spaces, in three states
 * rather than a boolean, because *no env* and *env present but refused* have
 * opposite fixes. Composed under this plugin's name it reads
 * `surface/xyne-spaces/link/get`.
 *
 * ## THIS ENTRY'S OWN FENCE
 *
 * The composed group is on the static graph of everything that reads the
 * surface, so this module may import the framework, `effect` and its own wire
 * slice and nothing else — no `solid-js`, no `node:` builtin, no `@olai/format`.
 * `@olai/plugin-api`'s `fence.test.ts` walks the door this module is reached
 * through.
 */

import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"

/** The sibling key, the preferences row, the docs slug, and the word
 *  `--plugins` takes. Spelled once, here. Hyphenated on purpose: the docs
 *  address is `docs/plugins/xyne-spaces.md`, and the name IS that address. */
export const name = "xyne-spaces"

/** Off unless `--plugins` names it. A Spaces app JWT is a secret this
 *  machine may not have, and a pill in every bar for an integration
 *  nobody pointed at is the wrong default. */
export const defaultOn = false

/**
 * WHETHER THERE IS A SPACES APP to post as, and it is three states rather than
 * a boolean — kolu's link cell, with the nouns changed.
 *
 *   - `connected` — `$OLAI_SPACES_URL` and `$OLAI_SPACES_TOKEN` are set, and
 *     the last post (if any) was accepted.
 *   - `absent` — no env, and no bind. The ORDINARY state on a machine that
 *     has not been pointed at Spaces, which is why it is not an error: a
 *     vault opens, every page draws, and the pill says `no xyne`.
 *   - `fault` — something the user asked for is not working, and the tip
 *     names which: a post was refused, OR a node agent has `xyne-channel`
 *     and the env is missing. Distinct from `absent` on purpose — a
 *     property is the user naming a channel, and a dim pill would hide that.
 */
export const SpacesStatus = Schema.Literals(["connected", "absent", "fault"])
export type SpacesStatus = typeof SpacesStatus.Type

export const SpacesLink = Schema.Struct({
  status: SpacesStatus,
  /**
   * Where olai looked — the origin `$OLAI_SPACES_URL` named, or the names of
   * the two env vars when neither is set. Always present, on every arm,
   * because "nothing is there" is only actionable when a reader knows where
   * olai looked.
   */
  where: Schema.String,
  /** Whether the origin was TOLD (`$OLAI_SPACES_URL` set). */
  told: Schema.Boolean,
  /**
   * The last refusal, whole, or `null` off the `fault` arm. The pill's tip
   * carries this so a 401 and a missing channel are two different sentences.
   */
  why: Schema.NullOr(Schema.String),
  /** When this reading was taken, ISO. Moves when the STATUS moves. */
  since: Schema.String,
})
export type SpacesLink = typeof SpacesLink.Type

/** The seed: a server that has not looked has not found Spaces absent — it
 *  has not looked yet. Spelled `absent` anyway, for kolu's `KOLU_UNDIALED`
 *  reason: a fourth `unknown` arm would reach every renderer for a boot
 *  window measured in milliseconds. */
export const SPACES_UNDIALED: SpacesLink = {
  status: "absent",
  where: "OLAI_SPACES_URL, OLAI_SPACES_TOKEN",
  told: false,
  why: null,
  since: "",
}

export const sameLink: (a: SpacesLink, b: SpacesLink) => boolean = Schema.toEquivalence(SpacesLink)

export const surface = defineSurface({
  cells: {
    link: {
      schema: SpacesLink,
      default: SPACES_UNDIALED,
      verbs: ["get"],
      equals: sameLink,
    },
  },
})

/**
 * THE BROWSER'S ALONE. This cell is a READING of whether the serve can post,
 * and an agent that wants Spaces has the installed app's own face. Re-serving
 * the link through olai would be a second door onto somebody else's chat with
 * olai's credentials on it.
 */
export const faces = {
  browser: {
    link: "resource",
  },
} as const
