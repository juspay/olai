import { siteMap } from "./sitemap.ts"

export const AGENTS = ["Claude Code", "Codex", "OpenCode", "Pi", "Oh My Pi"] as const

export const agentList = `${AGENTS.slice(0, -1).join(", ")}, or ${AGENTS[AGENTS.length - 1]}`

const each = (await siteMap()).groups.flatMap((group) => group.groups).find((group) => group.title === "Each agent")
if (each === undefined) throw new Error('docs/index.md has no "### Each agent" group')
if (each.links.length !== AGENTS.length) {
  throw new Error(`docs/index.md lists ${each.links.length} agents under "Each agent", and the pitch names ${AGENTS.length}`)
}
