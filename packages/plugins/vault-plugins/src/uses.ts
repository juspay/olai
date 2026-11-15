/**
 * WHAT A PLUGIN REACHES FOR, said in words a person can read — the page's
 * *What it uses*, and the one thing on it that is derived from the code rather
 * than written by its author.
 *
 * ## Why it is read off the imports and not declared
 *
 * Because a declaration is a second thing to keep true. An author who had to
 * write down what their plugin touches would write it once, change the code,
 * and leave the list behind — and the list is on the screen where somebody is
 * deciding whether to run the code. So this reads the SOURCE: the names each
 * half imports from `@olai/plugin-api`, the service keys its `serviceTag("…")`
 * literals name, and the slots its `register("…", …)` calls hang faces in.
 *
 * ## It is a SUMMARY, and the page says so
 *
 * This is not a permission list and olai must never let it be read as one.
 * There is no sandbox: a plugin runs with this server's whole authority, and
 * the page carries that sentence under this one, permanently. What the list is
 * for is the ordinary question a person actually has — *what is this thing
 * going to do to my vault?* — answered from the code's own first lines rather
 * than from prose nobody checked.
 *
 * ## A READING OF TEXT, not a parse
 *
 * Regular expressions over the source, deliberately. The alternative is this
 * package carrying a TypeScript parser to answer a question whose wrong answer
 * costs a missing row on a page, and whose right answer is visible in the first
 * ten lines of every plugin ever written. A half that hides its imports behind
 * cleverness gets a shorter list and still runs with the same authority — which
 * is why the standing sentence, not this list, is what the trust rests on.
 */

/** One line of the list: the plain words, and the technical name beside them. */
export interface Uses {
  readonly said: string
  readonly named: string
}

/**
 * WHAT EACH CORE DOOR MEANS, in a sentence a person who has never read this
 * repository can act on.
 *
 * Keyed by the name a half imports from `@olai/plugin-api`. A door that is not
 * here is still listed — by its own name, with a general sentence — because the
 * honest answer to an unfamiliar import is "it uses this", not silence.
 */
const DOORS: Readonly<Record<string, string>> = {
  Kinds: "Teaches this vault a property kind",
  Slots: "Draws something in the app",
  Vault: "Reads the files in this directory",
  Ops: "Writes to the files in this directory",
  Surfaces: "Puts members of its own on the wire",
  Deliveries: "Speaks into your agent conversations",
  Wakes: "Can wake a conversation",
  Clock: "Reads the time",
  Env: "Reads this server's environment",
  LocalState: "Remembers things between restarts",
  Offers: "Offers something other plugins can use",
  Tools: "Gives your agents new tools",
  Agents: "Adds an agent engine",
  FileKinds: "Claims a kind of file in this directory",
  Wired: "Talks to its own server half",
  Clocks: "Follows the time in the page",
  Directory: "Reads the served directory",
  HttpClient: "Reaches the network",
  Commands: "Runs programs on this computer",
}

/** The import names that say nothing a person needs to read: the ones every
 *  plugin has, which carry no reach of their own. */
const PLUMBING: Readonly<Record<string, true>> = { definePlugin: true, serviceTag: true }

/**
 * THE LIST, for one plugin — both halves folded into one reading, deduped by
 * the technical name, in the order the code names them.
 *
 * Both halves together because a person is deciding about a PLUGIN. The two
 * files are an implementation fact; "draws a chip on outline rows" is true of
 * the plugin whichever half does it.
 */
export const usesOf = (server: string, browser: string | null = null): ReadonlyArray<Uses> => {
  const found = new Map<string, Uses>()
  for (const half of [server, browser ?? ""]) {
    for (const one of readHalf(half)) if (!found.has(one.named)) found.set(one.named, one)
  }
  return [...found.values()]
}

const readHalf = (source: string): ReadonlyArray<Uses> => {
  const lines: Array<Uses> = []
  // THE DOORS, out of every `import { … } from "@olai/plugin-api"` — including
  // the subpath door a server half is typechecked against, since that is the
  // same door under the name the check wants.
  const imports = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']@olai\/plugin-api(?:\/[a-z-]+)?["']/g
  for (let match: RegExpExecArray | null; (match = imports.exec(source)) !== null;) {
    for (const raw of match[1]!.split(",")) {
      const name = raw.replace(/^\s*type\s+/, "").split(/\s+as\s+/)[0]!.trim()
      if (name === "" || PLUMBING[name] === true) continue
      lines.push({ said: DOORS[name] ?? `Uses olai's \`${name}\``, named: name })
    }
  }
  // THE PLUGIN-OWNED KEYS it names — a door another row stands behind, which is
  // the one reach that is not in core's vocabulary at all.
  const tags = /serviceTag\s*<[^>]*>\s*\(\s*["']([a-z][a-z0-9-]*\.[a-z][a-z0-9-]*)["']\s*\)|serviceTag\s*\(\s*["']([a-z][a-z0-9-]*\.[a-z][a-z0-9-]*)["']\s*\)/g
  for (let match: RegExpExecArray | null; (match = tags.exec(source)) !== null;) {
    const key = match[1] ?? match[2]!
    lines.push({ said: `Uses what the \`${key.split(".")[0]}\` plugin offers`, named: key })
  }
  // ...AND THE SLOTS it hangs a face in, with the kind word where it names one.
  const slots = /register\s*\(\s*["']([a-z][a-z0-9.-]*\.[a-z][a-z0-9.-]*)["']\s*(?:,\s*["']([a-z][a-z0-9-]*)["'])?/g
  for (let match: RegExpExecArray | null; (match = slots.exec(source)) !== null;) {
    const slot = match[1]!
    const key = match[2]
    lines.push({
      said: key === undefined ? `Draws in the app's \`${slot}\`` : `Draws on anything wearing \`${key}\``,
      named: key === undefined ? slot : `${slot} · ${key}`,
    })
  }
  // ...AND THE KIND WORDS it teaches, which is the one thing a plugin adds to
  // the vault's own vocabulary and the one a person's files are then held to.
  const kinds = /register\s*\(\s*\{[^}]*\bkind\s*:\s*["']([a-z][a-z0-9-]*)["']/g
  for (let match: RegExpExecArray | null; (match = kinds.exec(source)) !== null;) {
    lines.push({ said: `Adds a property kind to this vault: ${match[1]!}`, named: `kind · ${match[1]!}` })
  }
  return lines
}
