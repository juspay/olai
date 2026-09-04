/**
 * BINDING A BUILT MODULE'S IMPORTS TO THE HOST'S OWN COPIES — the rewrite that
 * makes a chunk built at runtime share one Solid and one Effect with the app it
 * draws inside.
 *
 * ## What it does, in one line
 *
 * `import { createSignal } from "solid-js"` becomes
 * `const { createSignal } = globalThis.__olai_plugin_modules["solid-js"]`.
 *
 * ## Why not the two obvious things
 *
 * BUNDLING the dependency in gives a second copy of it — a second reactive
 * runtime whose components cannot read the app's contexts, and a second set of
 * Effect service tags that resolve against a table nobody provided.
 * `./shared.ts` argues that in full.
 *
 * Leaving the import EXTERNAL leaves the bare specifier in the output, and
 * nothing resolves it: a browser fetching `solid-js` gets a 404 from olai's own
 * shell route, and a `data:` URL module in the serve resolves against the data
 * URL, which has no package tree above it.
 *
 * So the specifier is never resolved anywhere. It is replaced by a read of a
 * table the host filled from its OWN static imports, which is the only
 * arrangement in which "the same copy" is true by construction rather than by
 * two builds agreeing.
 *
 * ## The rewrite is on the EMIT, and that is deliberate
 *
 * Type-only imports are gone by then (`import type { Accessor } from "solid-js"`
 * would otherwise become a destructure of a name that does not exist at
 * runtime), and the transform's own imports are present (`solid-js/web`, which
 * the author never wrote and must still be bound). Both facts are only true
 * after the compiler has run.
 *
 * ## THE POST-CONDITION IS THE REAL GUARANTEE
 *
 * A reader of emitted JavaScript that is not a parser is a reader that can be
 * wrong, and the failure it can have is silent: a form it does not understand
 * survives as a real `import` in a module that is about to be evaluated, and the
 * plugin dies on a resolution error naming a package the author was told they
 * could use. So {@link bind} does not trust its own reading — it asserts
 * afterwards that no module syntax is LEFT, and refuses in words naming the line
 * if any is. A shape this does not handle is then a refusal at define time
 * rather than a mystery at mount time, which is also what lets {@link
 * statementAt} answer `null` for anything unfamiliar rather than guess.
 */

import { REGISTRY } from "./shared.ts"

/**
 * A MODULE'S TEXT, or the sentence that says why there is none — the one shape
 * every step of this package answers with.
 *
 * It was two identical declarations, `Bound` here and `Built` in `./build.ts`,
 * one per step. Two names for one concept is only worth having when the two rev
 * on different clocks, and these cannot: what a caller does with either is the
 * same two things, and a field added to one would be a field the other needed on
 * the same afternoon. One name, and the door's vocabulary is one word shorter.
 */
export type Made =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly why: string }

/**
 * BIND `text`'s IMPORTS against the host registry.
 *
 * `allowed` is what this half's host actually holds (`./shared.ts`'s two
 * lists). A specifier outside it is refused HERE as well as at the gate, and the
 * doubling is not redundant: `./imports.ts` reads the AUTHOR's source and this
 * reads the COMPILER's output, so a transform that started emitting an import of
 * its own — a Solid version reaching for a helper package, say — is caught by
 * this one and by nothing else.
 */
export const bind = (text: string, allowed: ReadonlyArray<string>): Made => {
  let bound = ""
  let read = 0
  KEYWORD.lastIndex = 0
  for (let hit = KEYWORD.exec(text); hit !== null; hit = KEYWORD.exec(text)) {
    const one = statementAt(text, hit.index + hit[0].length)
    // NOT AN IMPORT STATEMENT'S SHAPE, so it is left exactly where it is and
    // {@link leftover} decides about it. Every arm that answers `null` is one
    // this cannot bind, and binding half of something is the failure the
    // post-condition exists to make impossible.
    if (one === null) continue
    if (!allowed.includes(one.spec)) {
      return {
        ok: false,
        why: `the built module imports "${one.spec}", which this serve does not hold. `
          + `A plugin mounted from a vault reaches only the modules olai binds for it.`,
      }
    }
    const ref = `globalThis[${JSON.stringify(REGISTRY)}][${JSON.stringify(one.spec)}]`
    // The LEAD is the newline the statement sits after, kept so the emitted
    // declarations start on their own line; the indent before `import` goes
    // with the statement it belonged to.
    bound += text.slice(read, hit.index + (hit[1] ?? "").length)
    bound += one.clause === null ? "" : bindings(one.clause, ref)
    read = one.end
    KEYWORD.lastIndex = one.end
  }
  bound += text.slice(read)
  const left = leftover(bound)
  if (left !== null) {
    return {
      ok: false,
      why: `olai could not bind this plugin's imports: the compiled module still holds `
        + `\`${left}\`. Write each import as one plain statement at the top of the file.`,
    }
  }
  return { ok: true, text: bound }
}

