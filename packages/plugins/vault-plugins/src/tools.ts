/**
 * THIS ROW'S AGENT VERBS — what a plugin AUTHOR reaches for, and the reason
 * this file exists at all.
 *
 * ## The hole they fill, which was a whole section of the doc
 *
 * A grant on this row's agent face decides what a caller may CALL and says
 * nothing about what it is OFFERED: an ACP engine is handed a tool list, and a
 * member with no tool over it is a member no agent knows is there. So the first
 * instruction in `website/docs/dynamic-plugins.md` — *read the guide before writing
 * code* — named something no agent could reach, and `run`, the author's only
 * feedback loop, went with it. A node agent working on this branch found both
 * by trying (juspay/olai#506).
 *
 * ## Why they are HERE, and where they were
 *
 * They were hand-written `BespokeTool`s inside `olai-plugin-mcp`, with a
 * name-to-member map beside them deciding when to advertise them — one row's
 * vocabulary held by another row. They could not live in `@olai/ops` either,
 * and that reason still stands: its table is the OPERATIONS ON A VAULT, and a
 * plugin is not an operation on a vault, it is a thing this SERVE mounts.
 *
 * `calls` is the arm that reaches a row's OWN surface (see `@olai/ops`' `Tool`),
 * so these five dispatch to the same procedures the page reaches, and an agent
 * asking what became of its plugin and a person looking at the page read one
 * answer.
 *
 * ## What each of them is, in the agent's own words
 *
 * The descriptions below are the ones an engine reads in `tools/list`, and they
 * are written for somebody about to write a plugin rather than for somebody
 * reading this file. They say what the boundary is, because an author who does
 * not know that a person has to turn the thing on will read `pending` as a
 * failure.
 */
import { calls, landed, NoArgs, type Tool } from "@olai/ops"
import type { SurfaceClient } from "@olai/surface/client"
import { PLUGIN_BROWSER_FILE, PLUGIN_FOLDER, PLUGIN_README_FILE, PLUGIN_SERVER_FILE } from "@olai/surface"
import { Schema } from "effect"
import { surface } from "./surface.ts"

/** This row's own client — the members below are compiler-checked against the
 *  spec one file over, which is the whole reason `calls` infers this type from
 *  the callback rather than naming it in a general package. */
type Client = SurfaceClient<typeof surface.spec>

/** The plugin's word — the name of its folder under `plugins/`. */
const Named = Schema.Struct({
  name: Schema.String.annotate({
    description: `The plugin's word — the name of its folder under \`${PLUGIN_FOLDER}\`.`,
  }),
})

const Written = Schema.Struct({
  name: Schema.String.annotate({
    description: `The plugin's word. Its folder, \`${PLUGIN_FOLDER}<word>/\`, is created if it is `
      + `not there yet.`,
  }),
  file: Schema.String.annotate({
    description: `Which of the three: \`${PLUGIN_README_FILE}\`, \`${PLUGIN_SERVER_FILE}\` or `
      + `\`${PLUGIN_BROWSER_FILE}\`. Nothing else is part of a plugin.`,
  }),
  text: Schema.String.annotate({
    description: "The file's whole text, verbatim. It replaces what is there.",
  }),
})

export const tools: ReadonlyArray<Tool> = [
  calls(
    "guide",
    "How to write a plugin for this vault",
    "READ THIS FIRST. The whole authoring guide, shipped inside this olai binary — the folder a "
      + "plugin takes, what each half may import (there is no node_modules in a vault and nothing "
      + "else resolves), how to declare settings, how to hang a face in the app, how to check a "
      + "half before you ask anybody to look at it, and two worked examples you can start from. "
      + "It is the same page a person reads, so it is current for THIS build rather than for "
      + "whatever you remember about olai.",
    NoArgs,
    false,
    (client: Client) => landed(client.surface.plugins.guide({})),
  ),
  calls(
    "inspect",
    "What a plugin may name",
    "The lists that decide whether a half will mount at all, read off the live registry rather "
      + "than described: the bare modules a half may import, the service keys a server half may "
      + "put in its `needs`, the slots a browser half may register a face into and what keys each, "
      + "the folder a plugin takes and where its settings live, and every plugin word this serve "
      + "already has — built rows and other vault folders alike, since a plugin may take neither. "
      + "Read it after `guide` and before you write code.",
    NoArgs,
    false,
    (client: Client) => landed(client.surface.plugins.inspect({})),
  ),
  calls(
    "write",
    "Write one file of one plugin",
    "Writes one of a plugin's three files through this vault's ordinary write door — the same "
      + "planner, the same validation and the same commit as any other change — creating the "
      + "folder if it is not there. It answers whether that half COMPILES in the same reply, with "
      + "the error where it does not, so you do not have to write and then guess. Write "
      + `\`${PLUGIN_README_FILE}\` first and write it for a PERSON: a \`# Title\` line, a blank `
      + "line, then one sentence saying what the plugin does, then as much prose as it deserves. "
      + "That heading and that sentence are what somebody reads on the plugin's page while they "
      + "decide whether to run your code.",
    Written,
    true,
    (client: Client, args) => landed(client.surface.plugins.write(args)),
  ),
  calls(
    "run",
    "Look at a plugin this vault defines",
    "Asks olai to read a plugin's folder as it stands now and say what became of it. THIS DOES "
      + "NOT TURN ANYTHING ON: a plugin whose current version nobody has approved answers "
      + "`pending`, and that is the boundary rather than a failure — a person turns it on from "
      + "its own page, with what you wrote in front of them, because the code runs with this "
      + "server's own authority. `state` is one of the plugin states (`pending`, `running`, "
      + "`failed`, `waiting`, `switched`, `off`), `version` is the content hash of both halves, "
      + "and `fault` is a whole sentence where there is one — a half that would not compile, a "
      + "module olai does not bind, a half that calls itself another word. Call this when you are "
      + "finished writing, and fix anything it names.",
    Named,
    true,
    (client: Client, args) => landed(client.surface.plugins.run(args)),
  ),
  calls(
    "stop",
    "Stop a plugin this vault defines",
    "Turns one plugin the VAULT defines off: its registrations unwind, and the switch is written "
      + "down in the settings file, so it stays off across a restart until somebody turns it back "
      + "on. It reaches vault plugins ONLY — a plugin this build compiled in is not an agent's to "
      + "stop, and naming one is answered as no such plugin. To retract a plugin altogether, "
      + "delete its folder.",
    Named,
    true,
    (client: Client, args) => landed(client.surface.plugins.stop(args)),
  ),
]
