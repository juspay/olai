// Org2 0.7 ships the canonical parser as JavaScript without declaration files.
// Keep the unsupported deep import quarantined here so the rest of OLAI has a
// typed boundary to replace when Org2 publishes a stable library export.
// @ts-expect-error — the published package has no TypeScript declarations.
import { parseOrgWithDiagnostics as parse } from "@aviaviavi/org2/dist/parser.js"

export interface Org2Diagnostic {
  readonly message: string
  readonly line: number
  readonly column: number
}

export interface Org2SourceRange {
  readonly startLine: number
  readonly endLine: number
}

export interface Org2Property {
  readonly key: string
  readonly value: string
}

export interface Org2AstNode {
  readonly type: string
  readonly children?: ReadonlyArray<Org2AstNode>
  readonly properties?: ReadonlyArray<Org2Property>
  readonly sourceRange?: Org2SourceRange
}

export interface Org2Document extends Org2AstNode {
  readonly type: "Document"
  readonly children: ReadonlyArray<Org2AstNode>
}

type Parse = (
  input: string,
  options?: { readonly sourceRanges?: boolean },
) => {
  readonly ast: Org2Document
  readonly diagnostics: ReadonlyArray<Org2Diagnostic>
}

export const parseOrgWithDiagnostics: Parse = parse as Parse
