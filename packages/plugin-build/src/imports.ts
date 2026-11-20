import { BROWSER_MODULES, SERVER_MODULES, WRITABLE_MODULES } from "./shared.ts"

/** Which half is being read — the two doors `@olai/plugin-api` has. */
export type Half = "server" | "browser"

/** The host modules a half's built text is bound against — see `./shared.ts`. */
export const modulesFor = (half: Half): ReadonlyArray<string> =>
  half === "server" ? SERVER_MODULES : BROWSER_MODULES

/**
 * Why this source will not build, in whole sentences, or `null`. One refusal
 * and not a list: it names the first unresolvable specifier and the three
 * words that do work.
 */
export const unresolvable = (source: string): string | null => {
  let found: ReadonlyArray<{ readonly kind: string; readonly path: string }>
  try {
    found = scan(source)
  } catch (thrown) {
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

const and = (words: ReadonlyArray<string>): string =>
  words.length < 2
    ? (words[0] ?? "")
    : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`

const said = (thrown: unknown): string => {
  const message = thrown instanceof Error ? thrown.message : String(thrown)
  const trimmed = message.trim()
  return trimmed === "" ? "this source will not parse, and the parser said nothing about why" : trimmed
}

const scan = (source: string): ReadonlyArray<{ readonly kind: string; readonly path: string }> =>
  new Bun.Transpiler({ loader: "tsx" }).scan(source).imports
