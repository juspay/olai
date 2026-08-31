/**
 * SOMEBODY ELSE'S BRAND ASSET, READ AS INPUT — the code review of kolu's mark
 * that a pin bump would otherwise never force.
 *
 * kolu's logo is `packages/client/favicon.svg` in juspay/kolu, and it reaches
 * this plugin through the npins kolu pin — the same pinned source every
 * `@kolu/*` module comes from — never as a copy pasted into this tree and never
 * as a fetch from a running page. `../../default.nix` realises it, runs
 * `./emit.ts` over it with the pinned bun, and writes the module
 * `src/browser/mark.generated.ts` that {@link ../browser/Mark.tsx} draws. This
 * file is the whole of the transform in between, and it is a PURE FUNCTION —
 * no IO, no imports — for one reason: it is the only part of that path a test
 * can ask questions of.
 *
 * ## Why a function here rather than sed in the derivation's shell
 *
 * Because the transform is a rewrite over XML, and a rewrite over XML written
 * as a line of `sed` in a builder is a thing nobody can test, nobody can read
 * and nobody notices going wrong: it would emit SOMETHING for every input, and
 * the something would be a half-painted logo in a stranger's transcript. Moving
 * it here costs `nativeBuildInputs = [ pkgs.bun ]`, which every dev shell and
 * the packaged build already carry, and buys {@link ./inline.test.ts} plus a
 * build-time REFUSAL of an asset this plugin would be wrong to inline.
 *
 * ## The two things the input does that a `<g>` in a sixteen-unit box may not
 *
 * kolu's favicon has a `viewBox` of its own (`70 108 372 340`, not core's
 * `0 0 16 16`) and it DECLARES IDS — `topStep`, `middleStep`, `baseStep`,
 * `lift`, `title`, `desc` — which every `url(#…)` in it resolves against. SVG
 * ids are global to the DOM DOCUMENT, not to the element that declares them, so
 * a mark drawn on two rungs of one transcript would put two `lift`s on the page
 * and hand the word `lift` to whatever else on it wanted it. So: the viewBox
 * travels out of here as its own constant, for the nested viewport
 * {@link ../browser/Mark.tsx} opens, and every id — declaration and reference
 * together — is rewritten to carry {@link MARK_TOKEN}, which the browser half
 * swaps for a per-instance id at render.
 *
 * ## Step (g) is why this survives a pin bump rather than merely working today
 *
 * Steps (b)–(f) are a rewrite over the grammar kolu's mark uses NOW. Step (g)
 * re-scans the OUTPUT and asserts the rewrite was total — every id tokenised,
 * none lost, no `#`-reference left untokenised that is not a hex colour, and
 * something still drawn. So a favicon that grows a construct this rewrite does
 * not cover (a `<style>` block keyed on `#topStep`, a `mask` written some other
 * way) fails the BUILD, naming the fragment, rather than shipping a logo
 * painted black. That is `@olai/web`'s `preloadPipeline` instinct — no such
 * chunk means throw, never carry on — pointed at somebody else's artwork.
 *
 * ## Why not sanitise at render instead
 *
 * Because the bytes are known at BUILD time and a check that can run once
 * should. The alternative — ship the asset whole and clean it in the browser —
 * pays the cost on every row drawn, and, worse, has no place to fail: a refusal
 * in a component is a blank glyph, and a blank glyph is exactly the silent
 * empty mark this whole arrangement was chosen to make impossible.
 *
 * IT USED TO be a hand-drawn glyph — two abstract panes and a prompt chevron in
 * `currentColor`, drawn in this repository because drawing one was easy and
 * because a fetched face is a face a panel can be short of. It was the wrong
 * answer to the right worry: it was not kolu's mark, so a reader who learned it
 * learned something false, and it could not follow kolu's own mark anywhere.
 * The pin is what makes "no fetch" and "really theirs" the same answer.
 */

/** The stand-in every id in the emitted body carries, in place of a real
 *  prefix. {@link ../browser/Mark.tsx} replaces it with `createUniqueId()` per
 *  instance, which is what makes two kolu rows on one page legal DOM rather
 *  than merely lucky. Exported so the substitution and the emission cannot
 *  drift apart into two spellings of one string. */
export const MARK_TOKEN = "__MARK__"

/** What a mark id may look like once the asset declares it: an XML-ish name,
 *  narrow on purpose — anything else is a string this rewrite would have to
 *  guess about, and guessing is what step (g) exists to refuse. */
