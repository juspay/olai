import { tools as capture } from "olai-plugin-capture/tools"
import { surface as captureSurface } from "olai-plugin-capture/surface"
import { tools as files } from "olai-plugin-files/tools"
import { surface as filesSurface } from "olai-plugin-files/surface"
import { tools as git } from "olai-plugin-git/tools"
import { surface as gitSurface } from "olai-plugin-git/wire"
import { resources as markdown, surface as markdownSurface } from "olai-plugin-markdown/surface"
import { tools as markdownTools } from "olai-plugin-markdown/tools"
import { resources as outlines, surface as outlinesSurface } from "olai-plugin-outlines/surface"
import { tools as outlinesTools } from "olai-plugin-outlines/tools"
import { tools as search } from "olai-plugin-search/tools"
import { surface as searchSurface } from "olai-plugin-search/surface"
import { tools as trash } from "olai-plugin-trash/tools"
import { surface as trashSurface } from "olai-plugin-trash/surface"
import { resources as vault, surface as vaultSurface } from "olai-plugin-vault/surface"
import { tools as definitions } from "olai-plugin-vault-plugins/tools"
import { surface as definitionsSurface } from "olai-plugin-vault-plugins/surface"

interface AgentRow {
  readonly surface: { readonly spec: unknown }
  readonly expose?: Readonly<Record<string, unknown>>
  readonly tools: ReadonlyArray<unknown>
}

const agentSiblings = <const T extends Readonly<Record<string, AgentRow>>>(
  rows: T,
): { readonly [K in keyof T]: AgentRow & T[K] } => rows

export const AGENT_SIBLINGS = agentSiblings({
  outlines: { surface: outlinesSurface, expose: outlines, tools: outlinesTools },
  markdown: { surface: markdownSurface, expose: markdown, tools: markdownTools },
  files: { surface: filesSurface, tools: files },
  trash: { surface: trashSurface, tools: trash },
  search: { surface: searchSurface, tools: search },
  capture: { surface: captureSurface, tools: capture },
  git: { surface: gitSurface, tools: git },
  "vault-plugins": { surface: definitionsSurface, tools: definitions },
  vault: { surface: vaultSurface, expose: vault, tools: [] },
})
