/**
 * WHAT A DYNAMIC PLUGIN'S SOURCE MAY NAME — the one gate, and a whole sentence
 * when it says no.
 *
 * ## Why there is a gate at all
 *
 * A vault has no `node_modules` and never will (the human, 2026-09-05), so
 * there is no arrangement in which `import "left-pad"` works. What a gate adds
 * is not safety — the code runs with the process's authority either way, which
 * is the whole reason a person approves it — it is a SENTENCE: the difference
 * between a plugin that lands `failed` quoting a module resolution error nobody
 * wrote, and one that is refused at the moment it is defined, naming the
 * specifier and the three words that would have worked.
 *
 * ## The scan is Bun's, and that is the point
 *
 * `Bun.Transpiler.scan` is a real parse: a specifier in a comment is not an
 * import, a specifier in a string is not an import, a `import type` that the
 * emit erases is not an import, and a `import("…")` is reported as its own kind.
 * The regex this replaced could get any of those wrong, and every one of its
 * mistakes was a refusal of somebody's working plugin.
 *
 * ## The two kinds refused as KINDS rather than as names
 *
 * A DYNAMIC import is refused whatever it names, because what it names is not
 * knowable here — the string is an expression, and a plugin that could compute
 * a specifier could reach whatever the process can reach, one `import()` past
 * the gate a person approved. A RELATIVE import is refused because a dynamic
 * plugin is two files and there is nothing beside them: `./util.ts` names a
 * path in somebody's vault that olai never read.
 *
 * ## And the subpaths
 *
 * The three are named WHOLE. `effect/Schema` and `solid-js/web` are refused —
 * the second one deliberately, and it is worth the sentence: `solid-js/web` IS
 * bound in the built module, because that is what the Solid transform emits, and
 * an author who writes it by hand is reaching for the transform's plumbing rather
 * than for Solid. `./shared.ts` binds it; this refuses it.
 */

import { BROWSER_MODULES, SERVER_MODULES, WRITABLE_MODULES } from "./shared.ts"

/** WHICH HALF is being read — the two doors `@olai/plugin-api` has, and the one
 *  fact the gate itself does not use (both halves may name the same three) but
 *  every caller of this module carries anyway. */
export type Half = "server" | "browser"

/** The host modules a half's built text is bound against — see `./shared.ts`. */
export const modulesFor = (half: Half): ReadonlyArray<string> =>
  half === "server" ? SERVER_MODULES : BROWSER_MODULES

/**
 * WHY THIS SOURCE WILL NOT BUILD, in whole sentences, or `null`.
 *
 * ONE refusal and not a list: the first unresolvable specifier is the one to
 * fix, and a plugin with four of them is a plugin whose author has not read
 * this rule at all. The sentence names the specifier and the three words that
 * do work, because a refusal that does not say what would have worked sends
 * somebody to the source of olai.
 */
export const unresolvable = (source: string): string | null => {
  let found: ReadonlyArray<{ readonly kind: string; readonly path: string }>
  try {
    found = scan(source)
  } catch (thrown) {
    // A SOURCE THAT WILL NOT PARSE IS REFUSED HERE, by the parser that met it
    // first. The alternative — swallow it and let the compiler one step down say
    // the same thing — is a second sentence about one fault, and the compiler's
    // is not better: both are Bun's, and this one arrives before anything has
    // been built.
    return said(thrown)
  }
  for (const named of found) {
    if (named.kind === "dynamic-import") {
      return `a dynamic plugin may not compute a module to load, and this one does: `
        + `import("${named.path}"). What a person approved is the source they read, so `
        + `every module a plugin uses has to be visible in it — write the import at the top.`
    }
    if (named.kind !== "import-statement") continue
    if (named.path.startsWith(".") || named.path.startsWith("/")) {
      return `a dynamic plugin is a server half and a browser half and nothing else, so `
        + `there is nothing for "${named.path}" to name. Put what it holds in the same file, `
        + `or in the other half.`
    }
    if (!WRITABLE_MODULES.includes(named.path)) {
      return `olai resolves ${and(WRITABLE_MODULES)} for a plugin it mounts from a vault, `
        + `and nothing else — so "${named.path}" names nothing this serve can hand over. `
        + `A vault has no node_modules.`
    }
  }
  return null
}

/** `a`, `b` and `c` — the list as a person reads it, because this is prose and
 *  a comma-joined list of three reads as a fragment. */
const and = (words: ReadonlyArray<string>): string =>
  words.length < 2
    ? (words[0] ?? "")
    : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`

/** A thrown thing as a person's sentence — the parser's own words, never the
 *  word "Error" dressed up as one. */
const said = (thrown: unknown): string => {
  const message = thrown instanceof Error ? thrown.message : String(thrown)
  const trimmed = message.trim()
  return trimmed === "" ? "this source will not parse, and the parser said nothing about why" : trimmed
}

/** What Bun's own parse says this source imports. `tsx` for BOTH halves: a
 *  server half has no JSX in it, and a loader that admits some is not a loader
 *  that invents any. */
const scan = (source: string): ReadonlyArray<{ readonly kind: string; readonly path: string }> =>
  new Bun.Transpiler({ loader: "tsx" }).scan(source).imports