const ID_SHAPE = /^[A-Za-z][A-Za-z0-9_-]*$/

/** An `id` attribute in EITHER quote style — XML admits both, and a grammar
 *  that read only one would leave an id uncollected, unrewritten and invisible
 *  to the re-scan that is supposed to prove the rewrite total. Group 2 is the
 *  value. */
const ID_ATTR = /\sid\s*=\s*(["'])(.*?)\1/g

/** Any attribute, for the reference sweep — group 2 is the value. */
const ANY_ATTR = /\s[A-Za-z_:][\w.:-]*\s*=\s*(["'])(.*?)\1/g

/** The elements that actually PUT INK DOWN. If none of these survives the
 *  rewrite, whatever was emitted is an empty box with a viewBox on it. */
const DRAWS = /<(rect|path|circle|ellipse|polygon|polyline|line|use|g|image|text)\b/

/** A `#`-token left in the output: either a tokenised reference or a hex
 *  colour. Nothing else is a thing this rewrite understands. */
const HEX = /^#[0-9A-Fa-f]{3,8}$/

/** Every failure in this file, spelled one way. A function DECLARATION rather
 *  than a `const`, because only a declaration's `never` return participates in
 *  control-flow narrowing — so a refusal here reads as the dead end it is and
 *  no caller needs an unreachable `throw` after it. */
function refuse(source: string, what: string): never {
  throw new Error(`${source}: ${what}`)
}

/**
 * kolu's favicon, as the two constants the browser half needs.
 *
 * `source` is the path the bytes came from — a `/nix/store/…` path when the
 * derivation runs this — and it prefixes EVERY throw, because the one question
 * a person reading a failed build has is "which file, and where did it come
 * from", and the answer is a store path they can `cat`.
 */
export const inlineMark = (
  svg: string,
  source: string,
): { readonly viewBox: string; readonly body: string } => {
  // (a) The sentinel has to be unambiguous, and an input that already contains
  // it would make the render-time `replaceAll` rewrite bytes that were never a
  // reference.
  if (svg.includes(MARK_TOKEN)) {
    refuse(source, `already contains the sentinel ${MARK_TOKEN}, which this transform needs to be its own`)
  }

  // (b) The root tag is DISCARDED and its viewBox kept. Discarding it is what
  // takes `role="img"` and `aria-labelledby` with it: core draws the element
  // and marks it `aria-hidden`, so an accessible name inside it is dead weight
  // that also claims two of the most collision-prone ids a document has.
  const open = /<svg\b[^>]*>/.exec(svg)
  if (open === null) refuse(source, "has no root <svg> element")
  const openTag = open[0]
  const close = svg.lastIndexOf("</svg>")
  if (close < open.index + openTag.length) {
    refuse(source, "has no closing </svg> for its root element")
  }
  const viewBoxAt = /\sviewBox\s*=\s*"([^"]*)"/.exec(openTag)
  const viewBox = viewBoxAt?.[1] ?? ""
  if (viewBox.trim() === "") {
    refuse(source, "root <svg> has no viewBox — the nested viewport has nothing to fit the artwork into")
  }

  let body = svg.slice(open.index + openTag.length, close)

  // (c) COMMENTS GO FIRST, and before any sweep reads the body. A comment is
  // not markup this draws, and its text is free-form — an upstream note like
  // "see #4312" would otherwise reach step (g)'s reference sweep, which reads
  // a `#` as a claim about an id, and fail the build over prose.
  //
  // ## A FIXPOINT, AND THEN A REFUSAL — because one pass is not a strip
  //
  // Removing a match SPLICES what is on either side of it, and two halves can
  // close up into a delimiter that was not there before: `<!-<!-- -->-` is one
  // match, and taking it leaves `<!--`. A single pass therefore hands the rest
  // of this function a string it has already declared clean, which is the
  // shape CodeQL's `js/incomplete-multi-character-sanitization` names and is
  // right to — what survives here is inlined into somebody's transcript.
  //
  // So: strip until the string stops changing, and then REFUSE if either
  // delimiter is still standing. The refusal is the half that matters. A
  // fixpoint alone would still be a claim about a grammar this does not parse;
  // an asset that carries comment syntax after one is exactly the thing this
  // file already refuses everywhere else ({@link refuse} at step (d)), and it
  // has never been a thing a favicon needs.
  for (let before = ""; before !== body;) {
    before = body
    body = body.replace(/<!--[\s\S]*?-->/g, "")
  }
  if (/<!--|-->/.test(body)) {
    refuse(source, "still carries comment syntax after the comments were taken out")
  }

  // ... and then `<title>`/`<desc>`, outright, before anything looks at ids.
  body = body
    .replace(/<title\b[^>]*\/>/g, "")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, "")
    .replace(/<desc\b[^>]*\/>/g, "")
    .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/g, "")

  // (d) The refusals. Each is a construct this rewrite cannot honour, and each
  // is a construct a favicon has no business carrying into a chat transcript.
  // `<style>` is here for the rewrite's sake rather than for safety's: its
  // selectors reference ids by a grammar step (f) cannot see.
  if (/<script\b/i.test(body)) refuse(source, "contains a <script> element")
  if (/<style\b/i.test(body)) {
    refuse(source, "contains a <style> element, whose selectors reference ids this rewrite cannot see")
  }
  if (/<foreignObject\b/i.test(body)) refuse(source, "contains a <foreignObject> element")
  const handler = /\son[a-z]+\s*=/i.exec(body)
  if (handler !== null) refuse(source, `contains an inline event handler (${handler[0].trim()})`)
  for (const link of body.matchAll(/\s(?:xlink:)?href\s*=\s*(["'])(.*?)\1/g)) {
    const value = link[2] ?? ""
    if (!value.startsWith("#")) {
      refuse(source, `references ${value} outside the document — a mark may only point at its own ids`)
    }
  }

  // (e) Every id the asset declares, and what makes it a usable one.
  const declared = new Set<string>()
  for (const found of body.matchAll(ID_ATTR)) {
    const id = found[2] ?? ""
    if (!ID_SHAPE.test(id)) {
      refuse(source, `declares the id "${id}", which is not a plain XML name this rewrite can prefix`)
    }
    if (declared.has(id)) refuse(source, `declares the id "${id}" twice`)
    declared.add(id)
  }
  const declaredCount = declared.size

  // (f) The rewrite, declarations and references together. A reference to an id
  // nothing declares is a half-painted logo, so it fails the build here.
  body = body.replace(
    /(\sid\s*=\s*)(["'])(.*?)\2/g,
    (_whole: string, before: string, quote: string, id: string) =>
      `${before}${quote}${MARK_TOKEN}${id}${quote}`,
  )
  body = body.replace(
    /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g,
    (_whole: string, quote: string, id: string) => {
      if (!declared.has(id)) {
        refuse(source, `references #${id}, which it does not declare`)
      }
      return `url(${quote}#${MARK_TOKEN}${id}${quote})`
    },
  )
  body = body.replace(
    /(\s(?:xlink:)?href\s*=\s*)(["'])#(.*?)\2/g,
    (_whole: string, before: string, quote: string, id: string) => {
      if (!declared.has(id)) {
        refuse(source, `references #${id}, which it does not declare`)
      }
      return `${before}${quote}#${MARK_TOKEN}${id}${quote}`
    },
  )

  // (g) The re-scan. These four lines are the load-bearing ones: they are asked
  // of the OUTPUT, so they hold across a grammar the steps above never saw.
  for (const found of body.matchAll(ID_ATTR)) {
    const id = found[2] ?? ""
    if (!id.startsWith(MARK_TOKEN)) refuse(source, `left the id "${id}" untokenised`)
  }
  const rewrittenCount = [...body.matchAll(ID_ATTR)].length
  if (rewrittenCount !== declaredCount) {
    refuse(source, `declared ${declaredCount} ids and emitted ${rewrittenCount} — the rewrite lost one`)
  }
  // ... asked of ATTRIBUTE VALUES and not of the whole body: a `#` in text
  // content or in an upstream note is prose, and reading it as a broken
  // reference would fail the build over a sentence.
  for (const token of [...body.matchAll(ANY_ATTR)].flatMap((attr) =>
    [...(attr[2] ?? "").matchAll(/#[^\s"'()<>,;]*/g)]
  )) {
    const text = token[0]
    // The hex carve-out cannot hide a real reference: a declared id is
    // tokenised at step (f) and an undeclared one throws there, so anything
    // reaching here that looks like a colour is one.
    if (text.startsWith(`#${MARK_TOKEN}`) || HEX.test(text)) continue
    refuse(source, `leaves the reference ${text}, which is neither a tokenised id nor a hex colour`)
  }
  if (!DRAWS.test(body)) {
    refuse(source, "has no drawing element left after the rewrite — the mark would be an empty box")
  }

  return { viewBox: viewBox.trim(), body: body.trim() }
}
