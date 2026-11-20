import { activeArm } from "@kolu/padi-client/vocab"
import type { TerminalAttention } from "@kolu/padi-client/attention"
import type { TerminalMetadata } from "@kolu/padi-client/surface"
import {
  annotationLine,
  bindStatePip,
  dockRowFacts,
  identityColor,
  paintDockRow,
} from "@kolu/solid-dockrow/rowValues"
import type { PadiTerminal } from "@kolu/padi-client/surface"
import {
  type FleetOwner,
  type FleetTerminal,
  resolveTerminal,
  TERMINAL_KEY,
  UNOWNED,
} from "./wire/index.ts"


export interface Claimant {
  readonly id: string
  readonly title: string
  readonly file: string
  readonly terminal: string | undefined
}

export const claimsIn = (
  nodes: Iterable<Claimant>,
  ids: Iterable<string>,
): ReadonlyMap<string, FleetOwner> => {
  const fleet = [...ids]
  const claims = new Map<string, FleetOwner>()
  for (const node of nodes) {
    const terminal = node.terminal
    if (terminal === undefined || terminal === "") continue
    const found = resolveTerminal(terminal, fleet)
    if (found.kind !== "one") continue
    if (claims.has(found.id)) continue
    claims.set(found.id, { kind: "node", id: node.id, title: node.title, file: node.file })
  }
  return claims
}

export const rowOf = (
  id: string,
  record: TerminalMetadata,
  owner: FleetOwner = UNOWNED,
  attention: TerminalAttention = { klass: "idle", live: false },
): FleetTerminal => {
  const git = record.git.kind === "repo" ? record.git.info : null
  const branch = git?.branch ?? ""
  const facts = dockRowFacts(record)
  const intent = record.intent
  return {
    id,
    pip: {
      ...bindStatePip({ meta: record, attention, unread: false }),
      hasAgent: activeArm(record)?.agent !== undefined,
    },
    bucket: paintDockRow(record, attention.klass),
    agentState: facts.agentState ?? null,
    label: annotationLine(intent, branch),
    labelColor: identityColor(branch),
    subline: facts.subline,
    pr: facts.pr,
    recencyAt: record.lastActivityAt,
    repo: git?.repoName ?? null,
    themeName: record.themeName ?? null,
    owner,
  }
}