/**
 * ONE STATEMENT'S CLAUSE, as the declarations that replace it.
 *
 * The three forms an ES import has, and the two ways they combine. A DEFAULT
 * import reads `.default` off the namespace, which is the honest translation and
 * is `undefined` for all four modules olai binds — none of them has a default
 * export, so the only way to write one is to be wrong, and being wrong reads as
 * `undefined` rather than as a lie.
 *
 * `as` becomes `:` because a named import's rename and an object pattern's
 * rename are the same act spelled two ways. A `type` specifier that somehow
 * survived the emit is dropped rather than destructured.
 */
const bindings = (clause: string, ref: string): string => {
  const said: Array<string> = []
  const namespace = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause)
  if (namespace !== null) said.push(`const ${namespace[1]} = ${ref};`)
  const named = braced(clause)
  if (named !== null) {
    const fields = named.split(",")
      .map((one) => one.trim())
      .filter((one) => one !== "" && !one.startsWith("type "))
      .map((one) => one.replace(/\s+as\s+/, ": "))
    if (fields.length > 0) said.push(`const { ${fields.join(", ")} } = ${ref};`)
  }
  // WHAT IS LEFT once the two bracketed forms are cut out is the default
  // binding, or nothing. Cutting rather than parsing around them is what keeps
  // `d, { a }` and `d, * as ns` one case.
  const rest = without(clause).replace(/\*\s+as\s+[A-Za-z_$][\w$]*/, "")
  const dflt = /([A-Za-z_$][\w$]*)/.exec(rest)
  if (dflt !== null) said.push(`const ${dflt[1]} = ${ref}.default;`)
  return said.join("\n")
}

/**
 * WHAT IS BETWEEN THE BRACES, or `null` — and INDEXED rather than matched.
 *
 * `/\{([\s\S]*)\}/` reads exactly right and is the same trap {@link KEYWORD}'s
 * header describes one shape over: a greedy any-character run that has to
 * backtrack for its closing brace costs the length of the clause per starting
 * brace, so a clause of a hundred thousand `{` and no `}` is quadratic. The
 * clause is compiled output of somebody's own source, so that is a real input
 * rather than a hypothetical one. Two string searches answer the same question
 * in one pass each.
 *
 * The LAST brace, as the greedy match took: a clause has one braced group and
 * an inner brace would be a shape neither this nor the regular expression could
 * have handled.
 */
const braced = (clause: string): string | null => {
  const open = clause.indexOf("{")
  const close = clause.lastIndexOf("}")
  return open === -1 || close < open ? null : clause.slice(open + 1, close)
}

/** ...and the same cut, taken OUT — what is left of a clause once its braced
 *  group is gone. */
const without = (clause: string): string => {
  const open = clause.indexOf("{")
  const close = clause.lastIndexOf("}")
  return open === -1 || close < open ? clause : clause.slice(0, open) + clause.slice(close + 1)
}

/**
 * WHERE A STATEMENT MIGHT START — the `import` keyword at the head of a line,
 * and nothing else about it.
 *
 * ## Why the whole statement is not one regular expression
 *
 * It was: `/(^|\n)[ \t]*import\s+(?:([^;'"]*?)\s+from\s*)?(['"])([^'"]+)\3…/`.
 * That has a `\s+` sitting immediately in front of a lazy class that ALSO
 * admits whitespace, which is the classic ambiguity — for `import` followed by
 * a long run of spaces and no `from`, the engine tries every split of the run
 * and the match costs the square of its length. CodeQL's `js/polynomial-redos`
 * named it on the pull request, and it named something real: the text here is
 * the compiled form of source somebody wrote into a vault, so the input is a
 * person's (or an agent's) and a definition ending in a hundred thousand spaces
 * would hang the build rather than be refused by it.
 *
 * So the KEYWORD is found by a regular expression that cannot backtrack — a
 * newline, an indent of tabs and spaces, then a literal, each disjoint from its
 * neighbour — and the rest of the statement is read forward once, character by
 * character ({@link statementAt}). Every scan below is linear and stops at the
 * first thing that cannot be part of an import.
 *
 * `(?![\w$])` is what keeps `important` from being a keyword.
 */
const KEYWORD = /(^|\n)[ \t]*import(?![\w$])/g

