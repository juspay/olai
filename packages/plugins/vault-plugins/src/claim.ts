/**
 * `.ts` AND `.tsx`, UNDER `plugins/` AND NOWHERE ELSE — the one claim in this
 * tree that says where it applies, and the whole reason a plugin can be a
 * folder at all.
 *
 * ## Why a scope rather than a suffix
 *
 * Every other claim in olai owns a suffix outright, because every other suffix
 * is olai's: nothing but an outline is a `.olai`, nothing but a document is a
 * `.md`. `.ts` is not like that. A vault is somebody's directory, and plenty of
 * them have a checkout in them — so a bare `.ts` claim would sweep every
 * TypeScript file on the disk into the revision, into the sidebar's Reference
 * tree, and into the memory of a process whose whole budget is the notes it is
 * serving. `Claim.under` is the narrow answer: the two halves of a plugin this
 * vault defines, and no other TypeScript in the directory.
 *
 * ## ...and `elsewhere`, because the plugin has a better door
 *
 * The halves are read on the plugin's own page, under the README that says
 * what the thing does, beside the button that turns it on. A second row for
 * each of them in the Reference tree would be the app's own plumbing filling
 * up a column whose job is the reader's files. They are in the set, in the
 * ledger, in the Commit panel and at an address — they are simply not listed
 * there.
 *
 * ## `kept: true`, which is what puts the source in the revision
 *
 * A kept text claim is a DOCUMENT to every reader in the tree: its body
 * travels on the revision, `doc` writes it, `delete` removes it, and the
 * roster can carry the source a person is being asked to approve without a
 * second fetch per plugin. An unkept claim would hand back a path and nothing
 * else, which is exactly the position the old node-shaped definition was
 * invented to escape.
 */
import type { FileClaim } from "@olai/plugin-api/services"
import { PLUGIN_FOLDER } from "@olai/surface"

export const claim: FileClaim = {
  exts: [".ts", ".tsx"],
  holds: "text",
  kept: true,
  fetched: false,
  noun: "plugin half",
  article: "a",
  under: PLUGIN_FOLDER,
  elsewhere: true,
}
