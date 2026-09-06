/**
 * THIS ROW'S AGENT VERBS — what a plugin AUTHOR reaches for, and the reason
 * this file exists at all.
 *
 * ## The hole they fill, which was a whole section of the doc
 *
 * `plugins.inspect`, `plugins.run` and `plugins.stop` are on this row's agent
 * face ({@link ./surface.ts}'s `faces`). That gates what a caller may CALL and
 * says nothing about what it is OFFERED: an ACP engine is handed a tool list,
 * and a member with no tool over it is a member no agent knows is there. So the
 * first instruction in `docs/dynamic-plugins.md` — *read `plugins.inspect`
 * before writing code* — named something no agent could reach, and
 * `plugins.run`, the author's only feedback loop, went with it. A node agent
 * working on this branch found both by trying (juspay/olai#506).
 *
 * ## Why they are HERE now, and where they were
 *
 * They were three hand-written `BespokeTool`s inside `olai-plugin-mcp`, with a
 * name-to-member map beside them in a `catalog.ts` deciding when to advertise
 * them — one row's vocabulary held by another row, which is the duplication
 * #546 is about. They could not live in `@olai/ops` either, and that reason
 * still stands: its table is the OPERATIONS ON A VAULT, and a plugin is not an
 * operation on a vault, it is a thing this SERVE mounts.
 *
 * What changed is that a tool no longer has to be one of those. `calls` is the
 * arm that reaches a row's OWN surface — see `@olai/ops`' `Tool` — so these
 * three dispatch to the same procedures the panel's own face reaches, and an
 * agent asking what became of its definition and a person looking at the row
 * read one answer.
 *
 * ## What each of them is, in the agent's own words
 *
 * The descriptions below are the ones an engine reads in `tools/list`, and they
 * are written for somebody about to write a plugin rather than for somebody
 * reading this file. They say what the boundary is, because an author who does
 * not know that a person has to approve the thing will read `pending` as a
 * failure.
 */
import { calls, landed, NoArgs, type Tool } from "@olai/ops"
import type { SurfaceClient } from "@olai/surface/client"
import { Schema } from "effect"
import { surface } from "./surface.ts"

/** This row's own client — the members below are compiler-checked against the
 *  spec one file over, which is the whole reason `calls` infers this type from
 *  the callback rather than naming it in a general package. */
type Client = SurfaceClient<typeof surface.spec>

/** The plugin's word — what the defining node's `plugin` property carries. */
const Named = Schema.Struct({
  name: Schema.String.annotate({
    description: "The plugin's word — what the defining node's `plugin` property carries.",
  }),
})

export const tools: ReadonlyArray<Tool> = [
  calls(
    "inspect",
    "What a plugin may name",
      "Read this BEFORE writing a plugin into the vault. Answers the four lists that decide whether a "
      + "half will mount at all: the bare modules a half may import (nothing else resolves — a vault has "
      + "no node_modules), the service keys a server half may put in its `needs`, the slots a browser "
      + "half may register a face into with what keys each, the node layout a definition takes (the two "
      + "properties and the two child titles), and every plugin word this serve already has — built rows "
      + "and other definitions alike, since a definition may take neither. Read off the live registry "
      + "rather than a description of it.",
    NoArgs,
    false,
    (client: Client) => landed(client.surface.plugins.inspect({})),
  ),
  calls(
    "run",
    "Look at a plugin this vault defines",
      "Asks olai to read a definition as it stands now and say what became of it. THIS DOES NOT MOUNT "
      + "ANYTHING BY ITSELF: a plugin whose current version nobody has approved answers `pending`, and "
      + "the answer is the boundary rather than a failure — a person approves it at the plugins panel, "
      + "with the source in front of them, because the code runs with this server's own authority. "
      + "`state` is one of the plugin states (`pending`, `running`, `failed`, `waiting`, `switched`, "
      + "`off`), `version` is the content hash of both halves, and `fault` is a whole sentence where "
      + "there is one — a half that would not compile, a module olai does not bind, a half that calls "
      + "itself another word. Write the two halves with `outlines_add` and `outlines_desc`, then call this.",
    Named,
    true,
    (client: Client, args) => landed(client.surface.plugins.run(args)),
  ),
  calls(
    "stop",
    "Stop a plugin this vault defines",
      "Unmounts one plugin the VAULT defines, for as long as this serve runs — its registrations unwind "
      + "and a restart comes back to what the vault says. It reaches definitions ONLY: a plugin this "
      + "build compiled in is not an agent's to stop, and naming one is answered as no such plugin. To "
      + "retract a definition altogether, trash the node — the source is ordinary vault content.",
    Named,
    true,
    (client: Client, args) => landed(client.surface.plugins.stop(args)),
  ),
]
