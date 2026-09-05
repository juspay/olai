/**
 * `_olai/Settings.olai` — one file, one node per plugin, its properties the
 * section's fields.
 *
 * Core owns the path and the write. The plugin owns the schema that judges
 * the fields. A vault with no such file is schema defaults, which is the
 * ordinary state. Overlay identity is {@link PLUGIN_KEY} — the same
 * property a vault-defined plugin wears, because a title is prose.
 */

import {
  customOf,
  customText,
  isRegular,
  type Located,
  outlineNames,
  outlinePaths,
  type Reading,
  type Writer,
} from "@olai/format"
import type { Ops } from "@olai/ops"
import type { SettingsDocument, SettingsSave } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { PLUGIN_KEY } from "./dynamic/source.ts"

/** The basename the convention answers to, case-folded. */
const FILE_BASENAME = "settings.olai"

/** The chosen form, written when the vault has no settings file yet. */
export const SETTINGS_FILE = "_olai/Settings.olai"

/**
 * WHICH SERVED OUTLINE IS `_olai/Settings.olai` — by basename, shallowest
 * first, the way the shelf and the inbox are. A file that parses to nothing
 * still decides, so a root `Settings.olai` of notes shadows one parked
 * deeper.
 */
export const settingsFileIn = (paths: Iterable<string>): string | undefined =>
  [...paths]
    .filter((path) => path.split("/").pop()?.toLowerCase() === FILE_BASENAME)
    .sort(
      (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b),
    )[0]

/** The overlay, keyed by the `plugin` property. A second node of the
 *  same word is the owner's mistake; the first wins. A node with no
 *  such property is not a section. */
export const settingsDocumentIn = (
  nodes: ReadonlyArray<Located>,
  file: string | null,
): SettingsDocument => {
  if (file === null) return {}
  const document: Record<string, Record<string, string>> = {}
  for (const located of nodes.filter(isRegular).filter((one) => one.file === file)) {
    const plugin = customText(located.node, PLUGIN_KEY)
    if (plugin === undefined || plugin === "" || document[plugin] !== undefined) continue
    const fields: Record<string, string> = {}
    for (const key of Object.keys(customOf(located.node))) {
      if (key === PLUGIN_KEY) continue
      const value = customText(located.node, key)
      if (value !== undefined && value !== "") fields[key] = value
    }
    document[plugin] = fields
  }
  return document
}

export const settingsDocumentOf = (reading: Reading | null): SettingsDocument => {
  if (reading === null) return {}
  const file = settingsFileIn(outlinePaths(reading.set)) ?? null
  return settingsDocumentIn(reading.derived.nodes, file)
}

const nodeOf = (
  reading: Reading,
  file: string,
  plugin: string,
) =>
  reading.derived.nodes.filter(isRegular).find((located) =>
    located.file === file && customText(located.node, PLUGIN_KEY) === plugin
  )

const propsOf = (plugin: string, overlay: Readonly<Record<string, string>>): Record<string, string> =>
  ({ ...overlay, [PLUGIN_KEY]: plugin })

/**
 * WRITE ONE PLUGIN'S OVERLAY through the ordinary door. Creates the file
 * and the node when they do not exist; a missing key is absence.
 */
export const saveSettings = (ops: Ops, writer: Writer): SettingsSave =>
  (plugin, overlay) =>
    Effect.gen(function*() {
      const reading = yield* ops.read
      const named = settingsFileIn(outlinePaths(reading.set))
      const file = named ?? SETTINGS_FILE
      const present = outlineNames(reading.set).has(file)
      const fields = propsOf(plugin, overlay)
      if (!present) {
        yield* Effect.asVoid(ops.run(
          {
            op: "create",
            file,
            seed: {
              title: plugin,
              props: fields,
            },
          },
          writer,
        ))
        return
      }
      const node = nodeOf(reading, file, plugin)
      if (node === undefined) {
        yield* Effect.asVoid(ops.run(
          {
            op: "add",
            file,
            title: plugin,
            props: fields,
          },
          writer,
        ))
        return
      }
      const current = customOf(node.node)
      const opsList: Array<{
        readonly op: "prop"
        readonly id: string
        readonly key: string
        readonly value: string | null
      }> = []
      for (const [key, value] of Object.entries(fields)) {
        if (current[key] !== value) {
          opsList.push({ op: "prop", id: node.node.id, key, value })
        }
      }
      for (const key of Object.keys(current)) {
        if (key === PLUGIN_KEY) continue
        if (typeof current[key] === "string" && fields[key] === undefined) {
          opsList.push({ op: "prop", id: node.node.id, key, value: null })
        }
      }
      if (opsList.length === 0) return
      if (opsList.length === 1) {
        yield* Effect.asVoid(ops.run(opsList[0]!, writer))
        return
      }
      yield* Effect.asVoid(ops.run({ op: "apply", ops: opsList }, writer))
    })
