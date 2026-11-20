import type { PluginMark } from "@olai/plugin-api"

import { faces } from "./faces.ts"

export const markOf = (name: string): PluginMark | undefined =>
  faces().hung("delivery.mark").find((one) => one.plugin === name)?.face

export const faceOf = (row: string | undefined) =>
  row === undefined ? undefined : faces().hung("tool.reply").find(one => one.plugin === row)?.face
