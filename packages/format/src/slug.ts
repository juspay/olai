/**
 * WHAT A HEADING IN A BODY IS CALLED.
 *
 * The other half of the address grammar's `[document]#[element]`: a `#` after
 * a `.md` names a heading (`./address.ts` says why the DOCUMENT decides that),
 * and what it names it by is the words of the heading, folded down to
 * something a URL can carry. `## Install the app` is `#install-the-app`.
 *
 * DERIVED, NOT STORED, and that is the round's ruling rather than an
 * implementation detail: a `.md` has nowhere to write an id, so the words are
 * the identity — and rewording a heading breaks the address that named it. The
 * later evolution is an opt-in explicit `## Install {#setup}`, which is named
 * in the design (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/first-class-documents.md) and not designed
 * here.
 *
 * ## Why the rule is not in the renderer
 *
 * Two things have to agree about a slug and they run in different processes.
 * The FACE says which headings a document has ({@link ./document.ts}), so a
 * backlink onto `README.md#install` can be checked and a page can say what it
 * points at; the BROWSER puts the id on the `<h2>` it draws, so the address
 * lands somewhere. Both ask one reading of the body (`@olai/prose`'s
 * `read.ts`), which makes each heading's slug once with `slugOf` — so a slug
 * is never spelled twice, and every heading the page draws is one the face
 * lists.
 */

import type { Slug } from "@olai/prose/slug.ts"
import { proseIn } from "@olai/prose/frontmatter.ts"
import { read } from "@olai/prose/read.ts"

/**
 * The slugs of a whole body, in document order and never repeated — the list
 * the face carries, and the ids the page draws: both are `read`'s, numbered
 * once there. A heading that slugs to nothing is not an element this document
 * has.
 */
export const slugsIn = (body: string): ReadonlyArray<Slug> =>
  read(proseIn(body)).headings.flatMap((heading) => heading.slug === null ? [] : [heading.slug])
