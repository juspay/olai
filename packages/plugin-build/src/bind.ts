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
 * A regex over emitted JavaScript is a regex over emitted JavaScript, and the
 * failure it can have is silent: a form it does not match survives as a real
 * `import` in a module that is about to be evaluated, and the plugin dies on a
 * resolution error naming a package the author was told they could use. So
 * {@link bind} does not trust its own match — it asserts afterwards that no
 * module syntax is LEFT, and refuses in words naming the line if any is. A shape
 * this does not handle is then a refusal at define time rather than a mystery at
 * mount time.
 */

import { REGISTRY } from "./shared.ts"

/** A module's text with every import bound — or the sentence that says why it
 *  could not be. */
export type Bound =
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
export const bind = (text: string, allowed: ReadonlyArray<string>): Bound => {
  let refusal: string | null = null
  const bound = text.replace(
    IMPORT,
    (whole: string, lead: string, clause: string | undefined, _quote: string, spec: string) => {
      if (!allowed.includes(spec)) {
        refusal ??= `the built module imports "${spec}", which this serve does not hold. `
          + `A plugin mounted from a vault reaches only the modules olai binds for it.`
        return whole
      }
      const ref = `globalThis[${JSON.stringify(REGISTRY)}][${JSON.stringify(spec)}]`
      return `${lead}${clause === undefined ? "" : bindings(clause, ref)}`
    },
  )
  if (refusal !== null) return { ok: false, why: refusal }
  const left = LEFTOVER.exec(bound)
  if (left !== null) {
    return {
      ok: false,
      why: `olai could not bind this plugin's imports: the compiled module still holds `
        + `\`${left[0].trim()}\`. Write each import as one plain statement at the top of the file.`,
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
  const named = /\{([\s\S]*)\}/.exec(clause)
  if (named !== null) {
    const fields = (named[1] ?? "").split(",")
      .map((one) => one.trim())
      .filter((one) => one !== "" && !one.startsWith("type "))
      .map((one) => one.replace(/\s+as\s+/, ": "))
    if (fields.length > 0) said.push(`const { ${fields.join(", ")} } = ${ref};`)
  }
  // WHAT IS LEFT once the two bracketed forms are cut out is the default
  // binding, or nothing. Cutting rather than parsing around them is what keeps
  // `d, { a }` and `d, * as ns` one case.
  const rest = clause.replace(/\{[\s\S]*\}/, "").replace(/\*\s+as\s+[A-Za-z_$][\w$]*/, "")
  const dflt = /([A-Za-z_$][\w$]*)/.exec(rest)
  if (dflt !== null) said.push(`const ${dflt[1]} = ${ref}.default;`)
  return said.join("\n")
}

/**
 * ONE IMPORT STATEMENT, as a compiler emits one.
 *
 * The clause admits no quote and no semicolon, which is what keeps a BARE
 * `import "x";` from being swallowed as the clause of a later statement — the
 * one way a lazy match across lines goes wrong here, and the reason this is not
 * simply `[\s\S]*?`. Braces may still wrap over lines, which babel's output
 * does.
 */
const IMPORT = /(^|\n)[ \t]*import\s+(?:([^;'"]*?)\s+from\s*)?(['"])([^'"]+)\3[ \t]*;?/g

/** ...and anything module-shaped that survived it — an import, a re-export, or
 *  a bare import. The `m` flag is what makes `^` a line start, because that is
 *  where a statement is. */
const LEFTOVER = /^[ \t]*(?:import\s+['"{*A-Za-z_$]|export\s+[^;'"]*?\sfrom\s*['"])/m