/** One statement, read: what to bind, and where it ends. */
interface Read {
  /** The clause between `import` and `from`, or `null` for a bare import. */
  readonly clause: string | null
  /** The specifier, without its quotes. */
  readonly spec: string
  /** Just past the statement, including its semicolon if it had one. */
  readonly end: number
}

/**
 * READ ONE STATEMENT FORWARD from just after the `import` keyword, or answer
 * `null` for anything that is not one.
 *
 * `null` is the SAFE direction and is the whole reason this may be as simple as
 * it is: a shape this does not understand is left in the text exactly as it
 * was, and {@link leftover} refuses the build naming the line. Nothing here can
 * bind half a statement.
 */
const statementAt = (text: string, from: number): Read | null => {
  const at = spaceAfter(text, from)
  const opener = text.charAt(at)
  if (opener === `"` || opener === `'`) {
    const spec = literalAt(text, at)
    return spec === null ? null : { clause: null, spec: spec.value, end: endAfter(text, spec.end) }
  }
  // A CLAUSE, which reaches as far as the specifier's opening quote and no
  // further: a clause holds no quote and no semicolon, so the first of either
  // is where it stops. Braces may wrap over lines, which babel's output does.
  const quote = quoteAfter(text, at)
  if (quote === null) return null
  const head = text.slice(at, quote).trimEnd()
  if (!head.endsWith(FROM)) return null
  const spec = literalAt(text, quote)
  if (spec === null) return null
  return {
    clause: head.slice(0, head.length - FROM.length),
    spec: spec.value,
    end: endAfter(text, spec.end),
  }
}

/** The keyword that ends a clause. */
const FROM = "from"

/** Past the whitespace at `from`. */
const spaceAfter = (text: string, from: number): number => {
  let at = from
  while (at < text.length && WHITESPACE.includes(text.charAt(at))) at += 1
  return at
}

/** ...and past a statement's own trailing spaces and semicolon. */
const endAfter = (text: string, from: number): number => {
  let at = from
  while (at < text.length && SPACE.includes(text.charAt(at))) at += 1
  return text.charAt(at) === ";" ? at + 1 : from
}

/** Where the specifier's opening quote is, or `null` — stopping at the first
 *  semicolon, because a clause has none and a statement that reached one is not
 *  the shape this reads. */
const quoteAfter = (text: string, from: number): number | null => {
  for (let at = from; at < text.length; at += 1) {
    const one = text.charAt(at)
    if (one === `"` || one === `'`) return at
    if (one === ";") return null
  }
  return null
}

/** The string literal at `from`, whose content admits NEITHER quote — the same
 *  narrowness the regular expression this replaced had, and enough for a module
 *  specifier, which cannot contain one. */
const literalAt = (
  text: string,
  from: number,
): { readonly value: string; readonly end: number } | null => {
  const opener = text.charAt(from)
  for (let at = from + 1; at < text.length; at += 1) {
    const one = text.charAt(at)
    if (one !== `"` && one !== `'`) continue
    return one === opener && at > from + 1 ? { value: text.slice(from + 1, at), end: at + 1 } : null
  }
  return null
}

const WHITESPACE = " \t\r\n"
const SPACE = " \t"

/**
 * ANYTHING MODULE-SHAPED THAT SURVIVED THE BIND — an import, a bare import or a
 * re-export — as the line it is on, or `null`.
 *
 * PER LINE and with no regular expression over the whole text, for
 * {@link KEYWORD}'s reason: the `m`-anchored one this replaced held the same
 * `\s+` in front of a whitespace-admitting lazy class, one statement kind over.
 *
 * A RE-EXPORT is `export` … `from` … a quote, with NO quote and no semicolon in
 * between — which is what keeps `export const said = "from over there"` from
 * being read as one. That narrowness is the previous expression's, kept.
 */
const leftover = (text: string): string | null => {
  for (const line of text.split("\n")) {
    const one = line.trim()
    if (one.startsWith("import") && !WORDISH.test(one.charAt("import".length))) return one
    if (!one.startsWith("export")) continue
    const cut = one.search(/["';]/)
    if (cut === -1 || one.charAt(cut) === ";") continue
    if (ENDS_IN_FROM.test(one.slice(0, cut))) return one
  }
  return null
}

/** What may follow `import` and leave it an identifier rather than the
 *  keyword — an empty string is a line that is only `import`, which is not one. */
const WORDISH = /[\w$]/

/** ...and a re-export's head, which is a clause ending in `from`. Anchored at
 *  both ends of a slice that is already cut at the quote, so there is nothing
 *  for it to search. */
const ENDS_IN_FROM = /\bfrom[ \t]*$/
