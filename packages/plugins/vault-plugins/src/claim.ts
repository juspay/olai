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
 * each of them in the sidebar's file tree would be the app's own plumbing filling
 * up a column whose job is the reader's files. They are in the set, in the
 * ledger, in the Commit panel and at an address — they are simply not listed
 * there.
 *
 * ## `kept: true`, which is what puts the source in the revision
 *
 * A kept text claim's body TRAVELS: it is published with the revision, `doc`
 * writes it, `delete` removes it, the Commit panel lists it, and the roster
 * can carry the source a person is being asked to approve without a second
 * fetch per plugin. An unkept claim would hand back a path and nothing else,
 * which is exactly the position the old node-shaped definition was invented to
 * escape.
 *
 * ## ...and `opaque: true`, because a half is code and not prose
 *
 * `kept` was carrying a second fact it never meant. To `@olai/format` a kept
 * text document used to BE markdown — so a half arrived with
 * `title: "import { definePlugin, Slots } from \"@olai/plugin-api\""`, with
 * `#rrggbb` and `#todo` read out of a sentence about colours and a comment as
 * TAGS of this vault, with its `[…](…)`s read as links and a leading `---` as
 * frontmatter. Two documents per plugin then stood in every list the reading
 * feeds: the tag vocabulary, the search index, `markdown_index`, the palette's
 * document rows, the near miss offered when an agent mistypes a path, and the
 * set of files a declared `doc` property may point at.
 *
 * None of that is a fact about the plugin; all of it is TypeScript being read
 * as if somebody had written it to be read. So the claim says which of the two
 * things `kept` meant it means ({@link @olai/format}'s `Claim.opaque`): the
 * body travels, and nothing reads it. A half is still in the set, still
 * written through the ordinary gate by `vault-plugins_write`, still committed,
 * still addressable at `/plugins/<word>/server.ts`, and still drawn in full on
 * the page where a person decides whether to run it. What it is not is a
 * document in a list of this vault's writing.
 *
 * The two flags are the same shape of decision and are deliberately separate:
 * `elsewhere` is about where a file is REACHED FROM, and this is about whether
 * its text is READ. A row added tomorrow that writes prose in a folder of its
 * own wants the first and not the second.
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
  opaque: true,
}
