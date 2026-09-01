/**
 * KOLU'S FACE — the mark over a sentence kolu put into somebody's conversation,
 * and it is kolu's OWN LOGO rather than olai's drawing of one.
 *
 * The doorbell writes into a person's chat lane (`@olai/plugin-api`'s `Deliveries`),
 * and the panel draws such a row as a speaker in its own right — a third one,
 * beside the person and the agent. Every speaker there is named by a mark, and
 * this file is where kolu's comes from, because core is not allowed to know it:
 * `@olai/plugin-api`'s `fence.test.ts` holds "no general package spells a plugin's
 * name" as an equality per package, so a `MARKS = { kolu: … }` in the panel is
 * red on the day it is written rather than a shortcut somebody tidies later.
 *
 * ## Why a mark at all, when the row already carries a byline
 *
 * The byline is kolu's own OPENING SENTENCE, lifted out of the delivered body
 * (`@olai/web`'s `chat/byline.ts`) — prose, authored per delivery, and the only
 * attribution that survives a replay. A mark is the other half of that: the
 * question "who is talking" is one a reader answers by LOOKING, several times a
 * conversation, and a line of mono prose is not something anybody looks at. The
 * two say the same thing at two speeds, which is what a transcript wants.
 *
 * ## The three steps, and where the bytes come from
 *
 * `packages/client/favicon.svg` in juspay/kolu: three bold rounded bars in a
 * rainbow, stacked and lifted off the page by a drop shadow. It arrives through
 * the NPINS KOLU PIN — the same `npins/sources.json` revision every `@kolu/*`
 * source in this tree comes from — read by {@link ../../default.nix}, turned
 * into a TypeScript module by {@link ../mark/inline.ts}, and copied beside this
 * file by `just install` (the packaged build regenerates it inside its own
 * sandbox). So bumping the pin IS updating the logo, and there is no second
 * original of it anywhere in olai.
 *
 * DRAWN HERE, in a few SVG shapes, with no network and no sprite sheet — the
 * bargain `@olai/web`'s `chat/AgentMark.tsx` argues for the agents' marks, kept
 * word for word: a face fetched from a CDN is a face a panel can be short of,
 * and a transcript that sometimes has no mark is worse than one that never
 * does. That claim survives the change intact, and it is the whole reason the
 * bytes take the long way round through a derivation: `MARK_BODY` is a string
 * constant in the hashed entry chunk, so the mark has no request to make, no
 * 404 to fall through, and draws with the network gone.
 *
 * ## The nested viewport, and the two attributes it does not touch
 *
 * Core owns the `<svg viewBox="0 0 16 16">` and the size class, because those
 * are facts about the COLUMN a mark is read in rather than about the tenant
 * ({@link @olai/plugin-api}' `PluginMark`). kolu's asset has a coordinate system of
 * its own (`70 108 372 340`), so the `<g>` this returns opens a nested viewport:
 * `width="100%"`/`height="100%"` resolve against whatever viewport core
 * established — this file still never spells `16` — and
 * `preserveAspectRatio="xMidYMid meet"` centres and fits the artwork without
 * distorting it. The plugin gets its own coordinates; it does not get the box
 * or the weight.
 *
 * ## It carries kolu's palette, and therefore does not follow the line's ink
 *
 * `currentColor` is the rule for a DRAWN mark and this one is not drawn: the
 * gradients ARE the logo, so it does not dim with a muted row, does not invert
 * with the theme, and carries a `#020617`/0.28 drop shadow tuned for a light
 * favicon. That is the honest cost of the mark being genuinely kolu's, and it
 * is the plugin's to state because the plugin is the only place that knows the
 * asset has a palette at all.
 *
 * ## The ids are made unique per instance, here
 *
 * SVG ids are global to the DOM DOCUMENT and `url(#…)` resolves against it, so
 * an asset shipping `id="lift"` has claimed that word from every other element
 * on the page — and this mark is drawn once per rung row. The build pass
 * rewrites every id to carry {@link ../mark/inline.ts}'s `MARK_TOKEN`, which
 * makes the SHIPPED constant safe at rest; `createUniqueId()` below swaps that
 * token for a document-unique prefix, which makes each INSTANCE safe in the
 * page. A static prefix (`kolu-lift`) was weighed and refused: two rows would
 * still be two identical ids, and "invalid DOM that happens to render right" is
 * not a thing to write down on purpose when one line buys the real property.
 * Core cannot do this namespacing, because core computing an address out of a
 * plugin's name is exactly what the fence exists to refuse.
 *
 * ## On `innerHTML`
 *
 * The string is a build-time constant out of a content-addressed Nix store
 * path — never network, never vault, never anything a person typed — and
 * {@link ../mark/inline.ts} refuses `<script>`, `<style>`, `<foreignObject>`,
 * inline `on*=` handlers and any off-document `href` at build time, failing the
 * derivation by name. That is a stronger warrant than the three `innerHTML`
 * sites in `@olai/web`'s `markdown/`, which sanitise text a person wrote.
 *
 * IT USED TO BE A HAND-DRAWN GLYPH — two abstract panes with a prompt chevron,
 * in `currentColor`, invented in this repository because inventing one was easy
 * and because a fetched face is a face a panel can be short of. The second half
 * of that was right and is kept; the first half was the defect. It was not
 * kolu's mark, so a reader who learned "the panes mean kolu" had learned
 * something that was true of nothing outside this tab, and it could not follow
 * kolu's own mark when kolu redrew it. The pin is what makes "never fetched"
 * and "really theirs" the same answer instead of opposed ones.
 */

import { createUniqueId, type JSX } from "solid-js"

import { MARK_BODY, MARK_TOKEN, MARK_VIEWBOX } from "./mark.generated.ts"

export const KoluMark = (): JSX.Element => {
  const uid = createUniqueId()
  return (
    <g>
      <svg
        x="0"
        y="0"
        width="100%"
        height="100%"
        viewBox={MARK_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        innerHTML={MARK_BODY.replaceAll(MARK_TOKEN, `${uid}-`)}
      />
    </g>
  )
}
