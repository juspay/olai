/**
 * THE AGENT FACE'S BUNDLE, as the CLI reaches it — one entry per row that gives
 * an agent anything, and nothing decided here.
 *
 * `olai surface <verb>` DIALS `/mcp`. So the surfaces it addresses, the expose
 * maps it resolves URIs from, and the verbs it offers must be the very ones the
 * served face publishes, or the CLI names a resource nobody answers or a verb
 * nobody has. Each line is one row's own `surface`, its own `resources` and its
 * own `tools` — the same three the served face reads off that row's
 * registration — so the two halves cannot drift, and giving a row a verb or a
 * resource is an edit in that row's package and nowhere else.
 *
 * ## Why the registry holds it
 *
 * `@olai/server` is a general package, and `./fence.test.ts`'s "general
 * production packages name no plugins" refuses a plugin specifier in one of its
 * production files — a rule with no exception for a door that happens to be a
 * contract, because a general package that can name one plugin can name any.
 * The registry is the one member allowed to, and composing plugin-owned
 * declarations for a general consumer is what it is FOR: `./assets.ts` and
 * `./policy.ts` are the same move.
 *
 * ## What it replaced
 *
 * `./surface.ts`'s flat aggregate of every row's members, `./faces.ts`'s
 * hand-written `MCP` map beside it, and `@olai/ops`' one closed table of thirty
 * verbs — three statements of what an agent gets, in packages no row could
 * edit, which is #546's whole finding. juspay/kolu#2234 is what let the last of
 * it go: both projecting faces take a rooted bundle, resolve each row's map
 * against that row's own spec, and record a tool's owner on the entry rather
 * than spelling it into the name — so a verb keeps the word it was authored
 * with and still leaves with its row.
 *
 * ## Why it is STATIC where the served face's is live
 *
 * A CLI is one command against a server that already made its own decisions.
 * What is standing THERE is answered by the dial — a member whose row is off is
 * a URI the server does not publish and a verb it does not offer, and reaching
 * for either fails with the server's own words. A build-time list is the honest
 * shape for the caller's half, and it is why this file may import statically
 * where the served face reads its rows off the registry.
 */
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

/** What a row with no `resources` publishes: nothing. Spelled once, because
 *  `{}` written eight times reads like an oversight and this is a decision —
 *  most rows' whole agent face is verbs, and a resource is an ADDRESS, which
 *  only a member worth subscribing to needs. */
const NO_RESOURCES = {} as const

/**
 * One row's half of the bundle per key — the pair both projecting faces take,
 * under the key that becomes its URI segment and its argv word.
 *
 * DELIBERATELY UNANNOTATED. Both faces type their sibling map as
 * `{ [K in keyof M]: … }` so that TypeScript infers one spec per key and checks
 * each `expose` against ITS OWN surface; a `Record<string, …>` annotation here
 * would collapse every entry to the loosest shape and take that check away,
 * which is the whole reason the framework spells it that way.
 */
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
