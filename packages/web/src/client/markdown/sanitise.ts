/**
 * What may reach `innerHTML` — the allowlist, and the whole of what this app
 * has ever added to it.
 *
 * The files this pipeline renders are written by people, by agents and by git
 * merges, so the sanitiser is the security boundary and this is where it is
 * decided. Its own module, rather than a literal in ./render.ts or a
 * by-the-way export from the feature that last needed something: a boundary
 * with one file has one diff to review, and a feature that widens it has to
 * come here to do it.
 *
 * ## The rule
 *
 * NAMED ADDITIONS ONLY. Every entry below says which tag, which attribute and
 * — where the default schema restricts values — which VALUE. Nothing is added
 * by spreading a wider default over a narrower one, and no attribute is opened
 * to "whatever the caller writes".
 *
 * There are exactly two additions today, and each is a single VALUE:
 *
 *   - **`className` on an `a`, restricted to {@link ANCHOR_CLASS}.** The link a
 *     heading carries to itself (./anchors.ts) has to be styled and has to be
 *     findable. The default allows `className` on an `a` for the single value
 *     `data-footnote-backref`; this adds a second value to that same entry, so
 *     an `a` written into somebody's note still cannot carry a class of its
 *     own choosing.
 *   - **`message:` on an `href`, and on no other attribute.** The default
 *     allows `http`, `https`, `irc`, `ircs`, `mailto` and `xmpp` there, so a
 *     `message://<Message-Id>` link — Mail.app's own address for one message —
 *     was STRIPPED, silently, leaving the text of a note with the pointer gone
 *     out of it. That is the whole of what quick capture holds for a captured
 *     mail (docs/running.md): the message stays in Mail and olai keeps the link
 *     to it, so a scheme this app cannot spell is a feature that does not work.
 *     One protocol on one attribute: `src` is untouched (nothing may LOAD a
 *     `message:`, and a `message:` in an `<img>` is not a picture), and so are
 *     `cite` and `longDesc`.
 *
 *     WHAT ADMITTING A SCHEME COSTS is worth being explicit about, because
 *     "which protocols may an href name" is the one line in this file a reader
 *     should be suspicious of. It is what a CLICK may hand to the OS: a
 *     `message:` opens the reader's mail client at a message, which is exactly
 *     the affordance being bought, and nothing about it is fetched, executed or
 *     read by this app — the router leaves every non-`/` href to the browser
 *     (../routes.ts's `routeIn`, pinned by its own test), and the browser hands
 *     an unknown scheme to the OS. `javascript:` and `data:` are the schemes
 *     that would be a different conversation, and neither is here.
 *
 * Two things the anchors need and did NOT need admitting, listed because
 * "we had to widen the schema" is a sentence that ends in a blanket
 * `className`: `id` on a heading is already in the default's `'*'` list (it is
 * how GFM's footnote ids have always reached the page), and `href="#…"` on an
 * `a` is already allowed — a fragment has nowhere to climb to.
 *
 * ## Two mechanics worth knowing before editing this
 *
 * An addition EDITS the default's own entry rather than appending a second
 * one. `hast-util-sanitize` resolves an attribute against the FIRST entry
 * naming it, so a second `["className", …]` after the default's would never be
 * consulted — the class stripped, the feature half-working, the styling
 * silently gone, and nothing to say so.
 *
 * And clobbering is OFF. Every id on the page is minted by ./rewrite.ts
 * against the block it is in, which is a stronger rule than a shared prefix:
 * it separates two notes on one page from each other, where a prefix only
 * separates all of them from the app.
 *
 * ./sanitise.test.ts holds the whole schema to this, and it does so against
 * the DEFAULT rather than a copy of it — so an upstream bump that reshapes the
 * allowlist underneath us is red here rather than a quiet widening.
 */

import { defaultSchema } from "rehype-sanitize"
import type { Options as SanitiseSchema } from "rehype-sanitize"

import { ANCHOR_CLASS } from "./anchors.ts"

/** One entry of an attribute allowlist: a bare name, or a name followed by the
 *  values it may take. Spelled from the schema rather than imported, because
 *  `hast-util-sanitize` is `rehype-sanitize`'s dependency and not ours to
 *  declare (bunfig.toml: the isolated linker nests it out of sight). */
type Definition = NonNullable<SanitiseSchema["attributes"]>[string][number]

/** A tag's allowlist with one more class VALUE admitted — see the note above
 *  for why it edits the existing entry rather than adding one, and
 *  ./sanitise.test.ts for what happens if there is no entry to edit. */
const admittingClass = (tag: string, value: string): Definition[] =>
  [...(defaultSchema.attributes?.[tag] ?? [])].map((entry) =>
    Array.isArray(entry) && entry[0] === "className" ? [...entry, value] : entry
  )

/** The scheme a captured mail's pointer is written in — Mail.app's own address
 *  for one message, which is what quick capture holds instead of a copy of the
 *  mail (docs/running.md). Named here because this is the file that decides
 *  whether it survives the sanitiser. */
export const MESSAGE_PROTOCOL = "message"

/** One attribute's protocol list with one more scheme admitted, built from the
 *  default's own — so a scheme the default drops is dropped here too, and an
 *  upstream that stops restricting the attribute at all is a `[]` this app
 *  would notice rather than a silently wider allowlist. ./sanitise.test.ts
 *  holds it against the default for exactly that. */
const admittingProtocol = (attribute: string, scheme: string): string[] =>
  [...(defaultSchema.protocols?.[attribute] ?? []), scheme]

/** The allowlist the pipeline sanitises against. */
export const SANITISE: SanitiseSchema = {
  ...defaultSchema,
  clobberPrefix: "",
  attributes: { ...defaultSchema.attributes, a: admittingClass("a", ANCHOR_CLASS) },
  protocols: {
    ...defaultSchema.protocols,
    href: admittingProtocol("href", MESSAGE_PROTOCOL),
  },
}
