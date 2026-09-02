/**
 * THE VAULT HALF of the Spaces mirror — what `_olai/XyneSpaces.olai` says.
 *
 * Secrets stay in ENV (`OLAI_SPACES_URL`, `OLAI_SPACES_TOKEN`). This file
 * holds the non-secret knobs: which conversation is bound to which Spaces
 * channel, and the digest trim. Finding the file is a question about the
 * served outline paths rather than the nodes — `spacesFileIn` below, so a
 * config that parses to nothing still has a path a reader can name.
 *
 *   # Xyne Spaces
 *
 *   - mirror                           ← the binding, properties:
 *     - channel: "<spaces channel id>" ← required; nothing posts without it
 *     - agent: "claude"                ← optional; omit to bind every agent
 *     - session: "<session id>"        ← optional; omit to bind every session
 *   - digest                           ← the knobs, properties:
 *     - trim: "500"                    ← orchestrator-reply cap, characters
 *
 * ABSENT means nothing is mirrored (the plugin may still be connected). A
 * malformed trim defaults and is said, once per new shape.
 */

import { customText, isRegular, type Located } from "@olai/format"

/** The basename the convention answers to, case-folded at the caller's end. */
const FILE_BASENAME = "xynespaces.olai"

const MIRROR_TITLE = "mirror"
const DIGEST_TITLE = "digest"

/** Default orchestrator-reply cap, the human's ruling. */
export const DEFAULT_TRIM = 500

export interface MirrorBind {
  readonly channel: string
  readonly agent: string | null
  readonly session: string | null
}

export interface SpacesReading {
  readonly bind: MirrorBind | null
  readonly trim: number
  readonly malformed: ReadonlyArray<string>
}

/**
 * WHICH SERVED OUTLINE IS `_olai/XyneSpaces.olai`, asked of the outline PATHS,
 * not the nodes: a config that exists but parses to nothing contributes no
 * records, and a reader still needs to name where olai looked. Case-folded
 * by basename; rank is shallowest first, ties by path — kolu's
 * `koluFileIn`, with the nouns changed.
 */
export const spacesFileIn = (paths: Iterable<string>): string | undefined => {
  return [...paths]
    .filter((path) => path.split("/").pop()?.toLowerCase() === FILE_BASENAME)
    .sort(
      (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b),
    )[0]
}

/**
 * What the vault says the mirror's knobs are, read off one revision's nodes,
 * inside the file the convention named.
 *
 * ABSENT bind means nothing is mirrored. Within the named file the FIRST
 * `mirror` / `digest` node decides; a second is the owner's mistake.
 */
export const spacesConfigIn = (
  nodes: ReadonlyArray<Located>,
  file: string | null,
): SpacesReading => {
  if (file === null) return { bind: null, trim: DEFAULT_TRIM, malformed: [] }
  const inside = nodes.filter(isRegular).filter((located) => located.file === file)
  const mirror = inside.find(({ node }) => node.title === MIRROR_TITLE)
  const digest = inside.find(({ node }) => node.title === DIGEST_TITLE)
  const malformed: Array<string> = []

  const channel = mirror === undefined ? undefined : customText(mirror.node, "channel")?.trim()
  const agent = mirror === undefined ? undefined : customText(mirror.node, "agent")?.trim()
  const session = mirror === undefined ? undefined : customText(mirror.node, "session")?.trim()
  const bind: MirrorBind | null =
    channel === undefined || channel === ""
      ? null
      : {
        channel,
        agent: agent === undefined || agent === "" ? null : agent,
        session: session === undefined || session === "" ? null : session,
      }

  let trim = DEFAULT_TRIM
  if (digest !== undefined) {
    const written = customText(digest.node, "trim")
    if (written !== undefined) {
      const parsed = Number.parseInt(written.trim(), 10)
      if (!Number.isFinite(parsed) || parsed < 1) {
        malformed.push(
          `spaces: \`trim: ${written}\` in ${digest.file} is not a positive character count — write a number such as 500.`,
        )
      } else {
        trim = parsed
      }
    }
  }

  return { bind, trim, malformed }
}

/** Does this conversation match the bind? No bind matches nothing. */
export const boundTo = (
  bind: MirrorBind | null,
  agent: string,
  session: string,
): boolean => {
  if (bind === null) return false
  if (bind.agent !== null && bind.agent !== agent) return false
  if (bind.session !== null && bind.session !== session) return false
  return true
}
