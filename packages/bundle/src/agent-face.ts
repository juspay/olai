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

const NO_RESOURCES = {} as const

export const AGENT_SIBLINGS = {
  outlines: { surface: outlinesSurface, expose: outlines, tools: outlinesTools },
  markdown: { surface: markdownSurface, expose: markdown, tools: markdownTools },
  files: { surface: filesSurface, expose: NO_RESOURCES, tools: files },
  trash: { surface: trashSurface, expose: NO_RESOURCES, tools: trash },
  search: { surface: searchSurface, expose: NO_RESOURCES, tools: search },
  capture: { surface: captureSurface, expose: NO_RESOURCES, tools: capture },
  git: { surface: gitSurface, expose: NO_RESOURCES, tools: git },
  "vault-plugins": { surface: definitionsSurface, expose: NO_RESOURCES, tools: definitions },
  vault: { surface: vaultSurface, expose: vault, tools: [] },
} as const
