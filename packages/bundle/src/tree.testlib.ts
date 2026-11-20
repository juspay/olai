import * as path from "node:path"

import {
  type Edge as DoorEdge,
  type Graph as DoorGraph,
  type Manifest,
  cssImportsOf,
  dependencyNames,
  doorsOf,
  edgesOf as edgesOfSource,
  grammarOf,
  isBench,
  mainOf,
  manifestAt as manifestAtDirectory,
  packageOf,
  readWorkspace,
  specifiersOf,
  withoutComments,
} from "@olai/effect-cordis/fence"

import { ROWS } from "./rows.ts"

export const PACKAGES = path.join(import.meta.dirname, "..", "..")

export const REPO = path.join(PACKAGES, "..")

export const TREE = readWorkspace(REPO)

const relativeToPackages = (member: string): string => path.relative("packages", member)

export const manifestOf = (member: string): Manifest | undefined => manifestAtDirectory(path.join(PACKAGES, member))

const withoutShellComments = (text: string, nix: boolean): string => {
  let out = ""
  let at = 0
  const blankTo = (end: number): void => {
    for (; at < end && at < text.length; at += 1) out += text[at] === "\n" ? "\n" : " "
  }
  const copy = (count: number): void => {
    for (let n = 0; n < count && at < text.length; n += 1, at += 1) out += text[at]
  }
  while (at < text.length) {
    const ch = text[at]
    if (ch === "#" && (nix || /^\s$/.test(text[at - 1] ?? " "))) {
      const end = text.indexOf("\n", at)
      blankTo(end === -1 ? text.length : end)
      continue
    }
    if (nix && ch === "/" && text[at + 1] === "*") {
      const close = text.indexOf("*/", at + 2)
      blankTo(close === -1 ? text.length : close + 2)
      continue
    }
    if (nix && ch === "'" && text[at + 1] === "'") {
      copy(2)
      while (at < text.length) {
        if (text[at] === "'" && text[at + 1] === "'") {
          const after = text[at + 2]
          if (after === "'" || after === "$" || after === "\\") {
            copy(3)
            continue
          }
          copy(2)
          break
        }
        copy(1)
      }
      continue
    }
    if (ch === '"' || (!nix && ch === "'")) {
      copy(1)
      while (at < text.length && text[at] !== ch) {
        if (text[at] === "\\") {
          copy(2)
          continue
        }
        copy(1)
      }
      copy(1)
      continue
    }
    copy(1)
  }
  return out
}

const ONLY_A_COMMENT = /^[ \t]*(?:#|\/\/)/

export const codeIn = (file: string, text: string): string =>
  (/\.(?:[cm]?[jt]sx?)$/.test(file) ? withoutComments(file, text) : withoutShellComments(text, file.endsWith(".nix")))
    .split("\n")
    .map((line) => (ONLY_A_COMMENT.test(line) ? "" : line))
    .join("\n")

export { cssImportsOf, dependencyNames, doorsOf, grammarOf, isBench, mainOf, packageOf, specifiersOf, withoutComments }

export const ROOT_DECLARED: ReadonlySet<string> = new Set(dependencyNames(manifestAtDirectory(REPO)))

export const MEMBERS: ReadonlyArray<string> = TREE.members.map(relativeToPackages)

export const MEMBER_OF_PACKAGE: ReadonlyMap<string, string> = new Map(
  [...TREE.memberOfPackage].map(([name, member]) => [name, relativeToPackages(member)]),
)

export const memberOf = (file: string): string | undefined => {
  const member = TREE.memberOf(`packages/${file}`)
  return member === undefined ? undefined : relativeToPackages(member)
}

export const sourcesUnder = (dir: string): ReadonlyArray<string> =>
  TREE.sources
    .filter((source) => {
      const at = path.join(REPO, source.file)
      return at === dir || at.startsWith(`${dir}${path.sep}`)
    })
    .map((source) => path.join(REPO, source.file))


export interface Named {
  readonly file: string
  readonly grammar: "css" | "tsx" | "ts"
  readonly specs: ReadonlyArray<string>
}

export const edgesOf = (file: string, text: string): ReadonlyArray<DoorEdge> => edgesOfSource(file, text, true)

export const transpilers = {
  ts: new Bun.Transpiler({ loader: "ts" }),
  tsx: new Bun.Transpiler({ loader: "tsx" }),
} as const

export interface TreeGraph {
  readonly reached: ReadonlyArray<{ readonly file: string; readonly spec: string; readonly dynamic: boolean }>
  readonly files: ReadonlyArray<string>
  readonly unresolved: ReadonlyArray<string>
}

export const graphFrom = (entry: string): TreeGraph => {
  const graph: DoorGraph = TREE.graphOf(path.relative(REPO, entry))
  const seen = (file: string): string => path.relative(PACKAGES, path.join(REPO, file))
  return {
    reached: graph.reached.map((edge) => ({ ...edge, file: seen(edge.file) })),
    files: graph.visited.map(seen),
    unresolved: graph.unresolved,
  }
}

export const walkFrom = (entry: string): ReadonlyArray<{ file: string; spec: string }> => graphFrom(entry).reached

export const serverHalves = async (): Promise<ReadonlyArray<ServerHalf>> =>
  Promise.all(ROWS.map((row) => import(row.name) as Promise<ServerHalf>))

export interface ServerHalf {
  readonly name: string
  readonly surface?: { readonly spec: unknown }
  readonly faces?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly kinds?: ReadonlyArray<{ readonly kind: string }>
}

export const composing = (
  halves: ReadonlyArray<ServerHalf>,
): ReadonlyArray<ServerHalf & { readonly surface: { readonly spec: unknown }; readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>> }> =>
  halves.flatMap((half) => {
    if (half.surface === undefined) return []
    if (half.faces === undefined) {
      throw new Error(`${half.name}: a half with a surface and no \`faces\` composes a sibling nobody may see`)
    }
    return [{ ...half, surface: half.surface, faces: half.faces }]
  })
