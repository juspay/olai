export interface Uses {
  readonly said: string
  readonly named: string
}

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

const PLUMBING: Readonly<Record<string, true>> = { definePlugin: true, serviceTag: true }

export const usesOf = (server: string, browser: string | null = null): ReadonlyArray<Uses> => {
  const found = new Map<string, Uses>()
  for (const half of [server, browser ?? ""]) {
    for (const one of readHalf(half)) if (!found.has(one.named)) found.set(one.named, one)
  }
  return [...found.values()]
}

const readHalf = (source: string): ReadonlyArray<Uses> => {
  const lines: Array<Uses> = []
  const imports = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']@olai\/plugin-api(?:\/[a-z-]+)?["']/g
  for (let match: RegExpExecArray | null; (match = imports.exec(source)) !== null;) {
    for (const raw of match[1]!.split(",")) {
      const name = raw.replace(/^\s*type\s+/, "").split(/\s+as\s+/)[0]!.trim()
      if (name === "" || PLUMBING[name] === true) continue
      lines.push({ said: DOORS[name] ?? `Uses olai's \`${name}\``, named: name })
    }
  }
  const tags = /serviceTag\s*(?:<[\s\S]*?>\s*)?\(\s*["']([a-z][a-z0-9-]*\.[a-z][a-z0-9-]*)["']/g
  for (let match: RegExpExecArray | null; (match = tags.exec(source)) !== null;) {
    const key = match[1]!
    lines.push({ said: `Uses what the \`${key.split(".")[0]}\` plugin offers`, named: key })
  }
  const slots = /register\s*\(\s*["']([a-z][a-z0-9.-]*\.[a-z][a-z0-9.-]*)["']\s*(?:,\s*["']([a-z][a-z0-9-]*)["'])?/g
  for (let match: RegExpExecArray | null; (match = slots.exec(source)) !== null;) {
    const slot = match[1]!
    const key = match[2]
    lines.push({
      said: key === undefined ? `Draws in the app's \`${slot}\`` : `Draws on anything wearing \`${key}\``,
      named: key === undefined ? slot : `${slot} · ${key}`,
    })
  }
  const kinds = /register\s*\(\s*\{[^}]*\bkind\s*:\s*["']([a-z][a-z0-9-]*)["']/g
  for (let match: RegExpExecArray | null; (match = kinds.exec(source)) !== null;) {
    lines.push({ said: `Adds a property kind to this vault: ${match[1]!}`, named: `kind · ${match[1]!}` })
  }
  return lines
}
